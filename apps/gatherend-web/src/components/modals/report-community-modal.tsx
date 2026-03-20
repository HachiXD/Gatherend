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
import { Siren, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

type ReportCategory =
  | "CSAM"
  | "SEXUAL_CONTENT"
  | "HARASSMENT"
  | "HATE_SPEECH"
  | "SPAM"
  | "IMPERSONATION"
  | "OTHER";

export const ReportCommunityModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const { t } = useTranslation();

  const REPORT_CATEGORIES = [
    {
      value: "CSAM" as ReportCategory,
      label: t.modals.report.categories.childSafety,
      description: t.modals.report.categories.childSafetyDescription,
    },
    {
      value: "SEXUAL_CONTENT" as ReportCategory,
      label: t.modals.report.categories.sexualContent,
      description: t.modals.report.categories.sexualContentDescription,
    },
    {
      value: "HARASSMENT" as ReportCategory,
      label: t.modals.report.categories.harassment,
      description: t.modals.report.categories.harassmentDescription,
    },
    {
      value: "HATE_SPEECH" as ReportCategory,
      label: t.modals.report.categories.hateSpeech,
      description: t.modals.report.categories.hateSpeechDescription,
    },
    {
      value: "SPAM" as ReportCategory,
      label: t.modals.report.categories.spam,
      description: t.modals.report.categories.spamDescription,
    },
    {
      value: "IMPERSONATION" as ReportCategory,
      label: t.modals.report.categories.impersonation,
      description: t.modals.report.categories.impersonationDescription,
    },
    {
      value: "OTHER" as ReportCategory,
      label: t.modals.report.categories.other,
      description: t.modals.report.categories.otherDescription,
    },
  ];

  const isModalOpen = isOpen && type === "reportCommunity";
  const {
    reportCommunityId,
    reportCommunityName,
    reportCommunityImageUrl,
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
    if (!selectedCategory || !reportCommunityId) {
      setError(t.modals.report.selectCategory);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await axios.post(
        "/api/reports",
        {
          targetType: "COMMUNITY",
          targetId: reportCommunityId,
          category: selectedCategory,
          description: description.trim() || null,
          // Snapshot data for evidence
          snapshot: {
            name: reportCommunityName,
            imageUrl: reportCommunityImageUrl,
          },
        },
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
      <DialogContent className="bg-theme-bg-modal max-w-md text-theme-text-subtle p-0 overflow-hidden">
        <DialogHeader className="pt-6 px-6">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Siren className="w-6 h-6 text-red-400" />
            <DialogTitle className="text-xl text-center font-bold">
              {t.modals.report.reportCommunity}
            </DialogTitle>
          </div>
          <DialogDescription className="text-center text-sm text-theme-text-tertiary">
            {t.modals.report.reportCommunityDescription}{" "}
            <span className="font-semibold text-theme-text-subtle">
              {reportCommunityName || "Unknown"}
            </span>
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="px-6 py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-theme-text-subtle font-medium">
              {t.modals.report.success}
            </p>
            <p className="text-sm text-theme-text-tertiary mt-1">
              {t.modals.report.successMessage}
            </p>
          </div>
        ) : (
          <>
            {/* Community Preview */}
            <div className="px-6 py-2">
              <p className="text-xs text-theme-text-tertiary mb-1">
                {t.modals.report.communityPreview}
              </p>
              <div className="bg-theme-bg-overlay-secondary rounded-md p-2.5">
                <p className="text-sm font-semibold text-theme-text-subtle">
                  {reportCommunityName}
                </p>
              </div>
            </div>

            {/* Category Selection */}
            <div className="px-6 py-1">
              <p className="text-xs text-theme-text-tertiary mb-2">
                {t.modals.report.whyReporting}
              </p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                {REPORT_CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value)}
                    disabled={isLoading}
                    className={cn(
                      "w-full flex flex-col items-start p-2.5 rounded-md border transition cursor-pointer",
                      selectedCategory === category.value
                        ? "border-red-500 bg-red-500/10"
                        : "border-theme-border-subtle hover:border-theme-border-accent hover:bg-theme-bg-overlay-secondary",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium",
                        selectedCategory === category.value
                          ? "text-red-400"
                          : "text-theme-text-subtle",
                      )}
                    >
                      {category.label}
                    </span>
                    <span className="text-xs text-theme-text-tertiary">
                      {category.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Description */}
            <div className="px-6 py-2">
              <p className="text-xs text-theme-text-tertiary mb-1">
                {t.modals.report.additionalDetails}
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                placeholder={t.modals.report.additionalDetailsPlaceholder}
                className="w-full h-20 px-3 py-2 text-sm bg-theme-bg-overlay-secondary border border-theme-border-subtle rounded-md text-theme-text-subtle placeholder:text-theme-text-tertiary focus:outline-none focus:border-theme-border-accent resize-none"
                maxLength={500}
              />
            </div>

            {error && (
              <div className="px-6">
                <p className="text-sm text-red-400 text-center">{error}</p>
              </div>
            )}

            <DialogFooter className="bg-theme-bg-modal px-6 py-4">
              <div className="flex items-center justify-between w-full gap-3">
                <Button
                  disabled={isLoading}
                  onClick={handleClose}
                  className="flex-1 bg-theme-bg-cancel-button hover:bg-theme-bg-cancel-button-hover cursor-pointer text-theme-text-subtle hover:text-theme-text-light"
                >
                  {t.modals.report.cancel}
                </Button>
                <Button
                  disabled={isLoading || !selectedCategory}
                  className="flex-1 bg-red-500 cursor-pointer hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={onSubmit}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t.modals.report.submit
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
