"use client";

import { useRef, useState, useEffect } from "react";
import axios from "axios";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import { useUpload } from "@/hooks/use-upload";
import { communityPostsKey } from "@/hooks/discovery/posts-feed/use-community-posts-feed";
import { communityOverviewKey } from "@/hooks/discovery/use-community-overview";
import { getStoredUploadAssetId } from "@/lib/upload-values";

interface InlineCommunityPostFormProps {
  communityId: string;
  communityName?: string;
  hasDominantColor?: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

export function InlineCommunityPostForm({
  communityId,
  hasDominantColor = false,
  onCancel,
  onSuccess,
}: InlineCommunityPostFormProps) {
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUpload, setImageUpload] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPastingImage, setIsPastingImage] = useState(false);

  const { startUpload } = useUpload("community_post_image", {
    onModerationBlock: (reason) => toast.error(reason),
    onUploadError: (error) => toast.error(`Error al subir imagen: ${error}`),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      titleRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }

      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        !isSubmitting
      ) {
        event.preventDefault();
        void handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const imageAssetId = getStoredUploadAssetId(imageUpload);
  const canSubmit =
    trimmedTitle.length > 0 && (trimmedContent.length > 0 || Boolean(imageAssetId));

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;

    setIsPastingImage(true);
    try {
      const res = await startUpload([file]);
      const uploaded = res?.[0];
      if (uploaded) {
        setImageUpload(
          JSON.stringify({
            assetId: uploaded.assetId,
            url: uploaded.url,
            type: uploaded.type,
            name: uploaded.name,
            size: uploaded.size,
            width: uploaded.width,
            height: uploaded.height,
          }),
        );
      }
    } catch (err) {
      console.error("Paste upload failed:", err);
      toast.error("No se pudo subir la imagen pegada");
    } finally {
      setIsPastingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !canSubmit) return;

    try {
      setIsSubmitting(true);

      await axios.post("/api/posts", {
        communityId,
        title: trimmedTitle,
        content: trimmedContent,
        imageAssetId: imageAssetId ?? null,
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: communityPostsKey(communityId),
        }),
        queryClient.invalidateQueries({
          queryKey: communityOverviewKey(communityId),
        }),
      ]);

      toast.success("Post publicado");
      setTitle("");
      setContent("");
      setImageUpload("");
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo publicar el post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadBtnClass = cn(
    "h-28 w-35 rounded-none text-[11px] transition-colors duration-150",
    hasDominantColor
      ? "border-[var(--community-header-btn-ring)] bg-[var(--community-header-btn-bg)]/25 text-[var(--community-header-btn-muted)] hover:border-[var(--community-header-btn-text)]/45 hover:bg-[var(--community-header-btn-hover)]/35 hover:text-[var(--community-header-btn-text)]"
      : "border-white/30 bg-theme-bg-cancel-button text-theme-text-subtle hover:border-white/50 hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light",
  );

  const removeBtnClass = cn(
    "bg-transparent p-1 mr-4 shadow-none cursor-pointer hover:bg-transparent transition-colors duration-150",
    hasDominantColor
      ? "text-[var(--community-header-btn-muted)] hover:text-[var(--community-header-btn-text)]"
      : "text-theme-text-tertiary hover:text-theme-text-light",
  );

  const cancelBtnClass = cn(
    "h-6.5 w-full cursor-pointer rounded-none border-0 px-3 text-[12px] transition-colors duration-150",
    hasDominantColor
      ? "bg-[var(--community-header-btn-bg)]/40 text-[var(--community-header-btn-muted)] hover:bg-[var(--community-header-btn-hover)]/50 hover:text-[var(--community-header-btn-text)]"
      : "bg-theme-bg-cancel-button text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light",
  );

  const publishBtnClass = cn(
    "h-6.5 w-full cursor-pointer rounded-none border-0 px-3 text-[12px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-70",
    hasDominantColor
      ? "bg-[var(--community-header-btn-bg)] text-[var(--community-header-btn-text)] hover:bg-[var(--community-header-btn-hover)]"
      : "bg-theme-tab-button-bg text-theme-text-light hover:bg-theme-tab-button-hover",
  );

  return (
    <div className="border border-theme-border/40 p-3">
      <div className="flex items-stretch gap-3">
        {/* Left: image upload + buttons at bottom */}
        <div className="flex shrink-0 flex-col mt-6.5">
          <FileUpload
            endpoint="communityPostImage"
            label="Subir imagen"
            value={imageUpload}
            onChange={(value) => setImageUpload(value ?? "")}
            uploadButtonClassName={uploadBtnClass}
            imagePreviewWrapperClassName="relative h-28 w-35 flex items-center justify-center"
            imagePreviewClassName="h-28 rounded-none object-contain"
            removeButtonClassName={removeBtnClass}
          />
          <div className="flex-1" />
          <div className="flex flex-col gap-y-2">
            <Button
              type="button"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
              className={cancelBtnClass}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting || !canSubmit}
              onClick={() => void handleSubmit()}
              className={publishBtnClass}
            >
              {isSubmitting ? "Publicando..." : "Publicar"}
            </Button>
          </div>
        </div>

        {/* Right: title input + textarea + hint row */}
        <div className="flex min-w-0 flex-1 flex-col gap-y-1.5 -mb-1">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 200))}
            disabled={isSubmitting}
            className="h-8 w-full shrink-0 border border-theme-border-subtle bg-transparent px-3 text-[14px] leading-5 text-theme-text-light outline-none focus:border-theme-border-accent"
            placeholder="Título del post..."
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={isSubmitting}
            rows={5}
            maxLength={2000}
            onPaste={(e) => void handlePaste(e)}
            className="scrollbar-ultra-thin min-h-[182px] w-full flex-1 resize-none border border-theme-border-subtle bg-transparent px-3 py-2 text-[14px] leading-5 text-theme-text-light outline-none focus:border-theme-border-accent"
            placeholder={
              isPastingImage ? "Subiendo imagen..." : "Escribe tu post..."
            }
          />
          <div className="flex items-center justify-between gap-x-2">
            <span className="text-[11px] text-theme-text-muted">
              Esc para cancelar &bull; Ctrl/Cmd+Enter para publicar
            </span>
            <span className="text-[11px] text-theme-text-tertiary">
              {content.length}/2000
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
