"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useModal } from "@/hooks/use-modal-store";
import { useEffect } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COMMUNITIES_FEED_KEY,
  type CommunityFeedItem,
} from "@/hooks/discovery/community-feed/use-communities-feed";
import { getStoredUploadAssetId } from "@/lib/upload-values";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

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
import { cn } from "@/lib/utils";

const PANEL_SHELL = "border border-theme-border bg-theme-bg-secondary/20";

const schema = z.object({
  name: z
    .string()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" })
    .max(32, { message: "El nombre no puede exceder 32 caracteres" }),
  imageUpload: z.string().optional(),
});

type FormSchema = z.infer<typeof schema>;
type CreateCommunityPayload = {
  name: string;
  imageAssetId: string | null;
};

const DEFAULTS: FormSchema = {
  name: "",
  imageUpload: "",
};

// Componente interno reutilizable

interface CreateCommunityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (community: {
    id: string;
    name: string;
    imageAsset: ClientUploadedAsset | null;
  }) => void;
  /** When true, uses higher z-index to stack over other modals */
  stackAbove?: boolean;
}

export function CreateCommunityDialog({
  isOpen,
  onClose,
  onSuccess,
  stackAbove = false,
}: CreateCommunityDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      form.reset(DEFAULTS);
    }
  }, [isOpen, form]);

  const { mutate: createCommunity, isPending: isLoading } = useMutation({
    mutationFn: async (values: CreateCommunityPayload) => {
      const response = await axios.post("/api/communities", values);
      return response.data as {
        id: string;
        name: string;
        imageAsset: ClientUploadedAsset | null;
      };
    },
    onSuccess: (newCommunity) => {
      toast.success("Comunidad creada exitosamente");

      // Optimistic update para infinite query structure
      queryClient.setQueryData<{
        pages: Array<{
          items: CommunityFeedItem[];
          nextCursor: string | null;
          hasMore: boolean;
        }>;
        pageParams: (string | null)[];
      }>(COMMUNITIES_FEED_KEY, (oldData) => {
        if (!oldData || oldData.pages.length === 0) return oldData;

        const exists = oldData.pages.some((page) =>
          page.items.some((c) => c.id === newCommunity.id),
        );
        if (exists) return oldData;

        const newCommunityItem: CommunityFeedItem = {
          id: newCommunity.id,
          name: newCommunity.name,
          imageAsset: newCommunity.imageAsset,
          description: null,
          memberCount: 1,
          boardCount: 0,
          recentPostCount7d: 0,
        };

        return {
          ...oldData,
          pages: oldData.pages.map((page, index) =>
            index === 0
              ? { ...page, items: [newCommunityItem, ...page.items] }
              : page,
          ),
        };
      });

      // Invalidar communities-list para el selector
      queryClient.invalidateQueries({ queryKey: ["communities-list"] });

      // Callback opcional
      onSuccess?.(newCommunity);

      handleClose();
    },
    onError: (error: unknown) => {
      console.error("[CREATE_COMMUNITY_ERROR]", error);
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.response?.data;
        toast.error(message || "Error al crear la comunidad");
      } else {
        toast.error("Error al crear la comunidad");
      }
    },
  });

  const handleClose = () => {
    form.reset(DEFAULTS);
    onClose();
  };

  const onSubmit = (values: FormSchema) => {
    createCommunity({
      name: values.name,
      imageAssetId: getStoredUploadAssetId(values.imageUpload),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "max-w-[440px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle",
          stackAbove && "z-10001",
        )}
        overlayClassName={stackAbove ? "z-[10001]" : undefined}
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className=" bg-theme-bg-secondary/20 px-6 pb-1 pt-2">
          <DialogTitle className="text-2xl text-center font-bold">
            Crear Comunidad
          </DialogTitle>
          <DialogDescription className="-mt-1 text-center text-[15px] text-theme-text-subtle">
            Las comunidades agrupan personas alrededor de un tema
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="px-4 -mb-0.5 space-y-0">
              {/* Image Upload Panel */}
              <div className={cn("p-3 -mb-1 -mt-3.5", PANEL_SHELL)}>
                <div className="uppercase text-[15px] font-bold text-theme-text-subtle mb-2">
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
                            endpoint="communityImage"
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

              {/* Name Panel */}
              <div className="space-y-3 p-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel
                        htmlFor="create-community-name"
                        className="uppercase text-[15px] font-bold text-theme-text-subtle -mb-1.5"
                      >
                        Nombre de la comunidad
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="create-community-name"
                          disabled={isLoading}
                          className="rounded-none border border-theme-border bg-theme-bg-edit-form/60 h-8 px-3 py-2 text-[14px] text-theme-text-light focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="Mi comunidad"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="-mt-1 text-[11px] leading-tight" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="border-t border-theme-border bg-theme-bg-secondary/40 px-6 py-1.5">
              <div className="flex items-center justify-end gap-2 w-full">
                <Button
                  type="button"
                  disabled={isLoading}
                  onClick={handleClose}
                  variant="ghost"
                  className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
                >
                  Cancelar
                </Button>
                <Button
                  className="h-6.5 cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isLoading}
                  type="submit"
                >
                  {isLoading ? "Creando..." : "Crear comunidad"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Modal global (usa el store)

export const CreateCommunityModal = () => {
  const { isOpen, onClose, type } = useModal();
  const isModalOpen = isOpen && type === "createCommunity";

  return <CreateCommunityDialog isOpen={isModalOpen} onClose={onClose} />;
};
