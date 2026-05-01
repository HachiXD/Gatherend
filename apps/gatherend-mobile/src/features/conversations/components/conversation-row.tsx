import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import { useTheme } from "@/src/theme/theme-provider";
import type { Conversation } from "../domain/conversation";
import { Text } from "@/src/components/app-typography";

type ConversationRowProps = {
  conversation: Conversation;
  isHiding?: boolean;
  onHide?: (conversation: Conversation) => void;
  onPress: (conversationId: string) => void;
};

function getLastMessagePreview(conversation: Conversation) {
  const { lastMessage, otherProfile } = conversation;

  if (!lastMessage) {
    return "Sin mensajes todavia";
  }

  if (lastMessage.deleted) {
    return "Mensaje eliminado";
  }

  if (lastMessage.stickerName) {
    return `Sticker: ${lastMessage.stickerName}`;
  }

  if (lastMessage.hasAttachment) {
    return "Adjunto enviado";
  }

  const preview = lastMessage.content.trim() || "Mensaje sin contenido";
  const isFromOtherPerson = lastMessage.senderId === otherProfile.id;

  return isFromOtherPerson ? `${otherProfile.username}: ${preview}` : preview;
}

export function ConversationRow({
  conversation,
  isHiding = false,
  onHide,
  onPress,
}: ConversationRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { otherProfile } = conversation;
  const avatarUrl = otherProfile.avatarAsset?.url;

  return (
    <Pressable
      onPress={() => onPress(conversation.id)}
      style={({ pressed }) => [
        styles.row,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <UserAvatar
        avatarUrl={avatarUrl}
        profileId={otherProfile.id}
        showStatus
        size={40}
        username={otherProfile.username}
      />

      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.username}>
          {otherProfile.username}
        </Text>
        <Text numberOfLines={1} style={styles.preview}>
          {getLastMessagePreview(conversation)}
        </Text>
      </View>

      <Pressable
        accessibilityLabel="Ocultar conversacion"
        disabled={isHiding}
        hitSlop={10}
        onPress={() => onHide?.(conversation)}
        style={({ pressed }) => [
          styles.hideButton,
          pressed && !isHiding ? styles.hideButtonPressed : null,
          isHiding ? styles.hideButtonDisabled : null,
        ]}
      >
        <Ionicons color={colors.textMuted} name="trash-outline" size={17} />
      </Pressable>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    row: {
      alignItems: "center",
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderPrimary,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    rowPressed: {
      backgroundColor: colors.bgTertiary,
    },
    copy: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    username: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    preview: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 19,
    },
    hideButton: {
      alignItems: "center",
      borderRadius: 14,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    hideButtonPressed: {
      backgroundColor: colors.bgTertiary,
    },
    hideButtonDisabled: {
      opacity: 0.5,
    },
  });
}
