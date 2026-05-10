import { FlashList, FlashListRef } from "@shopify/flash-list";
import { Redirect, useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  ChatInput,
  type ChatInputHandle,
} from "@/src/features/chat/components/chat-input";
import {
  ChatItem,
  getChatDateSeparatorLabel,
} from "@/src/features/chat/components/chat-item";
import { EmojiPanel } from "@/src/features/chat/components/emoji-panel";
import { GoToRecentButton } from "@/src/features/chat/components/go-to-recent-button";
import { MessageActionsSheet } from "@/src/features/chat/components/message-actions-sheet";
import { StickerPanel } from "@/src/features/chat/components/sticker-panel";
import { UserProfileSheet } from "@/src/features/chat/components/user-profile-sheet";
import type { ChatMessage } from "@/src/features/chat/lib/chat-message";
import type { ClientProfileSummary } from "@/src/features/chat/types";
import { useChatAccessoryPanel } from "@/src/features/chat/hooks/use-chat-accessory-panel";
import {
  useChatMessageWindow,
  type FetchPageFn,
} from "@/src/features/chat/hooks/use-chat-message-window";
import { useConversation } from "@/src/features/conversations/hooks/use-conversation";
import { getDirectMessages } from "@/src/features/conversations/application/get-direct-messages";
import { useConversationRoomSubscription } from "@/src/features/conversations/hooks/use-conversation-room-subscription";
import { useConversationSocket } from "@/src/features/conversations/hooks/use-conversation-socket";
import { usePresence } from "@/src/features/presence/hooks/use-presence";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useChannelReadState } from "@/src/features/notifications/hooks/use-channel-read-state";
import { VoiceCallView } from "@/src/features/voice/components/voice-call-view";
import { useConversationVoiceParticipantsSocket } from "@/src/features/voice/hooks/use-conversation-voice-participants-socket";
import {
  selectChannelParticipants,
  selectEmptyVoiceParticipants,
  useVoiceParticipantsStore,
} from "@/src/features/voice/store/use-voice-participants-store";
import { useVoiceStore } from "@/src/features/voice/store/use-voice-store";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";
import {
  ReportScreen,
  type ReportCategoryConfig,
} from "@/src/features/report/components/report-screen";
import type { ReportTargetType } from "@/src/features/report/api/submit-report";

const MESSAGE_REPORT_CATEGORIES: ReportCategoryConfig[] = [
  {
    value: "CSAM",
    label: "Seguridad infantil",
    description: "Involucra a menores de forma inapropiada",
  },
  {
    value: "SEXUAL_CONTENT",
    label: "Contenido sexual",
    description: "Contiene material explicito o no solicitado",
  },
  {
    value: "HARASSMENT",
    label: "Acoso",
    description: "Amenazas o comportamiento intimidatorio",
  },
  {
    value: "HATE_SPEECH",
    label: "Discurso de odio",
    description: "Promueve odio contra grupos o personas",
  },
  {
    value: "SPAM",
    label: "Spam",
    description: "Contenido repetitivo, enganoso o no solicitado",
  },
  {
    value: "IMPERSONATION",
    label: "Suplantacion de identidad",
    description: "Se hace pasar por otra persona",
  },
  {
    value: "OTHER",
    label: "Otro",
    description: "Razon no listada anteriormente",
  },
];

const PROFILE_REPORT_CATEGORIES: ReportCategoryConfig[] = [
  {
    value: "CSAM",
    label: "Seguridad infantil",
    description: "El perfil involucra a menores de forma inapropiada",
  },
  {
    value: "SEXUAL_CONTENT",
    label: "Contenido sexual",
    description: "El perfil contiene material explicito",
  },
  {
    value: "HARASSMENT",
    label: "Acoso",
    description: "Este usuario acosa o intimida a otros",
  },
  {
    value: "HATE_SPEECH",
    label: "Discurso de odio",
    description: "Promueve odio contra grupos o personas",
  },
  {
    value: "SPAM",
    label: "Spam",
    description: "Cuenta falsa o con actividad de spam",
  },
  {
    value: "IMPERSONATION",
    label: "Suplantacion de identidad",
    description: "Se hace pasar por otra persona o entidad",
  },
  {
    value: "OTHER",
    label: "Otro",
    description: "Razon no listada anteriormente",
  },
];

