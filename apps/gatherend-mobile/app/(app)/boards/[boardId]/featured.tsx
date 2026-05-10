import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/src/components/app-typography";
import { UserAvatar } from "@/src/components/user-avatar";
import { PostPreviewCard } from "@/src/features/forum/components/post-preview-card";
import type { ForumPostPreview } from "@/src/features/forum/domain/post";
import { useBoardFeatured } from "@/src/features/featured/hooks/use-board-featured";
import { useTheme } from "@/src/theme/theme-provider";
import { useTogglePostLike } from "@/src/features/forum/hooks/use-toggle-post-like";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type HeroPostProps = {
  post: ForumPostPreview;
  boardId: string;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
  mode: "dark" | "light";
  onPress: () => void;
  bottomRadius?: number;
};

function HeroPost({
  post,
  boardId,
  styles,
  colors,
  mode,
  onPress,
  bottomRadius = 0,
}: HeroPostProps) {
  const hasImage = !!post.imageAsset?.url;
  const togglePostLike = useTogglePostLike(boardId);
  const likeAnim = useRef(
    new Animated.Value(post.isLikedByCurrentUser ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(likeAnim, {
      toValue: post.isLikedByCurrentUser ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [likeAnim, post.isLikedByCurrentUser]);

  const heartOutlineOpacity = likeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const heartFilledOpacity = likeAnim;
  const heartScale = likeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.hero,
        {
          borderColor: colors.borderPrimary,
          backgroundColor: colors.bgEditForm,
          borderBottomLeftRadius: bottomRadius,
          borderBottomRightRadius: bottomRadius,
        },
        pressed && styles.pressed,
      ]}
    >
      {hasImage ? (
        <>
          <Image
            contentFit="cover"
            source={{ uri: post.imageAsset!.url ?? undefined }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  mode === "light"
                    ? "rgba(240,240,245,0.38)"
                    : "rgba(2,6,23,0.58)",
              },
            ]}
          />
        </>
      ) : null}

      <View style={styles.heroContent}>
        <View style={styles.authorRow}>
          <UserAvatar
            avatarUrl={post.author.avatarAsset?.url}
            username={post.author.username}
            size={36}
          />
          <View style={styles.authorMeta}>
            <Text
              style={[styles.username, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {post.author.username}
            </Text>
            <View style={styles.authorSubRow}>
              {post.author.badge ? (
                <>
                  <Text style={[styles.badge, { color: colors.textTertiary }]}>
                    {post.author.badge}
                  </Text>
                  <Text
                    style={[styles.separator, { color: colors.textTertiary }]}
                  >
                    |
                  </Text>
                </>
              ) : null}
              <Text style={[styles.date, { color: colors.textTertiary }]}>
                {formatDate(post.createdAt)}
              </Text>
              {post.pinnedAt ? (
                <View
                  style={[styles.pill, { backgroundColor: colors.bgTertiary }]}
                >
                  <Ionicons name="pin" size={10} color={colors.textSubtle} />
                  <Text style={[styles.pillText, { color: colors.textSubtle }]}>
                    Fijado
                  </Text>
                </View>
              ) : null}
              {post.lockedAt ? (
                <View
                  style={[styles.pill, { backgroundColor: colors.bgTertiary }]}
                >
                  <Ionicons
                    name="lock-closed"
                    size={10}
                    color={colors.textSubtle}
                  />
                  <Text style={[styles.pillText, { color: colors.textSubtle }]}>
                    Cerrado
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.heroPushSpacer} />

        <View style={styles.postBody}>
          {post.title ? (
            <Text
              style={[styles.postTitle, { color: colors.textPrimary }]}
              numberOfLines={3}
            >
              {post.title}
            </Text>
          ) : null}
          {post.contentSnippet ? (
            <Text
              style={[styles.heroSnippet, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {post.contentSnippet}
            </Text>
          ) : null}
        </View>

        <View style={[styles.footer, { borderTopColor: colors.borderPrimary }]}>
          <View style={styles.footerLeft}>
            <View
              style={[
                styles.statPill,
                {
                  backgroundColor: colors.bgTertiary,
                  borderColor: colors.borderPrimary,
                },
              ]}
            >
              <Ionicons
                name="chatbubble-outline"
                size={20}
                color={colors.textTertiary}
              />
              <Text
                style={[styles.commentCount, { color: colors.textTertiary }]}
              >
                {post.commentCount}
              </Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                togglePostLike.mutate({
                  postId: post.id,
                  isLiked: post.isLikedByCurrentUser,
                });
              }}
              style={({ pressed }) => [
                styles.statPill,
                styles.likeButton,
                {
                  backgroundColor: colors.bgTertiary,
                  borderColor: colors.borderPrimary,
                },
                pressed && styles.likePressed,
              ]}
            >
              <Animated.View
                style={[
                  styles.likeIconSwap,
                  { transform: [{ scale: heartScale }] },
                ]}
              >
                <Animated.View
                  style={[
                    styles.likeIconLayer,
                    { opacity: heartOutlineOpacity },
                  ]}
                >
                  <Ionicons
                    name="heart-outline"
                    size={18}
                    color={colors.textTertiary}
                  />
                </Animated.View>
                <Animated.View
                  style={[
                    styles.likeIconLayer,
                    { opacity: heartFilledOpacity },
                  ]}
                >
                  <Ionicons name="heart" size={18} color="#e74c3c" />
                </Animated.View>
              </Animated.View>
              <Text
                style={[styles.commentCount, { color: colors.textTertiary }]}
              >
                {post.likeCount ?? 0}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function BoardFeaturedScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const router = useRouter();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useBoardFeatured(boardId);

  const allPosts = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const heroPost = allPosts[0];
  const gridPosts = allPosts.slice(1, 5);
  const extraPosts = allPosts.slice(5);
  const totalHeroGrid = Math.min(allPosts.length, 5);

  const openPost = useCallback(
    (post: ForumPostPreview) => {
      if (!boardId) return;
      router.push(
        `/boards/${boardId}/posts/${post.id}?channelId=${post.channelId}` as Href,
      );
    },
    [boardId, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: ForumPostPreview }) => (
      <PostPreviewCard
        post={item}
        boardId={boardId ?? ""}
        onPress={() => openPost(item)}
      />
    ),
    [boardId, openPost],
  );

  const listHeader = useMemo(() => {
    if (!heroPost) return null;
    return (
      <>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Posts destacados
        </Text>

        <HeroPost
          post={heroPost}
          boardId={boardId ?? ""}
          styles={styles}
          colors={colors}
          mode={mode}
          onPress={() => openPost(heroPost)}
          bottomRadius={totalHeroGrid === 1 ? 12 : 0}
        />

        {gridPosts.length > 0 ? (
          <>
            {totalHeroGrid === 2 ? (
              <PostPreviewCard
                post={gridPosts[0]}
                boardId={boardId ?? ""}
                onPress={() => openPost(gridPosts[0])}
                style={[styles.gridCardBase, styles.gridCardBottomFull]}
              />
            ) : null}

            {totalHeroGrid === 3 ? (
              <View style={styles.gridRow}>
                <View style={styles.gridCellLeft}>
                  <PostPreviewCard
                    post={gridPosts[0]}
                    boardId={boardId ?? ""}
                    onPress={() => openPost(gridPosts[0])}
                    style={[styles.gridCardBase, styles.gridCardBottomLeft]}
                  />
                </View>
                <View style={styles.gridCellRight}>
                  <PostPreviewCard
                    post={gridPosts[1]}
                    boardId={boardId ?? ""}
                    onPress={() => openPost(gridPosts[1])}
                    style={[styles.gridCardBase, styles.gridCardBottomRight]}
                  />
                </View>
              </View>
            ) : null}

            {totalHeroGrid === 4 ? (
              <>
                <View style={styles.gridRow}>
                  <View style={styles.gridCellLeft}>
                    <PostPreviewCard
                      post={gridPosts[0]}
                      boardId={boardId ?? ""}
                      onPress={() => openPost(gridPosts[0])}
                      style={styles.gridCardBase}
                    />
                  </View>
                  <View style={styles.gridCellRight}>
                    <PostPreviewCard
                      post={gridPosts[1]}
                      boardId={boardId ?? ""}
                      onPress={() => openPost(gridPosts[1])}
                      style={styles.gridCardBase}
                    />
                  </View>
                </View>
                <PostPreviewCard
                  post={gridPosts[2]}
                  boardId={boardId ?? ""}
                  onPress={() => openPost(gridPosts[2])}
                  style={[styles.gridCardBase, styles.gridCardBottomFull]}
                />
              </>
            ) : null}

            {totalHeroGrid >= 5 ? (
              <>
                <View style={styles.gridRow}>
                  <View style={styles.gridCellLeft}>
                    <PostPreviewCard
                      post={gridPosts[0]}
                      boardId={boardId ?? ""}
                      onPress={() => openPost(gridPosts[0])}
                      style={styles.gridCardBase}
                    />
                  </View>
                  <View style={styles.gridCellRight}>
                    <PostPreviewCard
                      post={gridPosts[1]}
                      boardId={boardId ?? ""}
                      onPress={() => openPost(gridPosts[1])}
                      style={styles.gridCardBase}
                    />
                  </View>
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.gridCellLeft}>
                    <PostPreviewCard
                      post={gridPosts[2]}
                      boardId={boardId ?? ""}
                      onPress={() => openPost(gridPosts[2])}
                      style={[styles.gridCardBase, styles.gridCardBottomLeft]}
                    />
                  </View>
                  <View style={styles.gridCellRight}>
                    <PostPreviewCard
                      post={gridPosts[3]}
                      boardId={boardId ?? ""}
                      onPress={() => openPost(gridPosts[3])}
                      style={[styles.gridCardBase, styles.gridCardBottomRight]}
                    />
                  </View>
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {extraPosts.length > 0 ? (
          <Text
            style={[
              styles.sectionTitle,
              styles.moreSectionTitle,
              { color: colors.textSecondary },
            ]}
          >
            Más posts
          </Text>
        ) : null}
      </>
    );
  }, [
    heroPost,
    gridPosts,
    extraPosts.length,
    totalHeroGrid,
    boardId,
    styles,
    colors,
    mode,
    openPost,
  ]);

  if (isLoading && allPosts.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          Cargando destacados...
        </Text>
      </View>
    );
  }

  if (isError && allPosts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
          No se pudieron cargar los destacados
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
      data={extraPosts}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      estimatedItemSize={120}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        allPosts.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
              Sin contenido destacado
            </Text>
            <Text style={[styles.stateText, { color: colors.textMuted }]}>
              Vuelve más tarde o sé el primero en publicar y recibir likes.
            </Text>
          </View>
        ) : null
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
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

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  mode: "dark" | "light",
) {
  return StyleSheet.create({
    listContent: {
      paddingBottom: 32,
    },
    center: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 60,
    },

    // Hero
    hero: {
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderWidth: 1,
      minHeight: 340,
      marginHorizontal: 0,
      marginTop: 0,
      marginBottom: 0,
      overflow: "hidden",
    },
    heroContent: {
      flex: 1,
      paddingHorizontal: 14,
      paddingTop: 16,
      paddingBottom: 14,
    },
    heroPushSpacer: {
      flex: 1,
    },
    heroSnippet: {
      fontSize: 15,
      lineHeight: 22,
    },

    // Shared card styles
    authorRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
    },
    authorMeta: {
      flex: 1,
      minWidth: 0,
    },
    username: {
      fontSize: 15,
      fontWeight: "700",
    },
    authorSubRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 1,
    },
    badge: {
      fontSize: 12,
    },
    separator: {
      fontSize: 12,
    },
    date: {
      fontSize: 12,
    },
    pill: {
      alignItems: "center",
      borderRadius: 999,
      flexDirection: "row",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    pillText: {
      fontSize: 11,
      fontWeight: "600",
    },
    postBody: {
      gap: 6,
    },
    postTitle: {
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 24,
    },
    footer: {
      alignItems: "center",
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 5,
      marginTop: 10,
      paddingTop: 8,
    },
    footerLeft: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    statPill: {
      alignItems: "center",
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    commentCount: {
      fontSize: 16,
    },
    likeButton: {
      minHeight: 32,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    likeIconSwap: {
      alignItems: "center",
      height: 18,
      justifyContent: "center",
      position: "relative",
      width: 18,
    },
    likeIconLayer: {
      alignItems: "center",
      height: 18,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      top: 0,
      width: 18,
    },
    likePressed: {
      opacity: 0.7,
    },

    // Grid
    gridRow: {
      flexDirection: "row",
    },
    gridCellLeft: {
      flex: 1,
    },
    gridCellRight: {
      flex: 1,
    },
    gridCardBase: {
      borderLeftWidth: 0,
      borderRadius: 0,
      borderRightWidth: 0,
      borderTopWidth: 0,
      marginHorizontal: 0,
      marginVertical: 0,
    },
    gridCardBottomLeft: {
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 0,
    },
    gridCardBottomRight: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 12,
    },
    gridCardBottomFull: {
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: 12,
      marginTop: 6,
      lineHeight: 24,
      marginLeft: 8,
    },
    moreSectionTitle: {
      marginTop: 20,
    },

    footerLoader: {
      alignItems: "center",
      paddingVertical: 16,
    },

    // States
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
    pressed: {
      opacity: 0.8,
    },
  });
}
