"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useModal } from "@/hooks/use-modal-store";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { useNavigationStore } from "@/hooks/use-navigation-store";
import { useTranslation } from "@/i18n";
import { useCommunitiesList } from "@/hooks/use-communities-list";
import { CommunitySelectCard } from "@/components/ui/community-select-card";
import { Loader2, Search, Plus } from "lucide-react";
import { CreateCommunityDialog } from "@/components/modals/create-community-modal";

// Skeleton for community list loading
function CommunityListSkeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 animate-pulse",
            PANEL_SHELL,
          )}
        >
          <div className="h-8 w-8 bg-white/10" />
          <div className="h-4 flex-1 bg-white/10" />
        </div>
      ))}
    </div>
  );
}

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
import { Slider } from "../ui/slider";
import { Textarea } from "../ui/textarea";
import { detectBoardLanguages } from "@/lib/detect-language";
import { Crown, Globe, Mail } from "lucide-react";
import { getStoredUploadAssetId } from "@/lib/upload-values";

// CONSTANTES CENTRALIZADAS
// MAX_SEATS = 48 porque el owner cuenta como 1, entonces 48 + 1 = 49 personas totales
const MAX_SEATS = 48;
const PANEL_SHELL =
  "border border-theme-border bg-theme-bg-secondary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)]";
const FIELD_SURFACE =
  "rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50";
const SECTION_KICKER =
  "text-[11px] -my-1 font-bold uppercase tracking-[0.08em] text-theme-text-subtle";

const schema = z
  .object({
    name: z
      .string()
      .min(2, { message: "El nombre debe tener al menos 2 caracteres" })
      .max(50, { message: "El nombre no puede exceder 50 caracteres" }),
    description: z
      .string()
      .max(300, { message: "La descripción no puede exceder 300 caracteres" })
      .optional(),
    imageUpload: z.string().optional(),
    publicSeats: z.number().min(0).max(MAX_SEATS),
    invitationSeats: z.number().min(0).max(MAX_SEATS),
    communityId: z.string().optional(),
  })
  .refine(
    (data) => {
      // If there are public slots, must have at least 4 public slots
      // This prevents isolation/bullying in small public groups
      if (data.publicSeats > 0 && data.publicSeats < 4) {
        return false;
      }
      return true;
    },
    {
      message: "Los grupos públicos deben tener al menos 4 slots públicos",
      path: ["publicSeats"],
    },
  )
  .refine(
    (data) => {
      // If there are public slots, must have a community selected
      if (data.publicSeats > 0 && !data.communityId) {
        return false;
      }
      return true;
    },
    {
      message: "Tu grupo es público, debes elegir una comunidad",
      path: ["communityId"],
    },
  );

type FormSchema = z.infer<typeof schema>;

// Defaults centralizados (no duplicados)
const DEFAULTS: FormSchema = {
  name: "",
  description: "",
  imageUpload: "",
  publicSeats: 0,
  invitationSeats: 4,
  communityId: undefined,
};

