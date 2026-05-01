import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { uploadFile as uploadFileUseCase } from "../application/upload-file";
import type { MobileUploadFile } from "../data/mobile-upload-file";
import type { UploadContext } from "../domain/upload-context";
import { UploadError, type UploadedFile } from "../domain/uploaded-file";

export type UseUploadOptions = {
  onUploadBegin?: () => void;
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: string) => void;
  onModerationBlock?: (reason: string) => void;
};

export type UploadFileVariables = {
  file: MobileUploadFile;
  context: UploadContext;
  boardId?: string;
};

export function useUpload(options: UseUploadOptions = {}) {
  const profile = useProfile();
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const mutation = useMutation<UploadedFile, Error, UploadFileVariables>({
    mutationFn: async (variables) => {
      optionsRef.current.onUploadBegin?.();

      return uploadFileUseCase({
        ...variables,
        profileId: profile.id,
      });
    },
    onError: (error) => {
      const message = error.message || "Upload failed";

      if (error instanceof UploadError && error.isModerationBlock) {
        optionsRef.current.onModerationBlock?.(message);
        return;
      }

      optionsRef.current.onUploadError?.(message);
    },
    onSuccess: (file) => {
      optionsRef.current.onUploadComplete?.(file);
    },
  });

  return {
    uploadFile: mutation.mutateAsync,
    isUploading: mutation.isPending,
    error: mutation.error,
  };
}

