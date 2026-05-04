import type { WikiRepository } from "../domain/wiki-repository";
import { createWikiHttpDataSource } from "./wiki-http-datasource";

const wikiHttpDataSource = createWikiHttpDataSource();

export const wikiRepository: WikiRepository = {
  getWikiPages: (boardId, cursor) =>
    wikiHttpDataSource.getWikiPages(boardId, cursor),
  getWikiPage: (boardId, pageId) =>
    wikiHttpDataSource.getWikiPage(boardId, pageId),
  createWikiPage: (input) => wikiHttpDataSource.createWikiPage(input),
  editWikiPage: (boardId, pageId, input) =>
    wikiHttpDataSource.editWikiPage(boardId, pageId, input),
  deleteWikiPage: (boardId, pageId) =>
    wikiHttpDataSource.deleteWikiPage(boardId, pageId),
};
