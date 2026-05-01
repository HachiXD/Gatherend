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
import { UserAvatar } from "@/src/components/user-avatar";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { BoardSettingsCenterState } from "@/src/features/board-settings/components/settings-states";
import { useBoardModerationActions } from "@/src/features/board-settings/hooks/use-board-settings";
import type {
  BoardModerationActionItem,
  BoardModerationActionType,
} from "@/src/features/board-settings/types";
import { canViewSettingsSection } from "@/src/features/board-settings/utils/permissions";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

const ACTION_LABELS: Record<BoardModerationActionType, string> = {
  WARNING: "Warning",
  REMOVE_WARNING: "Remove warning",
  BAN: "Ban",
  UNBAN: "Unban",
  KICK: "Kick",
  AUTO_BAN: "Auto ban",
  AUTO_UNBAN: "Auto unban",
};

function getDescription(action: BoardModerationActionItem) {
  const actor = action.issuedBy.username;

  switch (action.actionType) {
    case "WARNING":
      return `${actor} aplico una advertencia.`;
    case "REMOVE_WARNING":
      return `${actor} removio una advertencia.`;
    case "BAN":
      return `${actor} baneo a este usuario.`;
    case "UNBAN":
      return `${actor} quito el ban.`;
    case "KICK":
      return `${actor} expulso a este usuario.`;
    case "AUTO_BAN":
      return "Ban automatico por limite de advertencias.";
    case "AUTO_UNBAN":
      return "Unban automatico.";
    default:
      return action.actionType;
  }
}

export default function BoardHistorySettingsScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: board, isLoading: boardLoading } = useBoard(boardId);
  const query = useBoardModerationActions(boardId);

  const actions = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const renderItem = useCallback(
    ({ item }: { item: BoardModerationActionItem }) => (
      <View style={styles.row}>
        <UserAvatar
          avatarUrl={item.profile.avatarAsset?.url}
          username={item.profile.username}
          size={40}
        />
        <View style={styles.copy}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.profile.username}
            </Text>
            <Text style={styles.actionBadge}>{ACTION_LABELS[item.actionType]}</Text>
          </View>
          <Text style={styles.muted} numberOfLines={1}>
            /{item.profile.discriminator}
          </Text>
          <Text style={styles.description}>{getDescription(item)}</Text>
          <Text style={styles.muted}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>
    ),
    [styles],
  );

  if (boardLoading && !board) {
    return <BoardSettingsCenterState message="Cargando historial..." loading />;
  }

  if (!board || !canViewSettingsSection(board.currentMember?.role, "history")) {
    return (
      <BoardSettingsCenterState
        title="Sin acceso"
        message="Solo owner y admins pueden revisar el historial."
      />
    );
  }

  if (query.isLoading && actions.length === 0) {
    return <BoardSettingsCenterState message="Cargando historial..." loading />;
  }

  if (query.isError && actions.length === 0) {
    return (
      <BoardSettingsCenterState
        title="No se pudo cargar historial"
        message={query.error.message}
        actionLabel="Reintentar"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <FlashList
      data={actions}
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
      ListHeaderComponent={
        <Text style={styles.summary}>
          {actions.length} {actions.length === 1 ? "entrada" : "entradas"}
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={44} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin historial</Text>
          <Text style={styles.emptyText}>
            Todavia no hay acciones de moderacion en este board.
          </Text>
        </View>
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
    actionBadge: {
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
    copy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    description: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    empty: {
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 24,
      paddingTop: 40,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    footerLoader: {
      paddingVertical: 18,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    muted: {
      color: colors.textTertiary,
      fontSize: 11,
    },
    name: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
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
      minHeight: 82,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    summary: {
      color: colors.textMuted,
      fontSize: 14,
      paddingBottom: 12,
    },
  });
}
