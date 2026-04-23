"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/user-avatar";
import { Loader2, ScrollText } from "lucide-react";
import { BoardModerationActionType, Profile } from "@prisma/client";
import axios from "axios";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

const HEADER_PANEL_SHELL =
  "rounded-lg border border-theme-border bg-theme-bg-overlay-primary/78 mr-1.5 pt-4 pb-0 sm:px-5 sm:py-5";
const ACTION_ROW_CLASS =
  "flex min-h-10 items-center gap-3 rounded-lg border border-theme-border-subtle bg-theme-bg-edit-form/50 px-3 py-1";
const actionButtonClass =
  "h-6.5 min-w-[120px] cursor-pointer rounded-lg bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light transition hover:bg-theme-tab-button-hover";
const actionBadgeClass =
  "inline-flex items-center rounded-lg border border-theme-border bg-theme-bg-secondary/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-theme-text-muted";

interface ModerationProfile
  extends Pick<Profile, "id" | "username" | "discriminator"> {
  avatarAsset: ClientUploadedAsset | null;
}

interface BoardModerationActionItem {
  id: string;
  actionType: BoardModerationActionType;
  createdAt: string;
  profile: ModerationProfile;
  issuedBy: ModerationProfile;
  warning: {
    id: string;
    status: string;
    removedAt: string | null;
    promotedToBanId: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  ban: {
    id: string;
    sourceType: string;
    createdAt: string;
  } | null;
}

interface BoardModerationActionsPage {
  items: BoardModerationActionItem[];
  actions: BoardModerationActionItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface ModerationHistoryTabProps {
  boardId: string;
}

function replaceTemplate(
  template: string,
  replacements: Record<string, string>,
) {
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    template,
  );
}

export const ModerationHistoryTab = ({
  boardId,
}: ModerationHistoryTabProps) => {
  const { t } = useTranslation();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["boardModerationActions", boardId],
    queryFn: async ({
      pageParam,
    }: {
      pageParam?: string | null;
    }): Promise<BoardModerationActionsPage> => {
      const response = await axios.get<BoardModerationActionsPage>(
        `/api/boards/${boardId}/moderation-actions`,
        {
          params: {
            cursor: pageParam ?? undefined,
            limit: 20,
          },
        },
      );
      return response.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 1000 * 60,
  });

  const actions = data?.pages.flatMap((page) => page.items) ?? [];

  const getActionLabel = (actionType: BoardModerationActionType) => {
    switch (actionType) {
      case "WARNING":
        return t.overlays.boardSettings.history.actions.warning;
      case "REMOVE_WARNING":
        return t.overlays.boardSettings.history.actions.removeWarning;
      case "BAN":
        return t.overlays.boardSettings.history.actions.ban;
      case "UNBAN":
        return t.overlays.boardSettings.history.actions.unban;
      case "KICK":
        return t.overlays.boardSettings.history.actions.kick;
      case "AUTO_BAN":
        return t.overlays.boardSettings.history.actions.autoBan;
      case "AUTO_UNBAN":
        return t.overlays.boardSettings.history.actions.autoUnban;
      default:
        return actionType;
    }
  };

  const getActionDescription = (action: BoardModerationActionItem) => {
    const actor = action.issuedBy.username;

    switch (action.actionType) {
      case "WARNING":
        return replaceTemplate(
          t.overlays.boardSettings.history.descriptions.warning,
          { username: actor },
        );
      case "REMOVE_WARNING":
        return replaceTemplate(
          t.overlays.boardSettings.history.descriptions.removeWarning,
          { username: actor },
        );
      case "BAN":
        return replaceTemplate(
          t.overlays.boardSettings.history.descriptions.ban,
          { username: actor },
        );
      case "UNBAN":
        return replaceTemplate(
          t.overlays.boardSettings.history.descriptions.unban,
          { username: actor },
        );
      case "KICK":
        return replaceTemplate(
          t.overlays.boardSettings.history.descriptions.kick,
          { username: actor },
        );
      case "AUTO_BAN":
        return t.overlays.boardSettings.history.descriptions.autoBan;
      case "AUTO_UNBAN":
        return t.overlays.boardSettings.history.descriptions.autoUnban;
      default:
        return action.actionType;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className={HEADER_PANEL_SHELL}>
          <div className="border-b border-theme-border pb-0.5 -mb-3 -mt-3">
            <h2 className="text-2xl font-bold text-theme-text-primary">
              {t.overlays.boardSettings.history.title}
            </h2>
            <p className="-mt-1 text-sm text-theme-text-tertiary">
              {t.overlays.boardSettings.history.loading}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={HEADER_PANEL_SHELL}>
        <div className="border-b border-theme-border pb-0.5 -mb-3 -mt-3">
          <h2 className="text-2xl font-bold text-theme-text-primary">
            {t.overlays.boardSettings.history.title}
          </h2>
          <p className="-mt-1 text-sm text-theme-text-tertiary">
            {actions.length}{" "}
            {actions.length === 1
              ? t.overlays.boardSettings.history.entry
              : t.overlays.boardSettings.history.entries}
          </p>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-1 text-center">
          <ScrollText className="mb-3 h-12 w-12 text-theme-text-muted" />
          <p className="text-md font-medium text-theme-text-tertiary">
            {t.overlays.boardSettings.history.emptyTitle}
          </p>
          <p className="mt-1 text-sm text-theme-text-muted">
            {t.overlays.boardSettings.history.emptyDescription}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[500px] pr-6 -mt-4">
          <div className="space-y-4">
            {actions.map((action) => (
              <div key={action.id} className={cn(ACTION_ROW_CLASS, "gap-2")}>
                <UserAvatar
                  src={action.profile.avatarAsset?.url || ""}
                  profileId={action.profile.id}
                  showStatus={false}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-theme-text-primary">
                    <span className="truncate">{action.profile.username}</span>
                    <span className={actionBadgeClass}>
                      {getActionLabel(action.actionType)}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-theme-text-tertiary">
                    /{action.profile.discriminator}
                  </p>
                  <p className="mt-1 text-[11px] text-theme-text-muted">
                    {getActionDescription(action)}
                  </p>
                  <p className="text-[11px] text-theme-text-muted">
                    {new Date(action.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button
                  onClick={() => fetchNextPage()}
                  className={actionButtonClass}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t.discovery.loadMore
                  )}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
