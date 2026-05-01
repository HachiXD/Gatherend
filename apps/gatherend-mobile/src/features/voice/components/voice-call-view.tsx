import { Ionicons } from "@expo/vector-icons";
import {
  useLocalParticipant,
  useParticipants,
  useTracks,
  VideoTrack,
} from "@livekit/react-native";
import type {
  TrackReference,
  TrackReferenceOrPlaceholder,
} from "@livekit/react-native";
import { Participant, Track, TrackPublication } from "livekit-client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Text } from "@/src/components/app-typography";
import { UserAvatar } from "@/src/components/user-avatar";
import { useTheme } from "@/src/theme/theme-provider";
import {
  selectChannelParticipants,
  useVoiceParticipantsStore,
  type VoiceParticipant,
} from "../store/use-voice-participants-store";

type FocusedItem =
  | { id: string; type: "participant" }
  | { id: string; type: "screenshare" };

type CallItem =
  | {
      cameraTrackRef?: TrackReference & { publication: TrackPublication };
      id: string;
      participant: Participant;
      type: "participant";
    }
  | {
      id: string;
      participant: Participant;
      publication: TrackPublication;
      type: "screenshare";
    };

type VoiceCallViewProps = {
  channelId: string;
};

const SPEAKING_DEBOUNCE_MS = 100;

