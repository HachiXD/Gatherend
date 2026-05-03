import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ConversationsList } from "@/src/features/conversations/components/conversations-list";
import { EmptyConversations } from "@/src/features/conversations/components/empty-conversations";
import { useConversations } from "@/src/features/conversations/hooks/use-conversations";
import { useHideConversation } from "@/src/features/conversations/hooks/use-hide-conversation";
import type { Conversation } from "@/src/features/conversations/domain/conversation";
import { usePresence } from "@/src/features/presence/hooks/use-presence";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

export default function ChatsScreen() {
  const router = useRouter();
  const navigating = useRef(false);

  useFocusEffect(useCallback(() => {
    navigating.current = false;
  }, []));
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top ?? StatusBar.currentHeight ?? 0,
  );
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data: conversations = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useConversations();
  const hideConversationMutation = useHideConversation();
  const hasConversations = conversations.length > 0;
  const presenceProfileIds = useMemo(
    () => conversations.map((conversation) => conversation.otherProfile.id),
    [conversations],
  );

  usePresence(presenceProfileIds);

  function handleHideConversation(conversation: Conversation) {
    Alert.alert(
      "Ocultar conversacion",
      `Se quitara ${conversation.otherProfile.username} de tu lista de chats.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Ocultar",
          style: "destructive",
          onPress: () => {
            hideConversationMutation.mutate(conversation.id);
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.safeArea, { paddingTop: topInset }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Chats</Text>
          </View>

          <Pressable
            accessibilityLabel="Agregar amigo"
            onPress={() => {
              if (navigating.current) return;
              navigating.current = true;
              router.push("/(app)/(tabs)/chats/add-friend");
            }}
            style={({ pressed }) => [
              styles.addButton,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="person-add-outline" size={20} />
          </Pressable>
        </View>

        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.accentPrimary} size="small" />
              <Text style={styles.stateText}>Cargando conversaciones...</Text>
            </View>
          ) : null}

          {!isLoading && isError ? (
            <View style={styles.centerState}>
              <Text style={styles.stateTitle}>
                No se pudieron cargar tus chats
              </Text>
              <Text style={styles.stateText}>
                {error instanceof Error
                  ? error.message
                  : "Intenta de nuevo para consultar tus conversaciones."}
              </Text>
              <Pressable
                onPress={() => {
                  void refetch();
                }}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Text style={styles.retryButtonText}>
                  {isFetching ? "Reintentando..." : "Reintentar"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!isLoading && !isError && !hasConversations ? (
            <EmptyConversations />
          ) : null}

          {!isLoading && !isError && hasConversations ? (
            <ConversationsList
              conversations={conversations}
              hidingConversationId={hideConversationMutation.variables ?? null}
              onHideConversation={handleHideConversation}
              onSelectConversation={(conversationId) => {
                if (navigating.current) return;
                navigating.current = true;
                router.push({
                  pathname: "/(app)/chats/[conversationId]",
                  params: { conversationId },
                });
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    container: {
      flex: 1,
      gap: 18,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
    },
    header: {
      alignItems: "center",
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingBottom: 14,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 30,
      fontWeight: "700",
      lineHeight: 36,
    },
    addButton: {
      alignItems: "center",
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderPrimary,
      borderRadius: 16,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    buttonPressed: {
      opacity: 0.92,
    },
    content: {
      flex: 1,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    stateTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
    },
    stateText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    retryButton: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderSecondary,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 18,
    },
    retryButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
