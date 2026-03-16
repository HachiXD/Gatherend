"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  TrackToggle,
  DisconnectButton,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { X, PhoneOff, Volume2 } from "lucide-react";
import { Track, RoomOptions, VideoPresets, Participant } from "livekit-client";
import { cn } from "@/lib/utils";
import { useVoiceStore } from "@/hooks/use-voice-store";
import { useSocketClient } from "@/components/providers/socket-provider";
import { getDisplayColor } from "@/lib/username-color";
import {
  useVoiceParticipantsStore,
  VoiceParticipant,
} from "@/hooks/use-voice-participants-store";
import { UserAvatar } from "@/components/user-avatar";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "@/i18n";
import { configureLiveKitLogging } from "@/lib/livekit-logging";

configureLiveKitLogging();

interface MediaRoomProps {
  chatId: string;
  video: boolean;
  audio: boolean;
  onLeave?: () => void;
}

function MediaRoomControls({ onLeave }: { onLeave?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="absolute top-2 right-2 z-50 flex gap-2">
      <button
        onClick={onLeave}
        className="p-2 rounded-md bg-red-500/80 hover:bg-red-600 text-white transition"
        title={t.voice.leaveCall}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Función para convertir hex a rgba
function hexToRgba(hex: string | null | undefined, alpha: number): string {
  // Validar que hex sea un string válido
  if (!hex || typeof hex !== "string") {
    return `rgba(47, 71, 69, ${alpha})`; // Fallback color
  }
  // Remover el # si existe
  const cleanHex = hex.replace("#", "");
  // Validar formato hex
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return `rgba(47, 71, 69, ${alpha})`; // Fallback color
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Componente para un participante individual en la llamada
interface ParticipantCardProps {
  participant: VoiceParticipant;
  livekitParticipant: Participant;
  isSpeaking?: boolean;
  isLocal?: boolean;
}

function ParticipantCard({
  participant,
  livekitParticipant,
  isSpeaking = false,
  isLocal = false,
}: ParticipantCardProps) {
  // Color de fondo basado en usernameColor o un color por defecto
  // getDisplayColor handles both legacy string format and new JSON format
  const userColor = getDisplayColor(participant.usernameColor);

  // Convertir a rgba con opacidad para el fondo
  const backgroundColor = hexToRgba(userColor, 0.3);
  const borderColor = hexToRgba(userColor, 0.6);

  // Color para el borde cuando está hablando
  const speakingBorderColor = userColor;

  // Obtener el track de cámara del participante
  const cameraTrack = livekitParticipant.getTrackPublication(
    Track.Source.Camera,
  );
  const isCameraEnabled =
    cameraTrack?.isSubscribed && !cameraTrack?.isMuted && cameraTrack?.track;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl transition-all duration-200 overflow-hidden p-4",
        isCameraEnabled && "min-w-[200px] min-h-[150px]",
      )}
      style={{
        backgroundColor,
        border: isSpeaking
          ? `2px solid ${speakingBorderColor}`
          : `1px solid ${borderColor}`,
        boxShadow: isSpeaking
          ? `0 0 15px ${hexToRgba(speakingBorderColor, 0.5)}`
          : undefined,
      }}
    >
      {/* Video del participante si tiene cámara activa */}
      {isCameraEnabled && cameraTrack?.track ? (
        <div className="relative w-full h-full min-h-[120px]">
          <VideoTrack
            trackRef={{
              participant: livekitParticipant,
              source: Track.Source.Camera,
              publication: cameraTrack,
            }}
            className="w-full h-full object-cover rounded-lg"
          />
          {/* Nombre superpuesto en video */}
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-xs">
            <span
              style={{
                color: userColor,
              }}
            >
              {participant.username}
              {isLocal && " (You)"}
            </span>
          </div>
          {/* Indicador de hablando en video */}
          {isSpeaking && (
            <div
              className="absolute top-2 right-2 rounded-full p-1 animate-pulse"
              style={{ backgroundColor: speakingBorderColor }}
            >
              <Volume2 className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Avatar con indicador de habla (cuando no hay video) */}
          <div className="relative mb-3">
            <div
              className={cn(
                "rounded-full overflow-hidden transition-all duration-200 w-16 h-16",
                isSpeaking && "ring-4",
              )}
              style={{
                ...(isSpeaking && {
                  boxShadow: `0 0 20px ${speakingBorderColor}60`,
                }),
              }}
            >
              <UserAvatar
                src={participant.avatarUrl || undefined}
                profileId={participant.profileId}
                className="w-16 h-16"
                showStatus={false}
              />
            </div>

            {/* Indicador de hablando */}
            {isSpeaking && (
              <div
                className="absolute -bottom-1 -right-1 rounded-full p-1 animate-pulse"
                style={{ backgroundColor: speakingBorderColor }}
              >
                <Volume2 className="text-white w-3 h-3" />
              </div>
            )}
          </div>

          {/* Nombre del usuario */}
          <span
            className="text-sm font-medium truncate max-w-[100px] text-center"
            style={{
              color: userColor,
            }}
          >
            {participant.username}
            {isLocal && (
              <span className="text-xs text-theme-text-muted ml-1">(You)</span>
            )}
          </span>
        </>
      )}
    </div>
  );
}

// Componente personalizado para el video layout con UI personalizada
function CustomVoiceUI({ chatId }: { chatId: string }) {
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const { socket } = useSocketClient();

  // Obtener participantes del store (contiene usernameColor)
  const voiceParticipants = useVoiceParticipantsStore(
    useShallow((state) => state.participants[chatId] ?? []),
  );

  // Escuchar respuesta de participantes y solicitar cuando se monta
  useEffect(() => {
    if (!socket || !chatId) return;

    // Handler para la respuesta directa del servidor
    const handleParticipantsResponse = (data: {
      channelId: string;
      participants: VoiceParticipant[];
    }) => {
      if (data.channelId === chatId) {
        useVoiceParticipantsStore.getState().setParticipants(
          chatId,
          data.participants.map((p) => ({
            profileId: p.profileId,
            username: p.username,
            avatarUrl: p.avatarUrl,
            usernameColor: p.usernameColor,
          })),
        );
      }
    };

    // Escuchar la respuesta
    socket.on("voice-participants-response", handleParticipantsResponse);

    // Solicitar participantes después de un pequeño delay para dar tiempo
    // a que el evento voice-join sea procesado
    const timeout = setTimeout(() => {
      socket.emit("voice-get-participants", { channelId: chatId });
    }, 300);

    return () => {
      clearTimeout(timeout);
      socket.off("voice-participants-response", handleParticipantsResponse);
    };
  }, [socket, chatId]);

  // Crear un mapa de profileId a datos del participante
  const participantDataMap = useMemo(() => {
    const map = new Map<string, VoiceParticipant>();
    voiceParticipants.forEach((p) => {
      map.set(p.profileId, p);
    });
    return map;
  }, [voiceParticipants]);

  // Obtener info de los tracks de audio para detectar quién habla
  const audioTracks = useTracks([
    { source: Track.Source.Microphone, withPlaceholder: false },
  ]);

  // Obtener tracks de screen share
  const screenShareTracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  // Detectar qué participantes están hablando
  const speakingParticipants = useMemo(() => {
    const speaking = new Set<string>();
    audioTracks.forEach((track) => {
      if (track.participant && track.publication?.isMuted === false) {
        // El participante tiene micrófono activo
        speaking.add(track.participant.identity);
      }
    });
    return speaking;
  }, [audioTracks]);

  // Verificar si hay screen share activo
  const activeScreenShare =
    screenShareTracks.length > 0 ? screenShareTracks[0] : null;

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full",
        "bg-gradient-to-b from-theme-bg-primary to-theme-bg-secondary",
      )}
    >
      {/* Screen Share - mostrar prominentemente si hay uno activo */}
      {activeScreenShare && activeScreenShare.publication && (
        <div className="flex-1 p-4 min-h-0">
          <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
            <VideoTrack
              trackRef={{
                participant: activeScreenShare.participant,
                source: Track.Source.ScreenShare,
                publication: activeScreenShare.publication,
              }}
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
              {activeScreenShare.participant?.name || "Screen Share"}
            </div>
          </div>
        </div>
      )}

      {/* Grid de participantes */}
      <div
        className={cn(
          "overflow-auto",
          activeScreenShare ? "h-32 p-2" : "flex-1 p-4",
        )}
      >
        <div
          className={cn(
            "grid gap-3 h-full w-full place-items-center",
            // Grid responsive basado en número de participantes
            !activeScreenShare && participants.length <= 1 && "grid-cols-1",
            !activeScreenShare && participants.length === 2 && "grid-cols-2",
            !activeScreenShare &&
              participants.length >= 3 &&
              participants.length <= 4 &&
              "grid-cols-2 grid-rows-2",
            !activeScreenShare &&
              participants.length >= 5 &&
              participants.length <= 6 &&
              "grid-cols-3 grid-rows-2",
            !activeScreenShare &&
              participants.length >= 7 &&
              "grid-cols-3 grid-rows-3",
            // Cuando hay screen share, mostrar participantes en fila horizontal
            activeScreenShare && "grid-cols-4 auto-rows-min",
          )}
        >
          {participants.map((participant) => {
            const isLocal =
              participant.identity ===
              localParticipant.localParticipant?.identity;
            const participantData = participantDataMap.get(
              participant.identity,
            );
            const isSpeaking = speakingParticipants.has(participant.identity);


            // Si no tenemos datos del store, usar datos básicos
            const displayData: VoiceParticipant = participantData || {
              profileId: participant.identity,
              username: participant.name || "User",
              avatarUrl: null,
              usernameColor: null,
            };


            return (
              <ParticipantCard
                key={participant.identity}
                participant={displayData}
                livekitParticipant={participant}
                isSpeaking={isSpeaking}
                isLocal={isLocal}
              />
            );
          })}
        </div>
      </div>

      {/* Barra de controles personalizada */}
      <div className="flex items-center justify-center gap-2 bg-theme-bg-primary/90 border-t border-theme-border-primary/50 p-4">
        {/* Botón de micrófono */}
        <TrackToggle
          source={Track.Source.Microphone}
          className={cn(
            "p-3 rounded-full transition-all duration-200 flex items-center justify-center",
            "bg-theme-bg-tertiary hover:bg-theme-bg-quaternary text-theme-text-light",
            "data-[lk-enabled=false]:bg-red-500/80 data-[lk-enabled=false]:hover:bg-red-600",
          )}
        />

        {/* Botón de cámara */}
        <TrackToggle
          source={Track.Source.Camera}
          className={cn(
            "p-3 rounded-full transition-all duration-200 flex items-center justify-center",
            "bg-theme-bg-tertiary hover:bg-theme-bg-quaternary text-theme-text-light",
            "data-[lk-enabled=false]:bg-zinc-600 data-[lk-enabled=false]:hover:bg-zinc-700",
          )}
        />

        {/* Botón de compartir pantalla */}
        <TrackToggle
          source={Track.Source.ScreenShare}
          className={cn(
            "p-3 rounded-full transition-all duration-200 flex items-center justify-center",
            "bg-theme-bg-tertiary hover:bg-theme-bg-quaternary text-theme-text-light",
            "data-[lk-enabled=true]:bg-theme-accent-primary data-[lk-enabled=true]:hover:bg-theme-accent-hover",
          )}
        />

        {/* Botón de desconectar */}
        <DisconnectButton
          className={cn(
            "p-3 rounded-full transition-all duration-200 flex items-center justify-center",
            "bg-red-500/80 hover:bg-red-600 text-white",
          )}
        >
          <PhoneOff className="w-5 h-5" />
        </DisconnectButton>
      </div>

      {/* Renderer de audio */}
      <RoomAudioRenderer />
    </div>
  );
}

