"use client";

import { memo, type CSSProperties, useMemo } from "react";
import { Crown, Ghost, HardHat } from "lucide-react";
import { useColorExtraction } from "@/hooks/use-color-extraction";
import { getNeverAnimatedImageUrl } from "@/lib/media-static";
import { useBoardData } from "@/hooks/use-board-data";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { MemberRole } from "@prisma/client";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const roleIconMap: Record<MemberRole, React.ReactNode> = {
  GUEST: null,
  MODERATOR: <Ghost className="ml-2 h-4 w-4 text-indigo-500" />,
  ADMIN: <HardHat className="h-4 w-4 text-rose-500" />,
  OWNER: <Crown className="ml-2 h-4 w-4 text-[#FFD700]" />,
};

const ROLE_HIERARCHY: Record<MemberRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MODERATOR: 2,
  GUEST: 3,
};

const MEMBER_ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";

function parseRgbColor(color: string): [number, number, number] | null {
  const m =
    color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i) ??
    color.match(
      /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*[0-9.]+\s*\)$/i,
    );
  if (!m) return null;
  return m.slice(1, 4).map(Number) as [number, number, number];
}

function isVeryDarkColor(color: string): boolean {
  const rgb = parseRgbColor(color);
  if (!rgb) return false;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  return l <= 0.24;
}

// ─── MembersView inner ────────────────────────────────────────────────────────

function MembersViewInner() {
  const boardId = useCurrentBoardId();
  const {
    data: board,
    isLoading: boardLoading,
    error: boardError,
  } = useBoardData(boardId, { enableFetch: true });

  const bannerImageUrl = board?.imageAsset?.url
    ? getNeverAnimatedImageUrl(board.imageAsset.url, { w: 2048, h: 512, q: 82 })
    : undefined;

  const precomputedColor = board?.imageAsset?.dominantColor ?? null;
  const { dominantColor: extractedColor } = useColorExtraction({
    imageUrl: precomputedColor ? null : bannerImageUrl,
  });
  const dominantColor = precomputedColor ?? extractedColor;
  const headerBg = dominantColor ?? "var(--theme-bg-secondary)";
  const useLightVariant = isVeryDarkColor(headerBg);

  const headerButtonStyles = useMemo(
    () =>
      ({
        backgroundColor: headerBg,
        "--community-header-btn-bg": useLightVariant
          ? `color-mix(in srgb, ${headerBg} 82%, white)`
          : `color-mix(in srgb, ${headerBg} 72%, black)`,
        "--community-header-btn-hover": useLightVariant
          ? `color-mix(in srgb, ${headerBg} 68%, white)`
          : `color-mix(in srgb, ${headerBg} 58%, black)`,
        "--community-header-btn-text": `color-mix(in srgb, white 88%, ${headerBg} 12%)`,
        "--community-header-btn-muted": `color-mix(in srgb, white 68%, ${headerBg} 32%)`,
        "--community-header-btn-ring": `color-mix(in srgb, white 28%, ${headerBg} 72%)`,
      }) as CSSProperties,
    [headerBg, useLightVariant],
  );

  const sortedMembers = useMemo(() => {
    if (!board?.members) return [];
    return [...board.members].sort(
      (a, b) => ROLE_HIERARCHY[a.role] - ROLE_HIERARCHY[b.role],
    );
  }, [board?.members]);

  if (!board && boardLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
        <div className="h-12 w-full shrink-0 animate-pulse bg-theme-bg-secondary/70" />
        <div className="flex-1 space-y-2 px-6 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-full animate-pulse rounded bg-theme-bg-secondary/70"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!board && boardError) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center text-destructive">
        {boardError.message}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
      <div className="h-full w-full overflow-y-auto scrollbar-chat">
        {/* Header */}
        <div className="sticky top-0 z-20 shrink-0 border-b border-theme-border transition-colors duration-300">
          <div className="px-0 pt-2 pb-2" style={headerButtonStyles}>
            <div className="ml-3 mr-3 flex items-center gap-2">
              <div className="flex min-w-20 items-center justify-center gap-2 bg-(--community-header-btn-bg) px-3 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]">
                <p className="text-center text-[16px] font-semibold text-theme-text-subtle">
                  [Miembros]
                </p>
              </div>
              <span className="ml-1 text-[13px] text-(--community-header-btn-muted)">
                {sortedMembers.length}{" "}
                {sortedMembers.length === 1 ? "miembro" : "miembros"}
              </span>
            </div>
          </div>
        </div>

        {/* Members list */}
        <div className="px-4 py-4">
          <div className="space-y-2">
            {sortedMembers.map((member) => (
              <div key={member.id} className={cn(MEMBER_ROW_CLASS, "gap-2")}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar
                    src={member.profile.avatarAsset?.url ?? ""}
                    showStatus={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-0 text-sm font-semibold text-theme-text-primary">
                      <span className="truncate">{member.profile.username}</span>
                      {roleIconMap[member.role]}
                    </div>
                    <p className="truncate text-[11px] text-theme-text-tertiary">
                      /{member.profile.discriminator}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MembersView = memo(MembersViewInner);
