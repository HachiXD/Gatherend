import { wikiRepository } from "../data/wiki-repository";

export function getWikiPages(
  boardId: string,
  cursor?: string | null,
  channelId?: string | null,
) {
  return wikiRepository.getWikiPages(boardId, cursor, channelId);
}
