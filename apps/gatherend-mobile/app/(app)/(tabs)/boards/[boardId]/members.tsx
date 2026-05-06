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
import { useBoardSettingsMembers } from "@/src/features/board-settings/hooks/use-board-settings";
import type {
  BoardMemberRole,
  BoardSettingsMember,
} from "@/src/features/board-settings/types";
import { useTheme } from "@/src/theme/theme-provider";

const ROLE_LABELS: Record<BoardMemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  GUEST: "Guest",
};

export default function BoardMembersScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const query = useBoardSettingsMembers(boardId);

  const members = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const renderItem = useCallback(
    ({ item }: { item: BoardSettingsMember }) => (
      <View style={styles.row}>
        <UserAvatar
          avatarUrl={item.profile.avatarAsset?.url}
          username={item.profile.username}
          size={40}
        />
        <View style={styles.memberCopy}>
          <View style={styles.nameRow}>
            <Text style={styles.memberName} numberOfLines={1}>
              {item.profile.username}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{ROLE_LABELS[item.role]}</Text>
            </View>
          </View>
          <Text style={styles.discriminator} numberOfLines={1}>
            /{item.profile.discriminator}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaBadge}>Lv. {item.level}</Text>
          </View>
        </View>
      </View>
    ),
    [styles],
  );

  if (query.isLoading && members.length === 0) {
    return <BoardSettingsCenterState message="Cargando miembros..." loading />;
  }

  if (query.isError && members.length === 0) {
    return (
      <BoardSettingsCenterState
        title="No se pudieron cargar los miembros"
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
      estimatedItemSize={74}
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
          message="No hay miembros para mostrar."
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
    badge: {
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
    },
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
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
    },
    metaBadge: {
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      overflow: "hidden",
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
      marginTop: 3,
    },
    nameRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
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
      minHeight: 74,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
  });
}
