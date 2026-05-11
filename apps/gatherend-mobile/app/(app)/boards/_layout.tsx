import { Ionicons } from "@expo/vector-icons";
import {
  APP_TAB_BAR_BOTTOM_PADDING,
  APP_TAB_BAR_CONTENT_HEIGHT,
} from "@/src/features/navigation/components/app-bottom-tab-bar";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import {
  Slot,
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { ChannelComposerAccessory } from "@/src/features/chat/components/channel-composer-accessory";
import { useAppShellStore } from "@/src/features/navigation/stores/use-app-shell-store";
import type { BoardHomeTab } from "@/src/features/navigation/stores/use-app-shell-store";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BoardsDrawerSidebar } from "@/src/features/boards/components/boards-drawer-sidebar";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { useUserBoards } from "@/src/features/boards/hooks/use-user-boards";
import { DmDrawerMain } from "@/src/features/conversations/components/dm-drawer-main";
import { ConversationComposerAccessory } from "@/src/features/conversations/components/conversation-composer-accessory";
import { useConversation } from "@/src/features/conversations/hooks/use-conversation";
import { useConversations } from "@/src/features/conversations/hooks/use-conversations";
import { getBoardRules } from "@/src/features/rules/api/get-board-rules";
import { boardRulesQueryKey } from "@/src/features/rules/hooks/use-board-rules";
import { useBoardVoiceParticipantsSocket } from "@/src/features/voice/hooks/use-board-voice-participants-socket";
import { useVoiceStore } from "@/src/features/voice/store/use-voice-store";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { getBoardImageUrl } from "@/src/lib/avatar-utils";
import { useTheme } from "@/src/theme/theme-provider";
import type { BoardChannel } from "@/src/features/boards/types/board";
import {
  generatePaletteFromBase,
  generateLightPaletteFromBase,
  generateGrayPaletteFromBase,
  hexToRgba,
  hexToHsl,
} from "@/src/theme/utils";
import { Text } from "@/src/components/app-typography";

const BOARD_SECTION_TABS = [
  { key: "home", label: "Casa", icon: "home-outline" },
  { key: "chats", label: "Chats", icon: "chatbubble-ellipses-outline" },
  { key: "forum", label: "Foro", icon: "chatbox-outline" },
  { key: "featured", label: "Destacado", icon: "star-outline" },
  { key: "rules", label: "Reglas", icon: "document-text-outline" },
  { key: "wiki", label: "Wiki", icon: "book-outline" },
  { key: "ranking", label: "Ranking", icon: "trophy-outline" },
  { key: "members", label: "Miembros", icon: "people-outline" },
  { key: "invite", label: "Invitar amigos", icon: "person-add-outline" },
  { key: "settings", label: "Ajustes", icon: "settings-outline" },
] as const;

const HOME_OPTIMISTIC_TABS = [
  { key: "rules", label: "Reglas" },
  { key: "chats", label: "Chats" },
  { key: "forum", label: "Foro" },
  { key: "wiki", label: "Wiki" },
  { key: "featured", label: "Destacado" },
  { key: "ranking", label: "Ranking" },
] as const;

const HOME_OPTIMISTIC_TAB_WIDTH = 110;

function getHomeOptimisticTabIndex(tab: BoardHomeTab) {
  const index = HOME_OPTIMISTIC_TABS.findIndex((item) => item.key === tab);
  return index >= 0 ? index : 0;
}

type PendingRoute =
  | { type: "home" }
  | {
      type: "channel";
      channelId: string;
      name: string;
      channelType: BoardChannel["type"];
    }
  | {
      type: "conversation";
      conversationId: string;
      participantName: string;
    };

type DrawerChannelsPreviewProps = {
  channels: BoardChannel[];
  isLoading: boolean;
  activeChannelId?: string;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
  boardColors: ReturnType<typeof generatePaletteFromBase> | null;
  onChannelPressIn?: () => void;
  onSelectChannel: (channel: BoardChannel) => void;
};

