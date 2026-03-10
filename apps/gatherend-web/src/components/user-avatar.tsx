"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { usePresenceStore } from "@/hooks/use-presence-store";
import { Crown, Shield, ShieldCheck, User } from "lucide-react";
import { getProfileAvatarUrl, stringToColor } from "@/lib/avatar-utils";
import { getNeverAnimatedImageUrl } from "@/lib/media-static";
import { AnimatedSticker } from "@/components/ui/animated-sticker";
import { canUseImgproxy, isAnimatedFormat } from "@/lib/imgproxy-utils";
import { getOptimizedStaticUiImageUrl } from "@/lib/ui-image-optimizer";
import { getDisplayColor } from "@/lib/username-color";
import { JsonValue } from "@prisma/client/runtime/library";

// Tipo para los roles de miembro
type MemberRole = "OWNER" | "ADMIN" | "MODERATOR" | "GUEST";

// Configuración de iconos y clases CSS por rol (usando variables CSS)
const roleConfig: Record<
  MemberRole,
  { icon: typeof Crown; colorClass: string; bgClass: string }
> = {
  OWNER: {
    icon: Crown,
    colorClass: "text-role-owner-text",
    bgClass: "bg-role-owner-bg",
  },
  ADMIN: {
    icon: Shield,
    colorClass: "text-role-admin-text",
    bgClass: "bg-role-admin-bg",
  },
  MODERATOR: {
    icon: ShieldCheck,
    colorClass: "text-role-mod-text",
    bgClass: "bg-role-mod-bg",
  },
  GUEST: {
    icon: User,
    colorClass: "text-role-guest-text",
    bgClass: "bg-role-guest-bg",
  },
};

// Componentes de indicadores exportados
// Para uso externo cuando se necesita renderizar
// fuera del contenedor con transform

interface StatusIndicatorProps {
  profileId?: string;
  status?: "active" | "inactive";
  ringColorClass?: string;
  className?: string;
}

export const StatusIndicator = ({
  profileId,
  status,
  ringColorClass,
  className,
}: StatusIndicatorProps) => {
  const isOnlineFromStore = usePresenceStore(
    useCallback(
      (state) => (profileId ? state.onlineUsers.has(profileId) : false),
      [profileId],
    ),
  );
  const isUserOnline = profileId ? isOnlineFromStore : status === "active";

  return (
    <span
      className={cn(
        "rounded-full p-[2px]",
        ringColorClass || "indicator-ring",
        className,
      )}
    >
      <span
        className={cn(
          "block rounded-full w-full h-full",
          isUserOnline ? "bg-emerald-600" : "bg-zinc-500",
        )}
      />
    </span>
  );
};

interface RoleIndicatorProps {
  memberRole: MemberRole;
  ringColorClass?: string;
  className?: string;
}

export const RoleIndicator = ({
  memberRole,
  ringColorClass,
  className,
}: RoleIndicatorProps) => {
  const roleInfo = roleConfig[memberRole];
  const RoleIcon = roleInfo?.icon;

  if (!roleInfo || !RoleIcon) return null;

  return (
    <span
      className={cn(
        "rounded-full p-[2px]",
        ringColorClass || "indicator-ring",
        className,
      )}
      title={memberRole}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full w-full h-full",
          roleInfo.bgClass,
        )}
      >
        <RoleIcon
          className={cn("h-[70%] w-[70%]", roleInfo.colorClass)}
          strokeWidth={2.5}
        />
      </span>
    </span>
  );
};

// Componente UserAvatar principal

interface UserAvatarProps {
  src?: string;
  profileId?: string;
  usernameColor?: JsonValue | string | null;
  status?: "active" | "inactive";
  className?: string;
  /** Optional explicit pixel size for static optimization (dpr=1). */
  sizePx?: number;
  showStatus?: boolean;
  memberRole?: MemberRole;
  showRole?: boolean;
  statusOffset?: string;
  ringColorClass?: string;
  // Color del ring superpuesto (por defecto bg-theme-bg-secondary)
  overlayRingColorClass?: string;
  // Nueva prop: deshabilitar indicadores internos (para renderizarlos externamente)
  disableInternalIndicators?: boolean;
  /**
   * Avatar animation policy:
   * - "inherit": render `src` as-is (may animate if it's an animated format)
   * - "never": always render a static first-frame preview for our CDN assets
   * - "onHover": static by default and animate only when `isHovered` is true (group-hover control)
   */
  animationMode?: "inherit" | "never" | "onHover";
  /** External hover state for animationMode="onHover" */
  isHovered?: boolean;
}

