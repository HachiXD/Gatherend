"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

function RequestListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 border border-theme-border bg-theme-bg-secondary/20 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)] animate-pulse"
        >
          <div className="h-8 w-8 shrink-0 border border-theme-border bg-white/10" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-3 w-1/3 bg-white/10" />
            <div className="h-2 w-1/2 bg-white/10" />
          </div>
          <div className="flex gap-1">
            <div className="h-6 w-6 bg-white/10" />
            <div className="h-6 w-6 bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
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
      <DialogContent
        className="max-w-[440px]! overflow-hidden rounded-none border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-none p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-6 pt-2">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.addFriend.title}
          </DialogTitle>
          <DialogDescription className="-mt-2 text-center text-[15px] text-theme-text-subtle">
            {t.modals.addFriend.subtitle}
          </DialogDescription>
        </DialogHeader>

        {/* Add friend form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 pb-3 ">
            <div className="space-y-2 bg-theme-bg-modal px-3 py-0 -mt-3.5">
              <Label
                htmlFor="add-friend-username"
                className="block uppercase text-[15px] font-bold text-theme-text-subtle mb-0.5"
              >
                {t.modals.addFriend.inputLabel}
              </Label>
              <Input
                id="add-friend-username"
                name="add-friend-username"
                disabled={sendRequestMutation.isPending}
                className="rounded-none border border-theme-border bg-theme-bg-edit-form/60 h-8 px-3 py-2 text-[14px] text-theme-text-primary focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder={t.modals.addFriend.inputPlaceholder}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />

              {/* Mensaje de éxito o error */}
              {message.type && (
                <div
                  className={`px-3 py-1 text-[13px] border ${
                    message.type === "success"
                      ? "border-theme-border-accent-active-channel bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  }`}
                >
                  <span className="font-medium">{message.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pending requests list */}
          <div className="scrollbar-ultra-thin max-h-[300px] space-y-2 overflow-y-auto px-4 pb-3">
            <div className="space-y-2 border border-theme-border-subtle bg-theme-bg-edit-form/30 px-3 py-2">
              <span className="block uppercase text-xs font-bold text-theme-text-subtle border-b border-theme-border-subtle pb-1">
                {t.modals.addFriend.pendingRequests}
                {pendingRequests.length > 0 && (
                  <span className="ml-1 text-theme-text-muted">
                    ({pendingRequests.length})
                  </span>
                )}
              </span>

              {isLoadingRequests ? (
                <RequestListSkeleton />
              ) : pendingRequests.length === 0 ? (
                <div className="border border-theme-border-subtle bg-theme-bg-edit-form/35 px-3 py-4 text-center text-sm text-theme-text-muted">
                  {t.modals.addFriend.noPendingRequests}
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-2 border border-theme-border bg-theme-bg-secondary/20 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(0,0,0,0.28)] transition hover:bg-theme-bg-tertiary/40"
                    >
                      <UserAvatar
                        src={request.requester.avatarAsset?.url || undefined}
                        profileId={request.requester.id}
                        showStatus={false}
                        className="h-8 w-8 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-theme-text-light">
                          {request.requester.username}
                          <span className="ml-1 text-xs text-theme-text-muted">
                            /{request.requester.discriminator}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          disabled={handleRequestMutation.isPending}
                          onClick={() =>
                            handleRequestMutation.mutate({
                              friendshipId: request.id,
                              action: "accept",
                            })
                          }
                          className="cursor-pointer p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={handleRequestMutation.isPending}
                          onClick={() =>
                            handleRequestMutation.mutate({
                              friendshipId: request.id,
                              action: "reject",
                            })
                          }
                          className="cursor-pointer p-1 text-theme-text-subtle opacity-100 transition hover:text-theme-text-light disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-theme-border bg-theme-bg-secondary/40 px-6 py-1.5">
            <Button
              type="button"
              variant="ghost"
              disabled={sendRequestMutation.isPending}
              onClick={handleClose}
              className="h-6.5 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            >
              {t.modals.addFriend.close}
            </Button>
            <Button
              type="submit"
              disabled={sendRequestMutation.isPending || !username.trim()}
              className="h-6.5 cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              <UserPlus className=" h-4 w-4" />
              {sendRequestMutation.isPending
                ? t.modals.addFriend.sending
                : t.modals.addFriend.sendRequest}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
