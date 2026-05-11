import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import BoardFeaturedScreen from "./featured";
import BoardForumScreen from "./forum";
import BoardWikiScreen from "./wiki";
import BoardRankingScreen from "./ranking";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { BoardChannelsList } from "@/src/features/boards/components/board-channels-list";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { isAdmin } from "@/src/features/boards/member-role";
import {
  type BoardHomeTab,
  useAppShellStore,
} from "@/src/features/navigation/stores/use-app-shell-store";
import { useVoiceStore } from "@/src/features/voice/store/use-voice-store";
import { useBoardRules } from "@/src/features/rules/hooks/use-board-rules";
import { useDeleteBoardRules } from "@/src/features/rules/hooks/use-delete-board-rules";
import { useTheme } from "@/src/theme/theme-provider";
import type { ThemeColors } from "@/src/theme/types";
import {
  generateGrayPaletteFromBase,
  generateLightPaletteFromBase,
  generatePaletteFromBase,
  hexToHsl,
} from "@/src/theme/utils";
import { Text } from "@/src/components/app-typography";

// ─── Config ───────────────────────────────────────────────────────────────────

type HomeTabKey = BoardHomeTab;

const HOME_TABS: Array<{ key: HomeTabKey; label: string }> = [
  { key: "rules", label: "Reglas" },
  { key: "chats", label: "Chats" },
  { key: "forum", label: "Foro" },
  { key: "wiki", label: "Wiki" },
  { key: "featured", label: "Destacado" },
  { key: "ranking", label: "Ranking" },
];

const INITIAL_TAB_INDEX = 0; // Rules
const RULES_TAB_INDEX = 0;
const CHATS_TAB_INDEX = 1;
const FORUM_TAB_INDEX = 2;
const WIKI_TAB_INDEX = 3;
const FEATURED_TAB_INDEX = 4;
const RANKING_TAB_INDEX = 5;

function getHomeTabIndex(tab: HomeTabKey | undefined) {
  const index = HOME_TABS.findIndex((item) => item.key === tab);
  return index >= 0 ? index : INITIAL_TAB_INDEX;
}