function useFastSpeakingIndicator(participant: Participant) {
  const [isSpeaking, setIsSpeaking] = useState(participant.isSpeaking);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

function getScreenShareId(
  track: TrackReference & { publication: TrackPublication },
  index: number,
) {
  return (
    track.publication.trackSid ??
    `screenshare-${track.participant.identity}-${index}`
  );
}

function isValidScreenShareTrack(
  track: TrackReferenceOrPlaceholder,
): track is TrackReference & { publication: TrackPublication } {
  return Boolean(track.publication?.track);
}

function isValidCameraTrack(
  track: TrackReferenceOrPlaceholder,
): track is TrackReference & { publication: TrackPublication } {
  return Boolean(track.publication?.track);
}

function ParticipantTile({
  item,
  isFocused = false,
  participantData,
  onPress,
}: {
  item: CallItem;
  isFocused?: boolean;
  participantData?: VoiceParticipant;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const localParticipant = useLocalParticipant();
  const isSpeaking = useFastSpeakingIndicator(item.participant);
  const isLocal =
    item.participant.identity === localParticipant.localParticipant?.identity;

  const audioPublication =
    item.type === "participant"
      ? item.participant.getTrackPublication(Track.Source.Microphone)
      : null;

  const isMuted =
    item.type === "participant" &&
    (!audioPublication?.track || audioPublication.isMuted);

  const displayName =
    participantData?.username || item.participant.name || "Usuario";
  const avatarUrl = participantData?.avatarUrl ?? null;
  const profileId = participantData?.profileId ?? item.participant.identity;

  const videoTrackRef =
    item.type === "screenshare"
      ? {
          participant: item.participant,
          publication: item.publication,
          source: Track.Source.ScreenShare,
        }
      : item.cameraTrackRef
        ? item.cameraTrackRef
        : undefined;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        item.type === "screenshare" ? styles.screenShareTile : null,
        isFocused ? styles.focusedTile : null,
        isSpeaking && item.type === "participant" ? styles.speakingTile : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {videoTrackRef ? (
        <VideoTrack
          objectFit={item.type === "screenshare" ? "contain" : "cover"}
          style={styles.video}
          trackRef={videoTrackRef}
        />
      ) : (
        <View style={styles.avatarCenter}>
          <UserAvatar
            avatarUrl={avatarUrl}
            profileId={profileId}
            showStatus={false}
            size={isFocused ? 92 : 62}
            username={displayName}
          />
        </View>
      )}

      <View style={styles.topBadges}>
        {item.type === "screenshare" ? (
          <View style={styles.statusBadge}>
            <Ionicons color={colors.textPrimary} name="desktop-outline" size={13} />
          </View>
        ) : null}
        {isMuted ? (
          <View style={[styles.statusBadge, styles.mutedBadge]}>
            <Ionicons color="#fff" name="mic-off" size={13} />
          </View>
        ) : null}
        {isSpeaking && !isMuted && item.type === "participant" ? (
          <View style={[styles.statusBadge, styles.speakingBadge]}>
            <Ionicons color="#fff" name="volume-high" size={13} />
          </View>
        ) : null}
      </View>

      <View style={styles.labelOverlay}>
        <Text numberOfLines={1} style={styles.tileLabel}>
          {item.type === "screenshare"
            ? `${displayName} comparte pantalla`
            : `${displayName}${isLocal ? " (tu)" : ""}`}
        </Text>
      </View>
    </Pressable>
  );
}

export function VoiceCallView({ channelId }: VoiceCallViewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  const participants = useParticipants();
  const participantData = useVoiceParticipantsStore(
    selectChannelParticipants(channelId),
  );
  const [focusedItem, setFocusedItem] = useState<FocusedItem | null>(null);

  const participantDataMap = useMemo(() => {
    const map = new Map<string, VoiceParticipant>();
    for (const participant of participantData) {
      map.set(participant.profileId, participant);
    }
    return map;
  }, [participantData]);

  const screenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false },
  );
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false },
  );

  const cameraTrackMap = useMemo(() => {
    const map = new Map<
      string,
      TrackReference & { publication: TrackPublication }
    >();
    for (const track of cameraTracks) {
      if (!isValidCameraTrack(track)) continue;
      if (track.publication.isMuted) continue;
      map.set(track.participant.identity, track);
    }
    return map;
  }, [cameraTracks]);

  const items = useMemo<CallItem[]>(() => {
    const screenShares: CallItem[] = screenShareTracks
      .filter(isValidScreenShareTrack)
      .map((track, index) => ({
        id: getScreenShareId(track, index),
        participant: track.participant,
        publication: track.publication,
        type: "screenshare",
      }));

    const participantItems: CallItem[] = participants.map((participant) => ({
      cameraTrackRef: cameraTrackMap.get(participant.identity),
      id: participant.identity,
      participant,
      type: "participant",
    }));

    return [...screenShares, ...participantItems];
  }, [cameraTrackMap, participants, screenShareTracks]);

  useEffect(() => {
    if (!focusedItem) return;
    if (items.some((item) => item.id === focusedItem.id)) return;
    setFocusedItem(null);
  }, [focusedItem, items]);

  const focusedCallItem =
    focusedItem ? items.find((item) => item.id === focusedItem.id) ?? null : null;
  const gridItems = focusedCallItem
    ? items.filter((item) => item.id !== focusedCallItem.id)
    : items;
  const columns = width >= 700 ? 3 : width >= 460 ? 2 : 1;
  const compactStrip = Boolean(focusedCallItem);
  const tileHeight = compactStrip
    ? 96
    : Math.max(150, Math.min(230, height * 0.24));

  const renderItem = useCallback(
    ({ item }: { item: CallItem }) => (
      <View
        style={[
          compactStrip ? styles.stripItem : styles.gridItem,
          !compactStrip ? { height: tileHeight } : null,
        ]}
      >
        <ParticipantTile
          item={item}
          participantData={participantDataMap.get(item.participant.identity)}
          onPress={() =>
            setFocusedItem((current) =>
              current?.id === item.id ? null : { id: item.id, type: item.type },
            )
          }
        />
      </View>
    ),
    [
      compactStrip,
      participantDataMap,
      styles.gridItem,
      styles.stripItem,
      tileHeight,
    ],
  );

  if (items.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons color={colors.accentPrimary} name="call" size={30} />
        <Text style={styles.emptyTitle}>Conectando llamada...</Text>
        <Text style={styles.emptyText}>
          Los participantes apareceran aqui cuando LiveKit confirme la llamada.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {focusedCallItem ? (
        <View style={styles.focusedArea}>
          <ParticipantTile
            isFocused
            item={focusedCallItem}
            participantData={participantDataMap.get(
              focusedCallItem.participant.identity,
            )}
            onPress={() => setFocusedItem(null)}
          />
        </View>
      ) : null}

      <FlatList
        key={compactStrip ? "strip" : `grid-${columns}`}
        contentContainerStyle={
          compactStrip ? styles.stripContent : styles.gridContent
        }
        data={gridItems}
        horizontal={compactStrip}
        keyExtractor={(item) => item.id}
        numColumns={compactStrip ? 1 : columns}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.bgSecondary,
      flex: 1,
    },
    emptyState: {
      alignItems: "center",
      backgroundColor: colors.bgSecondary,
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "800",
      textAlign: "center",
    },
    focusedArea: {
      flex: 1,
      minHeight: 260,
      padding: 12,
    },
    gridContent: {
      gap: 10,
      padding: 12,
    },
    gridItem: {
      flex: 1,
      margin: 5,
      minWidth: 0,
    },
    stripContent: {
      gap: 10,
      paddingBottom: 12,
      paddingHorizontal: 12,
    },
    stripItem: {
      height: 96,
      width: 126,
    },
    tile: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 0,
      overflow: "hidden",
    },
    screenShareTile: {
      backgroundColor: "#020617",
    },
    focusedTile: {
      borderColor: colors.accentPrimary,
    },
    speakingTile: {
      borderColor: "#22c55e",
      borderWidth: 2,
    },
    pressed: {
      opacity: 0.94,
    },
    video: {
      ...StyleSheet.absoluteFillObject,
    },
    avatarCenter: {
      alignItems: "center",
      justifyContent: "center",
    },
    topBadges: {
      flexDirection: "row",
      gap: 5,
      position: "absolute",
      right: 8,
      top: 8,
    },
    statusBadge: {
      alignItems: "center",
      backgroundColor: "rgba(15, 23, 42, 0.76)",
      borderRadius: 999,
      height: 25,
      justifyContent: "center",
      width: 25,
    },
    mutedBadge: {
      backgroundColor: "rgba(239, 68, 68, 0.88)",
    },
    speakingBadge: {
      backgroundColor: "rgba(34, 197, 94, 0.88)",
    },
    labelOverlay: {
      backgroundColor: "rgba(2, 6, 23, 0.74)",
      bottom: 0,
      left: 0,
      paddingHorizontal: 10,
      paddingVertical: 8,
      position: "absolute",
      right: 0,
    },
    tileLabel: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
  });
}
