import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useCallback, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { getBoardImageUrl } from "@/src/lib/avatar-utils";
import { useTheme } from "@/src/theme/theme-provider";
import type { UserBoard } from "../types/board";
import { Text } from "@/src/components/app-typography";
import { useUnreadStore } from "@/src/features/notifications/stores/use-unread-store";
import { useMentionStore } from "@/src/features/notifications/stores/use-mention-store";

type BoardCardProps = {
  board: UserBoard;
};

function getBoardInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "BD";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function BoardCard({ board }: BoardCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const channelIds = useMemo(() => board.channels.map((c) => c.id), [board.channels]);

  const hasUnread = useUnreadStore(
    useCallback(
      (state) => channelIds.some((id) => (state.unreads[id] ?? 0) > 0),
      [channelIds],
    ),
  );
  const hasMention = useMentionStore(
    useCallback(
      (state) => channelIds.some((id) => state.mentions[id] === true),
      [channelIds],
    ),
  );

  const channelCount = board.channels.length;
  const displayAsset = board.bannerAsset ?? board.imageAsset;
  const fallbackColor = displayAsset?.dominantColor ?? colors.avatarFallbackBg;
  const imageUrl = getBoardImageUrl(displayAsset?.url, board.id, board.name, 256);

  function handlePress() {
    router.push(`/(app)/(tabs)/boards/${board.id}`);
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.cardPressed : null,
      ]}
    >
      {imageUrl ? (
        <Image
          contentFit="cover"
          source={{ uri: imageUrl }}
          style={styles.image}
        />
      ) : (
        <View style={[styles.imageFallback, { backgroundColor: fallbackColor }]}>
          <Text style={styles.imageFallbackText}>{getBoardInitials(board.name)}</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>
          {board.name}
        </Text>
        <Text style={styles.meta}>
          {channelCount} {channelCount === 1 ? "canal" : "canales"}
        </Text>
        {hasUnread || hasMention ? (
          <View style={styles.badgeRow}>
            {hasUnread ? (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadPillText}>Nuevos mensajes</Text>
              </View>
            ) : null}
            {hasMention ? (
              <View style={styles.mentionBadge}>
                <Ionicons color={colors.textLight} name="at" size={12} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderPrimary,
      borderRadius: 20,
      borderWidth: 1,
      flex: 1,
      overflow: "hidden",
    },
    cardPressed: {
      opacity: 0.92,
    },
    image: {
      backgroundColor: colors.bgQuaternary,
      height: 112,
      width: "100%",
    },
    imageFallback: {
      alignItems: "center",
      height: 112,
      justifyContent: "center",
      width: "100%",
    },
    imageFallbackText: {
      color: colors.textLight,
      fontSize: 26,
      fontWeight: "700",
      letterSpacing: 1,
    },
    body: {
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 20,
    },
    meta: {
      color: colors.textMuted,
      fontSize: 13,
    },
    badgeRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 4,
    },
    unreadPill: {
      backgroundColor: colors.notificationBg,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    unreadPillText: {
      color: colors.textLight,
      fontSize: 11,
      fontWeight: "700",
    },
    mentionBadge: {
      alignItems: "center",
      backgroundColor: colors.notificationBg,
      borderRadius: 999,
      height: 22,
      justifyContent: "center",
      width: 22,
    },
  });
}
