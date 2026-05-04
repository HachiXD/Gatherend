"use client";

import {
  memo,
  useCallback,
  useMemo,
  useState,
  type ClipboardEvent,
} from "react";
import { Edit, Plus, ScrollText, Trash2 } from "lucide-react";
import { useCommunityHeaderStyle } from "@/hooks/use-community-header-style";
import { useBoardData, useCurrentMemberRole } from "@/hooks/use-board-data";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { useCurrentBoardId } from "@/contexts/board-switch-context";
import { MemberRole } from "@prisma/client";
import { isAdmin } from "@/lib/domain-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { FileUpload } from "@/components/file-upload";
import { useUpload } from "@/hooks/use-upload";
import {
  getStoredUploadAssetId,
  parseStoredUploadValue,
} from "@/lib/upload-values";
import { parsePostContent } from "@/lib/parse-post-formatting";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffectiveThemeMode } from "@/hooks/use-effective-theme-config";

const MAX_RULE_TITLE_LENGTH = 200;
const MAX_RULE_DESCRIPTION_LENGTH = 1000;

interface ClientRuleItem {
  order: number;
  title: string;
  description: string | null;
}

interface ClientBoardRules {
  id: string;
  boardId: string;
  items: ClientRuleItem[];
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

interface RuleDraft {
  title: string;
  description: string;
}

function createEmptyRuleDraft(): RuleDraft {
  return {
    title: "",
    description: "",
  };
}

function toRuleDrafts(items?: ClientRuleItem[]): RuleDraft[] {
  if (!items || items.length === 0) {
    return [createEmptyRuleDraft()];
  }

  return items.map((item) => ({
    title: item.title,
    description: item.description ?? "",
  }));
}

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
  const scale = width && height ? Math.min(1, maxW / width, maxH / height) : 1;
  const displayW = width ? Math.round(width * scale) : maxW;
  const displayH = height ? Math.round(height * scale) : undefined;

