"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useBoardSwitchSafe } from "@/contexts/board-switch-context";
import { upsertUserBoardFromJoin } from "@/hooks/use-user-boards";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface BoardPreviewData {
  id: string;
  name: string;
  imageAsset: ClientUploadedAsset | null;
  memberCount: number;
  size: number;
  inviteCode: string;
}

interface InviteLinkPreviewProps {
  inviteCode: string;
  className?: string;
}

export const InviteLinkPreview = ({
  inviteCode,
  className,
}: InviteLinkPreviewProps) => {
  const router = useRouter();
  const boardSwitch = useBoardSwitchSafe();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [boardData, setBoardData] = useState<BoardPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/boards/invite-preview/${inviteCode}`,
        );

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Failed to load invite");
          return;
        }

        const data = await response.json();
        setBoardData(data);
      } catch {
        setError("Failed to load invite");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBoardData();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (isJoining) return;

    if (!boardData) {
      router.push(`/invite/${inviteCode}`);
      return;
    }

      try {
        setIsJoining(true);
        setIsBanned(false);

        const response = await fetch(
          `/api/boards/${boardData.id}/join?source=invitation&inviteCode=${encodeURIComponent(inviteCode)}`,
          { method: "POST" },
        );

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          if (response.status === 403 && data?.error === "Banned from this board") {
            setIsBanned(true);
            return;
          }
          router.push(`/invite/${inviteCode}`);
          return;
        }

      const data: { success?: boolean; alreadyMember?: boolean } =
        await response.json();
      const { success, alreadyMember, targetChannelId, redirectUrl } = data as {
        success?: boolean;
        alreadyMember?: boolean;
        targetChannelId?: string | null;
        redirectUrl?: string;
      };

      if (!success && !alreadyMember) {
        router.push(`/invite/${inviteCode}`);
        return;
      }

      upsertUserBoardFromJoin(queryClient, {
        id: boardData.id,
        name: boardData.name,
        imageAsset: boardData.imageAsset,
        targetChannelId: targetChannelId ?? null,
      });
      await queryClient.invalidateQueries({ queryKey: ["board", boardData.id] });

      startTransition(() => {
        if (boardSwitch?.isClientNavigationEnabled) {
          if (success && !alreadyMember) {
            boardSwitch.switchToRules(boardData.id);
          } else {
            boardSwitch.switchBoard(boardData.id);
          }
        } else {
          router.push(
            redirectUrl ?? `/boards/${boardData.id}/rules`,
          );
        }
      });
    } catch {
      router.push(`/invite/${inviteCode}`);
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg bg-theme-bg-secondary border border-theme-border-primary w-fit max-w-[320px] animate-pulse",
          className,
        )}
      >
        <div className="w-12 h-12 rounded-lg bg-theme-border-primary" />
        <div className="flex flex-col gap-2">
          <div className="w-24 h-4 rounded bg-theme-border-primary" />
          <div className="w-16 h-3 rounded bg-theme-border-primary" />
        </div>
      </div>
    );
  }

  if (error || !boardData) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg bg-theme-bg-secondary border border-theme-border-primary w-fit max-w-[320px]",
          className,
        )}
      >
        <div className="w-12 h-12 rounded-lg bg-theme-border-primary flex items-center justify-center">
          <Users className="w-6 h-6 text-theme-text-muted" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-theme-text-tertiary">
            {error === "Invitations disabled"
              ? "Invitations are disabled"
              : "Invalid invite link"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-theme-bg-secondary border border-theme-border-secondary w-fit max-w-[320px]",
        className,
      )}
    >
      {/* Board Image */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-theme-bg-tertiary shrink-0">
        {boardData.imageAsset?.url ? (
          <Image
            src={boardData.imageAsset.url}
            alt={boardData.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-theme-accent-primary">
            <span className="text-white text-lg font-bold">
              {boardData.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Board Info */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-semibold text-theme-text-light truncate">
          {boardData.name}
        </span>
        <span className="text-xs text-theme-text-subtle flex items-center gap-1">
          <Users className="w-3 h-3" />
          {boardData.memberCount}/{boardData.size} members
        </span>
      </div>

      {/* Join Button */}
      <Button
        onClick={handleJoin}
        size="sm"
        disabled={isJoining || isPending || isBanned}
        className="bg-theme-button-primary cursor-pointer hover:bg-theme-button-hover text-white shrink-0"
      >
        {isBanned ? "Banned" : isJoining ? "Joining..." : "Join"}
      </Button>
    </div>
  );
};
