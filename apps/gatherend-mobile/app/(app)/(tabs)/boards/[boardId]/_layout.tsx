import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  Slot,
  useLocalSearchParams,
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
import {
  canWriteWiki,
  isAdmin,
  type MemberPermission,
} from "@/src/features/boards/member-role";
import {
  Animated,
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
import { useBoardVoiceParticipantsSocket } from "@/src/features/voice/hooks/use-board-voice-participants-socket";
import { useVoiceStore } from "@/src/features/voice/store/use-voice-store";
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

const DRAWER_MARGIN = 0;

type BoardSectionKey = (typeof BOARD_SECTION_TABS)[number]["key"];

type DrawerChannelsPreviewProps = {
  channels: BoardChannel[];
  isLoading: boolean;
  activeChannelId?: string;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useTheme>["colors"];
  boardColors: ReturnType<typeof generatePaletteFromBase> | null;
  onSelectChannel: (channel: BoardChannel) => void;
};

function DrawerChannelsPreview({
  channels,
  isLoading,
  activeChannelId,
  styles,
  colors,
  boardColors,
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
          Todavia no hay chats.
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

export default function BoardShellLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { boardId, channelId } = useLocalSearchParams<{
    boardId?: string;
    channelId?: string;
  }>();
  const routeBoardId = Array.isArray(boardId) ? boardId[0] : boardId;
  const routeChannelId = Array.isArray(channelId) ? channelId[0] : channelId;
  const {
    data: board,
    isError: boardError,
    isLoading: boardLoading,
  } = useBoard(routeBoardId);
  const startConnecting = useVoiceStore((s) => s.startConnecting);
  useBoardVoiceParticipantsSocket(routeBoardId);
  const { data: userBoards = [], isFetched: userBoardsFetched } =
    useUserBoards();
  const boardDisplayAsset = board?.bannerAsset ?? board?.imageAsset ?? null;
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
    // For achromatic/near-gray colors, h=0 by HSL convention (red) and clampS
    // min floors force saturation, producing orange tints. Remap to a neutral
    // blue-gray hue so gray boards produce gray palettes.
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

  useEffect(() => {
    if (boardLoading || !boardError) return;
    if (!userBoardsFetched) return;
    if (routeBoardId && userBoards.some((b) => b.id === routeBoardId)) return;

    const firstBoard = userBoards.find((b) => b.id !== routeBoardId);
    if (firstBoard) {
      router.replace({
        pathname: getBoardSectionPathname("chats"),
        params: { boardId: firstBoard.id },
      });
    } else {
      router.replace("/(app)/(tabs)/boards");
    }
  }, [
    boardError,
    boardLoading,
    routeBoardId,
    userBoards,
    userBoardsFetched,
    router,
  ]);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const drawerWidth = Math.max(0, screenWidth - DRAWER_MARGIN);
  const foregroundTranslateX = useRef(new Animated.Value(0)).current;
  const currentSection =
    BOARD_SECTION_TABS.find((tab) => pathname.includes(`/${tab.key}`))?.key ??
    "home";
  const isHome = currentSection === "home";
  const resolvedTabLabel = (
    key: (typeof BOARD_SECTION_TABS)[number]["key"],
  ) => {
    const custom = board?.tabNames?.[key as keyof typeof board.tabNames];
    const fallback =
      BOARD_SECTION_TABS.find((t) => t.key === key)?.label ?? key;
    return custom && custom.trim() ? custom.trim() : fallback;
  };
  const currentSectionTitle = resolvedTabLabel(currentSection);
  const settingsSubviewTitle = getSettingsSubviewTitle(pathname);
  // DEBUG: trace board query state changes

  const boardTitle = board?.name ?? "Loading...";
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

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
      if (!routeBoardId) return;
      switch (key) {
        case "chat":
          router.push({
            pathname: "/modal/create-channel",
            params: { boardId: routeBoardId },
          });
          break;
        case "post":
          router.push({
            pathname: "/modal/create-post",
            params: { boardId: routeBoardId },
          });
          break;
        case "rules":
          router.replace({
            pathname: "/(app)/(tabs)/boards/[boardId]/rules",
            params: { boardId: routeBoardId },
          });
          break;
        case "wiki":
          router.push({
            pathname: "/modal/create-wiki",
            params: { boardId: routeBoardId },
          });
          break;
      }
    },
    [routeBoardId, router],
  );

  useEffect(() => {
    if (!isDrawerVisible) {
      foregroundTranslateX.setValue(0);
    }
  }, [foregroundTranslateX, isDrawerVisible]);

  const openDrawer = useCallback(() => {
    setIsDrawerVisible(true);
    Animated.spring(foregroundTranslateX, {
      toValue: drawerWidth,
      damping: 22,
      stiffness: 230,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [drawerWidth, foregroundTranslateX]);

  const closeDrawer = useCallback(() => {
    Animated.timing(foregroundTranslateX, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        foregroundTranslateX.setValue(0);
        setIsDrawerVisible(false);
      }
    });
  }, [foregroundTranslateX]);

  const handleSelectDrawerChannel = useCallback(
    (channel: BoardChannel) => {
      if (!routeBoardId) return;

      if (channel.type === "VOICE") {
        const voiceState = useVoiceStore.getState();
        const isInThisVoiceChannel =
          voiceState.context === "board" &&
          voiceState.channelId === channel.id &&
          (voiceState.isConnected || voiceState.isConnecting);

        if (!isInThisVoiceChannel) {
          startConnecting(channel.id, channel.name, "board", routeBoardId);
          closeDrawer();
          return;
        }
      }

      closeDrawer();
      router.replace({
        pathname: "/(app)/boards/[boardId]/chats/[channelId]",
        params: { boardId: routeBoardId, channelId: channel.id },
      });
    },
    [closeDrawer, routeBoardId, router, startConnecting],
  );

  const openEdgePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !isDrawerVisible && gesture.dx > 8 && Math.abs(gesture.dy) < 20,
        onPanResponderGrant: () => {
          foregroundTranslateX.setValue(0);
        },
        onPanResponderMove: (_event, gesture) => {
          const nextValue = Math.min(drawerWidth, Math.max(0, gesture.dx));
          foregroundTranslateX.setValue(nextValue);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx > drawerWidth * 0.34 || gesture.vx > 0.5) {
            openDrawer();
          } else {
            closeDrawer();
          }
        },
        onPanResponderTerminate: closeDrawer,
      }),
    [closeDrawer, drawerWidth, foregroundTranslateX, isDrawerVisible, openDrawer],
  );

  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          isDrawerVisible &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          foregroundTranslateX.setValue(drawerWidth);
        },
        onPanResponderMove: (_event, gesture) => {
          const nextValue = Math.max(
            0,
            Math.min(drawerWidth, drawerWidth + gesture.dx),
          );
          foregroundTranslateX.setValue(nextValue);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -drawerWidth * 0.26 || gesture.vx < -0.45) {
            closeDrawer();
          } else {
            openDrawer();
          }
        },
        onPanResponderTerminate: openDrawer,
      }),
    [closeDrawer, drawerWidth, foregroundTranslateX, isDrawerVisible, openDrawer],
  );
  const backdropOpacity = foregroundTranslateX.interpolate({
    inputRange: [0, drawerWidth],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.safeArea}>
      <View
        pointerEvents={isDrawerVisible ? "box-none" : "none"}
        style={styles.drawerLayer}
      >
        <Animated.View
          pointerEvents={isDrawerVisible ? "auto" : "none"}
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <Pressable onPress={closeDrawer} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <View
          style={[
            styles.drawer,
            {
              top: insets.top,
              width: drawerWidth,
            },
          ]}
          {...drawerPanResponder.panHandlers}
        >
          <BoardsDrawerSidebar
            currentBoardId={routeBoardId}
            onCreateBoard={() => {
              closeDrawer();
              router.push("/modal/create-board");
            }}
            onSelectBoard={(nextBoardId) => {
              if (!nextBoardId || nextBoardId === routeBoardId) {
                closeDrawer();
                return;
              }

              closeDrawer();
              router.replace({
                pathname: getBoardSectionPathname(currentSection),
                params: { boardId: nextBoardId },
              });
            }}
          />

          <View
            style={[
              styles.drawerMain,
              boardColors ? { backgroundColor: boardColors.bgSecondary } : null,
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
                      boardColors ? { color: boardColors.textPrimary } : null,
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
                    tab.key !== "featured" &&
                    tab.key !== "rules" &&
                    tab.key !== "ranking" &&
                    tab.key !== "members",
                ).map((tab) => {
                  const isActive = tab.key === currentSection;
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
                              ? { borderTopColor: boardColors.borderPrimary }
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
                              ? { borderTopColor: boardColors.borderPrimary }
                              : null,
                          ]}
                        />
                      )}
                      <Pressable
                        key={tab.key}
                        onPress={() => {
                          if (!routeBoardId) return;

                          closeDrawer();
                          router.replace({
                            pathname: getBoardSectionPathname(tab.key),
                            params: { boardId: routeBoardId },
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
                        <Ionicons color={iconColor} name={tab.icon} size={19} />
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

      <Animated.View
        style={[
          styles.container,
          isDrawerVisible ? styles.foregroundOpen : null,
          {
            transform: [{ translateX: foregroundTranslateX }],
          },
        ]}
        {...(!isDrawerVisible && !isHome
          ? openEdgePanResponder.panHandlers
          : {})}
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
                if (!routeBoardId) return;
                router.replace({
                  pathname: "/boards/[boardId]/settings",
                  params: { boardId: routeBoardId },
                });
              }}
              style={({ pressed }) => [
                styles.menuButton,
                pressed ? styles.menuButtonPressed : null,
              ]}
            >
              <Ionicons color={colors.textPrimary} name="arrow-back" size={21} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityHint="Abre el drawer izquierdo del board"
              accessibilityRole="button"
              accessibilityLabel="Abrir drawer"
              onPress={openDrawer}
              style={({ pressed }) => [
                styles.menuButton,
                hasBoardHeaderImage
                  ? { backgroundColor: hexToRgba(colors.bgQuaternary, 0.5) }
                  : null,
                pressed ? styles.menuButtonPressed : null,
              ]}
            >
              <Ionicons color={colors.textPrimary} name="menu" size={22} />
            </Pressable>
          )}

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {settingsSubviewTitle ?? boardTitle}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {settingsSubviewTitle ? boardTitle : currentSectionTitle}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <BoardQuickActionsMenu
            allowedActions={allowedQuickActions}
            onAction={handleQuickAction}
          >
            <Slot />
          </BoardQuickActionsMenu>
        </View>

        {isHome && !isDrawerVisible && (
          <View
            style={styles.homeEdgeZone}
            {...openEdgePanResponder.panHandlers}
          />
        )}
      </Animated.View>

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
      backgroundColor: colors.bgPrimary,
    },
    container: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bgPrimary,
      elevation: 10,
      flex: 1,
      overflow: "hidden",
      zIndex: 10,
    },
    foregroundOpen: {
      borderLeftColor: colors.borderPrimary,
      borderLeftWidth: 1,
      elevation: 12,
      shadowColor: "#000000",
      shadowOffset: { width: -8, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
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
    homeEdgeZone: {
      bottom: 0,
      left: 0,
      position: "absolute",
      top: 0,
      width: 44,
      zIndex: 1,
    },
    drawerLayer: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: "row",
      zIndex: 0,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(2, 6, 23, 0.58)",
    },
    drawer: {
      backgroundColor: colors.bgSecondary,
      borderRightColor: colors.borderPrimary,
      borderRightWidth: 1,
      bottom: 0,
      flexDirection: "row",
      left: 0,
      position: "absolute",
      top: 0,
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
