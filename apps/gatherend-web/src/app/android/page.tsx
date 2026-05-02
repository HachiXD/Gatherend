import Image from "next/image";
import { getServerTranslations } from "@/i18n/server";

export default async function AndroidDownloadsPage() {
  const t = await getServerTranslations();
  const page = t.publicPages.androidDownload;

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
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{page.title}</h1>
        <p className="text-sm text-zinc-400 mb-4">{page.effectiveDate}</p>
        <p className="text-zinc-300 leading-relaxed mb-8">{page.subtitle}</p>

        <div className="overflow-x-auto rounded-lg border border-zinc-700">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="bg-zinc-900/40 text-theme-text-light">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold">
                  {page.versionHeader}
                </th>
                <th className="px-4 py-3 text-sm font-semibold">
                  {page.notesHeader}
                </th>
                <th className="px-4 py-3 text-sm font-semibold">
                  {page.downloadHeader}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {page.releases.map((release) => (
                <tr key={release.version} className="bg-zinc-950/10">
                  <td className="px-4 py-4 text-zinc-200">
                    {release.version}
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    {release.notes}
                  </td>
                  <td className="px-4 py-4">
                    <a
                      href={release.href}
                      className="inline-block rounded-lg bg-theme-button-primary px-4 py-2 text-sm font-semibold text-theme-text-light transition-colors hover:bg-theme-button-hover"
                    >
                      {page.downloadLabel}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-zinc-400">
          {page.installNote}
        </p>
      </section>
    </main>
  );
}
