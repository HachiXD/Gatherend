"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ClientUploadedAsset } from "@/types/uploaded-assets";

export type ProfileCardImageSlot =
 | "leftTopImage"
 | "leftBottomRightTopImage"
 | "leftBottomRightBottomImage"
 | "rightTopImage"
 | "rightBottomImage";

export interface ProfileCardEditorDraft {
 style: {
 backgroundColor: string;
 boxColor: string;
 rounded: boolean;
 shadows: boolean;
 };
 content: {
 pageTitle: string;
 leftTopTextTitle: string;
 leftTopTextContent: string;
 sectionATitle: string;
 sectionAContent: string;
 sectionBTitle: string;
 sectionBContent: string;
 rightTopImageTitle: string;
 rightBottomImageTitle: string;
 };
 images: Record<
 ProfileCardImageSlot,
 {
 assetId: string | null;
 asset: ClientUploadedAsset | null;
 }
 >;
}

interface ProfileCardEditorShellProps {
 bannerUrl?: string | null;
 draft: ProfileCardEditorDraft;
 isSaving: boolean;
 isUploadingImage: boolean;
 isUploadingBanner: boolean;
 activeUploadSlot: ProfileCardImageSlot | null;
 avatarEditor: React.ReactNode;
 identityEditor: React.ReactNode;
 onStyleChange: (
 field: keyof ProfileCardEditorDraft["style"],
 value: string | boolean,
 ) => void;
 onContentChange: (
 field: keyof ProfileCardEditorDraft["content"],
 value: string,
 ) => void;
 onBannerUploadClick: () => void;
 onClearBanner: () => void;
 onUploadClick: (slot: ProfileCardImageSlot) => void;
 onClearImage: (slot: ProfileCardImageSlot) => void;
}

const INPUT_CLASS =
 "h-8 rounded-lg border-theme-border/80 bg-theme-bg-primary/70 px-2 text-[12px] text-theme-text-light focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0";
const TEXTAREA_CLASS =
 "scrollbar-ultra-thin min-h-[6.25rem] resize-none rounded-lg border-theme-border/80 bg-theme-bg-primary/70 px-2 py-2 text-[12px] text-theme-text-light focus-visible:border-theme-border-accent focus-visible:ring-0 focus-visible:ring-offset-0";

function ShellBox({
 label,
 className,
 hideLabel = false,
 rounded,
 shadows,
 boxColor,
 children,
}: {
 label?: string;
 className?: string;
 hideLabel?: boolean;
 rounded: boolean;
 shadows: boolean;
 boxColor: string;
 children: React.ReactNode;
}) {
 return (
 <div
 className={cn(
 "flex min-h-0 min-w-0 flex-col border border-theme-border p-2",
 rounded ? "rounded-md" : "rounded-lg",
 shadows
 ? "shadow-[2px_2px_0_rgba(0,0,0,0.18),inset_1px_1px_0_rgba(255,255,255,0.08)]"
 : "shadow-none",
 className,
 )}
 style={{ backgroundColor: boxColor }}
 >
 {!hideLabel && label ? (
 <div className="border-b border-theme-border/80 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-theme-text-muted">
 {label}
 </div>
 ) : null}
 <div
 className={cn("flex min-h-0 flex-1 flex-col", hideLabel ? "" : "mt-2")}
 >
 {children}
 </div>
 </div>
 );
}

function StyleToggle({
 label,
 pressed,
 disabled,
 onClick,
}: {
 label: string;
 pressed: boolean;
 disabled: boolean;
 onClick: () => void;
}) {
 return (
 <button
 type="button"
 disabled={disabled}
 onClick={onClick}
 className={cn(
 "h-8 cursor-pointer rounded-lg border px-0 text-[11px] font-semibold uppercase tracking-[0.08em] transition",
 pressed
 ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
 : "border-theme-border bg-theme-bg-primary/70 text-theme-text-subtle hover:bg-theme-bg-primary/90 hover:text-theme-text-light",
 )}
 >
 {label}
 </button>
 );
}

function ColorControl({
 label,
 value,
 disabled,
 onChange,
}: {
 label: string;
 value: string;
 disabled: boolean;
 onChange: (value: string) => void;
}) {
 return (
 <label className="flex min-w-0 items-center gap-2 rounded-lg border border-theme-border bg-theme-bg-primary/70 px-2 py-1">
 <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-theme-text-subtle">
 {label}
 </span>
 <div
 className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-theme-border"
 style={{ backgroundColor: value }}
 >
 <input
 type="color"
 value={value}
 disabled={disabled}
 onChange={(event) => onChange(event.target.value)}
 className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
 />
 </div>
 </label>
 );
}

