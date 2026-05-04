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

    async getBoardPostPreviews(boardId, cursor) {
      const base = `/api/boards/${boardId}/posts?preview=true`;
      const url = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;
      const response = await nextApiFetch(url);
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al cargar posts del foro"),
        );
      }
      return (await response.json()) as ForumPostPreviewsPage;
    },

    async getPost(boardId, postId) {
      const url = `/api/boards/${boardId}/posts/${postId}`;
      console.log("[getPost] fetching", url);
      const response = await nextApiFetch(url);
      console.log("[getPost] status", response.status);
      if (!response.ok) {
        const errText = await response.text();
        console.log("[getPost] error body", errText);
        throw new Error(errText || "Error al cargar el post");
      }
      const data = (await response.json()) as { post: ForumPost };
      console.log("[getPost] response keys", Object.keys(data));
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
