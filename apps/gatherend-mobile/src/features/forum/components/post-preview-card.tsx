import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import { useTheme } from "@/src/theme/theme-provider";
import { useTogglePostLike } from "../hooks/use-toggle-post-like";
import { PostContent } from "./post-content";
import type { ForumPostPreview } from "../domain/post";
import { Text } from "@/src/components/app-typography";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type PostPreviewCardProps = {
  post: ForumPostPreview;
  boardId: string;
  onPress: () => void;
  style?: ViewStyle;
};

function PostPreviewCardInner({
  post,
  boardId,
  onPress,
  style,
}: PostPreviewCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
        styles.card,
        {
          borderColor: colors.borderPrimary,
          backgroundColor: colors.bgEditForm,
        },
        style,
        pressed && styles.pressed,
      ]}
    >
      {/* Author header */}
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
        {post.imageAsset?.url ? (
          <Image
            contentFit="cover"
            source={{ uri: post.imageAsset.url }}
            style={styles.thumbnail}
          />
        ) : null}
        {post.title ? (
          <Text style={[styles.postTitle, { color: colors.textPrimary }]}>
            {post.title}
          </Text>
        ) : null}
        {post.contentSnippet ? (
          <PostContent content={post.contentSnippet} fontSize={15} />
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
            <Text style={[styles.commentCount, { color: colors.textTertiary }]}>
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
                style={[styles.likeIconLayer, { opacity: heartOutlineOpacity }]}
              >
                <Ionicons
                  name="heart-outline"
                  size={18}
                  color={colors.textTertiary}
                />
              </Animated.View>
              <Animated.View
                style={[styles.likeIconLayer, { opacity: heartFilledOpacity }]}
              >
                <Ionicons name="heart" size={18} color="#e74c3c" />
              </Animated.View>
            </Animated.View>
            <Text style={[styles.commentCount, { color: colors.textTertiary }]}>
              {post.likeCount ?? 0}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export const PostPreviewCard = memo(PostPreviewCardInner);

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      borderRadius: 12,
      borderWidth: 1,
      marginHorizontal: 0,
      marginVertical: 6,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 8,
    },
    pressed: {
      opacity: 0.8,
    },
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
    thumbnail: {
      borderRadius: 8,
      height: 160,
      width: "100%",
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
  });
}
