"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useQueries,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import axios from "axios";
import { useTheme } from "next-themes";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { Lock, Pin, RefreshCw } from "lucide-react";
import { parsePostContent } from "@/lib/parse-post-formatting";
import { DiscoverySkeleton } from "@/components/discovery/discovery-skeleton";
import { FeedBottomSkeleton } from "@/components/discovery/feed-bottom-skeleton";
import {
  communityPostsKey,
  type CommunityPostsFeedPage,
  useCommunityPostsFeed,
} from "@/hooks/discovery/posts-feed/use-community-posts-feed";
import { useProfile } from "@/components/app-shell/providers/profile-provider";
import { UserAvatarMenu } from "@/components/user-avatar-menu";
import { useUpload } from "@/hooks/use-upload";
import {
  getGradientAnimationClass,
  getUsernameColorStyle,
} from "@/lib/username-color";
import { getUsernameFormatClasses } from "@/lib/username-format";
import { cn } from "@/lib/utils";

import { useModal } from "@/hooks/use-modal-store";
import { useCurrentMemberRole } from "@/hooks/use-board-data";
import { MemberRole } from "@prisma/client";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";
import { ImagePlus, X } from "lucide-react";
import { useTranslation } from "@/i18n";
import {
  CommunityPostCommentItem,
  type CommunityPostCommentItemData,
} from "./community-post-comment-item";

interface CommunityPostsSectionProps {
  communityId: string;
  isActive: boolean;
  onHeaderActionChange?: (action: ReactNode | null) => void;
  onPersistScrollReady?: ((persist: () => void) => void) | undefined;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

interface CommunityPostCommentsQueryData {
  items: CommunityPostCommentItemData[];
  totalCount: number;
}

const MAX_EXPANDED_POSTS = 8;

const communityPostCommentsKey = (postId: string) =>
  ["community-post-comments", postId] as const;

async function fetchCommunityPostComments(
  postId: string,
): Promise<CommunityPostCommentsQueryData> {
  const response = await fetch(`/api/posts/${postId}/comments`);
  if (!response.ok) {
    throw new Error("Failed to load post comments");
  }

  return response.json();
}

function formatPostDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const FALLBACK_POST_IMAGE_SIZE = { width: 220, height: 180 };
const POST_IMAGE_LANDSCAPE_MIN_RATIO = 1.6;
const POST_IMAGE_PORTRAIT_MAX_RATIO = 0.625;
const POST_IMAGE_BUCKET_LANDSCAPE = { width: 460, height: 260 };
const POST_IMAGE_BUCKET_PORTRAIT = { width: 220, height: 370 };
const POST_IMAGE_BUCKET_SQUAREISH = { width: 210, height: 210 };

function getPostImageDisplaySize(
  originalWidth: number | null | undefined,
  originalHeight: number | null | undefined,
): { width: number; height: number } {
  if (!originalWidth || !originalHeight) return FALLBACK_POST_IMAGE_SIZE;
  const ratio = originalWidth / originalHeight;
  const bucket =
    ratio >= POST_IMAGE_LANDSCAPE_MIN_RATIO
      ? POST_IMAGE_BUCKET_LANDSCAPE
      : ratio <= POST_IMAGE_PORTRAIT_MAX_RATIO
        ? POST_IMAGE_BUCKET_PORTRAIT
        : POST_IMAGE_BUCKET_SQUAREISH;
  const scale = Math.min(
    bucket.width / originalWidth,
    bucket.height / originalHeight,
    1,
  );
  return {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale)),
  };
}

