"use client";

import Image from "next/image";
import { memo } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import {
  resolveProfileCardLayout,
  findProfileCardNode,
} from "@/lib/profile-card-layout";
import type { ProfileCardConfig } from "@/lib/profile-card-config";
import type { ProfileCard } from "@/hooks/use-profile-card";
import type { UsernameFormatConfig } from "@/lib/username-format";
import {
  getUsernameColorStyle,
  getGradientAnimationClass,
} from "@/lib/username-color";
import { getUsernameFormatClasses } from "@/lib/username-format";
import type { JsonValue } from "@prisma/client/runtime/library";

const DEFAULT_PROFILE_CARD_STYLE = {
  backgroundColor: "#707070",
  boxColor: "#8a8a8a",
  rounded: false,
  shadows: true,
} as const;

function trimToNull(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getForegroundFromBg(bgHex: string): {
  fg: string;
  fgSubtle: string;
  fgMuted: string;
} {
  const r = parseInt(bgHex.slice(1, 3), 16);
  const g = parseInt(bgHex.slice(3, 5), 16);
  const b = parseInt(bgHex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return {
      fg: "#ffffff",
      fgSubtle: "rgba(255,255,255,0.65)",
      fgMuted: "rgba(255,255,255,0.45)",
    };
  }
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const onDark = luma <= 0.5;
  return {
    fg: onDark ? "#ffffff" : "#1a1a1a",
    fgSubtle: onDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)",
    fgMuted: onDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.40)",
  };
}

function buildEffectiveProfileCardConfig(
  profileCard: Pick<ProfileCard, "profileCardConfig">,
): ProfileCardConfig {
  if (profileCard.profileCardConfig) {
    return profileCard.profileCardConfig;
  }

  return {
    version: 1,
    style: { ...DEFAULT_PROFILE_CARD_STYLE },
    content: {},
  };
}

function MediaSurface({
  url,
  rounded,
}: {
  url: string | null | undefined;
  rounded: boolean;
}) {
  return (
    <div
      className={cn(
        "relative min-h-[5.75rem] flex-1 overflow-hidden border border-theme-border/80 bg-theme-bg-primary/45",
        rounded ? "rounded-md" : "rounded-none",
      )}
    >
      {url ? (
        url.endsWith(".gif") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Image src={url} alt="" fill className="object-cover" />
        )
      ) : null}
    </div>
  );
}

function CardShellBox({
  title,
  hideTitle = false,
  rounded,
  shadows,
  boxColor,
  className,
  children,
}: {
  title?: string | null;
  hideTitle?: boolean;
  rounded: boolean;
  shadows: boolean;
  boxColor: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { fg, fgSubtle, fgMuted } = getForegroundFromBg(boxColor);
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col border border-theme-border p-2",
        rounded ? "rounded-md" : "rounded-none",
        shadows
          ? "shadow-[2px_2px_0_rgba(0,0,0,0.18),inset_1px_1px_0_rgba(255,255,255,0.08)]"
          : "shadow-none",
        className,
      )}
      style={{
        backgroundColor: boxColor,
        "--box-fg": fg,
        "--box-fg-subtle": fgSubtle,
        "--box-fg-muted": fgMuted,
      } as React.CSSProperties}
    >
      {!hideTitle && title ? (
        <div className="border-b border-theme-border/80 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--box-fg-subtle)">
          {title}
        </div>
      ) : null}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          !hideTitle && title ? "mt-1" : "",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function TextBox({
  title,
  content,
  rounded,
  shadows,
  boxColor,
  className,
}: {
  title?: string | null;
  content: string;
  rounded: boolean;
  shadows: boolean;
  boxColor: string;
  className?: string;
}) {
  return (
    <CardShellBox
      title={title}
      rounded={rounded}
      shadows={shadows}
      boxColor={boxColor}
      className={className}
    >
      <p className="whitespace-pre-wrap break-words text-[13px] leading-5 text-(--box-fg)">
        {content}
      </p>
    </CardShellBox>
  );
}

