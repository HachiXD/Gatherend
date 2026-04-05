const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;

export function containsExternalLinks(content: string): boolean {
  return URL_REGEX.test(content);
}
