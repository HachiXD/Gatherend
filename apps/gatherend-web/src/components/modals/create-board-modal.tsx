"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useModal } from "@/hooks/use-modal-store";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { useNavigationStore } from "@/hooks/use-navigation-store";
import { useTranslation } from "@/i18n";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import { Textarea } from "../ui/textarea";
import { detectBoardLanguages } from "@/lib/detect-language";
import { Globe, Lock } from "lucide-react";
import { getStoredUploadAssetId } from "@/lib/upload-values";

// CONSTANTES
const PANEL_SHELL =
  "border border-theme-border bg-theme-bg-secondary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)]";
const FIELD_SURFACE =
  "rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50";
const SECTION_KICKER =
  "text-[11px] -my-1 font-bold uppercase tracking-[0.08em] text-theme-text-subtle";

const schema = z.object({
  name: z
    .string()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" })
    .max(50, { message: "El nombre no puede exceder 50 caracteres" }),
  description: z
    .string()
    .max(300, { message: "La descripción no puede exceder 300 caracteres" })
    .optional(),
  imageUpload: z.string().optional(),
  isPrivate: z.boolean(),
});

type FormSchema = z.infer<typeof schema>;

// Defaults centralizados (no duplicados)
const DEFAULTS: FormSchema = {
  name: "",
  description: "",
  imageUpload: "",
  isPrivate: true,
};

