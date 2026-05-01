import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Linking from "expo-linking";
import { AppState, type AppStateStatus } from "react-native";
import { io as createSocket, type Socket } from "socket.io-client";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { authClient } from "@/src/lib/auth-client";
import { expressBaseUrl, mobileScheme } from "@/src/lib/env";
import {
  SocketClientContext,
  SocketConnectionContext,
  SocketRecoveryContext,
} from "@/src/providers/socket-context";

type SocketProviderProps = {
  children: ReactNode;
};

const HEARTBEAT_INTERVAL_MS = 50 * 1000;

function resolveSocketTarget(url: string) {
  try {
    const parsed = new URL(url);
    const prefix = parsed.pathname.replace(/\/+$/, "");
    return {
      origin: parsed.origin,
      path: prefix && prefix !== "/" ? `${prefix}/api/socket/io` : "/api/socket/io",
    };
  } catch {
    return {
      origin: url.replace(/\/+$/, ""),
      path: url.includes("/api/r2") ? "/api/r2/api/socket/io" : "/api/socket/io",
    };
  }
}

function getExpoOrigin() {
  if (__DEV__) {
    return Linking.createURL("/").replace(/\/--\/?$/, "").replace(/\/+$/, "");
  }

  return `${mobileScheme}://`;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const profile = useProfile();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [recoveryVersion, setRecoveryVersion] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasConnectedBeforeRef = useRef(false);
  const wasDisconnectedRef = useRef(false);

  const stopHeartbeat = useCallback(() => {
    if (!heartbeatIntervalRef.current) return;
    clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = null;
  }, []);

  const sendHeartbeat = useCallback(() => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("presence:heartbeat");
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(
      sendHeartbeat,
      HEARTBEAT_INTERVAL_MS,
    );
  }, [sendHeartbeat, stopHeartbeat]);

  const goOffline = useCallback(() => {
    socketRef.current?.emit("presence:logout");
  }, []);

  useEffect(() => {
    const cookie = authClient.getCookie();
    const expoOrigin = getExpoOrigin();
    const socketTarget = resolveSocketTarget(expressBaseUrl);
    const nextSocket = createSocket(socketTarget.origin, {
      path: socketTarget.path,
      addTrailingSlash: false,
      auth: (callback) => {
        callback({ profileId: profile.id });
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      withCredentials: true,
      extraHeaders: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(expoOrigin ? { "expo-origin": expoOrigin } : {}),
        "x-skip-oauth-proxy": "true",
      },
    });

    socketRef.current = nextSocket;
    setSocket(nextSocket);

    const handleConnect = () => {
      setIsConnected(true);
      setSocket(socketRef.current);
      if (hasConnectedBeforeRef.current && wasDisconnectedRef.current) {
        setRecoveryVersion((current) => current + 1);
        wasDisconnectedRef.current = false;
      } else {
        hasConnectedBeforeRef.current = true;
      }
      startHeartbeat();
    };

    const handleDisconnect = (reason: string) => {
      setIsConnected(false);
      wasDisconnectedRef.current = true;
      stopHeartbeat();
      if (reason === "io server disconnect") {
        socketRef.current?.connect();
      }
    };

    const handleConnectError = (error: Error) => {
      if (__DEV__) {
        console.warn("[Socket] connect_error:", error.message);
      }
      setIsConnected(false);
    };

    const handleReconnectError = (error: Error) => {
      if (__DEV__) {
        console.warn("[Socket] reconnect_error:", error.message);
      }
    };

    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === "active") {
        if (!nextSocket.connected) {
          nextSocket.connect();
        } else {
          startHeartbeat();
        }
        return;
      }

      stopHeartbeat();
    };

    nextSocket.on("connect", handleConnect);
    nextSocket.on("disconnect", handleDisconnect);
    nextSocket.on("connect_error", handleConnectError);
    nextSocket.io.on("reconnect_error", handleReconnectError);
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    nextSocket.connect();

    return () => {
      appStateSubscription.remove();
      nextSocket.off("connect", handleConnect);
      nextSocket.off("disconnect", handleDisconnect);
      nextSocket.off("connect_error", handleConnectError);
      nextSocket.io.off("reconnect_error", handleReconnectError);
      stopHeartbeat();
      nextSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [profile.id, startHeartbeat, stopHeartbeat]);

  const clientValue = useMemo(
    () => ({
      socket,
      goOffline,
    }),
    [goOffline, socket],
  );

  return (
    <SocketClientContext.Provider value={clientValue}>
      <SocketConnectionContext.Provider value={isConnected}>
        <SocketRecoveryContext.Provider value={recoveryVersion}>
          {children}
        </SocketRecoveryContext.Provider>
      </SocketConnectionContext.Provider>
    </SocketClientContext.Provider>
  );
}
