import { expressFetch } from "@/src/services/express/express-fetch";

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

export async function getLinkPreview(url: string): Promise<LinkPreviewData> {
  const res = await expressFetch(
    `/link-preview?url=${encodeURIComponent(url)}`,
  );
  if (!res.ok) throw new Error("link-preview fetch failed");
  return res.json() as Promise<LinkPreviewData>;
}
