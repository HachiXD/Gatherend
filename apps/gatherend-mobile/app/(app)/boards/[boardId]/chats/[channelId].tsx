import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import {
  ChatInput,
  type ChatInputHandle,
} from "@/src/features/chat/components/chat-input";
import {
  ChatItem,
  getChatDateSeparatorLabel,
} from "@/src/features/chat/components/chat-item";
import { UserProfileSheet } from "@/src/features/chat/components/user-profile-sheet";
import { MessageActionsSheet } from "@/src/features/chat/components/message-actions-sheet";
import type { ClientProfileSummary } from "@/src/features/chat/types";
import {
  ReportScreen,
  type ReportCategoryConfig,
} from "@/src/features/report/components/report-screen";
import type { ReportTargetType } from "@/src/features/report/api/submit-report";
import type { ChannelMessage } from "@/src/features/chat/types";
import { EmojiPanel } from "@/src/features/chat/components/emoji-panel";
import { GoToRecentButton } from "@/src/features/chat/components/go-to-recent-button";
import { StickerPanel } from "@/src/features/chat/components/sticker-panel";
import { getChannelMessages } from "@/src/features/chat/api/get-channel-messages";
import { joinChannel } from "@/src/features/chat/api/join-channel";
import type { ChatMessage } from "@/src/features/chat/chat-message";
import {
  useChatMessageWindow,
  type FetchPageFn,
} from "@/src/features/chat/hooks/use-chat-message-window";
import { useChannelRoomSubscription } from "@/src/features/chat/hooks/use-channel-room-subscription";
import { useChannelSocket } from "@/src/features/chat/hooks/use-channel-socket";
import { useChatAccessoryPanel } from "@/src/features/chat/hooks/use-chat-accessory-panel";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { VoiceCallView } from "@/src/features/voice/components/voice-call-view";
import { useBoardVoiceParticipantsSocket } from "@/src/features/voice/hooks/use-board-voice-participants-socket";
import { useVoiceStore } from "@/src/features/voice/store/use-voice-store";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

const MESSAGE_REPORT_CATEGORIES: ReportCategoryConfig[] = [
  { value: "CSAM", label: "Seguridad infantil", description: "Involucra a menores de forma inapropiada" },
  { value: "SEXUAL_CONTENT", label: "Contenido sexual", description: "Contiene material explícito o no solicitado" },
  { value: "HARASSMENT", label: "Acoso", description: "Amenazas o comportamiento intimidatorio" },
  { value: "HATE_SPEECH", label: "Discurso de odio", description: "Promueve odio contra grupos o personas" },
  { value: "SPAM", label: "Spam", description: "Contenido repetitivo, engañoso o no solicitado" },
  { value: "IMPERSONATION", label: "Suplantación de identidad", description: "Se hace pasar por otra persona" },
  { value: "OTHER", label: "Otro", description: "Razón no listada anteriormente" },
];

const PROFILE_REPORT_CATEGORIES: ReportCategoryConfig[] = [
  { value: "CSAM", label: "Seguridad infantil", description: "El perfil involucra a menores de forma inapropiada" },
  { value: "SEXUAL_CONTENT", label: "Contenido sexual", description: "El perfil contiene material explícito" },
  { value: "HARASSMENT", label: "Acoso", description: "Este usuario acosa o intimida a otros" },
  { value: "HATE_SPEECH", label: "Discurso de odio", description: "Promueve odio contra grupos o personas" },
  { value: "SPAM", label: "Spam", description: "Cuenta falsa o con actividad de spam" },
  { value: "IMPERSONATION", label: "Suplantación de identidad", description: "Se hace pasar por otra persona o entidad" },
  { value: "OTHER", label: "Otro", description: "Razón no listada anteriormente" },
];

