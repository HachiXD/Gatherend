"use client";

import qs, { type StringifiableRecord } from "query-string";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import axios from "axios";
import { useTranslation } from "@/i18n";
import { getExpressAxiosConfig } from "@/lib/express-fetch";

export const DeleteMessageModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "deleteMessage";
  const { apiUrl, query, profileId } = data;

  const [isLoading, setIsLoading] = useState(false);

  const onClick = async () => {
    try {
      setIsLoading(true);
      const url = qs.stringifyUrl({
        url: apiUrl || "",
        query: query as StringifiableRecord | undefined,
      });

      await axios.delete(url, {
        ...getExpressAxiosConfig(profileId || ""),
      });

      onClose();
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
        closeButtonClassName="cursor-pointer rounded-md p-0.5 text-theme-text-subtle opacity-100 transition hover:bg-theme-bg-cancel-button hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-5 pt-5 -mt-2 -mb-2 pb-0">
          <DialogTitle className="text-[22px] -mb-1 font-medium text-theme-text-primary">
            {t.modals.deleteMessage.title}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[14px] text-theme-text-subtle">
            {t.modals.deleteMessage.description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pt-0 pb-0">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <p className="text-[14px] leading-relaxed text-theme-text-secondary">
              {t.modals.deleteMessage.willBeDeleted}
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-theme-border px-5 py-1">
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isLoading}
              onClick={handleClose}
              className="h-6.5 cursor-pointer rounded-lg border border-theme-border bg-theme-bg-cancel-button px-4 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              disabled={isLoading}
              className="h-6.5 cursor-pointer rounded-lg border border-red-500/50 bg-red-500/80 px-4 text-[14px] text-theme-text-light hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={onClick}
            >
              {t.common.confirm}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
