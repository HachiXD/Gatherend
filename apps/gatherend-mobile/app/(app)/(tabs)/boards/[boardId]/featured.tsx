import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
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

type HeroPostProps = {
  post: ForumPostPreview;
  boardId: string;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
  mode: "dark" | "light";
  onPress: () => void;
};

function HeroPost({ post, boardId, styles, colors, mode, onPress }: HeroPostProps) {
  const hasImage = !!post.imageAsset?.url;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
    >
      {hasImage ? (
        <>
          <Image
            contentFit="cover"
            source={{ uri: post.imageAsset!.url }}
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
        <View style={styles.heroAuthorRow}>
          <UserAvatar
            avatarUrl={post.author.avatarAsset?.url}
            username={post.author.username}
            size={28}
          />
          <Text style={[styles.heroAuthor, { color: colors.textPrimary }]} numberOfLines={1}>
            {post.author.username}
          </Text>
          {post.pinnedAt ? (
            <View style={[styles.heroPill, { backgroundColor: colors.bgTertiary }]}>
              <Ionicons name="pin" size={9} color={colors.textSubtle} />
            </View>
          ) : null}
          {post.lockedAt ? (
            <View style={[styles.heroPill, { backgroundColor: colors.bgTertiary }]}>
              <Ionicons name="lock-closed" size={9} color={colors.textSubtle} />
            </View>
          ) : null}
        </View>

        {post.title ? (
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]} numberOfLines={3}>
            {post.title}
          </Text>
        ) : null}

        {post.contentSnippet ? (
          <Text style={[styles.heroSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
            {post.contentSnippet}
          </Text>
        ) : null}

        <View style={[styles.heroFooter, { borderTopColor: colors.borderPrimary }]}>
          <Ionicons name="chatbubble-outline" size={13} color={colors.textTertiary} />
          <Text style={[styles.heroMeta, { color: colors.textTertiary }]}>
            {post.commentCount}
          </Text>
          <View style={{ flex: 1 }} />
          <Ionicons
            name={post.isLikedByCurrentUser ? "heart" : "heart-outline"}
            size={13}
            color={post.isLikedByCurrentUser ? "#e74c3c" : colors.textTertiary}
          />
          {post.likeCount > 0 ? (
            <Text style={[styles.heroMeta, { color: colors.textTertiary }]}>
              {post.likeCount}
            </Text>
          ) : null}
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

function FeaturedChannelCard({ channel, styles, colors, mode, onPress }: FeaturedChannelCardProps) {
  const imageUrl = channel.imageAsset?.url ?? null;
  const memberLabel = channel.memberCount === 1 ? "miembro" : "miembros";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.channelCard,
        { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary },
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
          name={channel.type === "VOICE" ? "volume-high" : "chatbubble-ellipses"}
          size={18}
        />
      </View>

      <View style={styles.channelCopy}>
        <Text numberOfLines={1} style={[styles.channelName, { color: colors.textPrimary }]}>
          /{channel.name}
        </Text>
        <Text numberOfLines={1} style={[styles.channelMeta, { color: colors.textMuted }]}>
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
      backgroundColor: colors.bgEditForm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderPrimary,
      minHeight: 200,
      overflow: "hidden",
    },
    heroContent: {
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    heroAuthorRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginBottom: 4,
    },
    heroAuthor: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      minWidth: 0,
    },
    heroPill: {
      alignItems: "center",
      borderRadius: 999,
      height: 18,
      justifyContent: "center",
      width: 18,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: "800",
      lineHeight: 26,
    },
    heroSnippet: {
      fontSize: 14,
      lineHeight: 20,
    },
    heroFooter: {
      alignItems: "center",
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 5,
      marginTop: 8,
      paddingTop: 8,
    },
    heroMeta: {
      fontSize: 13,
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
