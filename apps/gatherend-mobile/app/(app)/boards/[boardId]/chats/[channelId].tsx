import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { Redirect, useLocalSearchParams, useFocusEffect } from "expo-router";
import {
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
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { ChannelComposerAccessory } from "@/src/features/chat/components/channel-composer-accessory";
import {
  ChatItem,
  getChatDateSeparatorLabel,
} from "@/src/features/chat/components/chat-item";
import { UserProfileSheet } from "@/src/features/chat/components/user-profile-sheet";
import { MessageActionsSheet } from "@/src/features/chat/components/message-actions-sheet";
import type {
  ChannelMessage,
  ClientProfileSummary,
} from "@/src/features/chat/types";
import {
  ReportScreen,
  type ReportCategoryConfig,
} from "@/src/features/report/components/report-screen";
import type { ReportTargetType } from "@/src/features/report/api/submit-report";
import { GoToRecentButton } from "@/src/features/chat/components/go-to-recent-button";
import { WelcomeMessageCard } from "@/src/features/chat/components/welcome-message-card";
import { getMessageAuthor } from "@/src/features/chat/utils/message-author";
import { getChannelMessages } from "@/src/features/chat/api/get-channel-messages";
import type { ChatMessage } from "@/src/features/chat/lib/chat-message";
import {
  useChatMessageWindow,
  type FetchPageFn,
} from "@/src/features/chat/hooks/use-chat-message-window";
import { useChannelRoomSubscription } from "@/src/features/chat/hooks/use-channel-room-subscription";
import { useChannelSocket } from "@/src/features/chat/hooks/use-channel-socket";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useChannelReadState } from "@/src/features/notifications/hooks/use-channel-read-state";
import { VoiceCallView } from "@/src/features/voice/components/voice-call-view";
import { useBoardVoiceParticipantsSocket } from "@/src/features/voice/hooks/use-board-voice-participants-socket";
import { useVoiceStore } from "@/src/features/voice/store/use-voice-store";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

