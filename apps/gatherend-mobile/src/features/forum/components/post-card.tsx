import { Ionicons } from "@expo/vector-icons";
import { memo, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import { useTheme } from "@/src/theme/theme-provider";
import { usePostComments } from "../hooks/use-post-comments";
import { PostCommentItem } from "./post-comment-item";
import { PostContent } from "./post-content";
import { PostImage } from "./post-image";
import { PostInlineCommentInput } from "./post-inline-comment-input";
import type { ForumPost, ForumPostComment } from "../domain/post";
import { Text, TextInput } from "@/src/components/app-typography";

import { isModerator } from "@/src/features/boards/member-role";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type PostCardProps = {
  post: ForumPost;
  currentProfileId: string;
  currentMemberRole: string | null;
  isExpanded: boolean;
  isSubmittingComment: boolean;
  onToggleExpand: (postId: string) => void;
  onCreateComment: (postId: string, content: string) => void;
  onDeletePost: (postId: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
  onEditPost: (postId: string, content: string) => void;
  onEditComment: (postId: string, commentId: string, content: string) => void;
  onReportPost?: (post: ForumPost) => void;
  onReportComment?: (comment: ForumPostComment) => void;
};

function PostCardInner({
  post,
  currentProfileId,
  currentMemberRole,
  isExpanded,
  isSubmittingComment,
  onToggleExpand,
  onCreateComment,
  onDeletePost,
  onDeleteComment,
  onEditPost,
  onEditComment,
  onReportPost,
  onReportComment,
}: PostCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isOwnPost = post.author.id === currentProfileId;
  const canModerate = isModerator(currentMemberRole);
  const canDeletePost = isOwnPost || canModerate;

  // Post edit state
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [postEditDraft, setPostEditDraft] = useState("");

  // Comment edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentEditDraft, setCommentEditDraft] = useState("");

  // Reply state
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(
    null,
  );

  const { data: expandedData, isLoading: isLoadingExpanded } = usePostComments(
    isExpanded ? post.id : null,
  );

  const latestCommentIds = useMemo(
    () => new Set(post.latestComments.map((c) => c.id)),
    [post.latestComments],
  );

  const omittedComments: ForumPostComment[] = useMemo(() => {
    if (!expandedData) return [];
    return expandedData.items.filter((c) => !latestCommentIds.has(c.id));
  }, [expandedData, latestCommentIds]);

  // Display: latest reversed (newest first) + omitted reversed (newest first for older batch)
  const latestDescending = useMemo(
    () => [...post.latestComments].reverse(),
    [post.latestComments],
  );
  const omittedDescending = useMemo(
    () => [...omittedComments].reverse(),
    [omittedComments],
  );
  const commentsToRender = isExpanded
    ? [...latestDescending, ...omittedDescending]
    : latestDescending;

  const omittedCount = Math.max(
    0,
    post.commentCount - post.latestComments.length,
  );

  const handleStartEditPost = () => {
    setPostEditDraft(post.content);
    setIsEditingPost(true);
  };

  const handleSavePost = () => {
    const trimmed = postEditDraft.trim();
    if (!trimmed && !post.imageAsset) return;
    onEditPost(post.id, trimmed);
    setIsEditingPost(false);
  };

  const handleConfirmDeletePost = () => {
    Alert.alert("Eliminar post", "Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => onDeletePost(post.id),
      },
    ]);
  };

  const handleStartEditComment = (commentId: string) => {
    const comment = [
      ...post.latestComments,
      ...(expandedData?.items ?? []),
    ].find((c) => c.id === commentId);
    if (!comment) return;
    setReplyingToCommentId(null);
    setCommentEditDraft(comment.content);
    setEditingCommentId(commentId);
  };

  const handleSaveComment = () => {
    if (!editingCommentId) return;
    const trimmed = commentEditDraft.trim();
    if (!trimmed) return;
    onEditComment(post.id, editingCommentId, trimmed);
    setEditingCommentId(null);
  };

  const handleConfirmDeleteComment = (commentId: string) => {
    Alert.alert("Eliminar comentario", "Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => onDeleteComment(post.id, commentId),
      },
    ]);
  };

  const handleReply = (commentId: string) => {
    setEditingCommentId(null);
    setReplyingToCommentId((prev) => (prev === commentId ? null : commentId));
  };

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.borderPrimary,
          backgroundColor: colors.bgEditForm,
        },
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
      {isEditingPost ? (
        <View style={styles.editForm}>
          <TextInput
            value={postEditDraft}
            onChangeText={setPostEditDraft}
            multiline
            style={[
              styles.editInput,
              {
                borderColor: colors.borderSecondary,
                color: colors.textPrimary,
              },
            ]}
            placeholderTextColor={colors.textTertiary}
            placeholder="Editar post..."
            autoFocus
          />
          <View style={styles.editActions}>
            <Pressable
              onPress={() => setIsEditingPost(false)}
              style={({ pressed }) => [
                styles.editButton,
                styles.editButtonCancel,
                {
                  borderColor: colors.borderPrimary,
                  backgroundColor: colors.bgCancelButton,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.editButtonText, { color: colors.textSubtle }]}
              >
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSavePost}
              style={({ pressed }) => [
                styles.editButton,
                { backgroundColor: colors.tabButtonBg },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.editButtonText, { color: colors.textPrimary }]}
              >
                Guardar
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.postBody}>
          {post.title ? (
            <Text style={[styles.postTitle, { color: colors.textPrimary }]}>
              {post.title}
            </Text>
          ) : null}
          {post.imageAsset?.url ? (
            <PostImage
              imageUrl={post.imageAsset.url}
              imageWidth={post.imageAsset.width}
              imageHeight={post.imageAsset.height}
            />
          ) : null}
          {post.content ? (
            <PostContent content={post.content} fontSize={15} />
          ) : null}
        </View>
      )}

      {/* Action bar */}
      {!isEditingPost && (
        <View style={[styles.actionBar, { borderColor: colors.borderPrimary }]}>
          {isOwnPost && (
            <Pressable
              onPress={handleStartEditPost}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={[styles.actionText, { color: colors.textTertiary }]}>
                Editar
              </Text>
            </Pressable>
          )}
          {isOwnPost && canDeletePost && (
            <Text style={[styles.actionSep, { color: colors.textTertiary }]}>
              |
            </Text>
          )}
          {canDeletePost && (
            <Pressable
              onPress={handleConfirmDeletePost}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={[styles.actionText, { color: colors.textTertiary }]}>
                Eliminar
              </Text>
            </Pressable>
          )}
          {!isOwnPost && onReportPost ? (
            <>
              {canDeletePost ? (
                <Text
                  style={[styles.actionSep, { color: colors.textTertiary }]}
                >
                  |
                </Text>
              ) : null}
              <Pressable
                onPress={() => onReportPost(post)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text
                  style={[styles.actionText, { color: colors.textTertiary }]}
                >
                  Reportar
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      )}

      {/* Inline comment input */}
      <PostInlineCommentInput
        postId={post.id}
        isSubmitting={isSubmittingComment}
        onSubmit={onCreateComment}
      />

      {/* Comments */}
      {commentsToRender.length > 0 || omittedCount > 0 ? (
        <View style={styles.commentsSection}>
          {commentsToRender.map((comment) => (
            <View key={comment.id} style={styles.commentWrapper}>
              <PostCommentItem
                comment={comment}
                currentProfileId={currentProfileId}
                canModerate={canModerate}
                onReply={post.lockedAt ? undefined : handleReply}
                onEdit={
                  comment.author.id === currentProfileId && !comment.deleted
                    ? handleStartEditComment
                    : undefined
                }
                onDelete={
                  (comment.author.id === currentProfileId || canModerate) &&
                  !comment.deleted
                    ? handleConfirmDeleteComment
                    : undefined
                }
                onReport={
                  comment.author.id !== currentProfileId &&
                  !comment.deleted &&
                  onReportComment
                    ? () => onReportComment(comment)
                    : undefined
                }
                editingContent={
                  editingCommentId === comment.id ? commentEditDraft : null
                }
                onEditContentChange={setCommentEditDraft}
                onEditSave={handleSaveComment}
                onEditCancel={() => setEditingCommentId(null)}
                isSavingEdit={false}
              />

              {/* Reply composer */}
              {replyingToCommentId === comment.id && !post.lockedAt && (
                <View
                  style={[
                    styles.replyComposer,
                    { borderLeftColor: colors.borderPrimary },
                  ]}
                >
                  <PostInlineCommentInput
                    postId={post.id}
                    isSubmitting={isSubmittingComment}
                    onSubmit={(postId, content) => {
                      onCreateComment(postId, content);
                      setReplyingToCommentId(null);
                    }}
                  />
                </View>
              )}
            </View>
          ))}

          {omittedCount > 0 && (
            <View
              style={[
                styles.omittedRow,
                { borderTopColor: colors.borderPrimary },
              ]}
            >
              <Pressable
                onPress={() => onToggleExpand(post.id)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text
                  style={[styles.omittedText, { color: colors.textTertiary }]}
                >
                  {isLoadingExpanded && isExpanded
                    ? "Cargando comentarios..."
                    : isExpanded
                      ? "Ocultar comentarios"
                      : `Ver ${omittedCount} comentario${omittedCount === 1 ? "" : "s"} más`}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

export const PostCard = memo(PostCardInner);

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
      gap: 4,
    },
    postTitle: {
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 24,
      marginBottom: 2,
    },
    actionBar: {
      alignItems: "center",
      borderBottomWidth: 1,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 10,
      marginTop: 10,
      paddingVertical: 8,
    },
    actionText: {
      fontSize: 13,
    },
    actionSep: {
      fontSize: 13,
    },
    commentsSection: {
      gap: 10,
      marginTop: 12,
    },
    commentWrapper: {
      gap: 6,
    },
    replyComposer: {
      borderLeftWidth: 2,
      marginLeft: 18,
      paddingLeft: 10,
    },
    omittedRow: {
      borderTopWidth: 1,
      paddingTop: 8,
    },
    omittedText: {
      fontSize: 13,
      textAlign: "center",
    },
    editForm: {
      gap: 8,
      marginVertical: 4,
    },
    editInput: {
      borderRadius: 8,
      borderWidth: 1,
      fontSize: 14,
      lineHeight: 21,
      minHeight: 88,
      paddingHorizontal: 12,
      paddingVertical: 8,
      textAlignVertical: "top",
    },
    editActions: {
      flexDirection: "row",
      gap: 8,
    },
    editButton: {
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    editButtonCancel: {
      borderWidth: 1,
    },
    editButtonDisabled: {
      opacity: 0.5,
    },
    editButtonText: {
      fontSize: 13,
      fontWeight: "600",
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
