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
  ForumPostPreviewsPage,
  ForumPostsPage,
} from "../domain/post";

export function createForumHttpDataSource(): ForumRepository {
  return {
    async createPost({ channelId, title, content, imageAssetId }: CreatePostInput) {
      const response = await nextApiFetch(`/api/channels/${channelId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
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

    async getBoardPosts(boardId, cursor, channelId) {
      if (!channelId) {
        throw new Error("Channel ID is required to load forum posts");
      }
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      const query = params.toString();
      const url = `/api/channels/${channelId}/posts${query ? `?${query}` : ""}`;
      const response = await nextApiFetch(url);
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al cargar posts del foro"),
        );
      }
      return (await response.json()) as ForumPostsPage;
    },

    async getBoardPostPreviews(boardId, cursor, channelId) {
      if (!channelId) {
        throw new Error("Channel ID is required to load forum posts");
      }
      const params = new URLSearchParams({ preview: "true" });
      if (cursor) params.set("cursor", cursor);
      const url = `/api/channels/${channelId}/posts?${params.toString()}`;
      const response = await nextApiFetch(url);
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al cargar posts del foro"),
        );
      }
      return (await response.json()) as ForumPostPreviewsPage;
    },

    async getPost(boardId, postId, channelId) {
      const response = await nextApiFetch(
        `/api/channels/${channelId}/posts/${postId}`,
      );
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al cargar el post"),
        );
      }
      const data = (await response.json()) as { post: ForumPost };
      return data.post;
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
