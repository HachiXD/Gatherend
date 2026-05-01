import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo } from "react";
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

export function BoardsDrawerSidebar({
  currentBoardId,
  onBackToBoards,
  onSelectBoard,
}: BoardsDrawerSidebarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: boards = [], isLoading, isError, refetch, isFetching } =
    useUserBoards();

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
          renderItem={({ item }) => {
            const isActive = item.id === currentBoardId;
            const fallbackColor =
              item.imageAsset?.dominantColor ?? colors.avatarFallbackBg;
            const imageUrl = getBoardImageUrl(
              item.imageAsset?.url,
              item.id,
              item.name,
              128,
            );

            return (
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
            );
          }}
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
    gap: 12,
    paddingHorizontal: 10,
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
    alignItems: "center",
    gap: 12,
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
  });
}