function PostImageAttachment({
  imageUrl,
  alt,
  imageWidth,
  imageHeight,
  noFloat,
}: {
  imageUrl: string;
  alt: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  noFloat?: boolean;
}) {
  const { t } = useTranslation();
  const displaySize = getPostImageDisplaySize(imageWidth, imageHeight);
  const [isOpen, setIsOpen] = useState(false);
  const [forceOriginalInline, setForceOriginalInline] = useState(false);
  const [forceOriginalPreview, setForceOriginalPreview] = useState(false);
  const inlineImageUrl = useMemo(() => {
    if (forceOriginalInline) return imageUrl;
    return getOptimizedStaticUiImageUrl(imageUrl, {
      w: displaySize.width * 2,
      h: displaySize.height * 2,
      q: 84,
      resize: "fit",
      gravity: "sm",
    });
  }, [forceOriginalInline, imageUrl, displaySize.width, displaySize.height]);
  const previewImageUrl = useMemo(() => {
    if (forceOriginalPreview) return imageUrl;
    return getOptimizedStaticUiImageUrl(imageUrl, {
      w: 1600,
      h: 1600,
      q: 88,
      resize: "fit",
      gravity: "sm",
    });
  }, [forceOriginalPreview, imageUrl]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "mt-1 block cursor-pointer overflow-hidden rounded-md border bg-black/[0.03]",
          noFloat ? "" : "float-left mr-3",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={inlineImageUrl}
          alt={alt}
          width={displaySize.width}
          height={displaySize.height}
          className="block object-contain"
          style={{ width: displaySize.width, height: displaySize.height }}
          loading="lazy"
          decoding="async"
          onError={() => {
            if (inlineImageUrl !== imageUrl) {
              setForceOriginalInline(true);
            }
          }}
        />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-none gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
          overlayClassName="bg-black/70"
        >
          <DialogTitle className="sr-only">
            {t.posts.imagePreviewTitle}
          </DialogTitle>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImageUrl}
              alt={alt}
              className="block max-h-[92vh] max-w-[92vw] object-contain"
              loading="eager"
              decoding="async"
              onError={() => {
                if (previewImageUrl !== imageUrl) {
                  setForceOriginalPreview(true);
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PostBodyWithImage({
  usernameSlot,
  content,
  imageUrl,
  alt,
  imageWidth,
  imageHeight,
  themeMode,
}: {
  usernameSlot: ReactNode;
  content: string;
  imageUrl: string;
  alt: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  themeMode: "dark" | "light";
}) {
  const isLandscape =
    !!imageWidth &&
    !!imageHeight &&
    imageWidth / imageHeight >= POST_IMAGE_LANDSCAPE_MIN_RATIO;

  const isPortrait =
    !!imageWidth &&
    !!imageHeight &&
    imageWidth / imageHeight <= POST_IMAGE_PORTRAIT_MAX_RATIO;

  if (isLandscape) {
    // Landscape: imagen arriba, texto abajo
    return (
      <>
        <div className="mt-1 mb-1">
          <PostImageAttachment
            imageUrl={imageUrl}
            alt={alt}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            noFloat
          />
        </div>
        <div className="-mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-5 text-theme-text-secondary">
          <span className="whitespace-nowrap">{usernameSlot}</span>
          {content && (
            <>
              {"\u00A0"}
              {parsePostContent(content, themeMode)}
            </>
          )}
        </div>
      </>
    );
  }

  if (!isPortrait && !!imageWidth && !!imageHeight) {
    // Squarish: texto arriba, imagen abajo izquierda
    return (
      <>
        <div className="-mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-5 text-theme-text-secondary">
          <span className="whitespace-nowrap">{usernameSlot}</span>
          {content && (
            <>
              {"\u00A0"}
              {parsePostContent(content, themeMode)}
            </>
          )}
        </div>
        <div className="mt-1">
          <PostImageAttachment
            imageUrl={imageUrl}
            alt={alt}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            noFloat
          />
        </div>
      </>
    );
  }

  return (
    <div className="overflow-hidden mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-5 text-theme-text-secondary">
      <PostImageAttachment
        imageUrl={imageUrl}
        alt={alt}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
      />
      <span className="whitespace-nowrap">{usernameSlot}</span>
      {content && (
        <>
          {"\u00A0"}
          {parsePostContent(content, themeMode)}
        </>
      )}
    </div>
  );
}

function CommunityPostEditForm({
  postId,
  communityId,
  content,
  hasImage,
  onCancel,
}: {
  postId: string;
  communityId: string;
  content: string;
  hasImage: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState(content);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!textareaRef.current) return;

      textareaRef.current.focus();
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }, 50);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }

      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        !isSaving
      ) {
        event.preventDefault();
        void handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const trimmedDraft = draft.trim();
  const canSave = hasImage || trimmedDraft.length > 0;

  const handleSubmit = async () => {
    if (isSaving || !canSave) return;

    try {
      setIsSaving(true);
      const response = await axios.patch(`/api/posts/${postId}`, {
        content: trimmedDraft,
      });

      const updatedPost = response.data as {
        id: string;
        content: string;
        updatedAt: string;
      };

      queryClient.setQueryData<InfiniteData<CommunityPostsFeedPage>>(
        communityPostsKey(communityId),
        (current) => {
          if (!current) return current;

          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((post) =>
                post.id === updatedPost.id
                  ? {
                      ...post,
                      content: updatedPost.content,
                      updatedAt: updatedPost.updatedAt,
                    }
                  : post,
              ),
            })),
          };
        },
      );

      onCancel();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-md bg-theme-bg-edit-form/80 p-3">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={isSaving}
        rows={Math.max(3, Math.min(10, draft.split("\n").length + 1))}
        className="min-h-[88px] w-full resize-none rounded-md border border-theme-border-subtle bg-transparent px-3 py-2 text-[12px] leading-5 text-theme-text-light outline-none focus:border-theme-border-accent"
        placeholder={t.posts.editPostPlaceholder}
      />
      <div className="mt-2 flex items-center gap-x-2">
        <Button
          type="button"
          disabled={isSaving}
          size="sm"
          onClick={onCancel}
          className="h-7 cursor-pointer bg-theme-bg-cancel-button px-3 text-[13px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
        >
          {t.common.cancel}
        </Button>
        <Button
          type="button"
          disabled={isSaving || !canSave}
          size="sm"
          onClick={() => void handleSubmit()}
          className="h-7 cursor-pointer bg-theme-tab-button-bg px-3 text-[13px] text-theme-text-light hover:bg-theme-tab-button-hover"
        >
          {t.common.save}
        </Button>
        <span className="ml-1 text-[11px] text-theme-text-muted">
          {t.posts.escToCancelCtrlEnterToSave}
        </span>
      </div>
    </div>
  );
}

