import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { useBoardPostPreviews } from "@/src/features/forum/hooks/use-board-post-previews";
import { PostPreviewCard } from "@/src/features/forum/components/post-preview-card";
import { useTheme } from "@/src/theme/theme-provider";
import type { ForumPostPreview } from "@/src/features/forum/domain/post";
import { Text } from "@/src/components/app-typography";

export default function BoardForumChannelScreen() {
  const { boardId, channelId } = useLocalSearchParams<{
    boardId?: string;
    channelId?: string;
  }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { data: board } = useBoard(boardId);
  const forumChannel = board?.channels.find(
    (channel) => channel.id === channelId,
  );

  const {
    data,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useBoardPostPreviews(boardId, channelId);

  const allPosts = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const handleOpenPost = useCallback(
    (postId: string) => {
      if (!boardId || !channelId) return;
      router.push(
        `/boards/${boardId}/posts/${postId}?channelId=${channelId}` as Href,
      );
    },
    [boardId, channelId, router],
  );

  const handleCreatePost = useCallback(() => {
    if (!boardId || !channelId) return;
    router.push({
      pathname: "/modal/create-post",
      params: { boardId, channelId },
    });
  }, [boardId, channelId, router]);

  const renderItem = useCallback(
    ({ item }: { item: ForumPostPreview }) => (
      <PostPreviewCard
        post={item}
        boardId={boardId ?? ""}
        onPress={() => handleOpenPost(item.id)}
      />
    ),
    [boardId, handleOpenPost],
  );

  if (isLoading && allPosts.length === 0) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={styles.stateText}>Cargando foro...</Text>
      </View>
    );
  }

  if (isError && allPosts.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>No se pudo cargar el foro</Text>
        <Text style={styles.stateText}>
          {error instanceof Error ? error.message : "Intenta nuevamente."}
        </Text>
        <Pressable
          onPress={() => void refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.retryButtonText}>
            {isRefetching ? "Reintentando..." : "Reintentar"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={allPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.accentPrimary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>Todavía no hay posts</Text>
            <Text style={styles.stateText}>
              Sé el primero en publicar en{" "}
              {forumChannel?.name ? `/${forumChannel.name}` : "este foro"}.
            </Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.accentPrimary} size="small" />
            </View>
          ) : null
        }
      />
      <Pressable
        onPress={handleCreatePost}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={30} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    listContent: {
      paddingVertical: 8,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 60,
    },
    stateTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
    },
    stateText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    retryButton: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderSecondary,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 18,
    },
    retryButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    footerLoader: {
      alignItems: "center",
      paddingVertical: 16,
    },
    pressed: {
      opacity: 0.8,
    },
    fab: {
      alignItems: "center",
      backgroundColor: colors.tabActiveBg,
      borderRadius: 28,
      bottom: 24,
      elevation: 4,
      height: 56,
      justifyContent: "center",
      opacity: 0.7,
      position: "absolute",
      right: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      width: 56,
    },
    fabPressed: {
      opacity: 0.35,
    },
  });
}