function DrawerChannelsPreview({
  channels,
  isLoading,
  activeChannelId,
  styles,
  colors,
  boardColors,
  onChannelPressIn,
  onSelectChannel,
}: DrawerChannelsPreviewProps) {
  const sortedChannels = useMemo(
    () => [...channels].sort((a, b) => a.position - b.position),
    [channels],
  );

  return (
    <View style={styles.drawerChannelsSection}>
      {isLoading ? (
        <View style={styles.drawerChannelsList}>
          {Array.from({ length: 5 }).map((_, index) => (
            <View key={index} style={styles.drawerChannelSkeletonRow}>
              <View style={styles.drawerChannelSkeletonIcon} />
              <View style={styles.drawerChannelSkeletonCopy}>
                <View style={styles.drawerChannelSkeletonTitle} />
                <View style={styles.drawerChannelSkeletonMeta} />
              </View>
            </View>
          ))}
        </View>
      ) : sortedChannels.length > 0 ? (
        <View style={styles.drawerChannelsList}>
          {sortedChannels.map((channel) => {
            const isActive = channel.id === activeChannelId;
            const imageUrl = channel.imageAsset?.url ?? null;
            return (
              <Pressable
                key={channel.id}
                onPressIn={onChannelPressIn}
                onPress={() => onSelectChannel(channel)}
                style={[
                  styles.drawerChannelRow,
                  isActive ? styles.drawerChannelRowActive : null,
                  boardColors && isActive
                    ? {
                        backgroundColor: boardColors.channelTypeActiveSoftBg,
                        borderColor: boardColors.channelTypeActiveSoftBg,
                      }
                    : null,
                ]}
              >
                <View
                  style={[
                    styles.drawerChannelIcon,
                    imageUrl ? styles.drawerChannelIconWithImage : null,
                  ]}
                >
                  {imageUrl ? (
                    <>
                      <Image
                        contentFit="cover"
                        source={{ uri: imageUrl }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          styles.drawerChannelIconImageOverlay,
                        ]}
                      />
                    </>
                  ) : null}
                  <Ionicons
                    color={
                      isActive
                        ? colors.accentPrimary
                        : (boardColors?.textPrimary ?? colors.textPrimary)
                    }
                    name={
                      channel.type === "VOICE"
                        ? "volume-high-outline"
                        : channel.type === "FORUM"
                          ? "chatbox-outline"
                          : channel.type === "WIKI"
                            ? "book-outline"
                            : "chatbubble-ellipses-outline"
                    }
                    size={19}
                  />
                </View>
                <View style={styles.drawerChannelCopy}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.drawerChannelName,
                      boardColors ? { color: boardColors.textPrimary } : null,
                      isActive ? styles.drawerChannelNameActive : null,
                    ]}
                  >
                    /{channel.name}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text
          style={[
            styles.drawerChannelsEmpty,
            boardColors ? { color: boardColors.textMuted } : null,
          ]}
        >
          Todavia no hay canales.
        </Text>
      )}
    </View>
  );
}

function getSettingsSubviewTitle(pathname: string) {
  if (pathname.includes("/settings/general")) return "General";
  if (pathname.includes("/settings/members")) return "Miembros";
  if (pathname.includes("/settings/bans")) return "Bans";
  if (pathname.includes("/settings/history")) return "Historial de moderacion";
  if (pathname.includes("/settings/danger")) return "Zona de peligro";
  return null;
}

function getBoardInitial(name: string | undefined) {
  return name?.trim().charAt(0).toUpperCase() || "...";
}

function getBoardIdFromPathname(pathname: string) {
  const match = pathname.match(/^\/boards\/([^/]+)/);
  const segment = match?.[1];
  if (!segment || segment === "dm") return undefined;
  return decodeURIComponent(segment);
}

export default function BoardShellLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const setLastBoardId = useAppShellStore((state) => state.setLastBoardId);
  const lastConversationId = useAppShellStore(
    (state) => state.lastConversationId,
  );
  const setLastConversationId = useAppShellStore(
    (state) => state.setLastConversationId,
  );
  const { data: conversations = [], isLoading: isConversationsLoading } =
    useConversations();
  const setIsBoardDrawerOpen = useAppShellStore(
    (state) => state.setIsBoardDrawerOpen,
  );
  const {
    boardId,
    channelId,
    conversationId: conversationIdParam,
  } = useGlobalSearchParams<{
    boardId?: string;
    channelId?: string;
    conversationId?: string;
  }>();
  const routeBoardId =
    (Array.isArray(boardId) ? boardId[0] : boardId) ??
    getBoardIdFromPathname(pathname);
  const routeChannelId = Array.isArray(channelId) ? channelId[0] : channelId;
  const routeConversationId = Array.isArray(conversationIdParam)
    ? conversationIdParam[0]
    : conversationIdParam;
  const isOnDmRoute = pathname.includes("/boards/dm/");
  const [isDmDrawerActive, setIsDmDrawerActive] = useState(false);
  const [drawerBoardId, setDrawerBoardId] = useState(routeBoardId);
  const activeBoardId = drawerBoardId ?? routeBoardId;
  const optimisticHomeTab =
    useAppShellStore((state) =>
      activeBoardId ? state.lastHomeTabByBoardId[activeBoardId] : undefined,
    ) ?? "rules";
  const optimisticHomeTabIndex = getHomeOptimisticTabIndex(optimisticHomeTab);
  const {
    data: board,
    isError: boardError,
    isLoading: boardLoading,
  } = useBoard(activeBoardId);
  const startConnecting = useVoiceStore((s) => s.startConnecting);
  const dmVoiceChannelId = useVoiceStore((state) => state.channelId);
  const dmVoiceIsConnecting = useVoiceStore((state) => state.isConnecting);
  const dmVoiceIsConnected = useVoiceStore((state) => state.isConnected);
  const dmVoiceContext = useVoiceStore((state) => state.context);
  const isInThisDmCall =
    isOnDmRoute &&
    dmVoiceContext === "conversation" &&
    routeConversationId === dmVoiceChannelId &&
    (dmVoiceIsConnecting || dmVoiceIsConnected);
  const conversationQuery = useConversation(
    isOnDmRoute ? routeConversationId : undefined,
  );
  useBoardVoiceParticipantsSocket(activeBoardId);
  const { data: userBoards = [], isFetched: userBoardsFetched } =
    useUserBoards();
  const boardDisplayAsset = board?.bannerAsset ?? board?.imageAsset ?? null;
  const chatChannels = useMemo(
    () =>
      (board?.channels ?? []).filter(
        (channel) => channel.type === "TEXT" || channel.type === "VOICE",
      ),
    [board?.channels],
  );
  const forumChannels = useMemo(
    () => (board?.channels ?? []).filter((channel) => channel.type === "FORUM"),
    [board?.channels],
  );
  const wikiChannels = useMemo(
    () => (board?.channels ?? []).filter((channel) => channel.type === "WIKI"),
    [board?.channels],
  );
  const boardImageUrl = board
    ? getBoardImageUrl(boardDisplayAsset?.url, board.id, board.name, 512)
    : null;
  const hasBoardHeaderImage = Boolean(board?.imageAsset?.url);

  const boardColors = useMemo(() => {
    const raw =
      board?.bannerAsset?.dominantColor ?? board?.imageAsset?.dominantColor;
    if (!raw) return null;
    let hex: string | null = null;
    const rgbMatch = raw.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      hex = `#${Number(r).toString(16).padStart(2, "0")}${Number(g).toString(16).padStart(2, "0")}${Number(b).toString(16).padStart(2, "0")}`;
    } else if (/^#[0-9A-Fa-f]{6}$/.test(raw)) {
      hex = raw;
    } else if (/^[0-9A-Fa-f]{6}$/.test(raw)) {
      hex = `#${raw}`;
    }
    if (!hex) return null;
    const { s } = hexToHsl(hex);
    if (s < 10) return generateGrayPaletteFromBase(hex);
    return mode === "dark"
      ? generatePaletteFromBase(hex)
      : generateLightPaletteFromBase(hex);
  }, [
    board?.bannerAsset?.dominantColor,
    board?.imageAsset?.dominantColor,
    mode,
  ]);

  const isBoardPathname = pathname.startsWith("/boards");
  const isModalPathname = pathname.startsWith("/modal/");

  useEffect(() => {
    if (boardLoading || !boardError) return;
    if (!userBoardsFetched) return;
    if (activeBoardId && userBoards.some((b) => b.id === activeBoardId)) return;

    const firstBoard = userBoards.find((b) => b.id !== activeBoardId);
    if (firstBoard) {
      router.replace({
        pathname: "/boards/[boardId]/home",
        params: { boardId: firstBoard.id },
      });
    } else {
      router.replace("/boards");
    }
  }, [
    boardError,
    boardLoading,
    activeBoardId,
    userBoards,
    userBoardsFetched,
    router,
  ]);

  // Track first successful load — board switches must never show the overlay
  const hasInitializedRef = useRef(false);
  if (board && userBoardsFetched) hasInitializedRef.current = true;
  const isDrawerResolved = !isBoardPathname || hasInitializedRef.current;
  const routeIsHome = pathname.includes("/home");
  const [pendingRoute, setPendingRoute] = useState<PendingRoute | null>(null);
  const pendingOptimisticNavigationRef = useRef<
    | { type: "home"; boardId: string }
    | {
        type: "channel";
        boardId: string;
        channelId: string;
        channelType: BoardChannel["type"];
      }
    | { type: "conversation"; conversationId: string }
    | null
  >(null);
  const isHome = pendingRoute ? pendingRoute.type === "home" : routeIsHome;
  const showDmHeader = isOnDmRoute || pendingRoute?.type === "conversation";
  const displayedDmParticipantName =
    pendingRoute?.type === "conversation"
      ? pendingRoute.participantName
      : (conversationQuery.data?.otherProfile.username ?? "");
  const isShowingPendingOptimistic =
    pendingRoute !== null &&
    (pendingRoute.type === "home"
      ? !routeIsHome
      : pendingRoute.type === "channel"
        ? routeChannelId !== pendingRoute.channelId
        : routeConversationId !== pendingRoute.conversationId);
  const resolvedTabLabel = (
    key: (typeof BOARD_SECTION_TABS)[number]["key"],
  ) => {
    const custom = board?.tabNames?.[key as keyof typeof board.tabNames];
    const fallback =
      BOARD_SECTION_TABS.find((t) => t.key === key)?.label ?? key;
    return custom && custom.trim() ? custom.trim() : fallback;
  };
  const settingsSubviewTitle = getSettingsSubviewTitle(pathname);
  const boardTitle = board?.name ?? "Loading...";
  const routeChannel = routeChannelId
    ? (board?.channels.find((c) => c.id === routeChannelId) ?? null)
    : null;
  const displayedRouteChannel =
    pendingRoute?.type === "channel"
      ? { id: pendingRoute.channelId, name: pendingRoute.name }
      : routeChannel;
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  useEffect(() => {
    if (!pendingRoute) return;
    let reached = false;
    if (pendingRoute.type === "home") reached = routeIsHome;
    else if (pendingRoute.type === "channel")
      reached = routeChannelId === pendingRoute.channelId;
    else reached = routeConversationId === pendingRoute.conversationId;
    if (reached) setPendingRoute(null);
  }, [pendingRoute, routeIsHome, routeChannelId, routeConversationId]);

  useEffect(() => {
    if (isOnDmRoute) setIsDmDrawerActive(true);
  }, [isOnDmRoute]);

  useEffect(() => {
    if (routeBoardId) setDrawerBoardId(routeBoardId);
  }, [routeBoardId]);

  useEffect(() => {
    if (activeBoardId) setLastBoardId(activeBoardId);
  }, [activeBoardId, setLastBoardId]);

  useEffect(() => {
    if (!activeBoardId || !routeIsHome) return;
    void queryClient.prefetchQuery({
      queryKey: boardRulesQueryKey(activeBoardId),
      queryFn: () => getBoardRules(activeBoardId),
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    });
  }, [routeIsHome, activeBoardId, queryClient]);

  // foregroundX: screenWidth = drawer visible (foreground off-screen right)
  //              0           = foreground visible (covering drawer)
  const foregroundX = useRef(
    new Animated.Value(Dimensions.get("window").width),
  ).current;
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [drawerSheetVisible, setDrawerSheetVisible] = useState(false);

  // When leaving boards, reset so next entry always lands on drawer.
  // Skip when navigating to a modal — the modal overlays the board shell and
  // we want to return to the foreground state when it closes.
  useEffect(() => {
    if (!isBoardPathname && !isModalPathname) {
      foregroundX.setValue(Dimensions.get("window").width);
      setIsBoardDrawerOpen(false);
    }
  }, [isBoardPathname, isModalPathname, foregroundX, setIsBoardDrawerOpen]);

  const showForeground = useCallback(
    (onFinish?: () => void) => {
      setIsDrawerOpen(false);
      setIsBoardDrawerOpen(false);
      Animated.spring(foregroundX, {
        toValue: 0,
        damping: 22,
        stiffness: 230,
        mass: 0.8,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onFinish?.();
        }
      });
    },
    [foregroundX, isDrawerOpen, pathname, setIsBoardDrawerOpen],
  );

  const showDrawer = useCallback(
    (onFinish?: () => void) => {
      Animated.timing(foregroundX, {
        toValue: screenWidth,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsDrawerOpen(true);
          setIsBoardDrawerOpen(true);
          onFinish?.();
        }
      });
    },
    [foregroundX, isDrawerOpen, pathname, screenWidth, setIsBoardDrawerOpen],
  );

  const startPendingOptimisticNavigation = useCallback(() => {
    const pending = pendingOptimisticNavigationRef.current;
    if (!pending || !pendingRoute) return;
    pendingOptimisticNavigationRef.current = null;
    showForeground();
    if (pending.type === "channel") {
      if (pending.channelType === "FORUM") {
        router.replace({
          pathname: "/boards/[boardId]/forum/[channelId]",
          params: { boardId: pending.boardId, channelId: pending.channelId },
        });
      } else if (pending.channelType === "WIKI") {
        router.replace({
          pathname: "/boards/[boardId]/wiki/[channelId]",
          params: { boardId: pending.boardId, channelId: pending.channelId },
        });
      } else {
        router.replace({
          pathname: "/boards/[boardId]/chats/[channelId]",
          params: { boardId: pending.boardId, channelId: pending.channelId },
        });
      }
    } else if (pending.type === "conversation") {
      router.replace({
        pathname: "/boards/dm/[conversationId]",
        params: { conversationId: pending.conversationId },
      });
    } else {
      router.replace({
        pathname: "/boards/[boardId]/home",
        params: { boardId: pending.boardId },
      });
    }
  }, [pendingRoute, router, showForeground]);

  const handleSelectConversation = useCallback(
    (conversationId: string, participantName: string) => {
      setLastConversationId(conversationId);
      if (routeConversationId === conversationId) {
        // Already pre-loaded by onDmPress — just open the foreground
        showForeground();
        return;
      }
      pendingOptimisticNavigationRef.current = {
        type: "conversation",
        conversationId,
      };
      setPendingRoute({
        type: "conversation",
        conversationId,
        participantName,
      });
    },
    [setLastConversationId, routeConversationId, showForeground],
  );

  const handleSelectDrawerChannel = useCallback(
    (channel: BoardChannel) => {
      if (!activeBoardId) return;

      if (channel.type === "VOICE") {
        const voiceState = useVoiceStore.getState();
        const isInThisVoiceChannel =
          voiceState.context === "board" &&
          voiceState.channelId === channel.id &&
          (voiceState.isConnected || voiceState.isConnecting);

        if (!isInThisVoiceChannel) {
          startConnecting(channel.id, channel.name, "board", activeBoardId);
          showForeground();
          return;
        }
      }

      pendingOptimisticNavigationRef.current = {
        type: "channel",
        boardId: activeBoardId,
        channelId: channel.id,
        channelType: channel.type,
      };
      setPendingRoute({
        type: "channel",
        channelId: channel.id,
        name: channel.name,
        channelType: channel.type,
      });
    },
    [activeBoardId, showForeground, startConnecting],
  );

  // Swipe left on drawer → show foreground
  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dx < -8 && Math.abs(gesture.dy) < Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          setIsBoardDrawerOpen(false);
          foregroundX.stopAnimation();
        },
        onPanResponderMove: (_event, gesture) => {
          const next = Math.min(
            screenWidth,
            Math.max(0, screenWidth + gesture.dx),
          );
          foregroundX.setValue(next);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -screenWidth * 0.26 || gesture.vx < -0.45) {
            showForeground();
          } else {
            showDrawer();
          }
        },
        onPanResponderTerminate: () => {
          showDrawer();
        },
      }),
    [
      foregroundX,
      isDrawerOpen,
      pathname,
      screenWidth,
      showForeground,
      showDrawer,
    ],
  );

  // Swipe right on foreground → show drawer
  const foregroundPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dx > 8 && Math.abs(gesture.dy) < Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          foregroundX.stopAnimation();
        },
        onPanResponderMove: (_event, gesture) => {
          const next = Math.min(screenWidth, Math.max(0, gesture.dx));
          foregroundX.setValue(next);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx > screenWidth * 0.26 || gesture.vx > 0.45) {
            showDrawer();
          } else {
            showForeground();
          }
        },
        onPanResponderTerminate: () => {
          showForeground();
        },
      }),
    [
      foregroundX,
      isDrawerOpen,
      pathname,
      screenWidth,
      showForeground,
      showDrawer,
    ],
  );
  const bottomTabBarHeight =
    APP_TAB_BAR_CONTENT_HEIGHT +
    Math.max(insets.bottom, APP_TAB_BAR_BOTTOM_PADDING);

  return (
    <View style={styles.safeArea}>
      {!isBoardPathname ? (
        <Slot />
      ) : (
        <>
          {/* BACKGROUND: drawer only — fixed, never moves */}
          <View
            pointerEvents="box-none"
            style={[
              styles.background,
              {
                bottom: bottomTabBarHeight,
              },
            ]}
          >
            <View
              style={[styles.drawerRow, { paddingTop: insets.top }]}
              {...drawerPanResponder.panHandlers}
            >
              <BoardsDrawerSidebar
                currentBoardId={isDmDrawerActive ? undefined : activeBoardId}
                isDmActive={isDmDrawerActive}
                onDmPress={() => {
                  setIsDmDrawerActive(true);
                  const conversationId =
                    lastConversationId ?? conversations[0]?.id;
                  showDrawer(() => {
                    if (conversationId) {
                      router.replace({
                        pathname: "/boards/dm/[conversationId]",
                        params: { conversationId },
                      });
                    }
                  });
                }}
                onCreateBoard={() => {
                  router.push("/modal/create-board");
                }}
                onSelectBoard={(nextBoardId) => {
                  if (!nextBoardId) return;
                  setIsDmDrawerActive(false);
                  if (nextBoardId === activeBoardId && !isOnDmRoute) {
                    showDrawer();
                    return;
                  }
                  setDrawerBoardId(nextBoardId);
                  setIsDrawerOpen(true);
                  setIsBoardDrawerOpen(true);
                  foregroundX.setValue(screenWidth);
                  router.replace({
                    pathname: "/boards/[boardId]/home",
                    params: { boardId: nextBoardId },
                  });
                }}
              />

              <View
                style={[
                  styles.drawerMain,
                  boardColors && !isDmDrawerActive
                    ? { backgroundColor: boardColors.bgSecondary }
                    : null,
                ]}
              >
                {isDmDrawerActive ? (
                  isConversationsLoading && conversations.length === 0 ? (
                    <View style={styles.dmLoadingContainer}>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <View key={index} style={styles.dmSkeletonRow}>
                          <View style={styles.dmSkeletonAvatar} />
                          <View style={styles.drawerChannelSkeletonCopy}>
                            <View style={styles.drawerChannelSkeletonTitle} />
                            <View style={styles.drawerChannelSkeletonMeta} />
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <DmDrawerMain
                      activeConversationId={
                        routeConversationId ??
                        lastConversationId ??
                        conversations[0]?.id
                      }
                      onConversationPressIn={() => {
                        setIsBoardDrawerOpen(false);
                      }}
                      onSelectConversation={handleSelectConversation}
                    />
                  )
                ) : (
                  <>
                    <Pressable
                      onPress={() => setDrawerSheetVisible(true)}
                      style={({ pressed }) => [
                        styles.boardHeader,
                        pressed && styles.actionPressed,
                      ]}
                    >
                      {boardImageUrl ? (
                        <Image
                          contentFit="cover"
                          source={{ uri: boardImageUrl }}
                          style={styles.boardImage}
                        />
                      ) : (
                        <View
                          style={[
                            styles.boardImageFallback,
                            boardColors
                              ? { backgroundColor: boardColors.bgQuaternary }
                              : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.boardImageFallbackText,
                              boardColors
                                ? { color: boardColors.textPrimary }
                                : null,
                            ]}
                          >
                            {getBoardInitial(board?.name)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.boardNameRow}>
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.boardName,
                            boardColors
                              ? { color: boardColors.textPrimary }
                              : null,
                          ]}
                        >
                          {boardTitle}
                        </Text>
                        <Ionicons
                          name="ellipsis-vertical"
                          size={20}
                          color={
                            boardColors
                              ? boardColors.textPrimary
                              : colors.textPrimary
                          }
                        />
                      </View>
                    </Pressable>

                    <View style={styles.drawerGroup}>
                      <View style={styles.tabsColumn}>
                        <View
                          style={[
                            styles.tabSeparator,
                            boardColors
                              ? { borderTopColor: boardColors.borderPrimary }
                              : null,
                          ]}
                        />
                        <Pressable
                          onPressIn={() => {
                            setIsBoardDrawerOpen(false);
                          }}
                          onPress={() => {
                            if (!activeBoardId) return;
                            pendingOptimisticNavigationRef.current = {
                              type: "home",
                              boardId: activeBoardId,
                            };
                            setPendingRoute({ type: "home" });
                          }}
                          style={({ pressed }) => [
                            styles.tabButton,
                            isHome ? styles.tabButtonActive : null,
                            boardColors && isHome
                              ? {
                                  backgroundColor:
                                    boardColors.channelTypeActiveSoftBg,
                                  borderColor:
                                    boardColors.channelTypeActiveSoftBg,
                                }
                              : null,
                            pressed ? styles.actionPressed : null,
                          ]}
                        >
                          <Ionicons
                            color={
                              boardColors
                                ? boardColors.textPrimary
                                : colors.textPrimary
                            }
                            name="home-outline"
                            size={19}
                          />
                          <Text
                            ellipsizeMode="tail"
                            numberOfLines={1}
                            style={[
                              styles.tabButtonText,
                              boardColors
                                ? { color: boardColors.textPrimary }
                                : null,
                            ]}
                          >
                            {resolvedTabLabel("home")}
                          </Text>
                        </Pressable>

                        <ScrollView
                          contentContainerStyle={
                            styles.drawerChannelsScrollContent
                          }
                          showsVerticalScrollIndicator={false}
                          style={styles.drawerChannelsScroll}
                        >
                          <DrawerChannelsPreview
                            activeChannelId={routeChannelId}
                            boardColors={boardColors}
                            channels={board?.channels ?? []}
                            colors={colors}
                            isLoading={boardLoading && !board}
                            onChannelPressIn={() => {
                              setIsBoardDrawerOpen(false);
                            }}
                            onSelectChannel={handleSelectDrawerChannel}
                            styles={styles}
                          />
                        </ScrollView>
                      </View>
                    </View>
                    <BottomSheet
                      visible={drawerSheetVisible}
                      onClose={() => setDrawerSheetVisible(false)}
                    >
                      <Pressable
                        onPress={() => {
                          setDrawerSheetVisible(false);
                          if (!activeBoardId) return;
                          showForeground(() => {
                            router.replace({
                              pathname: "/boards/[boardId]/invite",
                              params: { boardId: activeBoardId },
                            });
                          });
                        }}
                        style={({ pressed }) => [
                          styles.sheetOption,
                          pressed && styles.sheetOptionPressed,
                        ]}
                      >
                        <Text style={styles.sheetOptionText}>
                          Invitar amigos
                        </Text>
                      </Pressable>
                      <View style={styles.sheetDivider} />
                      <Pressable
                        onPress={() => {
                          setDrawerSheetVisible(false);
                          if (!activeBoardId) return;
                          showForeground(() => {
                            router.replace({
                              pathname: "/boards/[boardId]/settings",
                              params: { boardId: activeBoardId },
                            });
                          });
                        }}
                        style={({ pressed }) => [
                          styles.sheetOption,
                          pressed && styles.sheetOptionPressed,
                        ]}
                      >
                        <Text style={styles.sheetOptionText}>
                          Ajustes del board
                        </Text>
                      </Pressable>
                      <View style={styles.sheetDivider} />
                      <Pressable
                        onPress={() => {
                          setDrawerSheetVisible(false);
                          if (!activeBoardId) return;
                          router.push({
                            pathname: "/modal/create-channel",
                            params: { boardId: activeBoardId },
                          });
                        }}
                        style={({ pressed }) => [
                          styles.sheetOption,
                          pressed && styles.sheetOptionPressed,
                        ]}
                      >
                        <Text style={styles.sheetOptionText}>Crear canal</Text>
                      </Pressable>
                    </BottomSheet>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* FOREGROUND: slides over background — translateX screenWidth=hidden, 0=visible */}
          <Animated.View
            pointerEvents={isDrawerOpen ? "none" : "auto"}
            style={[
              styles.foreground,
              { transform: [{ translateX: foregroundX }] },
            ]}
            {...(!isHome ? foregroundPanResponder.panHandlers : {})}
          >
            <View style={[styles.header, { paddingTop: insets.top }]}>
              {boardImageUrl && !showDmHeader ? (
                <>
                  <Image
                    contentFit="cover"
                    source={{ uri: boardImageUrl }}
                    style={styles.headerBackgroundImage}
                  />
                  <View style={styles.headerBackgroundOverlay} />
                </>
              ) : null}

              {showDmHeader ? (
                <>
                  <Pressable
                    accessibilityHint="Abre la lista de mensajes directos"
                    accessibilityRole="button"
                    accessibilityLabel="Mensajes directos"
                    onPress={() => showDrawer()}
                    style={styles.menuButton}
                  >
                    <Ionicons
                      color={colors.textPrimary}
                      name="menu"
                      size={22}
                    />
                  </Pressable>

                  <View style={styles.headerCopy}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                      {displayedDmParticipantName || "..."}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityLabel={
                      isInThisDmCall ? "Llamada en curso" : "Iniciar llamada"
                    }
                    accessibilityRole="button"
                    disabled={isInThisDmCall || !conversationQuery.data}
                    onPress={() => {
                      if (
                        !routeConversationId ||
                        !conversationQuery.data ||
                        isInThisDmCall
                      )
                        return;
                      startConnecting(
                        routeConversationId,
                        conversationQuery.data.otherProfile.username,
                        "conversation",
                      );
                    }}
                    style={({ pressed }) => [
                      styles.menuButton,
                      isInThisDmCall ? styles.menuButtonCall : null,
                      pressed ? styles.menuButtonPressed : null,
                    ]}
                  >
                    <Ionicons
                      color={
                        isInThisDmCall ? colors.textInverse : colors.textPrimary
                      }
                      name={isInThisDmCall ? "call" : "call-outline"}
                      size={20}
                    />
                  </Pressable>
                </>
              ) : (
                <>
                  {settingsSubviewTitle ? (
                    <Pressable
                      accessibilityHint="Regresa a ajustes del board"
                      accessibilityRole="button"
                      accessibilityLabel="Volver"
                      onPress={() => {
                        if (!activeBoardId) return;
                        router.replace({
                          pathname: "/boards/[boardId]/settings",
                          params: { boardId: activeBoardId },
                        });
                      }}
                      style={({ pressed }) => [
                        styles.menuButton,
                        pressed ? styles.menuButtonPressed : null,
                      ]}
                    >
                      <Ionicons
                        color={colors.textPrimary}
                        name="arrow-back"
                        size={21}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityHint="Abre el drawer izquierdo del board"
                      accessibilityRole="button"
                      accessibilityLabel="Abrir drawer"
                      onPress={() => showDrawer()}
                      style={[
                        styles.menuButton,
                        hasBoardHeaderImage
                          ? {
                              backgroundColor: hexToRgba(
                                colors.bgQuaternary,
                                0.5,
                              ),
                            }
                          : null,
                      ]}
                    >
                      <Ionicons
                        color={colors.textPrimary}
                        name="menu"
                        size={22}
                      />
                    </Pressable>
                  )}

                  <View style={styles.headerCopy}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                      {settingsSubviewTitle ?? boardTitle}
                    </Text>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                      {settingsSubviewTitle
                        ? boardTitle
                        : displayedRouteChannel
                          ? `/ ${displayedRouteChannel.name}`
                          : resolvedTabLabel("home")}
                    </Text>
                  </View>

                  {activeBoardId ? (
                    <Pressable
                      accessibilityLabel="Ver miembros"
                      accessibilityRole="button"
                      onPress={() => {
                        router.push({
                          pathname: "/modal/board-members",
                          params: { boardId: activeBoardId },
                        });
                      }}
                      style={({ pressed }) => [
                        styles.menuButton,
                        hasBoardHeaderImage
                          ? {
                              backgroundColor: hexToRgba(
                                colors.bgQuaternary,
                                0.5,
                              ),
                            }
                          : null,
                        pressed ? styles.menuButtonPressed : null,
                      ]}
                    >
                      <Ionicons
                        color={colors.textPrimary}
                        name="people-outline"
                        size={20}
                      />
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>

            <View style={[styles.content, { paddingBottom: insets.bottom }]}>
              <View style={styles.routeContent}>
                <Slot />
                {isShowingPendingOptimistic ? (
                  <View
                    pointerEvents="auto"
                    onLayout={() => startPendingOptimisticNavigation()}
                    style={styles.pendingSectionOverlay}
                  >
                    {pendingRoute?.type === "home" ? (
                      <View style={styles.homeOptimisticShell}>
                        <View style={styles.homeOptimisticTabBarWrapper}>
                          <ScrollView
                            horizontal
                            bounces={false}
                            contentContainerStyle={styles.homeOptimisticTabBar}
                            showsHorizontalScrollIndicator={false}
                          >
                            {HOME_OPTIMISTIC_TABS.map((tab) => (
                              <View
                                key={tab.key}
                                style={[
                                  styles.homeOptimisticTabBarItem,
                                  { width: HOME_OPTIMISTIC_TAB_WIDTH },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.homeOptimisticTabBarLabel,
                                    tab.key === optimisticHomeTab
                                      ? styles.homeOptimisticTabBarLabelActive
                                      : null,
                                  ]}
                                >
                                  {tab.label}
                                </Text>
                              </View>
                            ))}
                            <View
                              style={[
                                styles.homeOptimisticTabBarIndicator,
                                {
                                  transform: [
                                    {
                                      translateX:
                                        HOME_OPTIMISTIC_TAB_WIDTH *
                                        optimisticHomeTabIndex,
                                    },
                                  ],
                                  width: HOME_OPTIMISTIC_TAB_WIDTH,
                                },
                              ]}
                            />
                          </ScrollView>
                        </View>
                        <View style={styles.homeOptimisticContent} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
              {isShowingPendingOptimistic &&
              pendingRoute?.type === "channel" &&
              (pendingRoute.channelType === "TEXT" ||
                pendingRoute.channelType === "VOICE") &&
              activeBoardId ? (
                <ChannelComposerAccessory
                  boardId={activeBoardId}
                  channelId={pendingRoute.channelId}
                  profileId={profile.id}
                  windowKey={`channel:${pendingRoute.channelId}`}
                  replyTo={null}
                  onClearReply={() => {}}
                />
              ) : null}
              {isShowingPendingOptimistic &&
              pendingRoute?.type === "conversation" ? (
                <ConversationComposerAccessory
                  conversationId={pendingRoute.conversationId}
                  profileId={profile.id}
                  windowKey={`conversation:${pendingRoute.conversationId}`}
                  replyTo={null}
                  onClearReply={() => {}}
                />
              ) : null}
            </View>

            {isHome && (
              <View
                style={styles.homeEdgeZone}
                {...foregroundPanResponder.panHandlers}
              />
            )}
          </Animated.View>

          {!isDrawerResolved ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={colors.accentPrimary} size="small" />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  mode: "dark" | "light",
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: "transparent",
    },
    // Fixed background: drawer + tab bar
    background: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bgSecondary,
      flexDirection: "column",
      zIndex: 0,
    },
    drawerRow: {
      flex: 1,
      flexDirection: "row",
    },
    // Foreground slides over the background
    foreground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bgPrimary,
      flexDirection: "column",
      zIndex: 1,
    },
    loadingOverlay: {
      alignItems: "center",
      backgroundColor: colors.bgPrimary,
      bottom: 0,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 50,
    },
    header: {
      alignItems: "center",
      backgroundColor: colors.bgPrimary,
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 12,
      overflow: "hidden",
      paddingHorizontal: 16,
      paddingBottom: 8,
      position: "relative",
    },
    headerBackgroundImage: {
      bottom: 0,
      left: 0,
      opacity: 0.78,
      position: "absolute",
      right: 0,
      top: 0,
    },
    headerBackgroundOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor:
        mode === "light" ? "rgba(240,240,245,0.42)" : "rgba(0,0,0,0.46)",
    },
    menuButton: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 16,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      overflow: "hidden",
      zIndex: 1,
      width: 44,
    },
    menuButtonPressed: {
      opacity: 0.9,
    },
    menuButtonCall: {
      backgroundColor: colors.accentPrimary,
      borderColor: colors.accentPrimary,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
      zIndex: 1,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      lineHeight: 24,
    },
    headerSubtitle: {
      color: colors.textMuted,
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 22,
    },
    content: {
      flex: 1,
    },
    routeContent: {
      flex: 1,
    },
    pendingSectionOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bgPrimary,
    },
    homeOptimisticShell: {
      flex: 1,
    },
    homeOptimisticTabBarWrapper: {
      backgroundColor: colors.tabButtonBg,
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
    },
    homeOptimisticTabBar: {
      flexDirection: "row",
      position: "relative",
    },
    homeOptimisticTabBarItem: {
      alignItems: "center",
      paddingVertical: 11,
    },
    homeOptimisticTabBarLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
    homeOptimisticTabBarLabelActive: {
      color: colors.textPrimary,
    },
    homeOptimisticTabBarIndicator: {
      backgroundColor: colors.accentPrimary,
      borderRadius: 1,
      bottom: 0,
      height: 2,
      left: 0,
      position: "absolute",
    },
    homeOptimisticContent: {
      backgroundColor: colors.bgPrimary,
      flex: 1,
    },
    homeEdgeZone: {
      bottom: 0,
      left: 0,
      position: "absolute",
      top: 0,
      width: 44,
      zIndex: 1,
    },
    drawerMain: {
      flex: 1,
    },
    dmLoadingContainer: {
      flex: 1,
      gap: 4,
      paddingHorizontal: 12,
      paddingTop: 12,
    },
    dmSkeletonRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    dmSkeletonAvatar: {
      backgroundColor: colors.bgQuaternary,
      borderRadius: 20,
      flexShrink: 0,
      height: 40,
      opacity: 0.7,
      width: 40,
    },
    boardHeader: {
      gap: 12,
    },
    boardImage: {
      backgroundColor: colors.bgQuaternary,
      height: 124,
      width: "100%",
    },
    boardImageFallback: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      height: 124,
      justifyContent: "center",
      width: "100%",
    },
    boardImageFallbackText: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "800",
    },
    boardNameRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 12,
    },
    boardName: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 20,
      fontWeight: "800",
      lineHeight: 24,
    },
    drawerGroup: {
      flex: 1,
      marginTop: 7,
      paddingBottom: 16,
      paddingHorizontal: 12,
    },
    drawerChannelsScroll: {
      flex: 1,
      marginBottom: 0,
      marginTop: 2,
    },
    drawerChannelsScrollContent: {
      paddingBottom: 2,
    },
    drawerChannelsSection: {
      gap: 7,
    },
    drawerChannelsList: {
      gap: 5,
    },
    drawerChannelRow: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderRadius: 11,
      borderWidth: 1,
      flexDirection: "row",
      gap: 9,
      minHeight: 44,
      paddingHorizontal: 9,
      paddingVertical: 6,
      overflow: "hidden",
      position: "relative",
    },
    drawerChannelRowActive: {
      backgroundColor: colors.channelTypeActiveSoftBg,
      borderColor: colors.channelTypeActiveSoftBg,
    },
    drawerChannelIcon: {
      alignItems: "center",
      borderRadius: 8,
      height: 30,
      justifyContent: "center",
      overflow: "hidden",
      width: 30,
    },
    drawerChannelIconWithImage: {
      backgroundColor: colors.bgQuaternary,
    },
    drawerChannelIconImageOverlay: {
      backgroundColor:
        mode === "light" ? "rgba(248,250,252,0.52)" : "rgba(2,6,23,0.48)",
    },
    drawerChannelCopy: {
      flex: 1,
      minWidth: 0,
    },
    drawerChannelName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 18,
    },
    drawerChannelNameActive: {
      color: colors.accentPrimary,
    },
    drawerChannelsEmpty: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 2,
      paddingVertical: 8,
    },
    drawerChannelSkeletonRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 9,
      minHeight: 44,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    drawerChannelSkeletonIcon: {
      backgroundColor: colors.bgQuaternary,
      borderRadius: 9,
      height: 30,
      opacity: 0.7,
      width: 30,
    },
    drawerChannelSkeletonCopy: {
      flex: 1,
      gap: 5,
    },
    drawerChannelSkeletonTitle: {
      backgroundColor: colors.bgQuaternary,
      borderRadius: 999,
      height: 10,
      opacity: 0.75,
      width: "72%",
    },
    drawerChannelSkeletonMeta: {
      backgroundColor: colors.bgQuaternary,
      borderRadius: 999,
      height: 8,
      opacity: 0.45,
      width: "46%",
    },
    tabsColumn: {
      flex: 1,
      gap: 6,
    },
    tabSeparator: {
      borderTopColor: colors.borderPrimary,
      borderTopWidth: 1,
      marginVertical: 4,
    },
    tabButton: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "flex-start",
      minHeight: 42,
      paddingHorizontal: 12,
      paddingVertical: 6,
      width: "100%",
    },
    tabButtonActive: {
      backgroundColor: colors.channelTypeActiveSoftBg,
      borderColor: colors.channelTypeActiveSoftBg,
    },
    tabButtonText: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "left",
    },
    actionPressed: {
      opacity: 0.92,
    },
    sheetOption: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    sheetOptionPressed: {
      opacity: 0.7,
    },
    sheetOptionText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    sheetDivider: {
      borderTopColor: colors.borderPrimary,
      borderTopWidth: 1,
    },
  });
}
