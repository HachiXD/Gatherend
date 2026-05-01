import {
  AudioSession,
  LiveKitRoom,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/react-native";
import {
  DisconnectReason,
  RoomOptions,
} from "livekit-client";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useSocketClient } from "@/src/providers/socket-context";
import { livekitUrl } from "@/src/lib/env";
import { getLivekitToken } from "../api/get-livekit-token";
import { useVoiceStore } from "../store/use-voice-store";
import { VoiceControlBar } from "../components/voice-control-bar";

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const CONNECTION_TIMEOUT_MS = 30000;
const ALONE_TIMEOUT_MS = 3 * 60 * 1000;

const roomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: false,
  audioCaptureDefaults: {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
  },
};

interface JoinState {
  hasEmitted: boolean;
  chatId: string | null;
  profileId: string | null;
  boardId: string | null;
}

export function VoiceLiveKitProvider({ children }: { children: ReactNode }) {
  const {
    channelId,
    boardId,
    context,
    isConnecting,
    isConnected,
    isReconnecting,
    connectionAttemptId,
    confirmConnected,
    connectionFailed,
    leaveVoice,
    setReconnecting,
    setVoiceError,
  } = useVoiceStore();

  const profile = useProfile();
  const { socket } = useSocketClient();
  const [token, setToken] = useState("");
  const [tokenChannelId, setTokenChannelId] = useState<string | null>(null);

  const joinStateRef = useRef<JoinState>({
    hasEmitted: false,
    chatId: null,
    profileId: null,
    boardId: null,
  });
  const prevIsConnectedRef = useRef(false);
  const prevChannelIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenFetchAbortRef = useRef<AbortController | null>(null);

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

  // Clear stale token when not in voice
  useEffect(() => {
    if (!isConnecting && !isConnected && token !== "") {
      setToken("");
      setTokenChannelId(null);
    }
  }, [isConnecting, isConnected, token]);

  // Never keep a previous room token when switching voice targets.
  useEffect(() => {
    if (prevChannelIdRef.current && prevChannelIdRef.current !== channelId) {
      setToken("");
      setTokenChannelId(null);
    }
    prevChannelIdRef.current = channelId;
  }, [channelId]);

  // Connection timeout
  useEffect(() => {
    if (!isConnecting || isConnected || !channelId) return;

    if (!livekitUrl) {
      console.warn(
        "[VoiceLiveKitProvider] Missing EXPO_PUBLIC_LIVEKIT_URL. LiveKit connection will not start.",
      );
      setVoiceError("No se encontro la URL de LiveKit.");
      setToken("");
      setTokenChannelId(null);
      connectionFailed();
      return;
    }

    const attemptId = connectionAttemptId;

    connectionTimeoutRef.current = setTimeout(() => {
      const state = useVoiceStore.getState();
      if (!state.isConnecting || state.isConnected || !state.channelId) return;
      if (state.connectionAttemptId !== attemptId) return;

      tokenFetchAbortRef.current?.abort();
      tokenFetchAbortRef.current = null;
      setVoiceError("No se pudo conectar a la llamada.");
      setToken("");
      setTokenChannelId(null);
      connectionFailed();
    }, CONNECTION_TIMEOUT_MS);

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [
    isConnecting,
    isConnected,
    channelId,
    connectionAttemptId,
    connectionFailed,
    setVoiceError,
  ]);

  // Fetch token when connecting
  useEffect(() => {
    tokenFetchAbortRef.current?.abort();
    tokenFetchAbortRef.current = null;

    if ((!isConnecting && !isConnected) || !channelId || !profile?.id) return;

    const abortController = new AbortController();
    tokenFetchAbortRef.current = abortController;
    const fetchChannelId = channelId;

    getLivekitToken(fetchChannelId, abortController.signal)
      .then(async (nextToken) => {
        if (abortController.signal.aborted) return;
        if (useVoiceStore.getState().channelId !== fetchChannelId) return;
        await AudioSession.startAudioSession();
        setToken(nextToken);
        setTokenChannelId(fetchChannelId);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setVoiceError("No se pudo obtener acceso a la llamada.");
        setTokenChannelId(null);
        connectionFailed();
      });

    return () => {
      abortController.abort();
      tokenFetchAbortRef.current = null;
    };
  }, [
    profile?.id,
    channelId,
    isConnecting,
    isConnected,
    connectionFailed,
    setVoiceError,
  ]);

  // Socket voice-join / voice-leave
  useEffect(() => {
    if (!socket || !profile) return;
    const wasConnected = prevIsConnectedRef.current;

    if (isConnected && channelId && !joinStateRef.current.hasEmitted) {
      socket.emit("voice-join", {
        channelId,
        context,
        profileId: profile.id,
        username: profile.username,
        avatarUrl: profile.avatarAsset?.url ?? null,
        usernameColor: profile.usernameColor,
        boardId,
      });
      joinStateRef.current = {
        hasEmitted: true,
        chatId: channelId,
        profileId: profile.id,
        boardId: boardId ?? null,
      };
    } else if (
      !isConnected &&
      wasConnected &&
      joinStateRef.current.hasEmitted &&
      joinStateRef.current.chatId &&
      joinStateRef.current.profileId
    ) {
      socket.emit("voice-leave", {
        channelId: joinStateRef.current.chatId,
        profileId: joinStateRef.current.profileId,
        boardId: joinStateRef.current.boardId,
        context,
      });
      joinStateRef.current = {
        hasEmitted: false,
        chatId: null,
        profileId: null,
        boardId: null,
      };
    }

    prevIsConnectedRef.current = isConnected;
  }, [isConnected, socket, channelId, profile, boardId, context]);

  // Socket resync on reconnect
  useEffect(() => {
    if (!socket || !profile) return;

    const resync = () => {
      const state = useVoiceStore.getState();
      if (!state.isConnected || !state.channelId) return;
      socket.emit("voice-join", {
        channelId: state.channelId,
        context: state.context,
        profileId: profile.id,
        username: profile.username,
        avatarUrl: profile.avatarAsset?.url ?? null,
        usernameColor: profile.usernameColor,
        boardId: state.boardId,
      });
      socket.emit("voice-get-participants", {
        channelId: state.channelId,
        context: state.context,
      });
      if (state.boardId) {
        socket.emit("voice-get-board-participants", {
          boardId: state.boardId,
        });
      }
    };

    if (socket.connected) {
      resync();
    }
    socket.on("connect", resync);
    return () => { socket.off("connect", resync); };
  }, [socket, profile]);

  // Server-side voice rejection and validation errors
  useEffect(() => {
    if (!socket) return;

    const handleVoiceError = (data: {
      code?: string;
      message?: string;
      channelId?: string | null;
    }) => {
      const state = useVoiceStore.getState();
      if (!state.isConnecting && !state.isConnected && !state.isReconnecting) {
        return;
      }
      if (data.channelId && state.channelId && data.channelId !== state.channelId) {
        return;
      }

      const message =
        data.code === "CHANNEL_FULL"
          ? "Este canal de voz esta lleno."
          : data.code === "NOT_A_MEMBER"
            ? "No tienes acceso a esta llamada."
            : data.code === "UNAUTHORIZED"
              ? "Tu sesion no permite entrar a esta llamada."
              : data.message ?? "No se pudo entrar a la llamada.";

      setVoiceError(message);
      tokenFetchAbortRef.current?.abort();
      tokenFetchAbortRef.current = null;
      setToken("");
      setTokenChannelId(null);
      connectionFailed();
    };

    socket.on("voice-error", handleVoiceError);
    return () => {
      socket.off("voice-error", handleVoiceError);
    };
  }, [socket, connectionFailed, setVoiceError]);

  // Disconnect from board voice when the current profile is banned.
  useEffect(() => {
    if (!socket || !profile || !isConnected) return;

    const handleMemberLeft = (data: {
      boardId: string;
      profileId: string;
      reason?: string;
    }) => {
      if (data.profileId !== profile.id || data.reason !== "banned") return;

      const state = useVoiceStore.getState();
      if (state.context !== "board" || state.boardId !== data.boardId) return;

      leaveVoice();
      setVoiceError("Fuiste expulsado de este board.");
    };

    socket.on("board:member-left", handleMemberLeft);
    return () => {
      socket.off("board:member-left", handleMemberLeft);
    };
  }, [socket, profile, isConnected, leaveVoice, setVoiceError]);

  const handleConnected = useCallback(() => {
    clearAllTimeouts();
    reconnectAttemptRef.current = 0;
    setReconnecting(false);
    confirmConnected();
  }, [confirmConnected, clearAllTimeouts, setReconnecting]);

  const handleDisconnected = useCallback(
    async (reason?: DisconnectReason) => {
      clearAllTimeouts();
      await AudioSession.stopAudioSession();

      const currentVoiceState = useVoiceStore.getState();
      if (!currentVoiceState.channelId) {
        setReconnecting(false);
        reconnectAttemptRef.current = 0;
        setToken("");
        setTokenChannelId(null);
        return;
      }

      const shouldReconnect =
        reason !== DisconnectReason.CLIENT_INITIATED &&
        reason !== DisconnectReason.DUPLICATE_IDENTITY &&
        reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS &&
        currentVoiceState.channelId &&
        profile;

      if (shouldReconnect) {
        reconnectAttemptRef.current += 1;
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptRef.current - 1),
          MAX_RECONNECT_DELAY_MS,
        );
        setReconnecting(true);
        setToken("");
        setTokenChannelId(null);
        reconnectTimeoutRef.current = setTimeout(() => {
          // Token refetch triggered by isConnected still true
        }, delay);
        return;
      }

      setReconnecting(false);
      reconnectAttemptRef.current = 0;

      const state = joinStateRef.current;
      if (socket && state.hasEmitted && state.chatId && state.profileId) {
        socket.emit("voice-leave", {
          channelId: state.chatId,
          profileId: state.profileId,
          boardId: state.boardId,
          context,
        });
      }
      joinStateRef.current = {
        hasEmitted: false,
        chatId: null,
        profileId: null,
        boardId: null,
      };
      setToken("");
      setTokenChannelId(null);
      leaveVoice();
    },
    [
      socket,
      leaveVoice,
      profile,
      context,
      clearAllTimeouts,
      setReconnecting,
    ],
  );

  const handleError = useCallback(
    async (error: Error) => {
      console.warn("[VoiceLiveKitProvider] LiveKit connection error:", error);
      clearAllTimeouts();
      await AudioSession.stopAudioSession();
      setVoiceError("LiveKit no pudo establecer la conexion.");
      setToken("");
      setTokenChannelId(null);
      connectionFailed();
    },
    [clearAllTimeouts, connectionFailed, setVoiceError],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
      tokenFetchAbortRef.current?.abort();
      const state = joinStateRef.current;
      if (socket && state.hasEmitted && state.chatId && state.profileId) {
        socket.emit("voice-leave", {
          channelId: state.chatId,
          profileId: state.profileId,
          boardId: state.boardId,
          context,
        });
      }
    };
  }, [socket, clearAllTimeouts, context]);

  const shouldConnect =
    (isConnecting || isConnected) &&
    !!channelId &&
    !!token &&
    tokenChannelId === channelId &&
    !!livekitUrl;

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token || undefined}
      connect={shouldConnect}
      audio={true}
      video={false}
      options={roomOptions}
      onConnected={handleConnected}
      onDisconnected={() => { void handleDisconnected(); }}
      onError={(error) => { void handleError(error); }}
    >
      {children}
      <VoiceControlBar />
      <VoiceAloneAutoDisconnect
        enabled={shouldConnect && isConnected && !isReconnecting}
        channelId={channelId}
        leaveVoice={leaveVoice}
      />
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
  const room = useRoomContext();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const participantCount = (() => {
    const identities = new Set<string>();
    for (const participant of participants) {
      identities.add(participant.identity);
    }

    const localIdentity = localParticipant.localParticipant?.identity;
    if (localIdentity) {
      identities.add(localIdentity);
    }

    return identities.size;
  })();

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
      return clearTimer;
    }

    clearTimer();
    return clearTimer;
  }, [room, enabled, channelId, participantCount, leaveVoice, clearTimer]);

  return null;
}