export const MediaRoom = ({
  chatId,
  video,
  audio,
  onLeave,
}: MediaRoomProps) => {
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState(false);
  const {
    isConnecting,
    isConnected,
    boardId,
    confirmConnected,
    connectionFailed,
    leaveVoice,
  } = useVoiceStore();
  const { socket } = useSocketClient();
  // Usar ref para trackear el estado de join de forma más robusta
  const joinStateRef = useRef<{
    hasEmitted: boolean;
    chatId: string | null;
    profileId: string | null;
    boardId: string | null;
  }>({ hasEmitted: false, chatId: null, profileId: null, boardId: null });
  const [profileData, setProfileData] = useState<{
    id: string;
    username: string;
    avatarUrl: string | null;
    usernameColor: string | null;
  } | null>(null);

  // Reset join state cuando cambia el chatId (nuevo canal)
  useEffect(() => {
    joinStateRef.current = {
      hasEmitted: false,
      chatId: null,
      profileId: null,
      boardId: null,
    };
  }, [chatId]);

  // Fetch profile data for socket events (with retry for transient 401/404)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { fetchWithRetry } = await import("@/lib/fetch-with-retry");
        const res = await fetchWithRetry("/api/profile");

        if (!res.ok) return;

        const data = await res.json();
        if (data?.id) {
          setProfileData({
            id: data.id,
            username: data.username,
            avatarUrl: data.avatarAsset?.url || null,
            usernameColor: data.usernameColor || null,
          });
        }
      } catch (e) {
        console.error("[MediaRoom] Error fetching profile:", e);
      }
    };
    fetchProfile();
  }, []);

  // Fetch LiveKit token - use profileId as identity (unique) and username as display name
  useEffect(() => {
    const fetchToken = async () => {
      if (!profileData?.id) return;

      try {
        const resp = await fetch(`/api/livekit?room=${chatId}`);
        const data = await resp.json();
        if (data.token) {
          setToken(data.token);
          setTokenError(false);
        } else {
          console.error("No token received:", data);
          setTokenError(true);
          connectionFailed();
        }
      } catch (e) {
        console.error("Error fetching LiveKit token:", e);
        setTokenError(true);
        connectionFailed();
      }
    };

    fetchToken();
  }, [profileData, chatId, connectionFailed]);

  // Emit voice join/leave events - SOLO cuando isConnected (confirmado por LiveKit)
  useEffect(() => {
    if (!socket || !profileData) return;

    const currentState = joinStateRef.current;

    // Solo emitir join cuando LiveKit confirmó la conexión
    if (isConnected && !currentState.hasEmitted) {
      // Emit join event
      socket.emit("voice-join", {
        channelId: chatId,
        profileId: profileData.id,
        username: profileData.username,
        avatarUrl: profileData.avatarUrl,
        usernameColor: profileData.usernameColor,
        boardId, // Include boardId for backend optimization
      });

      // Actualizar ref con los valores actuales
      joinStateRef.current = {
        hasEmitted: true,
        chatId: chatId,
        profileId: profileData.id,
        boardId: boardId ?? null,
      };
    } else if (
      !isConnected &&
      currentState.hasEmitted &&
      currentState.chatId &&
      currentState.profileId
    ) {
      // Emit leave event usando los valores guardados en el ref
      socket.emit("voice-leave", {
        channelId: currentState.chatId,
        profileId: currentState.profileId,
        boardId: currentState.boardId, // Include boardId for backend optimization
      });

      // Reset state
      joinStateRef.current = {
        hasEmitted: false,
        chatId: null,
        profileId: null,
        boardId: null,
      };
    }
  }, [isConnected, socket, chatId, profileData, boardId]);

  // Cleanup on unmount - usar valores del ref para evitar closures stale
  useEffect(() => {
    // Capturar socket para cleanup
    const currentSocket = socket;

    return () => {
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
          boardId: state.boardId, // Include boardId for backend optimization
        });
        joinStateRef.current = {
          hasEmitted: false,
          chatId: null,
          profileId: null,
          boardId: null,
        };
      }
    };
  }, [socket]);

  const hasCalledLeave = useRef(false);

  const handleLeaveCall = useCallback(() => {
    // Prevent multiple leave calls
    if (hasCalledLeave.current) return;
    hasCalledLeave.current = true;

    leaveVoice();
    if (onLeave) {
      onLeave();
    }
  }, [leaveVoice, onLeave]);

  // Handler when LiveKit connects successfully
  const handleConnected = useCallback(() => {
    confirmConnected();
    hasCalledLeave.current = false;
  }, [confirmConnected]);

  // Handler when LiveKit disconnects or fails
  const handleDisconnected = useCallback(() => {
    handleLeaveCall();
  }, [handleLeaveCall]);

  // Room options for proper media handling - MUST be before any conditional returns
  // Optimized for cost reduction: reduced simulcast layers, dtx/red for audio
  const roomOptions: RoomOptions = useMemo(
    () => ({
      adaptiveStream: true,
      dynacast: true,
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
        // Reduced simulcast layers (2 instead of 3) - saves bandwidth
        videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
        screenShareSimulcastLayers: [VideoPresets.h360, VideoPresets.h720],
        dtx: true, // Discontinuous transmission - silence = no data sent
        red: true, // Redundant encoding - better quality with packet loss
        videoCodec: "vp8", // VP8 is more CPU efficient, good compression
      },
    }),
    [],
  );

  // Si hubo error obteniendo token, no renderizar nada
  // (connectionFailed ya fue llamado, el store se resetea)
  if (tokenError) {
    return null;
  }

  // Si estamos intentando conectar pero no tenemos token aún, no renderizar nada
  if (isConnecting && token === "") {
    return null;
  }

  // Si no estamos conectando ni conectados, no renderizar nada
  if (!isConnecting && !isConnected) {
    return null;
  }

  // Renderizar LiveKitRoom - connect=true inicia la conexión
  // onConnected confirma cuando LiveKit está listo
  return (
    <div className="relative flex-1">
      <MediaRoomControls onLeave={handleLeaveCall} />
      <LiveKitRoom
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        token={token}
        connect={true}
        video={video}
        audio={audio}
        options={roomOptions}
        className="h-full w-full"
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
      >
        <CustomVoiceUI chatId={chatId} />
      </LiveKitRoom>
    </div>
  );
};