function normalizeDominantColor(raw: string | null | undefined) {
  if (!raw) return null;

  const rgbMatch = raw.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `#${Number(r).toString(16).padStart(2, "0")}${Number(g)
      .toString(16)
      .padStart(2, "0")}${Number(b).toString(16).padStart(2, "0")}`;
  }

  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw}`;
  return null;
}

function getBoardDerivedColors(
  raw: string | null | undefined,
  mode: "dark" | "light",
) {
  const hex = normalizeDominantColor(raw);
  if (!hex) return null;

  const { s } = hexToHsl(hex);
  if (s < 10) return generateGrayPaletteFromBase(hex);
  return mode === "dark"
    ? generatePaletteFromBase(hex)
    : generateLightPaletteFromBase(hex);
}

// ─── RulesContent ─────────────────────────────────────────────────────────────

function RulesContent({
  boardId,
  colors,
  canManageRules,
}: {
  boardId: string | undefined;
  colors: ThemeColors;
  canManageRules: boolean;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { data: rules, isLoading } = useBoardRules(boardId);
  const deleteMutation = useDeleteBoardRules();
  const [sheetVisible, setSheetVisible] = useState(false);

  const handleCreateOrEdit = useCallback(() => {
    if (!boardId) return;
    setSheetVisible(false);
    router.push({
      pathname: "/boards/[boardId]/rules",
      params: { boardId },
    });
  }, [boardId, router]);

  const handleDeletePress = useCallback(() => {
    if (!boardId) return;
    setSheetVisible(false);
    Alert.alert(
      "Borrar reglas",
      "Esta acción no se puede deshacer. Las reglas del board serán eliminadas permanentemente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: () => deleteMutation.mutate(boardId),
        },
      ],
    );
  }, [boardId, deleteMutation]);

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={styles.stateText}>Cargando reglas...</Text>
      </View>
    );
  }

  if (!rules?.items.length) {
    return (
      <View style={styles.rulesContainer}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Todavía no hay reglas</Text>
          <Text style={styles.stateText}>
            Los administradores aún no han definido reglas para este board.
          </Text>
        </View>
        {canManageRules ? (
          <Pressable
            onPress={handleCreateOrEdit}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          >
            <Ionicons name="add" size={30} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.rulesContainer}>
      <Pressable
        delayLongPress={400}
        onLongPress={canManageRules ? () => setSheetVisible(true) : undefined}
        style={styles.rulesLongPressArea}
      >
        <ScrollView
          contentContainerStyle={styles.rulesScroll}
          showsVerticalScrollIndicator={false}
        >
          {rules.imageAsset?.url ? (
            <Image
              contentFit="cover"
              source={{ uri: rules.imageAsset.url }}
              style={styles.rulesImage}
            />
          ) : null}
          {rules.items.map((rule, i) => (
            <View key={rule.order} style={styles.ruleItem}>
              <View style={styles.ruleBadge}>
                <Text style={styles.ruleBadgeText}>{i + 1}</Text>
              </View>
              <View style={styles.ruleBody}>
                <Text style={styles.ruleTitle}>{rule.title}</Text>
                {rule.description ? (
                  <Text style={styles.ruleDescription}>{rule.description}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </Pressable>

      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        maxHeight={180}
      >
        <Pressable
          onPress={handleCreateOrEdit}
          style={({ pressed }) => [
            styles.sheetOption,
            pressed && styles.sheetOptionPressed,
          ]}
        >
          <Ionicons
            name="create-outline"
            size={20}
            color={colors.textPrimary}
          />
          <Text style={styles.sheetOptionText}>Editar reglas</Text>
        </Pressable>
        <View style={styles.sheetDivider} />
        <Pressable
          onPress={handleDeletePress}
          style={({ pressed }) => [
            styles.sheetOption,
            pressed && styles.sheetOptionPressed,
          ]}
        >
          <Ionicons name="trash-outline" size={20} color="#f87171" />
          <Text style={styles.sheetOptionTextDestructive}>Eliminar reglas</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

// ─── ChatsContent ─────────────────────────────────────────────────────────────

function ChatsContent({
  boardId,
  colors,
}: {
  boardId: string | undefined;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const {
    data: board,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useBoard(boardId);
  const startConnecting = useVoiceStore((s) => s.startConnecting);

  const handleJoinVoice = useCallback(
    (channelId: string, channelName: string) => {
      if (!boardId) return;
      startConnecting(channelId, channelName, "board", boardId);
    },
    [boardId, startConnecting],
  );

  if (isLoading && !board) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={styles.stateText}>Cargando chats...</Text>
      </View>
    );
  }

  if (isError && !board) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>No se pudo cargar los chats</Text>
        <Text style={styles.stateText}>
          {error instanceof Error ? error.message : "Intenta nuevamente."}
        </Text>
        <Pressable
          onPress={() => void refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed ? styles.retryButtonPressed : null,
          ]}
        >
          <Text style={styles.retryButtonText}>
            {isFetching ? "Reintentando..." : "Reintentar"}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!board) return null;

  const chatChannels = board.channels.filter(
    (channel) => channel.type === "TEXT" || channel.type === "VOICE",
  );

  if (chatChannels.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>Todavía no hay chats</Text>
        <Text style={styles.stateText}>
          En cuanto existan canales dentro de {board.name}, aparecerán aquí.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.chatsContainer}>
      <BoardChannelsList
        channels={chatChannels}
        onSelectChannel={(channelId) => {
          if (!boardId) return;
          router.replace({
            pathname: "/boards/[boardId]/chats/[channelId]",
            params: { boardId, channelId },
          });
        }}
        onJoinVoice={handleJoinVoice}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BoardHomeScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors, mode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { data: board } = useBoard(boardId);
  const canManageRules = isAdmin(board?.currentMember?.role);
  const savedHomeTab = useAppShellStore((state) =>
    boardId ? state.lastHomeTabByBoardId[boardId] : undefined,
  );
  const setLastHomeTab = useAppShellStore((state) => state.setLastHomeTab);
  const boardColors = useMemo(
    () =>
      getBoardDerivedColors(
        board?.bannerAsset?.dominantColor ?? board?.imageAsset?.dominantColor,
        mode,
      ),
    [board?.bannerAsset?.dominantColor, board?.imageAsset?.dominantColor, mode],
  );
  const effectiveColors = boardColors ?? colors;
  const styles = useMemo(
    () => createStyles(effectiveColors),
    [effectiveColors],
  );

  const TAB_WIDTH = 110;
  const initialTabIndex = getHomeTabIndex(savedHomeTab);

  const tabIndexRef = useRef(initialTabIndex);
  const [displayTabIndex, setDisplayTabIndex] = useState(initialTabIndex);
  const animPageValue = useRef(
    new Animated.Value(-screenWidth * initialTabIndex),
  ).current;

  useEffect(() => {
    tabIndexRef.current = initialTabIndex;
    setDisplayTabIndex(initialTabIndex);
    animPageValue.setValue(-screenWidth * initialTabIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animPageValue, boardId, screenWidth]);

  const goToTab = useCallback(
    (index: number) => {
      tabIndexRef.current = index;
      setDisplayTabIndex(index);
      if (boardId) {
        setLastHomeTab(boardId, HOME_TABS[index]?.key ?? "rules");
      }
      Animated.timing(animPageValue, {
        toValue: -screenWidth * index,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [animPageValue, boardId, screenWidth, setLastHomeTab],
  );

  const swipePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderGrant: () => {
          animPageValue.setOffset(-screenWidth * tabIndexRef.current);
          animPageValue.setValue(0);
        },
        onPanResponderMove: (_e, g) => {
          // Resist dragging past the first and last tab
          const maxRight =
            screenWidth * tabIndexRef.current + screenWidth * 0.25;
          const maxLeft =
            -(screenWidth * (HOME_TABS.length - 1 - tabIndexRef.current)) -
            screenWidth * 0.25;
          animPageValue.setValue(Math.max(maxLeft, Math.min(maxRight, g.dx)));
        },
        onPanResponderRelease: (_e, g) => {
          animPageValue.flattenOffset();
          let nextIndex = tabIndexRef.current;
          if (g.dx < -(screenWidth * 0.3) || g.vx < -0.5) {
            nextIndex = Math.min(tabIndexRef.current + 1, HOME_TABS.length - 1);
          } else if (g.dx > screenWidth * 0.3 || g.vx > 0.5) {
            nextIndex = Math.max(tabIndexRef.current - 1, 0);
          }
          goToTab(nextIndex);
        },
        onPanResponderTerminate: () => {
          animPageValue.flattenOffset();
          goToTab(tabIndexRef.current);
        },
      }),
    [animPageValue, goToTab, screenWidth],
  );

  // Maps the pager translateX to the indicator position
  const indicatorTranslateX = animPageValue.interpolate({
    inputRange: [-(screenWidth * (HOME_TABS.length - 1)), 0],
    outputRange: [TAB_WIDTH * (HOME_TABS.length - 1), 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      {/* Horizontal scrollable tab bar */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
          bounces={false}
        >
          {HOME_TABS.map((tab, i) => (
            <Pressable
              key={tab.key}
              onPress={() => goToTab(i)}
              style={[styles.tabBarItem, { width: TAB_WIDTH }]}
            >
              <Text
                style={[
                  styles.tabBarLabel,
                  displayTabIndex === i ? styles.tabBarLabelActive : null,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
          <Animated.View
            style={[
              styles.tabBarIndicator,
              {
                width: TAB_WIDTH,
                transform: [{ translateX: indicatorTranslateX }],
              },
            ]}
          />
        </ScrollView>
      </View>

      {/* Pager */}
      <View style={styles.pagerContainer} {...swipePanResponder.panHandlers}>
        <Animated.View
          style={[
            styles.pagerRow,
            {
              width: screenWidth * HOME_TABS.length,
              transform: [{ translateX: animPageValue }],
            },
          ]}
        >
          <View style={styles.page}>
            {displayTabIndex === RULES_TAB_INDEX ? (
              <RulesContent
                boardId={boardId}
                colors={effectiveColors}
                canManageRules={canManageRules}
              />
            ) : null}
          </View>
          <View style={styles.page}>
            {displayTabIndex === CHATS_TAB_INDEX ? (
              <ChatsContent boardId={boardId} colors={effectiveColors} />
            ) : null}
          </View>
          <View style={styles.page}>
            {displayTabIndex === FORUM_TAB_INDEX ? <BoardForumScreen /> : null}
          </View>
          <View style={styles.page}>
            {displayTabIndex === WIKI_TAB_INDEX ? <BoardWikiScreen /> : null}
          </View>
          <View style={styles.page}>
            {displayTabIndex === FEATURED_TAB_INDEX ? (
              <BoardFeaturedScreen />
            ) : null}
          </View>
          <View style={styles.page}>
            {displayTabIndex === RANKING_TAB_INDEX ? (
              <BoardRankingScreen />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    // Tab bar
    tabBarWrapper: {
      backgroundColor: colors.tabButtonBg,
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
    },
    tabBar: {
      flexDirection: "row",
      position: "relative",
    },
    tabBarItem: {
      alignItems: "center",
      paddingVertical: 11,
    },
    tabBarLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
    tabBarLabelActive: {
      color: colors.textPrimary,
    },
    tabBarIndicator: {
      backgroundColor: colors.accentPrimary,
      borderRadius: 1,
      bottom: 0,
      height: 2,
      left: 0,
      position: "absolute",
    },
    // Pager
    pagerContainer: {
      flex: 1,
      overflow: "hidden",
    },
    pagerRow: {
      flex: 1,
      flexDirection: "row",
    },
    page: {
      flex: 1,
      overflow: "hidden",
    },
    // Shared states
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 60,
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
    retryButtonPressed: {
      opacity: 0.92,
    },
    retryButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    // Rules
    rulesContainer: {
      flex: 1,
    },
    rulesLongPressArea: {
      flex: 1,
    },
    fab: {
      alignItems: "center",
      backgroundColor: colors.accentPrimary,
      borderRadius: 28,
      bottom: 24,
      elevation: 4,
      height: 56,
      justifyContent: "center",
      opacity: 0.5,
      position: "absolute",
      right: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      width: 56,
    },
    fabPressed: {
      opacity: 0.35,
    },
    sheetOption: {
      alignItems: "center",
      flexDirection: "row",
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    sheetOptionPressed: {
      opacity: 0.6,
    },
    sheetOptionText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    sheetOptionTextDestructive: {
      color: "#f87171",
      fontSize: 16,
      fontWeight: "600",
    },
    sheetDivider: {
      backgroundColor: colors.borderPrimary,
      height: 1,
      marginHorizontal: 20,
    },
    rulesScroll: {
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    rulesImage: {
      borderRadius: 12,
      height: 160,
      marginBottom: 4,
      width: "100%",
    },
    ruleItem: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 12,
    },
    ruleBadge: {
      alignItems: "center",
      backgroundColor: colors.accentPrimary,
      borderRadius: 8,
      flexShrink: 0,
      height: 26,
      justifyContent: "center",
      marginTop: 2,
      width: 26,
    },
    ruleBadgeText: {
      color: colors.bgPrimary,
      fontSize: 17,
      fontWeight: "800",
    },
    ruleBody: {
      flex: 1,
      gap: 4,
    },
    ruleTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 24,
    },
    ruleDescription: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 24,
    },
    // Chats
    chatsContainer: {
      flex: 1,
      paddingBottom: 18,
      paddingHorizontal: 16,
      paddingTop: 18,
    },
  });
}
