import type { EditWikiPageInput } from "../domain/wiki";
import { wikiRepository } from "../data/wiki-repository";

export function editWikiPage(
  boardId: string,
  pageId: string,
  channelId: string,
  input: EditWikiPageInput,
) {
  return wikiRepository.editWikiPage(boardId, pageId, channelId, input);
}
