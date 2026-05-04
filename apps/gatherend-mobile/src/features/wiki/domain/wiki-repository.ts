import type {
  CreateWikiPageInput,
  EditWikiPageInput,
  WikiPage,
  WikiPagePreviewsPage,
} from "./wiki";

export type WikiRepository = {
  getWikiPages: (
    boardId: string,
    cursor?: string | null,
  ) => Promise<WikiPagePreviewsPage>;
  getWikiPage: (boardId: string, pageId: string) => Promise<WikiPage>;
  createWikiPage: (input: CreateWikiPageInput) => Promise<WikiPage>;
  editWikiPage: (
    boardId: string,
    pageId: string,
    input: EditWikiPageInput,
  ) => Promise<WikiPage>;
  deleteWikiPage: (boardId: string, pageId: string) => Promise<void>;
};
