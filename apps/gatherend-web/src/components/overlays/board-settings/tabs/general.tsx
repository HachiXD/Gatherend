"use client";

import axios, { AxiosError } from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useBoardMutations } from "@/hooks/use-board-data";
import { useCommunitiesList } from "@/hooks/use-communities-list";
import { toast } from "sonner";
import { Board, SlotMode } from "@prisma/client";
import { Crown, Globe, Loader2, Mail, Search } from "lucide-react";
import { useTranslation } from "@/i18n";
import { CommunitySelectCard } from "@/components/ui/community-select-card";

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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { getBoardImageUrl } from "@/lib/avatar-utils";
import { parseStoredUploadValue } from "@/lib/upload-values";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

interface GeneralTabProps {
  board: Board & {
    imageAsset?: ClientUploadedAsset | null;
    slots?: Array<{
      id: string;
      mode: SlotMode;
      memberId: string | null;
    }>;
  };
}

// MAX_SEATS = 48 porque el owner cuenta como 1, entonces 48 + 1 = 49 personas totales
const MAX_SEATS = 48;
const PANEL_SHELL =
  "border border-theme-border bg-theme-bg-overlay-primary/78 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const SECTION_TITLE_CLASS =
  "border-b border-theme-border -mt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted";
const FIELD_KICKER =
  "text-[11px] font-bold uppercase tracking-[0.06em] text-theme-text-subtle";
const FIELD_INPUT_CLASS =
  "h-8 -mt-1.5 rounded-none border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light placeholder:text-theme-text-muted focus-visible:border-theme-border-subtle focus-visible:ring-0 focus-visible:ring-offset-0";
const FIELD_TEXTAREA_CLASS =
  "rounded-none -mt-1.5 border-theme-border-subtle bg-theme-bg-edit-form/50 text-theme-text-light placeholder:text-theme-text-muted focus-visible:border-theme-border-subtle focus-visible:ring-0 focus-visible:ring-offset-0";
const HEADER_PANEL_SHELL =
  "border border-theme-border bg-theme-bg-overlay-primary/78 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const HOVER_ACTION_BUTTON_CLASS =
  "flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-none border px-3 text-[14px] transition border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-active-border hover:bg-theme-channel-type-active-bg hover:text-theme-channel-type-active-text";

const schema = z
  .object({
    name: z
      .string()
      .min(2, { message: "Board name is required (min 2 chars)" })
      .max(50, { message: "Board name cannot exceed 50 characters" }),
    description: z
      .string()
      .max(300, { message: "Description cannot exceed 300 characters" })
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
      message: "Public groups must have at least 4 public slots",
      path: ["publicSeats"],
    },
  )
  .refine(
    (data) => {
      if (data.publicSeats > 0 && !data.communityId) {
        return false;
      }
      return true;
    },
    {
      message: "Public boards must be assigned to a community",
      path: ["communityId"],
    },
  )
  .refine(
    (data) => {
      if (data.publicSeats === 0 && data.communityId) {
        return false;
      }
      return true;
    },
    {
      message: "Private boards cannot be assigned to a community",
      path: ["communityId"],
    },
  );

type FormSchema = z.infer<typeof schema>;

type ModerationBlockedResponse = {
  error?: string;
  message?: string;
};

