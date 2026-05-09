import type { WikiRepository } from "../domain/wiki-repository";
import { createWikiHttpDataSource } from "./wiki-http-datasource";

const wikiHttpDataSource = createWikiHttpDataSource();

export const wikiRepository: WikiRepository = {
  getWikiPages: (boardId, cursor, channelId) =>
    wikiHttpDataSource.getWikiPages(boardId, cursor, channelId),
  getWikiPage: (boardId, pageId, channelId) =>
    wikiHttpDataSource.getWikiPage(boardId, pageId, channelId),
  createWikiPage: (input) => wikiHttpDataSource.createWikiPage(input),
  editWikiPage: (boardId, pageId, channelId, input) =>
    wikiHttpDataSource.editWikiPage(boardId, pageId, channelId, input),
  deleteWikiPage: (boardId, pageId, channelId) =>
    wikiHttpDataSource.deleteWikiPage(boardId, pageId, channelId),
};
