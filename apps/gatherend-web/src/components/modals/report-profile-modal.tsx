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
import { Button } from "@/components/ui/button";
import { useState } from "react";
import axios from "axios";
import { cn } from "@/lib/utils";

import { UserAvatar } from "@/components/user-avatar";
import { useTranslation } from "@/i18n";
import { getExpressAuthHeaders } from "@/lib/express-fetch";

type ReportCategory =
  | "CSAM"
  | "SEXUAL_CONTENT"
  | "HARASSMENT"
  | "HATE_SPEECH"
  | "SPAM"
  | "IMPERSONATION"
  | "OTHER";

export const ReportProfileModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const { t } = useTranslation();

  const REPORT_CATEGORIES = [
    {
      value: "CSAM" as ReportCategory,
      label: t.modals.report.categories.childSafety,
      description: t.modals.report.categories.childSafetyProfileDescription,
    },
    {
      value: "SEXUAL_CONTENT" as ReportCategory,
      label: t.modals.report.categories.sexualContent,
      description: t.modals.report.categories.sexualContentProfileDescription,
    },
    {
      value: "HARASSMENT" as ReportCategory,
      label: t.modals.report.categories.harassment,
      description: t.modals.report.categories.harassmentProfileDescription,
    },
    {
      value: "HATE_SPEECH" as ReportCategory,
      label: t.modals.report.categories.hateSpeech,
      description: t.modals.report.categories.hateSpeechProfileDescription,
    },
    {
      value: "SPAM" as ReportCategory,
      label: t.modals.report.categories.spam,
      description: t.modals.report.categories.spamProfileDescription,
    },
    {
      value: "IMPERSONATION" as ReportCategory,
      label: t.modals.report.categories.impersonation,
      description: t.modals.report.categories.impersonationProfileDescription,
    },
    {
      value: "OTHER" as ReportCategory,
      label: t.modals.report.categories.other,
      description: t.modals.report.categories.otherProfileDescription,
    },
  ];

  const isModalOpen = isOpen && type === "reportProfile";
  const {
    reportProfileId,
    reportProfileUsername,
    reportProfileDiscriminator,
    reportProfileImageUrl,
    profileId,
  } = data;

  const [selectedCategory, setSelectedCategory] =
    useState<ReportCategory | null>(null);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setSelectedCategory(null);
    setDescription("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  const onSubmit = async () => {
    if (!selectedCategory || !reportProfileId || !profileId) {
      setError(t.modals.report.selectCategory);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await axios.post(
        "/api/reports",
        {
          targetType: "PROFILE",
          targetId: reportProfileId,
          category: selectedCategory,
          description: description.trim() || null,
          // Snapshot data for evidence
          snapshot: {
            username: reportProfileUsername,
            discriminator: reportProfileDiscriminator,
            imageUrl: reportProfileImageUrl,
          },
          targetOwnerId: reportProfileId, // The profile owner is the target itself
        },
        {
          headers: getExpressAuthHeaders(profileId),
        }
      );

      setSuccess(true);

      // Auto close after success
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || t.modals.report.error);
      } else {
        setError(t.modals.report.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[440px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="bg-theme-bg-secondary/20 px-6 pb-2 pt-2">
          <div className="flex items-center justify-center gap-2">
            <DialogTitle className="text-[17px] font-bold">
              {t.modals.report.reportUser}
            </DialogTitle>
          </div>
          <DialogDescription className="text-center text-[13px] -mt-1 text-theme-text-tertiary">
            {t.modals.report.reportUserDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden space-y-3 px-6 pb-0 -mt-5 -mb-3 pt-0">
          {/* User Preview */}
          <div>
            <p className="mb-1 text-[11px] text-theme-text-tertiary">
              {t.modals.report.userBeingReported}
            </p>
            <div className="flex min-w-0 items-center gap-2 overflow-hidden border border-theme-border bg-theme-bg-secondary/20 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)]">
              <UserAvatar
                src={reportProfileImageUrl || ""}
                profileId={reportProfileId || ""}
                showStatus={false}
                className="h-7 w-7 shrink-0"
              />
              <p className="min-w-0 truncate text-[13px] font-semibold text-theme-text-subtle">
                {reportProfileUsername}
                {reportProfileDiscriminator && (
                  <span className="ml-0.5 font-normal text-theme-text-muted">
                    /{reportProfileDiscriminator}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <p className="mb-1 text-[11px] text-theme-text-tertiary">
              {t.modals.report.whyReporting}
            </p>
            <div className="max-h-[180px] space-y-1 p-1 overflow-y-auto scrollbar-ultra-thin border border-theme-border-subtle">
              {REPORT_CATEGORIES.map((category) => (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  disabled={isLoading}
                  className={cn(
                    "flex min-h-[40px] w-full cursor-pointer flex-col justify-center rounded-none border px-3 py-1 text-left transition",
                    selectedCategory === category.value
                      ? "border-theme-border-accent-active-channel bg-theme-border-accent-active-channel/40"
                      : "border-theme-border-subtle hover:border-theme-border hover:bg-theme-bg-secondary/30",
                  )}
                >
                  <span
                    className={cn(
                      "block text-[13px] font-medium leading-none",
                      selectedCategory === category.value
                        ? "text-theme-channel-type-active-text"
                        : "text-theme-text-subtle",
                    )}
                  >
                    {category.label}
                  </span>
                  <span className="mt-0.5 text-[11px] leading-none text-theme-text-tertiary">
                    {category.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Additional Details */}
          <div>
            <p className="mb-1 text-[11px] text-theme-text-tertiary">
              {t.modals.report.additionalDetails}
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              placeholder={t.modals.report.additionalDetailsPlaceholder}
              className="h-20 w-full scrollbar-ultra-thin resize-none rounded-none border border-theme-border-subtle bg-transparent px-3 py-2 text-[12px] leading-5 text-theme-text-light outline-none placeholder:text-theme-text-tertiary focus:border-theme-border-accent"
              maxLength={500}
            />
          </div>

          {success && (
            <div className="border border-theme-border-accent-active-channel bg-theme-channel-type-active-bg px-3 py-1 -mt-3 mb-1 text-[13px]">
              <p className="font-medium text-theme-channel-type-active-text">
                {t.modals.report.success}
              </p>
            </div>
          )}

          {error && (
            <p className="text-center text-[12px] -mt-3.5 text-red-400">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="border-t border-theme-border bg-theme-bg-secondary/40 px-6 py-1.5">
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              disabled={isLoading}
              onClick={handleClose}
              className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[13px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            >
              {t.modals.report.cancel}
            </Button>
            <Button
              type="button"
              disabled={isLoading || !selectedCategory}
              className="h-6.5 cursor-pointer rounded-none bg-red-500/80 px-3 text-[13px] text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onSubmit}
            >
              {isLoading ? t.modals.report.submitting : t.modals.report.submit}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

