import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UserAvatar } from "@/src/components/user-avatar";
import { useTheme } from "@/src/theme/theme-provider";
import { useToggleCommentLike } from "../hooks/use-toggle-comment-like";
import { PostContent } from "./post-content";
import type { ForumPostComment } from "../domain/post";
import { Text, TextInput } from "@/src/components/app-typography";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getReplyLabel(comment: ForumPostComment): string {
  if (!comment.replyToCommentId || !comment.replyToComment) {
    return "OP";
  }
  if (comment.replyToComment.deleted) {
    return `${comment.replyToComment.author.username}: [eliminado]`;
  }
  const preview = comment.replyToComment.content.slice(0, 20);
  const suffix = comment.replyToComment.content.length > 20 ? "..." : "";
  return `${comment.replyToComment.author.username}: ${preview}${suffix}`;
}

type PostCommentItemProps = {
  comment: ForumPostComment;
  currentProfileId: string;
  canModerate: boolean;
  onReply?: (commentId: string) => void;
  onEdit?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onReport?: () => void;
  editingContent?: string | null;
  onEditContentChange?: (text: string) => void;
  onEditSave?: () => void;
  onEditCancel?: () => void;
  isSavingEdit?: boolean;
};

export function PostCommentItem({
  comment,
  currentProfileId,
  canModerate,
  onReply,
  onEdit,
  onDelete,
  editingContent,
  onEditContentChange,
  onEditSave,
  onEditCancel,
  isSavingEdit,
  onReport,
}: PostCommentItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isOwnComment = comment.author.id === currentProfileId;
  const isEditing = editingContent !== null && editingContent !== undefined;
  const trimmedDraft = editingContent?.trim() ?? "";
  const canSaveEdit = trimmedDraft.length > 0 || !!comment.imageAsset;

  const toggleCommentLike = useToggleCommentLike(comment.postId);

  return (
    <View style={styles.container}>
      <UserAvatar
        avatarUrl={comment.author.avatarAsset?.url}
        username={comment.author.username}
        size={28}
      />

      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.username} numberOfLines={1}>
            {comment.author.username}
          </Text>
          {comment.author.badge ? (
            <Text style={styles.badge}>{comment.author.badge}</Text>
          ) : null}
          <Text style={styles.date}>{formatDate(comment.createdAt)}</Text>
          {comment.replyToCommentId ? (
            <Text style={styles.replyingTo} numberOfLines={1}>
              · respondiendo a {getReplyLabel(comment)}
            </Text>
          ) : null}
        </View>

        {isEditing ? (
          <View style={styles.editForm}>
            <TextInput
              value={editingContent}
              onChangeText={onEditContentChange}
              multiline
              style={[
                styles.editInput,
                { borderColor: colors.borderSecondary },
              ]}
              placeholderTextColor={colors.textTertiary}
              placeholder="Editar comentario..."
              editable={!isSavingEdit}
              autoFocus
            />
            <View style={styles.editActions}>
              <Pressable
                onPress={onEditCancel}
                disabled={isSavingEdit}
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
                onPress={onEditSave}
                disabled={isSavingEdit || !canSaveEdit}
                style={({ pressed }) => [
                  styles.editButton,
                  { backgroundColor: colors.tabButtonBg },
                  (isSavingEdit || !canSaveEdit) && styles.editButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.editButtonText, { color: colors.textPrimary }]}
                >
                  {isSavingEdit ? "Guardando..." : "Guardar"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {comment.imageAsset?.url ? (
              <Image
                source={{ uri: comment.imageAsset.url }}
                contentFit="contain"
                style={styles.commentImage}
              />
            ) : null}

            {comment.deleted ? (
              <Text
                style={[styles.deletedText, { color: colors.textTertiary }]}
              >
                [Comentario eliminado]
              </Text>
            ) : (
              <PostContent content={comment.content} fontSize={14} />
            )}

            {!comment.deleted && (
              <View style={styles.actions}>
                {onReply && (
                  <Pressable
                    onPress={() => onReply(comment.id)}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        { color: colors.textTertiary },
                      ]}
                    >
                      Responder
                    </Text>
                  </Pressable>
                )}
                {isOwnComment && onEdit && (
                  <Pressable
                    onPress={() => onEdit(comment.id)}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        { color: colors.textTertiary },
                      ]}
                    >
                      Editar
                    </Text>
                  </Pressable>
                )}
                {(isOwnComment || canModerate) && onDelete && (
                  <Pressable
                    onPress={() => onDelete(comment.id)}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        { color: colors.textTertiary },
                      ]}
                    >
                      Eliminar
                    </Text>
                  </Pressable>
                )}
                {!isOwnComment && onReport ? (
                  <Pressable
                    onPress={onReport}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        { color: colors.textTertiary },
                      ]}
                    >
                      Reportar
                    </Text>
                  </Pressable>
                ) : null}
                <View style={styles.likeButtonWrapper}>
                  <Pressable
                    onPress={() =>
                      toggleCommentLike.mutate({
                        commentId: comment.id,
                        isLiked: comment.isLikedByCurrentUser,
                      })
                    }
                    style={({ pressed }) => [styles.likeButton, pressed && styles.pressed]}
                  >
                    <Ionicons
                      name={comment.isLikedByCurrentUser ? "heart" : "heart-outline"}
                      size={13}
                      color={comment.isLikedByCurrentUser ? "#e74c3c" : colors.textTertiary}
                    />
                    {comment.likeCount > 0 ? (
                      <Text style={[styles.actionText, { color: colors.textTertiary }]}>
                        {comment.likeCount}
                      </Text>
                    ) : null}
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    header: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "baseline",
      gap: 4,
      marginBottom: 2,
    },
    username: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    badge: {
      color: colors.textTertiary,
      fontSize: 11,
    },
    date: {
      color: colors.textTertiary,
      fontSize: 11,
    },
    replyingTo: {
      color: colors.textTertiary,
      fontSize: 11,
      flexShrink: 1,
    },
    commentImage: {
      borderRadius: 6,
      height: 96,
      marginBottom: 4,
      width: 96,
    },
    deletedText: {
      fontSize: 13,
      fontStyle: "italic",
    },
    actions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 4,
      alignItems: "center",
    },
    likeButtonWrapper: {
      flex: 1,
      alignItems: "flex-end",
    },
    likeButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: 3,
    },
    actionText: {
      fontSize: 12,
    },
    editForm: {
      gap: 6,
      marginTop: 4,
    },
    editInput: {
      borderRadius: 8,
      borderWidth: 1,
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 20,
      minHeight: 72,
      paddingHorizontal: 10,
      paddingVertical: 8,
      textAlignVertical: "top",
    },
    editActions: {
      flexDirection: "row",
      gap: 8,
    },
    editButton: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    editButtonCancel: {
      borderWidth: 1,
    },
    editButtonDisabled: {
      opacity: 0.5,
    },
    editButtonText: {
      fontSize: 12,
      fontWeight: "600",
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
