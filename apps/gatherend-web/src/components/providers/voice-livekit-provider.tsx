"use client";

import {
  ReactNode,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useMaybeRoomContext,
  useParticipants,
  useLocalParticipant,
} from "@livekit/components-react";
import { RoomOptions, VideoPresets, DisconnectReason } from "livekit-client";
import { useVoiceStore } from "@/hooks/use-voice-store";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useSocketClient } from "@/components/providers/socket-provider";
import { logger } from "@/lib/logger";
import { configureLiveKitLogging } from "@/lib/livekit-logging";
import { toast } from "sonner";
import "@livekit/components-styles";

// Connection timeout (30 seconds, from user click)
const CONNECTION_TIMEOUT_MS = 30000;

// Auto-disconnect when alone (3 minutes)
const ALONE_TIMEOUT_MS = 3 * 60 * 1000;

// Auto-reconnect configuration
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const MAX_RECONNECT_DELAY_MS = 30000; // 30 seconds

// Retry configuration for API fetches (Turbopack race condition in dev)
const IS_DEV = process.env.NODE_ENV === "development";
const MAX_TOKEN_FETCH_RETRIES = IS_DEV ? 5 : 2;
const INITIAL_TOKEN_RETRY_DELAY_MS = IS_DEV ? 500 : 1000;

configureLiveKitLogging();

// BroadcastChannel for multi-tab coordination
const VOICE_CHANNEL_NAME = "gatherend-voice-channel";

