import { db } from "../lib/db.js";
import { getStoragePublicUrl } from "../lib/s3.config.js";
import { extractDominantColor } from "../lib/color-extraction.js";

const BATCH_SIZE = 50;

async function backfillDominantColors() {
  let processed = 0;
  let updated = 0;
  let failed = 0;

  const total = await db.uploadedAsset.count({
    where: {
      dominantColor: null,
      mimeType: { startsWith: "image/" },
    },
  });

  console.log(`Found ${total} assets without dominantColor`);

  let cursor: string | undefined;

  while (true) {
    const assets = await db.uploadedAsset.findMany({
      where: {
        dominantColor: null,
        mimeType: { startsWith: "image/" },
      },
      select: { id: true, key: true },
      take: BATCH_SIZE,
      orderBy: { id: "asc" },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (assets.length === 0) break;

    for (const asset of assets) {
      processed++;
      cursor = asset.id;

      try {
        const url = getStoragePublicUrl(asset.key);
        const res = await fetch(url);
        if (!res.ok) {
          failed++;
          continue;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        const color = await extractDominantColor(buffer);

        if (color) {
          await db.uploadedAsset.update({
            where: { id: asset.id },
            data: { dominantColor: color },
          });
          updated++;
        }
      } catch {
        failed++;
      }

      if (processed % 100 === 0) {
        console.log(`Progress: ${processed}/${total} (updated: ${updated}, failed: ${failed})`);
      }
    }
  }

  console.log(`Done. Processed: ${processed}, Updated: ${updated}, Failed: ${failed}`);
  await db.$disconnect();
}

backfillDominantColors();
