"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import { OverlayProvider } from "@/components/providers/overlay-provider";
import { LanguageSyncProvider } from "@/components/providers/language-sync-provider";
import { ProfileUpdatesListener } from "@/components/providers/profile-updates-listener";
import { SocketProvider } from "@/components/providers/socket-provider";

export function AuthenticatedAppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LanguageSyncProvider />
      <SocketProvider>
        <ProfileUpdatesListener />
        <ModalProvider />
        <OverlayProvider />
        {children}
      </SocketProvider>
    </>
  );
}
