import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/src/theme/theme-provider";
import { generatePaletteFromBase } from "@/src/theme/utils";
import type { BoardChannel } from "../types/board";
import { Text } from "@/src/components/app-typography";
import { UserAvatar } from "@/src/components/user-avatar";
import { useVoiceParticipantsStore } from "@/src/features/voice/store/use-voice-participants-store";
import { useUnreadStore } from "@/src/features/notifications/stores/use-unread-store";
import { useMentionStore } from "@/src/features/notifications/stores/use-mention-store";

/**
 * Convierte un color RGB o hex a hex
 * Soporta: "rgb(255, 128, 0)" -> "#FF8000" o "#FF8000" -> "#FF8000"
 */
function normalizeColorToHex(color: string | null): string | null {
  if (!color) return null;

  // Si ya es hex, retornar tal cual
  if (color.startsWith("#")) return color;

  // Si es rgb(r, g, b), parsear y convertir a hex
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`.toUpperCase();
  }

  return null;
}

type BoardChannelsListProps = {
  channels: BoardChannel[];
  onSelectChannel: (channelId: string) => void;
  onJoinVoice?: (channelId: string, channelName: string) => void;
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "hace un momento";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} día${days !== 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `hace ${weeks} semana${weeks !== 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months !== 1 ? "es" : ""}`;
}

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

type ChannelRowProps = {
  item: BoardChannel;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
  onSelectChannel: (id: string) => void;
  onJoinVoice?: (id: string, name: string) => void;
};

function ChannelRow({
  item,
  styles,
  colors,
  onSelectChannel,
  onJoinVoice,
}: ChannelRowProps) {
  const participantsByChannel = useVoiceParticipantsStore(
    (state) => state.participants,
  );
  const unreadCount = useUnreadStore(
    useCallback((state) => state.unreads[item.id] ?? 0, [item.id]),
  );
  const hasMention = useMentionStore(
    useCallback((state) => state.mentions[item.id] === true, [item.id]),
  );

  const imageUrl = item.imageAsset?.url ?? null;
  const rawDominantColor = item.imageAsset?.dominantColor ?? null;
  const normalizedDominantColor = useMemo(
    () => normalizeColorToHex(rawDominantColor),
    [rawDominantColor],
  );
  const derivedColors = useMemo(() => {
    if (!normalizedDominantColor) {
      return null;
    }
    const palette = generatePaletteFromBase(normalizedDominantColor);
    return palette;
  }, [normalizedDominantColor]);
  const voiceParticipants =
    item.type === "VOICE" ? (participantsByChannel[item.id] ?? []) : [];
  const displayedParticipants = voiceParticipants.slice(0, 5);
  const hiddenCount = voiceParticipants.length - displayedParticipants.length;
  const hasUnread = unreadCount > 0;

  const body = (
    <>
      <View style={styles.iconWrap}>
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.iconWrapBg,
            imageUrl && derivedColors
              ? { backgroundColor: derivedColors.bgQuaternary }
              : null,
            imageUrl ? styles.iconWrapBgDimmed : null,
          ]}
        />
        <Ionicons
          color={colors.textPrimary}
          name={item.type === "VOICE" ? "volume-high" : "chatbubble-ellipses"}
          size={22}
        />
      </View>

      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          /{item.name}
        </Text>
        {!imageUrl && (
          <View style={styles.membersPill}>
            <Text numberOfLines={1} style={styles.membersPillText}>
              {getChannelMeta(item, voiceParticipants.length)}
            </Text>
          </View>
        )}
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
        {item.type === "TEXT" && item.lastMessageAt ? (
          <Text numberOfLines={1} style={styles.activity}>
            Activo {timeAgo(item.lastMessageAt)}
          </Text>
        ) : null}
        {!imageUrl && hasUnread && item.type === "TEXT" ? (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>Nuevos mensajes</Text>
          </View>
        ) : null}
      </View>
    </>
  );

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
        imageUrl && derivedColors
          ? { borderColor: derivedColors.borderPrimary }
          : null,
        pressed ? styles.cardPressed : null,
      ]}
    >
      {imageUrl ? (
        <>
          <View style={styles.imageSection}>
            <Image
              contentFit="cover"
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.imageOverlay]}
            />
            <View
              style={[
                styles.imageMembersPill,
                derivedColors
                  ? {
                      backgroundColor: derivedColors.bgQuaternary,
                      borderColor: derivedColors.borderPrimary,
                    }
                  : null,
              ]}
            >
              <Text numberOfLines={1} style={styles.membersPillText}>
                {getChannelMeta(item, voiceParticipants.length)}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.footerSection,
              {
                backgroundColor: derivedColors?.bgTertiary ?? colors.bgTertiary,
              },
            ]}
          >
            <View style={styles.footerBodyRow}>{body}</View>
            {(hasUnread && item.type === "TEXT") || hasMention ? (
              <View style={styles.footerPillsRow}>
                {hasUnread && item.type === "TEXT" ? (
                  <View
                    style={[
                      styles.imageUnreadPill,
                      derivedColors
                        ? { backgroundColor: derivedColors.unreadBg }
                        : null,
                    ]}
                  >
                    <Ionicons
                      color={colors.textLight}
                      name="chatbubble-ellipses"
                      size={16}
                    />
                    <Text style={styles.imageUnreadPillText}>
                      Nuevos mensajes
                    </Text>
                  </View>
                ) : null}
                {hasMention ? (
                  <View
                    style={[
                      styles.imageMentionPill,
                      derivedColors
                        ? { backgroundColor: derivedColors.notificationBg }
                        : null,
                    ]}
                  >
                    <Ionicons color={colors.textLight} name="at" size={18} />
                    <Text style={styles.imageMentionPillText}>
                      Te mencionaron
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <>
          {body}
          {hasMention ? (
            <View style={styles.mentionBadge}>
              <Ionicons color={colors.textLight} name="at" size={22} />
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function BoardChannelsList({
  channels,
  onSelectChannel,
  onJoinVoice,
}: BoardChannelsListProps) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={channels}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ChannelRow
          colors={colors}
          item={item}
          onJoinVoice={onJoinVoice}
          onSelectChannel={onSelectChannel}
          styles={styles}
        />
      )}
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
      alignItems: "stretch",
      flexDirection: "column",
      gap: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    cardPressed: {
      opacity: 0.92,
    },
    imageSection: {
      aspectRatio: 16 / 7,
      backgroundColor: colors.bgQuaternary,
      minHeight: 132,
      overflow: "hidden",
      position: "relative",
      width: "100%",
    },
    imageOverlay: {
      backgroundColor:
        mode === "light" ? "rgba(240,240,245,0.42)" : "rgba(2, 6, 23, 0.52)",
    },
    footerSection: {
      alignItems: "stretch",
      backgroundColor: colors.bgTertiary,
      flexDirection: "column",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    footerBodyRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },
    footerPillsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
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
      fontSize: 18,
      fontWeight: "700",
    },
    meta: {
      color: colors.textMuted,
      fontSize: 15,
    },
    membersPill: {
      alignSelf: "flex-start",
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    imageMembersPill: {
      position: "absolute",
      bottom: 10,
      left: 10,
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    membersPillText: {
      color: colors.textMuted,
      fontSize: 15,
    },
    activity: {
      color: colors.textMuted,
      fontSize: 15,
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
    unreadPill: {
      alignSelf: "flex-start",
      backgroundColor: colors.notificationBg,
      borderRadius: 6,
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    unreadPillText: {
      color: colors.textLight,
      fontSize: 12,
      fontWeight: "700",
    },
    mentionBadge: {
      alignItems: "center",
      backgroundColor: colors.notificationBg,
      borderRadius: 999,
      height: 26,
      justifyContent: "center",
      width: 26,
    },
    imageUnreadPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.notificationBg,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    imageUnreadPillText: {
      color: colors.textLight,
      fontSize: 13,
      fontWeight: "700",
    },
    imageMentionPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.notificationBg,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    imageMentionPillText: {
      color: colors.textLight,
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
