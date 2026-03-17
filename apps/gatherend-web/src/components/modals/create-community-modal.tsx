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
        className={`bg-theme-bg-modal text-theme-text-subtle overflow-hidden p-0 max-w-md! ${stackAbove ? "z-[10001]" : ""}`}
        overlayClassName={stackAbove ? "z-[10001]" : undefined}
      >
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold text-theme-text-light">
            Crear Comunidad
          </DialogTitle>
          <DialogDescription className="text-center text-theme-text-subtle">
            Las comunidades agrupan boards relacionados
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-6 px-6">
              {/* Image Upload */}
              <div className="flex items-center justify-center">
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-theme-text-subtle">
                      Nombre de la comunidad
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="bg-theme-bg-input-modal border-0 focus-visible:ring-0 text-theme-text-light focus-visible:ring-offset-0 text-[15px]!"
                        placeholder="Mi comunidad"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="bg-theme-bg-secondary px-6 py-4">
              <Button
                disabled={isLoading}
                className="w-full cursor-pointer bg-theme-button-primary hover:bg-theme-button-hover text-white"
                type="submit"
              >
                {isLoading ? "Creando..." : "Crear comunidad"}
              </Button>
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
