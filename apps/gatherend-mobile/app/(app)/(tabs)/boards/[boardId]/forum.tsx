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

export default function BoardForumScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const { data: board } = useBoard(boardId);

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
  } = useBoardPostPreviews(boardId);

  const allPosts = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const handleOpenPost = useCallback(
    (postId: string) => {
      if (!boardId) return;
      router.push(`/(app)/boards/${boardId}/posts/${postId}` as Href);
    },
    [boardId, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: ForumPostPreview }) => (
      <PostPreviewCard
        post={item}
        onPress={() => handleOpenPost(item.id)}
      />
    ),
    [handleOpenPost],
  );

  if (isLoading && allPosts.length === 0) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          Cargando foro...
        </Text>
      </View>
    );
  }

  if (isError && allPosts.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
          No se pudo cargar el foro
        </Text>
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          {error instanceof Error ? error.message : "Intenta nuevamente."}
        </Text>
        <Pressable
          onPress={() => void refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            {
              borderColor: colors.borderSecondary,
              backgroundColor: colors.bgTertiary,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>
            {isRefetching ? "Reintentando..." : "Reintentar"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlashList
      data={allPosts}
      estimatedItemSize={200}
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
          <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
            Todavía no hay posts
          </Text>
          <Text style={[styles.stateText, { color: colors.textMuted }]}>
            Sé el primero en publicar en{" "}
            {board?.name ? `el foro de ${board.name}` : "este foro"}.
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
  );
}

function createStyles(_colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
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
      fontSize: 18,
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
    footerLoader: {
      alignItems: "center",
      paddingVertical: 16,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
