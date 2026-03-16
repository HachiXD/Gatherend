"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, UserPlus, X } from "lucide-react";
import { useState } from "react";
import axios from "axios";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/user-avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useFriendRequestSocket } from "@/hooks/use-friend-request-socket";
import { useTranslation } from "@/i18n";
import type { ClientProfileSummary } from "@/types/uploaded-assets";

interface PendingRequest {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  createdAt: string;
  requester: ClientProfileSummary & {
    fullUsername: string;
  };
}

export const AddFriendModal = () => {
  const { isOpen, onClose, type } = useModal();
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "addFriend";

  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({ type: null, text: "" });

  // Escuchar eventos de socket para friend requests (actualización en tiempo real)
  useFriendRequestSocket({
    profileId: profile?.id || "",
  });

  // Query para solicitudes pendientes
  const { data: pendingRequests = [], isLoading: isLoadingRequests } = useQuery(
    {
      queryKey: ["friendRequests", "pending"],
      queryFn: async () => {
        const response = await axios.get<PendingRequest[]>(
          "/api/friends/pending",
        );
        return response.data;
      },
      enabled: isModalOpen && !!profile,
      staleTime: 1000 * 30, // 30 segundos
    },
  );

  // Mutation para enviar solicitud de amistad
  const sendRequestMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await axios.post("/api/friends/request", { name });
      return response.data;
    },
    onSuccess: (data) => {
      setMessage({
        type: "success",
        text: data.message || "Friend request sent!",
      });
      setUsername("");
      setTimeout(() => {
        setMessage({ type: null, text: "" });
      }, 2000);
    },
    onError: (error: unknown) => {
      const errorMessage =
        (
          error as {
            response?: { data?: { message?: string; error?: string } };
          }
        ).response?.data?.message ||
        (
          error as {
            response?: { data?: { message?: string; error?: string } };
          }
        ).response?.data?.error ||
        "Something went wrong";
      setMessage({ type: "error", text: errorMessage });
    },
  });

  // Mutation para aceptar/rechazar solicitud
  const handleRequestMutation = useMutation({
    mutationFn: async ({
      friendshipId,
      action,
    }: {
      friendshipId: string;
      action: "accept" | "reject";
    }) => {
      await axios.patch(`/api/friends/${friendshipId}`, { action });
      return { friendshipId, action };
    },
    onSuccess: ({ action }) => {
      // Invalidar queries para refrescar datos (paradigma SPA client-side)
      queryClient.invalidateQueries({
        queryKey: ["friendRequests", "pending"],
      });
      queryClient.invalidateQueries({ queryKey: ["friends"] });

      if (action === "accept") {
        // Invalidar conversaciones para que aparezca la nueva conversación
        // El socket también notificará para actualización en tiempo real
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    },
    onError: (error) => {
      console.error("[HANDLE_FRIEND_REQUEST]", error);
    },
  });

  const handleClose = () => {
    setUsername("");
    setMessage({ type: null, text: "" });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setMessage({
        type: "error",
        text: t.modals.addFriend.enterUsername,
      });
      return;
    }

    sendRequestMutation.mutate(username.trim());
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-theme-bg-modal !max-w-[400px] text-theme-text-subtle p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.addFriend.title}
          </DialogTitle>
          <DialogDescription className="text-center text-[15px] text-theme-text-subtle">
            {t.modals.addFriend.subtitle}
            <br />
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 flex-1 overflow-hidden flex flex-col mt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="add-friend-username"
                className="uppercase text-[15px] font-bold text-theme-text-subtle"
              >
                {t.modals.addFriend.inputLabel}
              </Label>
              <Input
                id="add-friend-username"
                name="add-friend-username"
                disabled={sendRequestMutation.isPending}
                className="bg-theme-bg-input-modal border-0 focus-visible:ring-0 text-theme-text-light focus-visible:ring-offset-0 !text-[15px]"
                placeholder={t.modals.addFriend.inputPlaceholder}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Mensaje de éxito o error */}
            {message.type && (
              <div
                className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                  message.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {message.type === "success" && <Check className="w-4 h-4" />}
                <span>{message.text}</span>
              </div>
            )}

            <div className="flex justify-center pt-2">
              <Button
                type="submit"
                disabled={sendRequestMutation.isPending || !username.trim()}
                className="bg-theme-tab-button-bg hover:bg-theme-tab-button-hover cursor-pointer text-theme-text-light w-full"
              >
                {sendRequestMutation.isPending ? (
                  t.modals.addFriend.sending
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t.modals.addFriend.sendRequest}
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Lista de solicitudes pendientes */}
          <div className="mt-6 overflow-hidden flex flex-col border-t border-theme-border-secondary pt-4">
            <h3 className="text-sm font-semibold text-theme-text-subtle mb-3 uppercase">
              {t.modals.addFriend.pendingRequests}{" "}
              {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </h3>

            <ScrollArea className="h-[400px] pr-4 -mr-4">
              {isLoadingRequests ? (
                <div className="text-sm text-theme-text-tertiary py-4 text-center">
                  {t.modals.addFriend.loading}
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-sm text-theme-text-tertiary py-4 text-center">
                  {t.modals.addFriend.noPendingRequests}
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 bg-theme-bg-modal rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={request.requester.avatarAsset?.url || undefined}
                          showStatus={false}
                          className="h-8 w-8 md:h-8 md:w-8"
                        />
                        <div>
                          <p className="text-sm font-medium text-theme-text-primary">
                            {request.requester.username}
                            <span className="text-theme-text-tertiary text-xs ml-1">
                              /{request.requester.discriminator}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-emerald-500/10 hover:text-emerald-400"
                          disabled={handleRequestMutation.isPending}
                          onClick={() =>
                            handleRequestMutation.mutate({
                              friendshipId: request.id,
                              action: "accept",
                            })
                          }
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-rose-500/10 hover:text-rose-400"
                          disabled={handleRequestMutation.isPending}
                          onClick={() =>
                            handleRequestMutation.mutate({
                              friendshipId: request.id,
                              action: "reject",
                            })
                          }
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Botón Cancel abajo del todo */}
        <div className="p-6 pt-0 bg-theme-bg-modal">
          <Button
            type="button"
            variant="ghost"
            disabled={sendRequestMutation.isPending}
            onClick={handleClose}
            className="w-full bg-theme-bg-cancel-button hover:bg-theme-bg-cancel-button-hover cursor-pointer text-theme-text-subtle hover:text-theme-text-light"
          >
            {t.modals.addFriend.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
