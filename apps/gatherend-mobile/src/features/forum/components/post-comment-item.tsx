import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "@/src/components/bottom-sheet";
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
  const [sheetVisible, setSheetVisible] = useState(false);
  const isEditing = editingContent !== null && editingContent !== undefined;
  const trimmedDraft = editingContent?.trim() ?? "";
  const canSaveEdit = trimmedDraft.length > 0 || !!comment.imageAsset;

  const toggleCommentLike = useToggleCommentLike(comment.postId);

  // Animated like heart (same pattern as post card, smaller)
  const likeAnim = useRef(
    new Animated.Value(comment.isLikedByCurrentUser ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(likeAnim, {
      toValue: comment.isLikedByCurrentUser ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [likeAnim, comment.isLikedByCurrentUser]);

  const heartOutlineOpacity = likeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const heartFilledOpacity = likeAnim;
  const heartScale = likeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const hasActions =
    Boolean(onReply) ||
    (isOwnComment && Boolean(onEdit)) ||
    ((isOwnComment || canModerate) && Boolean(onDelete)) ||
    (!isOwnComment && Boolean(onReport));

  const canDeleteAction = (isOwnComment || canModerate) && Boolean(onDelete);
  const canReportAction = !isOwnComment && Boolean(onReport);
  const hasMenuActions = canDeleteAction || canReportAction;

  const handleToggleLike = () => {
    if (toggleCommentLike.isPending) {
      return;
    }

    toggleCommentLike.mutate({
      commentId: comment.id,
      isLiked: comment.isLikedByCurrentUser,
    });
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.avatarColumn}>
          <UserAvatar
            avatarUrl={comment.author.avatarAsset?.url}
            username={comment.author.username}
            size={28}
          />
          <View
            style={[
              styles.avatarConnector,
              { backgroundColor: colors.borderPrimary },
            ]}
          />
        </View>

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
                    style={[
                      styles.editButtonText,
                      { color: colors.textSubtle },
                    ]}
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
                    style={[
                      styles.editButtonText,
                      { color: colors.textPrimary },
                    ]}
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
                  {hasActions ? (
                    <View style={styles.actionGroup}>
                      {hasMenuActions ? (
                        <Pressable
                          onPress={() => setSheetVisible(true)}
                          style={({ pressed }) => [
                            styles.actionButton,
                            styles.actionMenuButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Ionicons
                            color={colors.textTertiary}
                            name="ellipsis-vertical"
                            size={15}
                          />
                        </Pressable>
                      ) : null}

                      {onReply ? (
                        <Pressable
                          onPress={() => onReply(comment.id)}
                          style={({ pressed }) => [
                            styles.actionButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={styles.actionLabelGroup}>
                            <Ionicons
                              color={colors.textTertiary}
                              name="chatbubble-outline"
                              size={14}
                            />
                            <Text
                              style={[
                                styles.actionText,
                                { color: colors.textTertiary },
                              ]}
                            >
                              Responder
                            </Text>
                          </View>
                        </Pressable>
                      ) : null}

                      {isOwnComment && onEdit ? (
                        <Pressable
                          onPress={() => onEdit(comment.id)}
                          style={({ pressed }) => [
                            styles.actionButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={styles.actionLabelGroup}>
                            <Ionicons
                              color={colors.textTertiary}
                              name="create-outline"
                              size={14}
                            />
                            <Text
                              style={[
                                styles.actionText,
                                { color: colors.textTertiary },
                              ]}
                            >
                              Editar
                            </Text>
                          </View>
                        </Pressable>
                      ) : null}

                      {/* Like button in same right-aligned group */}
                      <Pressable
                        disabled={toggleCommentLike.isPending}
                        onPress={handleToggleLike}
                        style={({ pressed }) => [
                          styles.likeButton,
                          toggleCommentLike.isPending && styles.disabledButton,
                          pressed && styles.pressed,
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
                              styles.heartIconLayer,
                              { opacity: heartOutlineOpacity },
                            ]}
                          >
                            <Ionicons
                              name="heart-outline"
                              size={15}
                              color={colors.textTertiary}
                            />
                          </Animated.View>
                          <Animated.View
                            style={[
                              styles.heartIconLayer,
                              { opacity: heartFilledOpacity },
                            ]}
                          >
                            <Ionicons name="heart" size={15} color="#e74c3c" />
                          </Animated.View>
                        </Animated.View>
                        <Text
                          style={[
                            styles.likeCount,
                            {
                              color: comment.isLikedByCurrentUser
                                ? "#e74c3c"
                                : colors.textTertiary,
                            },
                          ]}
                        >
                          {comment.likeCount ?? 0}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )}
            </>
          )}
        </View>
      </View>
      <BottomSheet
        maxHeight={220}
        onClose={() => setSheetVisible(false)}
        visible={sheetVisible}
      >
        <View style={styles.sheetActionList}>
          {canDeleteAction && onDelete ? (
            <Pressable
              onPress={() => {
                setSheetVisible(false);
                onDelete(comment.id);
              }}
              style={({ pressed }) => [
                styles.sheetActionRow,
                { borderBottomColor: colors.borderPrimary },
                pressed && styles.sheetActionRowPressed,
              ]}
            >
              <Ionicons color="#f87171" name="trash-outline" size={20} />
              <Text style={styles.sheetDeleteLabel}>Eliminar comentario</Text>
            </Pressable>
          ) : null}
          {canReportAction && onReport ? (
            <Pressable
              onPress={() => {
                setSheetVisible(false);
                onReport();
              }}
              style={({ pressed }) => [
                styles.sheetActionRow,
                { borderBottomColor: colors.borderPrimary },
                pressed && styles.sheetActionRowPressed,
              ]}
            >
              <Ionicons color="#f59e0b" name="flag-outline" size={20} />
              <Text style={styles.sheetReportLabel}>Reportar comentario</Text>
            </Pressable>
          ) : null}
        </View>
      </BottomSheet>
    </>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 8,
    },
    avatarColumn: {
      alignItems: "center",
      alignSelf: "stretch",
      width: 28,
    },
    avatarConnector: {
      borderRadius: 999,
      flex: 1,
      marginTop: 6,
      width: 2,
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
      gap: 10,
      marginTop: 8,

      alignItems: "center",
      justifyContent: "flex-end",
    },
    likeButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
    },
    likeIconSwap: {
      alignItems: "center",
      height: 18,
      justifyContent: "center",
      position: "relative",
      width: 18,
    },
    heartIconLayer: {
      alignItems: "center",
      height: 18,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      top: 0,
      width: 18,
    },
    likeCount: {
      fontSize: 11,
      fontWeight: "600",
    },
    actionGroup: {
      alignItems: "center",
      flexDirection: "row",
      gap: 18,
      justifyContent: "flex-end",
    },
    actionButton: {
      alignItems: "center",
      flexDirection: "row",
    },
    actionLabelGroup: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
    },
    actionMenuButton: {
      justifyContent: "center",
    },
    actionText: {
      fontSize: 13,
    },
    sheetActionList: {
      paddingBottom: 4,
    },
    sheetActionRow: {
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 15,
    },
    sheetActionRowPressed: {
      opacity: 0.7,
    },
    sheetDeleteLabel: {
      color: "#f87171",
      fontSize: 15,
      fontWeight: "600",
    },
    sheetReportLabel: {
      color: "#f59e0b",
      fontSize: 15,
      fontWeight: "600",
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
    disabledButton: {
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
