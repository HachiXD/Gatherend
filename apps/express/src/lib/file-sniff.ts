import sharp from "sharp";

export type SniffedFileType =
  | {
      kind: "image";
      format: "jpeg" | "png" | "webp" | "gif" | "avif";
      mime: string;
      ext: "jpg" | "png" | "webp" | "gif" | "avif";
    }
  | {
      kind: "pdf";
      mime: "application/pdf";
      ext: "pdf";
    };

function startsWithAscii(buf: Buffer, ascii: string): boolean {
  if (buf.length < ascii.length) return false;
  for (let i = 0; i < ascii.length; i++) {
    if (buf[i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

function includesAsciiCaseInsensitive(buf: Buffer, needle: string): boolean {
  const hay = buf.toString("utf8").toLowerCase();
  return hay.includes(needle.toLowerCase());
}

export function looksLikeSvg(buffer: Buffer): boolean {
  // SVG is XML/text; block if the early bytes contain an <svg tag.
  // Keep this conservative: only scan a small prefix to avoid heavy work.
  const prefix = buffer.subarray(0, 4096);
  const text = prefix.toString("utf8").trimStart();
  if (!text.startsWith("<")) return false;
  return includesAsciiCaseInsensitive(prefix, "<svg");
}

export function sniffFileType(buffer: Buffer): SniffedFileType | null {
  if (!buffer || buffer.length < 12) return null;

  // PDF: %PDF-
  if (startsWithAscii(buffer, "%PDF-")) {
    return { kind: "pdf", mime: "application/pdf", ext: "pdf" };
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: "image", format: "jpeg", mime: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { kind: "image", format: "png", mime: "image/png", ext: "png" };
  }

  // GIF: GIF87a / GIF89a
  if (startsWithAscii(buffer, "GIF87a") || startsWithAscii(buffer, "GIF89a")) {
    return { kind: "image", format: "gif", mime: "image/gif", ext: "gif" };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    startsWithAscii(buffer, "RIFF") &&
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { kind: "image", format: "webp", mime: "image/webp", ext: "webp" };
  }

  // AVIF: ISO BMFF with ftyp brand "avif" or "avis"
  // Bytes: [4..7] == "ftyp", then major brand at [8..11]
  if (buffer.length >= 16 && startsWithAscii(buffer.subarray(4, 8) as Buffer, "ftyp")) {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") {
      return { kind: "image", format: "avif", mime: "image/avif", ext: "avif" };
    }
  }

  return null;
}

export type SafeImageMeta = {
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp" | "gif" | "avif";
};

function shouldSwapDimensionsForOrientation(
  orientation: number | undefined,
): boolean {
  return orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
}

export async function getSafeImageMetadata(input: {
  buffer: Buffer;
  maxPixels: number;
  maxDimension: number;
}): Promise<SafeImageMeta> {
  const { buffer, maxPixels, maxDimension } = input;

  // limitInputPixels mitigates decompression bombs (very large dimensions).
  const meta = await sharp(buffer, {
    animated: true,
    limitInputPixels: maxPixels,
  }).metadata();

  const rawWidth = typeof meta.width === "number" ? meta.width : null;
  const rawHeight =
    typeof meta.pageHeight === "number"
      ? meta.pageHeight
      : typeof meta.height === "number"
        ? meta.height
        : null;
  const swapDimensions = shouldSwapDimensionsForOrientation(meta.orientation);
  const width = swapDimensions ? rawHeight : rawWidth;
  const height = swapDimensions ? rawWidth : rawHeight;

  const format = meta.format as SafeImageMeta["format"] | undefined;

  if (!width || !height || !format) {
    throw new Error("InvalidImage");
  }

  if (width <= 0 || height <= 0) throw new Error("InvalidImage");
  if (width > maxDimension || height > maxDimension) throw new Error("ImageTooLarge");

  return { width, height, format };
}