// Generate unique tab ID
const generateTabId = () =>
  `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper function to fetch with retry logic
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = MAX_TOKEN_FETCH_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If we get a 404 in dev, it might be Turbopack not ready yet
      if (response.status === 404 && IS_DEV && attempt < maxRetries) {
        const delay = INITIAL_TOKEN_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = INITIAL_TOKEN_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw (
    lastError ||
    new Error(`Failed to fetch ${url} after ${maxRetries} attempts`)
  );
}

interface VoiceLiveKitProviderProps {
  children: ReactNode;
}

/**
 * VoiceLiveKitProvider - Provee el contexto de LiveKit a toda la aplicación
 *
 * Esto permite que cualquier componente hijo (como VoiceControlBar)
 * pueda usar hooks de LiveKit como TrackToggle, useLocalParticipant, etc.
 *
 * La conexión solo se establece cuando isConnected es true.
 */
export function VoiceLiveKitProvider({ children }: VoiceLiveKitProviderProps) {
  const {
    channelId,
    boardId,
    context,
    isConnecting,
    isConnected,
    isReconnecting,
    connectionAttemptId,
    isDeafened,
    confirmConnected,
    connectionFailed,
    leaveVoice,
    setReconnecting,
  } = useVoiceStore();

  // DEBUG: Log state on every render

  // Use profile from ProfileProvider context (no fetch needed!)
  const profile = useProfile();
  const { socket } = useSocketClient();
  const [token, setToken] = useState("");

  // Ensure we never keep a stale token around when not in voice
  // (prevents accidental connect with old token on fast re-join)
  useEffect(() => {
    if (!isConnecting && !isConnected && token !== "") {
      setToken("");
    }
  }, [isConnecting, isConnected, token]);

  // Unique tab identifier (stable across re-renders)
  const tabIdRef = useRef<string>(generateTabId());

  // BroadcastChannel for multi-tab coordination
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Ref para trackear estado de join y token
  const joinStateRef = useRef<{
    hasEmitted: boolean;
    chatId: string | null;
    profileId: string | null;
    boardId: string | null;
  }>({ hasEmitted: false, chatId: null, profileId: null, boardId: null });

  // Guard to avoid spamming resync on repeated connect events
  const lastVoiceResyncKeyRef = useRef<string | null>(null);

  const prevChannelIdRef = useRef<string | null>(null);
  const prevIsConnectedRef = useRef<boolean>(false);

  // Timeout and reconnect refs
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDisconnectReasonRef = useRef<DisconnectReason | null>(null);

  // AbortController for cancelling token fetch on rapid channel switch
  const tokenFetchAbortRef = useRef<AbortController | null>(null);

  // Clear all timeouts helper
  const clearAllTimeouts = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Connection timeout starting from user click (isConnecting)
  useEffect(() => {
    if (!isConnecting || isConnected || !channelId) return;

    const attemptIdAtStart = connectionAttemptId;

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    connectionTimeoutRef.current = setTimeout(() => {
      const state = useVoiceStore.getState();

      // Ignore if state changed since the timeout was scheduled
      if (!state.isConnecting || state.isConnected || !state.channelId) return;
      if (state.connectionAttemptId !== attemptIdAtStart) return;

      logger.error(
        "[VoiceLiveKitProvider] Connection timeout - took too long to connect",
      );

      toast.error("Failed to join voice channel", {
        description: "Connection timed out",
        duration: 5000,
      });

      // Abort any in-flight token fetch and reset local token state
      if (tokenFetchAbortRef.current) {
        tokenFetchAbortRef.current.abort();
        tokenFetchAbortRef.current = null;
      }
      setToken("");

      connectionFailed();
    }, CONNECTION_TIMEOUT_MS);

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [isConnecting, isConnected, channelId, connectionAttemptId, connectionFailed]);

  // BroadcastChannel for multi-tab coordination
  // When this tab joins a call, notify other tabs to disconnect
  useEffect(() => {
    // Only setup in browser environment
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return;
    }

    // Create or get broadcast channel
    if (!broadcastChannelRef.current) {
      broadcastChannelRef.current = new BroadcastChannel(VOICE_CHANNEL_NAME);
    }

    const channel = broadcastChannelRef.current;

    // Listen for messages from other tabs
    const handleMessage = (event: MessageEvent) => {
      const { type, tabId } = event.data;

      // Ignore messages from this tab
      if (tabId === tabIdRef.current) return;

      if (type === "VOICE_JOIN") {
        // Another tab joined a call - disconnect this tab if we're connected
        if (isConnected) {
          leaveVoice();
        }
      }
    };

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
    };
  }, [isConnected, leaveVoice]);

  // Notify other tabs when this tab joins a call
  useEffect(() => {
    if (
      isConnected &&
      channelId &&
      broadcastChannelRef.current &&
      typeof window !== "undefined"
    ) {
      broadcastChannelRef.current.postMessage({
        type: "VOICE_JOIN",
        tabId: tabIdRef.current,
        channelId,
      });
    }
  }, [isConnected, channelId]);

  // Cleanup BroadcastChannel on unmount
  useEffect(() => {
    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }
    };
  }, []);

  // Reset join state ONLY when switching to a NEW channel (not when disconnecting)
  useEffect(() => {
    // Only reset if we're changing FROM one channel TO another channel (not to null)
    if (
      prevChannelIdRef.current !== channelId &&
      channelId !== null &&
      prevChannelIdRef.current !== null
    ) {
      joinStateRef.current = {
        hasEmitted: false,
        chatId: null,
        profileId: null,
        boardId: null,
      };
      setTimeout(() => setToken(""), 0);
    }
    prevChannelIdRef.current = channelId;
  }, [channelId]);

  // Fetch LiveKit token when starting to connect
  useEffect(() => {
    // Cancel any pending token fetch when channel changes
    if (tokenFetchAbortRef.current) {
      tokenFetchAbortRef.current.abort();
      tokenFetchAbortRef.current = null;
    }

    const fetchToken = async () => {
      // Fetch token when isConnecting (user initiated) OR already isConnected
      if (!profile?.id || !channelId || (!isConnecting && !isConnected)) return;

      // Create new abort controller for this fetch
      const abortController = new AbortController();
      tokenFetchAbortRef.current = abortController;

      // Capture channelId at fetch start to check later
      const fetchChannelId = channelId;

      try {
        const tokenUrl = `/api/livekit?room=${channelId}`;

        const resp = await fetchWithRetry(tokenUrl, {
          signal: abortController.signal,
        });

        // Check if request was aborted or channel changed
        if (abortController.signal.aborted) {
          return;
        }

        // Double-check channel hasn't changed during fetch
        const currentChannelId = useVoiceStore.getState().channelId;
        if (currentChannelId !== fetchChannelId) {
          return;
        }

        if (!resp.ok) {
          logger.error(
            `[VoiceLiveKitProvider] Token API returned ${resp.status}`,
          );
          connectionFailed();
          return;
        }

        const data = await resp.json();

        // Fix #1: Double-check BEFORE setToken to prevent race condition
        const currentChannelIdBeforeSet = useVoiceStore.getState().channelId;
        if (
          abortController.signal.aborted ||
          currentChannelIdBeforeSet !== fetchChannelId
        ) {
          return;
        }

        if (data.token) {
          setToken(data.token);

        } else {
          logger.error("[VoiceLiveKitProvider] No token received:", data);
          connectionFailed();
        }
      } catch (e) {
        // Ignore abort errors
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        logger.error("[VoiceLiveKitProvider] Error fetching token:", e);
        connectionFailed();
      }
    };

    if ((isConnecting || isConnected) && channelId) {
      fetchToken();
    }

    // Cleanup: abort fetch on unmount or channel change
    return () => {
      if (tokenFetchAbortRef.current) {
        tokenFetchAbortRef.current.abort();
        tokenFetchAbortRef.current = null;
      }
    };
  }, [
    profile,
    channelId,
    isConnecting,
    isConnected,
    connectionFailed,
    clearAllTimeouts,
  ]);

  // Socket events for voice join/leave
  useEffect(() => {
    if (!socket || !profile) return;

    const currentState = joinStateRef.current;
    const wasConnected = prevIsConnectedRef.current;

    // JOIN: when isConnected becomes true and we have a channelId
    if (isConnected && channelId && !currentState.hasEmitted) {

      socket.emit("voice-join", {
        channelId,
        context,
        profileId: profile.id,
        username: profile.username,
        avatarUrl: profile.avatarAsset?.url || null,
        usernameColor: profile.usernameColor,
        boardId, // Include boardId for backend optimization
      });

      joinStateRef.current = {
        hasEmitted: true,
        chatId: channelId,
        profileId: profile.id,
        boardId: boardId ?? null,
      };
    }
    // LEAVE: when isConnected transitions from true to false
    else if (
      !isConnected &&
      wasConnected &&
      currentState.hasEmitted &&
      currentState.chatId &&
      currentState.profileId
    ) {

      socket.emit("voice-leave", {
        channelId: currentState.chatId,
        profileId: currentState.profileId,
        boardId: currentState.boardId, // Include boardId for backend optimization
        context,
      });

      joinStateRef.current = {
        hasEmitted: false,
        chatId: null,
        profileId: null,
        boardId: null,
      };
    }

    // Update previous state ref
    prevIsConnectedRef.current = isConnected;
  }, [isConnected, socket, channelId, profile, boardId, context]);

  // Debug helper: if Socket.IO drops while LiveKit remains connected, voice media will keep working
  // but server-side presence (participants list, board indicators) may be temporarily stale until reconnect.
  useEffect(() => {
    if (!socket) return;

    const handleDisconnect = (reason: string) => {
      const state = useVoiceStore.getState();
      if (state.isConnected && state.channelId) {
      }
    };

    socket.on("disconnect", handleDisconnect);
    return () => {
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);

  // Resync voice server-side after socket reconnects while LiveKit remains connected.
  // This prevents cases where LiveKit is still in-call but Socket.IO dropped and reconnected,
  // leaving the server unaware of our voice presence / room subscriptions.
  useEffect(() => {
    if (!socket || !profile) return;

    const resyncIfNeeded = () => {
      const state = useVoiceStore.getState();
      if (!state.isConnected || !state.channelId) return;

      const socketId = socket.id ?? "no-socket-id";
      const resyncKey = `${socketId}:${state.context ?? "no-context"}:${state.channelId}`;
      if (lastVoiceResyncKeyRef.current === resyncKey) return;
      lastVoiceResyncKeyRef.current = resyncKey;


      socket.emit("voice-join", {
        channelId: state.channelId,
        context: state.context,
        profileId: profile.id,
        username: profile.username,
        avatarUrl: profile.avatarAsset?.url || null,
        usernameColor: profile.usernameColor,
        boardId: state.boardId, // Include boardId for backend optimization
      });

      // Refresh participants list for the active voice channel (both board + conversation)
      socket.emit("voice-get-participants", {
        channelId: state.channelId,
        boardId: state.boardId,
        context: state.context,
      });

      joinStateRef.current = {
        hasEmitted: true,
        chatId: state.channelId,
        profileId: profile.id,
        boardId: state.boardId ?? null,
      };
    };

    if (socket.connected) {
      resyncIfNeeded();
    }

    socket.on("connect", resyncIfNeeded);
    return () => {
      socket.off("connect", resyncIfNeeded);
    };
  }, [socket, profile]);

  // Fix #8: Listen for voice-error events from server (e.g., channel full)
  useEffect(() => {
    if (!socket) return;

    const handleVoiceError = (data: {
      code: string;
      message: string;
      channelId: string;
    }) => {
      logger.error(
        `[VoiceLiveKitProvider] Voice error: ${data.code} - ${data.message}`,
      );

      // Show user-friendly toast based on error code
      if (data.code === "CHANNEL_FULL") {
        toast.error("Voice channel is full", {
          description:
            "This channel has reached the maximum of 50 participants",
          duration: 5000,
        });
      } else {
        toast.error("Failed to join voice channel", {
          description: data.message,
          duration: 5000,
        });
      }

      // Reset connection state since we couldn't join
      connectionFailed();
    };

    socket.on("voice-error", handleVoiceError);

    return () => {
      socket.off("voice-error", handleVoiceError);
    };
  }, [socket, connectionFailed]);

  // Disconnect from voice when banned from board
  useEffect(() => {
    if (!socket || !profile || !isConnected) return;

    const handleMemberLeft = (data: {
      boardId: string;
      profileId: string;
      reason?: string;
    }) => {
      // Only act if WE are the one being banned
      if (data.profileId !== profile.id || data.reason !== "banned") return;

      toast.error("You have been banned from this board", {
        description: "Disconnecting from voice channel...",
        duration: 5000,
      });

      leaveVoice();
    };

    socket.on("board:member-left", handleMemberLeft);

    return () => {
      socket.off("board:member-left", handleMemberLeft);
    };
  }, [socket, profile, isConnected, leaveVoice]);

  // Cleanup on unmount
  useEffect(() => {
    const currentSocket = socket;
    return () => {
      // Clear all timeouts on unmount (including reconnect timeouts - Fix #3)
      clearAllTimeouts();

      // Also abort any pending token fetch
      if (tokenFetchAbortRef.current) {
        tokenFetchAbortRef.current.abort();
        tokenFetchAbortRef.current = null;
      }

      const state = joinStateRef.current;
      if (
        currentSocket &&
        state.hasEmitted &&
        state.chatId &&
        state.profileId
      ) {
        // Solo emitir al servidor - el servidor actualizará el store
        currentSocket.emit("voice-leave", {
          channelId: state.chatId,
          profileId: state.profileId,
        });
      }
    };
  }, [socket, clearAllTimeouts]);

  // Handle successful connection to LiveKit
  const handleConnected = useCallback(() => {
    // Clear connection timeout
    clearAllTimeouts();
    // Reset reconnect attempts on successful connection
    reconnectAttemptRef.current = 0;
    setReconnecting(false);
    confirmConnected();
  }, [confirmConnected, clearAllTimeouts, setReconnecting]);

  // Handle disconnect from LiveKit with auto-reconnect
  const handleDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      lastDisconnectReasonRef.current = reason ?? null;

      // Clear any pending timeouts
      clearAllTimeouts();

      // Fix #5: Notify user when disconnected due to duplicate identity (another tab/device)
      if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
        toast.info(
          "Disconnected: You joined the call from another tab or device",
          {
            duration: 5000,
          },
        );
      }

      // Check if we should attempt auto-reconnect
      // Only reconnect on unexpected disconnections (network issues, server restart)
      const shouldReconnect =
        reason !== DisconnectReason.CLIENT_INITIATED &&
        reason !== DisconnectReason.DUPLICATE_IDENTITY &&
        reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS &&
        channelId &&
        profile;

      if (shouldReconnect) {
        reconnectAttemptRef.current += 1;
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY_MS *
            Math.pow(2, reconnectAttemptRef.current - 1),
          MAX_RECONNECT_DELAY_MS,
        );


        // Set reconnecting state for UI feedback
        setReconnecting(true);

        // Clear token to trigger refetch
        setToken("");

        reconnectTimeoutRef.current = setTimeout(() => {
          // Token will be refetched automatically by the useEffect
          // because isConnected is still true (we don't call leaveVoice)
        }, delay);

        return; // Don't emit voice-leave, we're trying to reconnect
      }

      // Not reconnecting - clean up fully
      setReconnecting(false);

      if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        logger.error(
          "[VoiceLiveKitProvider] Max reconnect attempts reached, giving up",
        );
      }

      reconnectAttemptRef.current = 0;
      const state = joinStateRef.current;
      if (socket && state.hasEmitted && state.chatId && state.profileId) {
        socket.emit("voice-leave", {
          channelId: state.chatId,
          profileId: state.profileId,
          boardId: state.boardId, // Include boardId for backend optimization
        });
      }
      joinStateRef.current = {
        hasEmitted: false,
        chatId: null,
        profileId: null,
        boardId: null,
      };
      setToken("");
      leaveVoice();
    },
    [socket, leaveVoice, channelId, profile, clearAllTimeouts, setReconnecting],
  );

  // Room options - memoized to prevent recreation
  // Optimized for cost reduction: reduced simulcast layers, dtx/red for audio
  const roomOptions: RoomOptions = useMemo(
    () => ({
      adaptiveStream: true,
      dynacast: true,

      // === CONNECTION SPEED OPTIMIZATIONS ===
      // Disable automatic track management for faster reconnects
      stopLocalTrackOnUnpublish: false,
      // Aggressive WebRTC configuration for faster ICE
      rtcConfig: {
        // Only use STUN (no TURN needed for direct connection)
        // This reduces ICE candidate gathering time
        iceTransportPolicy: "all" as RTCIceTransportPolicy,
        // Bundle policy - use single connection for all media
        bundlePolicy: "max-bundle" as RTCBundlePolicy,
        // RTCP mux - reduces connection setup time
        rtcpMuxPolicy: "require" as RTCRtcpMuxPolicy,
        // Faster ICE candidate pair selection
        iceCandidatePoolSize: 2,
      },

      // Video capture limited to 720p
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      // Screen share limited to 720p with text optimization
      screenShareCaptureDefaults: {
        resolution: { width: 1280, height: 720 },
        contentHint: "text", // Optimizes for text/code content (lower bitrate)
      },
      // Audio optimizations
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      // Publish defaults for bandwidth optimization
      publishDefaults: {
        // 3 simulcast layers for better quality adaptation
        videoSimulcastLayers: [
          VideoPresets.h360,
          VideoPresets.h540,
          VideoPresets.h720,
        ],
        screenShareSimulcastLayers: [
          VideoPresets.h360,
          VideoPresets.h540,
          VideoPresets.h720,
        ],
        dtx: true, // Discontinuous transmission - silence = no data sent
        red: true, // Redundant encoding - better quality with packet loss
        videoCodec: "vp8", // VP8 is more CPU efficient, good compression
      },
    }),
    [],
  );

  // Determinar si debemos conectar (no si debemos renderizar)
  // LiveKitRoom siempre se renderiza para evitar remount de children
  const shouldConnect = (isConnecting || isConnected) && !!channelId && !!token;

  // DEBUG: Log shouldConnect calculation

  // SIEMPRE renderizar LiveKitRoom para evitar remount de children
  // La prop `connect` controla si realmente se conecta a LiveKit
  return (
    <LiveKitRoom
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      token={token || undefined}
      connect={shouldConnect}
      video={false}
      audio={true}
      options={roomOptions}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      // Estilo para que no afecte el layout
      style={{ display: "contents" }}
    >
      <VoiceAloneAutoDisconnect
        enabled={isConnected && shouldConnect && !isReconnecting}
        channelId={channelId}
        leaveVoice={leaveVoice}
      />
      {children}
      {/* Audio renderer solo cuando hay conexión activa */}
      {/* muted prop controls whether incoming audio is played (deafen) */}
      {shouldConnect && <RoomAudioRenderer muted={isDeafened} />}
    </LiveKitRoom>
  );
}

function VoiceAloneAutoDisconnect({
  enabled,
  channelId,
  leaveVoice,
}: {
  enabled: boolean;
  channelId: string | null;
  leaveVoice: () => void;
}) {
  const room = useMaybeRoomContext();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const participantCount = useMemo(() => {
    const identities = new Set<string>();
    for (const p of participants) identities.add(p.identity);
    const localId = localParticipant.localParticipant?.identity;
    if (localId) identities.add(localId);
    return identities.size;
  }, [participants, localParticipant.localParticipant?.identity]);

  useEffect(() => {
    if (!room || !enabled || !channelId) {
      clearTimer();
      return;
    }

    if (participantCount <= 1) {
      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          leaveVoice();
          timerRef.current = null;
        }, ALONE_TIMEOUT_MS);
      }
    } else {
      if (timerRef.current) {
        clearTimer();
      }
    }

    return clearTimer;
  }, [room, enabled, channelId, participantCount, leaveVoice, clearTimer]);

  return null;
}