export const CreateBoardModal = () => {
  const { isOpen, onClose, type } = useModal();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Estado local para el mini-modal de crear comunidad (aparece encima)
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);

  // Usar el store global de navegación (funciona desde fuera del BoardSwitchProvider)
  const { switchBoard, isNavigationReady } = useNavigationStore();

  // Communities list - ahora con búsqueda server-side
  const [communitySearch, setCommunitySearch] = useState("");
  const {
    communities,
    isLoading: isLoadingCommunities,
    isFetching,
  } = useCommunitiesList(communitySearch);

  const isModalOpen = isOpen && type === "createBoard";

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  // Reset con defaults REALMENTE alineados
  useEffect(() => {
    if (isModalOpen) {
      form.reset(DEFAULTS);
      setCommunitySearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen]);

  const publicSeats = form.watch("publicSeats");
  const invitationSeats = form.watch("invitationSeats");
  const totalSeats = publicSeats + invitationSeats;

  const cols = Math.max(2, Math.ceil(Math.sqrt(totalSeats + 1)));

  //  LÓGICA DE BALANCEO  //
  const fixSeats = (pub: number, inv: number, touched: "pub" | "inv") => {
    let p = pub;
    let i = inv;
    const sum = p + i;

    if (sum > MAX_SEATS) {
      const overflow = sum - MAX_SEATS;
      if (touched === "pub") {
        i = Math.max(0, i - overflow);
        if (p + i > MAX_SEATS) p = MAX_SEATS - i;
      } else {
        p = Math.max(0, p - overflow);
        if (p + i > MAX_SEATS) i = MAX_SEATS - p;
      }
    }

    // Regla: si hay public slots, deben ser al menos 4
    // Si p está entre 1-3, decidir según quién tocó el slider
    if (p > 0 && p < 4) {
      if (touched === "pub") {
        // Usuario está subiendo public → subir a 4 y ajustar invitation
        p = 4;
        if (p + i > MAX_SEATS) {
          i = MAX_SEATS - p;
        }
      } else {
        // Usuario está subiendo invitation → bajar public a 0
        p = 0;
      }
    }

    return { p, i };
  };

  const onPublicChange = (v: number) => {
    const { p, i } = fixSeats(v, form.getValues("invitationSeats"), "pub");
    form.setValue("publicSeats", p, { shouldValidate: true });
    form.setValue("invitationSeats", i, { shouldValidate: true });
  };

  const onInviteChange = (v: number) => {
    const { p, i } = fixSeats(form.getValues("publicSeats"), v, "inv");
    form.setValue("publicSeats", p, { shouldValidate: true });
    form.setValue("invitationSeats", i, { shouldValidate: true });
  };

  //  MUTATION con TanStack Query  //
  const createBoardMutation = useMutation({
    mutationFn: async (values: FormSchema) => {
      const boardData = {
        name: values.name,
        description: values.description,
        publicSeats: values.publicSeats,
        invitationSeats: values.invitationSeats,
        communityId: values.communityId,
        imageAssetId: getStoredUploadAssetId(values.imageUpload),
        languages: detectBoardLanguages(),
      };
      const response = await axios.post("/api/boards", boardData);
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(t.modals.createBoard.success);
      form.reset(DEFAULTS);
      onClose();

      // Invalidar queries para actualizar el navigation sidebar y discovery feed
      queryClient.invalidateQueries({ queryKey: ["user-boards"] });
      queryClient.invalidateQueries({ queryKey: ["discovery-feed"] });
      queryClient.invalidateQueries({ queryKey: ["communities-feed"] });
      // Invalidar boards de la comunidad específica si se seleccionó una
      const createdCommunityId =
        (data?.communityId as string | null | undefined) ??
        variables.communityId;
      if (createdCommunityId) {
        queryClient.invalidateQueries({
          queryKey: ["community-boards-feed", createdCommunityId],
        });
      }

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
      queryClient.invalidateQueries({ queryKey: ["discovery-feed"] });
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
      <DialogContent className="sm:[&>button]:hidden max-w-5xl! max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle sm:max-h-none sm:overflow-hidden">
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
            <div className="grid gap-4 px-4 pb-3 pt-0 -mt-1 sm:px-6 md:grid-cols-[220px_minmax(0,1.42fr)_252px] md:items-start">
              {/* COLUMNA IZQUIERDA: Comunidades */}
              <FormField
                control={form.control}
                name="communityId"
                render={() => (
                  <FormItem
                    className={cn(
                      "flex w-full flex-col gap-3 p-3 md:w-auto md:shrink-0",
                      PANEL_SHELL,
                    )}
                  >
                    <div className={SECTION_KICKER}>Comunidad (opcional)</div>

                    {/* Buscador */}
                    <div className="relative">
                      <label htmlFor="community-search" className="sr-only">
                        Buscar comunidad
                      </label>
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-text-muted" />
                      <Input
                        id="community-search"
                        name="community-search"
                        placeholder="Buscar..."
                        value={communitySearch}
                        onChange={(e) => setCommunitySearch(e.target.value)}
                        autoComplete="off"
                        className="h-8 rounded-none border border-theme-border-subtle bg-transparent pl-8 pr-8 text-sm text-theme-text-light focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      {/* Indicador de búsqueda en progreso */}
                      {isFetching && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-theme-accent-primary" />
                        </div>
                      )}
                    </div>

                    {/* Lista de communities */}
                    <div className="scrollbar-ultra-thin max-h-[168px] flex-1 space-y-1.5 overflow-y-auto border border-theme-border bg-theme-bg-tertiary/20 p-1.5 sm:max-h-[220px] md:min-h-[265px] md:max-h-[265px]">
                      {isLoadingCommunities ? (
                        <CommunityListSkeleton />
                      ) : communities.length === 0 ? (
                        <div className="text-center py-4 text-sm text-theme-text-muted">
                          {communitySearch
                            ? "Sin resultados"
                            : "No hay comunidades"}
                        </div>
                      ) : (
                        <>
                          {/* Opción "Sin comunidad" - solo mostrar si no hay búsqueda activa */}
                          {!communitySearch.trim() && (
                            <button
                              type="button"
                              onClick={() =>
                                form.setValue("communityId", undefined, {
                                  shouldValidate: true,
                                })
                              }
                              className={cn(
                                "w-full border px-2 py-1.5 text-left text-sm transition",
                                "border-theme-border cursor-pointer bg-theme-bg-secondary/20 hover:bg-theme-bg-tertiary/40 hover:text-theme-text-light shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)]",
                                !form.watch("communityId")
                                  ? "border-theme-accent-primary bg-theme-accent-primary/12 text-theme-text-light"
                                  : "text-theme-text-subtle",
                              )}
                            >
                              Sin comunidad
                            </button>
                          )}

                          {/* Etiqueta de sección */}
                          {!communitySearch.trim() && (
                            <div className="border-t border-theme-border pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-theme-text-muted">
                              Más populares
                            </div>
                          )}

                          {communities.map((community) => (
                            <CommunitySelectCard
                              key={community.id}
                              community={community}
                              isSelected={
                                form.watch("communityId") === community.id
                              }
                              onClick={() =>
                                form.setValue("communityId", community.id, {
                                  shouldValidate: true,
                                })
                              }
                            />
                          ))}
                        </>
                      )}
                    </div>

                    {/* Botón crear nueva comunidad */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6.5 w-full cursor-pointer rounded-none border-theme-border-subtle bg-theme-bg-cancel-button text-[12px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                      onClick={() => setIsCreateCommunityOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Nueva comunidad
                    </Button>

                    <FormMessage className="-my-1 text-[11px] leading-tight" />
                  </FormItem>
                )}
              />

              {/* COLUMNA CENTRAL: Datos del Board */}
              <div className="flex-[1.5] space-y-3">
                <div className={cn("p-3", PANEL_SHELL)}>
                  <div className={cn(SECTION_KICKER, "mb-2")}>
                    Imagen (opcional)
                  </div>
                  <div className="flex items-center justify-center text-center">
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

                <div className={cn("space-y-4 p-3", PANEL_SHELL)}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
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
                              "scrollbar-ultra-thin max-h-[120px] resize-none overflow-y-auto px-3 py-2 text-[15px] text-theme-text-light focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0",
                            )}
                            placeholder={t.modals.createBoard.tellUsMore}
                            autoComplete="off"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="-mt-1 text-[11px] leading-tight" />
                      </FormItem>
                    )}
                  />
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

              {/* COLUMNA DERECHA: Sliders y Grid */}
              <div className="flex w-full flex-col gap-2 md:w-[252px] md:flex-shrink-0">
                <div className={cn("flex flex-col gap-5 p-3", PANEL_SHELL)}>
                  <div className="space-y-2 md:mx-auto md:w-full md:max-w-[252px]">
                    {/* PUBLIC SLIDER */}
                    <FormField
                      control={form.control}
                      name="publicSeats"
                      render={({ field }) => (
                        <FormItem
                          className={cn(
                            "space-y-0 px-2.5 pt-1.5 pb-2.5",
                            FIELD_SURFACE,
                          )}
                        >
                          <div className="flex justify-between items-center -mb-2.5">
                            <span
                              id="create-board-public-seats-label"
                              className="text-xs font-bold uppercase text-[#5EC8D4]"
                            >
                              {t.modals.createBoard.publicSeats}
                            </span>
                            <span className="border border-[#5EC8D4]/25 bg-theme-bg-input-modal px-2 py-0.5 font-mono text-xs text-[#5EC8D4]">
                              {publicSeats}
                            </span>
                          </div>
                          <p className="text-theme-text-subtle text-[10px]">
                            {t.modals.createBoard.publicSeatsDescription}
                          </p>
                          <FormControl>
                            <Slider
                              name="publicSeats"
                              disabled={isLoading}
                              min={0}
                              max={MAX_SEATS}
                              step={1}
                              value={[field.value]}
                              onValueChange={(v) => onPublicChange(v[0])}
                              aria-labelledby="create-board-public-seats-label"
                              className="cursor-pointer [&_[data-slot=slider-range]]:bg-[#5EC8D4] [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:rounded-none [&_[data-slot=slider-thumb]]:border-theme-border [&_[data-slot=slider-thumb]]:bg-theme-bg-modal [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:rounded-none [&_[data-slot=slider-track]]:bg-theme-bg-input-modal"
                            />
                          </FormControl>
                          <FormMessage className="-my-1 text-[11px] leading-tight" />
                        </FormItem>
                      )}
                    />

                    {/* INVITE SLIDER */}
                    <FormField
                      control={form.control}
                      name="invitationSeats"
                      render={({ field }) => (
                        <FormItem
                          className={cn(
                            "space-y-0 px-2.5 pt-1.5 pb-2.5",
                            FIELD_SURFACE,
                          )}
                        >
                          <div className="flex justify-between items-center -mb-2.5">
                            <span
                              id="create-board-invite-seats-label"
                              className="text-xs font-bold uppercase text-[#E4AE68]"
                            >
                              {t.modals.createBoard.inviteSeats}
                            </span>
                            <span className="border border-[#E4AE68]/25 bg-theme-bg-input-modal px-2 py-0.5 font-mono text-xs text-[#E4AE68]">
                              {invitationSeats}
                            </span>
                          </div>
                          <p className="text-theme-text-subtle text-[10px]">
                            {t.modals.createBoard.inviteSeatsDescription}
                          </p>
                          <FormControl>
                            <Slider
                              name="invitationSeats"
                              disabled={isLoading}
                              min={0}
                              max={MAX_SEATS}
                              step={1}
                              value={[field.value]}
                              onValueChange={(v) => onInviteChange(v[0])}
                              aria-labelledby="create-board-invite-seats-label"
                              className="cursor-pointer [&_[data-slot=slider-range]]:bg-[#E4AE68] [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:rounded-none [&_[data-slot=slider-thumb]]:border-theme-border [&_[data-slot=slider-thumb]]:bg-theme-bg-modal [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:rounded-none [&_[data-slot=slider-track]]:bg-theme-bg-input-modal"
                            />
                          </FormControl>
                          <FormMessage className="-my-1 text-[11px] leading-tight" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* GRID VISUALIZER */}
                  <div className="-mt-2.5 flex min-h-[170px] w-full max-w-[220px] self-center items-center justify-center border border-theme-border bg-theme-bg-edit-form/50 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)] sm:min-h-[220px] sm:p-4">
                    <div
                      className="grid gap-2 place-items-center -my-2.5 -mx-2.5 transition-all duration-300"
                      style={{
                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                      }}
                    >
                      {/* OWNER (fijo, no configurable) */}
                      <div className="relative group">
                        <div className="rounded-full flex items-center justify-center h-5.5 w-5.5 bg-[#FFD7001A] text-[#FFD700] border border-[#FFD700]/30 shadow-sm">
                          <Crown className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* OTHER SEATS */}
                      {Array.from({ length: totalSeats }).map((_, i) => {
                        const isPublic = i < publicSeats;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "rounded-full flex items-center justify-center h-5.5 w-5.5 border shadow-sm transition-colors duration-300",
                              isPublic
                                ? "bg-[#5EC8D41A] text-[#5EC8D4] border-white/10"
                                : "bg-[#E4AE681A] text-[#E4AE68] border-white/10",
                            )}
                          >
                            {isPublic ? (
                              <Globe className="w-3.5 h-3.5" />
                            ) : (
                              <Mail className="w-3.5 h-3.5" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>

      {/* Mini-modal de crear comunidad (aparece encima con z-index mayor) */}
      <CreateCommunityDialog
        isOpen={isCreateCommunityOpen}
        onClose={() => setIsCreateCommunityOpen(false)}
        onSuccess={(newCommunity) => {
          // Auto-seleccionar la comunidad recién creada
          form.setValue("communityId", newCommunity.id, {
            shouldValidate: true,
          });
        }}
        stackAbove
      />
    </Dialog>
  );
};
