"use client";

import { useEffect, useState } from "react";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSocketClient } from "@/components/providers/socket-provider";
import { signOut } from "@/lib/better-auth-client";
import { useTranslation } from "@/i18n";

const HEADER_PANEL_SHELL =
  "mr-1.5 rounded-lg border border-theme-border bg-theme-bg-overlay-primary/78 px-4 pt-4 pb-0 sm:px-5 sm:py-5";
const DANGER_PANEL_SHELL =
  "-mt-4 rounded-lg border border-rose-500/35 bg-rose-950/18 px-4 py-4 sm:px-5 sm:py-5";
const DANGER_ACTION_BUTTON_CLASS =
  "flex h-8 w-full -mt-1.5 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-rose-500/45 bg-rose-900/55 px-3 text-[14px] text-rose-100 transition hover:border-rose-400/65 hover:bg-rose-800/65 hover:text-white";

interface UserDangerZoneTabProps {
  user: ClientProfile;
  onClose: () => void;
  setOverlayBlocking: (value: boolean) => void;
}

export const UserDangerZoneTab = ({
  user,
  onClose,
  setOverlayBlocking,
}: UserDangerZoneTabProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { goOffline } = useSocketClient();
  const { t } = useTranslation();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [closeOnRouteChange, setCloseOnRouteChange] = useState(false);

  useEffect(() => {
    if (!closeOnRouteChange) return;
    if (pathname === "/") {
      onClose();
    }
  }, [closeOnRouteChange, onClose, pathname]);

  const onDeleteAccount = async () => {
    try {
      if (isDeletingAccount) return;
      setIsDeletingAccount(true);
      setOverlayBlocking(true);
      setShowConfirmDialog(false);

      await axios.delete("/api/profile");
      goOffline();

      try {
        await signOut();
      } catch (signOutError) {
        console.warn("[ACCOUNT_DELETE_SIGNOUT]", signOutError);
      }

      queryClient.clear();
      toast.success(t.overlays.userSettings.dangerZone.deleteSuccess);
      setCloseOnRouteChange(true);
      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(t.overlays.userSettings.dangerZone.deleteError);
      setOverlayBlocking(false);
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
      <div className="space-y-6 -mt-2.5">
        <div className={HEADER_PANEL_SHELL}>
          <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
            <h2 className="text-2xl font-bold text-red-500">
              {t.overlays.userSettings.dangerZone.title}
            </h2>
            <p className="-mt-1 text-sm text-theme-text-tertiary">
              {t.overlays.userSettings.dangerZone.subtitle}
            </p>
          </div>
        </div>

        <div className={cn(DANGER_PANEL_SHELL, "w-full max-w-[640px]")}>
          <div className="-mb-2.5 -mt-3 space-y-4">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <AlertTriangle className="-mb-1 mt-1 -mr-1 h-4.5 w-4.5 text-red-500" />
                <h3 className="text-base font-semibold text-red-400 underline">
                  {t.overlays.userSettings.dangerZone.deleteSectionTitle}
                </h3>
              </div>
              <p className="-mt-1.5 text-sm text-red-300">
                {t.overlays.userSettings.dangerZone.deleteSectionDescription}
              </p>
            </div>

            <Button
              onClick={() => setShowConfirmDialog(true)}
              className={DANGER_ACTION_BUTTON_CLASS}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              {isDeletingAccount
                ? t.overlays.userSettings.dangerZone.deletingAccount
                : t.overlays.userSettings.dangerZone.deleteAccount}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="rounded-lg bg-theme-bg-overlay-primary text-theme-text-light">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {t.overlays.userSettings.dangerZone.confirmTitle}
            </DialogTitle>
            <DialogDescription className="text-theme-text-muted">
              {t.overlays.userSettings.dangerZone.confirmQuestion} <br />
              <span className="font-semibold text-red-500">
                {user.username}#{user.discriminator}
              </span>{" "}
              {t.overlays.userSettings.dangerZone.confirmWillBeDeleted}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              disabled={isDeletingAccount}
              onClick={() => setShowConfirmDialog(false)}
              variant="ghost"
            >
              {t.common.cancel}
            </Button>
            <Button
              disabled={isDeletingAccount}
              variant="destructive"
              onClick={onDeleteAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingAccount ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {isDeletingAccount
                ? t.overlays.userSettings.dangerZone.deletingAccount
                : t.overlays.userSettings.dangerZone.deleteAccount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
