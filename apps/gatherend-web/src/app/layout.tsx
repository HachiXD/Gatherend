import type { Metadata } from "next";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";
import { ModalProvider } from "@/components/providers/modal-provider";
import { SocketProvider } from "@/components/providers/socket-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { OverlayProvider } from "@/components/providers/overlay-provider";
import { LanguageSyncProvider } from "@/components/providers/language-sync-provider";
import { I18nServerProvider } from "@/components/providers/i18n-server-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TokenManagerProvider } from "@/components/providers/token-manager-provider";
import { getServerLocale } from "@/i18n/server";

// Dynamic because of nonce-based CSP.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: "Gatherend — Small communities",
  description: "Meet new friends through small groups of 3–49 people.",
  icons: {
    icon: "/GATHERN_RELLENO.svg",
  },
  openGraph: {
    title: "Gatherend — Small communities",
    description: "Meet new friends through small groups of 3–49 people.",
    images: [
      {
        url: "/portadaFINAL.png",
        width: 1200,
        height: 630,
        alt: "Gatherend — Small communities",
      },
    ],
    type: "website",
    siteName: "Gatherend",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gatherend — Small communities",
    description: "Meet new friends through small groups of 3–49 people.",
    images: ["/portadaFINAL.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={cn(
          "bg-theme-bg-quaternary",
        )}
      >
        <ThemeProvider
          nonce={nonce}
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="gatherend-theme"
        >
          <I18nServerProvider>
            <QueryProvider>
              <TokenManagerProvider>
                <LanguageSyncProvider />
                <SocketProvider>
                  <TooltipProvider delayDuration={50}>
                    <ModalProvider />
                    <OverlayProvider />
                    {children}
                  </TooltipProvider>
                </SocketProvider>
              </TokenManagerProvider>
            </QueryProvider>
          </I18nServerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
