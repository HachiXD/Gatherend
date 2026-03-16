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
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAxiosConfig } from "@/lib/express-fetch";

export const DeleteMessageModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const { t } = useTranslation();
  const getToken = useTokenGetter();

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

      const token = await getToken();
      await axios.delete(url, {
        ...getExpressAxiosConfig(profileId || "", token),
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
      <DialogContent className="bg-theme-bg-modal !max-w-[400px] text-theme-text-subtle p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.deleteMessage.title}
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] text-theme-text-tertiary">
            {t.modals.deleteMessage.description} <br />
            {t.modals.deleteMessage.willBeDeleted}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="bg-theme-bg-modal px-6 py-4">
          <div className="flex items-center justify-center gap-20 w-full">
            <Button
              disabled={isLoading}
              onClick={onClose}
              className="bg-theme-bg-cancel-button hover:bg-theme-bg-cancel-button-hover cursor-pointer text-theme-text-subtle hover:text-theme-text-light"
            >
              {t.common.cancel}
            </Button>
            <Button
              disabled={isLoading}
              className="bg-red-500 cursor-pointer hover:bg-red-600 text-theme-text-light hover:text-theme-text-light"
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