function CommunityPostCommentComposer({
  postId,
  communityId,
  replyToCommentId,
  onCancel,
}: {
  postId: string;
  communityId: string;
  replyToCommentId?: string | null;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [content, setContent] = useState("");
  const [imageAsset, setImageAsset] = useState<{
    assetId: string;
    url: string;
    width?: number;
    height?: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { startUpload, isUploading } = useUpload(
    "community_post_comment_image",
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!textareaRef.current) return;

      textareaRef.current.focus();
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }, 50);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }

      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        !isSubmitting
      ) {
        event.preventDefault();
        void handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const trimmedContent = content.trim();
  const canSubmit = trimmedContent.length > 0 || Boolean(imageAsset);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const uploadedFiles = await startUpload(Array.from(files));
      const uploadedFile = uploadedFiles[0];
      if (!uploadedFile) return;

      setImageAsset({
        assetId: uploadedFile.assetId,
        url: uploadedFile.url,
        width: uploadedFile.width,
        height: uploadedFile.height,
      });
    } catch (error) {
      console.error(error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !canSubmit) return;

    try {
      setIsSubmitting(true);
      const response = await axios.post(`/api/posts/${postId}/comments`, {
        content: trimmedContent,
        imageAssetId: imageAsset?.assetId ?? null,
        replyToCommentId: replyToCommentId ?? null,
      });
      const createdComment = response.data as CommunityPostCommentItemData;

      queryClient.setQueryData<InfiniteData<CommunityPostsFeedPage>>(
        communityPostsKey(communityId),
        (current) => {
          if (!current) return current;

          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((post) => {
                if (post.id !== postId) return post;

                return {
                  ...post,
                  commentCount: post.commentCount + 1,
                  latestComments: [
                    ...post.latestComments,
                    createdComment,
                  ].slice(-5),
                };
              }),
            })),
          };
        },
      );

      queryClient.setQueryData<CommunityPostCommentsQueryData>(
        communityPostCommentsKey(postId),
        (current) =>
          current
            ? {
                ...current,
                totalCount: current.totalCount + 1,
                items: [...current.items, createdComment],
              }
            : current,
      );

      setContent("");
      setImageAsset(null);
      onCancel();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-2 border border-theme-border bg-theme-bg-edit-form/60 p-3">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={isSubmitting}
        rows={3}
        className="min-h-[88px] w-full resize-none border border-theme-border-subtle bg-transparent px-3 py-2 text-[12px] leading-5 text-theme-text-light outline-none focus:border-theme-border-accent"
        placeholder={t.posts.writeCommentPlaceholder}
      />

      {imageAsset && (
        <div className="mt-2 inline-flex items-start gap-2 border border-theme-border bg-theme-bg-secondary/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageAsset.url}
            alt={t.posts.commentAttachmentAlt}
            className="max-h-[96px] max-w-[96px] object-contain"
            loading="lazy"
            decoding="async"
          />
          <button
            type="button"
            onClick={() => setImageAsset(null)}
            className="cursor-pointer text-theme-text-tertiary transition hover:text-theme-text-light"
            aria-label={t.posts.removeImage}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      <div className="mt-2 flex items-center gap-x-2">
        <Button
          type="button"
          size="sm"
          disabled={isSubmitting || isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="h-7 cursor-pointer rounded-none bg-theme-bg-cancel-button px-3 text-[12px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
        >
          <ImagePlus className="mr-1 h-4 w-4" />
          {t.posts.attachImage}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isSubmitting || isUploading || !canSubmit}
          onClick={() => void handleSubmit()}
          className="h-7 cursor-pointer rounded-none bg-theme-tab-button-bg px-3 text-[12px] text-theme-text-light hover:bg-theme-tab-button-hover"
        >
          {t.posts.sendComment}
        </Button>
        <span className="ml-1 text-[11px] text-theme-text-muted">
          {t.posts.escToCancelCtrlEnterToSend}
        </span>
      </div>
    </div>
  );
}