function ImageBox({
  title,
  hideTitle = false,
  url,
  rounded,
  shadows,
  boxColor,
  className,
  flush = false,
}: {
  title?: string | null;
  hideTitle?: boolean;
  url: string | null | undefined;
  rounded: boolean;
  shadows: boolean;
  boxColor: string;
  className?: string;
  flush?: boolean;
}) {
  if (flush) {
    return (
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col overflow-hidden border border-theme-border",
          rounded ? "rounded-md" : "rounded-none",
          shadows
            ? "shadow-[2px_2px_0_rgba(0,0,0,0.18),inset_1px_1px_0_rgba(255,255,255,0.08)]"
            : "shadow-none",
          className,
        )}
        style={{ backgroundColor: boxColor }}
      >
        <MediaSurface url={url} rounded={rounded} />
      </div>
    );
  }

  return (
    <CardShellBox
      title={title}
      hideTitle={hideTitle}
      rounded={rounded}
      shadows={shadows}
      boxColor={boxColor}
      className={className}
    >
      <MediaSurface url={url} rounded={rounded} />
    </CardShellBox>
  );
}

function DualTextBox({
  sectionA,
  sectionB,
  rounded,
  shadows,
  boxColor,
}: {
  sectionA?: { title: string; content: string } | null;
  sectionB?: { title: string; content: string } | null;
  rounded: boolean;
  shadows: boolean;
  boxColor: string;
}) {
  return (
    <CardShellBox rounded={rounded} shadows={shadows} boxColor={boxColor}>
      <div className="flex min-h-[12.75rem] flex-1 flex-col gap-3">
        {sectionA ? (
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col border border-theme-border/70 p-2",
              rounded ? "rounded-md" : "rounded-none",
            )}
            style={{ backgroundColor: boxColor }}
          >
            <div className="border-b border-theme-border/80 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--box-fg-subtle)">
              {sectionA.title}
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-5 text-(--box-fg)">
              {sectionA.content}
            </p>
          </div>
        ) : null}

        {sectionB ? (
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col border border-theme-border/70 p-2",
              rounded ? "rounded-md" : "rounded-none",
            )}
            style={{ backgroundColor: boxColor }}
          >
            <div className="border-b border-theme-border/80 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-(--box-fg-subtle)">
              {sectionB.title}
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-5 text-(--box-fg)">
              {sectionB.content}
            </p>
          </div>
        ) : null}
      </div>
    </CardShellBox>
  );
}

function hasNode(
  layout: ReturnType<typeof resolveProfileCardLayout>,
  nodeId:
    | "topRow"
    | "bottomRow"
    | "bottomTextColumn"
    | "bottomImagesColumn"
    | "rightRow",
) {
  return Boolean(findProfileCardNode(layout.root, nodeId));
}

function getBranchChildCount(
  layout: ReturnType<typeof resolveProfileCardLayout>,
  nodeId:
    | "topRow"
    | "bottomRow"
    | "bottomTextColumn"
    | "bottomImagesColumn"
    | "rightRow",
) {
  const node = findProfileCardNode(layout.root, nodeId);
  return node?.kind === "branch" ? node.children.length : 0;
}

interface ProfileCardRendererProps {
  profileId: string;
  username: string;
  discriminator?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  badge?: string | null;
  badgeStickerUrl?: string | null;
  usernameColor?: JsonValue | null;
  usernameFormat?: UsernameFormatConfig | string | JsonValue | null;
  themeMode: "dark" | "light";
  isOwnProfile: boolean;
  showStatus?: boolean;
  profileCard: ProfileCard;
  className?: string;
  headerActions?: React.ReactNode;
}

