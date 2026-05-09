import { wikiRepository } from "../data/wiki-repository";

export function deleteWikiPage(
  boardId: string,
  pageId: string,
  channelId: string,
) {
  return wikiRepository.deleteWikiPage(boardId, pageId, channelId);
}
