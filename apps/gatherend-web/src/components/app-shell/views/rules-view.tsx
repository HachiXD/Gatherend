"use client";

import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useCommunityHeaderStyle } from "@/hooks/use-community-header-style";
import { useBoardData, useCurrentMemberRole } from "@/hooks/use-board-data";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { MemberRole } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { FileUpload } from "@/components/file-upload";
import { useUpload } from "@/hooks/use-upload";
import {
  parseStoredUploadValue,
  getStoredUploadAssetId,
} from "@/lib/upload-values";
import { parsePostContent } from "@/lib/parse-post-formatting";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffectiveThemeMode } from "@/hooks/use-effective-theme-config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientBoardRules {
  id: string;
  boardId: string;
  title: string;
  content: string;
  imageAsset: {
    id: string;
    url: string;
    width?: number | null;
    height?: number | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface BoardRulesResponse {
  rules: ClientBoardRules | null;
}

// ─── Inline image (always below text) ─────────────────────────────────────────

function RulesImage({
  imageUrl,
  width,
  height,
}: {
  imageUrl: string;
  width?: number | null;
  height?: number | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [forceOriginal, setForceOriginal] = useState(false);

  const maxW = 640;
  const maxH = 480;
  const scale =
    width && height
      ? Math.min(1, maxW / width, maxH / height)
      : 1;
  const displayW = width ? Math.round(width * scale) : maxW;
  const displayH = height ? Math.round(height * scale) : undefined;

  const optimizedUrl = useMemo(() => {
    if (forceOriginal) return imageUrl;
    return getOptimizedStaticUiImageUrl(imageUrl, {
      w: displayW * 2,
      h: (displayH ? displayH * 2 : displayW * 2),
      q: 84,
      resize: "fit",
      gravity: "sm",
    });
  }, [forceOriginal, imageUrl, displayW, displayH]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-3 block cursor-pointer overflow-hidden rounded-md border border-theme-border bg-black/3"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={optimizedUrl}
          alt="Imagen de reglas"
          width={displayW}
          height={displayH}
          className="block object-contain"
          style={{ width: displayW, height: displayH }}
          loading="lazy"
          decoding="async"
          onError={() => setForceOriginal(true)}
        />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-none gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
          overlayClassName="bg-black/70"
        >
          <DialogTitle className="sr-only">Vista previa de imagen</DialogTitle>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Imagen de reglas"
              className="block max-h-[92vh] max-w-[92vw] object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Inline form (create / edit) ──────────────────────────────────────────────

interface RulesFormProps {
  boardId: string;
  initialTitle?: string;
  initialContent?: string;
  initialImageUrl?: string | null;
  initialImageAssetId?: string | null;
  isEdit: boolean;
  onCancel: () => void;
  onSuccess: (rules: ClientBoardRules) => void;
}

function RulesForm({
  boardId,
  initialTitle = "",
  initialContent = "",
  initialImageUrl,
  initialImageAssetId,
  isEdit,
  onCancel,
  onSuccess,
}: RulesFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [imageUpload, setImageUpload] = useState(() => {
    if (initialImageAssetId && initialImageUrl) {
      return JSON.stringify({ assetId: initialImageAssetId, url: initialImageUrl });
    }
    return "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { startUpload } = useUpload("board_rules_image", {
    onModerationBlock: (reason) => toast.error(reason),
    onUploadError: (error) => toast.error(`Error al subir imagen: ${error}`),
  });

  const titleRef = useRef<HTMLInputElement | null>(null);

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const imageAssetId = getStoredUploadAssetId(imageUpload);
  const canSubmit = trimmedTitle.length > 0 && trimmedContent.length > 0;

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;

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
    } catch {
      toast.error("No se pudo subir la imagen pegada");
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const uploadedMeta = parseStoredUploadValue(imageUpload);
      let resolvedImageAssetId: string | null = imageAssetId;

      // If editing and image was cleared (upload is empty but there was one before)
      if (isEdit && !imageUpload && initialImageAssetId) {
        resolvedImageAssetId = null;
      }

      let result: ClientBoardRules;
      if (isEdit) {
        const { data } = await axios.patch<ClientBoardRules>(
          `/api/boards/${boardId}/rules`,
          {
            title: trimmedTitle,
            content: trimmedContent,
            imageAssetId: resolvedImageAssetId,
          },
        );
        result = { ...data, imageAsset: data.imageAsset ?? null };
      } else {
        const { data } = await axios.post<ClientBoardRules>(
          `/api/boards/${boardId}/rules`,
          {
            title: trimmedTitle,
            content: trimmedContent,
            imageAssetId: resolvedImageAssetId,
          },
        );
        result = data;
      }

      // Attach the optimistic image metadata if we have it from the upload
      if (resolvedImageAssetId && uploadedMeta && !result.imageAsset) {
        result = {
          ...result,
          imageAsset: {
            id: resolvedImageAssetId,
            url: uploadedMeta.url,
            width: uploadedMeta.width ?? null,
            height: uploadedMeta.height ?? null,
          },
        };
      }

      toast.success(isEdit ? "Reglas actualizadas" : "Reglas creadas");
      onSuccess(result);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error("Ya existen reglas para este board");
      } else {
        toast.error(isEdit ? "No se pudieron actualizar las reglas" : "No se pudieron crear las reglas");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadBtnClass = "h-28 w-35 rounded-none text-[11px] transition-colors duration-150 border-white/30 bg-theme-bg-cancel-button text-theme-text-subtle hover:border-white/50 hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light";

  const removeBtnClass = "bg-transparent p-1 mr-4 shadow-none cursor-pointer hover:bg-transparent transition-colors duration-150 text-theme-text-tertiary hover:text-theme-text-light";

  const cancelBtnClass = "h-6.5 w-full cursor-pointer rounded-none border-0 px-3 text-[12px] transition-colors duration-150 bg-theme-bg-cancel-button text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light";

  const publishBtnClass = "h-6.5 w-full cursor-pointer rounded-none border-0 px-3 text-[12px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-70 bg-theme-tab-button-bg text-theme-text-light hover:bg-theme-tab-button-hover";

  return (
    <div className="border border-theme-border/40 p-3">
      <div className="flex items-stretch gap-3">
        {/* Left: image upload */}
        <div className="flex shrink-0 flex-col mt-6.5">
          <FileUpload
            endpoint="boardRulesImage"
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
              {isSubmitting
                ? isEdit
                  ? "Guardando..."
                  : "Creando..."
                : isEdit
                  ? "Guardar"
                  : "Crear"}
            </Button>
          </div>
        </div>

        {/* Right: title + content */}
        <div className="flex min-w-0 flex-1 flex-col gap-y-1.5 -mb-1">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 200))}
            disabled={isSubmitting}
            className="h-8 w-full shrink-0 border border-theme-border-subtle bg-transparent px-3 text-[14px] leading-5 text-theme-text-light outline-none focus:border-theme-border-accent"
            placeholder="Título de las reglas..."
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSubmitting}
            rows={5}
            maxLength={5000}
            onPaste={(e) => void handlePaste(e)}
            className="scrollbar-ultra-thin min-h-[182px] w-full flex-1 resize-none border border-theme-border-subtle bg-transparent px-3 py-2 text-[14px] leading-5 text-theme-text-light outline-none focus:border-theme-border-accent"
            placeholder="Escribe las reglas del board..."
          />
          <div className="flex items-center justify-between gap-x-2">
            <span className="text-[11px] text-theme-text-muted">
              Título y contenido son obligatorios
            </span>
            <span className="text-[11px] text-theme-text-tertiary">
              {content.length}/5000
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── rules-view inner ─────────────────────────────────────────────────────────

function RulesViewInner() {
  const boardId = useCurrentBoardId();
  const {
    data: board,
    isLoading: boardLoading,
    error: boardError,
  } = useBoardData(boardId, { enableFetch: true });
  const profile = useProfile();
  const role = useCurrentMemberRole(profile.id);
  const queryClient = useQueryClient();
  const themeMode = useEffectiveThemeMode();

  const canEdit =
    role === MemberRole.OWNER || role === MemberRole.ADMIN;

  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Query ──────────────────────────────────────────────────────────────────

  const rulesQueryKey = useMemo(() => ["boardRules", boardId], [boardId]);

  const {
    data: rulesData,
    isLoading: rulesLoading,
  } = useQuery<BoardRulesResponse>({
    queryKey: rulesQueryKey,
    queryFn: async () => {
      const { data } = await axios.get<BoardRulesResponse>(
        `/api/boards/${boardId}/rules`,
      );
      return data;
    },
    enabled: !!boardId,
  });

  const rules = rulesData?.rules ?? null;

  // ── Header colors (same logic as forum-view) ───────────────────────────────

  const headerButtonStyles = useCommunityHeaderStyle();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFormSuccess = useCallback(
    (updated: ClientBoardRules) => {
      queryClient.setQueryData<BoardRulesResponse>(rulesQueryKey, {
        rules: updated,
      });
      setMode("view");
    },
    [queryClient, rulesQueryKey],
  );

  const handleDelete = useCallback(async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await axios.delete(`/api/boards/${boardId}/rules`);
      queryClient.setQueryData<BoardRulesResponse>(rulesQueryKey, {
        rules: null,
      });
      toast.success("Reglas eliminadas");
    } catch {
      toast.error("No se pudieron eliminar las reglas");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [isDeleting, boardId, queryClient, rulesQueryKey]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (!board && boardLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
        <div className="h-12 w-full shrink-0 animate-pulse bg-theme-bg-secondary/70" />
        <div className="flex-1 space-y-4 px-6 py-4">
          <div className="h-48 w-full animate-pulse rounded bg-theme-bg-secondary/70" />
        </div>
      </div>
    );
  }

  if (!board && boardError) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center text-destructive">
        {boardError.message}
      </div>
    );
  }

  const btnClass =
    "inline-flex border border-theme-border h-8 cursor-pointer items-center gap-2 bg-(--community-header-btn-bg) px-3 text-[14px] font-semibold text-(--community-header-btn-text) hover:bg-(--community-header-btn-hover) focus-visible:ring-2 focus-visible:ring-(--community-header-btn-ring) focus-visible:outline-none disabled:opacity-50 rounded-none";

  return (
    <>
      <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
        <div className="h-full w-full overflow-y-auto scrollbar-chat">
          {/* Header */}
          <div className="sticky top-0 z-20 shrink-0 border-b border-theme-border transition-colors duration-300">
            <div className="px-0 pt-2 pb-2" style={headerButtonStyles}>
              <div className="ml-3 mr-3 flex items-center gap-2">
                {/* Badge */}
                <div className="flex min-w-0 max-w-[min(52vw,420px)] items-center justify-center gap-2 bg-(--community-header-btn-bg) px-3 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_-1px_0_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)]">
                  <p className="min-w-0 truncate text-center text-[16px] font-semibold text-theme-text-subtle">
                    {board ? `Reglas de ${board.name}` : "Reglas"}
                  </p>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {canEdit && !rules && mode === "view" && (
                    <button
                      type="button"
                      onClick={() => setMode("create")}
                      className={btnClass}
                    >
                      <Plus className="h-5 w-5" />
                      Crear Reglas
                    </button>
                  )}
                  {canEdit && rules && mode === "view" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMode("edit")}
                        className={btnClass}
                      >
                        <Edit className="h-4 w-4" />
                        Editar Reglas
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className={btnClass}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar Reglas
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Inline form */}
            {(mode === "create" || mode === "edit") && (
              <div style={headerButtonStyles} className="pb-2.5 px-3">
                <RulesForm
                  boardId={boardId}
                  initialTitle={mode === "edit" ? (rules?.title ?? "") : ""}
                  initialContent={mode === "edit" ? (rules?.content ?? "") : ""}
                  initialImageUrl={mode === "edit" ? (rules?.imageAsset?.url ?? null) : null}
                  initialImageAssetId={mode === "edit" ? (rules?.imageAsset?.id ?? null) : null}
                  isEdit={mode === "edit"}
                  onCancel={() => setMode("view")}
                  onSuccess={handleFormSuccess}
                />
              </div>
            )}
          </div>

          {/* Body */}
          <div className="w-full px-4 py-4">
            {rulesLoading && (
              <div className="space-y-3">
                <div className="h-8 w-3/4 animate-pulse rounded bg-theme-bg-secondary/70" />
                <div className="h-24 w-full animate-pulse rounded bg-theme-bg-secondary/70" />
              </div>
            )}

            {!rulesLoading && !rules && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-[15px] text-theme-text-muted">
                  Este board no tiene reglas todavía.
                </p>
                {canEdit && (
                  <p className="mt-1 text-[13px] text-theme-text-subtle">
                    Usa el botón &ldquo;Crear Reglas&rdquo; para añadirlas.
                  </p>
                )}
              </div>
            )}

            {!rulesLoading && rules && (
              <article className="w-full max-w-3xl">
                {/* Title */}
                <h1 className="mb-3 break-words border-2 border-theme-channel-type-active-border pl-2 text-[22px] font-bold leading-tight text-theme-text-light">
                  {rules.title}
                </h1>

                {/* Content */}
                <div className="whitespace-pre-wrap wrap-break-word text-[16px] leading-7 text-theme-text-secondary">
                  {parsePostContent(rules.content, themeMode)}
                </div>

                {/* Image — always below text */}
                {rules.imageAsset && (
                  <RulesImage
                    imageUrl={rules.imageAsset.url}
                    width={rules.imageAsset.width}
                    height={rules.imageAsset.height}
                  />
                )}
              </article>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => { if (!isDeleting) setShowDeleteConfirm(open); }}>
        <DialogContent
          className="max-w-[420px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
          closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
        >
          <DialogHeader className="px-6 pt-2">
            <DialogTitle className="text-center text-2xl font-bold">
              Eliminar reglas
            </DialogTitle>
            <DialogDescription className="-mt-2 text-center text-[15px] text-theme-text-subtle">
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-6 pb-4 -mt-2.5">
            <div className="flex h-8 items-center justify-center border border-theme-border bg-theme-bg-edit-form/60 px-3">
              <p className="text-center text-[14px] leading-none text-theme-text-tertiary">
                Las reglas de{" "}
                <span className="font-semibold text-red-400">
                  {board?.name}
                </span>{" "}
                serán eliminadas permanentemente.
              </p>
            </div>
          </div>

          <DialogFooter className="-mt-5.5 border-t border-theme-border bg-theme-bg-secondary/40 px-6 py-1.5">
            <Button
              type="button"
              variant="ghost"
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(false)}
              className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
              className="h-6.5 cursor-pointer rounded-none border border-red-500/60 bg-red-500/80 px-3 text-[14px] text-theme-text-light hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isDeleting ? "Eliminando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const RulesView = memo(RulesViewInner);
