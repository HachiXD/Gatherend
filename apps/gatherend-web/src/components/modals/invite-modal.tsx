"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Copy, RefreshCw } from "lucide-react";
import { useOrigin } from "@/hooks/use-origin";
import { useState } from "react";
import axios from "axios";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

export const InviteModal = () => {
  const { onOpen, isOpen, onClose, type, data } = useModal();
  const origin = useOrigin();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "invite";
  const { board } = data;

  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const inviteUrl = `${origin}/invite/${board?.inviteCode}`;

  // Copiar invitación
  const onCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1000);
  };

  // Regenerar invitación
  const onRegenerate = async () => {
    try {
      setIsLoading(true);
      const response = await axios.patch(
        `/api/boards/${board?.id}/invite-code`,
        { action: "regenerate" },
      );

      onOpen("invite", { board: response.data });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Cambiar entre enable/disable
  const onSetInviteEnabled = async (nextEnabled: boolean) => {
    if (board?.inviteEnabled === nextEnabled) return;

    try {
      setIsLoading(true);

      const action = nextEnabled ? "enable" : "disable";

      const response = await axios.patch(
        `/api/boards/${board?.id}/invite-code`,
        { action },
      );

      // volver a abrir el modal con board actualizado
      onOpen("invite", { board: response.data });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[440px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-6 pt-2">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.invite.title}
          </DialogTitle>
          <DialogDescription className="text-center -mt-2 text-[15px] text-theme-text-subtle">
            {t.modals.invite.description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 -mt-4.5 -mb-4">
          <div className="space-y-3 bg-theme-bg-modal px-3 py-2">
            <div className="flex h-8 items-center justify-between gap-3 border border-theme-border bg-theme-bg-edit-form/60 px-3">
              <Label className="uppercase text-[14px] font-bold text-theme-text-subtle">
                {t.modals.invite.inviteEnabledLabel}
              </Label>
              <div
                className="flex"
                role="group"
                aria-label={t.modals.invite.inviteEnabledLabel}
              >
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onSetInviteEnabled(true)}
                  className={cn(
                    "flex h-6 w-12 cursor-pointer items-center justify-center rounded-none border border-r-0 px-3 text-[12px] transition disabled:cursor-not-allowed disabled:opacity-70",
                    board?.inviteEnabled
                      ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                      : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                  )}
                  aria-pressed={board?.inviteEnabled === true}
                >
                  {t.common.yes}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onSetInviteEnabled(false)}
                  className={cn(
                    "flex h-6 w-12 cursor-pointer items-center justify-center rounded-none border px-3 text-[12px] transition disabled:cursor-not-allowed disabled:opacity-70",
                    board?.inviteEnabled === false
                      ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                      : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                  )}
                  aria-pressed={board?.inviteEnabled === false}
                >
                  {t.common.no}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="invite-url"
                className="block uppercase text-[15px] font-bold text-theme-text-subtle -mt-1 mb-0.5"
              >
                {t.modals.invite.boardInviteLinkLabel}
              </Label>

              <div className="flex items-center gap-2 mb-0">
                <Input
                  id="invite-url"
                  name="invite-url"
                  disabled={isLoading || !board?.inviteEnabled}
                  className="h-8 rounded-none border border-theme-border bg-theme-bg-edit-form/60 px-3 py-2 text-[14px] text-theme-text-primary focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0 disabled:text-theme-text-subtle"
                  value={inviteUrl}
                  readOnly
                />

                <Button
                  type="button"
                  disabled={isLoading || !board?.inviteEnabled}
                  onClick={onCopy}
                  size="icon"
                  className="h-8 w-8 cursor-pointer rounded-none border border-theme-border bg-theme-tab-button-bg text-theme-text-light hover:bg-theme-tab-button-hover hover:text-theme-text-light disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <Button
                type="button"
                onClick={onRegenerate}
                disabled={isLoading || !board?.inviteEnabled}
                variant="ghost"
                className="-mt-4 -ml-2.5 h-6 cursor-pointer rounded-none px-0 text-[12px] text-theme-text-tertiary hover:bg-transparent hover:text-theme-text-secondary disabled:cursor-not-allowed disabled:opacity-70"
              >
                {t.modals.invite.generateNewLink}
                <RefreshCw className="-ml-0.5 -mt-0.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-theme-border bg-theme-bg-secondary/40 px-6 py-1.5 -mt-5">
          <Button
            type="button"
            variant="ghost"
            disabled={isLoading}
            onClick={handleClose}
            className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
          >
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
