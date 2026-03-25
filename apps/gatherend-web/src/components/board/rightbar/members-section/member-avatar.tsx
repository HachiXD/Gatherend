"use client";

import { memo, useCallback, useState } from "react";
import { UserAvatarMenu } from "@/components/user-avatar-menu";
import { UserAvatar } from "@/components/user-avatar";
import type { ClientProfile } from "@/hooks/use-current-profile";
import { getRingBackground } from "@/lib/username-color";
import type { BoardMember } from "@/components/providers/board-provider";

interface MemberAvatarProps {
  member: BoardMember;
  currentProfileId: string;
  currentProfile?: ClientProfile;
  x: number;
  y: number;
  size: string;
}

/**
 * Avatar de miembro en el grid de slots.
 * Optimizado: sin event listeners individuales.
 * Los CSS custom properties para gradientes se calculan con CSS calc()
 * basado en la posición relativa (x, y) del componente.
 */
const MemberAvatarComponent = ({
  member,
  currentProfileId,
  currentProfile,
  x,
  y,
  size,
}: MemberAvatarProps) => {
  const [menuEnabled, setMenuEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isCurrent = member.profile.id === currentProfileId;

  const effectiveProfile = isCurrent && currentProfile ? currentProfile : null;
  const profileImageUrl =
    (effectiveProfile?.avatarAsset?.url ?? member.profile.avatarAsset?.url ?? "") || "";
  const username = effectiveProfile?.username ?? member.profile.username;
  const discriminator =
    effectiveProfile?.discriminator ?? member.profile.discriminator;
  const usernameColor =
    effectiveProfile?.usernameColor ?? member.profile.usernameColor;
  const usernameFormat =
    effectiveProfile?.usernameFormat ?? member.profile.usernameFormat;

  // Color del ring basado en usernameColor (soporta solid y gradient)
  const ringBackground = getRingBackground(usernameColor);

  const enableMenuOnce = useCallback(() => {
    setMenuEnabled(true);
  }, []);

  const openOnFirstInteraction = useCallback(
    (e: React.SyntheticEvent) => {
      if (menuEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      setMenuEnabled(true);
      setMenuOpen(true);
    },
    [menuEnabled],
  );

  const avatarTriggerEl = (
    <div
      className={`${size} aspect-square cursor-pointer transition`}
      onMouseEnter={enableMenuOnce}
      onClickCapture={openOnFirstInteraction}
      onKeyDownCapture={(e) => {
        if (menuEnabled) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        openOnFirstInteraction(e);
      }}
    >
      <UserAvatar
        src={profileImageUrl}
        profileId={member.profile.id}
        usernameColor={usernameColor}
        showStatus={true}
        memberRole={member.role}
        showRole={true}
        className={`${size} aspect-square`}
        statusOffset="right-0"
        ringColorClass="indicator-ring-slot"
        animationMode="never"
      />
    </div>
  );

  return (
    <div
      className="absolute group"
      style={
        {
          left: `${x}%`,
          top: `${y}%`,
          transform: "translate(-50%, -50%)",
          // Usar posición relativa para gradientes en lugar de viewport position
          // Esto evita necesitar event listeners de scroll/resize
          "--slot-x": `${x}%`,
          "--slot-y": `${y}%`,
        } as React.CSSProperties
      }
    >
      {/* Ring del avatar con el color del usuario */}
      <div
        className="rounded-full p-[2px] transition-transform duration-200 ease-out will-change-transform group-hover:scale-110"
        style={{
          background: ringBackground,
          transformOrigin: "center center",
        }}
      >
        {!menuEnabled ? (
          avatarTriggerEl
        ) : (
          <UserAvatarMenu
            profileId={member.profile.id}
            profileImageUrl={profileImageUrl}
            username={username}
            discriminator={discriminator}
            currentProfileId={currentProfileId}
            currentProfile={currentProfile}
            memberId={member.id}
            memberRole={member.role}
            showRole={true}
            className={`${size} aspect-square`}
            usernameColor={usernameColor}
            usernameFormat={usernameFormat}
            statusOffset="right-0"
            ringColorClass="indicator-ring-slot"
            disableHoverShadow
            avatarAnimationMode="never"
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />
        )}
      </div>
    </div>
  );
};

// Memoizar para evitar re-renders innecesarios
export const MemberAvatar = memo(MemberAvatarComponent, (prev, next) => {
  const prevIsCurrent = prev.member.profile.id === prev.currentProfileId;
  const nextIsCurrent = next.member.profile.id === next.currentProfileId;

  if (prevIsCurrent && nextIsCurrent) {
    if (
      prev.currentProfile?.avatarAsset?.id !== next.currentProfile?.avatarAsset?.id
    )
      return false;
    if (prev.currentProfile?.username !== next.currentProfile?.username)
      return false;
    if (
      prev.currentProfile?.discriminator !== next.currentProfile?.discriminator
    )
      return false;
    if (
      prev.currentProfile?.usernameColor !== next.currentProfile?.usernameColor
    )
      return false;
    if (
      prev.currentProfile?.usernameFormat !==
      next.currentProfile?.usernameFormat
    )
      return false;
  }

  return (
    prev.member.id === next.member.id &&
    prev.member.role === next.member.role &&
    prev.member.profile.id === next.member.profile.id &&
    prev.member.profile.username === next.member.profile.username &&
    prev.member.profile.discriminator === next.member.profile.discriminator &&
    prev.member.profile.avatarAsset?.id === next.member.profile.avatarAsset?.id &&
    prev.member.profile.usernameColor === next.member.profile.usernameColor &&
    prev.member.profile.usernameFormat === next.member.profile.usernameFormat &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.size === next.size &&
    prev.currentProfileId === next.currentProfileId
  );
});