export const ProfileCardRenderer = memo(function ProfileCardRenderer({
  profileId,
  username,
  discriminator,
  avatarUrl,
  bannerUrl,
  badge,
  badgeStickerUrl,
  usernameColor,
  usernameFormat,
  themeMode,
  isOwnProfile,
  showStatus = true,
  profileCard,
  className,
  headerActions,
}: ProfileCardRendererProps) {
  const effectiveConfig = buildEffectiveProfileCardConfig(profileCard);
  const style = {
    backgroundColor:
      effectiveConfig.style.backgroundColor ??
      DEFAULT_PROFILE_CARD_STYLE.backgroundColor,
    boxColor:
      effectiveConfig.style.boxColor ?? DEFAULT_PROFILE_CARD_STYLE.boxColor,
    rounded:
      effectiveConfig.style.rounded ?? DEFAULT_PROFILE_CARD_STYLE.rounded,
    shadows:
      effectiveConfig.style.shadows ?? DEFAULT_PROFILE_CARD_STYLE.shadows,
  };
  const content = effectiveConfig.content;
  const layout = resolveProfileCardLayout({
    profileCardConfig: effectiveConfig,
    profileCardLeftTopImageAsset: profileCard.profileCardLeftTopImageAsset,
    profileCardLeftBottomRightTopImageAsset:
      profileCard.profileCardLeftBottomRightTopImageAsset,
    profileCardLeftBottomRightBottomImageAsset:
      profileCard.profileCardLeftBottomRightBottomImageAsset,
    profileCardRightTopImageAsset: profileCard.profileCardRightTopImageAsset,
    profileCardRightBottomImageAsset:
      profileCard.profileCardRightBottomImageAsset,
  });
  return (
    <div
      className={cn(
        "overflow-hidden border border-theme-border shadow-[inset_1px_1px_0_rgba(255,255,255,0.08),inset_-1px_-1px_0_rgba(0,0,0,0.28)]",
        className,
      )}
      style={{ backgroundColor: style.backgroundColor }}
    >
      <div
        className="relative min-h-28 border-b border-theme-border bg-theme-bg-secondary"
        style={
          bannerUrl
            ? {
                backgroundImage: `url(${bannerUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : {
                backgroundColor: style.backgroundColor,
              }
        }
      >
        {headerActions ? (
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
            {headerActions}
          </div>
        ) : null}
        <div className="relative flex min-h-28 items-center justify-center p-3">
          <div className="flex flex-col items-center gap-0 text-center -mb-2">
            <div className="shrink-0 rounded-none  bg-transparent p-0 ">
              <UserAvatar
                src={avatarUrl || undefined}
                profileId={profileId}
                showStatus={showStatus}
                className="h-20 w-20"
                animationMode="never"
              />
            </div>

            <div className="min-w-0 bg-transparent px-3 py-0 ">
              <div
                className={cn(
                  "truncate text-[24px] font-bold",
                  getUsernameFormatClasses(usernameFormat),
                  getGradientAnimationClass(usernameColor),
                )}
                style={getUsernameColorStyle(usernameColor, {
                  isOwnProfile,
                  themeMode,
                })}
              >
                {username}
                {discriminator ? (
                  <span
                    className="ml-1 text-[20px] font-normal text-theme-text-muted"
                    style={{
                      WebkitTextFillColor: "initial",
                      background: "none",
                    }}
                  >
                    /{discriminator}
                  </span>
                ) : null}
              </div>

              {badge || badgeStickerUrl ? (
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  {badgeStickerUrl ? (
                    <div className="relative h-4 w-4 flex-shrink-0">
                      {badgeStickerUrl.endsWith(".gif") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={badgeStickerUrl}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Image
                          src={badgeStickerUrl}
                          alt=""
                          fill
                          className="object-contain"
                        />
                      )}
                    </div>
                  ) : null}
                  {badge ? (
                    <span className="truncate text-xs text-theme-text-muted">
                      {badge}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {layout.root ? (
        <div className="grid gap-3 p-3">
          {trimToNull(content.pageTitle) ? (
            <CardShellBox
              hideTitle
              rounded={style.rounded}
              shadows={style.shadows}
              boxColor={style.boxColor}
            >
              <div className="text-md font-semibold text-(--box-fg)">
                {content.pageTitle}
              </div>
            </CardShellBox>
          ) : null}

          {hasNode(layout, "topRow") ? (
            <div
              className={cn(
                "grid min-w-0 gap-3",
                getBranchChildCount(layout, "topRow") === 1
                  ? "grid-cols-1"
                  : "md:grid-cols-[minmax(0,0.5fr)_minmax(0,1.15fr)]",
              )}
            >
              {layout.activeSlots.leftTopImage ? (
                <ImageBox
                  hideTitle
                  url={profileCard.profileCardLeftTopImageAsset?.url}
                  rounded={style.rounded}
                  shadows={style.shadows}
                  boxColor={style.boxColor}
                  flush
                  className="min-h-44"
                />
              ) : null}
              {layout.activeSlots.leftTopText &&
              trimToNull(content.leftTopText?.content) ? (
                <TextBox
                  title={trimToNull(content.leftTopText?.title)}
                  content={content.leftTopText!.content}
                  rounded={style.rounded}
                  shadows={style.shadows}
                  boxColor={style.boxColor}
                  className="min-h-44"
                />
              ) : null}
            </div>
          ) : null}

          {hasNode(layout, "bottomRow") ? (
            <div
              className={cn(
                "grid min-w-0 gap-3",
                getBranchChildCount(layout, "bottomRow") === 1
                  ? "grid-cols-1"
                  : "md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)]",
              )}
            >
              {hasNode(layout, "bottomTextColumn") ? (
                <DualTextBox
                  sectionA={content.leftBottomText?.sectionA ?? null}
                  sectionB={content.leftBottomText?.sectionB ?? null}
                  rounded={style.rounded}
                  shadows={style.shadows}
                  boxColor={style.boxColor}
                />
              ) : null}

              {hasNode(layout, "bottomImagesColumn") ? (
                <div
                  className={cn(
                    "grid min-w-0 max-w-full gap-3 overflow-hidden",
                    getBranchChildCount(layout, "bottomImagesColumn") === 1
                      ? "grid-cols-1"
                      : "",
                  )}
                >
                  {layout.activeSlots.leftBottomRightTopImage ? (
                    <ImageBox
                      hideTitle
                      url={
                        profileCard.profileCardLeftBottomRightTopImageAsset?.url
                      }
                      rounded={style.rounded}
                      shadows={style.shadows}
                      boxColor={style.boxColor}
                      flush
                      className="min-h-24"
                    />
                  ) : null}
                  {layout.activeSlots.leftBottomRightBottomImage ? (
                    <ImageBox
                      hideTitle
                      url={
                        profileCard.profileCardLeftBottomRightBottomImageAsset
                          ?.url
                      }
                      rounded={style.rounded}
                      shadows={style.shadows}
                      boxColor={style.boxColor}
                      flush
                      className="min-h-24"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasNode(layout, "rightRow") ? (
            <div
              className={cn(
                "grid min-w-0 gap-3",
                getBranchChildCount(layout, "rightRow") === 1
                  ? "grid-cols-1"
                  : "md:grid-cols-2",
              )}
            >
              {layout.activeSlots.rightTopImage ? (
                <ImageBox
                  title={trimToNull(content.rightTopImage?.title)}
                  url={profileCard.profileCardRightTopImageAsset?.url}
                  rounded={style.rounded}
                  shadows={style.shadows}
                  boxColor={style.boxColor}
                  className="min-h-40"
                />
              ) : null}
              {layout.activeSlots.rightBottomImage ? (
                <ImageBox
                  title={trimToNull(content.rightBottomImage?.title)}
                  url={profileCard.profileCardRightBottomImageAsset?.url}
                  rounded={style.rounded}
                  shadows={style.shadows}
                  boxColor={style.boxColor}
                  className="min-h-40"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
