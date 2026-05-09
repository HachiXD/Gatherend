import { wikiRepository } from "../data/wiki-repository";

export function getWikiPage(boardId: string, pageId: string, channelId: string) {
  return wikiRepository.getWikiPage(boardId, pageId, channelId);
}
