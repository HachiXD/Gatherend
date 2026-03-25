// app/page.tsx

import Image from "next/image";
import Link from "next/link";
import { Belanosima } from "next/font/google";
import { getServerTranslations } from "@/i18n/server";

const belanosima = Belanosima({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export default async function LandingPage() {
  const t = await getServerTranslations();

  return (
    <main className="min-h-screen w-full bg-[#1B2A28]">
      {/* Header */}
      <header className="w-full relative">
        <Image
          src="/HeaderRandom.webp"
          alt="Header Background"
          width={1920}
          height={200}
          className="w-full h-24 object-fill"
          priority
        />
        <div className="absolute top-2 left-0 flex items-center gap-2 w-full px-6 z-10">
          <Image
            src="/GATHEREND_OUTLINE_RELLENADO_V1_BOTAS.svg"
            alt="Gatherend Logo"
            width={42}
            height={42}
            priority
          />
          <Image
            src="/GatherendTitulo.webp"
            alt="Gatherend"
            width={220}
            height={32}
            className="relative -top-1"
          />
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex items-center justify-center px-6 py-16 md:py-12 relative">
        <Image
          src="/ArdillaGath.webp"
          alt="Ardilla"
          width={200}
          height={200}
          className="absolute top-0 right-0 z-50 w-auto h-40"
        />
        <div className="flex flex-col md:flex-row items-center justify-between max-w-6xl w-full gap-8 md:gap-12 relative z-10">
          {/* Left side - Text content */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left max-w-xl">
            <Image
              src="/GATHEREND_OUTLINE_RELLENADO_V1_BOTAS.svg"
              alt="Gatherend Logo"
              width={120}
              height={120}
              className="mb-6"
            />
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-theme-text-light mb-4">
              {t.landing.heroTitle}
            </h1>
            <p className="text-base md:text-lg text-theme-text-muted mb-8 max-w-lg">
              {t.landing.heroDescription}
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/sign-up"
                className={`${belanosima.className} px-6 py-3 text-[20px] font-normal bg-theme-button-primary hover:bg-theme-button-hover text-theme-text-light rounded-lg transition-colors`}
              >
                {t.landing.ctaButton}
              </Link>
              <a
                href="https://github.com/HachiXD/Gatherend"
                target="_blank"
                rel="noopener noreferrer"
                className={`${belanosima.className} flex items-center gap-2 px-6 py-3 text-[20px] font-normal bg-theme-button-primary hover:bg-theme-button-hover text-theme-text-light rounded-lg transition-colors`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                {t.landing.sourceCodeButton}
              </a>
            </div>
          </div>

          {/* Right side - Images */}
          <div className="flex flex-col gap-6 flex-shrink-0">
            <Image
              src="/FOTO_FRONT_1.webp"
              alt="Gatherend Preview"
              width={500}
              height={400}
              className="rounded-xl shadow-2xl"
              priority
            />
            <Image
              src="/FOTO_FRONT_2.webp"
              alt="Gatherend Preview 2"
              width={500}
              height={400}
              className="rounded-xl shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-zinc-700">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/GATHEREND_OUTLINE_RELLENADO_V1_BOTAS.svg"
              alt="Gatherend Logo"
              width={24}
              height={24}
            />
            <span className="text-sm text-zinc-400">
              {t.landing.footerCopyright}
            </span>
          </div>
          <nav className="flex items-center gap-7 text-sm">
            <Link
              href="/faq"
              className="text-zinc-400 hover:text-zinc-200 hover:underline underline-offset-4"
            >
              {t.landing.footerFaq}
            </Link>
            <Link
              href="/privacy-policy"
              className="text-zinc-400 hover:text-zinc-200 hover:underline underline-offset-4"
            >
              {t.landing.footerPrivacyPolicy}
            </Link>
            <Link
              href="/tos"
              className="text-zinc-400 hover:text-zinc-200 hover:underline underline-offset-4"
            >
              {t.landing.footerTos}
            </Link>
          </nav>
          <div className="flex flex-col items-center md:items-end text-sm text-zinc-400">
            <p>{t.landing.footerBuiltBy}</p>
            <p className="mt-1">{t.landing.footerContact}</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
