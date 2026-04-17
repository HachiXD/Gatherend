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

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[420px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-6 pt-2">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.deleteMessage.title}
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] -mt-2 text-theme-text-subtle">
            {t.modals.deleteMessage.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 pb-4 -mt-2.5">
          <div className="flex h-8 items-center justify-center border border-theme-border bg-theme-bg-edit-form/60 px-3">
            <p className="text-center text-[14px] leading-none text-theme-text-tertiary">
              Este mensaje será eliminado permanentemente
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-theme-border bg-theme-bg-secondary/40 px-6 py-1.5 -mt-5.5">
          <Button
            type="button"
            variant="ghost"
            disabled={isLoading}
            onClick={onClose}
            className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={isLoading}
            className="h-6.5 cursor-pointer rounded-none border border-red-500/60 bg-red-500/80 px-3 text-[14px] text-theme-text-light hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onClick}
          >
            {t.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