type ReportConfig = {
  title: string;
  previewLabel: string;
  categories: ReportCategoryConfig[];
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId?: string;
  channelId?: string;
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

const ChannelComposerAccessory = memo(function ChannelComposerAccessory({
  boardId,
  channelId,
  profileId,
  windowKey,
  replyTo,
  onClearReply,
}: {
  boardId: string;
  channelId: string;
  profileId: string;
  windowKey: string;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
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
      <View pointerEvents="none" style={styles.composerTopSpacer} />
      <ChatInput
        ref={chatInputRef}
        context={{ type: "channel", boardId, channelId }}
        isComposerCompact={isComposerCompact}
        windowKey={windowKey}
        replyTo={replyTo}
        onClearReply={onClearReply}
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
              closePanel();
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
});

export default function BoardChannelScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const profile = useProfile();
  const flashListRef = useRef<FlashListRef<ChatMessage>>(null);
  const pinnedRef = useRef(true);
  const lastScrollMetricsRef = useRef<FlashListScrollMetrics | null>(null);
  // Direction to evict after the next messages-length change.
  const pendingWindowManage = useRef<"up" | "down" | null>(null);

  const { boardId, channelId } = useLocalSearchParams<{
    boardId?: string;
    channelId?: string;
  }>();
  const resolvedBoardId = boardId ?? undefined;
  const resolvedChannelId = channelId ?? undefined;

  const windowKey = resolvedChannelId ? `channel:${resolvedChannelId}` : "";
  const [isJoining, setIsJoining] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<ClientProfileSummary | null>(null);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);

  const {
    data: board,
    isLoading: isBoardLoading,
    isError: isBoardError,
    refetch: refetchBoard,
  } = useBoard(resolvedBoardId);

  const channel =
    board?.channels.find((item) => item.id === resolvedChannelId) ?? null;
  const voiceChannelId = useVoiceStore((state) => state.channelId);
  const isVoiceConnecting = useVoiceStore((state) => state.isConnecting);
  const isVoiceConnected = useVoiceStore((state) => state.isConnected);
  const voiceContext = useVoiceStore((state) => state.context);
  const startConnecting = useVoiceStore((state) => state.startConnecting);
  const isInThisVoiceChannel =
    channel?.type === "VOICE" &&
    voiceContext === "board" &&
    voiceChannelId === resolvedChannelId &&
    (isVoiceConnecting || isVoiceConnected);

  const handleJoinChannel = useCallback(async () => {
    if (isJoining || !resolvedBoardId || !resolvedChannelId) return;
    setIsJoining(true);
    try {
      await joinChannel({
        boardId: resolvedBoardId,
        channelId: resolvedChannelId,
        profileId: profile.id,
      });
      await refetchBoard();
    } finally {
      setIsJoining(false);
    }
  }, [isJoining, resolvedBoardId, resolvedChannelId, profile.id, refetchBoard]);

  const handleJoinVoice = useCallback(() => {
    if (!resolvedBoardId || !resolvedChannelId || !channel) return;
    startConnecting(resolvedChannelId, channel.name, "board", resolvedBoardId);
  }, [channel, resolvedBoardId, resolvedChannelId, startConnecting]);

  const canViewMessages = Boolean(
    resolvedBoardId &&
    resolvedChannelId &&
    board &&
    channel &&
    channel.type === "TEXT",
  );

  const canReceiveRealtime = canViewMessages && Boolean(channel?.isJoined);

  const fetchPage = useCallback<FetchPageFn>(
    (cursor, direction, limit) =>
      getChannelMessages({
        boardId: resolvedBoardId ?? "",
        channelId: resolvedChannelId ?? "",
        profileId: profile.id,
        cursor,
        direction,
        limit,
      }),
    [resolvedBoardId, resolvedChannelId, profile.id],
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
    enabled: canViewMessages,
  });

  useChannelRoomSubscription({
    channelId: resolvedChannelId,
    enabled: canReceiveRealtime,
  });
  useChannelSocket({
    windowKey,
    channelId: resolvedChannelId,
    enabled: canReceiveRealtime,
  });
  useBoardVoiceParticipantsSocket(
    channel?.type === "VOICE" ? resolvedBoardId : undefined,
  );

  useEffect(() => {
    pinnedRef.current = true;
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

  // Sticky bottom: present mounted + physically pinned to bottom.
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

  // Run pending window eviction AFTER the store update has propagated to React
  // so manageWindow sees the post-load message count.
  useEffect(() => {
    if (!pendingWindowManage.current) return;
    const direction = pendingWindowManage.current;
    pendingWindowManage.current = null;
    manageWindow(direction);
  }, [messages.length, manageWindow]);

  // User scrolled to BOTTOM while viewing past messages -> load newer.
  // Guarded by hasMoreAfter so it no-ops in the normal present-pinned state.
  const handleEndReached = useCallback(async () => {
    if (!hasMoreAfter || isFetchingNewer) return;
    const result = await loadNewer();
    if (result.ok && result.kind !== "noop") {
      pendingWindowManage.current = "down";
    }
  }, [hasMoreAfter, isFetchingNewer, loadNewer]);

  // User scrolled to TOP of the list -> load older messages.
  const handleStartReached = useCallback(async () => {
    if (!hasMoreBefore || isFetchingOlder) return;
    const result = await loadOlder();
    if (result.ok && result.kind !== "noop") {
      pendingWindowManage.current = "up";
    }
  }, [hasMoreBefore, isFetchingOlder, loadOlder]);

  // Jump to present: refetch latest page then scroll to the visual bottom.
  const handleGoToPresent = useCallback(async () => {
    await goToPresent(40);
    scrollToBottom();
  }, [goToPresent, scrollToBottom]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const renderMessageItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const previous = messages[index - 1] ?? null;

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
    [compactById, messages, profile.id],
  );

  const handleListLoad = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const handleEndReachedEvent = useCallback(() => {
    void handleEndReached();
  }, [handleEndReached]);

  const handleStartReachedEvent = useCallback(() => {
    void handleStartReached();
  }, [handleStartReached]);

  if (!resolvedBoardId || !resolvedChannelId) {
    return <Redirect href="/(app)/(tabs)/boards" />;
  }

  if (isBoardLoading && !board) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={styles.stateText}>Cargando canal...</Text>
      </View>
    );
  }

  if (isBoardError) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>No se pudo cargar el canal</Text>
        <Text style={styles.stateText}>
          Hubo un problema al cargar el board. Intenta de nuevo.
        </Text>
        <Pressable
          onPress={() => void refetchBoard()}
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

  if (board && !channel) {
    return (
      <Redirect
        href={{
          pathname: "/(app)/(tabs)/boards/[boardId]/chats",
          params: { boardId: resolvedBoardId },
        }}
      />
    );
  }

  if (!board || !channel) return null;

  const channelImageUrl = channel.imageAsset?.url ?? null;
  const hasChannelImage = Boolean(channelImageUrl);
  const channelMembersLabel =
    channel.type === "VOICE"
      ? isInThisVoiceChannel
        ? isVoiceConnected
          ? "En llamada"
          : "Conectando llamada"
        : "Canal de voz"
      : channel.channelMemberCount === 1
        ? "1 miembro"
        : `${channel.channelMemberCount} miembros`;

  return (
    <View style={styles.container}>
      {channelImageUrl ? (
        <>
          <Image
            contentFit="cover"
            pointerEvents="none"
            source={{ uri: channelImageUrl }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.bgSecondary, opacity: 0.5 },
            ]}
          />
        </>
      ) : null}

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View
          pointerEvents="none"
          style={[
            styles.headerBackground,
            hasChannelImage ? styles.headerBackgroundWithImage : null,
          ]}
        />

        <Pressable
          accessibilityHint="Regresa a la lista de chats del board"
          accessibilityLabel="Volver"
          accessibilityRole="button"
          onPress={() => {
            router.replace({
              pathname: "/(app)/(tabs)/boards/[boardId]/chats",
              params: { boardId: resolvedBoardId },
            });
          }}
          style={({ pressed }) => [
            styles.headerButton,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={21} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {channel.name}
          </Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>
            {channelMembersLabel}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {channel.type !== "TEXT" ? (
          isInThisVoiceChannel ? (
            <VoiceCallView channelId={resolvedChannelId} />
          ) : (
            <View style={styles.centerState}>
              <View style={styles.voiceIconWrap}>
                <Ionicons
                  color={colors.accentPrimary}
                  name="call"
                  size={32}
                />
              </View>
              <Text style={styles.stateTitle}>Canal de voz</Text>
              <Text style={styles.stateText}>
                Unete a la llamada para ver a los participantes dentro del canal.
              </Text>
              <Pressable
                onPress={handleJoinVoice}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Text style={styles.retryButtonText}>Unirme a la llamada</Text>
              </Pressable>
            </View>
          )
        ) : null}

        {channel.type === "TEXT" ? (
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
              messages.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.stateTitle}>Sin mensajes todavía</Text>
                  <Text style={styles.stateText}>
                    Sé el primero en escribir algo.
                  </Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  <FlashList
                    key={windowKey}
                    ref={flashListRef}
                    data={messages}
                    drawDistance={CHAT_DRAW_DISTANCE}
                    extraData={compactById}
                    keyExtractor={keyExtractor}
                    renderItem={renderMessageItem}
                    contentContainerStyle={styles.messagesList}
                    maintainVisibleContentPosition={
                      MAINTAIN_VISIBLE_CONTENT_POSITION
                    }
                    onScroll={handleListScroll}
                    onLoad={handleListLoad}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleEndReachedEvent}
                    onEndReachedThreshold={0.4}
                    onStartReached={handleStartReachedEvent}
                    onStartReachedThreshold={0.4}
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
              )
            ) : null}

            {channel.isJoined ? (
              <ChannelComposerAccessory
                boardId={resolvedBoardId}
                channelId={resolvedChannelId}
                profileId={profile.id}
                windowKey={windowKey}
                replyTo={replyTo}
                onClearReply={() => setReplyTo(null)}
              />
            ) : (
              <View
                style={[styles.joinBar, { paddingBottom: insets.bottom + 12 }]}
              >
                <Pressable
                  disabled={isJoining}
                  onPress={() => void handleJoinChannel()}
                  style={({ pressed }) => [
                    styles.joinButton,
                    pressed ? styles.buttonPressed : null,
                    isJoining ? styles.buttonDisabled : null,
                  ]}
                >
                  <Text style={styles.joinButtonText}>
                    {isJoining ? "Uniéndose..." : "Unirme al chat"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
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
        currentMemberRole={board.currentMember?.role ?? null}
        windowKey={windowKey}
        boardId={resolvedBoardId}
        channelId={resolvedChannelId}
        onClose={() => setSelectedMessage(null)}
        onReply={(message) => {
          setReplyTo(message);
          setSelectedMessage(null);
        }}
        onReport={(message) => {
          const msg = message as ChannelMessage;
          const content = msg.content ?? "";
          setSelectedMessage(null);
          setReportConfig({
            title: "Reportar mensaje",
            previewLabel:
              content.length > 120 ? `${content.slice(0, 120)}…` : content || "Mensaje sin texto",
            categories: MESSAGE_REPORT_CATEGORIES,
            targetType: "CHANNEL_MESSAGE",
            targetId: message.id,
            targetOwnerId: msg.messageSenderId ?? undefined,
            channelId: resolvedChannelId,
            snapshot: {
              content: msg.content,
              senderUsername: msg.messageSender?.username,
              senderDiscriminator: msg.messageSender?.discriminator,
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
          channelId={reportConfig.channelId}
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
      overflow: "hidden",
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
      paddingBottom: 0,
      paddingTop: 16,
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
    composerTopSpacer: {
      height: 20,
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingBottom: 14,
      paddingHorizontal: 16,
    },
    headerBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bgSecondary,
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
    },
    headerBackgroundWithImage: {
      opacity: 0.5,
    },
    headerButton: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 16,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    headerSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
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
    voiceIconWrap: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 999,
      borderWidth: 1,
      height: 76,
      justifyContent: "center",
      width: 76,
    },
    joinBar: {
      borderTopColor: colors.borderPrimary,
      borderTopWidth: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    joinButton: {
      alignItems: "center",
      backgroundColor: colors.buttonPrimary,
      borderRadius: 12,
      height: 48,
      justifyContent: "center",
      width: "100%",
    },
    joinButtonText: {
      color: colors.textInverse,
      fontSize: 15,
      fontWeight: "700",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
}
