import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import type { WikiRepository } from "../domain/wiki-repository";
import type { WikiPage, WikiPagePreviewsPage } from "../domain/wiki";

export function createWikiHttpDataSource(): WikiRepository {
  return {
    async getWikiPages(boardId, cursor) {
      const base = `/api/boards/${boardId}/wiki`;
      const url = cursor
        ? `${base}?cursor=${encodeURIComponent(cursor)}`
        : base;
      const response = await nextApiFetch(url);
      if (!response.ok) {
        throw new Error(
          await readNextApiError(
            response,
            "Error al cargar las páginas de la wiki",
          ),
        );
      }
      return (await response.json()) as WikiPagePreviewsPage;
    },

    async getWikiPage(boardId, pageId) {
      const response = await nextApiFetch(
        `/api/boards/${boardId}/wiki/${pageId}`,
      );
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al cargar la página"),
        );
      }
      const data = (await response.json()) as { page: WikiPage };
      return data.page;
    },

    async createWikiPage({ boardId, title, content, imageAssetId }) {
      const response = await nextApiFetch(`/api/boards/${boardId}/wiki`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: content ?? null,
          imageAssetId: imageAssetId ?? null,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al crear la página"),
        );
      }
      const data = (await response.json()) as { page: WikiPage };
      return data.page;
    },

    async editWikiPage(boardId, pageId, input) {
      const response = await nextApiFetch(
        `/api/boards/${boardId}/wiki/${pageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al editar la página"),
        );
      }
      const data = (await response.json()) as { page: WikiPage };
      return data.page;
    },

    async deleteWikiPage(boardId, pageId) {
      const response = await nextApiFetch(
        `/api/boards/${boardId}/wiki/${pageId}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        throw new Error(
          await readNextApiError(response, "Error al eliminar la página"),
        );
      }
    },
  };
}
