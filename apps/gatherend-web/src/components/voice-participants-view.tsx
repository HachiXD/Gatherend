"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  useParticipants,
  useLocalParticipant,
  useTracks,
  VideoTrack,
  useMaybeRoomContext,
} from "@livekit/components-react";
import { Track, Participant, TrackPublication } from "livekit-client";
import { cn } from "@/lib/utils";
import { useSocketClient } from "@/components/providers/socket-provider";
import { getDisplayColor } from "@/lib/username-color";
import {
  useVoiceParticipantsStore,
  VoiceParticipant,
} from "@/hooks/use-voice-participants-store";
import { useVoiceStore } from "@/hooks/use-voice-store";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useShallow } from "zustand/react/shallow";
import {
  MicOff,
  Volume2,
  Loader2,
  Monitor,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { useTranslation } from "@/i18n";

interface VoiceParticipantsViewProps {
  chatId: string;
}

// Types for focusable items
type FocusedItemType = "participant" | "screenshare";
interface FocusedItem {
  type: FocusedItemType;
  id: string; // participant identity or screenshare track sid
}

// === FAST SPEAKING INDICATOR ===
// Custom hook with lower latency than useIsSpeaking (less debounce)
const SPEAKING_DEBOUNCE_MS = 100; // Much faster than default ~500ms

function useFastSpeakingIndicator(participant: Participant): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleSpeakingChanged = (speaking: boolean) => {
      if (speaking) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsSpeaking(true);
        return;
      }

      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          setIsSpeaking(false);
          timeoutRef.current = null;
        }, SPEAKING_DEBOUNCE_MS);
      }
    };

    participant.on("isSpeakingChanged", handleSpeakingChanged);
    handleSpeakingChanged(participant.isSpeaking);

    return () => {
      participant.off("isSpeakingChanged", handleSpeakingChanged);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [participant]);

  return isSpeaking;
}

