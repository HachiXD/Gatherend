"use client";

import type { ClientProfile } from "@/hooks/use-current-profile";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

const HEADER_PANEL_SHELL =
  "border border-theme-border mr-1.5 bg-theme-bg-overlay-primary/78 px-4 pt-4 pb-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const PANEL_SHELL_CLASS =
  "border border-theme-border -mt-2 bg-theme-bg-overlay-primary/78 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.26)] sm:px-5 sm:py-5";
const SECTION_TITLE_CLASS =
  "border-b border-theme-border -mt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted";
const READ_ONLY_FIELD_CLASS =
  "flex h-8 items-center rounded-none border border-theme-border-subtle bg-theme-bg-edit-form/35 px-3 text-[13px] text-theme-text-light";
const ACTION_LINK_CLASS =
  "inline-flex h-6.5 min-w-[120px] items-center justify-center rounded-none bg-theme-tab-button-bg px-3 text-[14px] text-theme-text-light transition hover:bg-theme-tab-button-hover";

interface AccountTabProps {
  user: ClientProfile;
  onClose: () => void;
  setOverlayBlocking: (value: boolean) => void;
}

export const AccountTab = ({
  user,
  onClose,
  setOverlayBlocking,
}: AccountTabProps) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [isRedirectingResetPassword, setIsRedirectingResetPassword] =
    useState(false);
  const [closeOnRouteChange, setCloseOnRouteChange] = useState(false);

  useEffect(() => {
    if (!closeOnRouteChange) return;
    if (pathname === "/create-password") {
      onClose();
    }
  }, [closeOnRouteChange, onClose, pathname]);

  return (
    <div className="space-y-4 pb-10 -mt-2.5">
      <div className={HEADER_PANEL_SHELL}>
        <div className="-mb-3 -mt-3 border-b border-theme-border pb-0.5">
          <h2 className="text-2xl font-bold text-theme-text-primary">
            {t.overlays.userSettings.account.title}
          </h2>
          <p className="-mt-1 text-sm text-theme-text-tertiary">
            {t.overlays.userSettings.account.subtitle}
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-4">
        <section className={PANEL_SHELL_CLASS}>
          <h3 className={SECTION_TITLE_CLASS}>Información de tu Cuenta</h3>
          <div className="mt-2.5 space-y-2 -mb-1.5">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted">
                Nombre de Usuario
              </p>
              <div className={READ_ONLY_FIELD_CLASS}>
                {user.username}/{user.discriminator}
              </div>
            </div>

            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-theme-text-muted">
                Email
              </p>
              <div className={READ_ONLY_FIELD_CLASS}>{user.email}</div>
            </div>
          </div>
        </section>

        <section className={cn(PANEL_SHELL_CLASS, "-mt-0.5")}>
          <h3 className={SECTION_TITLE_CLASS}>Seguridad</h3>
          <div className="mt-1.5 -mb-1.5 space-y-0.5">
            <p className="text-sm text-theme-text-tertiary">
              Gestiona tu contraseña desde el flujo de recuperación de
              contraseña.
            </p>
            <Link
              href={`/create-password?email=${encodeURIComponent(user.email)}`}
              onClick={(e) => {
                if (isRedirectingResetPassword) {
                  e.preventDefault();
                  return;
                }

                if (
                  e.defaultPrevented ||
                  e.button !== 0 ||
                  e.metaKey ||
                  e.altKey ||
                  e.ctrlKey ||
                  e.shiftKey
                ) {
                  return;
                }

                setIsRedirectingResetPassword(true);
                setOverlayBlocking(true);
                setCloseOnRouteChange(true);
              }}
              aria-disabled={isRedirectingResetPassword}
              className={
                isRedirectingResetPassword
                  ? `${ACTION_LINK_CLASS} pointer-events-none opacity-70`
                  : ACTION_LINK_CLASS
              }
            >
              {isRedirectingResetPassword ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isRedirectingResetPassword
                ? t.overlays.userSettings.account.redirecting
                : t.auth.resetPassword}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};
