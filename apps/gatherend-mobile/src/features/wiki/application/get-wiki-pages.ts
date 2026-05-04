import { wikiRepository } from "../data/wiki-repository";

export function getWikiPages(boardId: string, cursor?: string | null) {
  return wikiRepository.getWikiPages(boardId, cursor);
}
