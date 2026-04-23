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
          className="flex items-center gap-2.5 rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-2.5 py-2.5 animate-pulse"
        >
          <div className="h-8 w-8 shrink-0 rounded-full border border-theme-border bg-white/10" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-3 w-1/3 rounded bg-white/10" />
            <div className="h-2 w-1/2 rounded bg-white/10" />
          </div>
          <div className="flex gap-1.5">
            <div className="h-8 w-8 rounded-md bg-white/10" />
            <div className="h-8 w-8 rounded-md bg-white/10" />
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
  const fieldLabelClassName =
    "text-[11px] font-semibold uppercase tracking-[0.08em] text-theme-text-subtle";

  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({ type: null, text: "" });

  useFriendRequestSocket({
    profileId: profile?.id || "",
  });

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
      staleTime: 1000 * 30,
    },
  );

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
      queryClient.invalidateQueries({
        queryKey: ["friendRequests", "pending"],
      });
      queryClient.invalidateQueries({ queryKey: ["friends"] });

      if (action === "accept") {
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
        className="max-w-[460px]! overflow-hidden rounded-lg border border-theme-border bg-theme-bg-modal p-0 text-theme-text-subtle"
        closeButtonClassName="cursor-pointer rounded-md p-1 text-theme-text-subtle opacity-100 transition hover:bg-theme-bg-cancel-button hover:text-theme-text-light data-[state=open]:bg-transparent data-[state=open]:text-theme-text-subtle focus:ring-0 focus:ring-offset-0 focus:outline-none"
      >
        <DialogHeader className="px-5 pt-5 -mt-2">
          <DialogTitle className="text-[22px] font-medium leading-none text-theme-text-primary">
            {t.modals.addFriend.title}
          </DialogTitle>
          <DialogDescription className="pt-1 text-[14px] leading-5 text-theme-text-subtle">
            {t.modals.addFriend.subtitle}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3 px-5 pt-0 pb-4">
            <div className="rounded-lg border border-theme-border bg-theme-bg-edit-form/35 p-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="add-friend-username"
                  className={fieldLabelClassName}
                >
                  {t.modals.addFriend.inputLabel}
                </Label>
                <Input
                  id="add-friend-username"
                  name="add-friend-username"
                  disabled={sendRequestMutation.isPending}
                  className="h-9 rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-3 py-2 text-[14px] text-theme-text-primary focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder={t.modals.addFriend.inputPlaceholder}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {message.type && (
                <div
                  className={`mt-2 rounded-lg border px-3 py-2 text-[13px] ${
                    message.type === "success"
                      ? "border-theme-border-accent-active-channel bg-theme-channel-type-active-soft-bg text-theme-channel-type-active-text"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  }`}
                >
                  <span className="font-medium">{message.text}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-theme-border bg-theme-bg-edit-form/35 p-2.5">
              <div className="flex items-center justify-between gap-2 border-b border-theme-border px-0.5 pb-2">
                <span className={fieldLabelClassName}>
                  {t.modals.addFriend.pendingRequests}
                </span>
                <span className="text-[12px] text-theme-text-muted">
                  {pendingRequests.length}
                </span>
              </div>

              <div className="scrollbar-ultra-thin mt-2 max-h-[260px] overflow-y-auto pr-1">
                {isLoadingRequests ? (
                  <RequestListSkeleton />
                ) : pendingRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-theme-border bg-theme-bg-edit-form/55 px-3 py-5 text-center text-sm text-theme-text-muted">
                    {t.modals.addFriend.noPendingRequests}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center gap-2.5 rounded-lg border border-theme-border bg-theme-bg-edit-form/60 px-2.5 py-2 transition hover:bg-theme-bg-secondary/45"
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
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            disabled={handleRequestMutation.isPending}
                            onClick={() =>
                              handleRequestMutation.mutate({
                                friendshipId: request.id,
                                action: "accept",
                              })
                            }
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-theme-border bg-theme-channel-type-active-soft-bg text-theme-channel-type-active-text transition hover:bg-theme-channel-type-active-bg hover:text-theme-text-light disabled:cursor-not-allowed disabled:opacity-50"
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
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-theme-border bg-theme-bg-cancel-button text-theme-text-subtle transition hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>

          <DialogFooter className="border-t border-theme-border px-5 py-1">
            <Button
              type="button"
              variant="ghost"
              disabled={sendRequestMutation.isPending}
              onClick={handleClose}
              className="h-7 cursor-pointer rounded-lg bg-theme-bg-cancel-button px-3 text-[14px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
            >
              {t.common.close}
            </Button>
            <Button
              type="submit"
              disabled={sendRequestMutation.isPending || !username.trim()}
              className="h-7 cursor-pointer rounded-lg bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light hover:bg-theme-tab-button-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              <UserPlus className="h-4 w-4" />
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
