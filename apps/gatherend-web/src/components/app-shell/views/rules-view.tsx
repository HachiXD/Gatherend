"use client";

import {
  memo,
  useCallback,
  useMemo,
  useState,
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_RULES_CONTENT_LENGTH = 10000;

interface ClientBoardRules {
  id: string;
  boardId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface BoardRulesResponse {
  rules: ClientBoardRules | null;
}

interface RulesFormProps {
  boardId: string;
  initialContent?: string;
  isEdit: boolean;
  onCancel: () => void;
  onSuccess: (rules: ClientBoardRules) => void;
}

function RulesForm({
  boardId,
  initialContent = "",
  isEdit,
  onCancel,
  onSuccess,
}: RulesFormProps) {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = content.trim().length > 0;

  const handleSubmit = async () => {
    if (isSubmitting || !canSubmit) return;
    setIsSubmitting(true);

    try {
      let result: ClientBoardRules;
      if (isEdit) {
        const { data } = await axios.patch<ClientBoardRules>(
          `/api/boards/${boardId}/rules`,
          { content },
        );
        result = data;
      } else {
        const { data } = await axios.post<ClientBoardRules>(
          `/api/boards/${boardId}/rules`,
          { content },
        );
        result = data;
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

  const cancelBtnClass =
    "h-8 w-full cursor-pointer rounded-lg border border-theme-border/50 bg-theme-bg-cancel-button px-3 text-[12px] text-theme-text-subtle transition-colors duration-150 hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light";

  const publishBtnClass =
    "h-8 w-full cursor-pointer rounded-lg border-0 bg-theme-tab-button-bg px-3 text-[12px] font-semibold text-theme-text-light transition-colors duration-150 hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <div className="rounded-lg border border-theme-border/50 bg-theme-bg-secondary p-3">
      <div className="flex flex-col gap-3">
        <textarea
          value={content}
          onChange={(e) =>
            setContent(e.target.value.slice(0, MAX_RULES_CONTENT_LENGTH))
          }
          disabled={isSubmitting}
          rows={12}
          maxLength={MAX_RULES_CONTENT_LENGTH}
          className="scrollbar-ultra-thin min-h-[200px] w-full resize-y rounded-lg border border-theme-border-subtle bg-transparent px-3 py-2 text-[14px] leading-6 text-theme-text-light outline-none transition focus:border-theme-border-accent"
          placeholder="Escribe las reglas del board..."
        />
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-theme-text-muted">
            El texto se mostrará tal cual.
          </span>
          <span className="text-theme-text-tertiary">
            {content.length}/{MAX_RULES_CONTENT_LENGTH}
          </span>
        </div>
        <div className="flex gap-2">
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
                  initialContent={mode === "edit" ? (rules?.content ?? "") : ""}
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
                <p className="whitespace-pre-wrap wrap-break-word text-[15px] leading-7 text-theme-text-subtle">
                  {rules.content}
                </p>
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