function CommunityPostCommentEditForm({
  postId,
  comment,
  onCancel,
  onSaved,
}: {
  postId: string;
  comment: CommunityPostCommentItemData;
  onCancel: () => void;
  onSaved: (updatedComment: CommunityPostCommentItemData) => void;
}) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!textareaRef.current) return;

      textareaRef.current.focus();
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }, 50);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }

      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        !isSaving
      ) {
        event.preventDefault();
        void handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const trimmedDraft = draft.trim();
  const canSave = trimmedDraft.length > 0 || Boolean(comment.imageAsset);

  const handleSubmit = async () => {
    if (isSaving || !canSave) return;

    try {
      setIsSaving(true);
      const response = await axios.patch(
        `/api/posts/${postId}/comments/${comment.id}`,
        {
          content: trimmedDraft,
        },
      );

      onSaved(response.data as CommunityPostCommentItemData);
      onCancel();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border border-theme-border bg-theme-bg-edit-form/60 p-3">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={isSaving}
        rows={Math.max(3, Math.min(8, draft.split("\n").length + 1))}
        className="min-h-[88px] w-full resize-none border border-theme-border-subtle bg-transparent px-3 py-2 text-[12px] leading-5 text-theme-text-light outline-none focus:border-theme-border-accent"
        placeholder={t.posts.editCommentPlaceholder}
      />
      <div className="mt-2 flex items-center gap-x-2">
        <Button
          type="button"
          disabled={isSaving}
          size="sm"
          onClick={onCancel}
          className="h-7 cursor-pointer bg-theme-bg-cancel-button px-3 text-[13px] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
        >
          {t.common.cancel}
        </Button>
        <Button
          type="button"
          disabled={isSaving || !canSave}
          size="sm"
          onClick={() => void handleSubmit()}
          className="h-7 cursor-pointer bg-theme-tab-button-bg px-3 text-[13px] text-theme-text-light hover:bg-theme-tab-button-hover"
        >
          {t.common.save}
        </Button>
        <span className="ml-1 text-[11px] text-theme-text-muted">
          {t.posts.escToCancelCtrlEnterToSave}
        </span>
      </div>
    </div>
  );
}

function CommunityPostsSectionInner({
  communityId,
  isActive,
  onHeaderActionChange,
  onPersistScrollReady,
  scrollContainerRef,
}: CommunityPostsSectionProps) {
  const profile = useProfile();
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const onOpen = useModal(useCallback((state) => state.onOpen, []));
  const { resolvedTheme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{
    postId: string;
    commentId: string;
  } | null>(null);
  const [replyingToPostId, setReplyingToPostId] = useState<string | null>(null);
  const [replyingToComment, setReplyingToComment] = useState<{
    postId: string;
    commentId: string;
  } | null>(null);
  const [expandedPostsById, setExpandedPostsById] = useState<
    Record<string, true>
  >({});
  const [expandedCommentsOrder, setExpandedCommentsOrder] = useState<string[]>(
    [],
  );
  const expandedCommentsOrderRef = useRef<string[]>([]);
  const role = useCurrentMemberRole(profile.id);
  const canDeleteAnyPost =
    role === MemberRole.OWNER ||
    role === MemberRole.ADMIN ||
    role === MemberRole.MODERATOR;
  const {
    allPosts,
    pageSlots,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    refresh,
    persistScrollStateNow,
    bottomSentinelRef,
    getMeasuredPageRef,
  } = useCommunityPostsFeed(communityId, {
    isActive,
    externalContainerRef: scrollContainerRef,
  });
  const expandedPostIds = useMemo(
    () => Object.keys(expandedPostsById),
    [expandedPostsById],
  );
  const expandedCommentsQueries = useQueries({
    queries: expandedPostIds.map((postId) => ({
      queryKey: communityPostCommentsKey(postId),
      queryFn: () => fetchCommunityPostComments(postId),
      staleTime: 1000 * 60 * 5,
    })),
  });
  const expandedCommentsQueryMap = useMemo(
    () =>
      Object.fromEntries(
        expandedPostIds.map((postId, index) => [
          postId,
          expandedCommentsQueries[index],
        ]),
      ) as Record<string, (typeof expandedCommentsQueries)[number] | undefined>,
    [expandedCommentsQueries, expandedPostIds],
  );

  useEffect(() => {
    expandedCommentsOrderRef.current = expandedCommentsOrder;
  }, [expandedCommentsOrder]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refresh]);

  const headerAction = useMemo(
    () => (
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="inline-flex h-6.5 cursor-pointer items-center gap-2 border-0 bg-[var(--community-header-btn-bg)] px-3 text-[13px] font-semibold text-[var(--community-header-btn-text)] hover:bg-[var(--community-header-btn-hover)] focus-visible:ring-2 focus-visible:ring-[var(--community-header-btn-ring)] focus-visible:outline-none disabled:opacity-50 rounded-none"
        title={t.posts.refreshPosts}
      >
        <RefreshCw
          className={`h-4 w-4 text-[var(--community-header-btn-muted)] ${
            isRefreshing ? "animate-spin" : ""
          }`}
        />
        <span className="text-[var(--community-header-btn-text)]">
          {t.discovery.refresh}
        </span>
      </button>
    ),
    [handleRefresh, isRefreshing, t.discovery.refresh, t.posts.refreshPosts],
  );

  useEffect(() => {
    if (!isActive) return;
    onHeaderActionChange?.(headerAction);

    return () => onHeaderActionChange?.(null);
  }, [headerAction, isActive, onHeaderActionChange]);

  useEffect(() => {
    onPersistScrollReady?.(persistScrollStateNow);
  }, [onPersistScrollReady, persistScrollStateNow]);

  const handleToggleOmittedComments = useCallback(
    (postId: string) => {
      if (expandedPostsById[postId]) {
        setExpandedPostsById((current) => {
          const next = { ...current };
          delete next[postId];
          return next;
        });
        return;
      }

      setExpandedPostsById((current) => ({
        ...current,
        [postId]: true,
      }));

      const nextOrder = expandedCommentsOrderRef.current
        .filter((currentPostId) => currentPostId !== postId)
        .concat(postId);
      const evictedPostId =
        nextOrder.length > MAX_EXPANDED_POSTS ? nextOrder[0] : null;
      const boundedOrder = evictedPostId ? nextOrder.slice(1) : nextOrder;

      expandedCommentsOrderRef.current = boundedOrder;
      setExpandedCommentsOrder(boundedOrder);

      if (evictedPostId) {
        queryClient.removeQueries({
          queryKey: communityPostCommentsKey(evictedPostId),
        });
        setExpandedPostsById((current) => {
          const next = { ...current };
          delete next[evictedPostId];
          return next;
        });
      }

      void queryClient.prefetchQuery({
        queryKey: communityPostCommentsKey(postId),
        queryFn: () => fetchCommunityPostComments(postId),
        staleTime: 1000 * 60 * 5,
      });
    },
    [expandedPostsById, queryClient],
  );

  const applyCommentUpdate = useCallback(
    (
      postId: string,
      commentId: string,
      updater: (
        comment: CommunityPostCommentItemData,
      ) => CommunityPostCommentItemData,
      options?: { decrementCount?: boolean },
    ) => {
      queryClient.setQueryData<InfiniteData<CommunityPostsFeedPage>>(
        communityPostsKey(communityId),
        (current) => {
          if (!current) return current;

          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((post) => {
                if (post.id !== postId) return post;

                return {
                  ...post,
                  commentCount: options?.decrementCount
                    ? Math.max(0, post.commentCount - 1)
                    : post.commentCount,
                  latestComments: post.latestComments.map((comment) =>
                    comment.id === commentId ? updater(comment) : comment,
                  ),
                };
              }),
            })),
          };
        },
      );

      queryClient.setQueryData<CommunityPostCommentsQueryData>(
        communityPostCommentsKey(postId),
        (current) =>
          current
            ? {
                ...current,
                totalCount: options?.decrementCount
                  ? Math.max(0, current.totalCount - 1)
                  : current.totalCount,
                items: current.items.map((comment) =>
                  comment.id === commentId ? updater(comment) : comment,
                ),
              }
            : current,
      );
    },
    [communityId, queryClient],
  );

  const handleCommentSaved = useCallback(
    (postId: string, updatedComment: CommunityPostCommentItemData) => {
      applyCommentUpdate(postId, updatedComment.id, () => updatedComment);
    },
    [applyCommentUpdate],
  );

  const handleDeleteComment = useCallback(
    async (postId: string, commentId: string) => {
      try {
        await axios.delete(`/api/posts/${postId}/comments/${commentId}`);
        setReplyingToComment((current) =>
          current?.postId === postId && current.commentId === commentId
            ? null
            : current,
        );
        setEditingComment((current) =>
          current?.postId === postId && current.commentId === commentId
            ? null
            : current,
        );
        applyCommentUpdate(
          postId,
          commentId,
          (comment) => ({
            ...comment,
            deleted: true,
            content: "",
            imageAsset: null,
          }),
          { decrementCount: true },
        );
      } catch (error) {
        console.error(error);
      }
    },
    [applyCommentUpdate],
  );

  return (
    <div className="w-full">
      <div className="px-6 pt-0 pb-4">
        {isLoading ? (
          <DiscoverySkeleton />
        ) : error ? (
          <div className="py-20 text-center text-[16px] text-destructive">
            {t.common.error}: {String(error)}
          </div>
        ) : allPosts.length === 0 ? (
          <div className="py-20 text-center text-[16px] text-theme-text-muted">
            {t.posts.noPostsInCommunity}
          </div>
        ) : (
          <>
            {pageSlots.map((slot) => {
              if (slot.type === "virtualized") {
                return (
                  <div
                    key={`placeholder-${slot.pageIndex}`}
                    style={{ height: slot.height }}
                    className="shrink-0"
                  />
                );
              }

              return (
                <div
                  key={`page-${slot.pageIndex}`}
                  ref={getMeasuredPageRef(slot.pageIndex)}
                >
                  {slot.page.items.map((post) =>
                    (() => {
                      const authorAvatarUrl =
                        post.author.avatarAsset?.url || "";
                      const authorBadgeStickerUrl =
                        post.author.badgeSticker?.asset?.url || null;
                      const postImageUrl = post.imageAsset?.url || null;
                      const isOwnPost = post.author.id === profile.id;
                      const canDeletePost = isOwnPost || canDeleteAnyPost;
                      const isEditing = editingPostId === post.id;
                      const isReplying = replyingToPostId === post.id;
                      const latestCommentIds = new Set(
                        post.latestComments.map((comment) => comment.id),
                      );
                      const expandedCommentsQuery =
                        expandedCommentsQueryMap[post.id];
                      const expandedComments =
                        expandedCommentsQuery?.data?.items ?? null;
                      const omittedComments = expandedComments
                        ? expandedComments.filter(
                            (comment) => !latestCommentIds.has(comment.id),
                          )
                        : [];
                      const commentsToRender = expandedComments
                        ? [...omittedComments, ...post.latestComments]
                        : post.latestComments;
                      const omittedCount = Math.max(
                        post.commentCount - post.latestComments.length,
                        0,
                      );
                      const isExpandedCommentsLoading =
                        Boolean(expandedPostsById[post.id]) &&
                        !expandedComments &&
                        Boolean(
                          expandedCommentsQuery?.isLoading ||
                          expandedCommentsQuery?.isFetching,
                        );
                      const isOmittedExpanded = Boolean(
                        expandedPostsById[post.id],
                      );

                      const themeMode =
                        (resolvedTheme as "dark" | "light") || "dark";

                      return (
                        <article
                          key={post.id}
                          className="-mx-6 border-b border-theme-border px-3 py-2"
                        >
                          <div className="relative rounded-sm bg-theme-bg-edit-form/95 px-4 pt-3 pb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(255,255,255,0.16),inset_-1px_-1px_0_rgba(0,0,0,0.38)]">
                            <div className="flex items-start gap-2 -ml-1.5">
                              <div className="shrink-0">
                                <UserAvatarMenu
                                  profileId={post.author.id}
                                  profileImageUrl={authorAvatarUrl}
                                  username={post.author.username}
                                  discriminator={post.author.discriminator}
                                  currentProfileId={profile.id}
                                  className="h-8 w-8"
                                  showStatus={false}
                                  disableHoverShadow
                                  avatarAnimationMode="never"
                                />
                              </div>

                              <div className="-mt-2 min-w-0 flex-1">
                                {isEditing ? (
                                  <CommunityPostEditForm
                                    postId={post.id}
                                    communityId={communityId}
                                    content={post.content}
                                    hasImage={Boolean(post.imageAsset)}
                                    onCancel={() => setEditingPostId(null)}
                                  />
                                ) : (
                                  <>
                                    {post.title ? (
                                      <>
                                        {/* Con titulo: fila 1 = badge+timestamp, fila 2 = título */}
                                        <div className="mb-0 flex flex-wrap items-center gap-1">
                                          {(post.author.badge ||
                                            authorBadgeStickerUrl) && (
                                            <>
                                              <span className="inline-flex items-center gap-0.5">
                                                {authorBadgeStickerUrl && (
                                                  <AnimatedSticker
                                                    src={authorBadgeStickerUrl}
                                                    alt="badge"
                                                    containerClassName="h-5 w-5"
                                                    fallbackWidthPx={20}
                                                    fallbackHeightPx={20}
                                                    className="object-contain"
                                                    isHovered={false}
                                                  />
                                                )}
                                                {post.author.badge && (
                                                  <span className="pt-2.5 text-[11px] leading-none text-theme-text-tertiary">
                                                    {post.author.badge}
                                                  </span>
                                                )}
                                              </span>
                                              <span className="pt-2.5 text-[11px] text-theme-text-tertiary">
                                                |
                                              </span>
                                            </>
                                          )}
                                          <span className="pt-2.5 text-[11px] text-theme-text-tertiary">
                                            {formatPostDate(
                                              post.createdAt,
                                              locale,
                                            )}
                                          </span>
                                          {post.pinnedAt && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-theme-bg-tertiary px-2 py-0.5 text-[11px] font-medium leading-none text-theme-text-subtle">
                                              <Pin className="h-3 w-3" />
                                              {t.posts.pinned}
                                            </span>
                                          )}
                                          {post.lockedAt && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-theme-bg-tertiary px-2 py-0.5 text-[11px] font-medium leading-none text-theme-text-subtle">
                                              <Lock className="h-3 w-3" />
                                              {t.posts.closed}
                                            </span>
                                          )}
                                        </div>
                                        <div className="break-words mt-1 mb-1.5 border-2 border-theme-channel-type-active-border pl-1 text-[18px] font-light leading-snug text-theme-text-primary">
                                          {post.title}
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        {/* Sin título: badge+timestamp en fila 1 como siempre */}
                                        <div className="mb-0 flex flex-wrap items-center gap-1">
                                          {(post.author.badge ||
                                            authorBadgeStickerUrl) && (
                                            <>
                                              <span className="inline-flex items-center gap-0.5">
                                                {authorBadgeStickerUrl && (
                                                  <AnimatedSticker
                                                    src={authorBadgeStickerUrl}
                                                    alt="badge"
                                                    containerClassName="h-5 w-5"
                                                    fallbackWidthPx={20}
                                                    fallbackHeightPx={20}
                                                    className="object-contain"
                                                    isHovered={false}
                                                  />
                                                )}
                                                {post.author.badge && (
                                                  <span className="pt-2.5 text-[11px] leading-none text-theme-text-tertiary">
                                                    {post.author.badge}
                                                  </span>
                                                )}
                                              </span>
                                              <span className="pt-2.5 text-[11px] text-theme-text-tertiary">
                                                |
                                              </span>
                                            </>
                                          )}
                                          <span className="pt-2.5 text-[11px] text-theme-text-tertiary">
                                            {formatPostDate(
                                              post.createdAt,
                                              locale,
                                            )}
                                          </span>
                                          {post.pinnedAt && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-theme-bg-tertiary px-2 py-0.5 text-[11px] font-medium leading-none text-theme-text-subtle">
                                              <Pin className="h-3 w-3" />
                                              {t.posts.pinned}
                                            </span>
                                          )}
                                          {post.lockedAt && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-theme-bg-tertiary px-2 py-0.5 text-[11px] font-medium leading-none text-theme-text-subtle">
                                              <Lock className="h-3 w-3" />
                                              {t.posts.closed}
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    )}

                                    {postImageUrl ? (
                                      <PostBodyWithImage
                                        imageUrl={postImageUrl}
                                        alt={
                                          post.content || "community post image"
                                        }
                                        content={post.content}
                                        imageWidth={post.imageAsset?.width}
                                        imageHeight={post.imageAsset?.height}
                                        themeMode={themeMode}
                                        usernameSlot={
                                          <>
                                            <UserAvatarMenu
                                              profileId={post.author.id}
                                              profileImageUrl={authorAvatarUrl}
                                              username={post.author.username}
                                              discriminator={
                                                post.author.discriminator
                                              }
                                              currentProfileId={profile.id}
                                              currentProfile={profile}
                                              showStatus={false}
                                              usernameColor={
                                                post.author.usernameColor
                                              }
                                              usernameFormat={
                                                post.author.usernameFormat
                                              }
                                              hideAvatar
                                            >
                                              <span
                                                className={cn(
                                                  "cursor-pointer text-[14px] font-semibold text-white hover:underline",
                                                  getUsernameFormatClasses(
                                                    post.author.usernameFormat,
                                                  ),
                                                  getGradientAnimationClass(
                                                    post.author.usernameColor,
                                                  ),
                                                )}
                                                style={getUsernameColorStyle(
                                                  post.author.usernameColor,
                                                  {
                                                    isOwnProfile:
                                                      post.author.id ===
                                                      profile.id,
                                                    themeMode,
                                                  },
                                                )}
                                              >
                                                {post.author.username}
                                              </span>
                                            </UserAvatarMenu>
                                            <span
                                              className={cn(
                                                "text-[14px] font-semibold",
                                                getGradientAnimationClass(
                                                  post.author.usernameColor,
                                                ),
                                              )}
                                              style={getUsernameColorStyle(
                                                post.author.usernameColor,
                                                {
                                                  isOwnProfile:
                                                    post.author.id ===
                                                    profile.id,
                                                  themeMode,
                                                },
                                              )}
                                            >
                                              :
                                            </span>
                                          </>
                                        }
                                      />
                                    ) : (
                                      <div className="-mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-5 text-theme-text-secondary">
                                        <span className="whitespace-nowrap">
                                          <UserAvatarMenu
                                            profileId={post.author.id}
                                            profileImageUrl={authorAvatarUrl}
                                            username={post.author.username}
                                            discriminator={
                                              post.author.discriminator
                                            }
                                            currentProfileId={profile.id}
                                            currentProfile={profile}
                                            showStatus={false}
                                            usernameColor={
                                              post.author.usernameColor
                                            }
                                            usernameFormat={
                                              post.author.usernameFormat
                                            }
                                            hideAvatar
                                          >
                                            <span
                                              className={cn(
                                                "cursor-pointer text-[14px] font-semibold text-white hover:underline",
                                                getUsernameFormatClasses(
                                                  post.author.usernameFormat,
                                                ),
                                                getGradientAnimationClass(
                                                  post.author.usernameColor,
                                                ),
                                              )}
                                              style={getUsernameColorStyle(
                                                post.author.usernameColor,
                                                {
                                                  isOwnProfile:
                                                    post.author.id ===
                                                    profile.id,
                                                  themeMode,
                                                },
                                              )}
                                            >
                                              {post.author.username}
                                            </span>
                                          </UserAvatarMenu>
                                          <span
                                            className={cn(
                                              "text-[14px] font-semibold",
                                              getGradientAnimationClass(
                                                post.author.usernameColor,
                                              ),
                                            )}
                                            style={getUsernameColorStyle(
                                              post.author.usernameColor,
                                              {
                                                isOwnProfile:
                                                  post.author.id === profile.id,
                                                themeMode,
                                              },
                                            )}
                                          >
                                            :
                                          </span>
                                        </span>
                                        {"\u00A0"}
                                        <span>
                                          {parsePostContent(
                                            post.content,
                                            themeMode,
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}

                                {!isEditing && (
                                  <div
                                    className={cn(
                                      "clear-left flex items-center gap-x-3 -mb-1 pt-1",
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyingToComment(null);
                                        setReplyingToPostId((current) =>
                                          current === post.id ? null : post.id,
                                        );
                                      }}
                                      className="cursor-pointer text-[14px] text-theme-text-tertiary transition hover:underline"
                                    >
                                      {t.chat.reply}
                                    </button>
                                    {omittedCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleToggleOmittedComments(
                                            post.id,
                                          )
                                        }
                                        className="cursor-pointer text-[14px] text-theme-text-tertiary transition hover:underline"
                                      >
                                        {isExpandedCommentsLoading
                                          ? t.posts.loadingComments
                                          : isOmittedExpanded
                                            ? t.posts.hideOmittedComments
                                            : t.posts.expandOmittedComments(
                                                omittedCount,
                                              )}
                                      </button>
                                    )}
                                    {isOwnPost && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingPostId(post.id)
                                        }
                                        className="cursor-pointer text-[14px] text-theme-text-tertiary transition hover:underline"
                                      >
                                        {t.posts.editPost}
                                      </button>
                                    )}
                                    {canDeletePost && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onOpen("deleteCommunityPost", {
                                            deleteCommunityPostId: post.id,
                                            deleteCommunityPostCommunityId:
                                              communityId,
                                          })
                                        }
                                        className="cursor-pointer text-[14px] text-theme-text-tertiary transition hover:underline"
                                      >
                                        {t.posts.deletePost}
                                      </button>
                                    )}
                                    {!isOwnPost && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onOpen("reportCommunityPost", {
                                            profileId: profile.id,
                                            reportCommunityPostId: post.id,
                                            reportCommunityPostContent:
                                              post.content,
                                            reportCommunityPostImageUrl:
                                              postImageUrl,
                                            reportCommunityPostAuthorId:
                                              post.author.id,
                                            reportCommunityPostAuthorUsername:
                                              post.author.username,
                                            reportCommunityPostAuthorDiscriminator:
                                              post.author.discriminator,
                                          })
                                        }
                                        className="cursor-pointer text-[14px] text-theme-text-tertiary transition hover:underline"
                                      >
                                        {t.posts.reportPost}
                                      </button>
                                    )}
                                  </div>
                                )}

                                {isReplying && !isEditing && (
                                  <div className="clear-left">
                                    <CommunityPostCommentComposer
                                      postId={post.id}
                                      communityId={communityId}
                                      onCancel={() => setReplyingToPostId(null)}
                                    />
                                  </div>
                                )}

                                {!isEditing && commentsToRender.length > 0 && (
                                  <div className="clear-left mt-3 space-y-2">
                                    {commentsToRender.map((comment) => (
                                      <div
                                        key={comment.id}
                                        className="space-y-2"
                                      >
                                        {editingComment?.postId === post.id &&
                                        editingComment.commentId ===
                                          comment.id ? (
                                          <CommunityPostCommentEditForm
                                            postId={post.id}
                                            comment={comment}
                                            onCancel={() =>
                                              setEditingComment(null)
                                            }
                                            onSaved={(updatedComment) =>
                                              handleCommentSaved(
                                                post.id,
                                                updatedComment,
                                              )
                                            }
                                          />
                                        ) : (
                                          <CommunityPostCommentItem
                                            comment={comment}
                                            currentProfileId={profile.id}
                                            onReply={(commentId) => {
                                              setEditingComment(null);
                                              setReplyingToPostId(null);
                                              setReplyingToComment((current) =>
                                                current?.postId === post.id &&
                                                current.commentId === commentId
                                                  ? null
                                                  : {
                                                      postId: post.id,
                                                      commentId,
                                                    },
                                              );
                                            }}
                                            onReport={
                                              comment.author.id === profile.id
                                                ? undefined
                                                : () =>
                                                    onOpen(
                                                      "reportCommunityPostComment",
                                                      {
                                                        profileId: profile.id,
                                                        reportCommunityPostCommentId:
                                                          comment.id,
                                                        reportCommunityPostCommentContent:
                                                          comment.content,
                                                        reportCommunityPostCommentImageUrl:
                                                          comment.imageAsset
                                                            ?.url || null,
                                                        reportCommunityPostCommentAuthorId:
                                                          comment.author.id,
                                                        reportCommunityPostCommentAuthorUsername:
                                                          comment.author
                                                            .username,
                                                        reportCommunityPostCommentAuthorDiscriminator:
                                                          comment.author
                                                            .discriminator,
                                                      },
                                                    )
                                            }
                                            onEdit={
                                              comment.author.id ===
                                                profile.id && !comment.deleted
                                                ? (commentId) => {
                                                    setReplyingToComment(null);
                                                    setReplyingToPostId(null);
                                                    setEditingComment({
                                                      postId: post.id,
                                                      commentId,
                                                    });
                                                  }
                                                : undefined
                                            }
                                            onDelete={
                                              (comment.author.id ===
                                                profile.id ||
                                                canDeleteAnyPost) &&
                                              !comment.deleted
                                                ? (commentId) =>
                                                    onOpen(
                                                      "deleteCommunityPostComment",
                                                      {
                                                        deleteCommunityPostCommentId:
                                                          commentId,
                                                        onDeleteCommunityPostCommentConfirm:
                                                          () =>
                                                            handleDeleteComment(
                                                              post.id,
                                                              commentId,
                                                            ),
                                                      },
                                                    )
                                                : undefined
                                            }
                                          />
                                        )}
                                        {replyingToComment?.postId ===
                                          post.id &&
                                          replyingToComment.commentId ===
                                            comment.id && (
                                            <CommunityPostCommentComposer
                                              postId={post.id}
                                              communityId={communityId}
                                              replyToCommentId={comment.id}
                                              onCancel={() =>
                                                setReplyingToComment(null)
                                              }
                                            />
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })(),
                  )}
                </div>
              );
            })}

            <div ref={bottomSentinelRef} className="h-1 shrink-0" />

            {(isFetchingNextPage || hasNextPage) && <FeedBottomSkeleton />}
          </>
        )}
      </div>
    </div>
  );
}

export const CommunityPostsSection = memo(CommunityPostsSectionInner);
