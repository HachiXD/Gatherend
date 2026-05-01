import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { Text, TextInput } from "@/src/components/app-typography";
import { useMessageActions } from "../hooks/use-message-actions";
import { getMessageOwnerProfileId } from "../utils/message-author";
import { useTheme } from "@/src/theme/theme-provider";
import type { ChatMessage } from "../chat-message";
import type { ChannelMessage, ChatReaction } from "../types";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "💀", "😭", "🤑"] as const;
const MOD_ROLES = new Set(["OWNER", "ADMIN", "MODERATOR"]);

type MessageActionsSheetProps = {
  message: ChatMessage | null;
  currentProfileId: string;
  currentMemberRole: string | null;
  windowKey: string;
  boardId: string;
  channelId: string;
  visible: boolean;
  onClose: () => void;
  onReply: (message: ChatMessage) => void;
  onReport?: (message: ChatMessage) => void;
};

export function MessageActionsSheet({
  message,
  currentProfileId,
  currentMemberRole,
  windowKey,
  boardId,
  channelId,
  visible,
  onClose,
  onReply,
  onReport,
}: MessageActionsSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");

  const actions = useMessageActions({
    windowKey,
    boardId,
    channelId,
    profileId: currentProfileId,
  });

  const isMod = MOD_ROLES.has(currentMemberRole ?? "");
  const ownerId = message ? getMessageOwnerProfileId(message) : null;
  const isOwn = ownerId === currentProfileId;
  const isDeleted = !!(message as ChannelMessage | null)?.deleted;
  const hasSticker = !!(message as ChannelMessage | null)?.sticker;
  const hasAttachment = !!(message as ChannelMessage | null)?.attachmentAsset;
  const canReact = !!message && !isDeleted;
  const canReply = !!message && !isDeleted;
  const canEdit = isOwn && !isDeleted && !hasSticker && !hasAttachment;
  const canDelete = (isOwn || isMod) && !isDeleted;
  const canReport = !isOwn && !isDeleted;

  const handleReactionPress = (emoji: string) => {
    if (!message) return;
    const reactions = (message as ChannelMessage).reactions ?? [];
    const myReaction = reactions.find(
      (r: ChatReaction) => r.profileId === currentProfileId && r.emoji === emoji,
    );
    if (myReaction) {
      actions.removeReaction.mutate({
        reactionId: myReaction.id,
        messageId: message.id,
      });
    } else {
      actions.addReaction.mutate({ messageId: message.id, emoji });
    }
    onClose();
  };

  const handleEditPress = () => {
    if (!message) return;
    setEditDraft((message as ChannelMessage).content ?? "");
    setIsEditing(true);
  };

  const handleEditSave = () => {
    if (!message || !editDraft.trim()) return;
    actions.editMessage.mutate({
      messageId: message.id,
      content: editDraft.trim(),
    });
    setIsEditing(false);
    onClose();
  };

  const handleDeletePress = () => {
    if (!message) return;
    Alert.alert(
      "Eliminar mensaje",
      "Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            actions.deleteMessage.mutate({ messageId: message.id });
            onClose();
          },
        },
      ],
    );
  };

  const handleReplyPress = () => {
    if (!message) return;
    onReply(message);
    onClose();
  };

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  const reactions = (message as ChannelMessage | null)?.reactions ?? [];

  return (
    <BottomSheet maxHeight={520} onClose={handleClose} visible={visible}>
      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Emoji reaction row */}
        {canReact && !isEditing ? (
          <View style={styles.emojiRow}>
            {REACTION_EMOJIS.map((emoji) => {
              const myReaction = reactions.find(
                (r: ChatReaction) =>
                  r.profileId === currentProfileId && r.emoji === emoji,
              );
              const isActive = !!myReaction;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => handleReactionPress(emoji)}
                  style={({ pressed }) => [
                    styles.emojiButton,
                    isActive
                      ? {
                          backgroundColor: colors.reactionActiveBg,
                          borderColor: colors.reactionActiveBorder,
                        }
                      : {
                          backgroundColor: colors.bgTertiary,
                          borderColor: colors.borderPrimary,
                        },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Edit form */}
        {isEditing ? (
          <View style={styles.editForm}>
            <TextInput
              autoFocus
              maxLength={2000}
              multiline
              onChangeText={setEditDraft}
              placeholder="Editar mensaje..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.editInput,
                {
                  borderColor: colors.borderPrimary,
                  color: colors.textPrimary,
                },
              ]}
              textAlignVertical="top"
              value={editDraft}
            />
            <View style={styles.editActions}>
              <Pressable
                onPress={() => setIsEditing(false)}
                style={({ pressed }) => [
                  styles.editCancelButton,
                  {
                    backgroundColor: colors.bgTertiary,
                    borderColor: colors.borderPrimary,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.editButtonText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                disabled={!editDraft.trim()}
                onPress={handleEditSave}
                style={({ pressed }) => [
                  styles.editSaveButton,
                  { backgroundColor: colors.textPrimary },
                  !editDraft.trim() && styles.disabled,
                  pressed && editDraft.trim() ? styles.pressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.editButtonText,
                    { color: colors.bgPrimary },
                  ]}
                >
                  Guardar
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Action list */
          <View style={styles.actionList}>
            {canReply ? (
              <ActionRow
                icon="arrow-undo-outline"
                label="Responder"
                onPress={handleReplyPress}
              />
            ) : null}

            {canEdit ? (
              <ActionRow
                icon="pencil-outline"
                label="Editar"
                onPress={handleEditPress}
              />
            ) : null}

            {canReport && onReport ? (
              <ActionRow
                icon="flag-outline"
                label="Reportar"
                onPress={() => {
                  if (message) onReport(message);
                  onClose();
                }}
              />
            ) : null}

            {canDelete ? (
              <ActionRow
                destructive
                icon="trash-outline"
                label="Eliminar"
                onPress={handleDeletePress}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const color = destructive ? "#f87171" : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        actionRowStyles.row,
        { borderBottomColor: colors.borderPrimary },
        pressed && actionRowStyles.pressed,
      ]}
    >
      <Ionicons color={color} name={icon as never} size={20} />
      <Text style={[actionRowStyles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const actionRowStyles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
});

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    emojiRow: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 12,
    },
    emojiButton: {
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    emojiText: {
      fontSize: 22,
    },
    actionList: {
      paddingBottom: 4,
    },
    editForm: {
      gap: 12,
      padding: 16,
    },
    editInput: {
      backgroundColor: colors.bgInput,
      borderRadius: 12,
      borderWidth: 1,
      fontSize: 15,
      minHeight: 100,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    editActions: {
      flexDirection: "row",
      gap: 10,
    },
    editCancelButton: {
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 46,
    },
    editSaveButton: {
      alignItems: "center",
      borderRadius: 12,
      flex: 1,
      justifyContent: "center",
      minHeight: 46,
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: "700",
    },
    disabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