export const CreateBoardModal = () => {
  const { isOpen, onClose, type } = useModal();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Estado local
  // Usar el store global de navegación (funciona desde fuera del BoardSwitchProvider)
  const { switchBoard, isNavigationReady } = useNavigationStore();

  const isModalOpen = isOpen && type === "createBoard";

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  // Reset con defaults REALMENTE alineados
  useEffect(() => {
    if (isModalOpen) {
      form.reset(DEFAULTS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen]);

  const isPrivate = form.watch("isPrivate");

  //  MUTATION con TanStack Query  //
  const createBoardMutation = useMutation({
    mutationFn: async (values: FormSchema) => {
      const boardData = {
        name: values.name,
        description: values.description,
        isPrivate: values.isPrivate,
        imageAssetId: getStoredUploadAssetId(values.imageUpload),
        languages: detectBoardLanguages(),
      };
      const response = await axios.post("/api/boards", boardData);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(t.modals.createBoard.success);
      form.reset(DEFAULTS);
      onClose();

      // Invalidar queries para actualizar el navigation sidebar y discovery feed
      queryClient.invalidateQueries({ queryKey: ["user-boards"] });
      queryClient.invalidateQueries({ queryKey: ["communities-feed"] });

      // Navegar al nuevo board usando navegación SPA
      // El board tiene channels[] con el primer canal creado
      const boardId = data.id;
      const firstChannelId = data.channels?.[0]?.id;

      if (isNavigationReady() && switchBoard && firstChannelId) {
        // Navegación SPA pura: actualiza contexto + URL sin reload
        // Los componentes cliente se re-renderizan via React Query
        switchBoard(boardId, firstChannelId);
      } else if (firstChannelId) {
        // Fallback: si no estamos en un board (navegación SPA no disponible)
        // Esto solo ocurre si el modal se abre desde fuera del layout de boards
        window.location.href = `/boards/${boardId}/rooms/${firstChannelId}`;
      } else {
        window.location.href = `/boards/${boardId}`;
      }
    },
    onError: (error: AxiosError<{ error?: string; message?: string }>) => {
      console.error(error);

      // Handle moderation errors specifically
      if (error.response?.data?.error === "MODERATION_BLOCKED") {
        const message =
          error.response.data.message || "Content was blocked by moderation.";
        toast.error(message, {
          duration: 5000,
          description: t.modals.createBoard.moderationError,
        });
      } else {
        toast.error(t.modals.createBoard.error);
      }

      // Rollback: invalidar para que se recargue el estado real
      queryClient.invalidateQueries({ queryKey: ["user-boards"] });
      queryClient.invalidateQueries({ queryKey: ["communities-feed"] });
    },
  });

  const onSubmit = (values: FormSchema) => {
    createBoardMutation.mutate(values);
  };

  // Estado de loading combinando form y mutation
  const isLoading = createBoardMutation.isPending;

  const handleClose = () => {
    form.reset(DEFAULTS);
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      {/* En mobile: scroll + X visible. En desktop: look original (sin scroll y sin X). */}
      <DialogContent
        className=" max-w-[480px]! max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle sm:max-h-none sm:overflow-hidden"
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="border-b border-theme-border bg-theme-bg-secondary/20 px-6 pb-1 pt-2">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.createBoard.title}
          </DialogTitle>
          <DialogDescription className="-mt-1 text-center text-[15px] text-theme-text-subtle">
            {t.modals.createBoard.subtitle}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            <div className="grid gap-4 px-4 pb-3 pt-0 -mt-1 sm:px-6">
              {/* Datos del Board */}
              <div className="space-y-3">
                <div className={cn("flex gap-0 overflow-hidden", PANEL_SHELL)}>
                  {/* Left: name + description */}
                  <div className="flex flex-1 flex-col gap-4 p-3">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            htmlFor="create-board-name"
                            className={SECTION_KICKER}
                          >
                            {t.modals.createBoard.nameLabel}
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="create-board-name"
                              disabled={isLoading}
                              className={cn(
                                FIELD_SURFACE,
                                "h-8 px-3 text-[15px] text-theme-text-light focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0",
                              )}
                              placeholder={t.modals.createBoard.namePlaceholder}
                              autoComplete="off"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="-mt-1 text-[11px] leading-tight" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            htmlFor="create-board-description"
                            className={SECTION_KICKER}
                          >
                            {t.modals.createBoard.descriptionLabel}
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              id="create-board-description"
                              disabled={isLoading}
                              className={cn(
                                FIELD_SURFACE,
                                "scrollbar-ultra-thin max-h-[160px] min-h-[90px] resize-none overflow-y-auto px-3 py-2 text-[15px] text-theme-text-light focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0",
                              )}
                              placeholder={t.modals.createBoard.tellUsMore}
                              autoComplete="off"
                              maxLength={300}
                              rows={4}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="-mt-1 text-[11px] leading-tight" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Right: upload */}
                  <div className="flex w-[110px] shrink-0 flex-col items-center justify-center gap-2 border-l border-theme-border-subtle bg-theme-bg-secondary/30 p-3">
                    <p className={cn(SECTION_KICKER, " text-center")}>
                      Imagen (Opcional)
                    </p>
                    <FormField
                      control={form.control}
                      name="imageUpload"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <FileUpload
                              endpoint="boardImage"
                              value={field.value || ""}
                              onChange={field.onChange}
                              uploadButtonClassName="rounded-none border-theme-border-subtle bg-theme-bg-cancel-button text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                            />
                          </FormControl>
                          <FormMessage className="-mt-1 text-[11px] leading-tight" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* TOGGLE PÚBLICO / PRIVADO */}
                <div className={cn("flex gap-2 p-1", PANEL_SHELL)}>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      form.setValue("isPrivate", false, {
                        shouldValidate: true,
                      })
                    }
                    className={cn(
                      "flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 rounded-none border px-3 text-[13px] transition",
                      !isPrivate
                        ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                        : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                    )}
                  >
                    <Globe className="h-4 w-4" />
                    <span className="text-xs font-medium">Público</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      form.setValue("isPrivate", true, { shouldValidate: true })
                    }
                    className={cn(
                      "flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 rounded-none border px-3 text-[13px] transition",
                      isPrivate
                        ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                        : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                    )}
                  >
                    <Lock className="h-4 w-4" />
                    <span className="text-xs font-medium">Privado</span>
                  </button>
                </div>
                <DialogFooter
                  className={cn(
                    "border-t border-theme-border bg-theme-bg-secondary/20 px-4 py-1.5",
                    PANEL_SHELL,
                  )}
                >
                  <div className="flex w-full flex-col-reverse items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-20">
                    <Button
                      type="button"
                      onClick={handleClose}
                      disabled={isLoading}
                      className="h-6.5 w-full cursor-pointer rounded-none bg-theme-bg-cancel-button text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light sm:w-auto"
                    >
                      {t.common.cancel}
                    </Button>
                    <Button
                      className="h-6.5 w-full cursor-pointer rounded-none bg-theme-tab-button-bg text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover sm:w-auto"
                      disabled={isLoading}
                      type="submit"
                    >
                      {t.modals.createBoard.createButton}
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
