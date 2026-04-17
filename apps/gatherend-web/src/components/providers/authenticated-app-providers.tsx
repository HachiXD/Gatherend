"use client";

import { ModalProvider } from "@/components/providers/modal-provider";
import { OverlayProvider } from "@/components/providers/overlay-provider";
import { LanguageSyncProvider } from "@/components/providers/language-sync-provider";
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
        <ModalProvider />
        <OverlayProvider />
        {children}
      </SocketProvider>
    </>
  );
}
