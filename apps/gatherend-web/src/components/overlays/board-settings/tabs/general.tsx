"use client";

import axios, { AxiosError } from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useBoardMutations } from "@/hooks/use-board-data";
import { toast } from "sonner";
import { Board, SlotMode } from "@prisma/client";
import { Crown, Globe, Mail } from "lucide-react";
import { useTranslation } from "@/i18n";

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
import { getBoardImageUrl, normalizeImageUrl } from "@/lib/avatar-utils";

interface GeneralTabProps {
  board: Board & {
    slots?: Array<{
      id: string;
      mode: SlotMode;
      memberId: string | null;
    }>;
  };
}

// MAX_SEATS = 48 porque el owner cuenta como 1, entonces 48 + 1 = 49 personas totales
const MAX_SEATS = 48;

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
    imageUrl: z.string().optional(),
    publicSeats: z.number().min(0).max(MAX_SEATS),
    invitationSeats: z.number().min(0).max(MAX_SEATS),
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
  const { t } = useTranslation();

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
      imageUrl: board.imageUrl || "",
      publicSeats: currentPublicSeats,
      invitationSeats: currentInvitationSeats,
    },
  });

  const watchedBoardName = form.watch("name");
  const publicSeats = form.watch("publicSeats");
  const invitationSeats = form.watch("invitationSeats");
  const totalSeats = publicSeats + invitationSeats;

  const cols = Math.max(2, Math.ceil(Math.sqrt(totalSeats + 1)));

  const boardImagePreviewUrl = getBoardImageUrl(
    board.imageUrl,
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
      // FileUpload stores a JSON string with metadata; the boards API expects a plain URL.
      const normalizedBoardImageUrl = normalizeImageUrl(values.imageUrl);

      await axios.patch(`/api/boards/${board.id}`, {
        name: values.name,
        imageUrl: normalizedBoardImageUrl,
        description: values.description,
      });

      // Si cambiaron los slots, hacer resize
      // Nota: invitationSeats en UI NO incluye el owner, pero el backend SÍ lo espera
      const newTotalSeats = values.publicSeats + values.invitationSeats;
      const currentTotalSeats = currentPublicSeats + currentInvitationSeats;

      if (
        newTotalSeats !== currentTotalSeats ||
        values.publicSeats !== currentPublicSeats
      ) {
        await axios.patch(`/api/boards/${board.id}/resize`, {
          discoveryCount: values.publicSeats,
          invitationCount: values.invitationSeats + 1, // +1 para incluir slot del owner
        });
      }

      // SPA: Actualizar cache local de React Query
      updateBoard({
        name: values.name,
        imageUrl: normalizedBoardImageUrl,
        description: values.description || null,
      });

      // Invalidar para sincronizar slots si cambiaron
      if (
        newTotalSeats !== currentTotalSeats ||
        values.publicSeats !== currentPublicSeats
      ) {
        invalidateBoard();
      }

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
    <div className="space-y-6 text-theme-text-subtle">
      <div>
        <h2 className="text-xl font-bold text-theme-text-light">
          {t.overlays.boardSettings.general.title}
        </h2>
        <p className="text-sm text-theme-text-muted">
          {t.overlays.boardSettings.general.subtitle}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* COLUMNA IZQUIERDA: Datos */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-center text-center">
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FileUpload
                          endpoint="boardImage"
                          value={field.value || boardImagePreviewUrl || ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="button"
                onClick={handleBump}
                disabled={isBumping}
                className="w-full bg-theme-button-primary hover:bg-theme-button-primary-hover text-theme-text-light cursor-pointer"
              >
                {isBumping
                  ? t.overlays.boardSettings.general.bumping
                  : t.overlays.boardSettings.general.bumpButton}
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel
                        htmlFor="board-general-name"
                        className="uppercase text-xs font-bold text-theme-text-subtle"
                      >
                        {t.overlays.boardSettings.general.boardNameLabel}
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="board-general-name"
                          disabled={isSaving}
                          className="bg-theme-bg-input border-0 focus-visible:ring-0 text-theme-text-light focus-visible:ring-offset-0 text-[15px]!"
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
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      htmlFor="board-general-description"
                      className="uppercase text-xs font-bold text-theme-text-subtle"
                    >
                      {t.overlays.boardSettings.general.descriptionLabel}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        id="board-general-description"
                        disabled={isSaving}
                        className="bg-theme-bg-input border-0 focus-visible:ring-0 text-theme-text-light focus-visible:ring-offset-0 resize-none text-[15px]! max-h-[120px] overflow-y-auto"
                        placeholder={
                          t.overlays.boardSettings.general
                            .descriptionPlaceholder
                        }
                        autoComplete="off"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* COLUMNA DERECHA: Sliders y Grid */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex flex-col gap-6 p-4 rounded-lg">
                <div className="space-y-2">
                  {/* PUBLIC SLIDER */}
                  <FormField
                    control={form.control}
                    name="publicSeats"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center -mb-1.5">
                          <span
                            id="board-general-public-seats-label"
                            className="text-xs font-bold text-[#5EC8D4] uppercase"
                          >
                            {
                              t.overlays.boardSettings.general
                                .discoverySeatsLabel
                            }
                          </span>
                          <span className="text-xs font-mono bg-theme-bg-quaternary text-[#5EC8D4] px-2 py-0.5 rounded">
                            {publicSeats}
                          </span>
                        </div>
                        <p className="text-theme-text-subtle text-[10px]">
                          {
                            t.overlays.boardSettings.general
                              .discoverySeatsDescription
                          }{" "}
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
                            className="[&>.relative>.absolute]:bg-[#5EC8D4]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* INVITE SLIDER */}
                  <FormField
                    control={form.control}
                    name="invitationSeats"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center -mb-1.5">
                          <span
                            id="board-general-invite-seats-label"
                            className="text-xs font-bold text-[#E4AE68] uppercase"
                          >
                            {t.overlays.boardSettings.general.inviteSeatsLabel}
                          </span>
                          <span className="text-xs font-mono bg-theme-bg-quaternary text-[#E4AE68] px-2 py-0.5 rounded">
                            {invitationSeats}
                          </span>
                        </div>
                        <p className="text-theme-text-subtle text-[10px]">
                          {
                            t.overlays.boardSettings.general
                              .inviteSeatsDescription
                          }{" "}
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
                            className="[&>.relative>.absolute]:bg-[#E4AE68]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* GRID VISUALIZER */}
                <div className="flex-1 min-h-[210px] bg-theme-bg-input rounded-md border border-dashed border-theme-border-primary flex items-center justify-center p-4">
                  <div
                    className="grid gap-2 place-items-center transition-all duration-300"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {/* OWNER (fijo, no configurable) */}
                    <div className="relative group">
                      <div className="rounded-full flex items-center justify-center h-7 w-7 bg-[#FFD7001A] text-[#FFD700] border border-[#FFD700]/30 shadow-sm">
                        <Crown className="w-4 h-4" />
                      </div>
                    </div>

                    {/* OTHER SEATS */}
                    {Array.from({ length: totalSeats }).map((_, i) => {
                      const isPublic = i < publicSeats;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "rounded-full flex items-center justify-center h-7 w-7 border shadow-sm transition-colors duration-300",
                            isPublic
                              ? "bg-[#5EC8D41A] text-[#5EC8D4] border-white/10"
                              : "bg-[#E4AE681A] text-[#E4AE68] border-white/10",
                          )}
                        >
                          {isPublic ? (
                            <Globe className="w-4 h-4" />
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-theme-tab-button-bg hover:bg-theme-tab-button-hover text-theme-text-light cursor-pointer"
            >
              {isSaving
                ? t.overlays.boardSettings.general.saving
                : t.overlays.boardSettings.general.saveChanges}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