type ReportConfig = {
  title: string;
  previewLabel: string;
  categories: ReportCategoryConfig[];
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId?: string;
  snapshot?: Record<string, unknown>;
};

const CHAT_DRAW_DISTANCE = 1800;
const PINNED_TO_BOTTOM_OFFSET = 48;
const MAINTAIN_VISIBLE_CONTENT_POSITION = {
  animateAutoScrollToBottom: false,
  autoscrollToBottomThreshold: 1,
  startRenderingFromBottom: true,
} as const;

type FlashListScrollMetrics = {
  contentHeight: number;
  distanceFromBottom: number;
  offsetY: number;
  viewportHeight: number;
};

function ChatPaginationLoader({ placement }: { placement: "top" | "bottom" }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.paginationLoader,
        placement === "top"
          ? styles.paginationLoaderTop
          : styles.paginationLoaderBottom,
      ]}
    >
      <View style={styles.paginationRule} />
      <View style={styles.paginationPill}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
      </View>
      <View style={styles.paginationRule} />
    </View>
  );
}

const ConversationComposerAccessory = memo(
  function ConversationComposerAccessory({
    conversationId,
    profileId,
    replyTo,
    onClearReply,
    windowKey,
  }: {
    conversationId: string;
    profileId: string;
    replyTo: ChatMessage | null;
    onClearReply: () => void;
    windowKey: string;
  }) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const chatInputRef = useRef<ChatInputHandle>(null);
    const {
      activePanel,
      closePanel,
      isComposerCompact,
      onInputFocus,
      openPanel,
      panelAnimatedStyle,
    } = useChatAccessoryPanel();

    return (
      <>
        <ChatInput
          ref={chatInputRef}
          context={{ type: "conversation", conversationId }}
          isComposerCompact={isComposerCompact}
          bottomInset={0}
          replyTo={replyTo}
          onClearReply={onClearReply}
          windowKey={windowKey}
          onEmojiPickerPress={() => {
            if (activePanel === "emoji") {
              closePanel();
            } else {
              openPanel("emoji");
            }
          }}
          onInputFocus={() => {
            onInputFocus();
          }}
          onStickerPickerPress={() => {
            if (activePanel === "sticker") {
              closePanel();
            } else {
              openPanel("sticker");
            }
          }}
        />

        <View style={[styles.pickerPanel, panelAnimatedStyle]}>
          {activePanel === "sticker" ? (
            <StickerPanel
              profileId={profileId}
              onSelect={(sticker) => {
                void chatInputRef.current?.sendSticker(sticker);
              }}
            />
          ) : null}
          {activePanel === "emoji" ? (
            <EmojiPanel
              onSelect={(emoji) => {
                chatInputRef.current?.appendEmoji(emoji);
              }}
            />
          ) : null}
        </View>
      </>
    );
  },
);

