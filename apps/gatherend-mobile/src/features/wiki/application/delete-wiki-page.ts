import { wikiRepository } from "../data/wiki-repository";

export function deleteWikiPage(boardId: string, pageId: string) {
  return wikiRepository.deleteWikiPage(boardId, pageId);
}
