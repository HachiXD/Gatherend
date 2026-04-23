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
        className="max-w-[400px]! overflow-hidden rounded-lg border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-md p-1 text-theme-text-subtle opacity-100 transition hover:bg-theme-bg-cancel-button hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-5 pt-5 -mt-2 -mb-2 pb-0">
          <DialogTitle className="text-[22px] -mb-2.5 font-medium text-theme-text-primary">
            {t.modals.invite.title}
          </DialogTitle>
          <DialogDescription className="text-[14px] text-theme-text-subtle mt-0.5">
            {t.modals.invite.description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-0 -mb-0.5 flex flex-col gap-3">
          {/* Toggle invitaciones */}
          <div className="flex flex-col gap-0.5">
            <Label className="text-[14px] uppercase tracking-[0.08em] font-medium text-theme-text-subtle">
              {t.modals.invite.inviteEnabledLabel}
            </Label>
            <div className="flex items-center justify-between rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-3 py-1">
              <span className="text-[14px] text-theme-text-primary">
                Permitir invitaciones
              </span>
              <div
                className="flex rounded-md overflow-hidden border border-theme-border"
                role="group"
              >
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onSetInviteEnabled(true)}
                  className={cn(
                    "flex h-6 w-10 cursor-pointer items-center justify-center text-[12px] transition disabled:cursor-not-allowed disabled:opacity-70",
                    board?.inviteEnabled
                      ? "bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                      : "bg-transparent text-theme-text-subtle hover:text-theme-text-primary",
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
                    "flex h-6 w-10 cursor-pointer items-center justify-center border-l border-theme-border text-[12px] transition disabled:cursor-not-allowed disabled:opacity-70",
                    board?.inviteEnabled === false
                      ? "bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                      : "bg-transparent text-theme-text-subtle hover:text-theme-text-primary",
                  )}
                  aria-pressed={board?.inviteEnabled === false}
                >
                  {t.common.no}
                </button>
              </div>
            </div>
          </div>

          {/* Link de invitación */}
          <div className="flex flex-col gap-0.5">
            <Label
              htmlFor="invite-url"
              className="text-[14px] uppercase tracking-[0.08em] font-medium text-theme-text-subtle"
            >
              {t.modals.invite.boardInviteLinkLabel}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="invite-url"
                name="invite-url"
                disabled={isLoading || !board?.inviteEnabled}
                className="h-9 rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-3 text-[13px] font-mono text-theme-text-primary focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0 disabled:text-theme-text-subtle"
                value={inviteUrl}
                readOnly
              />
              <Button
                type="button"
                disabled={isLoading || !board?.inviteEnabled}
                onClick={onCopy}
                size="icon"
                className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-theme-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text hover:bg-theme-channel-type-active-soft-bg hover:text-theme-channel-type-active-text disabled:cursor-not-allowed disabled:opacity-50"
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
              className="w-fit h-auto mt-1 cursor-pointer px-0 py-0 gap-1.5 text-[11px] text-theme-text-subtle hover:bg-transparent hover:text-theme-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" />
              {t.modals.invite.generateNewLink}
            </Button>
          </div>
        </div>

        <DialogFooter className="border-t border-theme-border px-5 py-1">
          <Button
            type="button"
            variant="ghost"
            disabled={isLoading}
            onClick={handleClose}
            className="h-6.5 cursor-pointer rounded-lg border border-theme-border bg-theme-bg-cancel-button px-4 text-[13px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
          >
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
