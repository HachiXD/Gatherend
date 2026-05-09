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
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BoardQuickActionsMenu,
  type BoardQuickActionKey,
} from "@/src/features/boards/components/board-quick-actions-menu";
import { ChannelComposerAccessory } from "@/src/features/chat/components/channel-composer-accessory";
import { useAppShellStore } from "@/src/features/navigation/stores/use-app-shell-store";
import type { BoardHomeTab } from "@/src/features/navigation/stores/use-app-shell-store";
import {
  canWriteWiki,
  isAdmin,
  type MemberPermission,
} from "@/src/features/boards/member-role";
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

type BoardSectionKey = (typeof BOARD_SECTION_TABS)[number]["key"];

const OPTIMISTIC_DRAWER_SECTIONS = new Set<BoardSectionKey>([
  "forum",
  "home",
  "invite",
  "settings",
  "wiki",
]);

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

let lastResolvedBoardSection: BoardSectionKey = "home";

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
                    size={16}
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

function getBoardSectionPathname(section: BoardSectionKey) {
  switch (section) {
    case "featured":
      return "/boards/[boardId]/featured";
    case "home":
      return "/boards/[boardId]/home";
    case "forum":
      return "/boards/[boardId]/forum";
    case "rules":
      return "/boards/[boardId]/rules";
    case "wiki":
      return "/boards/[boardId]/wiki";
    case "ranking":
      return "/boards/[boardId]/ranking";
    case "members":
      return "/boards/[boardId]/members";
    case "invite":
      return "/boards/[boardId]/invite";
    case "settings":
      return "/boards/[boardId]/settings";
    case "chats":
    default:
      return "/boards/[boardId]/chats";
  }
}

