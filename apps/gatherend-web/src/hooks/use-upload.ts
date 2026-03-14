/**
 * useUpload Hook
 *
 * Centralized upload hook that uses our Express backend with:
 * - S3-compatible storage for public content (boards, avatars, banners) - WITH moderation
 * - S3-compatible storage for private content (chat/DM attachments) - NO moderation
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAuthHeaders } from "@/lib/express-fetch";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Context types that match the backend
export type UploadContext =
  | "board_image"
  | "community_post_image"
  | "profile_avatar"
  | "profile_banner"
  | "message_attachment"
  | "sticker"
  | "dm_attachment";

// Legacy endpoint mapping (for backwards compatibility)
const ENDPOINT_TO_CONTEXT: Record<string, UploadContext> = {
  messageFile: "message_attachment",
  boardImage: "board_image",
  communityPostImage: "community_post_image",
  profileAvatar: "profile_avatar",
  profileBanner: "profile_banner",
  sticker: "sticker",
  dmAttachment: "dm_attachment",
};

export interface UploadedFile {
  url: string;
  key?: string;
  storage: "s3";
  type: string;
  name: string;
  size: number;
  width?: number;
  height?: number;
}

export interface UploadResult {
  success: boolean;
  file?: UploadedFile;
  error?: string;
  moderation?: {
    allowed: boolean;
    reason?: string;
    cached: boolean;
    processingTimeMs: number;
  };
}

export interface UseUploadOptions {
  onUploadBegin?: () => void;
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: string) => void;
  onModerationBlock?: (reason: string) => void;
}

function useUploadInternal(
  context: UploadContext | keyof typeof ENDPOINT_TO_CONTEXT,
  profileId: string | undefined,
  options: UseUploadOptions = {},
  source: "useUpload" | "useUploadWithProfile",
) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const getToken = useTokenGetter();

  // Keep options callbacks stable without forcing startUpload recreation.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Resolve context from legacy endpoint names
  const resolvedContext =
    ENDPOINT_TO_CONTEXT[context] || (context as UploadContext);

  const prevCauseRef = useRef<{
    profileId: string | undefined;
    resolvedContext: string;
    getToken: unknown;
  } | null>(null);

  useEffect(() => {
    const prev = prevCauseRef.current;
    const changed: string[] = [];

    if (!prev || prev.profileId !== profileId) changed.push("profileId");
    if (!prev || prev.resolvedContext !== resolvedContext)
      changed.push("resolvedContext");
    if (!prev || prev.getToken !== getToken) changed.push("getTokenRef");

    if (changed.length > 0) {
    }

    prevCauseRef.current = {
      profileId,
      resolvedContext,
      getToken,
    };
  }, [getToken, profileId, resolvedContext, source]);

  const startUpload = useCallback(
    async (files: File[]): Promise<UploadedFile[]> => {
      if (!profileId) {
        const error = "No profile found. Please log in.";
        optionsRef.current.onUploadError?.(error);
        throw new Error(error);
      }

      if (files.length === 0) {
        return [];
      }

      setIsUploading(true);
      setProgress(0);
      optionsRef.current.onUploadBegin?.();

      const results: UploadedFile[] = [];

      try {
        // Get token once for all uploads (in production)
        const token = IS_PRODUCTION ? await getToken() : undefined;

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
              headers: getExpressAuthHeaders(profileId, token),
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
            url: data.url,
            key: data.key,
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
    [getToken, profileId, resolvedContext],
  );

  return {
    startUpload,
    isUploading,
    progress,
  };
}

/**
 * Hook for uploading files with moderation.
 * Reads profile from `useCurrentProfile` (backward-compatible behavior).
 */
export function useUpload(
  context: UploadContext | keyof typeof ENDPOINT_TO_CONTEXT,
  options: UseUploadOptions = {},
) {
  const { data: profile } = useCurrentProfile();
  return useUploadInternal(context, profile?.id, options, "useUpload");
}

/**
 * Upload hook that receives profileId directly.
 * Use this in hot paths (e.g. ChatInput) to avoid duplicate profile query subscriptions.
 */
export function useUploadWithProfile(
  context: UploadContext | keyof typeof ENDPOINT_TO_CONTEXT,
  profileId: string | undefined,
  options: UseUploadOptions = {},
) {
  return useUploadInternal(context, profileId, options, "useUploadWithProfile");
}

/**
 * Backwards-compatible wrapper for legacy code
 *
 * @deprecated Use useUpload directly with proper context
 */
export function useLegacyUpload(endpoint: "messageFile" | "boardImage") {
  const context = ENDPOINT_TO_CONTEXT[endpoint] || "message_attachment";
  const { startUpload: upload, isUploading } = useUpload(context);

  // Wrap to match legacy return format
  const startUpload = async (files: File[]) => {
    try {
      const results = await upload(files);
      return results.map((file) => ({
        url: file.url,
        type: file.type,
        name: file.name,
        size: file.size,
      }));
    } catch {
      return undefined;
    }
  };

  return { startUpload, isUploading };
}
