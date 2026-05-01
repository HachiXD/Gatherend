import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import type { CreatePostInput, ForumRepository } from "../domain/forum-repository";
import type {
  EditedPost,
  ForumPost,
  ForumPostComment,
  ForumPostCommentsResult,
  ForumPostsPage,
} from "../domain/post";

export function createForumHttpDataSource(): ForumRepository {
  return {
    async createPost({ boardId, title, content, imageAssetId }: CreatePostInput) {
      const response = await nextApiFetch(`/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          title: title ?? null,
          content: content ?? null,
          imageAssetId: imageAssetId ?? null,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al crear el post"),
        );
      }
      return (await response.json()) as ForumPost;
    },

    async getBoardPosts(boardId, cursor) {
      const url = cursor
        ? `/api/boards/${boardId}/posts?cursor=${encodeURIComponent(cursor)}`
        : `/api/boards/${boardId}/posts`;
      const response = await nextApiFetch(url);
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al cargar posts del foro"),
        );
      }
      return (await response.json()) as ForumPostsPage;
    },

    async getPostComments(postId) {
      const response = await nextApiFetch(`/api/posts/${postId}/comments`);
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al cargar comentarios"),
        );
      }
      return (await response.json()) as ForumPostCommentsResult;
    },

    async createComment({ postId, content, imageAssetId, replyToCommentId }) {
      const response = await nextApiFetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          imageAssetId: imageAssetId ?? null,
          replyToCommentId: replyToCommentId ?? null,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al enviar comentario"),
        );
      }
      return (await response.json()) as ForumPostComment;
    },

    async editPost(postId, content) {
      const response = await nextApiFetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al editar el post"),
        );
      }
      return (await response.json()) as EditedPost;
    },

    async editComment(postId, commentId, content) {
      const response = await nextApiFetch(
        `/api/posts/${postId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al editar el comentario"),
        );
      }
      return (await response.json()) as ForumPostComment;
    },

    async deletePost(postId) {
      const response = await nextApiFetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al eliminar el post"),
        );
      }
    },

    async deleteComment(postId, commentId) {
      const response = await nextApiFetch(
        `/api/posts/${postId}/comments/${commentId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al eliminar el comentario"),
        );
      }
    },
  };
}
