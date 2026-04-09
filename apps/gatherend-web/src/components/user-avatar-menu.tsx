"use client";

import { memo, useCallback, useState, useTransition } from "react";
import axios from "axios";
import { ActionTooltip } from "@/components/action-tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { ProfileCardRenderer } from "@/components/profile-card-renderer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MessageSquare, SquarePen, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInvalidateConversations } from "@/hooks/use-conversations";
import { useOverlayStore } from "@/hooks/use-overlay-store";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { useProfileCard } from "@/hooks/use-profile-card";
import { useModal } from "@/hooks/use-modal-store";
import { useTranslation } from "@/i18n";
import { useTheme } from "next-themes";
import { JsonValue } from "@prisma/client/runtime/library";

type MemberRole = "OWNER" | "ADMIN" | "MODERATOR" | "GUEST";

interface UserAvatarMenuProps {
  profileId: string;
  profileImageUrl: string;
  username: string;
  discriminator?: string | null;
  currentProfileId: string;
  className?: string;
  showStatus?: boolean;
  statusOffset?: string;
  ringColorClass?: string;
  memberId?: string;
  memberRole?: MemberRole;
  showRole?: boolean;
  usernameColor?: JsonValue | string | null;
  usernameFormat?: JsonValue | string | null;
  children?: React.ReactNode;
  hideAvatar?: boolean;
  currentProfile?: ClientProfile;
  disableHoverShadow?: boolean;
  avatarAnimationMode?: "inherit" | "never" | "onHover";
  avatarIsHovered?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const UserAvatarMenu = memo(function UserAvatarMenu({
  profileId,
  profileImageUrl,
  username,
  discriminator,
  currentProfileId,
  className,
  showStatus = true,
  statusOffset,
  ringColorClass,
  memberId,
  memberRole,
  showRole = false,
  usernameColor,
  usernameFormat,
  children,
  hideAvatar = false,
  currentProfile,
  disableHoverShadow = false,
  avatarAnimationMode = "inherit",
  avatarIsHovered,
  open,
  defaultOpen,
  onOpenChange,
}: UserAvatarMenuProps) {
  const currentBoardId = useBoardNavigationStore(
    (state) => state.currentBoardId,
  );
  const isClientNavigationEnabled = useBoardNavigationStore(
    (state) => state.isClientNavigationEnabled,
  );
  const switchConversation = useBoardNavigationStore(
    (state) => state.switchConversation,
  );

  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(
    () => defaultOpen ?? false,
  );
  const isOpen = isControlled ? (open as boolean) : uncontrolledOpen;
  const setIsOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (!isControlled) setUncontrolledOpen(next);
    },
    [isControlled, onOpenChange],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();

  const { invalidateConversations } = useInvalidateConversations();
  const onOpenOverlay = useOverlayStore(
    useCallback((state) => state.onOpen, []),
  );

  const isSelf = profileId === currentProfileId;

  const handleSendMessage = async () => {
    if (isSelf) return;

    try {
      setIsLoading(true);

      const response = await axios.post("/api/conversations", {
        profileId,
        ...(memberId && { memberId }),
      });

      const conversationId = response.data.id;
      await invalidateConversations();
      setIsOpen(false);

      startTransition(() => {
        if (currentBoardId && isClientNavigationEnabled) {
          switchConversation(conversationId);
        } else if (currentBoardId) {
          window.location.href = `/boards/${currentBoardId}/conversations/${conversationId}`;
        } else {
          window.location.href = `/conversations/${conversationId}`;
        }
      });
    } catch (error) {
      console.error("Error creating conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerContent =
    hideAvatar && children ? (
      children
    ) : (
      <UserAvatar
        src={profileImageUrl}
        profileId={profileId}
        usernameColor={usernameColor}
        showStatus={showStatus}
        statusOffset={statusOffset}
        ringColorClass={ringColorClass}
        memberRole={memberRole}
        showRole={showRole}
        className={className}
        animationMode={avatarAnimationMode}
        isHovered={avatarIsHovered}
      />
    );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {hideAvatar ? (
          <span
            className={cn(
              "inline-flex cursor-pointer transition",
              !disableHoverShadow && "hover:drop-shadow-md",
            )}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
          >
            {triggerContent}
          </span>
        ) : (
          <div
            className={cn(
              "cursor-pointer transition",
              !disableHoverShadow && "hover:drop-shadow-md",
              className,
            )}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
          >
            {triggerContent}
          </div>
        )}
      </PopoverTrigger>

      {isOpen ? (
        <UserAvatarMenuContent
          profileId={profileId}
          profileImageUrl={profileImageUrl}
          username={username}
          discriminator={discriminator}
          currentProfileId={currentProfileId}
          usernameColor={usernameColor}
          usernameFormat={usernameFormat}
          isSelf={isSelf}
          showStatus={showStatus}
          isLoading={isLoading}
          currentProfile={currentProfile}
          onClose={() => setIsOpen(false)}
          onSendMessage={handleSendMessage}
          onPersonalizeProfile={() =>
            onOpenOverlay("profileSettings", { user: currentProfile })
          }
        />
      ) : null}
    </Popover>
  );
});

interface UserAvatarMenuContentProps {
  profileId: string;
  profileImageUrl: string;
  username: string;
  discriminator?: string | null;
  currentProfileId: string;
  usernameColor?: JsonValue | string | null;
  usernameFormat?: JsonValue | string | null;
  isSelf: boolean;
  showStatus: boolean;
  isLoading: boolean;
  currentProfile?: ClientProfile;
  onClose: () => void;
  onSendMessage: () => void;
  onPersonalizeProfile: () => void;
}

function UserAvatarMenuContent({
  profileId,
  profileImageUrl,
  username,
  discriminator,
  currentProfileId,
  usernameColor,
  usernameFormat,
  isSelf,
  showStatus,
  isLoading,
  currentProfile,
  onClose,
  onSendMessage,
  onPersonalizeProfile,
}: UserAvatarMenuContentProps) {
  const { t } = useTranslation();
  const { onOpen } = useModal();
  const { resolvedTheme } = useTheme();
  const { data: profileCard, isLoading: isLoadingProfile } = useProfileCard(
    profileId,
    currentProfileId,
    true,
  );
  const fallbackUsernameFormat =
    typeof usernameFormat === "string" ||
    (usernameFormat !== null &&
      usernameFormat !== undefined &&
      typeof usernameFormat === "object" &&
      !Array.isArray(usernameFormat))
      ? usernameFormat
      : null;

  const displayData = {
    username: profileCard?.username || username,
    discriminator: profileCard?.discriminator ?? discriminator,
    usernameColor: profileCard?.usernameColor ?? usernameColor,
    usernameFormat: profileCard?.usernameFormat ?? fallbackUsernameFormat,
    badge: profileCard?.badge ?? null,
    badgeStickerUrl: profileCard?.badgeSticker?.asset?.url ?? null,
  };
  const displayProfileImageUrl =
    profileCard?.avatarAsset?.url || profileImageUrl;
  const displayBannerUrl = profileCard?.bannerAsset?.url ?? null;
  const themeMode: "dark" | "light" =
    resolvedTheme === "light" ? "light" : "dark";
  const iconButtonClass =
    "flex h-8 w-8 items-center justify-center cursor-pointer rounded-none border border-theme-border bg-theme-bg-primary/55 text-theme-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_1px_0_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(0,0,0,0.38),inset_0_-1px_0_rgba(0,0,0,0.38)] transition hover:bg-theme-bg-primary/72 hover:text-theme-text-secondary focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 active:outline-none disabled:cursor-not-allowed disabled:opacity-50";

  const handleReportUser = useCallback(() => {
    onClose();
    onOpen("reportProfile", {
      reportProfileId: profileId,
      reportProfileUsername: displayData.username,
      reportProfileDiscriminator: displayData.discriminator,
      reportProfileImageUrl: displayProfileImageUrl,
      profileId: currentProfileId,
    });
  }, [
    currentProfileId,
    displayData.discriminator,
    displayData.username,
    displayProfileImageUrl,
    onClose,
    onOpen,
    profileId,
  ]);

  return (
    <PopoverContent
      className="w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-none border border-theme-border-secondary bg-theme-bg-dropdown-menu-primary p-0"
      side="right"
      align="start"
      sideOffset={8}
      onOpenAutoFocus={(event) => event.preventDefault()}
    >
      {profileCard ? (
        <ProfileCardRenderer
          profileId={profileId}
          username={displayData.username}
          discriminator={displayData.discriminator}
          avatarUrl={displayProfileImageUrl}
          bannerUrl={displayBannerUrl}
          badge={displayData.badge}
          badgeStickerUrl={displayData.badgeStickerUrl}
          usernameColor={displayData.usernameColor}
          usernameFormat={displayData.usernameFormat}
          themeMode={themeMode}
          isOwnProfile={isSelf}
          showStatus={showStatus}
          profileCard={profileCard}
          className="scrollbar-ultra-thin max-h-[38rem] overflow-y-auto overscroll-contain"
          headerActions={
            isSelf && currentProfile ? (
              <ActionTooltip side="top" label={t.userMenu.personalizeProfile}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPersonalizeProfile();
                  }}
                  className={iconButtonClass}
                  aria-label={t.userMenu.personalizeProfile}
                >
                  <SquarePen className="h-4 w-4" />
                </button>
              </ActionTooltip>
            ) : !isSelf ? (
              <>
                <ActionTooltip
                  side="top"
                  label={
                    isLoading
                      ? t.userMenu.opening
                      : t.userMenu.sendPrivateMessage
                  }
                >
                  <button
                    type="button"
                    onClick={onSendMessage}
                    disabled={isLoading}
                    className={iconButtonClass}
                    aria-label={
                      isLoading
                        ? t.userMenu.opening
                        : t.userMenu.sendPrivateMessage
                    }
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                </ActionTooltip>
                <ActionTooltip side="top" label={t.userMenu.reportUser}>
                  <button
                    type="button"
                    onClick={handleReportUser}
                    className={iconButtonClass}
                    aria-label={t.userMenu.reportUser}
                  >
                    <Siren className="h-4 w-4" />
                  </button>
                </ActionTooltip>
              </>
            ) : null
          }
        />
      ) : (
        <div className="min-w-0 flex-1 border border-theme-border bg-theme-bg-quaternary px-3 py-2 text-sm text-theme-text-secondary">
          {isLoadingProfile ? "Cargando..." : "No se pudo cargar el perfil"}
        </div>
      )}
    </PopoverContent>
  );
}
