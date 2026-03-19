"use client";

import axios from "axios";
import qs from "query-string";
import type {
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Plus, Loader2, FileIcon, Send } from "lucide-react";
import { EmojiPicker } from "@/components/emoji-picker";
import { StickerPicker } from "@/components/sticker-picker";
import { MentionAutocomplete } from "@/components/chat/mention-autocomplete";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { useOptimisticMessages } from "@/hooks/use-optimistic-messages";
import { useMessageRetryStore } from "@/hooks/use-message-retry";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { useReplyStore } from "@/hooks/use-reply-store";
import { X } from "lucide-react";
import { useUploadWithProfile } from "@/hooks/use-upload";
import { toast } from "sonner";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { BoardMember } from "@/components/providers/board-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n";
import {
  FormattedConversation,
  conversationsQueryKey,
} from "@/hooks/use-conversations";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAxiosConfig } from "@/lib/express-fetch";
import { logger } from "@/lib/logger";
import type {
  ClientAttachmentAsset,
  ClientSticker,
} from "@/types/uploaded-assets";

interface ChatInputProps {
  apiUrl: string;
  query: Record<string, string>;
  name: string;
  type: "conversation" | "channel";
  currentProfile: ClientProfile;
  chatQueryKey: string[];
  roomId: string; // channelId or conversationId
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // Keep in sync with Express multer limit

type TypingApi = {
  startTyping: () => void;
  stopTyping: () => void;
};

function TypingIndicatorBridge({
  roomId,
  roomType,
  currentProfileId,
  onTypingText,
  onTypingApi,
}: {
  roomId: string;
  roomType: "channel" | "conversation";
  currentProfileId: string;
  onTypingText: (typingText: string) => void;
  onTypingApi: (api: TypingApi) => void;
}) {
  const { typingText, startTyping, stopTyping } = useTypingIndicator({
    roomId,
    roomType,
    currentProfileId,
  });

  const onTypingTextRef = useRef(onTypingText);
  const onTypingApiRef = useRef(onTypingApi);

  useEffect(() => {
    onTypingTextRef.current = onTypingText;
  }, [onTypingText]);

  useEffect(() => {
    onTypingApiRef.current = onTypingApi;
  }, [onTypingApi]);

  useEffect(() => {
    onTypingApiRef.current({ startTyping, stopTyping });
  }, [startTyping, stopTyping]);

  useEffect(() => {
    onTypingTextRef.current(typingText);
  }, [typingText]);

  return null;
}

const ChatInputComponent = ({
  apiUrl,
  query,
  name,
  type,
  currentProfile,
  chatQueryKey,
  roomId,
}: ChatInputProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitTriggeredByPointerDownRef = useRef(false);
  const lastSubmitOriginRef = useRef<"send_button" | "enter_key" | null>(null);
  const shouldRefocusAfterSubmitRef = useRef(false);
  const submitFromSendButtonRef = useRef<() => void>(() => {});
  const sendButtonElRef = useRef<HTMLButtonElement | null>(null);
  const sendButtonTouchStartHandlerRef = useRef<
    ((ev: TouchEvent) => void) | null
  >(null);
  const typingApiRef = useRef<TypingApi>({
    startTyping: () => {},
    stopTyping: () => {},
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingFile, setIsSendingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(() => {
    const mq = window.matchMedia?.("(max-width: 420px)");
    return mq?.matches ?? false;
  });
  const [content, setContent] = useState("");
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  const commitContent = useCallback((next: string) => {
    contentRef.current = next;
    setContent(next);
  }, []);
  const [filePreview, setFilePreview] = useState<{
    assetId: string;
    url: string;
    type: string;
    name: string;
    size: number;
    width?: number;
    height?: number;
  } | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const scheduleFocusInput = useCallback((delayMs = 0) => {
    setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      if (document.activeElement === input) return;
      input.focus();
    }, delayMs);
  }, []);

  const focusInputPreventScroll = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
  }, []);

  // Auth for HTTP calls
  const getToken = useTokenGetter();

  // Determine upload context based on chat type
  const uploadContext =
    type === "conversation" ? "dm_attachment" : "message_attachment";
  const uploadOptions = useMemo(
    () => ({
      onModerationBlock: (reason: string) => {
        toast.error(reason);
      },
      onUploadError: (error: string) => {
        toast.error(`Upload failed: ${error}`);
      },
    }),
    [],
  );
  const { startUpload, isUploading: uploadInProgress } = useUploadWithProfile(
    uploadContext,
    currentProfile.id,
    uploadOptions,
  );

  const { addOptimisticMessage, confirmOptimisticMessage } =
    useOptimisticMessages();
  const setRetryData = useMessageRetryStore((state) => state.setRetryData);
  const removeRetryData = useMessageRetryStore(
    (state) => state.removeRetryData,
  );

  const [typingText, setTypingText] = useState("");
  const handleTypingText = useCallback((next: string) => {
    setTypingText((prev) => (Object.is(prev, next) ? prev : next));
  }, []);
  const handleTypingApi = useCallback((api: TypingApi) => {
    typingApiRef.current = api;
  }, []);

  const startTyping = useCallback(() => {
    typingApiRef.current.startTyping();
  }, []);
  const stopTyping = useCallback(() => {
    typingApiRef.current.stopTyping();
  }, []);

  const replyingTo = useReplyStore((state) => state.replyingTo);
  const replyRoomId = useReplyStore((state) => state.roomId);
  const clearReply = useReplyStore((state) => state.clearReply);
  const focusTrigger = useReplyStore((state) => state.focusTrigger);
  const triggerScroll = useScrollToBottom((state) => state.triggerScroll);
  const queryClient = useQueryClient();
  const { t, locale } = useTranslation();

  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 420px)");
    if (!mq) return;
    const update = () => {
      const next = mq.matches;
      setIsNarrowScreen((prev) => (Object.is(prev, next) ? prev : next));
    };
    mq.addEventListener?.("change", update);
    // Safari < 14
    mq.addListener?.(update);
    return () => {
      mq.removeEventListener?.("change", update);
      mq.removeListener?.(update);
    };
  }, []);

  const setSendButtonEl = useCallback((el: HTMLButtonElement | null) => {
    const prevEl = sendButtonElRef.current;
    const prevHandler = sendButtonTouchStartHandlerRef.current;

    if (prevEl && prevHandler) {
      prevEl.removeEventListener("touchstart", prevHandler);
    }

    sendButtonElRef.current = el;
    sendButtonTouchStartHandlerRef.current = null;

    if (!el) return;

    const onTouchStart = (ev: TouchEvent) => {
      if (submitTriggeredByPointerDownRef.current) return;

      lastSubmitOriginRef.current = "send_button";
      shouldRefocusAfterSubmitRef.current =
        document.activeElement === inputRef.current;
      submitTriggeredByPointerDownRef.current = true;
      setTimeout(() => {
        submitTriggeredByPointerDownRef.current = false;
      }, 500);

      ev.preventDefault();
      submitFromSendButtonRef.current();
    };

    sendButtonTouchStartHandlerRef.current = onTouchStart;
    el.addEventListener("touchstart", onTouchStart, { passive: false });
  }, []);

  const prevCauseRef = useRef<{
    getToken: unknown;
    startUpload: unknown;
    startTyping: unknown;
    stopTyping: unknown;
    locale: string;
    typingText: string;
    uploadInProgress: boolean;
    replyRoomId: string | null;
    focusTrigger: number;
  } | null>(null);

  const currentCause = {
    getToken,
    startUpload,
    startTyping,
    stopTyping,
    locale,
    typingText,
    uploadInProgress,
    replyRoomId,
    focusTrigger,
  };

  const changedCause: string[] = [];
  const prevCause = prevCauseRef.current;

  if (!prevCause || prevCause.getToken !== currentCause.getToken)
    changedCause.push("getTokenRef");
  if (!prevCause || prevCause.startUpload !== currentCause.startUpload)
    changedCause.push("startUploadRef");
  if (!prevCause || prevCause.startTyping !== currentCause.startTyping)
    changedCause.push("startTypingRef");
  if (!prevCause || prevCause.stopTyping !== currentCause.stopTyping)
    changedCause.push("stopTypingRef");
  if (!prevCause || prevCause.locale !== currentCause.locale)
    changedCause.push("locale");
  if (!prevCause || prevCause.typingText !== currentCause.typingText)
    changedCause.push("typingText");
  if (
    !prevCause ||
    prevCause.uploadInProgress !== currentCause.uploadInProgress
  )
    changedCause.push("uploadInProgress");
  if (!prevCause || prevCause.replyRoomId !== currentCause.replyRoomId)
    changedCause.push("replyRoomId");
  if (!prevCause || prevCause.focusTrigger !== currentCause.focusTrigger)
    changedCause.push("focusTrigger");

  if (changedCause.length > 0) {
  }

  prevCauseRef.current = currentCause;

  // Helper to update conversation lastMessage cache
  const updateConversationLastMessage = (
    content: string,
    attachmentAsset: ClientAttachmentAsset | null = null,
  ) => {
    if (type !== "conversation") return;

    queryClient.setQueryData<FormattedConversation[]>(
      conversationsQueryKey,
      (oldConversations) => {
        if (!oldConversations) return oldConversations;

        // Encontrar la conversación
        const convIndex = oldConversations.findIndex(
          (conv) => conv.id === roomId,
        );
        if (convIndex === -1) return oldConversations;

        // Actualizar la conversación con el nuevo lastMessage
        const updatedConv: FormattedConversation = {
          ...oldConversations[convIndex],
          lastMessage: {
            content,
            attachmentAsset,
            deleted: false,
            senderId: currentProfile.id,
          },
          updatedAt: new Date(),
        };

        // Remover de su posición actual y añadir al inicio
        const filtered = oldConversations.filter((conv) => conv.id !== roomId);
        return [updatedConv, ...filtered];
      },
    );
  };

  // Clear reply if room changes
  useEffect(() => {
    if (replyRoomId && replyRoomId !== roomId) {
      clearReply();
    }
    return () => {};
  }, [roomId, replyRoomId, clearReply]);

  // Focus input when reply is triggered
  useEffect(() => {
    if (focusTrigger > 0 && replyRoomId === roomId) {
      scheduleFocusInput(50);
    }
    return () => {};
  }, [focusTrigger, replyRoomId, roomId, scheduleFocusInput]);

  const isReplyingInThisRoom = replyingTo && replyRoomId === roomId;

  const isLoading = isSubmitting;

  const resetTextareaHeight = () => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = "48px";
  };

  const resizeTextareaToFit = () => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 225) + "px";
  };

  const submitComposer = async () => {
    // If there's a file preview, send the file instead
    if (filePreview) {
      await handleSendFile();
      return;
    }

    const draft = inputRef.current?.value ?? contentRef.current;
    const trimmed = draft.trim();
    if (!trimmed) {
      lastSubmitOriginRef.current = null;
      return;
    }

    // Stop typing indicator
    stopTyping();

    // Limpiar el input y liberar inmediatamente
    commitContent("");

    // Reset textarea height to original size
    resetTextareaHeight();

    // Only re-focus if the user was already typing (keyboard open). If the textarea was blurred
    // and the user taps "Send", we should submit without re-opening the keyboard.
    const shouldRefocusAfterSubmit = shouldRefocusAfterSubmitRef.current;
    shouldRefocusAfterSubmitRef.current = false;
    if (shouldRefocusAfterSubmit) {
      focusInputPreventScroll();
      scheduleFocusInput();
    }
    lastSubmitOriginRef.current = null;

    // Agregar mensaje optimista con estilo gris
    const tempId = addOptimisticMessage(chatQueryKey, trimmed, currentProfile);

    // Store retry data in case message fails
    setRetryData(tempId, {
      tempId,
      content: trimmed,
      apiUrl,
      query,
      profileId: currentProfile.id,
      queryKey: chatQueryKey,
      replyToId: isReplyingInThisRoom && replyingTo ? replyingTo.id : undefined,
    });

    // Jump to recent so the optimistic message is actually visible even if the user
    // was reading older pages (historic mode).
    triggerScroll();

    try {
      const url = qs.stringifyUrl({
        url: apiUrl,
        query,
      });

      const payload: { content: string; tempId: string; replyToId?: string } = {
        content: trimmed,
        tempId,
      };

      // Add replyToId if replying
      if (isReplyingInThisRoom && replyingTo) {
        payload.replyToId = replyingTo.id;
      }

      const token = await getToken();
      await axios
        .post(url, payload, getExpressAxiosConfig(currentProfile.id, token))
        .then((response) => {
          // Use HTTP response to confirm the message immediately
          // This prevents the race condition where socket event arrives late
          if (response.data) {
            // Defer so React Query flushes the optimistic update first (otherwise the
            // optimistic message can be replaced before a paint and never be seen).
            setTimeout(() => {
              confirmOptimisticMessage(chatQueryKey, tempId, response.data);
            }, 0);
          }
        });

      // Clear reply after sending
      if (isReplyingInThisRoom) {
        clearReply();
      }

      // Update conversation lastMessage cache for SPA preview
      updateConversationLastMessage(trimmed);

      // Remove retry data on success
      removeRetryData(tempId);
    } catch (error) {
      console.error(error);
      // Keep the optimistic message - it will be marked as failed after timeout
      // Don't remove retry data - we need it for retry
    }
  };

  const submitWithGuard = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submitComposer();
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, submitComposer]);

  submitFromSendButtonRef.current = () => {
    void submitWithGuard();
  };

  const handleSendButtonPointerDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    // Prevent the button from stealing focus from the textarea on mobile.
    // Otherwise the keyboard closes briefly (viewport jumps) and then reopens when we re-focus.
    lastSubmitOriginRef.current = "send_button";
    shouldRefocusAfterSubmitRef.current =
      document.activeElement === inputRef.current;
    submitTriggeredByPointerDownRef.current = true;
    setTimeout(() => {
      submitTriggeredByPointerDownRef.current = false;
    }, 500);
    e.preventDefault();
    submitFromSendButtonRef.current();
  };

  const handleSendButtonClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    // Avoid double-submit (pointerdown -> click).
    if (submitTriggeredByPointerDownRef.current) {
      submitTriggeredByPointerDownRef.current = false;
      e.preventDefault();
      return;
    }

    e.preventDefault();
    lastSubmitOriginRef.current = "send_button";
    shouldRefocusAfterSubmitRef.current =
      document.activeElement === inputRef.current;
    submitFromSendButtonRef.current();
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const res = await startUpload(Array.from(files));
      const file = res?.[0];

      if (file) {
        // Set file preview instead of sending immediately
        setFilePreview({
          assetId: file.assetId,
          url: file.url,
          type: file.type,
          name: file.name,
          size: file.size,
          width: file.width,
          height: file.height,
        });
      }
    } catch (error) {
      console.error("File upload failed:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePastedImageUpload = async (file: File) => {
    if (isUploading || uploadInProgress || isSendingFile) {
      toast.message(
        t.chat.uploadInProgress || "Upload already in progress. Please wait.",
      );
      return;
    }

    if (filePreview) {
      toast.error(
        t.chat.oneAttachmentAtATime || "Only one attachment at a time",
      );
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `${t.chat.uploadTooLarge || "File too large"} (${(
          file.size /
          1024 /
          1024
        ).toFixed(
          1,
        )} MB, max ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} MB)`,
      );
      return;
    }

    setIsUploading(true);
    try {
      const res = await startUpload([file]);
      const uploaded = res?.[0];
      if (uploaded) {
        // Pasted images should be uploaded + sent immediately (no preview).
        const fileToSend = {
          assetId: uploaded.assetId,
          url: uploaded.url,
          type: uploaded.type,
          name: uploaded.name,
          size: uploaded.size,
          width: uploaded.width,
          height: uploaded.height,
        };

        // Keep typing indicator consistent with "message sent" behavior,
        // but do not clear the current draft content.
        stopTyping();

        setIsSendingFile(true);
        triggerScroll();
        try {
          const url = qs.stringifyUrl({
            url: apiUrl,
            query,
          });

          const token = await getToken();
          await axios.post(
            url,
            {
              attachmentAssetId: fileToSend.assetId,
              content: fileToSend.name,
            },
            getExpressAxiosConfig(currentProfile.id, token),
          );

          // Update conversation lastMessage cache for SPA preview
          updateConversationLastMessage(fileToSend.name, {
            id: fileToSend.assetId,
            mimeType: fileToSend.type,
            sizeBytes: fileToSend.size,
            width: fileToSend.width ?? null,
            height: fileToSend.height ?? null,
            originalName: fileToSend.name,
            url: fileToSend.url,
          });
        } catch (error) {
          console.error("Pasted image send failed:", error);
          // Fall back to preview so the user can retry sending manually.
          setFilePreview(fileToSend);
          toast.error(t.chat.sendFailed || "Send failed");
        } finally {
          setIsSendingFile(false);
        }
      }
    } catch (error) {
      console.error("Pasted image upload failed:", error);
      toast.error(t.chat.uploadFailed || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendFile = async () => {
    if (!filePreview || isSendingFile) return;

    // Stop typing indicator + reset input (keep consistent with text messages)
    // Capture draft so we can restore it on failure.
    const draftContent = inputRef.current?.value ?? contentRef.current;
    stopTyping();
    commitContent("");

    resetTextareaHeight();

    focusInputPreventScroll();
    scheduleFocusInput();
    lastSubmitOriginRef.current = null;

    // Immediately set sending state and clear preview to prevent multiple clicks
    setIsSendingFile(true);
    const fileToSend = filePreview;
    setFilePreview(null);

    // Trigger scroll to bottom
    triggerScroll();

    try {
      const url = qs.stringifyUrl({
        url: apiUrl,
        query,
      });

      const token = await getToken();
      await axios.post(
        url,
        {
          attachmentAssetId: fileToSend.assetId,
          content: fileToSend.name,
        },
        getExpressAxiosConfig(currentProfile.id, token),
      );

      // Update conversation lastMessage cache for SPA preview
      updateConversationLastMessage(fileToSend.name, {
        id: fileToSend.assetId,
        mimeType: fileToSend.type,
        sizeBytes: fileToSend.size,
        width: fileToSend.width ?? null,
        height: fileToSend.height ?? null,
        originalName: fileToSend.name,
        url: fileToSend.url,
      });
    } catch (error) {
      console.error("File send failed:", error);
      // Restore file preview on error so user can retry
      setFilePreview(fileToSend);

      if (draftContent) {
        commitContent(draftContent);
        setTimeout(() => {
          resizeTextareaToFit();
        }, 0);
      }
    } finally {
      setIsSendingFile(false);
    }
  };

  const handleCancelFile = () => {
    setFilePreview(null);
  };

  const handleStickerSubmit = async (sticker: ClientSticker) => {
    // Reset typing state so the next keystroke can re-trigger typing-start
    stopTyping();
    const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    // Mobile: keep keyboard open.
    // Desktop: restore focus to the textarea so the sticker popover closes (previous UX).
    if (isCoarsePointer) {
      scheduleFocusInput();
    } else {
      focusInputPreventScroll();
      scheduleFocusInput(0);
    }

    // Optimistic update
    const tempId = addOptimisticMessage(
      chatQueryKey,
      "",
      currentProfile,
      sticker,
    );

    // Store retry data
    setRetryData(tempId, {
      tempId,
      content: "",
      sticker,
      apiUrl,
      query,
      profileId: currentProfile.id,
      queryKey: chatQueryKey,
    });

    // Trigger scroll to bottom
    triggerScroll();

    try {
      const url = qs.stringifyUrl({
        url: apiUrl,
        query,
      });

      const token = await getToken();
      await axios
        .post(
          url,
          { stickerId: sticker.id, tempId },
          getExpressAxiosConfig(currentProfile.id, token),
        )
        .then((response) => {
          // Use HTTP response to confirm the message immediately
          if (response.data) {
            // Defer so the optimistic message can paint before being replaced.
            setTimeout(() => {
              confirmOptimisticMessage(chatQueryKey, tempId, response.data);
            }, 0);
          }
        });

      // Update conversation lastMessage cache for SPA preview (stickers show as [Sticker])
      updateConversationLastMessage(`[Sticker: ${sticker.name}]`);

      // Remove retry data on success
      removeRetryData(tempId);
    } catch (error) {
      console.error(error);
      // Keep the optimistic message - it will be marked as failed after timeout
    }
  };

  // Handle mention selection
  const handleMentionSelect = (
    member: BoardMember,
    startIndex: number,
    endIndex: number,
  ) => {
    const currentValue = inputRef.current?.value ?? contentRef.current;
    // Format: @[username]/[discriminator]
    const mentionText = `@[${member.profile.username}]/[${member.profile.discriminator}] `;
    const newValue =
      currentValue.substring(0, startIndex) +
      mentionText +
      currentValue.substring(endIndex);

    commitContent(newValue);

    // Update cursor position and focus
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = startIndex + mentionText.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos);
      }
    }, 0);
  };

  return (
    <>
      <TypingIndicatorBridge
        roomId={roomId}
        roomType={type}
        currentProfileId={currentProfile.id}
        onTypingText={handleTypingText}
        onTypingApi={handleTypingApi}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="mt-2"
      >
        {/* Reply Preview - Outside relative container to affect layout flow */}
        {isReplyingInThisRoom && replyingTo && (
          <div className="border-t border-theme-border-primary bg-theme-bg-tertiary p-2 px-5 flex items-center justify-between rounded-none">
            <div className="flex-1 text-sm min-w-0">
              <span className="font-semibold text-theme-text-secondary">
                {t.chat.replyingTo} {replyingTo.sender.username}
              </span>
              <p className="text-[13px] text-theme-text-tertiary truncate break-words">
                {replyingTo.sticker
                  ? `🎨 ${t.chat.sticker}`
                  : replyingTo.attachmentAsset
                    ? `📎 ${replyingTo.fileName || t.chat.file}`
                    : replyingTo.content.length > 50
                      ? replyingTo.content.substring(0, 50) + "..."
                      : replyingTo.content}
              </p>
            </div>
            <button
              type="button"
              onClick={clearReply}
              className="text-theme-accent-light hover:text-theme-accent-hover cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div
          className="relative px-0 pt-[13px] pb-2 mr-4"
          suppressHydrationWarning
        >
          {/* Typing Indicator - Absolute overlay, doesn't affect layout */}
          {typingText && (
            <div className="absolute -top-2 left-4 right-4 pointer-events-none z-10">
              <div className="bg-theme-bg-tertiary/95 backdrop-blur-sm px-2 py-0.5">
                <p className="text-[11px] text-theme-text-tertiary italic truncate">
                  {typingText}
                </p>
              </div>
            </div>
          )}

          {/* File Preview */}
          {filePreview && (
            <div className="absolute -top-26 left-4 right-4 border border-theme-border-primary bg-theme-bg-secondary p-3 shadow-lg rounded-none">
              <div className="flex items-start gap-3">
                {/* Preview Thumbnail */}
                {filePreview.type.startsWith("image/") ? (
                  <div className="relative h-20 w-20 overflow-hidden flex-shrink-0 rounded-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={filePreview.url}
                      alt={filePreview.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : (
                  <div className="h-20 w-20 flex items-center justify-center bg-theme-bg-secondary flex-shrink-0 rounded-none">
                    <FileIcon className="h-10 w-10 text-theme-text-tertiary" />
                  </div>
                )}

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-text-primary truncate">
                    {filePreview.name}
                  </p>
                  <p className="text-xs text-theme-text-tertiary">
                    {filePreview.type.startsWith("image/")
                      ? t.chat.image
                      : t.chat.pdf}{" "}
                    • {(filePreview.size / 1024).toFixed(1)} KB
                  </p>
                  <p className="text-xs text-theme-text-muted mt-1">
                    {t.chat.pressEnterToSend}
                  </p>
                </div>

                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={handleCancelFile}
                  className="flex-shrink-0 cursor-pointer text-theme-text-tertiary hover:text-theme-text-secondary transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Mention Autocomplete - Only for channels */}
          {type === "channel" && (
            <MentionAutocomplete
              inputValue={content}
              cursorPosition={cursorPosition}
              onSelect={handleMentionSelect}
              inputRef={inputRef}
              isOpen={mentionOpen}
              setIsOpen={setMentionOpen}
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,.pdf"
          />
          <div className="flex items-stretch gap-2 pl-2.5 pr-2 mx-3 py-3 border border-theme-border-subtle -mt-2 mb-0.5">
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-6 w-6 bg-theme-chat-input-icon hover:bg-theme-chat-input-icon-hover transition rounded-full cursor-pointer
    p-1 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 text-theme-bg-primary animate-spin" />
                ) : (
                  <Plus className="text-theme-bg-input-plus" />
                )}
              </button>
            </div>

            <div className="min-w-0 flex-1 border border-theme-border-subtle bg-theme-bg-quaternary focus-within:border-theme-border-accent">
              <textarea
                aria-disabled={isLoading}
                className="w-full bg-transparent px-3 pt-4 pb-2 -mt-2.5 -mb-2.5 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none
                  text-theme-text-secondary text-[14px] placeholder:text-theme-text-muted
                  resize-none overflow-y-auto min-h-[48px] max-h-[225px] rounded-none"
                placeholder={
                  isNarrowScreen
                    ? t.chat.messagePlaceholderShort
                    : `${t.chat.message} ${type === "conversation" ? name : "/" + name}`
                }
                rows={1}
                value={content}
                ref={inputRef}
                onChange={(e) => {
                  const textarea = e.target;
                  const newValue = e.target.value;

                  // Update cursor position for mention autocomplete
                  setCursorPosition(textarea.selectionStart);

                  // Validate max 2000 characters
                  if (newValue.length > 2000) {
                    const truncated = newValue.substring(0, 2000);
                    e.target.value = truncated;
                    commitContent(truncated);
                  } else {
                    commitContent(newValue);
                  }

                  // Auto-resize textarea up to max height
                  textarea.style.height = "auto";
                  textarea.style.height =
                    Math.min(textarea.scrollHeight, 225) + "px";

                  if (newValue) {
                    startTyping();
                  } else {
                    stopTyping();
                  }
                }}
                onSelect={(e) => {
                  // Update cursor position when selection changes (click, arrow keys)
                  setCursorPosition(e.currentTarget.selectionStart);
                }}
                onPaste={(e) => {
                  // If clipboard contains an image, upload it and do not paste text.
                  const items = Array.from(e.clipboardData?.items || []);
                  const imageFiles = items
                    .filter(
                      (it) =>
                        it.kind === "file" && it.type.startsWith("image/"),
                    )
                    .map((it) => it.getAsFile())
                    .filter((f): f is File => Boolean(f));

                  if (imageFiles.length > 0) {
                    e.preventDefault();
                    // Current ChatInput only supports a single attachment per message.
                    handlePastedImageUpload(imageFiles[0]);
                    if (imageFiles.length > 1) {
                      toast.message(
                        t.chat.onlyFirstImageUsed ||
                          "Only the first pasted image will be attached",
                      );
                    }
                    return;
                  }

                  const textarea = e.currentTarget;
                  const pastedText = e.clipboardData.getData("text");
                  const currentValue =
                    textarea.value || contentRef.current || "";
                  const selectionStart = textarea.selectionStart;
                  const selectionEnd = textarea.selectionEnd;

                  // Calculate what the new value would be
                  const newValue =
                    currentValue.substring(0, selectionStart) +
                    pastedText +
                    currentValue.substring(selectionEnd);

                  // If it would exceed 2000 characters, truncate
                  if (newValue.length > 2000) {
                    e.preventDefault();
                    const availableChars =
                      2000 -
                      (currentValue.length - (selectionEnd - selectionStart));
                    const truncatedPaste = pastedText.substring(
                      0,
                      Math.max(0, availableChars),
                    );

                    const truncatedValue =
                      currentValue.substring(0, selectionStart) +
                      truncatedPaste +
                      currentValue.substring(selectionEnd);

                    commitContent(truncatedValue);

                    // Update textarea height
                    setTimeout(() => {
                      textarea.style.height = "auto";
                      textarea.style.height =
                        Math.min(textarea.scrollHeight, 225) + "px";
                      // Set cursor position after pasted text
                      const newCursorPos =
                        selectionStart + truncatedPaste.length;
                      textarea.setSelectionRange(newCursorPos, newCursorPos);
                    }, 0);

                    if (truncatedValue) {
                      startTyping();
                    }
                  }
                }}
                onBlur={() => {
                  stopTyping();
                }}
                onKeyDown={(e) => {
                  // Submit on Enter (without Shift)
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (isLoading) return;
                    lastSubmitOriginRef.current = "enter_key";
                    shouldRefocusAfterSubmitRef.current = true;
                    void submitWithGuard();
                  }
                }}
              />
            </div>

            <div className="flex shrink-0 items-center">
              <div className="flex gap-2">
                {filePreview ? (
                  <button
                    type="button"
                    ref={setSendButtonEl}
                    onPointerDown={handleSendButtonPointerDown}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleSendButtonClick}
                    disabled={isLoading || isSendingFile}
                    className="h-6 w-6 bg-theme-button-primary hover:bg-theme-button-send-hover transition rounded-full
                            p-1 flex items-center cursor-pointer justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingFile ? (
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 text-white translate-x-[-0.5px] translate-y-[1px]" />
                    )}
                  </button>
                ) : (
                  <>
                    <StickerPicker
                      onChange={(sticker) => handleStickerSubmit(sticker)}
                      profileId={currentProfile.id}
                    />
                    <EmojiPicker
                      onChange={(emoji: string) => {
                        const next = `${contentRef.current}${emoji}`;
                        commitContent(
                          next.length > 2000 ? next.substring(0, 2000) : next,
                        );
                        startTyping();
                        // Focus back to input after emoji selection
                        scheduleFocusInput();
                      }}
                    />
                    {/* Mobile send button - Solo visible en móvil */}
                    <button
                      type="button"
                      ref={setSendButtonEl}
                      onPointerDown={handleSendButtonPointerDown}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleSendButtonClick}
                      disabled={isLoading}
                      className="md:hidden h-7.5 w-7.5 bg-theme-button-primary hover:bg-theme-button-send-hover transition rounded-full
                              p-1 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="h-5 w-5 text-white translate-x-[-0.5px] translate-y-[1px]" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
};

function areChatInputPropsEqual(prev: ChatInputProps, next: ChatInputProps) {
  if (prev === next) return true;
  if (prev.apiUrl !== next.apiUrl) return false;
  if (prev.name !== next.name) return false;
  if (prev.type !== next.type) return false;
  if (prev.roomId !== next.roomId) return false;
  if (prev.currentProfile.id !== next.currentProfile.id) return false;

  if (prev.chatQueryKey !== next.chatQueryKey) {
    if (prev.chatQueryKey.length !== next.chatQueryKey.length) return false;
    for (let i = 0; i < prev.chatQueryKey.length; i++) {
      if (prev.chatQueryKey[i] !== next.chatQueryKey[i]) return false;
    }
  }

  if (prev.query !== next.query) {
    const prevKeys = Object.keys(prev.query);
    const nextKeys = Object.keys(next.query);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of prevKeys) {
      if (prev.query[key] !== next.query[key]) return false;
    }
  }

  return true;
}

export const ChatInput = memo(ChatInputComponent, areChatInputPropsEqual);
