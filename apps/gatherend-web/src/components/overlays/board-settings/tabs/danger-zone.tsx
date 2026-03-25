"use client";

import { Board } from "@prisma/client";
import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import {
  useBoardSwitchSafe,
  useCurrentBoardId,
} from "@/contexts/board-switch-context";
import { exitBoardWithSpaFallback } from "@/lib/board-exit";

const HEADER_PANEL_SHELL =
  "border border-theme-border mr-1.5 bg-theme-bg-overlay-primary/78 px-4 pt-4 pb-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const DANGER_PANEL_SHELL =
  "border border-rose-500/35 bg-rose-950/18 px-4 py-4 -mt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const DANGER_ACTION_BUTTON_CLASS =
  "flex h-8 w-full -mt-1.5 cursor-pointer items-center justify-center gap-1.5 rounded-none border border-rose-500/45 bg-rose-900/55 px-3 text-[14px] text-rose-100 transition hover:border-rose-400/65 hover:bg-rose-800/65 hover:text-white";

interface DangerZoneProps {
  board: Board;
}

export const DangerZoneTab = ({ board }: DangerZoneProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const boardSwitch = useBoardSwitchSafe();
  const currentBoardId = useCurrentBoardId();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const onDeleteBoard = async () => {
    try {
      setIsLoading(true);
      setDeleteError(null);

      await axios.delete(`/api/boards/${board.id}`);

      toast.success(t.overlays.boardSettings.dangerZone.deleteSuccess);
      setShowConfirmDialog(false);

      exitBoardWithSpaFallback({
        queryClient,
        router,
        boardSwitch,
        boardId: board.id,
        currentBoardId,
      });
    } catch (error) {
      console.error(error);
      if (
        axios.isAxiosError(error) &&
        error.response?.data?.error === "You cannot delete your last board"
      ) {
        setShowConfirmDialog(false);
        setDeleteError(
          "No puedes borrar tu ultimo board!, crea uno nuevo para poder borrar el actual :D",
        );
      } else {
        setDeleteError(null);
      }
      toast.error(t.overlays.boardSettings.dangerZone.deleteError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className={HEADER_PANEL_SHELL}>
          <div className="border-b border-theme-border pb-0.5 -mb-3 -mt-3">
            <h2 className="text-2xl font-bold text-red-500">
              {t.overlays.boardSettings.dangerZone.title}
            </h2>
            <p className="-mt-1 text-sm text-theme-text-tertiary">
              {t.overlays.boardSettings.dangerZone.subtitle}
            </p>
          </div>
        </div>

        <div className={DANGER_PANEL_SHELL}>
          <div className="-mt-3 -mb-2.5 space-y-4">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <AlertTriangle className="-mb-1 mt-1 -mr-1 h-4.5 w-4.5 text-red-500" />
                <h3 className=" text-base font-semibold underline text-red-400">
                  {t.overlays.boardSettings.dangerZone.deleteSectionTitle}
                </h3>
              </div>
              <p className="text-sm text-red-300 -mt-1.5">
                {t.overlays.boardSettings.dangerZone.deleteSectionDescription}
              </p>
            </div>

            <Button
              onClick={() => setShowConfirmDialog(true)}
              className={DANGER_ACTION_BUTTON_CLASS}
            >
              {t.overlays.boardSettings.dangerZone.deleteBoardButton}
            </Button>
            {deleteError && (
              <p className="text-sm font-bold text-red-300 -mt-2">
                {deleteError}
              </p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-theme-bg-overlay-primary text-theme-text-light">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {t.overlays.boardSettings.dangerZone.confirmTitle}
            </DialogTitle>
            <DialogDescription className="text-theme-text-muted">
              {t.overlays.boardSettings.dangerZone.confirmQuestion} <br />
              <span className="font-semibold text-red-500">
                {board.name}
              </span>{" "}
              {t.overlays.boardSettings.dangerZone.confirmWillBeDeleted}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              disabled={isLoading}
              onClick={() => setShowConfirmDialog(false)}
              variant="ghost"
            >
              {t.common.cancel}
            </Button>
            <Button
              disabled={isLoading}
              variant="destructive"
              onClick={onDeleteBoard}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading
                ? t.overlays.boardSettings.dangerZone.deleting
                : t.overlays.boardSettings.dangerZone.deleteBoardButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
