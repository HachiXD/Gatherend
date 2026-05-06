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

const PODIUM_COLORS = {
  1: "#f59e0b",
  2: "#94a3b8",
  3: "#b45309",
} as const;

const PODIUM_COLUMN_HEIGHT = { 1: 88, 2: 62, 3: 48 } as const;
const PODIUM_AVATAR_SIZE = { 1: 60, 2: 50, 3: 46 } as const;

type PodiumSlotProps = {
  member: BoardRankingMember;
  rank: 1 | 2 | 3;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
};

function PodiumSlot({ member, rank, styles, colors }: PodiumSlotProps) {
  const accentColor = PODIUM_COLORS[rank];
  const columnHeight = PODIUM_COLUMN_HEIGHT[rank];
  const avatarSize = PODIUM_AVATAR_SIZE[rank];

  return (
    <View style={styles.podiumSlot}>
      <View style={styles.podiumAvatarWrap}>
        <UserAvatar
          avatarUrl={member.profile.avatarAsset?.url}
          username={member.profile.username}
          size={avatarSize}
        />
        <View style={[styles.podiumRankBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.podiumRankBadgeText}>{rank}</Text>
        </View>
      </View>

      <Text numberOfLines={1} style={[styles.podiumName, rank === 1 ? styles.podiumNameFirst : null]}>
        {member.profile.username}
      </Text>

      <View style={styles.podiumStats}>
        <Text style={[styles.podiumStatText, { color: accentColor }]}>
          Nv. {member.level}
        </Text>
        <Text style={styles.podiumXp}>
          {member.xp.toLocaleString()} xp
        </Text>
      </View>

      <View
        style={[
          styles.podiumColumn,
          { height: columnHeight, backgroundColor: accentColor + "28", borderColor: accentColor + "60" },
        ]}
      >
        <Text style={[styles.podiumColumnNumber, { color: accentColor }]}>
          {rank}
        </Text>
      </View>
    </View>
  );
}

type PodiumProps = {
  top3: BoardRankingMember[];
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
};

function Podium({ top3, styles, colors }: PodiumProps) {
  const first = top3.find((m) => m.rank === 1);
  const second = top3.find((m) => m.rank === 2);
  const third = top3.find((m) => m.rank === 3);

  return (
    <View style={styles.podiumContainer}>
      <View style={styles.podiumRow}>
        {second ? (
          <PodiumSlot member={second} rank={2} styles={styles} colors={colors} />
        ) : (
          <View style={styles.podiumSlot} />
        )}
        {first ? (
          <PodiumSlot member={first} rank={1} styles={styles} colors={colors} />
        ) : (
          <View style={styles.podiumSlot} />
        )}
        {third ? (
          <PodiumSlot member={third} rank={3} styles={styles} colors={colors} />
        ) : (
          <View style={styles.podiumSlot} />
        )}
      </View>
    </View>
  );
}

function RankRow({
  item,
  styles,
}: {
  item: BoardRankingMember;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rankContainer}>
        <Text style={styles.rankNumber}>{item.rank}</Text>
      </View>
      <UserAvatar
        avatarUrl={item.profile.avatarAsset?.url}
        username={item.profile.username}
        size={38}
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
}

export default function BoardRankingScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const query = useBoardRanking(boardId);

  const members = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const top3 = useMemo(() => members.filter((m) => m.rank <= 3), [members]);
  const rest = useMemo(() => members.filter((m) => m.rank > 3), [members]);

  const renderItem = useCallback(
    ({ item }: { item: BoardRankingMember }) => (
      <RankRow item={item} styles={styles} />
    ),
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
      data={rest}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      estimatedItemSize={68}
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
      ListHeaderComponent={
        top3.length > 0 ? (
          <Podium top3={top3} styles={styles} colors={colors} />
        ) : null
      }
      ListEmptyComponent={
        top3.length === 0 ? (
          <BoardSettingsCenterState
            title="Sin miembros"
            message="No hay nadie en el ranking todavía."
          />
        ) : null
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
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      paddingTop: 16,
    },

    // Podium
    podiumContainer: {
      marginBottom: 20,
    },
    podiumRow: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
    },
    podiumSlot: {
      alignItems: "center",
      flex: 1,
      gap: 4,
    },
    podiumAvatarWrap: {
      position: "relative",
    },
    podiumRankBadge: {
      alignItems: "center",
      borderRadius: 999,
      bottom: -4,
      height: 20,
      justifyContent: "center",
      position: "absolute",
      right: -4,
      width: 20,
    },
    podiumRankBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "800",
    },
    podiumName: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    podiumNameFirst: {
      fontSize: 13,
    },
    podiumStats: {
      alignItems: "center",
      gap: 1,
    },
    podiumStatText: {
      fontSize: 11,
      fontWeight: "800",
    },
    podiumXp: {
      color: colors.textTertiary,
      fontSize: 10,
      fontWeight: "600",
    },
    podiumColumn: {
      alignItems: "center",
      borderRadius: 8,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderWidth: 1,
      justifyContent: "center",
      marginTop: 6,
      width: "100%",
    },
    podiumColumnNumber: {
      fontSize: 22,
      fontWeight: "900",
    },

    // List rows
    row: {
      alignItems: "center",
      backgroundColor: colors.bgEditForm,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
      minHeight: 64,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    rankContainer: {
      alignItems: "center",
      justifyContent: "center",
      width: 28,
    },
    rankNumber: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
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
    discriminator: {
      color: colors.textTertiary,
      fontSize: 11,
    },
    statsContainer: {
      alignItems: "flex-end",
      gap: 4,
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
    statValue: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: "800",
    },
    footerLoader: {
      paddingVertical: 18,
    },
  });
}
