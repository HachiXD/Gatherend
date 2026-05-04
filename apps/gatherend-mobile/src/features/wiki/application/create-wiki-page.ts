import type { CreateWikiPageInput } from "../domain/wiki";
import { wikiRepository } from "../data/wiki-repository";

export function createWikiPage(input: CreateWikiPageInput) {
  return wikiRepository.createWikiPage(input);
}
