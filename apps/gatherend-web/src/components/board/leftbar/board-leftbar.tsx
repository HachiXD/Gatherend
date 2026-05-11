import { LeftbarBanner } from "./leftbar-banner";
import { MemberRole } from "@prisma/client";
import type { BoardWithData } from "@/lib/boards/board-types";
import { VoiceControlBar } from "@/components/voice-control-bar";
import { LeftbarClient } from "./board-leftbar-client";

interface BoardLeftbarProps {
  board: BoardWithData;
  role?: MemberRole;
  currentProfileId: string;
}

export const BoardLeftbar = ({
  board,
  role,
  currentProfileId,
}: BoardLeftbarProps) => {
  return (
    <div className="flex h-full w-full flex-col bg-theme-bg-secondary text-primary">
      <LeftbarBanner
        imageAsset={board.imageAsset}
        bannerAsset={board.bannerAsset}
        boardName={board.name}
        boardId={board.id}
        board={board}
        role={role}
        currentProfileId={currentProfileId}
      />

      <div className="scrollbar-navigation flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pt-2 pb-1.5">
        <LeftbarClient boardId={board.id} role={role} />
      </div>

      <VoiceControlBar position="left" />
    </div>
  );
};
