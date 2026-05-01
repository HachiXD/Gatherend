import Image from "next/image";
import { getServerTranslations } from "@/i18n/server";
import { PrivacyPolicyContent } from "@/components/public-pages/public-page-content";

export default async function ChildSafetyPage() {
  const t = await getServerTranslations();

  return (
    <main className="min-h-screen w-full bg-[#1B2A28]">
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
            src="/GATHERN_RELLENO.svg"
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

      <section className="max-w-4xl mx-auto px-6 py-10 text-theme-text-light">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          {t.publicPages.childSafety.title}
        </h1>
        <p className="text-sm text-zinc-400 mb-8">
          {t.publicPages.childSafety.effectiveDate}
        </p>

        <PrivacyPolicyContent content={t.publicPages.childSafety.content} />
      </section>
    </main>
  );
}
