"use client";

import { useRef, useState } from "react";
import { FileIcon, Pencil, Upload, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { useUpload, type UploadContext } from "@/hooks/use-upload";
import { parseStoredUploadValue } from "@/lib/upload-values";

const CDN_DOMAIN = process.env.NEXT_PUBLIC_STORAGE_DOMAIN || "";

const ENDPOINT_TO_CONTEXT = {
  messageFile: "message_attachment",
  boardImage: "board_image",
  communityImage: "community_image",
  communityPostImage: "community_post_image",
} satisfies Record<string, UploadContext>;

type FileUploadEndpoint = keyof typeof ENDPOINT_TO_CONTEXT;

interface FileUploadProps {
  onChange: (value?: string) => void;
  value: string;
  endpoint: FileUploadEndpoint;
  previewUrl?: string | null;
}

function looksLikeImageUrl(url: string) {
  const cleanUrl = url.split("?")[0]?.split("#")[0] || "";
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(cleanUrl);
}

export const FileUpload = ({
  onChange,
  value,
  endpoint,
  previewUrl,
}: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const context = ENDPOINT_TO_CONTEXT[endpoint];
  const isCircularImagePicker =
    context === "board_image" || context === "community_image";
  const acceptsMixedFiles = context === "message_attachment";

  const { startUpload } = useUpload(context, {
    onModerationBlock: (reason) => {
      toast.error(reason);
    },
    onUploadError: (error) => {
      toast.error(`Upload failed: ${error}`);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const res = await startUpload(Array.from(files));
      const file = res?.[0];

      if (file) {
        onChange(
          JSON.stringify({
            assetId: file.assetId,
            url: file.url,
            type: file.type,
            name: file.name,
            size: file.size,
            width: file.width,
            height: file.height,
          }),
        );
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const fileData = parseStoredUploadValue(value);
  const fileUrl = fileData?.url || previewUrl || "";
  const fileType = fileData?.type;
  const fileName = fileData?.name;

  const isGatherendCdnUrl =
    !!fileUrl && CDN_DOMAIN !== "" && fileUrl.includes(CDN_DOMAIN);

  const isImage =
    !!fileUrl &&
    (fileType?.startsWith("image/") ||
      context === "board_image" ||
      context === "community_image" ||
      context === "community_post_image" ||
      looksLikeImageUrl(fileUrl));

  const isPdf = fileType === "application/pdf";

  if (isImage && fileUrl && isCircularImagePicker) {
    return (
      <div className="shrink-0 mx-auto md:mx-0">
        <div className="relative h-20 w-20 mx-auto group">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*"
          />

          <div className="w-full h-full rounded-full overflow-hidden bg-zinc-700 flex items-center justify-center ring-4 ring-theme-bg-primary shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl}
              alt="Upload"
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              crossOrigin={isGatherendCdnUrl ? "anonymous" : undefined}
            />
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-theme-tab-button-bg text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 hover:bg-theme-tab-button-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            aria-label={t.common.uploadBoardImage}
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {uploading && (
          <p className="text-xs text-center text-theme-text-muted mt-2">
            {t.common.uploading}
          </p>
        )}
      </div>
    );
  }

  if (isImage && fileUrl) {
    return (
      <div className="relative h-20 w-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl}
          alt="Upload"
          className="h-20 w-20 rounded-full object-cover"
          loading="lazy"
          decoding="async"
          crossOrigin={isGatherendCdnUrl ? "anonymous" : undefined}
        />
        <button
          onClick={() => onChange("")}
          className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-sm"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (fileUrl && isPdf) {
    return (
      <div className="relative flex items-center p-2 mt-2 rounded-md bg-background/10">
        <FileIcon className="h-10 w-10 fill-indigo-200 stroke-indigo-400" />
        <div className="ml-2 flex-1">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-400 hover:underline"
          >
            {fileName || "Archivo adjunto"}
          </a>
          <p className="text-xs text-gray-500">
            {isPdf ? "PDF" : "Archivo"}
            {fileData?.size ? ` • ${(fileData.size / 1024).toFixed(1)} KB` : ""}
          </p>
        </div>
        <button
          onClick={() => onChange("")}
          className="ml-2 bg-rose-500 text-white p-1 rounded-full shadow-sm"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const isCircular = isCircularImagePicker;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept={acceptsMixedFiles ? "image/*,.pdf" : "image/*"}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "flex flex-col items-center justify-center border border-dashed border-gray-400",
          isCircular ? "h-20 w-20 rounded-full gap-1" : "h-20 w-40 rounded-lg",
          uploading
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-gray-300 cursor-pointer",
        )}
        disabled={uploading}
      >
        <Upload className={clsx(isCircular ? "h-5 w-5" : "mr-2 h-5 w-5")} />
        {uploading ? (
          <span
            className={clsx(
              isCircular && "text-[9px] text-center leading-tight",
            )}
          >
            {t.common.uploading}
          </span>
        ) : (
          <span
            className={clsx(
              isCircular && "text-[9px] text-center leading-tight px-1",
            )}
          >
            {isCircular ? t.common.uploadBoardImage : t.common.uploadFile}
          </span>
        )}
      </button>
    </>
  );
};
