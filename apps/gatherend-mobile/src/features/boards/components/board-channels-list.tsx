import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/src/theme/theme-provider";
import type { BoardChannel } from "../types/board";
import { Text } from "@/src/components/app-typography";
import { UserAvatar } from "@/src/components/user-avatar";
import { useVoiceParticipantsStore } from "@/src/features/voice/store/use-voice-participants-store";

type BoardChannelsListProps = {
  channels: BoardChannel[];
  onSelectChannel: (channelId: string) => void;
  onJoinVoice?: (channelId: string, channelName: string) => void;
};

function getChannelMeta(channel: BoardChannel, voiceParticipantCount: number) {
  const count =
    channel.type === "VOICE"
      ? voiceParticipantCount
      : channel.channelMemberCount;
  const label = count === 1 ? "miembro" : "miembros";
  if (channel.type === "VOICE") {
    return count === 0 ? "Nadie conectado" : `${count} ${label} en llamada`;
  }
  return `${count} ${label}`;
}

export function BoardChannelsList({
  channels,
  onSelectChannel,
  onJoinVoice,
}: BoardChannelsListProps) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const participantsByChannel = useVoiceParticipantsStore(
    (state) => state.participants,
  );

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={channels}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const imageUrl = item.imageAsset?.url ?? null;
        const voiceParticipants =
          item.type === "VOICE" ? (participantsByChannel[item.id] ?? []) : [];
        const displayedParticipants = voiceParticipants.slice(0, 5);
        const hiddenCount =
          voiceParticipants.length - displayedParticipants.length;

        return (
          <Pressable
            onPress={() => {
              if (item.type === "VOICE" && onJoinVoice) {
                onJoinVoice(item.id, item.name);
              } else {
                onSelectChannel(item.id);
              }
            }}
            style={({ pressed }) => [
              styles.card,
              imageUrl ? styles.cardWithImage : null,
              pressed ? styles.cardPressed : null,
            ]}
          >
            {imageUrl ? (
              <>
                <Image
                  contentFit="cover"
                  source={{ uri: imageUrl }}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, styles.imageOverlay]}
                />
              </>
            ) : null}

            <View style={styles.iconWrap}>
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.iconWrapBg,
                  imageUrl ? styles.iconWrapBgDimmed : null,
                ]}
              />
              <Ionicons
                color={colors.textPrimary}
                name={
                  item.type === "VOICE" ? "volume-high" : "chatbubble-ellipses"
                }
                size={18}
              />
            </View>

            <View style={styles.copy}>
              <Text numberOfLines={1} style={styles.title}>
                /{item.name}
              </Text>
              <Text numberOfLines={1} style={styles.meta}>
                {getChannelMeta(item, voiceParticipants.length)}
              </Text>
              {item.type === "VOICE" && voiceParticipants.length > 0 ? (
                <View style={styles.participantsRow}>
                  <View style={styles.avatarStack}>
                    {displayedParticipants.map((participant, index) => (
                      <View
                        key={participant.profileId}
                        style={[
                          styles.avatarWrap,
                          index > 0 ? styles.avatarOverlap : null,
                        ]}
                      >
                        <UserAvatar
                          avatarUrl={participant.avatarUrl}
                          profileId={participant.profileId}
                          showStatus={false}
                          size={22}
                          username={participant.username}
                        />
                      </View>
                    ))}
                  </View>
                  {hiddenCount > 0 ? (
                    <Text style={styles.hiddenCount}>+{hiddenCount}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  mode: "dark" | "light",
) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingBottom: 20,
    },
    card: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      overflow: "hidden",
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    cardWithImage: {
      minHeight: 88,
    },
    cardPressed: {
      opacity: 0.92,
    },
    imageOverlay: {
      backgroundColor:
        mode === "light" ? "rgba(240,240,245,0.42)" : "rgba(2, 6, 23, 0.52)",
    },
    iconWrap: {
      alignItems: "center",
      borderRadius: 14,
      height: 42,
      justifyContent: "center",
      overflow: "hidden",
      width: 42,
    },
    iconWrapBg: {
      backgroundColor: colors.bgQuaternary,
    },
    iconWrapBgDimmed: {
      opacity: 0.6,
    },
    copy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    meta: {
      color: colors.textMuted,
      fontSize: 13,
    },
    participantsRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      paddingTop: 2,
    },
    avatarStack: {
      alignItems: "center",
      flexDirection: "row",
    },
    avatarWrap: {
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 999,
      borderWidth: 1,
      padding: 1,
    },
    avatarOverlap: {
      marginLeft: -7,
    },
    hiddenCount: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
  });
}
