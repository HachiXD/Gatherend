import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/src/components/app-typography";
import { UserAvatar } from "@/src/components/user-avatar";
import { BoardSettingsCenterState } from "@/src/features/board-settings/components/settings-states";
import { useBoardRanking } from "@/src/features/board-ranking/hooks/use-board-ranking";
import type { BoardRankingMember } from "@/src/features/board-ranking/types";
import { useTheme } from "@/src/theme/theme-provider";

const RANK_ICONS: Record<
  number,
  { name: React.ComponentProps<typeof Ionicons>["name"]; color: string }
> = {
  1: { name: "trophy", color: "#f59e0b" },
  2: { name: "medal", color: "#94a3b8" },
  3: { name: "medal", color: "#b45309" },
};

export default function BoardRankingScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const query = useBoardRanking(boardId);

  const members = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const renderItem = useCallback(
    ({ item }: { item: BoardRankingMember }) => {
      const rankIcon = RANK_ICONS[item.rank];
      const isTopThree = item.rank <= 3;

      return (
        <View style={[styles.row, isTopThree ? styles.rowHighlighted : null]}>
          <View style={styles.rankContainer}>
            {rankIcon ? (
              <Ionicons name={rankIcon.name} size={20} color={rankIcon.color} />
            ) : (
              <Text style={styles.rankNumber}>{item.rank}</Text>
            )}
          </View>
          <UserAvatar
            avatarUrl={item.profile.avatarAsset?.url}
            username={item.profile.username}
            size={40}
          />
          <View style={styles.memberCopy}>
            <Text style={styles.memberName} numberOfLines={1}>
              {item.profile.username}
            </Text>
            <Text style={styles.discriminator} numberOfLines={1}>
              /{item.profile.discriminator}
            </Text>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>Nv.</Text>
              <Text style={styles.statValue}>{item.level}</Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>XP</Text>
              <Text style={styles.statValue}>{item.xp.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      );
    },
    [styles],
  );

  if (query.isLoading && members.length === 0) {
    return <BoardSettingsCenterState message="Cargando ranking..." loading />;
  }

  if (query.isError && members.length === 0) {
    return (
      <BoardSettingsCenterState
        title="No se pudo cargar el ranking"
        message={query.error.message}
        actionLabel="Reintentar"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <FlashList
      data={members}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.accentPrimary}
        />
      }
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <BoardSettingsCenterState
          title="Sin miembros"
          message="No hay nadie en el ranking todavía."
        />
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator color={colors.accentPrimary} size="small" />
          </View>
        ) : null
      }
    />
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    discriminator: {
      color: colors.textTertiary,
      fontSize: 11,
    },
    footerLoader: {
      paddingVertical: 18,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    memberCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    memberName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    rankContainer: {
      alignItems: "center",
      justifyContent: "center",
      width: 30,
    },
    rankNumber: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
    },
    row: {
      alignItems: "center",
      backgroundColor: colors.bgEditForm,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
      minHeight: 68,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    rowHighlighted: {
      borderColor: colors.accentPrimary,
    },
    statBadge: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "700",
    },
    statsContainer: {
      alignItems: "flex-end",
      gap: 4,
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: "800",
    },
  });
}
