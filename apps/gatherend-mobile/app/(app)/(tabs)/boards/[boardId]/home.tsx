import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { BoardChannelsList } from "@/src/features/boards/components/board-channels-list";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { useVoiceStore } from "@/src/features/voice/store/use-voice-store";
import { useBoardPosts } from "@/src/features/forum/hooks/use-board-posts";
import { useCreateComment } from "@/src/features/forum/hooks/use-create-comment";
import { useDeleteComment } from "@/src/features/forum/hooks/use-delete-comment";
import { useDeletePost } from "@/src/features/forum/hooks/use-delete-post";
import { useEditComment } from "@/src/features/forum/hooks/use-edit-comment";
import { useEditPost } from "@/src/features/forum/hooks/use-edit-post";
import { PostCard } from "@/src/features/forum/components/post-card";
import {
  ReportScreen,
  type ReportCategoryConfig,
} from "@/src/features/report/components/report-screen";
import type { ReportTargetType } from "@/src/features/report/api/submit-report";
import { useBoardRules } from "@/src/features/rules/hooks/use-board-rules";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useTheme } from "@/src/theme/theme-provider";
import type { ThemeColors } from "@/src/theme/types";
import {
  generateGrayPaletteFromBase,
  generateLightPaletteFromBase,
  generatePaletteFromBase,
  hexToHsl,
} from "@/src/theme/utils";
import { Text } from "@/src/components/app-typography";
import type {
  ForumPost,
  ForumPostComment,
} from "@/src/features/forum/domain/post";

// ─── Config ───────────────────────────────────────────────────────────────────

type HomeTabKey = "rules" | "chats" | "forum";

const HOME_TABS: Array<{ key: HomeTabKey; label: string }> = [
  { key: "rules", label: "Rules" },
  { key: "chats", label: "Chats" },
  { key: "forum", label: "Forum" },
];

const INITIAL_TAB_INDEX = 1; // Chats