  const optimizedUrl = useMemo(() => {
    if (forceOriginal) return imageUrl;
    return getOptimizedStaticUiImageUrl(imageUrl, {
      w: displayW * 2,
      h: displayH ? displayH * 2 : displayW * 2,
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
        className="mt-4 block cursor-pointer overflow-hidden rounded-lg border border-theme-border bg-black/3"
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

interface RulesFormProps {
  boardId: string;
  initialItems?: ClientRuleItem[];
  initialImageUrl?: string | null;
  initialImageAssetId?: string | null;
  isEdit: boolean;
  onCancel: () => void;
  onSuccess: (rules: ClientBoardRules) => void;
}

function RulesForm({
  boardId,
  initialItems,
  initialImageUrl,
  initialImageAssetId,
  isEdit,
  onCancel,
  onSuccess,
}: RulesFormProps) {
  const [ruleDrafts, setRuleDrafts] = useState<RuleDraft[]>(() =>
    toRuleDrafts(initialItems),
  );
  const [imageUpload, setImageUpload] = useState(() => {
    if (initialImageAssetId && initialImageUrl) {
      return JSON.stringify({
        assetId: initialImageAssetId,
        url: initialImageUrl,
      });
    }
    return "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { startUpload } = useUpload("board_rules_image", {
    onModerationBlock: (reason) => toast.error(reason),
    onUploadError: (error) => toast.error(`Error al subir imagen: ${error}`),
  });

  const imageAssetId = getStoredUploadAssetId(imageUpload);

  const canSubmit =
    ruleDrafts.length > 0 &&
    ruleDrafts.every((rule) => rule.title.trim().length > 0);

  const updateRuleDraft = useCallback(
    (index: number, field: keyof RuleDraft, value: string) => {
      setRuleDrafts((current) =>
        current.map((rule, currentIndex) =>
          currentIndex === index ? { ...rule, [field]: value } : rule,
        ),
      );
    },
    [],
  );

  const handleAddRule = useCallback(() => {
    setRuleDrafts((current) => [...current, createEmptyRuleDraft()]);
  }, []);

  const handleRemoveRule = useCallback((index: number) => {
    setRuleDrafts((current) => {
      if (current.length === 1) {
        return [createEmptyRuleDraft()];
      }

      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }, []);

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
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

      if (isEdit && !imageUpload && initialImageAssetId) {
        resolvedImageAssetId = null;
      }

      const payload = {
        items: ruleDrafts.map((rule) => ({
          title: rule.title.trim(),
          description:
            rule.description.trim().length > 0 ? rule.description.trim() : null,
        })),
        imageAssetId: resolvedImageAssetId,
      };

      let result: ClientBoardRules;
      if (isEdit) {
        const { data } = await axios.patch<ClientBoardRules>(
          `/api/boards/${boardId}/rules`,
          payload,
        );
        result = { ...data, imageAsset: data.imageAsset ?? null };
      } else {
        const { data } = await axios.post<ClientBoardRules>(
          `/api/boards/${boardId}/rules`,
          payload,
        );
        result = data;
      }

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
        toast.error(
          isEdit
            ? "No se pudieron actualizar las reglas"
            : "No se pudieron crear las reglas",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadBtnClass =
    "h-28 w-full rounded-lg border border-theme-border/60 bg-theme-bg-cancel-button text-[11px] text-theme-text-subtle transition-colors duration-150 hover:border-theme-border hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light sm:w-40";

  const removeBtnClass =
    "mr-3 bg-transparent p-1 text-theme-text-tertiary shadow-none transition-colors duration-150 hover:bg-transparent hover:text-theme-text-light";

  const cancelBtnClass =
    "h-8 w-full cursor-pointer rounded-lg border border-theme-border/50 bg-theme-bg-cancel-button px-3 text-[12px] text-theme-text-subtle transition-colors duration-150 hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light";

  const publishBtnClass =
    "h-8 w-full cursor-pointer rounded-lg border-0 bg-theme-tab-button-bg px-3 text-[12px] font-semibold text-theme-text-light transition-colors duration-150 hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <div className="rounded-lg border border-theme-border/50 bg-theme-bg-secondary p-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex shrink-0 flex-col gap-3 lg:w-44">
          <FileUpload
            endpoint="boardRulesImage"
            label="Subir imagen"
            value={imageUpload}
            onChange={(value) => setImageUpload(value ?? "")}
            uploadButtonClassName={uploadBtnClass}
            imagePreviewWrapperClassName="relative flex h-28 w-full items-center justify-center sm:w-40"
            imagePreviewClassName="h-28 rounded-lg object-contain"
            removeButtonClassName={removeBtnClass}
          />

          <div className="rounded-lg border border-theme-border/40 bg-theme-bg-tertiary/70 px-3 py-2 text-[11px] leading-5 text-theme-text-muted">
            El orden sigue la lista de arriba hacia abajo. Para reordenar, por
            ahora elimina una regla y vuelve a crearla en la posicion que
            quieras.
          </div>

          <div className="flex flex-col gap-2">
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

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-theme-border/40 bg-theme-bg-tertiary/50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-theme-text-light">
                Lista de reglas
              </p>
              <p className="text-[11px] text-theme-text-muted">
                Cada regla tiene titulo obligatorio y descripcion opcional.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddRule}
              disabled={isSubmitting}
              className="h-8 cursor-pointer rounded-lg border border-theme-border/50 bg-theme-bg-cancel-button px-3 text-[12px] text-theme-text-subtle transition-colors hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            >
              <Plus className="mr-1 h-4 w-4" />
              Anadir regla
            </Button>
          </div>

          <div className="space-y-3">
            {ruleDrafts.map((rule, index) => (
              <div
                key={`rule-draft-${index}`}
                className="rounded-lg border border-theme-border/50 bg-theme-bg-tertiary/70"
              >
                <div className="flex items-center gap-3 border-b border-theme-border/40 px-3 py-2">
                  <div className="flex h-7 min-w-7 items-center justify-center rounded-md border border-theme-border/50 bg-theme-bg-secondary text-[12px] font-semibold text-theme-text-light">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-theme-text-light">
                      Regla {index + 1}
                    </p>
                    <p className="text-[11px] text-theme-text-muted">
                      El orden se guarda segun la posicion actual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(index)}
                    disabled={isSubmitting}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-transparent text-theme-text-tertiary transition hover:border-theme-border/40 hover:bg-theme-bg-secondary hover:text-theme-text-light disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Eliminar regla ${index + 1}`}
                    title={`Eliminar regla ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2 px-3 py-3">
                  <input
                    type="text"
                    value={rule.title}
                    onChange={(e) =>
                      updateRuleDraft(
                        index,
                        "title",
                        e.target.value.slice(0, MAX_RULE_TITLE_LENGTH),
                      )
                    }
                    disabled={isSubmitting}
                    className="h-9 w-full rounded-lg border border-theme-border-subtle bg-transparent px-3 text-[14px] leading-5 text-theme-text-light outline-none transition focus:border-theme-border-accent"
                    placeholder={`Titulo de la regla ${index + 1}`}
                  />

                  <textarea
                    value={rule.description}
                    onChange={(e) =>
                      updateRuleDraft(
                        index,
                        "description",
                        e.target.value.slice(0, MAX_RULE_DESCRIPTION_LENGTH),
                      )
                    }
                    disabled={isSubmitting}
                    rows={4}
                    maxLength={MAX_RULE_DESCRIPTION_LENGTH}
                    onPaste={(e) => void handlePaste(e)}
                    className="scrollbar-ultra-thin min-h-[108px] w-full resize-none rounded-lg border border-theme-border-subtle bg-transparent px-3 py-2 text-[14px] leading-5 text-theme-text-light outline-none transition focus:border-theme-border-accent"
                    placeholder="Descripcion opcional de la regla..."
                  />

                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-theme-text-muted">
                      Titulo obligatorio. Descripcion opcional.
                    </span>
                    <span className="text-theme-text-tertiary">
                      {rule.description.length}/{MAX_RULE_DESCRIPTION_LENGTH}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const canEdit = isAdmin(role as MemberRole);

  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const rulesQueryKey = useMemo(() => ["boardRules", boardId], [boardId]);

  const { data: rulesData, isLoading: rulesLoading } =
    useQuery<BoardRulesResponse>({
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
  const headerButtonStyles = useCommunityHeaderStyle();

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
    "inline-flex h-9 w-9 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-transparent px-0 text-theme-text-subtle transition hover:bg-theme-app-settings-hover hover:text-theme-text-light focus-visible:outline-none disabled:opacity-50 md:w-auto md:px-3";

  return (
    <>
      <div className="flex h-full w-full flex-col overflow-hidden bg-theme-bg-tertiary">
        <div className="h-full w-full overflow-y-auto scrollbar-chat">
          <div className="sticky top-0 z-20 shrink-0 border-b border-theme-border transition-colors duration-300">
            <div
              className="flex h-11 items-center px-0"
              style={{
                ...headerButtonStyles,
                backgroundImage: "none",
                backgroundColor: "var(--theme-bg-quinary)",
              }}
            >
              <div className="ml-3 mr-3 flex w-full items-center gap-2">
                <div className="flex min-w-0 max-w-[min(52vw,420px)] items-center justify-center gap-2 rounded-lg px-3 py-0.5">
                  <ScrollText className="h-6 w-6 shrink-0 text-theme-text-subtle" />
                  <p className="min-w-0 truncate text-center text-[20px] font-semibold text-theme-text-subtle">
                    {board ? `Reglas de ${board.name}` : "Reglas"}
                  </p>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {canEdit && !rules && mode === "view" && (
                    <button
                      type="button"
                      onClick={() => setMode("create")}
                      className={btnClass}
                      aria-label="Crear Reglas"
                      title="Crear Reglas"
                    >
                      <Plus className="h-6 w-6" />
                      <span className="hidden md:inline">Crear Reglas</span>
                    </button>
                  )}
                  {canEdit && rules && mode === "view" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMode("edit")}
                        className={btnClass}
                        aria-label="Editar Reglas"
                        title="Editar Reglas"
                      >
                        <Edit className="h-6 w-6" />
                        <span className="hidden md:inline">Editar Reglas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className={btnClass}
                        aria-label="Eliminar Reglas"
                        title="Eliminar Reglas"
                      >
                        <Trash2 className="h-6 w-6" />
                        <span className="hidden md:inline">
                          Eliminar Reglas
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {(mode === "create" || mode === "edit") && (
              <div
                style={{
                  ...headerButtonStyles,
                  backgroundImage: "none",
                  backgroundColor: "transparent",
                }}
                className="px-3 py-2.5"
              >
                <RulesForm
                  boardId={boardId}
                  initialItems={mode === "edit" ? (rules?.items ?? []) : []}
                  initialImageUrl={
                    mode === "edit" ? (rules?.imageAsset?.url ?? null) : null
                  }
                  initialImageAssetId={
                    mode === "edit" ? (rules?.imageAsset?.id ?? null) : null
                  }
                  isEdit={mode === "edit"}
                  onCancel={() => setMode("view")}
                  onSuccess={handleFormSuccess}
                />
              </div>
            )}
          </div>

          <div className="w-full px-4 py-4">
            {rulesLoading && (
              <div className="space-y-3">
                <div className="h-8 w-3/4 animate-pulse rounded bg-theme-bg-secondary/70" />
                <div className="h-24 w-full animate-pulse rounded bg-theme-bg-secondary/70" />
              </div>
            )}

            {!rulesLoading && !rules && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-[16px] text-theme-text-muted">
                  Este board no tiene reglas todavia.
                </p>
                {canEdit && (
                  <p className="mt-1 text-[15px] text-theme-text-subtle">
                    Usa el boton &ldquo;Crear Reglas&rdquo; para anadirlas.
                  </p>
                )}
              </div>
            )}

            {!rulesLoading && rules && (
              <article className="w-full max-w-3xl">
                <ol className="space-y-3">
                  {rules.items.map((rule) => (
                    <li
                      key={`${rule.order}-${rule.title}`}
                      className="flex gap-3 rounded-lg border border-theme-border/50 bg-theme-bg-secondary/70 px-3 py-3"
                    >
                      <div className="flex h-8 min-w-8 items-center justify-center rounded-md border border-theme-tab-button-bg/70 bg-theme-tab-button-bg/40 text-[14px] font-semibold text-theme-text-light">
                        {rule.order}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="break-words text-[18px] font-semibold leading-6 text-theme-text-light">
                          {parsePostContent(rule.title, themeMode)}
                        </div>

                        {rule.description && (
                          <div className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-6 text-theme-text-subtle">
                            {parsePostContent(rule.description, themeMode)}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>

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

      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!isDeleting) setShowDeleteConfirm(open);
        }}
      >
        <DialogContent
          className="max-w-[420px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
          closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
        >
          <DialogHeader className="px-6 pt-2">
            <DialogTitle className="text-center text-2xl font-bold">
              Eliminar reglas
            </DialogTitle>
            <DialogDescription className="-mt-2 text-center text-[15px] text-theme-text-subtle">
              Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="-mt-2.5 space-y-3 px-6 pb-4">
            <div className="flex h-8 items-center justify-center border border-theme-border bg-theme-bg-edit-form/60 px-3">
              <p className="text-center text-[14px] leading-none text-theme-text-tertiary">
                Las reglas de{" "}
                <span className="font-semibold text-red-400">
                  {board?.name}
                </span>{" "}
                seran eliminadas permanentemente.
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
