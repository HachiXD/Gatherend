import { wikiRepository } from "../data/wiki-repository";

export function getWikiPage(boardId: string, pageId: string) {
  return wikiRepository.getWikiPage(boardId, pageId);
}
