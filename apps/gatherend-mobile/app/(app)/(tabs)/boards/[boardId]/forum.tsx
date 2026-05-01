import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useBoard } from "@/src/features/boards/hooks/use-board";
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
import { useTheme } from "@/src/theme/theme-provider";
import type { ForumPost, ForumPostComment } from "@/src/features/forum/domain/post";
import { Text } from "@/src/components/app-typography";

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

export default function BoardForumScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
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

  const [expandedPostsById, setExpandedPostsById] = useState<Record<string, true>>({});
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
    const preview = post.title ?? (post.content.length > 120 ? `${post.content.slice(0, 120)}…` : post.content);
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
    const preview = comment.content.length > 120 ? `${comment.content.slice(0, 120)}…` : comment.content;
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
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          Cargando foro...
        </Text>
      </View>
    );
  }

  if (isError && allPosts.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
          No se pudo cargar el foro
        </Text>
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          {error instanceof Error ? error.message : "Intenta nuevamente."}
        </Text>
        <Pressable
          onPress={() => void refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            {
              borderColor: colors.borderSecondary,
              backgroundColor: colors.bgTertiary,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>
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
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.accentPrimary}
        />
      }
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.centerState}>
          <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
            Todavía no hay posts
          </Text>
          <Text style={[styles.stateText, { color: colors.textMuted }]}>
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

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    listContent: {
      paddingVertical: 8,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 60,
    },
    stateTitle: {
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
    },
    stateText: {
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    retryButton: {
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 18,
    },
    retryButtonText: {
      fontSize: 14,
      fontWeight: "700",
    },
    footerLoader: {
      alignItems: "center",
      paddingVertical: 16,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