function ImagePreview({
 asset,
 rounded,
}: {
 asset: ClientUploadedAsset | null;
 rounded: boolean;
}) {
 return (
 <div
 className={cn(
 "relative min-h-[5.75rem] flex-1 overflow-hidden border border-theme-border/80 bg-theme-bg-primary/55",
 rounded ? "rounded-md" : "rounded-lg",
 )}
 >
 {asset?.url ? (
 <div
 className="absolute inset-0 bg-cover bg-center"
 style={{ backgroundImage: `url(${asset.url})` }}
 />
 ) : (
 <div className="flex h-full items-center justify-center px-3 text-center text-[11px] uppercase tracking-[0.08em] text-theme-text-muted">
 Sin imagen
 </div>
 )}
 </div>
 );
}

function ImageSlotEditor({
 slot,
 label,
 titleValue,
 onTitleChange,
 asset,
 rounded,
 shadows,
 boxColor,
 hideLabel = false,
 isSaving,
 isUploadingImage,
 activeUploadSlot,
 onUploadClick,
 onClearImage,
 className,
}: {
 slot: ProfileCardImageSlot;
 label?: string;
 titleValue?: string;
 onTitleChange?: (value: string) => void;
 asset: ClientUploadedAsset | null;
 rounded: boolean;
 shadows: boolean;
 boxColor: string;
 hideLabel?: boolean;
 isSaving: boolean;
 isUploadingImage: boolean;
 activeUploadSlot: ProfileCardImageSlot | null;
 onUploadClick: (slot: ProfileCardImageSlot) => void;
 onClearImage: (slot: ProfileCardImageSlot) => void;
 className?: string;
}) {
 const isUploadingThisSlot = isUploadingImage && activeUploadSlot === slot;

 return (
 <ShellBox
 label={label}
 hideLabel={hideLabel}
 rounded={rounded}
 shadows={shadows}
 boxColor={boxColor}
 className={className}
 >
 {onTitleChange ? (
 <Input
 value={titleValue ?? ""}
 disabled={isSaving}
 onChange={(event) => onTitleChange(event.target.value)}
 placeholder="Titulo (opcional)"
 maxLength={10}
 className={INPUT_CLASS}
 />
 ) : null}

 <div className={cn("flex flex-1 flex-col", onTitleChange ? "mt-2" : "")}>
 <ImagePreview asset={asset} rounded={rounded} />

 <div className="mt-2 flex gap-2">
 <Button
 type="button"
 disabled={isSaving || isUploadingImage}
 onClick={() => onUploadClick(slot)}
 className="h-7 cursor-pointer rounded-lg border border-theme-border bg-theme-bg-cancel-button px-2 text-[11px] uppercase tracking-[0.08em] text-theme-text-subtle hover:bg-theme-bg-cancel-button-hover hover:text-theme-text-light"
 >
 {isUploadingThisSlot
 ? "Subiendo..."
 : asset
 ? "Reemplazar"
 : "Subir"}
 </Button>
 {asset ? (
 <Button
 type="button"
 disabled={isSaving || isUploadingImage}
 onClick={() => onClearImage(slot)}
 className="h-7 cursor-pointer rounded-lg border border-theme-border bg-transparent px-2 text-[11px] uppercase tracking-[0.08em] text-theme-text-subtle hover:bg-theme-bg-primary/80 hover:text-theme-text-light disabled:cursor-not-allowed disabled:opacity-50"
 >
 X
 </Button>
 ) : null}
 </div>
 </div>
 </ShellBox>
 );
}

function DualTextShellBox({
 boxColor,
 rounded,
 shadows,
 sectionATitle,
 sectionAContent,
 sectionBTitle,
 sectionBContent,
 isSaving,
 onContentChange,
}: {
 boxColor: string;
 rounded: boolean;
 shadows: boolean;
 sectionATitle: string;
 sectionAContent: string;
 sectionBTitle: string;
 sectionBContent: string;
 isSaving: boolean;
 onContentChange: (
 field:
 | "sectionATitle"
 | "sectionAContent"
 | "sectionBTitle"
 | "sectionBContent",
 value: string,
 ) => void;
}) {
 return (
 <ShellBox rounded={rounded} shadows={shadows} boxColor={boxColor} hideLabel>
 <div className="grid min-h-[12.75rem] flex-1 gap-3">
 <div
 className={cn(
 "flex min-h-0 min-w-0 flex-col border border-theme-border/70 p-2",
 rounded ? "rounded-md" : "rounded-lg",
 )}
 style={{ backgroundColor: boxColor }}
 >
 <Input
 value={sectionATitle}
 disabled={isSaving}
 onChange={(event) =>
 onContentChange("sectionATitle", event.target.value)
 }
 placeholder="Titulo"
 maxLength={10}
 className={INPUT_CLASS}
 />
 <Textarea
 value={sectionAContent}
 disabled={isSaving}
 onChange={(event) =>
 onContentChange("sectionAContent", event.target.value)
 }
 placeholder="Escribe aqui algo interesante"
 maxLength={280}
 rows={4}
 className={cn(TEXTAREA_CLASS, "mt-2 flex-1")}
 />
 </div>

 <div
 className={cn(
 "flex min-h-0 min-w-0 flex-col border border-theme-border/70 p-2",
 rounded ? "rounded-md" : "rounded-lg",
 )}
 style={{ backgroundColor: boxColor }}
 >
 <Input
 value={sectionBTitle}
 disabled={isSaving}
 onChange={(event) =>
 onContentChange("sectionBTitle", event.target.value)
 }
 placeholder="Titulo"
 maxLength={10}
 className={INPUT_CLASS}
 />
 <Textarea
 value={sectionBContent}
 disabled={isSaving}
 onChange={(event) =>
 onContentChange("sectionBContent", event.target.value)
 }
 placeholder="Escribe aqui algo interesante"
 maxLength={280}
 rows={4}
 className={cn(TEXTAREA_CLASS, "mt-2 flex-1")}
 />
 </div>
 </div>
 </ShellBox>
 );
}

