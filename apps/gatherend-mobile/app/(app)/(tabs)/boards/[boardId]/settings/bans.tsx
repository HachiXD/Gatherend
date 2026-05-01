import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { BoardSettingsCenterState } from "@/src/features/board-settings/components/settings-states";
import {
  useBoardSettingsBans,
  useUnbanBoardMember,
} from "@/src/features/board-settings/hooks/use-board-settings";
import type { BoardBannedUser } from "@/src/features/board-settings/types";
import { canViewSettingsSection } from "@/src/features/board-settings/utils/permissions";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

export default function BoardBansSettingsScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: board, isLoading: boardLoading } = useBoard(boardId);
  const query = useBoardSettingsBans(boardId);
  const unban = useUnbanBoardMember(boardId ?? "");

  const bans = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const handleUnban = useCallback(
    (ban: BoardBannedUser) => {
      Alert.alert(
        "Quitar ban",
        `${ban.profile.username} podra volver a entrar al board.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Quitar ban",
            onPress: () =>
              unban.mutate(ban.profileId, {
                onError: (error) =>
                  Alert.alert(
                    "No se pudo quitar el ban",
                    error instanceof Error ? error.message : "Intenta nuevamente.",
                  ),
              }),
          },
        ],
      );
    },
    [unban],
  );

  const renderItem = useCallback(
    ({ item }: { item: BoardBannedUser }) => {
      const pendingThis = unban.isPending && unban.variables === item.profileId;

      return (
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
              <Text
                style={[
                  styles.sourceBadge,
                  item.sourceType === "WARNING_THRESHOLD"
                    ? styles.autoBadge
                    : null,
                ]}
              >
                {item.sourceType === "WARNING_THRESHOLD" ? "Auto" : "Manual"}
              </Text>
            </View>
            <Text style={styles.muted} numberOfLines={1}>
              /{item.profile.discriminator}
            </Text>
            <Text style={styles.muted}>
              Baneado el {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.sourceType === "WARNING_THRESHOLD"
                ? "Ban automatico por limite de advertencias."
                : `Ban aplicado por ${item.issuedBy.username}.`}
            </Text>
          </View>
          {pendingThis ? (
            <ActivityIndicator color={colors.accentPrimary} size="small" />
          ) : (
            <Pressable
              onPress={() => handleUnban(item)}
              disabled={unban.isPending}
              style={({ pressed }) => [
                styles.actionButton,
                (pressed || unban.isPending) ? styles.pressed : null,
              ]}
            >
              <Text style={styles.actionButtonText}>Unban</Text>
            </Pressable>
          )}
        </View>
      );
    },
    [colors.accentPrimary, handleUnban, styles, unban.isPending, unban.variables],
  );

  if (boardLoading && !board) {
    return <BoardSettingsCenterState message="Cargando bans..." loading />;
  }

  if (!board || !canViewSettingsSection(board.currentMember?.role, "bans")) {
    return (
      <BoardSettingsCenterState
        title="Sin acceso"
        message="Solo owner y admins pueden revisar bans."
      />
    );
  }

  if (query.isLoading && bans.length === 0) {
    return <BoardSettingsCenterState message="Cargando bans..." loading />;
  }

  if (query.isError && bans.length === 0) {
    return (
      <BoardSettingsCenterState
        title="No se pudieron cargar bans"
        message={query.error.message}
        actionLabel="Reintentar"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <FlashList
      data={bans}
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
          {bans.length} {bans.length === 1 ? "usuario baneado" : "usuarios baneados"}
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="person-remove-outline" size={44} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No hay bans</Text>
          <Text style={styles.emptyText}>Este board no tiene usuarios baneados.</Text>
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
    actionButton: {
      alignItems: "center",
      backgroundColor: colors.tabButtonBg,
      borderRadius: 10,
      justifyContent: "center",
      minHeight: 36,
      paddingHorizontal: 12,
    },
    actionButtonText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    autoBadge: {
      backgroundColor: "rgba(120, 53, 15, 0.36)",
      borderColor: "#8a5a2c",
      color: "#f2c084",
    },
    copy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    description: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
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
    pressed: {
      opacity: 0.7,
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
      minHeight: 86,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    sourceBadge: {
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
    summary: {
      color: colors.textMuted,
      fontSize: 14,
      paddingBottom: 12,
    },
  });
}
