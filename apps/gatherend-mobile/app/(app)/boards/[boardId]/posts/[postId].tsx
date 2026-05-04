import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { usePost } from "@/src/features/forum/hooks/use-post";
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

export default function PostDetailScreen() {
  const { boardId, postId } = useLocalSearchParams<{ boardId: string; postId: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const profile = useProfile();
  const { data: board } = useBoard(boardId);
  const { data: post, isLoading, isError } = usePost(boardId, postId);

  const [isExpanded, setIsExpanded] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);

  const createComment = useCreateComment(boardId ?? "");
  const editPost = useEditPost(boardId ?? "");
  const editComment = useEditComment(boardId ?? "");
  const deletePost = useDeletePost(boardId ?? "");
  const deleteComment = useDeleteComment(boardId ?? "");

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleCreateComment = useCallback(
    (pid: string, content: string) => {
      createComment.mutate({ postId: pid, content });
    },
    [createComment],
  );

  const handleEditPost = useCallback(
    (pid: string, content: string) => {
      editPost.mutate({ postId: pid, content });
    },
    [editPost],
  );

  const handleEditComment = useCallback(
    (pid: string, commentId: string, content: string) => {
      editComment.mutate({ postId: pid, commentId, content });
    },
    [editComment],
  );

  const handleDeletePost = useCallback(
    (pid: string) => {
      deletePost.mutate(pid, {
        onSuccess: () => router.back(),
      });
    },
    [deletePost, router],
  );

  const handleDeleteComment = useCallback(
    (pid: string, commentId: string) => {
      deleteComment.mutate({ postId: pid, commentId });
    },
    [deleteComment],
  );

  const handleReportPost = useCallback((p: ForumPost) => {
    const preview = p.title ?? (p.content.length > 120 ? `${p.content.slice(0, 120)}…` : p.content);
    setReportConfig({
      title: "Reportar post",
      previewLabel: preview || "Post sin texto",
      categories: POST_REPORT_CATEGORIES,
      targetType: "COMMUNITY_POST",
      targetId: p.id,
      targetOwnerId: p.author.id,
      snapshot: { title: p.title, content: p.content, authorUsername: p.author.username },
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
      snapshot: { content: comment.content, authorUsername: comment.author.username, postId: comment.postId },
    });
  }, []);

  const currentMemberRole = board?.currentMember?.role ?? null;

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
      </View>
    );
  }

  if (isError || !post) {
    return (
      <View style={styles.centerState}>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          No se pudo cargar el post.
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={{ backgroundColor: colors.bgPrimary }}
      >
        <PostCard
          post={post}
          currentProfileId={profile.id}
          currentMemberRole={currentMemberRole}
          isExpanded={isExpanded}
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
      </ScrollView>

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
    scrollContent: {
      paddingVertical: 8,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      backgroundColor: colors.bgPrimary,
    },
    errorText: {
      fontSize: 14,
      textAlign: "center",
    },
  });
}
