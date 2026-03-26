import sharp from "sharp";

export async function extractDominantColor(
  buffer: Buffer,
): Promise<string | null> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(50, 50, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    const colorMap = new Map<
      string,
      { count: number; r: number; g: number; b: number }
    >();
    const quantize = (v: number) => Math.floor(v / 8) * 8;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const brightness = (r + g + b) / 3;
      if (brightness < 20 || brightness > 240) continue;

      const qr = quantize(r);
      const qg = quantize(g);
      const qb = quantize(b);
      const key = `${qr},${qg},${qb}`;

      const existing = colorMap.get(key);
      if (existing) {
        existing.count++;
        existing.r += r;
        existing.g += g;
        existing.b += b;
      } else {
        colorMap.set(key, { count: 1, r, g, b });
      }
    }

    let dominant = { count: 0, r: 0, g: 0, b: 0 };
    for (const color of colorMap.values()) {
      if (color.count > dominant.count) {
        dominant = color;
      }
    }

    if (dominant.count === 0) return null;

    let r = Math.round(dominant.r / dominant.count);
    let g = Math.round(dominant.g / dominant.count);
    let b = Math.round(dominant.b / dominant.count);

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const desaturationFactor = 0.4;
    r = Math.round(r + (gray - r) * desaturationFactor);
    g = Math.round(g + (gray - g) * desaturationFactor);
    b = Math.round(b + (gray - b) * desaturationFactor);

    const darkenFactor = 0.35;
    r = Math.round(r * darkenFactor);
    g = Math.round(g * darkenFactor);
    b = Math.round(b * darkenFactor);

    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}