export default function DmConversationScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const profile = useProfile();
  const { markAsRead, clearViewingRoom } = useChannelReadState(profile.id);
  const flashListRef = useRef<FlashListRef<ChatMessage>>(null);
  const pinnedRef = useRef(true);
  const lastScrollMetricsRef = useRef<FlashListScrollMetrics | null>(null);
  const pendingWindowManage = useRef<"up" | "down" | null>(null);
  const [listVisible, setListVisible] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null,
  );
  const [selectedAuthor, setSelectedAuthor] =
    useState<ClientProfileSummary | null>(null);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);

  const { conversationId } = useLocalSearchParams<{
    conversationId?: string;
  }>();
  const resolvedConversationId = conversationId ?? undefined;
  const windowKey = resolvedConversationId
    ? `conversation:${resolvedConversationId}`
    : "";

  useFocusEffect(
    useCallback(() => {
      if (resolvedConversationId) {
        void markAsRead(resolvedConversationId, true);
      }
      return () => {
        clearViewingRoom();
      };
    }, [resolvedConversationId, markAsRead, clearViewingRoom]),
  );

  const {
    data: conversation,
    isLoading: isConversationLoading,
    isError: isConversationError,
    error: conversationError,
    refetch: refetchConversation,
  } = useConversation(resolvedConversationId);

  const canLoadMessages = Boolean(resolvedConversationId && conversation);
  const otherProfileId = conversation?.otherProfile.id;
  const voiceChannelId = useVoiceStore((state) => state.channelId);
  const isVoiceConnecting = useVoiceStore((state) => state.isConnecting);
  const isVoiceConnected = useVoiceStore((state) => state.isConnected);
  const voiceContext = useVoiceStore((state) => state.context);
  const isInThisConversationCall =
    voiceContext === "conversation" &&
    resolvedConversationId === voiceChannelId &&
    (isVoiceConnecting || isVoiceConnected);

  useVoiceParticipantsStore(
    resolvedConversationId
      ? selectChannelParticipants(resolvedConversationId)
      : selectEmptyVoiceParticipants,
  );

  usePresence(otherProfileId ? [otherProfileId] : []);

  const fetchPage = useCallback<FetchPageFn>(
    (cursor, direction) =>
      getDirectMessages({
        conversationId: resolvedConversationId ?? "",
        profileId: profile.id,
        cursor,
        direction,
      }),
    [resolvedConversationId, profile.id],
  );

  const {
    status,
    error: messagesError,
    messages,
    hasMoreBefore,
    hasMoreAfter,
    isFetchingOlder,
    isFetchingNewer,
    compactById,
    ensureInitial,
    loadOlder,
    loadNewer,
    manageWindow,
    goToPresent,
  } = useChatMessageWindow({
    windowKey,
    fetchPage,
    enabled: canLoadMessages,
  });

  useConversationRoomSubscription({
    conversationId: resolvedConversationId,
    enabled: canLoadMessages,
  });
  useConversationSocket({
    windowKey,
    conversationId: resolvedConversationId,
    enabled: canLoadMessages,
  });
  useConversationVoiceParticipantsSocket(
    resolvedConversationId,
    canLoadMessages,
  );

  const reversedMessages = messages;

  useEffect(() => {
    pinnedRef.current = true;
    setListVisible(false);
  }, [windowKey]);

  useEffect(() => {
    if (hasMoreAfter) {
      pinnedRef.current = false;
    }
  }, [hasMoreAfter]);

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      const metrics = {
        contentHeight: contentSize.height,
        distanceFromBottom,
        offsetY: contentOffset.y,
        viewportHeight: layoutMeasurement.height,
      };

      lastScrollMetricsRef.current = metrics;
      pinnedRef.current =
        !hasMoreAfter && distanceFromBottom <= PINNED_TO_BOTTOM_OFFSET;
    },
    [hasMoreAfter],
  );

  const scrollToBottom = useCallback(() => {
    flashListRef.current?.scrollToEnd({ animated: false });
    pinnedRef.current = true;
  }, []);

  const handleListLoad = useCallback(() => {
    scrollToBottom();
    setListVisible(true);
  }, [scrollToBottom]);

  const newestMessageId = messages[messages.length - 1]?.id;
  useLayoutEffect(() => {
    if (!newestMessageId || hasMoreAfter) return;
    if (!pinnedRef.current) return;

    scrollToBottom();

    const firstFrame = requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });

    return () => {
      cancelAnimationFrame(firstFrame);
    };
  }, [hasMoreAfter, newestMessageId, scrollToBottom]);

  useEffect(() => {
    if (!pendingWindowManage.current) return;
    const direction = pendingWindowManage.current;
    pendingWindowManage.current = null;
    manageWindow(direction);
  }, [messages.length, manageWindow]);

  const handleEndReached = useCallback(async () => {
    if (!hasMoreAfter || isFetchingNewer) return;
    const result = await loadNewer();
    if (result.ok && result.kind !== "noop") {
      pendingWindowManage.current = "down";
    }
  }, [hasMoreAfter, isFetchingNewer, loadNewer]);

  const handleStartReached = useCallback(async () => {
    if (!hasMoreBefore || isFetchingOlder) return;
    const result = await loadOlder();
    if (result.ok && result.kind !== "noop") {
      pendingWindowManage.current = "up";
    }
  }, [hasMoreBefore, isFetchingOlder, loadOlder]);

  const handleGoToPresent = useCallback(async () => {
    await goToPresent(40);
    scrollToBottom();
  }, [goToPresent, scrollToBottom]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const renderMessageItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const previous = reversedMessages[index - 1] ?? null;

      return (
        <ChatItem
          currentProfileId={profile.id}
          dateSeparatorLabel={getChatDateSeparatorLabel(
            item.createdAt,
            previous?.createdAt,
          )}
          isCompact={compactById[item.id] ?? false}
          message={item}
          onLongPress={(message) => setSelectedMessage(message)}
          onAvatarPress={(author) => setSelectedAuthor(author)}
        />
      );
    },
    [compactById, reversedMessages, profile.id],
  );

  const handleEndReachedEvent = useCallback(() => {
    void handleEndReached();
  }, [handleEndReached]);

  const handleStartReachedEvent = useCallback(() => {
    void handleStartReached();
  }, [handleStartReached]);

  if (!resolvedConversationId) {
    return <Redirect href="/boards" />;
  }

  if (isConversationLoading && !conversation) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={styles.stateText}>Cargando conversacion...</Text>
      </View>
    );
  }

  if (isConversationError) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>No se pudo cargar este chat</Text>
        <Text style={styles.stateText}>
          {conversationError instanceof Error
            ? conversationError.message
            : "Intenta de nuevo."}
        </Text>
        <Pressable
          onPress={() => void refetchConversation()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (!conversation) return null;

  return (
    <View style={styles.container}>
      {isInThisConversationCall ? (
        <View style={styles.callArea}>
          <VoiceCallView channelId={resolvedConversationId} />
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.chatSurface}>
          {status === "idle" ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.accentPrimary} size="small" />
              <Text style={styles.stateText}>Cargando mensajes...</Text>
            </View>
          ) : null}

          {status === "error" ? (
            <View style={styles.centerState}>
              <Text style={styles.stateTitle}>
                No se pudieron cargar los mensajes
              </Text>
              <Text style={styles.stateText}>
                {messagesError ?? "Intenta de nuevo."}
              </Text>
              <Pressable
                onPress={ensureInitial}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </Pressable>
            </View>
          ) : null}

          {status === "success" ? (
            <>
              {messages.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.stateTitle}>Sin mensajes todavia</Text>
                  <Text style={styles.stateText}>
                    Se el primero en escribir algo.
                  </Text>
                </View>
              ) : (
                <View style={[styles.listContainer, { opacity: listVisible ? 1 : 0 }]}>
                  <FlashList
                    key={windowKey}
                    ref={flashListRef}
                    contentContainerStyle={styles.messagesList}
                    data={reversedMessages}
                    drawDistance={CHAT_DRAW_DISTANCE}
                    extraData={compactById}
                    initialScrollIndex={reversedMessages.length > 0 ? reversedMessages.length - 1 : undefined}
                    keyExtractor={keyExtractor}
                    onEndReached={handleEndReachedEvent}
                    onEndReachedThreshold={0.4}
                    onLoad={handleListLoad}
                    maintainVisibleContentPosition={
                      MAINTAIN_VISIBLE_CONTENT_POSITION
                    }
                    onScroll={handleListScroll}
                    onStartReached={handleStartReachedEvent}
                    onStartReachedThreshold={0.4}
                    renderItem={renderMessageItem}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                      isFetchingOlder ? (
                        <ChatPaginationLoader placement="top" />
                      ) : null
                    }
                    ListFooterComponent={
                      isFetchingNewer ? (
                        <ChatPaginationLoader placement="bottom" />
                      ) : null
                    }
                  />

                  {hasMoreAfter ? (
                    <GoToRecentButton
                      onPress={() => void handleGoToPresent()}
                    />
                  ) : null}
                </View>
              )}

              <ConversationComposerAccessory
                conversationId={resolvedConversationId}
                profileId={profile.id}
                replyTo={replyTo}
                onClearReply={() => setReplyTo(null)}
                windowKey={windowKey}
              />
            </>
          ) : null}
        </View>
      </View>

      <UserProfileSheet
        visible={selectedAuthor !== null}
        author={selectedAuthor}
        currentProfileId={profile.id}
        onClose={() => setSelectedAuthor(null)}
        onReport={() => {
          const a = selectedAuthor;
          setSelectedAuthor(null);
          setReportConfig({
            title: "Reportar usuario",
            previewLabel: a
              ? `${a.username}${a.discriminator ? `#${a.discriminator}` : ""}`
              : "",
            categories: PROFILE_REPORT_CATEGORIES,
            targetType: "PROFILE",
            targetId: a?.id ?? "",
            targetOwnerId: a?.id,
            snapshot: {
              username: a?.username,
              discriminator: a?.discriminator,
            },
          });
        }}
      />

      <MessageActionsSheet
        visible={selectedMessage !== null}
        message={selectedMessage}
        currentProfileId={profile.id}
        windowKey={windowKey}
        context={{
          type: "conversation",
          conversationId: resolvedConversationId,
        }}
        onClose={() => setSelectedMessage(null)}
        onReply={(message) => {
          setReplyTo(message);
          setSelectedMessage(null);
        }}
        onReport={(message) => {
          const content = message.content ?? "";
          setSelectedMessage(null);
          setReportConfig({
            title: "Reportar mensaje",
            previewLabel:
              content.length > 120
                ? `${content.slice(0, 120)}...`
                : content || "Mensaje sin texto",
            categories: MESSAGE_REPORT_CATEGORIES,
            targetType: "DIRECT_MESSAGE",
            targetId: message.id,
            targetOwnerId:
              "senderId" in message
                ? (message.senderId ?? undefined)
                : undefined,
            snapshot: {
              content: message.content,
              senderUsername:
                "sender" in message ? message.sender?.username : undefined,
              senderDiscriminator:
                "sender" in message ? message.sender?.discriminator : undefined,
            },
          });
        }}
      />

      {reportConfig ? (
        <ReportScreen
          visible
          onClose={() => setReportConfig(null)}
          title={reportConfig.title}
          previewLabel={reportConfig.previewLabel}
          categories={reportConfig.categories}
          targetType={reportConfig.targetType}
          targetId={reportConfig.targetId}
          targetOwnerId={reportConfig.targetOwnerId}
          snapshot={reportConfig.snapshot}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.bgSecondary,
      flex: 1,
    },
    body: {
      flex: 1,
    },
    buttonPressed: {
      opacity: 0.92,
    },
    chatSurface: {
      flex: 1,
    },
    listContainer: {
      flex: 1,
    },
    messagesList: {
      paddingBottom: 16,
      paddingTop: 0,
    },
    paginationLoader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    paginationLoaderTop: {
      paddingTop: 18,
    },
    paginationLoaderBottom: {
      paddingBottom: 18,
    },
    paginationPill: {
      alignItems: "center",
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderPrimary,
      borderRadius: 999,
      borderWidth: 1,
      height: 34,
      justifyContent: "center",
      width: 44,
    },
    paginationRule: {
      backgroundColor: colors.borderPrimary,
      flex: 1,
      height: 1,
    },
    pickerPanel: {
      backgroundColor: colors.bgPrimary,
      borderTopColor: colors.borderPrimary,
      borderTopWidth: 1,
    },
    callArea: {
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
      height: 330,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    emptyState: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
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
      backgroundColor: colors.buttonPrimary,
      borderRadius: 16,
      justifyContent: "center",
      minHeight: 48,
      minWidth: 140,
      paddingHorizontal: 18,
    },
    retryButtonText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
