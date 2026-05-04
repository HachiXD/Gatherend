import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import { useTheme } from "@/src/theme/theme-provider";
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
  onPress: () => void;
};

function PostPreviewCardInner({ post, onPress }: PostPreviewCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: colors.borderPrimary, backgroundColor: colors.bgEditForm },
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
          <Text style={[styles.username, { color: colors.textPrimary }]} numberOfLines={1}>
            {post.author.username}
          </Text>
          <View style={styles.authorSubRow}>
            {post.author.badge ? (
              <>
                <Text style={[styles.badge, { color: colors.textTertiary }]}>
                  {post.author.badge}
                </Text>
                <Text style={[styles.separator, { color: colors.textTertiary }]}>|</Text>
              </>
            ) : null}
            <Text style={[styles.date, { color: colors.textTertiary }]}>
              {formatDate(post.createdAt)}
            </Text>
            {post.pinnedAt ? (
              <View style={[styles.pill, { backgroundColor: colors.bgTertiary }]}>
                <Ionicons name="pin" size={10} color={colors.textSubtle} />
                <Text style={[styles.pillText, { color: colors.textSubtle }]}>Fijado</Text>
              </View>
            ) : null}
            {post.lockedAt ? (
              <View style={[styles.pill, { backgroundColor: colors.bgTertiary }]}>
                <Ionicons name="lock-closed" size={10} color={colors.textSubtle} />
                <Text style={[styles.pillText, { color: colors.textSubtle }]}>Cerrado</Text>
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
        <Ionicons name="chatbubble-outline" size={14} color={colors.textTertiary} />
        <Text style={[styles.commentCount, { color: colors.textTertiary }]}>
          {post.commentCount}
        </Text>
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
      marginHorizontal: 12,
      marginVertical: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
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
    commentCount: {
      fontSize: 13,
    },
  });
}