function getBoardIdFromPathname(pathname: string) {
  const match = pathname.match(/^\/boards\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
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
  const setIsBoardDrawerOpen = useAppShellStore(
    (state) => state.setIsBoardDrawerOpen,
  );
  const setLastBoardSection = useAppShellStore(
    (state) => state.setLastBoardSection,
  );
  const lastBoardSection = useAppShellStore((state) => state.lastBoardSection);
  const { boardId, channelId } = useGlobalSearchParams<{
    boardId?: string;
    channelId?: string;
  }>();
  const routeBoardId =
    (Array.isArray(boardId) ? boardId[0] : boardId) ??
    getBoardIdFromPathname(pathname);
  const routeChannelId = Array.isArray(channelId) ? channelId[0] : channelId;
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
    () =>
      (board?.channels ?? []).filter((channel) => channel.type === "FORUM"),
    [board?.channels],
  );
  const wikiChannels = useMemo(
    () =>
      (board?.channels ?? []).filter((channel) => channel.type === "WIKI"),
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

  const isBoardPathname = pathname.startsWith("/boards/");

  useEffect(() => {
    if (boardLoading || !boardError) return;
    if (!userBoardsFetched) return;
    if (activeBoardId && userBoards.some((b) => b.id === activeBoardId)) return;

    const firstBoard = userBoards.find((b) => b.id !== activeBoardId);
    if (firstBoard) {
      router.replace({
        pathname: getBoardSectionPathname("chats"),
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
  const matchedSection = BOARD_SECTION_TABS.find((tab) =>
    pathname.includes(`/${tab.key}`),
  )?.key;
  const savedSectionRef = useRef<BoardSectionKey>(lastResolvedBoardSection);
  const currentSection = matchedSection ?? savedSectionRef.current;
  const [optimisticSection, setOptimisticSection] =
    useState<BoardSectionKey | null>(null);
  const [optimisticTextChannel, setOptimisticTextChannel] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const pendingOptimisticNavigationRef = useRef<{
    boardId: string;
    channelId?: string;
    section: BoardSectionKey;
  } | null>(null);
  const displayedSection = optimisticSection ?? currentSection;
  const isPendingOptimisticTextChannel =
    optimisticSection === "chats" &&
    optimisticTextChannel !== null &&
    routeChannelId !== optimisticTextChannel.id;
  const isShowingPendingOptimisticSection =
    optimisticSection !== null &&
    (currentSection !== optimisticSection || isPendingOptimisticTextChannel);
  console.log("[BoardSectionOptimistic render]", {
    currentSection,
    displayedSection,
    isShowingPendingOptimisticSection,
    isPendingOptimisticTextChannel,
    matchedSection,
    optimisticSection,
    optimisticTextChannel,
    pathname,
    routeChannelId,
  });
  const drawerTargetSection = matchedSection ?? lastBoardSection;
  const isHome = displayedSection === "home";
  const resolvedTabLabel = (
    key: (typeof BOARD_SECTION_TABS)[number]["key"],
  ) => {
    const custom = board?.tabNames?.[key as keyof typeof board.tabNames];
    const fallback =
      BOARD_SECTION_TABS.find((t) => t.key === key)?.label ?? key;
    return custom && custom.trim() ? custom.trim() : fallback;
  };
  const currentSectionTitle = resolvedTabLabel(displayedSection);
  const settingsSubviewTitle = getSettingsSubviewTitle(pathname);
  const boardTitle = board?.name ?? "Loading...";
  const routeChannel = routeChannelId
    ? (board?.channels.find((c) => c.id === routeChannelId) ?? null)
    : null;
  const displayedRouteChannel =
    displayedSection === "chats" && optimisticTextChannel
      ? optimisticTextChannel
      : routeChannel;
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

  useEffect(() => {
    if (!matchedSection) return;
    savedSectionRef.current = matchedSection;
    lastResolvedBoardSection = matchedSection;
    if (
      matchedSection === "home" ||
      matchedSection === "forum" ||
      matchedSection === "wiki" ||
      matchedSection === "chats" ||
      matchedSection === "settings"
    ) {
      setLastBoardSection(matchedSection);
    }
  }, [matchedSection, setLastBoardSection]);

  useEffect(() => {
    if (!optimisticSection) return;
    const hasReachedOptimisticSection =
      optimisticSection === "chats" && optimisticTextChannel
        ? currentSection === "chats" && routeChannelId === optimisticTextChannel.id
        : optimisticTextChannel
          ? optimisticSection === currentSection &&
            routeChannelId === optimisticTextChannel.id
          : optimisticSection === currentSection;

    if (hasReachedOptimisticSection) {
      console.log("[BoardSectionOptimistic clear]", {
        currentSection,
        optimisticSection,
        optimisticTextChannel,
        pathname,
        routeChannelId,
      });
      setOptimisticSection(null);
      setOptimisticTextChannel(null);
    }
  }, [
    currentSection,
    optimisticSection,
    optimisticTextChannel,
    pathname,
    routeChannelId,
  ]);

  useEffect(() => {
    if (routeBoardId) setDrawerBoardId(routeBoardId);
  }, [routeBoardId]);

  useEffect(() => {
    if (activeBoardId) setLastBoardId(activeBoardId);
  }, [activeBoardId, setLastBoardId]);

  useEffect(() => {
    if (!activeBoardId) return;

    if (drawerTargetSection === "home") {
      void queryClient.prefetchQuery({
        queryKey: boardRulesQueryKey(activeBoardId),
        queryFn: () => getBoardRules(activeBoardId),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
      });
    }
  }, [drawerTargetSection, activeBoardId, queryClient]);

  const currentMemberRole = board?.currentMember?.role;
  const currentMemberPermissions = board?.currentMember?.permissions;
  const allowedQuickActions = useMemo<BoardQuickActionKey[]>(() => {
    const permissions: MemberPermission[] = currentMemberPermissions ?? [];
    const actions: BoardQuickActionKey[] = ["post"];
    if (isAdmin(currentMemberRole)) {
      actions.push("chat");
      actions.push("rules");
    }
    if (canWriteWiki(currentMemberRole, permissions)) {
      actions.push("wiki");
    }
    return actions;
  }, [currentMemberPermissions, currentMemberRole]);

  const handleQuickAction = useCallback(
    (key: BoardQuickActionKey) => {
      if (!activeBoardId) return;
      switch (key) {
        case "chat":
          router.push({
            pathname: "/modal/create-channel",
            params: { boardId: activeBoardId },
          });
          break;
        case "post":
          if (routeChannel?.type === "FORUM") {
            router.push({
              pathname: "/modal/create-post",
              params: { boardId: activeBoardId, channelId: routeChannel.id },
            });
          } else {
            router.replace({
              pathname: "/boards/[boardId]/forum",
              params: { boardId: activeBoardId },
            });
          }
          break;
        case "rules":
          router.replace({
            pathname: "/boards/[boardId]/rules",
            params: { boardId: activeBoardId },
          });
          break;
        case "wiki":
          if (routeChannel?.type === "WIKI") {
            router.push({
              pathname: "/modal/create-wiki",
              params: { boardId: activeBoardId, channelId: routeChannel.id },
            });
          } else {
            router.replace({
              pathname: "/boards/[boardId]/wiki",
              params: { boardId: activeBoardId },
            });
          }
          break;
      }
    },
    [activeBoardId, routeChannel, router],
  );

  // foregroundX: screenWidth = drawer visible (foreground off-screen right)
  //              0           = foreground visible (covering drawer)
  const foregroundX = useRef(
    new Animated.Value(Dimensions.get("window").width),
  ).current;
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // When leaving boards, reset so next entry always lands on drawer
  useEffect(() => {
    if (!isBoardPathname) {
      foregroundX.setValue(Dimensions.get("window").width);
      setIsBoardDrawerOpen(false);
    }
  }, [isBoardPathname, foregroundX, setIsBoardDrawerOpen]);

  const showForeground = useCallback((onFinish?: () => void) => {
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
  }, [foregroundX, isDrawerOpen, pathname, setIsBoardDrawerOpen]);

  const showDrawer = useCallback(() => {
    Animated.timing(foregroundX, {
      toValue: screenWidth,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsDrawerOpen(true);
        setIsBoardDrawerOpen(true);
      }
    });
  }, [foregroundX, isDrawerOpen, pathname, screenWidth, setIsBoardDrawerOpen]);

  const startPendingOptimisticNavigation = useCallback(() => {
    const pending = pendingOptimisticNavigationRef.current;
    console.log("[BoardSectionOptimistic startPending]", {
      currentSection,
      hasPending: Boolean(pending),
      optimisticSection,
      pending,
      pathname,
    });
    if (!pending) return;
    if (optimisticSection !== pending.section) return;

    pendingOptimisticNavigationRef.current = null;
    console.log("[BoardSectionOptimistic navigate/start]", {
      channelId: pending.channelId,
      currentSection,
      optimisticSection,
      pathname,
      targetBoardId: pending.boardId,
      targetSection: pending.section,
    });
    showForeground();
    if (pending.channelId) {
      if (pending.section === "forum") {
        router.replace({
          pathname: "/boards/[boardId]/forum/[channelId]",
          params: { boardId: pending.boardId, channelId: pending.channelId },
        });
      } else if (pending.section === "wiki") {
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
      return;
    }

    router.replace({
      pathname: getBoardSectionPathname(pending.section),
      params: { boardId: pending.boardId },
    });
  }, [currentSection, optimisticSection, pathname, router, showForeground]);

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
        boardId: activeBoardId,
        channelId: channel.id,
        section:
          channel.type === "FORUM"
            ? "forum"
            : channel.type === "WIKI"
              ? "wiki"
              : "chats",
      };
      setOptimisticTextChannel(
        channel.type === "TEXT" || channel.type === "VOICE"
          ? { id: channel.id, name: channel.name }
          : null,
      );
      setOptimisticSection(
        channel.type === "FORUM"
          ? "forum"
          : channel.type === "WIKI"
            ? "wiki"
            : "chats",
      );
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
          const next = Math.min(screenWidth, Math.max(0, screenWidth + gesture.dx));
          foregroundX.setValue(next);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -screenWidth * 0.26 || gesture.vx < -0.45) {
            showForeground();
          } else {
            showDrawer();
          }
        },
        onPanResponderTerminate: showDrawer,
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
                currentBoardId={activeBoardId}
                onCreateBoard={() => {
                  router.push("/modal/create-board");
                }}
                onSelectBoard={(nextBoardId) => {
                  if (!nextBoardId || nextBoardId === activeBoardId) return;
                  setDrawerBoardId(nextBoardId);
                  setIsDrawerOpen(true);
                  setIsBoardDrawerOpen(true);
                  foregroundX.setValue(screenWidth);
                  router.replace({
                    pathname: getBoardSectionPathname(currentSection),
                    params: { boardId: nextBoardId },
                  });
                }}
              />

              <View
                style={[
                  styles.drawerMain,
                  boardColors
                    ? { backgroundColor: boardColors.bgSecondary }
                    : null,
                ]}
              >
                <View style={styles.boardHeader}>
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

                  <Text
                    numberOfLines={2}
                    style={[
                      styles.boardName,
                      boardColors ? { color: boardColors.textPrimary } : null,
                    ]}
                  >
                    {boardTitle}
                  </Text>
                </View>

                <View style={styles.drawerGroup}>
                  <View style={styles.tabsColumn}>
                    {BOARD_SECTION_TABS.filter(
                      (tab) =>
                        tab.key !== "chats" &&
                        tab.key !== "forum" &&
                        tab.key !== "featured" &&
                        tab.key !== "rules" &&
                        tab.key !== "wiki" &&
                        tab.key !== "ranking" &&
                        tab.key !== "members",
                    ).map((tab) => {
                      const isActive = tab.key === displayedSection;
                      const iconColor = boardColors
                        ? boardColors.textPrimary
                        : colors.textPrimary;

                      return (
                        <Fragment key={tab.key}>
                          {tab.key === "home" && (
                            <View
                              key="separator-top"
                              style={[
                                styles.tabSeparator,
                                boardColors
                                  ? {
                                      borderTopColor:
                                        boardColors.borderPrimary,
                                    }
                                  : null,
                              ]}
                            />
                          )}
                          {tab.key === "invite" && (
                            <ScrollView
                              key="channels-preview"
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
                          )}
                          {tab.key === "invite" && (
                            <View
                              key="separator"
                              style={[
                                styles.tabSeparator,
                                boardColors
                                  ? {
                                      borderTopColor:
                                        boardColors.borderPrimary,
                                    }
                                  : null,
                              ]}
                            />
                          )}
                          <Pressable
                            key={tab.key}
                            onPressIn={() => {
                              setIsBoardDrawerOpen(false);
                            }}
                            onPress={() => {
                              if (!activeBoardId) return;
                              if (OPTIMISTIC_DRAWER_SECTIONS.has(tab.key)) {
                                console.log("[BoardSectionOptimistic tap]", {
                                  activeBoardId,
                                  currentSection,
                                  displayedSection,
                                  pathname,
                                  targetSection: tab.key,
                                });
                                pendingOptimisticNavigationRef.current = {
                                  boardId: activeBoardId,
                                  section: tab.key,
                                };
                                setOptimisticSection(tab.key);
                                return;
                              }

                              showForeground(() => {
                                router.replace({
                                  pathname: getBoardSectionPathname(tab.key),
                                  params: { boardId: activeBoardId },
                                });
                              });
                            }}
                            style={({ pressed }) => [
                              styles.tabButton,
                              isActive ? styles.tabButtonActive : null,
                              boardColors && isActive
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
                              color={iconColor}
                              name={tab.icon}
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
                              {resolvedTabLabel(tab.key)}
                            </Text>
                          </Pressable>
                        </Fragment>
                      );
                    })}
                  </View>
                </View>
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
              {boardImageUrl ? (
                <>
                  <Image
                    contentFit="cover"
                    source={{ uri: boardImageUrl }}
                    style={styles.headerBackgroundImage}
                  />
                  <View style={styles.headerBackgroundOverlay} />
                </>
              ) : null}

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
                  onPress={showDrawer}
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
                    : (displayedSection === "chats" ||
                        displayedSection === "forum" ||
                        displayedSection === "wiki") &&
                      displayedRouteChannel
                      ? `/ ${displayedRouteChannel.name}`
                      : currentSectionTitle}
                </Text>
              </View>
            </View>

            <View style={[styles.content, { paddingBottom: insets.bottom }]}>
              <BoardQuickActionsMenu
                allowedActions={allowedQuickActions}
                onAction={handleQuickAction}
              >
                <View style={styles.routeContent}>
                  <Slot />
                  {isShowingPendingOptimisticSection ? (
                    <View
                      pointerEvents="auto"
                      onLayout={() => {
                        console.log("[BoardSectionOptimistic overlay/layout]", {
                          currentSection,
                          displayedSection,
                          optimisticSection,
                          pathname,
                        });
                        startPendingOptimisticNavigation();
                      }}
                      style={styles.pendingSectionOverlay}
                    >
                      {optimisticSection === "home" ? (
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
                {isPendingOptimisticTextChannel &&
                activeBoardId &&
                optimisticTextChannel ? (
                  <ChannelComposerAccessory
                    boardId={activeBoardId}
                    channelId={optimisticTextChannel.id}
                    profileId={profile.id}
                    windowKey={`channel:${optimisticTextChannel.id}`}
                    replyTo={null}
                    onClearReply={() => {}}
                  />
                ) : null}
              </BoardQuickActionsMenu>
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
    boardName: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      lineHeight: 24,
      paddingHorizontal: 12,
    },
    drawerGroup: {
      marginTop: 7,
      paddingBottom: 16,
      paddingHorizontal: 12,
    },
    drawerChannelsScroll: {
      maxHeight: 270,
      marginBottom: 4,
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
  });
}
