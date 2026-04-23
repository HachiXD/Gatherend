"use client";

import type { ClientProfile } from "@/hooks/use-current-profile";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { useSocketClient } from "@/components/providers/socket-provider";
import { signOut } from "@/lib/better-auth-client";
import { useEffect, useState } from "react";

const HEADER_PANEL_SHELL =
 "mr-1.5 rounded-lg border border-theme-border bg-theme-bg-overlay-primary/78 px-4 pt-4 pb-0 sm:px-5 sm:py-5";
const PANEL_SHELL_CLASS =
 "-mt-2 rounded-lg border border-theme-border bg-theme-bg-overlay-primary/78 px-4 py-4 sm:px-5 sm:py-5";
const DANGER_ACTION_BUTTON_CLASS =
 "flex h-8 w-full -mt-1.5 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-rose-500/45 bg-rose-900/55 px-3 text-[14px] text-rose-100 transition hover:border-rose-400/65 hover:bg-rose-800/65 hover:text-white";

interface LogoutTabProps {
 user: ClientProfile;
 onClose: () => void;
 setOverlayBlocking: (value: boolean) => void;
}

export const LogoutTab = ({
 user: _user,
 onClose,
 setOverlayBlocking,
}: LogoutTabProps) => {
 const router = useRouter();
 const pathname = usePathname();
 const { t } = useTranslation();
 const { goOffline } = useSocketClient();
 const [isSigningOut, setIsSigningOut] = useState(false);
 const [closeOnRouteChange, setCloseOnRouteChange] = useState(false);

 useEffect(() => {
 if (!closeOnRouteChange) return;
 if (pathname === "/") {
 onClose();
 }
 }, [closeOnRouteChange, onClose, pathname]);

 const handleLogout = async () => {
 try {
 if (isSigningOut) return;
 setIsSigningOut(true);
 setOverlayBlocking(true);
 goOffline();
 await signOut();
 toast.success(t.overlays.userSettings.logout.logoutSuccess);
 setCloseOnRouteChange(true);
 router.replace("/");
 router.refresh();
 } catch (error) {
 console.error(error);
 toast.error(t.overlays.userSettings.logout.logoutError);
 setOverlayBlocking(false);
 setIsSigningOut(false);
 }
 };

 return (
 <div className="space-y-6 -mt-2.5">
 <div className={HEADER_PANEL_SHELL}>
 <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
 <h2 className="text-2xl font-bold text-theme-text-primary">
 {t.overlays.userSettings.logout.title}
 </h2>
 <p className="-mt-1 text-sm text-theme-text-tertiary">
 {t.overlays.userSettings.logout.subtitle}
 </p>
 </div>
 </div>

 <div className="max-w-2xl space-y-4 -mt-4">
 <section className={PANEL_SHELL_CLASS}>
 <div className=" -mt-3 -mb-2.5 space-y-4">
 <div className="space-y-2">
 <div className="flex items-start gap-3">
 <LogOut className="-mb-1 mt-1 -mr-1 h-4.5 w-4.5 text-red-500" />
 <h3 className="text-base font-semibold text-red-400 underline">
 {t.overlays.userSettings.logout.signOut}
 </h3>
 </div>
 <p className="-mt-1.5 text-sm text-red-300">
 {t.overlays.userSettings.logout.signOutDescription}
 </p>
 </div>

 <Button
 onClick={handleLogout}
 className={DANGER_ACTION_BUTTON_CLASS}
 disabled={isSigningOut}
 >
 {isSigningOut ? (
 <Loader2 className="mr-1 h-4 w-4 animate-spin" />
 ) : (
 <LogOut className="mr-1 h-4 w-4" />
 )}
 {isSigningOut
 ? t.overlays.userSettings.logout.signingOut
 : t.overlays.userSettings.logout.logOutButton}
 </Button>
 </div>
 </section>
 </div>
 </div>
 );
};
