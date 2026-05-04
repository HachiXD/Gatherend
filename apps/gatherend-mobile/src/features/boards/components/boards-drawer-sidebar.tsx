import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { getBoardImageUrl } from "@/src/lib/avatar-utils";
import { useTheme } from "@/src/theme/theme-provider";
import { useUserBoards } from "../hooks/use-user-boards";
import { Text } from "@/src/components/app-typography";
import { useUnreadStore } from "@/src/features/notifications/stores/use-unread-store";
import { useMentionStore } from "@/src/features/notifications/stores/use-mention-store";
import type { UserBoard } from "../types/board";

type BoardsDrawerSidebarProps = {
  currentBoardId?: string;
  onBackToBoards: () => void;
  onSelectBoard: (boardId: string) => void;
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

type BoardDrawerItemProps = {
  item: UserBoard;
  isActive: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
  onSelectBoard: (boardId: string) => void;
};

function BoardDrawerItem({
  item,
  isActive,
  styles,
  colors,
  onSelectBoard,
}: BoardDrawerItemProps) {
  const channelIds = useMemo(
    () => item.channels.map((c) => c.id),
    [item.channels],
  );

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

  const fallbackColor =
    item.imageAsset?.dominantColor ?? colors.avatarFallbackBg;
  const imageUrl = getBoardImageUrl(
    item.imageAsset?.url,
    item.id,
    item.name,
    128,
  );

  return (
    <View style={styles.itemOuter}>
      {hasUnread ? <View style={styles.unreadBar} /> : null}
      <Pressable
        onPress={() => onSelectBoard(item.id)}
        style={({ pressed }) => [
          styles.itemButton,
          isActive ? styles.itemButtonActive : null,
          pressed ? styles.itemPressed : null,
        ]}
      >
        {imageUrl ? (
          <Image
            contentFit="cover"
            source={{ uri: imageUrl }}
            style={styles.itemImage}
          />
        ) : (
          <View
            style={[
              styles.itemImage,
              styles.itemFallback,
              { backgroundColor: fallbackColor },
            ]}
          >
            <Text style={styles.itemFallbackText}>
              {getBoardInitials(item.name)}
            </Text>
          </View>
        )}
      </Pressable>
      {hasMention ? (
        <View style={styles.mentionBadge}>
          <Ionicons color={colors.textLight} name="at" size={10} />
        </View>
      ) : null}
    </View>
  );
}

export function BoardsDrawerSidebar({
  currentBoardId,
  onBackToBoards,
  onSelectBoard,
}: BoardsDrawerSidebarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data: boards = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useUserBoards();

  return (
    <View style={styles.sidebar}>
      <Pressable
        accessibilityLabel="Volver a Mis Boards"
        onPress={onBackToBoards}
        style={({ pressed }) => [
          styles.backButton,
          pressed ? styles.itemPressed : null,
        ]}
      >
        <Ionicons color={colors.textSecondary} name="arrow-back" size={22} />
      </Pressable>

      <View style={styles.separator} />

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.accentPrimary} size="small" />
          <Text style={styles.helperText}>Cargando</Text>
        </View>
      ) : null}

      {!isLoading && isError ? (
        <View style={styles.centerState}>
          <Text style={styles.helperText}>No cargaron</Text>
          <Pressable
            onPress={() => {
              void refetch();
            }}
            style={({ pressed }) => [
              styles.retryPill,
              pressed ? styles.itemPressed : null,
            ]}
          >
            <Text style={styles.retryPillText}>
              {isFetching ? "..." : "Retry"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !isError ? (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={boards}
          keyExtractor={(item) => item.id}
          style={{ width: "100%" }}
          renderItem={({ item }) => (
            <BoardDrawerItem
              colors={colors}
              isActive={item.id === currentBoardId}
              item={item}
              onSelectBoard={onSelectBoard}
              styles={styles}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    sidebar: {
      alignItems: "center",
      backgroundColor: colors.bgPrimary,
      borderRightColor: colors.borderPrimary,
      borderRightWidth: 1,
      gap: 10,
      paddingHorizontal: 0,
      paddingTop: 16,
      paddingBottom: 14,
      width: 88,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 18,
      borderWidth: 1,
      height: 54,
      justifyContent: "center",
      width: 54,
    },
    separator: {
      backgroundColor: colors.borderPrimary,
      height: 1,
      width: "70%",
      marginBottom: -4,
    },
    centerState: {
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
      marginTop: 8,
      width: "100%",
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: "center",
    },
    retryPill: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderSecondary,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 30,
      minWidth: 56,
      paddingHorizontal: 10,
    },
    retryPillText: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: "700",
    },
    listContent: {
      alignItems: "stretch",
      gap: 4,
      paddingBottom: 24,
    },
    itemButton: {
      alignItems: "center",
      borderColor: "transparent",
      borderRadius: 999,
      borderWidth: 2,
      justifyContent: "center",
      padding: 2,
    },
    itemButtonActive: {
      borderColor: colors.accentPrimary,
    },
    itemPressed: {
      opacity: 0.92,
    },
    itemImage: {
      backgroundColor: colors.bgQuaternary,
      borderRadius: 999,
      height: 54,
      width: 54,
    },
    itemFallback: {
      alignItems: "center",
      justifyContent: "center",
    },
    itemFallbackText: {
      color: colors.textLight,
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 0.6,
    },
    itemOuter: {
      alignItems: "center",
      flexDirection: "row",
      position: "relative",
      width: "100%",
      justifyContent: "center",
    },
    unreadBar: {
      backgroundColor: colors.accentPrimary,
      borderRadius: 4,
      bottom: 16,
      left: 0,
      position: "absolute",
      top: 16,
      width: 4,
    },
    mentionBadge: {
      alignItems: "center",
      backgroundColor: colors.notificationBg,
      borderRadius: 999,
      bottom: 0,
      height: 18,
      justifyContent: "center",
      position: "absolute",
      right: 0,
      width: 18,
    },
  });
}