function normalizeDominantColor(raw: string | null | undefined) {
  if (!raw) return null;

  const rgbMatch = raw.match(
    /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i,
  );
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

// ─── Report categories ────────────────────────────────────────────────────────

const POST_REPORT_CATEGORIES: ReportCategoryConfig[] = [
  { value: "CSAM", label: "Seguridad infantil", description: "El post involucra a menores de forma inapropiada" },
  { value: "SEXUAL_CONTENT", label: "Contenido sexual", description: "El post contiene material explícito o no solicitado" },
  { value: "HARASSMENT", label: "Acoso", description: "El post contiene amenazas o comportamiento intimidatorio" },
  { value: "HATE_SPEECH", label: "Discurso de odio", description: "Promueve odio contra grupos o personas" },
  { value: "SPAM", label: "Spam", description: "Contenido repetitivo, engañoso o no solicitado" },
  { value: "IMPERSONATION", label: "Suplantación de identidad", description: "Se hace pasar por otra persona" },
  { value: "OTHER", label: "Otro", description: "Razón no listada anteriormente" },
];

const COMMENT_REPORT_CATEGORIES: ReportCategoryConfig[] = [
  { value: "CSAM", label: "Seguridad infantil", description: "El comentario involucra a menores de forma inapropiada" },
  { value: "SEXUAL_CONTENT", label: "Contenido sexual", description: "El comentario contiene material explícito" },
  { value: "HARASSMENT", label: "Acoso", description: "El comentario contiene amenazas o acoso" },
  { value: "HATE_SPEECH", label: "Discurso de odio", description: "Promueve odio contra grupos o personas" },
  { value: "SPAM", label: "Spam", description: "Contenido repetitivo, engañoso o no solicitado" },
  { value: "IMPERSONATION", label: "Suplantación de identidad", description: "Se hace pasar por otra persona" },
  { value: "OTHER", label: "Otro", description: "Razón no listada anteriormente" },
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

// ─── RulesContent ─────────────────────────────────────────────────────────────

function RulesContent({
  boardId,
  colors,
}: {
  boardId: string | undefined;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: rules, isLoading } = useBoardRules(boardId);

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
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>Todavía no hay reglas</Text>
        <Text style={styles.stateText}>
          Los administradores aún no han definido reglas para este board.
        </Text>
      </View>
    );
  }

  return (
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

  if (board.channels.length === 0) {
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
        channels={board.channels}
        onSelectChannel={(channelId) => {
          if (!boardId) return;
          router.replace({
            pathname: "/(app)/boards/[boardId]/chats/[channelId]",
            params: { boardId, channelId },
          });
        }}
        onJoinVoice={handleJoinVoice}
      />
    </View>
  );
}

// ─── ForumContent ─────────────────────────────────────────────────────────────

function ForumContent({
  boardId,
  colors,
}: {
  boardId: string | undefined;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  const profile = useProfile();
  const { data: board } = useBoard(boardId);

  const {
    data,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useBoardPosts(boardId);

  const allPosts = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const [expandedPostsById, setExpandedPostsById] = useState<
    Record<string, true>
  >({});
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);

  const createComment = useCreateComment(boardId ?? "");
  const editPost = useEditPost(boardId ?? "");
  const editComment = useEditComment(boardId ?? "");
  const deletePost = useDeletePost(boardId ?? "");
  const deleteComment = useDeleteComment(boardId ?? "");

  const handleToggleExpand = useCallback((postId: string) => {
    setExpandedPostsById((prev) => {
      if (prev[postId]) {
        const next = { ...prev };
        delete next[postId];
        return next;
      }
      return { ...prev, [postId]: true };
    });
  }, []);

  const handleCreateComment = useCallback(
    (postId: string, content: string) => {
      createComment.mutate({ postId, content });
    },
    [createComment],
  );

  const handleEditPost = useCallback(
    (postId: string, content: string) => {
      editPost.mutate({ postId, content });
    },
    [editPost],
  );

  const handleEditComment = useCallback(
    (postId: string, commentId: string, content: string) => {
      editComment.mutate({ postId, commentId, content });
    },
    [editComment],
  );

  const handleDeletePost = useCallback(
    (postId: string) => {
      deletePost.mutate(postId);
    },
    [deletePost],
  );

  const handleDeleteComment = useCallback(
    (postId: string, commentId: string) => {
      deleteComment.mutate({ postId, commentId });
    },
    [deleteComment],
  );

  const currentMemberRole = board?.currentMember?.role ?? null;

  const handleReportPost = useCallback((post: ForumPost) => {
    const preview =
      post.title ??
      (post.content.length > 120
        ? `${post.content.slice(0, 120)}…`
        : post.content);
    setReportConfig({
      title: "Reportar post",
      previewLabel: preview || "Post sin texto",
      categories: POST_REPORT_CATEGORIES,
      targetType: "COMMUNITY_POST",
      targetId: post.id,
      targetOwnerId: post.author.id,
      snapshot: {
        title: post.title,
        content: post.content,
        authorUsername: post.author.username,
      },
    });
  }, []);

  const handleReportComment = useCallback((comment: ForumPostComment) => {
    const preview =
      comment.content.length > 120
        ? `${comment.content.slice(0, 120)}…`
        : comment.content;
    setReportConfig({
      title: "Reportar comentario",
      previewLabel: preview || "Comentario sin texto",
      categories: COMMENT_REPORT_CATEGORIES,
      targetType: "COMMUNITY_POST_COMMENT",
      targetId: comment.id,
      targetOwnerId: comment.author.id,
      snapshot: {
        content: comment.content,
        authorUsername: comment.author.username,
        postId: comment.postId,
      },
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ForumPost }) => (
      <PostCard
        post={item}
        currentProfileId={profile.id}
        currentMemberRole={currentMemberRole}
        isExpanded={!!expandedPostsById[item.id]}
        isSubmittingComment={createComment.isPending}
        onToggleExpand={handleToggleExpand}
        onCreateComment={handleCreateComment}
        onEditPost={handleEditPost}
        onEditComment={handleEditComment}
        onDeletePost={handleDeletePost}
        onDeleteComment={handleDeleteComment}
        onReportPost={handleReportPost}
        onReportComment={handleReportComment}
      />
    ),
    [
      profile.id,
      currentMemberRole,
      expandedPostsById,
      createComment.isPending,
      handleToggleExpand,
      handleCreateComment,
      handleEditPost,
      handleEditComment,
      handleDeletePost,
      handleDeleteComment,
      handleReportPost,
      handleReportComment,
    ],
  );

  if (isLoading && allPosts.length === 0) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={styles.stateText}>Cargando foro...</Text>
      </View>
    );
  }

  if (isError && allPosts.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>No se pudo cargar el foro</Text>
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
            {isRefetching ? "Reintentando..." : "Reintentar"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <FlashList
        data={allPosts}
        estimatedItemSize={280}
        extraData={expandedPostsById}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.accentPrimary}
          />
        }
        contentContainerStyle={styles.forumListContent}
        ListEmptyComponent={
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>Todavía no hay posts</Text>
            <Text style={styles.stateText}>
              Sé el primero en publicar en{" "}
              {board?.name ? `el foro de ${board.name}` : "este foro"}.
            </Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.accentPrimary} size="small" />
            </View>
          ) : null
        }
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
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BoardHomeScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors, mode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { data: board } = useBoard(boardId);
  const boardColors = useMemo(
    () =>
      getBoardDerivedColors(
        board?.bannerAsset?.dominantColor ?? board?.imageAsset?.dominantColor,
        mode,
      ),
    [board?.bannerAsset?.dominantColor, board?.imageAsset?.dominantColor, mode],
  );
  const effectiveColors = boardColors ?? colors;
  const styles = useMemo(() => createStyles(effectiveColors), [effectiveColors]);

  const tabIndexRef = useRef(INITIAL_TAB_INDEX);
  const [displayTabIndex, setDisplayTabIndex] = useState(INITIAL_TAB_INDEX);
  const animPageValue = useRef(
    new Animated.Value(-screenWidth * INITIAL_TAB_INDEX),
  ).current;

  const tabWidth = screenWidth / HOME_TABS.length;

  const goToTab = useCallback(
    (index: number) => {
      tabIndexRef.current = index;
      setDisplayTabIndex(index);
      Animated.spring(animPageValue, {
        toValue: -screenWidth * index,
        damping: 22,
        stiffness: 230,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    },
    [animPageValue, screenWidth],
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
            -(
              screenWidth * (HOME_TABS.length - 1 - tabIndexRef.current)
            ) - screenWidth * 0.25;
          animPageValue.setValue(Math.max(maxLeft, Math.min(maxRight, g.dx)));
        },
        onPanResponderRelease: (_e, g) => {
          animPageValue.flattenOffset();
          let nextIndex = tabIndexRef.current;
          if (g.dx < -(screenWidth * 0.3) || g.vx < -0.5) {
            nextIndex = Math.min(
              tabIndexRef.current + 1,
              HOME_TABS.length - 1,
            );
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
    outputRange: [tabWidth * (HOME_TABS.length - 1), 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      {/* Horizontal tab bar */}
      <View style={styles.tabBar}>
        {HOME_TABS.map((tab, i) => (
          <Pressable
            key={tab.key}
            onPress={() => goToTab(i)}
            style={styles.tabBarItem}
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
              width: tabWidth,
              transform: [{ translateX: indicatorTranslateX }],
            },
          ]}
        />
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
            <RulesContent boardId={boardId} colors={effectiveColors} />
          </View>
          <View style={styles.page}>
            <ChatsContent boardId={boardId} colors={effectiveColors} />
          </View>
          <View style={styles.page}>
            <ForumContent boardId={boardId} colors={effectiveColors} />
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
    tabBar: {
      backgroundColor: colors.tabButtonBg,
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
      flexDirection: "row",
      position: "relative",
    },
    tabBarItem: {
      alignItems: "center",
      flex: 1,
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
      fontSize: 12,
      fontWeight: "800",
    },
    ruleBody: {
      flex: 1,
      gap: 4,
    },
    ruleTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 20,
    },
    ruleDescription: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    // Chats
    chatsContainer: {
      flex: 1,
      paddingBottom: 18,
      paddingHorizontal: 16,
      paddingTop: 18,
    },
    // Forum
    forumListContent: {
      paddingVertical: 8,
    },
    footerLoader: {
      alignItems: "center",
      paddingVertical: 16,
    },
  });
}
