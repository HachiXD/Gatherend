"use client";

import { useCallback, useState, useTransition } from "react";
import axios from "axios";
import Image from "next/image";
import { UserAvatar } from "@/components/user-avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MessageSquare, SquarePen, ChevronRight, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInvalidateConversations } from "@/hooks/use-conversations";
import { useOverlayStore } from "@/hooks/use-overlay-store";
import { useBoardNavigationStore } from "@/stores/board-navigation-store";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { useProfileCard } from "@/hooks/use-profile-card";
import { useModal } from "@/hooks/use-modal-store";
import { useTranslation } from "@/i18n";
import { useTheme } from "next-themes";
import {
  getUsernameColorStyle,
  getGradientAnimationClass,
} from "@/lib/username-color";
import { getUsernameFormatClasses } from "@/lib/username-format";
import { JsonValue } from "@prisma/client/runtime/library";

// MemberRole type (matches Prisma enum)
type MemberRole = "OWNER" | "ADMIN" | "MODERATOR" | "GUEST";

interface UserAvatarMenuProps {
  profileId: string;
  profileImageUrl: string;
  username: string;
  discriminator?: string | null;
  currentProfileId: string;
  className?: string;
  showStatus?: boolean;
  statusOffset?: string; // Offset del indicador de status
  ringColorClass?: string; // Color del ring de los indicadores
  // Para saber si estamos en el contexto de un canal (con memberId)
  memberId?: string;
  // Rol del miembro en el board
  memberRole?: MemberRole;
  showRole?: boolean;
  // Profile customization - datos iniciales (opcionales, se fetchean on-demand)
  usernameColor?: JsonValue | string | null;
  usernameFormat?: JsonValue | string | null; // Now supports JSON format
  // Custom trigger - cuando se pasa children, se usa como trigger
  children?: React.ReactNode;
  // Ocultar el avatar y usar solo children como trigger
  hideAvatar?: boolean;
  // Profile completo del usuario actual (para abrir overlay de personalización)
  currentProfile?: ClientProfile;
  // Deshabilitar sombra en hover
  disableHoverShadow?: boolean;
  // Avatar animation controls (delegated to UserAvatar)
  avatarAnimationMode?: "inherit" | "never" | "onHover";
  avatarIsHovered?: boolean;

