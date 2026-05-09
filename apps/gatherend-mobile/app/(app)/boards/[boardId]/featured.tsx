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
import { generatePaletteFromBase } from "@/src/theme/utils";
import { useTogglePostLike } from "@/src/features/forum/hooks/use-toggle-post-like";

function normalizeColorToHex(color: string | null): string | null {
  if (!color) return null;
  if (color.startsWith("#")) return color;
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`.toUpperCase();
  }
  return null;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "hace un momento";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} día${days !== 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `hace ${weeks} semana${weeks !== 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months !== 1 ? "es" : ""}`;
}

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

        {/* Spacer: pushes post body to the bottom */}
        <View style={styles.heroPushSpacer} />

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
  position: "first" | "middle" | "last" | "only";
};

function FeaturedChannelCard({
  channel,
  styles,
  colors,
  mode,
  onPress,
  position,
}: FeaturedChannelCardProps) {
  const imageUrl = channel.imageAsset?.url ?? null;
  const rawDominantColor = channel.imageAsset?.dominantColor ?? null;
  const normalizedDominantColor = useMemo(
    () => normalizeColorToHex(rawDominantColor),
    [rawDominantColor],
  );
  const derivedColors = useMemo(() => {
    if (!normalizedDominantColor) return null;
    return generatePaletteFromBase(normalizedDominantColor);
  }, [normalizedDominantColor]);

  const topRadius = position === "first" || position === "only" ? 12 : 0;
  const bottomRadius = position === "last" || position === "only" ? 12 : 0;
  const memberLabel = channel.memberCount === 1 ? "miembro" : "miembros";

  const body = (
    <>
      <View style={styles.channelIconWrap}>
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.channelIconWrapBg,
            imageUrl && derivedColors
              ? { backgroundColor: derivedColors.bgQuaternary }
              : null,
            imageUrl ? styles.channelIconWrapBgDimmed : null,
          ]}
        />
        <Ionicons
          color={colors.textPrimary}
          name={
            channel.type === "VOICE" ? "volume-high" : "chatbubble-ellipses"
          }
          size={22}
        />
      </View>

      <View style={styles.channelCopy}>
        <Text numberOfLines={1} style={styles.channelTitle}>
          /{channel.name}
        </Text>
        {!imageUrl && (
          <View style={styles.channelMembersPill}>
            <Text numberOfLines={1} style={styles.channelMembersPillText}>
              {channel.memberCount} {memberLabel}
            </Text>
          </View>
        )}
        {channel.type === "TEXT" && channel.lastMessageAt ? (
          <Text numberOfLines={1} style={styles.channelActivity}>
            Activo {timeAgo(channel.lastMessageAt)}
          </Text>
        ) : null}
      </View>
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.channelCard,
        {
          backgroundColor: colors.bgTertiary,
          borderColor:
            imageUrl && derivedColors
              ? derivedColors.borderPrimary
              : colors.borderPrimary,
          borderTopLeftRadius: topRadius,
          borderTopRightRadius: topRadius,
          borderBottomLeftRadius: bottomRadius,
          borderBottomRightRadius: bottomRadius,
          borderBottomWidth: position === "last" || position === "only" ? 1 : 0,
        },
        imageUrl ? styles.channelCardWithImage : null,
        pressed && styles.channelCardPressed,
      ]}
    >
      {imageUrl ? (
        <>
          <View style={styles.channelImageSection}>
            <Image
              contentFit="cover"
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.channelImageOverlay]}
            />
            <View
              style={[
                styles.channelImageMembersPill,
                derivedColors
                  ? {
                      backgroundColor: derivedColors.bgQuaternary,
                      borderColor: derivedColors.borderPrimary,
                    }
                  : null,
              ]}
            >
              <Text numberOfLines={1} style={styles.channelMembersPillText}>
                {channel.memberCount} {memberLabel}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.channelFooterSection,
              {
                backgroundColor: derivedColors?.bgTertiary ?? colors.bgTertiary,
              },
            ]}
          >
            <View style={styles.channelFooterBodyRow}>{body}</View>
          </View>
        </>
      ) : (
        body
      )}
    </Pressable>
  );
}

export default function BoardFeaturedScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const router = useRouter();

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useBoardFeatured(boardId);

  const totalPosts = data?.topPosts.length ?? 0;
  const heroPost: ForumPostPreview | undefined = data?.topPosts[0];
  const gridPosts: ForumPostPreview[] = data?.topPosts.slice(1, 5) ?? [];
  const channels: FeaturedChannel[] = data?.topChannels ?? [];

  function openPost(post: ForumPostPreview) {
    if (!boardId) return;
    router.push(
      `/boards/${boardId}/posts/${post.id}?channelId=${post.channelId}` as Href,
    );
  }

  function openChannel(channelId: string) {
    if (!boardId) return;
    router.push(`/boards/${boardId}/chats/${channelId}` as Href);
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
      {/* Hero post */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        Posts destacados
      </Text>
      <HeroPost
        post={heroPost}
        boardId={boardId ?? ""}
        styles={styles}
        colors={colors}
        mode={mode}
        onPress={() => openPost(heroPost.id)}
        bottomRadius={totalPosts === 1 ? 12 : 0}
      />

      {/* Grid: layout depends on total post count */}
      {gridPosts.length > 0 ? (
        <>
          {/* 2 posts: hero + 1 full-width */}
          {totalPosts === 2 ? (
            <PostPreviewCard
              post={gridPosts[0]}
              boardId={boardId ?? ""}
              onPress={() => openPost(gridPosts[0])}
              style={[styles.gridCardBase, styles.gridCardBottomFull]}
            />
          ) : null}

          {/* 3 posts: hero + 2 columns */}
          {totalPosts === 3 ? (
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

          {/* 4 posts: hero + 2 columns + 1 full-width */}
          {totalPosts === 4 ? (
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

          {/* 5+ posts: hero + 2×2 grid */}
          {totalPosts >= 5 ? (
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

      {/* Top channels */}
      {channels.length > 0 ? (
        <View style={styles.channelList}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Chats destacados
          </Text>
          {channels.map((channel, i) => {
            const pos =
              channels.length === 1
                ? "only"
                : i === 0
                  ? "first"
                  : i === channels.length - 1
                    ? "last"
                    : "middle";
            return (
              <FeaturedChannelCard
                key={channel.id}
                channel={channel}
                styles={styles}
                colors={colors}
                mode={mode}
                position={pos}
                onPress={() => openChannel(channel.id)}
              />
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  mode: "dark" | "light",
) {
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
    },
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

    // Channel cards — matches chats tab style
    channelList: {
      paddingTop: 6,
    },
    channelCard: {
      alignItems: "center",
      borderRadius: 0,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      overflow: "hidden",
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    channelCardWithImage: {
      alignItems: "stretch",
      flexDirection: "column",
      gap: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    channelCardPressed: {
      opacity: 0.92,
    },
    channelImageSection: {
      aspectRatio: 16 / 7,
      backgroundColor: colors.bgQuaternary,
      minHeight: 132,
      overflow: "hidden",
      position: "relative",
      width: "100%",
    },
    channelImageOverlay: {
      backgroundColor:
        mode === "light" ? "rgba(240,240,245,0.42)" : "rgba(2, 6, 23, 0.52)",
    },
    channelImageMembersPill: {
      position: "absolute",
      bottom: 10,
      left: 10,
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    channelFooterSection: {
      alignItems: "stretch",
      flexDirection: "column",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    channelFooterBodyRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },
    channelIconWrap: {
      alignItems: "center",
      borderRadius: 14,
      height: 42,
      justifyContent: "center",
      overflow: "hidden",
      width: 42,
    },
    channelIconWrapBg: {
      backgroundColor: colors.bgQuaternary,
    },
    channelIconWrapBgDimmed: {
      opacity: 0.6,
    },
    channelCopy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    channelTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    channelMembersPill: {
      alignSelf: "flex-start",
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    channelMembersPillText: {
      color: colors.textMuted,
      fontSize: 15,
    },
    channelActivity: {
      color: colors.textMuted,
      fontSize: 15,
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
