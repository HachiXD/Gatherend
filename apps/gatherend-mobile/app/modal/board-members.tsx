import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/src/components/app-typography";
import { UserAvatar } from "@/src/components/user-avatar";
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

export default function BoardMembersModal() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const router = useRouter();
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
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{ROLE_LABELS[item.role]}</Text>
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      edges={["top", "bottom"]}
    >
      <View
        style={[styles.header, { borderBottomColor: colors.borderPrimary }]}
      >
        <View style={styles.headerSpacer} />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Miembros
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {query.isLoading && members.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentPrimary} size="small" />
          <Text style={[styles.stateText, { color: colors.textMuted }]}>
            Cargando miembros...
          </Text>
        </View>
      ) : query.isError && members.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
            No se pudieron cargar los miembros
          </Text>
          <Text style={[styles.stateText, { color: colors.textMuted }]}>
            {query.error instanceof Error
              ? query.error.message
              : "Intenta nuevamente."}
          </Text>
          <Pressable
            onPress={() => void query.refetch()}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: colors.bgTertiary,
                borderColor: colors.borderSecondary,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[styles.retryButtonText, { color: colors.textPrimary }]}
            >
              {query.isRefetching ? "Reintentando..." : "Reintentar"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={90}
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
            <View style={styles.center}>
              <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
                Sin miembros
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
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      alignItems: "center",
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerSpacer: {
      width: 36,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "700",
    },
    closeButton: {
      alignItems: "center",

      height: 36,
      justifyContent: "center",
      width: 36,
    },
    closeButtonPressed: {
      opacity: 0.7,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 16,
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
    memberCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    nameRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    memberName: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
    },
    roleBadge: {
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    roleBadgeText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    discriminator: {
      color: colors.textTertiary,
      fontSize: 13,
    },
    metaRow: {
      flexDirection: "row",
      gap: 5,
      marginTop: 3,
    },
    metaBadge: {
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      overflow: "hidden",
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    center: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    stateTitle: {
      fontSize: 17,
      fontWeight: "700",
      textAlign: "center",
    },
    stateText: {
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    retryButton: {
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 18,
    },
    retryButtonText: {
      fontSize: 14,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.8,
    },
    footerLoader: {
      alignItems: "center",
      paddingVertical: 16,
    },
  });
}