// Función para convertir hex a rgba
function hexToRgba(hex: string | null | undefined, alpha: number): string {
  if (!hex || typeof hex !== "string") {
    return `rgba(47, 71, 69, ${alpha})`;
  }
  const cleanHex = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return `rgba(47, 71, 69, ${alpha})`;
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Componente para un participante individual
interface ParticipantCardProps {
  participant: VoiceParticipant;
  livekitParticipant: Participant;
  isLocal?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function ParticipantCard({
  participant,
  livekitParticipant,
  isLocal = false,
  isExpanded = false,
  onToggleExpand,
}: ParticipantCardProps) {
  // Use fast speaking indicator with lower latency
  const isSpeaking = useFastSpeakingIndicator(livekitParticipant);

  // Access tracks directly from participant
  const videoPublication = livekitParticipant.getTrackPublication(
    Track.Source.Camera,
  );
  const audioPublication = livekitParticipant.getTrackPublication(
    Track.Source.Microphone,
  );

  const hasVideo = !!(
    videoPublication?.track &&
    !videoPublication.isMuted &&
    (videoPublication.isSubscribed || isLocal)
  );
  const isMuted = !audioPublication?.track || audioPublication?.isMuted;

  // Obtener color de username
  const displayColor = getDisplayColor(participant.usernameColor);

  return (
    <div
      onClick={onToggleExpand}
      className={cn(
        "relative flex flex-col items-center justify-center cursor-pointer",
        "rounded-xl overflow-hidden transition-all duration-300",
        "bg-theme-bg-tertiary/50 backdrop-blur-sm",
        "hover:ring-2 hover:ring-theme-accent-primary/50",
        isExpanded ? "w-full h-full" : "w-full aspect-square max-w-[200px]",
        isSpeaking &&
          "ring-2 ring-green-500 ring-offset-2 ring-offset-theme-bg-primary",
      )}
      style={{
        background: displayColor
          ? `linear-gradient(135deg, ${hexToRgba(
              displayColor,
              0.3,
            )}, ${hexToRgba(displayColor, 0.1)})`
          : undefined,
      }}
    >
      {/* Video o Avatar */}
      {hasVideo && videoPublication?.track ? (
        <div className="absolute inset-0">
          <VideoTrack
            trackRef={{
              participant: livekitParticipant,
              source: Track.Source.Camera,
              publication: videoPublication,
            }}
            className="w-full h-full object-cover"
          />
          {/* Overlay gradient para mejor legibilidad del nombre */}
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
        </div>
      ) : (
        <Avatar
          className={cn(
            isSpeaking && "ring-2 ring-green-500",
            isExpanded ? "w-32 h-32" : "w-16 h-16",
          )}
        >
          <AvatarImage src={participant.avatarUrl ?? undefined} />
          <AvatarFallback
            className={cn(
              "bg-theme-bg-quaternary text-theme-text-light",
              isExpanded ? "text-4xl" : "text-xl",
            )}
          >
            {participant.username?.charAt(0)?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Expand/Minimize button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand?.();
        }}
        className="absolute top-2 left-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
        title={isExpanded ? "Minimize" : "Expand"}
      >
        {isExpanded ? (
          <Minimize2 className="w-3.5 h-3.5 text-white" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5 text-white" />
        )}
      </button>

      {/* Indicadores de estado */}
      <div className="absolute top-2 right-2 flex gap-1">
        {isMuted && (
          <div className="p-1 rounded-full bg-red-500/80">
            <MicOff className="w-3 h-3 text-white" />
          </div>
        )}
        {isSpeaking && !isMuted && (
          <div className="p-1 rounded-full bg-green-500/80 animate-pulse">
            <Volume2 className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Nombre del participante */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-linear-to-t from-black/80 to-transparent">
        <span
          className={cn(
            "font-medium truncate block text-center",
            displayColor ? "text-white" : "text-theme-text-light",
            isExpanded ? "text-base" : "text-sm",
          )}
          style={{ color: displayColor || undefined }}
        >
          {participant.username}
          {isLocal && (
            <span className="text-xs text-theme-text-muted ml-1">(You)</span>
          )}
        </span>
      </div>
    </div>
  );
}

// Componente para screen share como "miembro" separado
interface ScreenShareCardProps {
  participant: Participant;
  publication: TrackPublication;
  participantData?: VoiceParticipant;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function ScreenShareCard({
  participant,
  publication,
  participantData,
  isExpanded = false,
  onToggleExpand,
}: ScreenShareCardProps) {
  const displayColor = participantData
    ? getDisplayColor(participantData.usernameColor)
    : null;
  const displayName =
    participantData?.username || participant.name || "Screen Share";

  return (
    <div
      onClick={onToggleExpand}
      className={cn(
        "group relative flex flex-col min-h-0 items-center justify-center cursor-pointer",
        "rounded-xl overflow-hidden transition-all duration-300",
        "bg-black hover:ring-2 hover:ring-theme-accent-primary/50",
        isExpanded ? "w-full h-full" : "w-full aspect-video max-w-[300px]",
      )}
    >
      {/* Screen share video */}
      <div className="absolute inset-0">
        <VideoTrack
          trackRef={{
            participant,
            source: Track.Source.ScreenShare,
            publication,
          }}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Expand/Minimize button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand?.();
        }}
        className="absolute top-2 left-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
        title={isExpanded ? "Minimize" : "Expand"}
      >
        {isExpanded ? (
          <Minimize2 className="w-3.5 h-3.5 text-white" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5 text-white" />
        )}
      </button>

      {/* Screen share indicator and name */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 p-2 bg-linear-to-t from-black/80 to-transparent transition-opacity",
          isExpanded ? "opacity-0 group-hover:opacity-100" : "opacity-100",
        )}
      >
        <div className="flex items-center justify-center gap-1.5">
          <Monitor className="w-3.5 h-3.5 text-theme-accent-primary" />
          <span
            className={cn(
              "font-medium truncate",
              isExpanded ? "text-base" : "text-sm",
            )}
            style={{ color: displayColor || "#fff" }}
          >
            {displayName}&apos;s screen
          </span>
        </div>
      </div>
    </div>
  );
}

export function VoiceParticipantsView({ chatId }: VoiceParticipantsViewProps) {
  const { t } = useTranslation();

  // Check if we're inside a LiveKitRoom context
  const room = useMaybeRoomContext();

  // If no room context yet, show loading state
  if (!room) {
    return (
      <div className="flex flex-col flex-1 justify-center items-center gap-4 bg-linear-to-b from-theme-bg-primary to-theme-bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-theme-accent-primary" />
        <p className="text-sm text-theme-text-subtle">{t.voice.connecting}</p>
      </div>
    );
  }

  return <VoiceParticipantsViewContent chatId={chatId} />;
}

// Componente interno que usa los hooks de LiveKit (solo se renderiza cuando hay room)
function VoiceParticipantsViewContent({ chatId }: VoiceParticipantsViewProps) {
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const { socket } = useSocketClient();
  const boardId = useVoiceStore((state) => state.boardId);
  const context = useVoiceStore((state) => state.context);

  // State for focused/expanded item
  const [focusedItem, setFocusedItem] = useState<FocusedItem | null>(null);

  // Obtener participantes del store
  const voiceParticipants = useVoiceParticipantsStore(
    useShallow((state) => state.participants[chatId] ?? []),
  );

  // Solicitar participantes cuando se monta
  useEffect(() => {
    if (!socket || !chatId) return;

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

    socket.on("voice-participants-response", handleParticipantsResponse);

    // Request participants immediately
    socket.emit("voice-get-participants", {
      channelId: chatId,
      boardId,
      context,
    });

    return () => {
      socket.off("voice-participants-response", handleParticipantsResponse);
    };
  }, [socket, chatId, boardId, context]);

  // Real-time join/leave updates for conversation calls (board calls are handled by useVoiceParticipantsSocket(boardId))
  useEffect(() => {
    if (!socket || !chatId || context !== "conversation") return;

    const { addParticipant, removeParticipant, setParticipants } =
      useVoiceParticipantsStore.getState();

    const joinEvent = `voice:conversation:${chatId}:join`;
    const leaveEvent = `voice:conversation:${chatId}:leave`;
    const participantsEvent = `voice:conversation:${chatId}:participants`;

    const handleJoin = (data: {
      channelId: string;
      participant: VoiceParticipant;
    }) => {
      if (data.channelId !== chatId) return;
      addParticipant(chatId, {
        profileId: data.participant.profileId,
        username: data.participant.username,
        avatarUrl: data.participant.avatarUrl,
        usernameColor: data.participant.usernameColor,
      });
    };

    const handleLeave = (data: { channelId: string; profileId: string }) => {
      if (data.channelId !== chatId) return;
      removeParticipant(chatId, data.profileId);
    };

    const handleParticipants = (data: {
      channelId: string;
      participants: VoiceParticipant[];
    }) => {
      if (data.channelId !== chatId) return;
      setParticipants(
        chatId,
        data.participants.map((p) => ({
          profileId: p.profileId,
          username: p.username,
          avatarUrl: p.avatarUrl,
          usernameColor: p.usernameColor,
        })),
      );
    };

    socket.on(joinEvent, handleJoin);
    socket.on(leaveEvent, handleLeave);
    socket.on(participantsEvent, handleParticipants);

    return () => {
      socket.off(joinEvent, handleJoin);
      socket.off(leaveEvent, handleLeave);
      socket.off(participantsEvent, handleParticipants);
    };
  }, [socket, chatId, context]);

  // Mapa de participantes
  const participantDataMap = useMemo(() => {
    const map = new Map<string, VoiceParticipant>();
    voiceParticipants.forEach((p) => {
      map.set(p.profileId, p);
    });
    return map;
  }, [voiceParticipants]);

  // ALL screen share tracks (including local - onlySubscribed: false)
  const screenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false },
  );

  // Type guard to filter tracks with valid publication
  type ValidScreenShareTrack = (typeof screenShareTracks)[number] & {
    publication: TrackPublication;
  };

  const isValidScreenShareTrack = (
    track: (typeof screenShareTracks)[number],
  ): track is ValidScreenShareTrack => {
    return (
      track.publication !== undefined && track.publication.track !== undefined
    );
  };

  // Toggle focus handler
  const handleToggleFocus = useCallback((type: FocusedItemType, id: string) => {
    setFocusedItem((current) => {
      if (current?.type === type && current?.id === id) {
        return null; // Unfocus if clicking the same item
      }
      return { type, id };
    });
  }, []);

  // Count total items (participants + screen shares with actual tracks)
  const validScreenShareTracks = screenShareTracks.filter(
    isValidScreenShareTrack,
  );
  const totalItems = participants.length + validScreenShareTracks.length;

  // Helper to get consistent trackId for screen shares
  const getScreenShareId = (track: ValidScreenShareTrack, index: number) => {
    return (
      track.publication.trackSid ||
      `local-ss-${track.participant.identity}-${index}`
    );
  };

  // Get grid columns based on item count (when nothing is focused)
  const getGridCols = (count: number) => {
    if (count <= 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    if (count <= 9) return "grid-cols-3";
    if (count <= 16) return "grid-cols-4";
    return "grid-cols-5";
  };

  // Render expanded view (one item large on top, rest at bottom)
  if (focusedItem) {
    return (
      <div className="flex flex-col min-h-0 h-full w-full overflow-hidden bg-linear-to-b from-theme-bg-primary to-theme-bg-secondary">
        {/* Main expanded view - TOP */}
        <div className="flex-1 p-4 min-h-0 overflow-hidden">
          {focusedItem.type === "screenshare"
            ? // Focused screen share
              (() => {
                const trackIndex = validScreenShareTracks.findIndex(
                  (t, idx) => getScreenShareId(t, idx) === focusedItem.id,
                );
                const track =
                  trackIndex >= 0 ? validScreenShareTracks[trackIndex] : null;
                if (!track?.publication?.track) return null;
                const participantData = participantDataMap.get(
                  track.participant.identity,
                );
                return (
                  <ScreenShareCard
                    participant={track.participant}
                    publication={track.publication}
                    participantData={participantData}
                    isExpanded
                    onToggleExpand={() =>
                      handleToggleFocus("screenshare", focusedItem.id)
                    }
                  />
                );
              })()
            : // Focused participant
              (() => {
                const participant = participants.find(
                  (p) => p.identity === focusedItem.id,
                );
                if (!participant) return null;
                const isLocal =
                  participant.identity ===
                  localParticipant.localParticipant?.identity;
                const participantData = participantDataMap.get(
                  participant.identity,
                );
                const displayData: VoiceParticipant = participantData || {
                  profileId: participant.identity,
                  username: participant.name || "User",
                  avatarUrl: null,
                  usernameColor: null,
                };
                return (
                  <ParticipantCard
                    participant={displayData}
                    livekitParticipant={participant}
                    isLocal={isLocal}
                    isExpanded
                    onToggleExpand={() =>
                      handleToggleFocus("participant", focusedItem.id)
                    }
                  />
                );
              })()}
        </div>

        {/* Other items - BOTTOM horizontal scrollable strip */}
        <div className="h-28 border-t border-theme-border-primary bg-theme-bg-secondary/50">
          <div className="flex gap-2.5 h-full overflow-x-auto pt-4 pb-2 items-end px-6">
            {/* Screen shares at bottom */}
            {validScreenShareTracks.map((track, index) => {
              const trackId = getScreenShareId(track, index);
              if (
                focusedItem.type === "screenshare" &&
                focusedItem.id === trackId
              )
                return null;
              const participantData = participantDataMap.get(
                track.participant.identity,
              );
              return (
                <div
                  key={`ss-${trackId}`}
                  className="shrink-0 h-full aspect-video"
                >
                  <ScreenShareCard
                    participant={track.participant}
                    publication={track.publication}
                    participantData={participantData}
                    onToggleExpand={() =>
                      handleToggleFocus("screenshare", trackId)
                    }
                  />
                </div>
              );
            })}

            {/* Participants at bottom */}
            {participants.map((participant) => {
              if (
                focusedItem.type === "participant" &&
                focusedItem.id === participant.identity
              )
                return null;
              const isLocal =
                participant.identity ===
                localParticipant.localParticipant?.identity;
              const participantData = participantDataMap.get(
                participant.identity,
              );
              const displayData: VoiceParticipant = participantData || {
                profileId: participant.identity,
                username: participant.name || "User",
                avatarUrl: null,
                usernameColor: null,
              };
              return (
                <div
                  key={participant.identity}
                  className="shrink-0 h-full aspect-square"
                >
                  <ParticipantCard
                    participant={displayData}
                    livekitParticipant={participant}
                    isLocal={isLocal}
                    onToggleExpand={() =>
                      handleToggleFocus("participant", participant.identity)
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Render normal grid view (nothing expanded)
  return (
    <div className="flex flex-col min-h-0 h-full w-full overflow-hidden bg-linear-to-b from-theme-bg-primary to-theme-bg-secondary">
      {/* Grid de todos los items (screen shares + participantes) */}
      <div className="flex-1 p-4 overflow-auto">
        <div
          className={cn(
            "grid gap-3 h-full w-full place-items-center",
            getGridCols(totalItems),
          )}
        >
          {/* Screen shares primero (como "miembros" separados) */}
          {validScreenShareTracks.map((track, index) => {
            const trackId = getScreenShareId(track, index);
            const participantData = participantDataMap.get(
              track.participant.identity,
            );
            return (
              <ScreenShareCard
                key={`ss-${trackId}`}
                participant={track.participant}
                publication={track.publication}
                participantData={participantData}
                onToggleExpand={() => handleToggleFocus("screenshare", trackId)}
              />
            );
          })}

          {/* Participantes */}
          {participants.map((participant) => {
            const isLocal =
              participant.identity ===
              localParticipant.localParticipant?.identity;
            const participantData = participantDataMap.get(
              participant.identity,
            );

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
                isLocal={isLocal}
                onToggleExpand={() =>
                  handleToggleFocus("participant", participant.identity)
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
