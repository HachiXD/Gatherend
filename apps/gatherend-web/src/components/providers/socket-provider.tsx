"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io as ClientIO, Socket } from "socket.io-client";
import { logger } from "@/lib/logger";
import { fetchWithRetry as fetchWithRetryCentral } from "@/lib/fetch-with-retry";
import { useSession } from "@/lib/better-auth-client";
import {
  SocketClientContext,
  SocketConnectionContext,
  SocketRecoveryContext,
} from "./socket-context";

// Environment check
const IS_DEV = process.env.NODE_ENV === "development";

// Heartbeat interval: 50 seconds (TTL is 120s, so this gives plenty of margin)
const HEARTBEAT_INTERVAL_MS = 50 * 1000;

// Helper function to fetch with retry logic (uses centralized helper)
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  return fetchWithRetryCentral(url, options);
}

export {
  useSocket,
  useSocketClient,
  useSocketConnection,
  useSocketRecoveryVersion,
} from "./socket-context";

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session, isPending } = useSession();
  const isLoaded = !isPending;
  const isSignedIn = Boolean(session?.user?.id);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null); // Para acceder al socket en beforeunload
  const hasConnectedBeforeRef = useRef(false);
  const wasDisconnectedRef = useRef(false);

  // Stop heartbeat interval
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Helper function to send heartbeat - uses socketRef as single source of truth
  const sendHeartbeat = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("presence:heartbeat");
    }
  }, []);

  // Start heartbeat interval (defensive: always stop first to prevent duplicates)
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(
      sendHeartbeat,
      HEARTBEAT_INTERVAL_MS,
    );
  }, [sendHeartbeat, stopHeartbeat]);

  const disconnectAndResetSocket = useCallback(
    (reason: string) => {
      stopHeartbeat();

      if (socketRef.current) {
        if (IS_DEV) {
          console.trace(
            `[SocketProvider] disconnect trace - reason: ${reason}`,
          );
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setSocket(null);
      setIsConnected(false);
    },
    [stopHeartbeat],
  );

  // Track previous deps for debugging
  const prevDepsRef = useRef({
    isLoaded: false,
    isSignedIn: false,
  });
  useEffect(() => {
    const prev = prevDepsRef.current;
    const changes: string[] = [];
    if (prev.isLoaded !== isLoaded)
      changes.push(`isLoaded: ${prev.isLoaded} → ${isLoaded}`);
    if (prev.isSignedIn !== isSignedIn)
      changes.push(`isSignedIn: ${prev.isSignedIn} → ${isSignedIn}`);
    if (changes.length > 0) {
    }
    prevDepsRef.current = { isLoaded, isSignedIn };
  }, [isLoaded, isSignedIn]);

  // Función para marcar offline explícitamente (logout)
  const goOffline = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("presence:logout");
    }
  }, []);

  useEffect(() => {
    // No inicializar socket si no está autenticado
    if (!isLoaded || !isSignedIn) {
      return;
    }

    const initSocket = async () => {
      // Prevent duplicate socket connections - check if socket instance exists
      if (socketRef.current) {
        if (socketRef.current.connected) {
          setSocket(socketRef.current);
          return;
        }
        // Socket exists but disconnected - reconnect same instance
        socketRef.current.connect();
        setSocket(socketRef.current);
        return;
      }

      try {
        // Obtener el profileId del usuario autenticado (with retry for Turbopack)
        const profileResponse = await fetchWithRetry("/api/profile");

        // Verificar que la respuesta sea válida antes de parsear
        if (!profileResponse.ok) {
          return;
        }

        const profileData = await profileResponse.json();

        if (!profileData || !profileData.id) {
          return;
        }

        const response = await fetchWithRetry("/api/socket/config");

        // Verificar que la respuesta sea válida
        if (!response.ok) {
          logger.error(`Socket config API returned ${response.status}`);
          return;
        }

        const { socketUrl } = await response.json();

        // IMPORTANT:
        // `io("https://host/some-path")` treats `/some-path` as the Socket.IO namespace.
        // Our envs may provide `NEXT_PUBLIC_SOCKET_URL=https://gatherend.com/api/r2` for legacy HTTP calls.
        // For Socket.IO we must connect to the origin, and put the gateway prefix in the `path` option instead.
        let socketOrigin = socketUrl;
        let socketPath = "/api/socket/io";
        try {
          const url = new URL(socketUrl);
          socketOrigin = url.origin;

          const prefix = url.pathname.replace(/\/+$/, "");
          socketPath =
            prefix && prefix !== "/"
              ? `${prefix}/api/socket/io`
              : "/api/socket/io";
        } catch {
          socketPath = socketUrl.includes("/api/r2")
            ? "/api/r2/api/socket/io"
            : "/api/socket/io";
        }

        // Create socket and immediately store in ref (single source of truth)
        const newSocket = ClientIO(socketOrigin, {
          path: socketPath,
          addTrailingSlash: false,
          auth: (cb) => {
            cb({ profileId: profileData.id });
          },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: Infinity, // Keep trying to reconnect
          withCredentials: true,
        });

        // Store reference immediately after creation (before connect)
        // This ensures socketRef.current is always the source of truth
        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on("connect", () => {
          setIsConnected(true);
          setSocket(socketRef.current);
          if (hasConnectedBeforeRef.current && wasDisconnectedRef.current) {
            setReconnectVersion((current) => current + 1);
            wasDisconnectedRef.current = false;
          } else {
            hasConnectedBeforeRef.current = true;
          }
          // Start heartbeat when connected (defensive: stops any existing first)
          startHeartbeat();
        });

        newSocket.on("disconnect", (reason: string) => {
          if (IS_DEV) {
            console.trace(`[Socket] disconnect trace - reason: ${reason}`);
          }
          setIsConnected(false);
          wasDisconnectedRef.current = true;
          // Stop heartbeat on disconnect
          stopHeartbeat();
          if (reason === "io server disconnect") {
            // Server kicked us, reconnect with fresh token
            socketRef.current?.connect();
          }
        });

        newSocket.on("connect_error", (error: Error) => {
          logger.error("Socket.IO connect_error:", error.message);
          setIsConnected(false);

          // If it's an auth error, the next reconnect attempt will get a fresh token
          // due to our auth callback. No special handling needed.
          if (
            error.message.includes("expired") ||
            error.message.includes("invalid")
          ) {
          }
        });

        newSocket.on("reconnect", () => {
          setIsConnected(true);
          // Re-establecer el socket para que los hooks se re-suscriban si es necesario
          setSocket(socketRef.current);
          // Restart heartbeat on reconnect (defensive: stops any existing first)
          startHeartbeat();
        });

        newSocket.on("reconnect_error", (error: Error) => {
          logger.error("Socket.IO reconnect_error:", error.message);
        });

        newSocket.on("reconnect_failed", () => {
          logger.error("Socket.IO reconnect_failed - will keep trying");
          setIsConnected(false);
        });
      } catch (error) {
        logger.error("Socket initialization error:", error);
      }
    };

    // En desarrollo, dar un pequeño delay para que el estado de sesión se estabilice
    // Esto ayuda con la race condition de Turbopack
    const initDelay = IS_DEV ? 100 : 0;
    const initTimeout = setTimeout(() => {
      void initSocket();
    }, initDelay);

    return () => {
      clearTimeout(initTimeout);
    };
  }, [isLoaded, isSignedIn, startHeartbeat, stopHeartbeat]);

  // Handler para cierre de página - emitir logout antes de cerrar
  // Uses socketRef.current as single source of truth
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("presence:page-close");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Unmount cleanup (solo desmontaje real del provider).
  useEffect(() => {
    return () => {
      disconnectAndResetSocket("provider-unmount");
    };
  }, [disconnectAndResetSocket]);

  const socketClientValue = useMemo(
    () => ({ socket, goOffline }),
    [socket, goOffline],
  );

  const prevCauseRef = useRef<{
    socketId: string | null;
    isConnected: boolean;
    socketClientValue: unknown;
  } | null>(null);

  useEffect(() => {
    const socketId = socket?.id ?? null;
    const prev = prevCauseRef.current;
    const changed: string[] = [];

    if (!prev || prev.socketId !== socketId) changed.push("socketId");
    if (!prev || prev.isConnected !== isConnected) changed.push("isConnected");
    if (!prev || prev.socketClientValue !== socketClientValue)
      changed.push("socketClientValueRef");

    if (changed.length > 0) {
    }

    prevCauseRef.current = {
      socketId,
      isConnected,
      socketClientValue,
    };
  }, [isConnected, socket?.id, socketClientValue]);

  return (
    <SocketClientContext.Provider value={socketClientValue}>
      <SocketConnectionContext.Provider value={isConnected}>
        <SocketRecoveryContext.Provider value={reconnectVersion}>
          {children}
        </SocketRecoveryContext.Provider>
      </SocketConnectionContext.Provider>
    </SocketClientContext.Provider>
  );
};
