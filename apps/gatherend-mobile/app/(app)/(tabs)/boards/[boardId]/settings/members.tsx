import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { BoardSettingsCenterState } from "@/src/features/board-settings/components/settings-states";
import {
  useBoardMemberActions,
  useBoardSettingsMembers,
} from "@/src/features/board-settings/hooks/use-board-settings";
import type {
  BoardMemberRole,
  BoardSettingsMember,
} from "@/src/features/board-settings/types";
import {
  canModifyRole,
  canViewSettingsSection,
  getAssignableRoles,
} from "@/src/features/board-settings/utils/permissions";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

const ROLE_LABELS: Record<BoardMemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  GUEST: "Guest",
};

export default function BoardMembersSettingsScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const profile = useProfile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: board, isLoading: boardLoading } = useBoard(boardId);
  const query = useBoardSettingsMembers(boardId);
  const actions = useBoardMemberActions(boardId ?? "");
  const actorRole = board?.currentMember?.role ?? null;
  const [selectedMember, setSelectedMember] =
    useState<BoardSettingsMember | null>(null);

  const members = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const busyMemberId =
    actions.role.variables?.memberId ??
    actions.kick.variables?.memberId ??
    actions.ban.variables?.memberId ??
    actions.warn.variables?.memberId ??
    actions.removeWarning.variables?.memberId ??
    "";
  const isActionPending =
    actions.role.isPending ||
    actions.kick.isPending ||
    actions.ban.isPending ||
    actions.warn.isPending ||
    actions.removeWarning.isPending;

  const handleError = useCallback((title: string, error: unknown) => {
    Alert.alert(
      title,
      error instanceof Error ? error.message : "Intenta nuevamente.",
    );
  }, []);

  const closeActions = useCallback(() => {
    if (isActionPending) return;
    setSelectedMember(null);
  }, [isActionPending]);

  const handleRoleChange = useCallback(
    (member: BoardSettingsMember, nextRole: BoardMemberRole) => {
      setSelectedMember(null);
      actions.role.mutate(
        { memberId: member.id, nextRole },
        {
          onError: (error) => handleError("No se pudo cambiar el rol", error),
        },
      );
    },
    [actions.role, handleError],
  );

  const handleWarn = useCallback(
    (member: BoardSettingsMember) => {
      setSelectedMember(null);
      actions.warn.mutate(
        { memberId: member.id, targetProfileId: member.profileId },
        {
          onError: (error) => handleError("No se pudo advertir", error),
        },
      );
    },
    [actions.warn, handleError],
  );

  const handleRemoveWarning = useCallback(
    (member: BoardSettingsMember) => {
      if (!member.latestActiveWarningId) return;
      setSelectedMember(null);
      actions.removeWarning.mutate(
        {
          memberId: member.id,
          warningId: member.latestActiveWarningId,
        },
        {
          onError: (error) =>
            handleError("No se pudo remover la advertencia", error),
        },
      );
    },
    [actions.removeWarning, handleError],
  );

  const handleKick = useCallback(
    (member: BoardSettingsMember) => {
      setSelectedMember(null);
      Alert.alert(
        "Expulsar miembro",
        `${member.profile.username} saldra del board.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Expulsar",
            style: "destructive",
            onPress: () =>
              actions.kick.mutate(
                { memberId: member.id, targetProfileId: member.profileId },
                {
                  onError: (error) => handleError("No se pudo expulsar", error),
                },
              ),
          },
        ],
      );
    },
    [actions.kick, handleError],
  );

  const handleBan = useCallback(
    (member: BoardSettingsMember) => {
      setSelectedMember(null);
      Alert.alert(
        "Banear miembro",
        `${member.profile.username} no podra volver a entrar.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Banear",
            style: "destructive",
            onPress: () =>
              actions.ban.mutate(
                { memberId: member.id, targetProfileId: member.profileId },
                {
                  onError: (error) => handleError("No se pudo banear", error),
                },
              ),
          },
        ],
      );
    },
    [actions.ban, handleError],
  );

  const renderItem = useCallback(
    ({ item }: { item: BoardSettingsMember }) => {
      const canAct =
        actorRole &&
        item.profileId !== profile.id &&
        canModifyRole(actorRole, item.role);
      const rowBusy = isActionPending && busyMemberId === item.id;

      return (
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
              <Text
                style={[
                  styles.metaBadge,
                  item.activeWarningCount >= 2 ? styles.warningBadge : null,
                ]}
              >
                Warnings: {item.activeWarningCount}/3
              </Text>
            </View>
          </View>
          {rowBusy ? (
            <ActivityIndicator color={colors.accentPrimary} size="small" />
          ) : canAct ? (
            <Pressable
              onPress={() => setSelectedMember(item)}
              style={({ pressed }) => [
                styles.actionButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={colors.textPrimary}
              />
            </Pressable>
          ) : null}
        </View>
      );
    },
    [
      actorRole,
      busyMemberId,
      colors.accentPrimary,
      colors.textPrimary,
      isActionPending,
      profile.id,
      styles,
    ],
  );

  if (boardLoading && !board) {
    return <BoardSettingsCenterState message="Cargando miembros..." loading />;
  }

  if (!board || !canViewSettingsSection(board.currentMember?.role, "members")) {
    return (
      <BoardSettingsCenterState
        title="Sin acceso"
        message="No tienes permisos para administrar miembros."
      />
    );
  }

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

  const assignableRoles = actorRole ? getAssignableRoles(actorRole) : [];
  const canWarnOrBan = actorRole === "OWNER" || actorRole === "ADMIN";

  return (
    <>
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
        ListHeaderComponent={
          <Text style={styles.summary}>
            {board.memberCount}{" "}
            {board.memberCount === 1 ? "miembro" : "miembros"}
          </Text>
        }
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
      <Modal
        transparent
        animationType="fade"
        visible={Boolean(selectedMember)}
        onRequestClose={closeActions}
      >
        <View style={styles.modalLayer}>
          <Pressable style={styles.modalBackdrop} onPress={closeActions} />
          {selectedMember ? (
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <UserAvatar
                  avatarUrl={selectedMember.profile.avatarAsset?.url}
                  username={selectedMember.profile.username}
                  size={42}
                />
                <View style={styles.sheetHeaderCopy}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {selectedMember.profile.username}
                  </Text>
                  <Text style={styles.sheetSubtitle} numberOfLines={1}>
                    {ROLE_LABELS[selectedMember.role]} · Warnings:{" "}
                    {selectedMember.activeWarningCount}/3
                  </Text>
                </View>
              </View>

              <View style={styles.sheetSection}>
                {assignableRoles
                  .filter((nextRole) => nextRole !== selectedMember.role)
                  .map((nextRole) => (
                    <Pressable
                      key={nextRole}
                      disabled={isActionPending}
                      onPress={() => handleRoleChange(selectedMember, nextRole)}
                      style={({ pressed }) => [
                        styles.sheetRow,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Ionicons
                        name="shield-outline"
                        size={18}
                        color={colors.textPrimary}
                      />
                      <Text style={styles.sheetRowText}>
                        Cambiar a {ROLE_LABELS[nextRole]}
                      </Text>
                    </Pressable>
                  ))}

                {canWarnOrBan ? (
                  <>
                    <Pressable
                      disabled={isActionPending}
                      onPress={() => handleWarn(selectedMember)}
                      style={({ pressed }) => [
                        styles.sheetRow,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Ionicons
                        name="alert-circle-outline"
                        size={18}
                        color={colors.textPrimary}
                      />
                      <Text style={styles.sheetRowText}>Advertir</Text>
                    </Pressable>
                    <Pressable
                      disabled={
                        isActionPending || !selectedMember.latestActiveWarningId
                      }
                      onPress={() => handleRemoveWarning(selectedMember)}
                      style={({ pressed }) => [
                        styles.sheetRow,
                        !selectedMember.latestActiveWarningId
                          ? styles.sheetRowDisabled
                          : null,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Ionicons
                        name="remove-circle-outline"
                        size={18}
                        color={colors.textPrimary}
                      />
                      <Text style={styles.sheetRowText}>
                        Remover advertencia
                      </Text>
                    </Pressable>
                  </>
                ) : null}

                <Pressable
                  disabled={isActionPending}
                  onPress={() => handleKick(selectedMember)}
                  style={({ pressed }) => [
                    styles.sheetRow,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Ionicons
                    name="person-remove-outline"
                    size={18}
                    color={colors.textPrimary}
                  />
                  <Text style={styles.sheetRowText}>Expulsar</Text>
                </Pressable>

                {canWarnOrBan ? (
                  <Pressable
                    disabled={isActionPending}
                    onPress={() => handleBan(selectedMember)}
                    style={({ pressed }) => [
                      styles.sheetRow,
                      styles.destructiveRow,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Ionicons name="hammer-outline" size={18} color="#fb7185" />
                    <Text style={styles.destructiveRowText}>Banear</Text>
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                disabled={isActionPending}
                onPress={closeActions}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    actionButton: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
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
    cancelButton: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
    },
    cancelButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "800",
    },
    destructiveRow: {
      borderColor: "rgba(251, 113, 133, 0.36)",
    },
    destructiveRowText: {
      color: "#fb7185",
      flex: 1,
      fontSize: 14,
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
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(2, 6, 23, 0.58)",
    },
    modalLayer: {
      flex: 1,
      justifyContent: "flex-end",
    },
    nameRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    pressed: {
      opacity: 0.75,
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
    sheet: {
      backgroundColor: colors.bgOverlayPrimary,
      borderColor: colors.borderPrimary,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderWidth: 1,
      gap: 12,
      paddingBottom: 18,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    sheetHandle: {
      alignSelf: "center",
      backgroundColor: colors.borderSecondary,
      borderRadius: 999,
      height: 4,
      marginBottom: 2,
      width: 42,
    },
    sheetHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    sheetHeaderCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    sheetRow: {
      alignItems: "center",
      backgroundColor: colors.bgEditForm,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      minHeight: 44,
      paddingHorizontal: 12,
    },
    sheetRowDisabled: {
      opacity: 0.42,
    },
    sheetRowText: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
    },
    sheetSection: {
      gap: 8,
    },
    sheetSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
    },
    sheetTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
    },
    summary: {
      color: colors.textMuted,
      fontSize: 14,
      paddingBottom: 12,
    },
    warningBadge: {
      backgroundColor: "rgba(120, 53, 15, 0.36)",
      borderColor: "#8a5a2c",
      color: "#f2c084",
    },
  });
}
