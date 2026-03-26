"use client";

import { useRef, useState, useEffect } from "react";
import axios from "axios";
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
  onCancel: () => void;
  onSuccess?: () => void;
}

export function InlineCommunityPostForm({
  communityId,
  onCancel,
  onSuccess,
}: InlineCommunityPostFormProps) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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
      textareaRef.current?.focus();
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

  const trimmedContent = content.trim();
  const imageAssetId = getStoredUploadAssetId(imageUpload);
  const canSubmit = trimmedContent.length > 0 || Boolean(imageAssetId);

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
            uploadButtonClassName="h-28 w-35 rounded-none border-white/30 bg-theme-bg-cancel-button text-[11px] text-theme-text-subtle hover:border-white/50 hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            imagePreviewWrapperClassName="relative h-28 w-35 flex items-center justify-center"
            imagePreviewClassName="h-28 rounded-none object-contain"
            removeButtonClassName="bg-transparent p-1 mr-4 text-theme-text-tertiary shadow-none cursor-pointer hover:bg-transparent hover:text-theme-text-light"
          />
          <div className="flex-1" />
          <div className="flex flex-col gap-y-2 -mb-5">
            <Button
              type="button"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
              className="h-6.5 w-full cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[12px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting || !canSubmit}
              onClick={() => void handleSubmit()}
              className="h-6.5 w-full cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[12px] text-theme-text-light hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Publicando..." : "Publicar"}
            </Button>
          </div>
        </div>

        {/* Right: textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={isSubmitting}
          rows={6}
          maxLength={2000}
          onPaste={(e) => void handlePaste(e)}
          className="scrollbar-ultra-thin min-h-[220px] w-full resize-none border border-theme-border-subtle bg-transparent px-3 py-2 text-[14px] leading-5 text-theme-text-light outline-none focus:border-theme-border-accent"
          placeholder={
            isPastingImage ? "Subiendo imagen..." : "Escribe tu post..."
          }
        />
      </div>

      <div className="mt-1 flex gap-3">
        {/* spacer matching the upload column width */}
        <div className="w-35 shrink-0" />

        <div className="flex min-w-0 flex-1 items-center justify-between gap-x-2">
          <span className="text-[11px] text-theme-text-muted">
            Esc para cancelar &bull; Ctrl/Cmd+Enter para publicar
          </span>
          <span className="text-[11px] text-theme-text-tertiary">
            {content.length}/2000
          </span>
        </div>
      </div>
    </div>
  );
}
