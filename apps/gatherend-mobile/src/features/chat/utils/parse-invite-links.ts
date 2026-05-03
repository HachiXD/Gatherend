const INVITE_LINK_RE =
  /(?:https?:\/\/[^\s]+)?\/invite\/([a-zA-Z0-9-]+)/g;

const INVITE_LINK_STRIP_RE =
  /(?:https?:\/\/[^\s]+)?\/invite\/[a-zA-Z0-9-]+/g;

export function parseInviteLinks(content: string): {
  hasInviteLinks: boolean;
  inviteCodes: string[];
  cleanContent: string;
} {
  const inviteCodes: string[] = [];
  let match: RegExpExecArray | null;

  INVITE_LINK_RE.lastIndex = 0;
  while ((match = INVITE_LINK_RE.exec(content)) !== null) {
    if (match[1]) inviteCodes.push(match[1]);
  }

  const cleanContent = content.replace(INVITE_LINK_STRIP_RE, "").trim();

  return {
    hasInviteLinks: inviteCodes.length > 0,
    inviteCodes: [...new Set(inviteCodes)],
    cleanContent,
  };
}
