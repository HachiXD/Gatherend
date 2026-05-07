import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/src/components/app-typography";
import { UserAvatar } from "@/src/components/user-avatar";
import { PostPreviewCard } from "@/src/features/forum/components/post-preview-card";
import type { ForumPostPreview } from "@/src/features/forum/domain/post";
import { useBoardFeatured } from "@/src/features/featured/hooks/use-board-featured";
import type { FeaturedChannel } from "@/src/features/featured/domain/featured";
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
};

function HeroPost({
  post,
  boardId,
  styles,
  colors,
  mode,
  onPress,
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
        {/* Author row */}
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

        {/* Post body */}
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

        {/* Footer */}
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

type FeaturedChannelCardProps = {
  channel: FeaturedChannel;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
  mode: "dark" | "light";
  onPress: () => void;
};

function FeaturedChannelCard({
  channel,
  styles,
  colors,
  mode,
  onPress,
}: FeaturedChannelCardProps) {
  const imageUrl = channel.imageAsset?.url ?? null;
  const memberLabel = channel.memberCount === 1 ? "miembro" : "miembros";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.channelCard,
        {
          backgroundColor: colors.bgTertiary,
          borderColor: colors.borderPrimary,
        },
        imageUrl ? styles.channelCardWithImage : null,
        pressed && styles.channelCardPressed,
      ]}
    >
      {imageUrl ? (
        <>
          <Image
            contentFit="cover"
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  mode === "light"
                    ? "rgba(240,240,245,0.42)"
                    : "rgba(2,6,23,0.52)",
              },
            ]}
          />
        </>
      ) : null}

      <View style={styles.channelIconWrap}>
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.channelIconBg,
            { backgroundColor: colors.bgQuaternary },
            imageUrl ? styles.channelIconBgDimmed : null,
          ]}
        />
        <Ionicons
          color={colors.textPrimary}
          name={
            channel.type === "VOICE" ? "volume-high" : "chatbubble-ellipses"
          }
          size={18}
        />
      </View>

      <View style={styles.channelCopy}>
        <Text
          numberOfLines={1}
          style={[styles.channelName, { color: colors.textPrimary }]}
        >
          /{channel.name}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.channelMeta, { color: colors.textMuted }]}
        >
          {channel.memberCount} {memberLabel}
        </Text>
      </View>
    </Pressable>
  );
}

export default function BoardFeaturedScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useBoardFeatured(boardId);

  const heroPost: ForumPostPreview | undefined = data?.topPosts[0];
  const gridPosts: ForumPostPreview[] = data?.topPosts.slice(1) ?? [];
  const channels: FeaturedChannel[] = data?.topChannels ?? [];

  function openPost(postId: string) {
    if (!boardId) return;
    router.push(`/(app)/boards/${boardId}/posts/${postId}` as Href);
  }

  function openChannel(channelId: string) {
    if (!boardId) return;
    router.push(`/(app)/(tabs)/boards/${boardId}/chats/${channelId}` as Href);
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          Cargando destacados...
        </Text>
      </View>
    );
  }

  if (isError) {
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

  if (!heroPost) {
    return (
      <View style={styles.center}>
        <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
          Sin contenido destacado
        </Text>
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          Vuelve más tarde o sé el primero en publicar y recibir likes.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.accentPrimary}
        />
      }
    >
      {/* Hero post — full width, bg image if available */}
      <HeroPost
        post={heroPost}
        boardId={boardId ?? ""}
        styles={styles}
        colors={colors}
        mode={mode}
        onPress={() => openPost(heroPost.id)}
      />

      {/* Grid — 2×2, no padding */}
      {gridPosts.length > 0 ? (
        <View style={styles.grid}>
          {gridPosts.slice(0, 4).map((post) => (
            <View key={post.id} style={styles.gridCell}>
              <PostPreviewCard
                post={post}
                boardId={boardId ?? ""}
                onPress={() => openPost(post.id)}
                style={styles.gridCard}
              />
            </View>
          ))}
        </View>
      ) : null}

      {/* Top channels — identical to chats tab */}
      {channels.length > 0 ? (
        <View style={styles.channelList}>
          {channels.map((channel) => (
            <FeaturedChannelCard
              key={channel.id}
              channel={channel}
              styles={styles}
              colors={colors}
              mode={mode}
              onPress={() => openChannel(channel.id)}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    scrollContent: {
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
      borderRadius: 12,
      borderWidth: 1,
      marginHorizontal: 0,
      marginTop: 12,
      marginBottom: 6,
      overflow: "hidden",
    },
    heroContent: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 8,
    },
    heroSnippet: {
      fontSize: 15,
      lineHeight: 22,
    },

    // Shared card styles (author row, body, footer)
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
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    gridCell: {
      width: "50%",
    },
    gridCard: {
      borderLeftWidth: 0,
      borderRadius: 0,
      borderRightWidth: 0,
      borderTopWidth: 0,
      marginHorizontal: 0,
      marginVertical: 0,
    },

    // Channel cards — identical to chats tab
    channelList: {
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    channelCard: {
      alignItems: "center",
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      overflow: "hidden",
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    channelCardWithImage: {
      minHeight: 88,
    },
    channelCardPressed: {
      opacity: 0.92,
    },
    channelIconWrap: {
      alignItems: "center",
      borderRadius: 14,
      height: 42,
      justifyContent: "center",
      overflow: "hidden",
      width: 42,
    },
    channelIconBg: {
      borderRadius: 14,
    },
    channelIconBgDimmed: {
      opacity: 0.6,
    },
    channelCopy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    channelName: {
      fontSize: 15,
      fontWeight: "700",
    },
    channelMeta: {
      fontSize: 13,
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