export const UserAvatar = ({
  src,
  profileId,
  usernameColor,
  status,
  className,
  sizePx,
  showStatus = true,
  memberRole,
  showRole = false,
  statusOffset = "right-0",
  ringColorClass,
  overlayRingColorClass = "bg-theme-bg-secondary",
  disableInternalIndicators = false,
  animationMode = "inherit",
  isHovered,
}: UserAvatarProps) => {
  const isOnlineFromStore = usePresenceStore(
    useCallback(
      (state) => (profileId ? state.onlineUsers.has(profileId) : false),
      [profileId],
    ),
  );

  const isUserOnline = profileId ? isOnlineFromStore : status === "active";

  const roleInfo = memberRole ? roleConfig[memberRole] : null;
  const RoleIcon = roleInfo?.icon;

  // Generar URL de fallback con DiceBear Thumbs si hay profileId
  const fallbackAvatarUrl = useMemo(() => {
    if (profileId) {
      return getProfileAvatarUrl(null, profileId);
    }
    return null;
  }, [profileId]);

  const fallbackBgColor = useMemo(() => {
    if (usernameColor != null) return getDisplayColor(usernameColor);
    if (profileId) return `#${stringToColor(profileId)}`;
    return getDisplayColor(null);
  }, [profileId, usernameColor]);

  const resolvedSrc = src || fallbackAvatarUrl;
  const [currentSrc, setCurrentSrc] = useState<string | null>(resolvedSrc);
  const [disableStaticOptimization, setDisableStaticOptimization] =
    useState(false);

  useEffect(() => {
    setCurrentSrc(resolvedSrc);
  }, [resolvedSrc]);

  useEffect(() => {
    setDisableStaticOptimization(false);
  }, [currentSrc]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const canGuaranteeStatic =
    !!apiUrl &&
    !!currentSrc &&
    isAnimatedFormat(currentSrc) &&
    canUseImgproxy(currentSrc);

  const staticSrc = useMemo(() => {
    // Only rewrites for our own CDN animated formats; otherwise returns currentSrc.
    return getNeverAnimatedImageUrl(currentSrc ?? "", {
      w: 256,
      h: 256,
      q: 82,
      fmt: "webp",
    });
  }, [currentSrc]);

  // Avatar sizing: Radix Avatar defaults to size-8, so keep parity for non-Radix render paths.
  const avatarBoxClass = cn(
    "rounded-full overflow-hidden",
    className ?? "h-8 w-8",
  );

  const inferredSizePx = useMemo(() => {
    if (sizePx && Number.isFinite(sizePx)) return sizePx;
    if (!className) return 32;

    // Support arbitrary Tailwind values like `h-[48px]`.
    const bracket = /(?:^|\s)h-\[(\d+(?:\.\d+)?)px\](?:\s|$)/.exec(className);
    if (bracket?.[1]) {
      const v = Number(bracket[1]);
      if (Number.isFinite(v) && v > 0) return Math.round(v);
    }

    // Support common Tailwind scale tokens: `h-8` => 32px, `h-12` => 48px, etc.
    const token = /(?:^|\s)h-(\d+)(?:\s|$)/.exec(className);
    const n = token?.[1] ? Number(token[1]) : NaN;
    if (!Number.isFinite(n)) return null;
    // Tailwind spacing scale: 1 => 0.25rem => 4px.
    return Math.round(n * 4);
  }, [className, sizePx]);

  const optimizedStaticSrc = useMemo(() => {
    if (disableStaticOptimization) return currentSrc;
    // Only optimize explicit user-provided sources (avoid coupling our fallback to imgproxy config).
    if (!src) return currentSrc;
    if (!inferredSizePx) return currentSrc;
    if (currentSrc === fallbackAvatarUrl) return currentSrc;

    return getOptimizedStaticUiImageUrl(currentSrc ?? "", {
      w: inferredSizePx,
      h: inferredSizePx,
      q: 82,
      resize: "fill",
      // Keep parity with other UI surfaces (nav-item / leftbar-banner). `face` is not always
      // supported by every imgproxy build and can cause a fallback to the original src.
      gravity: "sm",
    });
  }, [
    currentSrc,
    disableStaticOptimization,
    fallbackAvatarUrl,
    inferredSizePx,
    src,
  ]);

  const avatarVisual =
    animationMode === "onHover" && canGuaranteeStatic ? (
      <AnimatedSticker
        src={currentSrc ?? ""}
        alt="avatar"
        isHovered={isHovered}
        containerClassName={avatarBoxClass}
        fallbackWidthPx={32}
        fallbackHeightPx={32}
        className="object-cover"
      />
    ) : animationMode === "never" && canGuaranteeStatic ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={staticSrc}
        alt="avatar"
        className={cn(
          "block rounded-full object-cover",
          className ?? "h-8 w-8",
        )}
        loading="eager"
        decoding="async"
        onError={() => setCurrentSrc(fallbackAvatarUrl)}
      />
    ) : (
      <div
        className={avatarBoxClass}
        style={{
          backgroundColor: fallbackBgColor,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={optimizedStaticSrc ?? undefined}
          alt="avatar"
          className="block h-full w-full object-cover"
          loading="eager"
          decoding="async"
          onError={() => {
            // If imgproxy (or any optimization path) fails, retry the original source once.
            if (
              !disableStaticOptimization &&
              optimizedStaticSrc !== currentSrc
            ) {
              setDisableStaticOptimization(true);
              return;
            }
            setCurrentSrc(fallbackAvatarUrl);
          }}
        />
      </div>
    );

  // Si los indicadores están deshabilitados, solo renderizar el avatar
  if (disableInternalIndicators) {
    return <div className="relative">{avatarVisual}</div>;
  }

  return (
    <div className="relative">
      {avatarVisual}

      {/* Indicador de rol - esquina inferior izquierda */}
      {/* Estructura: ring degradado (abajo) + ring bg-secondary superpuesto (arriba) -> contenido */}
      {showRole && roleInfo && RoleIcon && (
        <span
          className={cn(
            "absolute rounded-full p-[2px] aspect-square",
            "w-[60%] min-w-3 max-w-5",
            "bottom-0 left-0 -translate-x-[15%] translate-y-[15%]",
            ringColorClass || "indicator-ring",
          )}
          title={memberRole}
        >
          {/* Ring superpuesto - mismo tamaño, posición absolute */}
          <span
            className={cn(
              "absolute inset-0 rounded-full p-[2px]",
              overlayRingColorClass,
            )}
          />
          {/* Contenido del indicador */}
          <span
            className={cn(
              "relative flex items-center justify-center rounded-full w-full h-full",
              roleInfo.bgClass,
            )}
          >
            <RoleIcon
              className={cn("w-[70%] h-[70%]", roleInfo.colorClass)}
              strokeWidth={2.5}
            />
          </span>
        </span>
      )}

      {/* Indicador de status - esquina inferior derecha */}
      {/* Estructura: ring degradado (abajo) + ring bg-secondary superpuesto (arriba) -> contenido */}
      {showStatus && (
        <span
          className={cn(
            "absolute rounded-full p-[2px] aspect-square",
            "w-[30%] min-w-2 max-w-4",
            "bottom-0",
            statusOffset,
            ringColorClass || "indicator-ring",
          )}
        >
          {/* Ring superpuesto - mismo tamaño, posición absolute */}
          <span
            className={cn(
              "absolute inset-0 rounded-full p-[2px]",
              overlayRingColorClass,
            )}
          />
          {/* Contenido del indicador */}
          <span
            className={cn(
              "relative block rounded-full w-full h-full",
              isUserOnline ? "bg-emerald-600" : "bg-zinc-500",
            )}
          />
        </span>
      )}
    </div>
  );
};

// Exportar roleConfig para uso externo si es necesario
export { roleConfig };
export type { MemberRole };