export const ProfileCardEditorShell = memo(function ProfileCardEditorShell({
 bannerUrl,
 draft,
 isSaving,
 isUploadingImage,
 isUploadingBanner,
 activeUploadSlot,
 avatarEditor,
 identityEditor,
 onStyleChange,
 onContentChange,
 onBannerUploadClick,
 onClearBanner,
 onUploadClick,
 onClearImage,
}: ProfileCardEditorShellProps) {
 return (
 <div
 className="overflow-hidden rounded-lg border border-theme-border "
 style={{ backgroundColor: draft.style.backgroundColor }}
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
 backgroundColor: draft.style.backgroundColor,
 }
 }
 >
 <div className="flex min-h-28 flex-col">
 <div
 className={cn(
 "flex justify-between gap-3 border-b border-theme-border px-3 pb-2 pt-2.5",
 bannerUrl ? "items-start" : "items-center",
 )}
 >
 <div className="flex flex-col gap-1.5">
 <Button
 type="button"
 disabled={isSaving || isUploadingBanner}
 onClick={onBannerUploadClick}
 className="h-7 cursor-pointer rounded-lg border border-theme-border bg-theme-bg-primary/70 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-theme-text-subtle hover:border-theme-channel-type-active-border hover:bg-theme-channel-type-active-bg hover:text-theme-channel-type-active-text"
 >
 {isUploadingBanner
 ? "Subiendo..."
 : bannerUrl
 ? "Cambiar imagen de mi banner"
 : "Subir imagen para mi banner"}
 </Button>
 {bannerUrl ? (
 <Button
 type="button"
 disabled={isSaving || isUploadingBanner}
 onClick={onClearBanner}
 className="h-7 cursor-pointer rounded-lg border border-theme-border bg-theme-bg-primary/70 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-theme-text-subtle hover:border-theme-channel-type-active-border hover:bg-theme-channel-type-active-bg hover:text-theme-channel-type-active-text"
 >
 Quitar imagen
 </Button>
 ) : null}
 </div>
 <ColorControl
 label="Color del perfil"
 value={draft.style.backgroundColor}
 disabled={isSaving}
 onChange={(value) => onStyleChange("backgroundColor", value)}
 />
 </div>
 <div className="flex flex-1 items-center p-3 pt-1">
 <div className="grid w-full items-start gap-4 pl-1.5 md:grid-cols-[auto_minmax(0,1fr)]">
 <div className=" min-w-0 md:self-center">{avatarEditor}</div>
 <div className="min-w-0">{identityEditor}</div>
 </div>
 </div>
 </div>
 </div>

 <div className="border-b border-theme-border px-3 py-2">
 <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 items-center">
 <ColorControl
 label="Color de las cajas"
 value={draft.style.boxColor}
 disabled={isSaving}
 onChange={(value) => onStyleChange("boxColor", value)}
 />
 <StyleToggle
 label="Redondeo"
 pressed={draft.style.rounded}
 disabled={isSaving}
 onClick={() => onStyleChange("rounded", !draft.style.rounded)}
 />
 <StyleToggle
 label="Sombreado"
 pressed={draft.style.shadows}
 disabled={isSaving}
 onClick={() => onStyleChange("shadows", !draft.style.shadows)}
 />
 </div>
 </div>

 <div className="grid gap-3 p-3">
 <ShellBox
 hideLabel
 rounded={draft.style.rounded}
 shadows={draft.style.shadows}
 boxColor={draft.style.boxColor}
 >
 <Input
 value={draft.content.pageTitle}
 disabled={isSaving}
 onChange={(event) =>
 onContentChange("pageTitle", event.target.value)
 }
 placeholder="Introduce aqui un titulo para tu perfil :D"
 maxLength={40}
 className={cn(
 INPUT_CLASS,
 draft.style.rounded ? "rounded-md" : "rounded-lg",
 )}
 />
 </ShellBox>

 <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,0.5fr)_minmax(0,1.15fr)]">
 <ImageSlotEditor
 slot="leftTopImage"
 asset={draft.images.leftTopImage.asset}
 rounded={draft.style.rounded}
 shadows={draft.style.shadows}
 boxColor={draft.style.boxColor}
 hideLabel
 isSaving={isSaving}
 isUploadingImage={isUploadingImage}
 activeUploadSlot={activeUploadSlot}
 onUploadClick={onUploadClick}
 onClearImage={onClearImage}
 className="min-h-44"
 />

 <ShellBox
 hideLabel
 rounded={draft.style.rounded}
 shadows={draft.style.shadows}
 boxColor={draft.style.boxColor}
 className="min-h-44"
 >
 <Input
 value={draft.content.leftTopTextTitle}
 disabled={isSaving}
 onChange={(event) =>
 onContentChange("leftTopTextTitle", event.target.value)
 }
 placeholder="Titulo (opcional)"
 maxLength={10}
 className={INPUT_CLASS}
 />
 <Textarea
 value={draft.content.leftTopTextContent}
 disabled={isSaving}
 onChange={(event) =>
 onContentChange("leftTopTextContent", event.target.value)
 }
 placeholder="Escribe aqui algo interesante"
 maxLength={280}
 rows={6}
 className={cn(TEXTAREA_CLASS, "mt-2 flex-1")}
 />
 </ShellBox>
 </div>

 <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)]">
 <DualTextShellBox
 boxColor={draft.style.boxColor}
 rounded={draft.style.rounded}
 shadows={draft.style.shadows}
 sectionATitle={draft.content.sectionATitle}
 sectionAContent={draft.content.sectionAContent}
 sectionBTitle={draft.content.sectionBTitle}
 sectionBContent={draft.content.sectionBContent}
 isSaving={isSaving}
 onContentChange={onContentChange}
 />

 <div className="grid min-w-0 max-w-full gap-3 overflow-hidden">
 <ImageSlotEditor
 slot="leftBottomRightTopImage"
 asset={draft.images.leftBottomRightTopImage.asset}
 rounded={draft.style.rounded}
 shadows={draft.style.shadows}
 boxColor={draft.style.boxColor}
 hideLabel
 isSaving={isSaving}
 isUploadingImage={isUploadingImage}
 activeUploadSlot={activeUploadSlot}
 onUploadClick={onUploadClick}
 onClearImage={onClearImage}
 className="min-h-24"
 />
 <ImageSlotEditor
 slot="leftBottomRightBottomImage"
 asset={draft.images.leftBottomRightBottomImage.asset}
 rounded={draft.style.rounded}
 shadows={draft.style.shadows}
 boxColor={draft.style.boxColor}
 hideLabel
 isSaving={isSaving}
 isUploadingImage={isUploadingImage}
 activeUploadSlot={activeUploadSlot}
 onUploadClick={onUploadClick}
 onClearImage={onClearImage}
 className="min-h-24"
 />
 </div>
 </div>

 <div className="grid min-w-0 gap-3 md:grid-cols-2">
 <ImageSlotEditor
 slot="rightTopImage"
 titleValue={draft.content.rightTopImageTitle}
 onTitleChange={(value) =>
 onContentChange("rightTopImageTitle", value)
 }
 asset={draft.images.rightTopImage.asset}
 rounded={draft.style.rounded}
 shadows={draft.style.shadows}
 boxColor={draft.style.boxColor}
 hideLabel
 isSaving={isSaving}
 isUploadingImage={isUploadingImage}
 activeUploadSlot={activeUploadSlot}
 onUploadClick={onUploadClick}
 onClearImage={onClearImage}
 className="min-h-40"
 />
 <ImageSlotEditor
 slot="rightBottomImage"
 titleValue={draft.content.rightBottomImageTitle}
 onTitleChange={(value) =>
 onContentChange("rightBottomImageTitle", value)
 }
 asset={draft.images.rightBottomImage.asset}
 rounded={draft.style.rounded}
 shadows={draft.style.shadows}
 boxColor={draft.style.boxColor}
 hideLabel
 isSaving={isSaving}
 isUploadingImage={isUploadingImage}
 activeUploadSlot={activeUploadSlot}
 onUploadClick={onUploadClick}
 onClearImage={onClearImage}
 className="min-h-40"
 />
 </div>
 </div>
 </div>
 );
});