  // Optional controlled/uncontrolled open state.
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const UserAvatarMenu = ({
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
}: UserAvatarMenuProps) => {
  // Solo necesitamos boardId para navegar; evitar hooks del App Router / routing completo
  // para no re-renderizar en cada navegación (p.ej. al ir a discovery).
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

  // Hook para invalidar conversaciones (actualiza la lista sin router.refresh)
  const { invalidateConversations } = useInvalidateConversations();

  // Hook para abrir el overlay de profile settings
  // Solo suscribirse a la acción para evitar re-renders cuando cambia el estado global del overlay.
  const onOpenOverlay = useOverlayStore(
    useCallback((state) => state.onOpen, []),
  );

  // Verificar si es el usuario actual
  const isSelf = profileId === currentProfileId;

  const handleSendMessage = async () => {
    if (isSelf) return;

    try {
      setIsLoading(true);

      // Crear o obtener la conversación
      const response = await axios.post("/api/conversations", {
        profileId,
        ...(memberId && { memberId }), // Incluir memberId si existe
      });

      const conversationId = response.data.id;

      // Invalidar la query de conversaciones para que se actualice la lista
      // Esto maneja el caso donde se reabre una conversación oculta
      await invalidateConversations();

      setIsOpen(false);

      startTransition(() => {
        // Usar navegación SPA si estamos en un board y el contexto está disponible
        if (currentBoardId && isClientNavigationEnabled) {
          switchConversation(conversationId);
        } else if (currentBoardId) {
          // Fallback: navegación tradicional si el contexto no está listo
          window.location.href = `/boards/${currentBoardId}/conversations/${conversationId}`;
        } else {
          window.location.href = `/conversations/${conversationId}`;
        }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error creating conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Determinar qué renderizar como trigger
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
              // Keep the wrapper from affecting line-height (important for chat username triggers).
              "inline-flex",
              "cursor-pointer transition",
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

      {/* Mount query/theme work only when open to avoid extra commits during navigation. */}
      {isOpen && (
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
      )}
    </Popover>
  );
};

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
  const { resolvedTheme } = useTheme();

  // Fetch datos completos del perfil solo cuando el popover está abierto (este componente).
  const { data: profileCard, isLoading: isLoadingProfile } = useProfileCard(
    profileId,
    currentProfileId,
    true,
  );

  // Usar datos del fetch si están disponibles, sino usar props iniciales
  const displayData = {
    username: profileCard?.username || username,
    discriminator: profileCard?.discriminator ?? discriminator,
    usernameColor: profileCard?.usernameColor ?? usernameColor,
    usernameFormat: profileCard?.usernameFormat ?? usernameFormat,
    badge: profileCard?.badge ?? null,
    badgeStickerUrl: profileCard?.badgeSticker?.asset?.url ?? null,
    longDescription: profileCard?.longDescription ?? null,
  };
  const displayProfileImageUrl = profileCard?.avatarAsset?.url || profileImageUrl;

  return (
    <PopoverContent
      className="w-64 p-3 bg-theme-bg-dropdown-menu-primary border border-theme-border-secondary"
      side="right"
      align="start"
      sideOffset={8}
    >
      {/* Header con info del usuario */}
      <div className="flex items-start gap-3 pb-3 border-b border-theme-border-secondary">
        {/* Menu header avatar: not tied to external hover (always renders as-is). */}
        <UserAvatar
          src={displayProfileImageUrl}
          profileId={profileId}
          showStatus={showStatus}
          className="h-12 w-12"
          ringColorClass="bg-theme-bg-dropdown-menu-primary"
        />
        <div className="flex flex-col flex-1 min-w-0">
          <span
            className={cn(
              "text-sm text-theme-text-primary truncate",
              getUsernameFormatClasses(displayData.usernameFormat),
              getGradientAnimationClass(displayData.usernameColor),
            )}
            style={getUsernameColorStyle(displayData.usernameColor, {
              isOwnProfile: isSelf,
              themeMode: (resolvedTheme as "dark" | "light") || "dark",
            })}
          >
            {displayData.username}
            {displayData.discriminator && (
              <span
                className="text-theme-text-muted text-[14px] font-normal"
                style={{
                  WebkitTextFillColor: "initial",
                  background: "none",
                }}
              >
                /{displayData.discriminator}
              </span>
            )}
          </span>

          {/* Badge section - con loading state */}
          {isLoadingProfile ? (
            <div className="h-4 w-20 bg-theme-bg-tertiary animate-pulse rounded mt-1" />
          ) : (
            (displayData.badge || displayData.badgeStickerUrl) && (
              <div className="flex items-center gap-1.5">
                {displayData.badgeStickerUrl && (
                  <div className="relative h-4 w-4 flex-shrink-0">
                    {displayData.badgeStickerUrl.endsWith(".gif") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={displayData.badgeStickerUrl}
                        alt="badge"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Image
                        src={displayData.badgeStickerUrl}
                        alt="badge"
                        fill
                        className="object-contain"
                      />
                    )}
                  </div>
                )}
                {displayData.badge && (
                  <span className="text-xs text-theme-text-muted truncate">
                    {displayData.badge}
                  </span>
                )}
              </div>
            )
          )}

          {isSelf && (
            <span className="text-xs text-theme-text-muted">
              {t.userMenu.you}
            </span>
          )}
        </div>
      </div>

      {/* Long Description - con loading state */}
      {isLoadingProfile ? (
        <div className="py-2 border-b border-theme-border-secondary">
          <div className="space-y-1">
            <div className="h-3 w-full bg-theme-bg-tertiary animate-pulse rounded" />
            <div className="h-3 w-2/3 bg-theme-bg-tertiary animate-pulse rounded" />
          </div>
        </div>
      ) : (
        displayData.longDescription && (
          <div className="py-2 border-b border-theme-border-secondary">
            <p className="text-xs text-theme-text-subtle whitespace-pre-wrap break-words">
              {displayData.longDescription}
            </p>
          </div>
        )
      )}

      {/* Personalize profile button - Solo para el propio usuario */}
      {isSelf && currentProfile && (
        <div className="pt-2">
          <button
            onClick={() => {
              onClose();
              onPersonalizeProfile();
            }}
            className="w-full cursor-pointer hover:bg-theme-menu-hover flex items-center gap-2 p-2 text-sm text-theme-text-subtle rounded-md transition"
          >
            <SquarePen className="h-4 w-4" />
            <span>{t.userMenu.personalizeProfile}</span>
          </button>
        </div>
      )}

      {/* Opciones del menú - Solo mostrar si no es el mismo usuario */}
      {!isSelf && (
        <div className="pt-2 space-y-1">
          <button
            onClick={onSendMessage}
            disabled={isLoading}
            className="w-full flex cursor-pointer items-center hover:bg-theme-menu-hover gap-2 p-2 text-sm text-theme-text-subtle rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageSquare className="h-4 w-4" />
            <span>
              {isLoading ? t.userMenu.opening : t.userMenu.sendPrivateMessage}
            </span>
          </button>

          {/* More Menu with Report User */}
          <MoreMenu
            profileId={profileId}
            username={displayData.username}
            discriminator={displayData.discriminator}
            profileImageUrl={displayProfileImageUrl}
            currentProfileId={currentProfileId}
            onCloseParent={onClose}
          />
        </div>
      )}
    </PopoverContent>
  );
}

// Separate component for More Menu to handle nested popover state
interface MoreMenuProps {
  profileId: string;
  username: string;
  discriminator?: string | null;
  profileImageUrl: string;
  currentProfileId: string;
  onCloseParent: () => void;
}

const MoreMenu = ({
  profileId,
  username,
  discriminator,
  profileImageUrl,
  currentProfileId,
  onCloseParent,
}: MoreMenuProps) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { onOpen } = useModal();
  const { t } = useTranslation();

  const handleReportUser = () => {
    setIsMoreOpen(false);
    onCloseParent();
    onOpen("reportProfile", {
      reportProfileId: profileId,
      reportProfileUsername: username,
      reportProfileDiscriminator: discriminator,
      reportProfileImageUrl: profileImageUrl,
      profileId: currentProfileId,
    });
  };

  return (
    <Popover open={isMoreOpen} onOpenChange={setIsMoreOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex cursor-pointer items-center justify-between hover:bg-theme-menu-hover gap-2 p-2 text-sm text-theme-text-subtle rounded-md transition">
          <span>{t.userMenu.more}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-48 p-1 bg-theme-bg-dropdown-menu-primary border border-theme-border-secondary"
        side="right"
        align="start"
        sideOffset={4}
      >
        <button
          onClick={handleReportUser}
          className="w-full flex cursor-pointer items-center gap-2 p-2 text-sm text-red-400 hover:bg-theme-menu-hover rounded-md transition"
        >
          <Siren className="h-4 w-4" />
          <span>{t.userMenu.reportUser}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
};
