import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/src/components/app-typography";
import { UserAvatar } from "@/src/components/user-avatar";
import type { Conversation } from "../domain/conversation";
import { useConversations } from "../hooks/use-conversations";
import { useTheme } from "@/src/theme/theme-provider";

type DmDrawerMainProps = {
  activeConversationId?: string;
  onConversationPressIn?: () => void;
  onSelectConversation: (conversationId: string, participantName: string) => void;
};

export function DmDrawerMain({
  activeConversationId,
  onConversationPressIn,
  onSelectConversation,
}: DmDrawerMainProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: conversations = [], isLoading, isError, refetch, isFetching } =
    useConversations();

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const isActive = item.id === activeConversationId;
      const lastMessageText = item.lastMessage?.deleted
        ? "Mensaje eliminado"
        : item.lastMessage?.stickerName
          ? `[${item.lastMessage.stickerName}]`
          : item.lastMessage?.hasAttachment && !item.lastMessage.content
            ? "Adjunto"
            : (item.lastMessage?.content ?? "");

      return (
        <Pressable
          onPressIn={onConversationPressIn}
          onPress={() =>
            onSelectConversation(item.id, item.otherProfile.username)
          }
          style={({ pressed }) => [
            styles.row,
            isActive ? styles.rowActive : null,
            pressed ? styles.rowPressed : null,
          ]}
        >
          <UserAvatar
            avatarUrl={item.otherProfile.avatarAsset?.url}
            profileId={item.otherProfile.id}
            showStatus
            size={36}
            username={item.otherProfile.username}
          />
          <View style={styles.rowCopy}>
            <Text numberOfLines={1} style={[styles.rowName, isActive ? styles.rowNameActive : null]}>
              {item.otherProfile.username}
            </Text>
            {lastMessageText ? (
              <Text numberOfLines={1} style={styles.rowLastMessage}>
                {lastMessageText}
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [activeConversationId, onSelectConversation, styles],
  );

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mensajes directos</Text>
        <Pressable
          accessibilityLabel="Agregar amigo"
          onPress={() => router.push("/modal/add-friend")}
          style={({ pressed }) => [
            styles.addButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Ionicons color={colors.textSecondary} name="person-add-outline" size={18} />
        </Pressable>
      </View>

      <View style={styles.separator} />

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.accentPrimary} size="small" />
        </View>
      ) : isError ? (
        <View style={styles.centerState}>
          <Text style={styles.helperText}>No se pudieron cargar</Text>
          <Pressable
            onPress={() => void refetch()}
            style={({ pressed }) => [
              styles.retryPill,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.retryPillText}>
              {isFetching ? "..." : "Reintentar"}
            </Text>
          </Pressable>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.helperText}>Sin mensajes todavía</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    headerTitle: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
    },
    addButton: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    separator: {
      backgroundColor: colors.borderPrimary,
      height: 1,
      marginHorizontal: 12,
    },
    listContent: {
      gap: 2,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    row: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    rowActive: {
      backgroundColor: colors.channelTypeActiveSoftBg,
      borderColor: colors.channelTypeActiveSoftBg,
    },
    rowPressed: {
      opacity: 0.85,
    },
    rowCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    rowName: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    rowNameActive: {
      color: colors.accentPrimary,
    },
    rowLastMessage: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 8,
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: "center",
    },
    retryPill: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderSecondary,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 30,
      minWidth: 56,
      paddingHorizontal: 10,
    },
    retryPillText: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
