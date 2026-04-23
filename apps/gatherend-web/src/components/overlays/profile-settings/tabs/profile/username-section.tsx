"use client";

import { memo, useCallback, useState, type UIEvent } from "react";
import { Check, X, Loader2, Bold, Italic, Underline } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getRingBackground, getUsernameColorStyle } from "@/lib/username-color";
import type { UsernameSectionProps } from "./types";

const fieldInputClass =
 "h-8 rounded-lg border-theme-border bg-theme-bg-primary/70 text-theme-text-light placeholder:text-theme-text-muted focus-visible:border-theme-border-accent";
const readonlyFieldInputClass =
 "h-8 rounded-lg border-theme-border bg-theme-bg-primary/70 text-theme-text-light disabled:opacity-100";
const panelToggleButtonClass =
 "flex h-6.5 w-10 cursor-pointer items-center justify-center rounded-lg border text-[13px] transition";
const panelToggleActiveClass =
 "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text";
const panelToggleInactiveClass =
 "border-theme-border bg-theme-bg-primary/70 text-theme-text-subtle hover:bg-theme-bg-primary/90 hover:text-theme-text-light";

export const UsernameSection = memo(function UsernameSection({
 username,
 usernameColor,
 discriminator,
 usernameStatus,
 originalUsername,
 formatState,
 formatActions,
 isSaving,
 onUsernameChange,
 t,
}: UsernameSectionProps) {
 const [inputScrollLeft, setInputScrollLeft] = useState(0);

 const handleUsernameScroll = useCallback((e: UIEvent<HTMLInputElement>) => {
 setInputScrollLeft(e.currentTarget.scrollLeft);
 }, []);

 return (
 <div className="flex-1 space-y-2 w-full">
 {/* Username & Discriminator Row */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="md:col-span-2">
 <div className="space-y-2">
 <label
 htmlFor="profile-username"
 className="uppercase text-xs font-bold text-theme-text-subtle"
 >
 {t.profile.username}
 </label>
 <div className="relative">
 {username.length > 0 && (
 <div
 aria-hidden="true"
 className={cn(
 "pointer-events-none absolute inset-y-0 left-0 right-10 z-0 flex items-center overflow-hidden px-3 text-base md:text-sm",
 formatState.bold && "font-bold",
 formatState.italic && "italic",
 isSaving && "opacity-50",
 )}
 >
 <span
 className="relative block whitespace-nowrap"
 style={{
 transform: `translateX(-${inputScrollLeft}px)`,
 }}
 >
 <span style={getUsernameColorStyle(usernameColor)}>
 {username}
 </span>
 {formatState.underline && (
 <span
 aria-hidden="true"
 className="absolute inset-x-0 bottom-[3px] h-[1px]"
 style={{
 background: getRingBackground(usernameColor),
 }}
 />
 )}
 </span>
 </div>
 )}
 <Input
 id="profile-username"
 name="profile-username"
 disabled={isSaving}
 className={cn(
 fieldInputClass,
 "pr-10 caret-theme-text-light",
 username.length > 0 && "text-transparent",
 formatState.bold && "font-bold",
 formatState.italic && "italic",
 formatState.underline && "underline",
 )}
 placeholder={t.profile.usernamePlaceholder}
 value={username}
 onChange={(e) => onUsernameChange(e.target.value)}
 onScroll={handleUsernameScroll}
 />
 {usernameStatus.checking && (
 <Loader2 className="absolute right-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 animate-spin text-theme-text-muted" />
 )}
 {!usernameStatus.checking &&
 usernameStatus.valid &&
 username !== originalUsername && (
 <Check className="absolute right-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-green-500" />
 )}
 {!usernameStatus.checking &&
 !usernameStatus.valid &&
 username.length > 0 && (
 <X className="absolute right-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-red-500" />
 )}
 </div>
 {usernameStatus.message && (
 <p
 className={`text-xs -mt-1 -mb-1 ${
 usernameStatus.valid ? "text-green-400" : "text-red-400"
 }`}
 >
 {usernameStatus.message}
 </p>
 )}
 </div>
 </div>
 <div>
 <label
 htmlFor="profile-discriminator"
 className="uppercase text-xs font-bold text-theme-text-subtle"
 >
 {t.profile.identifier}
 </label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted font-mono">
 /
 </span>
 <Input
 id="profile-discriminator"
 name="profile-discriminator"
 disabled
 className={cn(
 readonlyFieldInputClass,
 "pl-4.5 cursor-not-allowed font-mono",
 )}
 value={discriminator || "xxx"}
 />
 </div>
 </div>
 </div>

 {/* Username Format */}
 <div className="space-y-2">
 <span
 id="username-style-label"
 className="uppercase text-xs font-bold text-theme-text-subtle block"
 >
 {t.profile.style}
 </span>
 <div
 className="flex items-center gap-2 -mt-1.5"
 role="group"
 aria-labelledby="username-style-label"
 >
 <button
 type="button"
 onClick={formatActions.toggleBold}
 disabled={isSaving}
 className={cn(
 panelToggleButtonClass,
 formatState.bold
 ? panelToggleActiveClass
 : panelToggleInactiveClass,
 )}
 aria-label="Bold"
 aria-pressed={formatState.bold}
 >
 <Bold className="w-5 h-5" aria-hidden="true" />
 </button>
 <button
 type="button"
 onClick={formatActions.toggleItalic}
 disabled={isSaving}
 className={cn(
 panelToggleButtonClass,
 formatState.italic
 ? panelToggleActiveClass
 : panelToggleInactiveClass,
 )}
 aria-label="Italic"
 aria-pressed={formatState.italic}
 >
 <Italic className="w-5 h-5" aria-hidden="true" />
 </button>
 <button
 type="button"
 onClick={formatActions.toggleUnderline}
 disabled={isSaving}
 className={cn(
 panelToggleButtonClass,
 formatState.underline
 ? panelToggleActiveClass
 : panelToggleInactiveClass,
 )}
 aria-label="Underline"
 aria-pressed={formatState.underline}
 >
 <Underline className="w-5 h-5" aria-hidden="true" />
 </button>
 </div>
 </div>
 </div>
 );
});
