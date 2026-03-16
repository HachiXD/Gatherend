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
import { FileWarning, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAuthHeaders } from "@/lib/express-fetch";

type ReportCategory =
  | "CSAM"
  | "SEXUAL_CONTENT"
  | "HARASSMENT"
  | "HATE_SPEECH"
  | "SPAM"
  | "IMPERSONATION"
  | "OTHER";

export const ReportCommunityPostModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const { t } = useTranslation();
  const getToken = useTokenGetter();

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

  const isModalOpen = isOpen && type === "reportCommunityPost";
  const {
    reportCommunityPostId,
    reportCommunityPostContent,
    reportCommunityPostImageUrl,
    reportCommunityPostAuthorId,
    reportCommunityPostAuthorUsername,
    reportCommunityPostAuthorDiscriminator,
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
    if (!selectedCategory || !reportCommunityPostId || !profileId) {
      setError(t.modals.report.selectCategory);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const token = await getToken();
      await axios.post(
        "/api/reports",
        {
          targetType: "COMMUNITY_POST",
          targetId: reportCommunityPostId,
          category: selectedCategory,
          description: description.trim() || null,
          snapshot: {
            content: reportCommunityPostContent,
            imageUrl: reportCommunityPostImageUrl,
            authorId: reportCommunityPostAuthorId,
            authorUsername: reportCommunityPostAuthorUsername,
            authorDiscriminator: reportCommunityPostAuthorDiscriminator,
          },
          targetOwnerId: reportCommunityPostAuthorId,
        },
        {
          headers: getExpressAuthHeaders(profileId, token),
        },
      );

      setSuccess(true);
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

  const previewContent = reportCommunityPostContent?.trim()
    ? reportCommunityPostContent.length > 140
      ? `${reportCommunityPostContent.substring(0, 140)}...`
      : reportCommunityPostContent
    : reportCommunityPostImageUrl
      ? "Image-only post"
      : "No content";

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-theme-bg-modal max-w-md text-theme-text-subtle p-0 overflow-hidden">
        <DialogHeader className="pt-6 px-6">
          <div className="mb-2 flex items-center justify-center gap-2">
            <FileWarning className="h-6 w-6 text-red-400" />
            <DialogTitle className="text-xl text-center font-bold">
              Report Post
            </DialogTitle>
          </div>
          <DialogDescription className="text-center text-sm text-theme-text-tertiary">
            Report this community post by{" "}
            <span className="font-semibold text-theme-text-subtle">
              {reportCommunityPostAuthorUsername || "Unknown"}
            </span>
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <svg
                className="h-6 w-6 text-green-500"
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
            <p className="font-medium text-theme-text-subtle">
              {t.modals.report.success}
            </p>
            <p className="mt-1 text-sm text-theme-text-tertiary">
              {t.modals.report.successMessage}
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 py-2">
              <p className="mb-1 text-xs text-theme-text-tertiary">
                Post preview
              </p>
              <div className="rounded-md bg-theme-bg-overlay-secondary p-2.5">
                <p className="break-words text-sm text-theme-text-secondary">
                  {previewContent}
                </p>
              </div>
            </div>

            <div className="px-6 py-1">
              <p className="mb-2 text-xs text-theme-text-tertiary">
                {t.modals.report.whyReporting}
              </p>
              <div className="max-h-[140px] space-y-1.5 overflow-y-auto">
                {REPORT_CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value)}
                    disabled={isLoading}
                    className={cn(
                      "w-full cursor-pointer rounded-md border p-2.5 text-left transition",
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
                    <p className="text-xs text-theme-text-tertiary">
                      {category.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-2">
              <p className="mb-1 text-xs text-theme-text-tertiary">
                {t.modals.report.additionalDetails}
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                placeholder={t.modals.report.additionalDetailsPlaceholder}
                className="h-20 w-full resize-none rounded-md border border-theme-border-subtle bg-theme-bg-overlay-secondary px-3 py-2 text-sm text-theme-text-subtle placeholder:text-theme-text-tertiary focus:outline-none focus:border-theme-border-accent"
                maxLength={500}
              />
            </div>

            {error && (
              <div className="px-6">
                <p className="text-center text-sm text-red-400">{error}</p>
              </div>
            )}

            <DialogFooter className="bg-theme-bg-modal px-6 py-4">
              <div className="flex w-full items-center justify-between gap-3">
                <Button
                  disabled={isLoading}
                  onClick={handleClose}
                  className="flex-1 bg-theme-bg-cancel-button hover:bg-theme-bg-cancel-button-hover cursor-pointer text-theme-text-subtle hover:text-theme-text-light"
                >
                  {t.modals.report.cancel}
                </Button>
                <Button
                  disabled={isLoading || !selectedCategory}
                  className="flex-1 cursor-pointer bg-red-500 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={onSubmit}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
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
