/**
 * useUpload Hook
 *
 * Centralized upload hook that uses our Express backend with:
 * - S3-compatible storage for public content (boards, avatars, banners) - WITH moderation
 * - S3-compatible storage for private content (chat/DM attachments) - NO moderation
 */

import { useState, useCallback, useEffect, useRef } from "react";

// Context types that match the backend
export type UploadContext =
  | "board_image"
  | "community_image"
  | "community_post_image"
  | "community_post_comment_image"
  | "profile_avatar"
  | "profile_banner"
  | "message_attachment"
  | "sticker"
  | "dm_attachment";

const ENDPOINT_TO_CONTEXT: Record<string, UploadContext> = {
  messageFile: "message_attachment",
  boardImage: "board_image",
  communityImage: "community_image",
  communityPostImage: "community_post_image",
  profileAvatar: "profile_avatar",
  profileBanner: "profile_banner",
  sticker: "sticker",
  dmAttachment: "dm_attachment",
};

export interface UploadedFile {
  assetId: string;
  url: string;
  storage: "s3";
  type: string;
  name: string;
  size: number;
  width?: number;
  height?: number;
}

export interface UseUploadOptions {
  onUploadBegin?: () => void;
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: string) => void;
  onModerationBlock?: (reason: string) => void;
}

function useUploadInternal(
  context: UploadContext | keyof typeof ENDPOINT_TO_CONTEXT,
  options: UseUploadOptions = {},
) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Keep options callbacks stable without forcing startUpload recreation.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Resolve context from legacy endpoint names
  const resolvedContext =
    ENDPOINT_TO_CONTEXT[context] || (context as UploadContext);

  const startUpload = useCallback(
    async (files: File[]): Promise<UploadedFile[]> => {
      if (files.length === 0) {
        return [];
      }

      setIsUploading(true);
      setProgress(0);
      optionsRef.current.onUploadBegin?.();

      const results: UploadedFile[] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          // Update progress
          setProgress(Math.round((i / files.length) * 50));

          // Create FormData
          const formData = new FormData();
          formData.append("image", file);
          formData.append("context", resolvedContext);

          // Upload to our Express backend
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/upload`,
            {
              method: "POST",
              credentials: "include",
              body: formData,
            },
          );

          const data = await response.json();

          // Update progress
          setProgress(Math.round(((i + 1) / files.length) * 100));

          if (!response.ok || !data.success) {
            // Check if it was blocked by moderation
            if (data.moderation && !data.moderation.allowed) {
              const reason = data.error || "Content not allowed";
              optionsRef.current.onModerationBlock?.(reason);
              throw new Error(reason);
            }

            const error = data.error || "Upload failed";
            optionsRef.current.onUploadError?.(error);
            throw new Error(error);
          }

          const uploadedFile: UploadedFile = {
            assetId: data.assetId,
            url: data.url,
            storage: "s3",
            type: file.type,
            name: file.name,
            size: file.size,
            width: typeof data.width === "number" ? data.width : undefined,
            height: typeof data.height === "number" ? data.height : undefined,
          };

          results.push(uploadedFile);
          optionsRef.current.onUploadComplete?.(uploadedFile);
        }

        return results;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        optionsRef.current.onUploadError?.(errorMessage);
        throw error;
      } finally {
        setIsUploading(false);
        setProgress(0);
      }
    },
    [resolvedContext],
  );

  return {
    startUpload,
    isUploading,
    progress,
  };
}

/**
 * Hook for uploading files with moderation.
 * Authentication is resolved server-side by Express via session cookies.
 */
export function useUpload(
  context: UploadContext | keyof typeof ENDPOINT_TO_CONTEXT,
  options: UseUploadOptions = {},
) {
  return useUploadInternal(context, options);
}