export const GeneralTab = ({ board }: GeneralTabProps) => {
  const { updateBoard, invalidateBoard } = useBoardMutations(board.id);
  const [isSaving, setIsSaving] = useState(false);
  const [isBumping, setIsBumping] = useState(false);
  const [communitySearch, setCommunitySearch] = useState("");
  const { t } = useTranslation();
  const {
    communities,
    isLoading: isLoadingCommunities,
    isFetching,
  } = useCommunitiesList(communitySearch);

  // Calcular slots TOTALES del board desde el prop (ocupados + vacíos)
  // El owner siempre tiene 1 slot BY_INVITATION, lo excluimos del conteo del slider
  const currentPublicSeats =
    board.slots?.filter((s) => s.mode === SlotMode.BY_DISCOVERY).length || 0;
  const rawInvitationSeats =
    board.slots?.filter((s) => s.mode === SlotMode.BY_INVITATION).length || 0;
  // Restar 1 para excluir el slot del owner (mínimo 0)
  const currentInvitationSeats = Math.max(0, rawInvitationSeats - 1);

  // Calcular slots OCUPADOS (mínimo permitido por cada slider)
  const occupiedPublicSeats =
    board.slots?.filter(
      (s) => s.mode === SlotMode.BY_DISCOVERY && s.memberId !== null,
    ).length || 0;
  // Para invitation, restamos 1 porque el owner siempre ocupa 1 slot
  const rawOccupiedInvitation =
    board.slots?.filter(
      (s) => s.mode === SlotMode.BY_INVITATION && s.memberId !== null,
    ).length || 0;
  const occupiedInvitationSeats = Math.max(0, rawOccupiedInvitation - 1);

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: board.name,
      description: board.description || "",
      imageUpload: "",
      publicSeats: currentPublicSeats,
      invitationSeats: currentInvitationSeats,
      communityId: board.communityId || undefined,
    },
  });

  const watchedBoardName = form.watch("name");
  const publicSeats = form.watch("publicSeats");
  const invitationSeats = form.watch("invitationSeats");
  const selectedCommunityId = form.watch("communityId");
  const totalSeats = publicSeats + invitationSeats;

  const cols = Math.max(2, Math.ceil(Math.sqrt(totalSeats + 1)));

  const boardImagePreviewUrl = getBoardImageUrl(
    board.imageAsset?.url,
    board.id,
    watchedBoardName || board.name,
    256,
  );

  //  LÓGICA DE BALANCEO  //
  // Basado en create-board-modal.tsx pero respetando slots ocupados
  const fixSeats = (pub: number, inv: number, touched: "pub" | "inv") => {
    let p = pub;
    let i = inv;
    const sum = p + i;

    if (sum > MAX_SEATS) {
      const overflow = sum - MAX_SEATS;
      if (touched === "pub") {
        i = Math.max(occupiedInvitationSeats, i - overflow);
        if (p + i > MAX_SEATS) p = Math.max(occupiedPublicSeats, MAX_SEATS - i);
      } else {
        p = Math.max(occupiedPublicSeats, p - overflow);
        if (p + i > MAX_SEATS)
          i = Math.max(occupiedInvitationSeats, MAX_SEATS - p);
      }
    }

    // Regla: si hay public slots, deben ser al menos 4
    // Si p está entre 1-3, decidir según quién tocó el slider
    if (p > 0 && p < 4) {
      if (touched === "pub") {
        // Usuario está subiendo public → subir a 4 y ajustar invitation
        p = 4;
        if (p + i > MAX_SEATS) {
          i = Math.max(occupiedInvitationSeats, MAX_SEATS - p);
        }
      } else {
        // Usuario está subiendo invitation → bajar public a 0
        // Pero respetar mínimo ocupado
        p = Math.max(0, occupiedPublicSeats);
        // Si ocupados fuerza p > 0 pero < 4, subir a 4
        if (p > 0 && p < 4) {
          p = 4;
          if (p + i > MAX_SEATS) {
            i = Math.max(occupiedInvitationSeats, MAX_SEATS - p);
          }
        }
      }
    }

    // Aplicar mínimos por ocupación al final
    p = Math.max(p, occupiedPublicSeats);
    i = Math.max(i, occupiedInvitationSeats);

    return { p, i };
  };

  //  BUMP  //
  const handleBump = async () => {
    try {
      setIsBumping(true);
      await axios.post(`/api/boards/${board.id}/refresh`);
      toast.success(t.overlays.boardSettings.general.bumpSuccess);
    } catch (error: unknown) {
      console.error(error);
      const axiosError = error as AxiosError<{ minutesLeft?: number }>;

      if (axiosError.response?.status === 429) {
        const minutesLeft = axiosError.response.data?.minutesLeft || 0;
        toast.error(
          t.overlays.boardSettings.general.bumpCooldown.replace(
            "{minutes}",
            String(minutesLeft),
          ),
        );
      } else {
        toast.error(t.overlays.boardSettings.general.bumpError);
      }
    } finally {
      setIsBumping(false);
    }
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

  //  SUBMIT  //
  const onSubmit = async (values: FormSchema) => {
    try {
      setIsSaving(true);

      // Actualizar información básica del board
      const imageUpload = parseStoredUploadValue(values.imageUpload);
      const imageAssetId = imageUpload?.assetId ?? null;

      await axios.patch(`/api/boards/${board.id}`, {
        name: values.name,
        imageAssetId,
        description: values.description,
        publicSeats: values.publicSeats,
        invitationSeats: values.invitationSeats,
        communityId: values.communityId ?? null,
      });

      updateBoard({
        name: values.name,
        imageAssetId,
        imageAsset: imageAssetId
          ? {
              id: imageAssetId,
              width: null,
              height: null,
              dominantColor: null,
              url: imageUpload?.url ?? boardImagePreviewUrl,
            }
          : null,
        description: values.description || null,
        communityId: values.communityId ?? null,
      });

      invalidateBoard();

      toast.success(t.overlays.boardSettings.general.updateSuccess);
    } catch (error: unknown) {
      console.error(error);

      const axiosError = error as AxiosError<ModerationBlockedResponse>;

      // Handle moderation errors specifically
      if (axiosError.response?.data?.error === "MODERATION_BLOCKED") {
        const message =
          axiosError.response.data.message ||
          "Content was blocked by moderation.";
        toast.error(message, {
          duration: 5000,
          description:
            t.overlays.boardSettings.general.moderationErrorDescription,
        });
      } else {
        toast.error(t.overlays.boardSettings.general.updateError);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-2 pb-10 text-theme-text-subtle">
      <div className={HEADER_PANEL_SHELL}>
        <div className="border-b border-theme-border pb-0.5 -mb-3 -mt-3">
          <h2 className="text-2xl font-bold text-theme-text-primary">
            {t.overlays.boardSettings.general.title}
          </h2>
          <p className="-mt-1 text-sm text-theme-text-tertiary">
            {t.overlays.boardSettings.general.subtitle}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <section className={PANEL_SHELL}>
            <div className="-mt-3 -mb-2.5 flex flex-col items-start gap-8 md:flex-row">
              <div className="w-full space-y-3 md:w-[200px] md:self-center">
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
                            previewUrl={boardImagePreviewUrl}
                            onChange={field.onChange}
                            uploadButtonClassName="rounded-none border-theme-border-subtle bg-theme-bg-cancel-button text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                          />
                        </FormControl>
                        <FormMessage className="-mt-1 text-[11px] leading-tight" />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleBump}
                  disabled={isBumping}
                  className={HOVER_ACTION_BUTTON_CLASS}
                >
                  {isBumping
                    ? t.overlays.boardSettings.general.bumping
                    : t.overlays.boardSettings.general.bumpButton}
                </Button>
              </div>

              <div className=" w-full flex-1 space-y-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="board-general-name"
                        className={FIELD_KICKER}
                      >
                        {t.overlays.boardSettings.general.boardNameLabel}
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="board-general-name"
                          disabled={isSaving}
                          className={cn(FIELD_INPUT_CLASS, "text-[14px]")}
                          placeholder={
                            t.overlays.boardSettings.general
                              .boardNamePlaceholder
                          }
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="board-general-description"
                        className={FIELD_KICKER}
                      >
                        {t.overlays.boardSettings.general.descriptionLabel}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          id="board-general-description"
                          disabled={isSaving}
                          className={cn(
                            FIELD_TEXTAREA_CLASS,
                            "scrollbar-ultra-thin max-h-[120px] resize-none overflow-y-auto px-3 py-2 text-[14px]",
                          )}
                          placeholder={
                            t.overlays.boardSettings.general
                              .descriptionPlaceholder
                          }
                          autoComplete="off"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          <section className={PANEL_SHELL}>
            <div className="mx-auto grid -mb-2 w-full max-w-[860px] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_252px]">
              <div className="space-y-3">
                <h3 className={SECTION_TITLE_CLASS}>
                  {t.modals.myCommunities.community}
                </h3>

                <FormField
                  control={form.control}
                  name="communityId"
                  render={() => (
                    <FormItem className="space-y-3">
                      <div className="relative">
                        <label
                          htmlFor="board-general-community-search"
                          className="sr-only"
                        >
                          {t.modals.myCommunities.searchPlaceholder}
                        </label>
                        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text-muted" />
                        <Input
                          id="board-general-community-search"
                          name="board-general-community-search"
                          value={communitySearch}
                          onChange={(e) => setCommunitySearch(e.target.value)}
                          placeholder={t.modals.myCommunities.searchPlaceholder}
                          autoComplete="off"
                          className={cn(
                            FIELD_INPUT_CLASS,
                            "bg-theme-bg-edit-form/35 pl-8 pr-8 text-sm",
                          )}
                        />
                        {isFetching && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-theme-accent-primary" />
                          </div>
                        )}
                      </div>

                      <div className="px-4 -mt-2.5 -mb-3">
                        <div className="w-full border-b border-theme-border" />
                      </div>

                      <div className="scrollbar-ultra-thin max-h-[220px] -mt-1.5 mb-0 space-y-1.5 overflow-y-auto border border-theme-border-subtle bg-theme-bg-edit-form/35 p-1.5">
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
                              "border-theme-border cursor-pointer bg-theme-bg-secondary/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)]",
                              !selectedCommunityId
                                ? "border-theme-border-accent-active-channel bg-theme-bg-secondary/40 text-theme-text-light"
                                : "text-theme-text-subtle hover:bg-theme-bg-secondary/30 hover:text-theme-text-light",
                            )}
                          >
                            Sin comunidad
                          </button>
                        )}

                        {isLoadingCommunities ? (
                          <div className="space-y-1.5">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 border border-theme-border-subtle bg-theme-bg-edit-form/50 px-2 py-1.5 animate-pulse"
                              >
                                <div className="h-8 w-8 bg-white/10" />
                                <div className="h-4 flex-1 bg-white/10" />
                              </div>
                            ))}
                          </div>
                        ) : communities.length === 0 ? (
                          <div className="py-4 text-center text-sm text-theme-text-muted">
                            {communitySearch
                              ? t.modals.myCommunities.noResults
                              : t.modals.myCommunities.noCommunities}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {communities.map((community) => (
                              <CommunitySelectCard
                                key={community.id}
                                community={community}
                                isSelected={
                                  selectedCommunityId === community.id
                                }
                                onClick={() =>
                                  form.setValue("communityId", community.id, {
                                    shouldValidate: true,
                                  })
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <FormMessage className="-mt-1 text-[11px] leading-tight" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex w-full flex-col gap-2 lg:w-[252px] lg:flex-shrink-0">
                <div className="border border-theme-border bg-theme-bg-secondary/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)]">
                  <div className="space-y-2 lg:mx-auto lg:w-full lg:max-w-[252px]">
                    <FormField
                      control={form.control}
                      name="publicSeats"
                      render={({ field }) => (
                        <FormItem className="space-y-0 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-2.5 pt-1.5 pb-2.5">
                          <div className="flex justify-between items-center -mb-2.5">
                            <span
                              id="board-general-public-seats-label"
                              className="text-xs font-bold uppercase text-[#5EC8D4]"
                            >
                              {
                                t.overlays.boardSettings.general
                                  .discoverySeatsLabel
                              }
                            </span>
                            <span className="border border-[#5EC8D4]/25 bg-theme-bg-overlay-primary px-2 py-0.5 font-mono text-xs text-[#5EC8D4]">
                              {publicSeats}
                            </span>
                          </div>
                          <p className="text-theme-text-subtle text-[10px]">
                            {
                              t.overlays.boardSettings.general
                                .discoverySeatsDescription
                            }
                          </p>
                          <FormControl>
                            <Slider
                              name="publicSeats"
                              disabled={isSaving}
                              min={occupiedPublicSeats}
                              max={MAX_SEATS}
                              step={1}
                              value={[field.value]}
                              onValueChange={(v) => onPublicChange(v[0])}
                              aria-labelledby="board-general-public-seats-label"
                              className="cursor-pointer [&_[data-slot=slider-range]]:bg-[#5EC8D4] [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:rounded-none [&_[data-slot=slider-thumb]]:border-theme-border [&_[data-slot=slider-thumb]]:bg-theme-bg-overlay-primary [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:rounded-none [&_[data-slot=slider-track]]:bg-theme-bg-input-modal"
                            />
                          </FormControl>
                          <FormMessage className="-my-1 text-[11px] leading-tight" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="invitationSeats"
                      render={({ field }) => (
                        <FormItem className="space-y-0 rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/50 px-2.5 pt-1.5 pb-2.5">
                          <div className="flex justify-between items-center -mb-2.5">
                            <span
                              id="board-general-invite-seats-label"
                              className="text-xs font-bold uppercase text-[#E4AE68]"
                            >
                              {
                                t.overlays.boardSettings.general
                                  .inviteSeatsLabel
                              }
                            </span>
                            <span className="border border-[#E4AE68]/25 bg-theme-bg-overlay-primary px-2 py-0.5 font-mono text-xs text-[#E4AE68]">
                              {invitationSeats}
                            </span>
                          </div>
                          <p className="text-theme-text-subtle text-[10px]">
                            {
                              t.overlays.boardSettings.general
                                .inviteSeatsDescription
                            }
                          </p>
                          <FormControl>
                            <Slider
                              name="invitationSeats"
                              disabled={isSaving}
                              min={occupiedInvitationSeats}
                              max={MAX_SEATS}
                              step={1}
                              value={[field.value]}
                              onValueChange={(v) => onInviteChange(v[0])}
                              aria-labelledby="board-general-invite-seats-label"
                              className="cursor-pointer [&_[data-slot=slider-range]]:bg-[#E4AE68] [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:rounded-none [&_[data-slot=slider-thumb]]:border-theme-border [&_[data-slot=slider-thumb]]:bg-theme-bg-overlay-primary [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:rounded-none [&_[data-slot=slider-track]]:bg-theme-bg-input-modal"
                            />
                          </FormControl>
                          <FormMessage className="-my-1 text-[11px] leading-tight" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-2.5 mx-auto flex min-h-[170px] w-full max-w-[220px] self-center items-center justify-center border border-theme-border bg-theme-bg-edit-form/50 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)] sm:min-h-[220px] sm:p-4">
                    <div
                      className="grid gap-2 place-items-center -my-2.5 -mx-2.5 transition-all duration-300"
                      style={{
                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                      }}
                    >
                      <div className="relative group">
                        <div className="rounded-full flex items-center justify-center h-5.5 w-5.5 bg-[#FFD7001A] text-[#FFD700] border border-[#FFD700]/30 shadow-sm">
                          <Crown className="w-3.5 h-3.5" />
                        </div>
                      </div>

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
          </section>

          <section className={PANEL_SHELL}>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSaving}
                className="h-6.5 min-w-[120px] -my-3 cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover"
              >
                {isSaving
                  ? t.overlays.boardSettings.general.saving
                  : t.overlays.boardSettings.general.saveChanges}
              </Button>
            </div>
          </section>
        </form>
      </Form>
    </div>
  );
};
