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
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BoardsDrawerSidebar } from "@/src/features/boards/components/boards-drawer-sidebar";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { useUserBoards } from "@/src/features/boards/hooks/use-user-boards";
import { getBoardImageUrl } from "@/src/lib/avatar-utils";
import { useTheme } from "@/src/theme/theme-provider";
import {
  generatePaletteFromBase,
  generateLightPaletteFromBase,
  generateGrayPaletteFromBase,
  hexToHsl,
} from "@/src/theme/utils";
import { Text } from "@/src/components/app-typography";

const BOARD_SECTION_TABS = [
  { key: "home", label: "Casa", icon: "home-outline" },
  { key: "chats", label: "Chats", icon: "chatbubble-ellipses-outline" },
  { key: "forum", label: "Foro", icon: "chatbox-outline" },
  { key: "rules", label: "Reglas", icon: "document-text-outline" },
  { key: "wiki", label: "Wiki", icon: "book-outline" },
  { key: "ranking", label: "Ranking", icon: "trophy-outline" },
  { key: "members", label: "Miembros", icon: "people-outline" },
  { key: "invite", label: "Invitar amigos", icon: "person-add-outline" },
  { key: "settings", label: "Ajustes", icon: "settings-outline" },
] as const;

const DRAWER_WIDTH = 356;

type BoardSectionKey = (typeof BOARD_SECTION_TABS)[number]["key"];

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
  const { boardId } = useLocalSearchParams<{
    boardId?: string;
  }>();
  const routeBoardId = Array.isArray(boardId) ? boardId[0] : boardId;
  const {
    data: board,
    isError: boardError,
    isLoading: boardLoading,
  } = useBoard(routeBoardId);
  const { data: userBoards = [], isFetched: userBoardsFetched } =
    useUserBoards();
  const boardDisplayAsset = board?.bannerAsset ?? board?.imageAsset ?? null;
  const boardHeaderImageUrl = board
    ? getBoardImageUrl(board.imageAsset?.url, board.id, board.name, 512)
    : null;
  const boardImageUrl = board
    ? getBoardImageUrl(boardDisplayAsset?.url, board.id, board.name, 512)
    : null;

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
  const drawerWidth = Math.min(DRAWER_WIDTH, Math.max(0, screenWidth - 24));
  const drawerTranslateX = useRef(new Animated.Value(-screenWidth)).current;
  const currentSection =
    BOARD_SECTION_TABS.find((tab) => pathname.includes(`/${tab.key}`))?.key ??
    "home";
  const isHome = currentSection === "home";
  const currentSectionTitle =
    BOARD_SECTION_TABS.find((tab) => tab.key === currentSection)?.label ??
    "Chats";
  const settingsSubviewTitle = getSettingsSubviewTitle(pathname);
  const boardTitle = board?.name ?? (boardLoading ? "Loading..." : "Board");
  const styles = useMemo(() => createStyles(colors), [colors]);

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
      }
    },
    [routeBoardId, router],
  );

  useEffect(() => {
    if (!isDrawerVisible) {
      drawerTranslateX.setValue(-drawerWidth);
    }
  }, [drawerTranslateX, drawerWidth, isDrawerVisible]);

  const openDrawer = useCallback(() => {
    setIsDrawerVisible(true);
    Animated.spring(drawerTranslateX, {
      toValue: 0,
      damping: 22,
      stiffness: 230,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [drawerTranslateX]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerTranslateX, {
      toValue: -drawerWidth,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        drawerTranslateX.setValue(-drawerWidth);
        setIsDrawerVisible(false);
      }
    });
  }, [drawerTranslateX, drawerWidth]);

  const openEdgePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !isDrawerVisible && gesture.dx > 8 && Math.abs(gesture.dy) < 20,
        onPanResponderGrant: () => {
          drawerTranslateX.setValue(-drawerWidth);
        },
        onPanResponderMove: (_event, gesture) => {
          const nextValue = Math.min(0, -drawerWidth + Math.max(0, gesture.dx));
          drawerTranslateX.setValue(nextValue);
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
    [closeDrawer, drawerTranslateX, drawerWidth, isDrawerVisible, openDrawer],
  );

  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          isDrawerVisible &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_event, gesture) => {
          const nextValue = Math.max(-drawerWidth, Math.min(0, gesture.dx));
          drawerTranslateX.setValue(nextValue);
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
    [closeDrawer, drawerTranslateX, drawerWidth, isDrawerVisible, openDrawer],
  );
  const backdropOpacity = drawerTranslateX.interpolate({
    inputRange: [-drawerWidth, 0],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.safeArea}>
      <View
        style={styles.container}
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
              <Ionicons
                color={colors.textPrimary}
                name="arrow-back"
                size={21}
              />
            </Pressable>
          ) : (
            <Pressable
              accessibilityHint={"Abre el drawer izquierdo del board"}
              accessibilityRole="button"
              accessibilityLabel="Abrir drawer"
              onPress={() => {
                openDrawer();
              }}
              style={({ pressed }) => [
                styles.menuButton,
                pressed ? styles.menuButtonPressed : null,
              ]}
            >
              {boardHeaderImageUrl ? (
                <Image
                  contentFit="cover"
                  source={{ uri: boardHeaderImageUrl }}
                  style={styles.menuButtonImage}
                />
              ) : (
                <View style={styles.menuButtonFallback}>
                  <Text style={styles.menuButtonFallbackText}>
                    {getBoardInitial(board?.name)}
                  </Text>
                </View>
              )}
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
          <BoardQuickActionsMenu onAction={handleQuickAction}>
            <Slot />
          </BoardQuickActionsMenu>
        </View>

        {isHome && !isDrawerVisible && (
          <View
            style={styles.homeEdgeZone}
            {...openEdgePanResponder.panHandlers}
          />
        )}

        {
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
              <Pressable
                onPress={closeDrawer}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <Animated.View
              style={[
                styles.drawer,
                {
                  top: insets.top,
                  transform: [{ translateX: drawerTranslateX }],
                  width: drawerWidth,
                },
              ]}
              {...drawerPanResponder.panHandlers}
            >
              <BoardsDrawerSidebar
                currentBoardId={routeBoardId}
                onBackToBoards={() => {
                  closeDrawer();
                  router.replace("/boards");
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
                    {BOARD_SECTION_TABS.map((tab) => {
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
                                  ? {
                                      borderTopColor: boardColors.borderPrimary,
                                    }
                                  : null,
                              ]}
                            />
                          )}
                          {tab.key === "invite" && (
                            <View
                              key="separator"
                              style={[
                                styles.tabSeparator,
                                boardColors
                                  ? {
                                      borderTopColor: boardColors.borderPrimary,
                                    }
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
                              {tab.label}
                            </Text>
                          </Pressable>
                        </Fragment>
                      );
                    })}
                  </View>
                </View>
              </View>
            </Animated.View>
          </View>
        }
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
      backgroundColor: "rgba(0,0,0,0.46)",
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
    menuButtonImage: {
      backgroundColor: colors.bgQuaternary,
      height: "100%",
      width: "100%",
    },
    menuButtonFallback: {
      alignItems: "center",
      backgroundColor: colors.avatarFallbackBg,
      height: "100%",
      justifyContent: "center",
      width: "100%",
    },
    menuButtonFallbackText: {
      color: colors.textLight,
      fontSize: 14,
      fontWeight: "800",
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
      zIndex: 2,
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