const MESSAGE_REPORT_CATEGORIES: ReportCategoryConfig[] = [
  {
    value: "CSAM",
    label: "Seguridad infantil",
    description: "Involucra a menores de forma inapropiada",
  },
  {
    value: "SEXUAL_CONTENT",
    label: "Contenido sexual",
    description: "Contiene material explícito o no solicitado",
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
    description: "Contenido repetitivo, engañoso o no solicitado",
  },
  {
    value: "IMPERSONATION",
    label: "Suplantación de identidad",
    description: "Se hace pasar por otra persona",
  },
  {
    value: "OTHER",
    label: "Otro",
    description: "Razón no listada anteriormente",
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
    description: "El perfil contiene material explícito",
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
    label: "Suplantación de identidad",
    description: "Se hace pasar por otra persona o entidad",
  },
  {
    value: "OTHER",
    label: "Otro",
    description: "Razón no listada anteriormente",
  },
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

// Keep a large render buffer so items far from the viewport stay mounted.
// With ~160 messages at ~72px average = ~11500px of content; 5500px on each
// side means essentially the full window stays mounted at all times.
const CHAT_DRAW_DISTANCE = 5500;
const PINNED_TO_BOTTOM_OFFSET = 48;

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

export default function BoardChannelScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const profile = useProfile();
  const { markAsRead, clearViewingRoom } = useChannelReadState(profile.id);
  const flashListRef = useRef<FlashListRef<ChatMessage>>(null);
  const pinnedRef = useRef(true);
  const lastScrollMetricsRef = useRef<FlashListScrollMetrics | null>(null);
  // Stable refs to the latest pagination handlers — driven from onScroll so
  // we don't depend on FlashList's unreliable onStartReached/onEndReached.
  const handleEndReachedRef = useRef<() => Promise<void>>(async () => {});
  const handleStartReachedRef = useRef<() => Promise<void>>(async () => {});
  // Live-updated refs so the scroll handler reads current values without
  // needing to be recreated on every hasMoreBefore/hasMoreAfter change.
  const hasMoreBeforeRef = useRef(false);
  const hasMoreAfterRef = useRef(false);
  // Ref-based lock for pagination: isFetchingNewer/Older from the store doesn't
  // cover cache hits (restoreNewerFromCache doesn't set the flag), so FlashList
  // can fire onEndReached multiple times before a re-render and trigger concurrent
  // store mutations that crash Fabric (RetryableMountingLayerException).
  const isLoadingNewerRef = useRef(false);
  const isLoadingOlderRef = useRef(false);
  // Mirror the ref as state so the spinner renders immediately on load start
  // and clears immediately on load end.
  const [isLoadingNewer, setIsLoadingNewer] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [listVisible, setListVisible] = useState(false);

  const { boardId, channelId } = useLocalSearchParams<{
    boardId?: string;
    channelId?: string;
  }>();
  const resolvedBoardId = boardId ?? undefined;
  const resolvedChannelId = channelId ?? undefined;

  // Mark channel as read on focus, clear on blur
  useFocusEffect(
    useCallback(() => {
      if (resolvedChannelId) {
        void markAsRead(resolvedChannelId);
      }
      return () => {
        clearViewingRoom();
      };
    }, [resolvedChannelId, markAsRead, clearViewingRoom]),
  );

  const windowKey = resolvedChannelId ? `channel:${resolvedChannelId}` : "";
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null,
  );
  const [selectedAuthor, setSelectedAuthor] =
    useState<ClientProfileSummary | null>(null);
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

  const canReceiveRealtime = canViewMessages;

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

  // Inverted FlashList expects newest-first order (index 0 = newest = visual bottom).
  // Avoid inline reverse() in JSX — it produces a new array every render and
  // makes FlashList think all keys changed, causing layout thrashing.
  const reversedMessages = useMemo(
    () => [...messages].slice().reverse(),
    [messages],
  );

  // Keep live refs in sync every render so the scroll handler always reads
  // fresh values without needing to be memoized with these as deps.
  hasMoreBeforeRef.current = hasMoreBefore;
  hasMoreAfterRef.current = hasMoreAfter;

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
      const distanceFromTop = contentOffset.y;
      const metrics = {
        contentHeight: contentSize.height,
        distanceFromBottom,
        offsetY: contentOffset.y,
        viewportHeight: layoutMeasurement.height,
      };

      lastScrollMetricsRef.current = metrics;
      // With inverted=true, visual bottom = scrollTop=0 (distanceFromTop=0).
      pinnedRef.current =
        !hasMoreAfterRef.current && distanceFromTop <= PINNED_TO_BOTTOM_OFFSET;

      // Drive pagination from scroll position directly — more reliable than
      // FlashList's onStartReached/onEndReached which fire too late.
      // With inverted: visual bottom = distanceFromTop zone → load newer.
      //                visual top   = distanceFromBottom zone → load older.
      const triggerZone = layoutMeasurement.height * 2;
      if (
        distanceFromTop < triggerZone &&
        hasMoreAfterRef.current &&
        !isLoadingNewerRef.current
      ) {
        void handleEndReachedRef.current();
      }
      if (
        distanceFromBottom < triggerZone &&
        hasMoreBeforeRef.current &&
        !isLoadingOlderRef.current
      ) {
        void handleStartReachedRef.current();
      }
    },
    [],
  );

  const scrollToBottom = useCallback(() => {
    // With inverted=true, visual bottom = offset 0.
    flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
    pinnedRef.current = true;
  }, []);

  const handleListLoad = useCallback(() => {
    scrollToBottom();
    setListVisible(true);
  }, [scrollToBottom]);

  // Sticky bottom: present mounted + physically pinned to bottom.
  // messages is oldest-first from the store; newest = last element.
  const newestMessageId = messages[messages.length - 1]?.id;
  useLayoutEffect(() => {
    if (!newestMessageId || hasMoreAfter) return;
    if (!pinnedRef.current) return;

    // Defer one frame so Fabric finishes committing the new item before
    // we call scrollToEnd — prevents RetryableMountingLayerException.
    const frame = requestAnimationFrame(scrollToBottom);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [hasMoreAfter, newestMessageId, scrollToBottom]);

  // User scrolled to BOTTOM while viewing past messages -> load newer.
  // Guarded by hasMoreAfter so it no-ops in the normal present-pinned state.
  const handleEndReached = useCallback(async () => {
    if (
      !hasMoreAfterRef.current ||
      isFetchingNewer ||
      isLoadingNewerRef.current
    )
      return;
    isLoadingNewerRef.current = true;
    setIsLoadingNewer(true);
    try {
      await loadNewer();
    } finally {
      isLoadingNewerRef.current = false;
      setIsLoadingNewer(false);
    }
  }, [isFetchingNewer, loadNewer]);
  handleEndReachedRef.current = handleEndReached;

  // User scrolled to TOP of the list -> load older messages.
  const handleStartReached = useCallback(async () => {
    if (
      !hasMoreBeforeRef.current ||
      isFetchingOlder ||
      isLoadingOlderRef.current
    )
      return;
    isLoadingOlderRef.current = true;
    setIsLoadingOlder(true);
    try {
      await loadOlder();
    } finally {
      isLoadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [isFetchingOlder, loadOlder]);
  handleStartReachedRef.current = handleStartReached;

  // Jump to present: refetch latest page then scroll to the visual bottom.
  const handleGoToPresent = useCallback(async () => {
    await goToPresent(40);
    scrollToBottom();
  }, [goToPresent, scrollToBottom]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const renderMessageItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      // inverted + newest-first: index+1 is the older message (visually above).
      const previous = reversedMessages[index + 1] ?? null;
      const dateSeparatorLabel = getChatDateSeparatorLabel(
        item.createdAt,
        previous?.createdAt,
      );

      if ("type" in item && item.type === "WELCOME") {
        const welcomeUsername = getMessageAuthor(item)?.username ?? null;
        return (
          <WelcomeMessageCard
            boardName={board?.name ?? ""}
            username={welcomeUsername}
          />
        );
      }

      return (
        <ChatItem
          currentProfileId={profile.id}
          dateSeparatorLabel={dateSeparatorLabel}
          isCompact={compactById[item.id] ?? false}
          message={item}
          onLongPress={(message) => setSelectedMessage(message)}
          onAvatarPress={(author) => setSelectedAuthor(author)}
        />
      );
    },
    [board?.name, compactById, reversedMessages, profile.id],
  );

  const handleEndReachedEvent = useCallback(() => {
    void handleEndReached();
  }, [handleEndReached]);

  const handleStartReachedEvent = useCallback(() => {
    void handleStartReached();
  }, [handleStartReached]);

  if (!resolvedBoardId || !resolvedChannelId) {
    return <Redirect href="/boards" />;
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
          pathname: "/boards/[boardId]",
          params: { boardId: resolvedBoardId },
        }}
      />
    );
  }

  if (!board || !channel) return null;

  const channelImageUrl = channel.imageAsset?.url ?? null;

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

      <View style={styles.body}>
        {channel.type !== "TEXT" ? (
          isInThisVoiceChannel ? (
            <VoiceCallView channelId={resolvedChannelId} />
          ) : (
            <View style={styles.centerState}>
              <View style={styles.voiceIconWrap}>
                <Ionicons color={colors.accentPrimary} name="call" size={32} />
              </View>
              <Text style={styles.stateTitle}>Canal de voz</Text>
              <Text style={styles.stateText}>
                Unete a la llamada para ver a los participantes dentro del
                canal.
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
                <View
                  style={[
                    styles.listContainer,
                    { opacity: listVisible ? 1 : 0 },
                  ]}
                >
                  <FlashList
                    key={windowKey}
                    ref={flashListRef}
                    data={reversedMessages}
                    inverted
                    removeClippedSubviews={false}
                    drawDistance={CHAT_DRAW_DISTANCE}
                    extraData={compactById}
                    keyExtractor={keyExtractor}
                    renderItem={renderMessageItem}
                    contentContainerStyle={styles.messagesList}
                    onLoad={handleListLoad}
                    onScroll={handleListScroll}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleStartReachedEvent}
                    onEndReachedThreshold={0.4}
                    onStartReached={handleEndReachedEvent}
                    onStartReachedThreshold={0.4}
                    ListHeaderComponent={
                      isFetchingNewer || isLoadingNewer ? (
                        <ChatPaginationLoader placement="bottom" />
                      ) : null
                    }
                    ListFooterComponent={
                      isFetchingOlder || isLoadingOlder ? (
                        <ChatPaginationLoader placement="top" />
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

            <View>
              <ChannelComposerAccessory
                boardId={resolvedBoardId}
                channelId={resolvedChannelId}
                profileId={profile.id}
                windowKey={windowKey}
                replyTo={replyTo}
                onClearReply={() => setReplyTo(null)}
              />
            </View>
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
        context={{
          type: "channel",
          boardId: resolvedBoardId,
          channelId: resolvedChannelId,
        }}
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
              content.length > 120
                ? `${content.slice(0, 120)}…`
                : content || "Mensaje sin texto",
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
      fontSize: 15,
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
      color: colors.textPrimary,
      fontSize: 15,
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
  });
}
