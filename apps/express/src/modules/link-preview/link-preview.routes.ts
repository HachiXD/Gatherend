import express from "express";
import { logger } from "../../lib/logger.js";
import dns from "node:dns/promises";
import net from "node:net";
import { domainToASCII } from "node:url";

const router = express.Router();

// Simple in-memory cache for link previews (expires after 1 hour)
const previewCache = new Map<
  string,
  { data: LinkPreviewData; timestamp: number }
>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = Number(process.env.LINK_PREVIEW_CACHE_MAX || 1000);
const MAX_HTML_BYTES = Number(process.env.LINK_PREVIEW_MAX_HTML_BYTES || 256_000);

// Hosts eligible for "rich" previews (server-side fetch + OG parsing).
// All other URLs return a basic preview without any server-side fetch (SSRF-safe fallback).
const RICH_PREVIEW_HOSTS = new Set(
  (process.env.LINK_PREVIEW_RICH_HOSTS ||
    "youtube.com,www.youtube.com,youtu.be")
    .split(",")
    .map((h) => canonicalizeHostname(h))
    .filter(Boolean),
);

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

function canonicalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed) return "";
  // Normalize IDNs to ASCII for consistent allowlist comparisons.
  return domainToASCII(trimmed) || trimmed;
}

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./i, "");
}

function isPrivateIPv4(ip: string): boolean {
  // Assumes ip is a valid IPv4 string.
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c, d] = parts;

  // 0.0.0.0/8 (this host), 127.0.0.0/8 (loopback)
  if (a === 0 || a === 127) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10 (CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // Reserved/test/documentation ranges
  // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;
  // 198.18.0.0/15 (benchmark)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;

  // Multicast (224.0.0.0/4) and reserved (240.0.0.0/4), broadcast.
  if (a >= 224) return true;
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
  if (normalized.startsWith("::ffff:")) {
    const maybeV4 = normalized.slice("::ffff:".length);
    if (net.isIP(maybeV4) === 4) {
      return isPrivateIPv4(maybeV4);
    }
    return true;
  }

  // Loopback, unspecified, link-local, unique local
  if (normalized === "::1") return true;
  if (normalized === "::") return true;
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA fc00::/7
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = canonicalizeHostname(hostname);
  const ipType = net.isIP(host);

  if (ipType === 4) {
    if (isPrivateIPv4(host)) throw new Error("BlockedHost");
    return;
  }

  if (ipType === 6) {
    if (isPrivateIPv6(host)) throw new Error("BlockedHost");
    return;
  }

  // Resolve DNS and block any private/local addresses.
  const results = await dns.lookup(host, { all: true, verbatim: true });
  if (!results || results.length === 0) {
    throw new Error("UnresolvableHost");
  }

  for (const r of results) {
    if (r.family === 4 && isPrivateIPv4(r.address)) throw new Error("BlockedHost");
    if (r.family === 6 && isPrivateIPv6(r.address)) throw new Error("BlockedHost");
  }
}

function clampText(text: string | null, maxLen: number): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen - 1)}…` : trimmed;
}

function sanitizeHttpUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.username || u.password) return null;
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function buildBasicPreview(
  parsedUrl: URL,
  options?: { includeFavicon?: boolean },
): LinkPreviewData {
  const hostname = canonicalizeHostname(parsedUrl.hostname);
  const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
  const includeFavicon = options?.includeFavicon === true;

  // Use pathname as a basic "description" (avoid leaking query/fragment in preview UI).
  const description = parsedUrl.pathname && parsedUrl.pathname !== "/" ? parsedUrl.pathname : null;

  return {
    url: parsedUrl.toString(),
    title: hostname || parsedUrl.hostname,
    description: clampText(description, 300),
    image: null,
    siteName: stripWww(hostname || parsedUrl.hostname) || null,
    favicon: includeFavicon ? sanitizeHttpUrl(`${origin}/favicon.ico`) : null,
  };
}

function cacheGet(url: string): LinkPreviewData | null {
  const cached = previewCache.get(url);
  if (!cached) return null;
  if (Date.now() - cached.timestamp >= CACHE_TTL) {
    previewCache.delete(url);
    return null;
  }
  // Refresh LRU order.
  previewCache.delete(url);
  previewCache.set(url, cached);
  return cached.data;
}

function cacheSet(url: string, data: LinkPreviewData): void {
  previewCache.set(url, { data, timestamp: Date.now() });
  while (previewCache.size > MAX_CACHE_ENTRIES) {
    const firstKey = previewCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    previewCache.delete(firstKey);
  }
}

async function readHtmlWithLimit(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      throw new Error("BodyTooLarge");
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c, offset);
    offset += c.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(combined);
}

// Helper to extract Open Graph and meta tags from HTML
function extractMetadata(html: string, url: string): LinkPreviewData {
  const getMetaContent = (property: string, name?: string): string | null => {
    // Try og: property first
    const ogMatch = html.match(
      new RegExp(
        `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`,
        "i"
      )
    );
    if (ogMatch) return ogMatch[1];

    // Try reverse order (content before property)
    const ogMatchReverse = html.match(
      new RegExp(
        `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`,
        "i"
      )
    );
    if (ogMatchReverse) return ogMatchReverse[1];

    // Try name attribute
    if (name) {
      const nameMatch = html.match(
        new RegExp(
          `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`,
          "i"
        )
      );
      if (nameMatch) return nameMatch[1];

      const nameMatchReverse = html.match(
        new RegExp(
          `<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`,
          "i"
        )
      );
      if (nameMatchReverse) return nameMatchReverse[1];
    }

    return null;
  };

  // Extract title
  let title =
    getMetaContent("og:title", "twitter:title") || getMetaContent("title");
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    title = titleMatch ? titleMatch[1].trim() : null;
  }

  // Extract description
  const description =
    getMetaContent("og:description", "description") ||
    getMetaContent("twitter:description");

  // Extract image
  let image =
    getMetaContent("og:image", "twitter:image") ||
    getMetaContent("twitter:image:src");

  // Make image URL absolute if relative
  if (image && !image.startsWith("http")) {
    try {
      const urlObj = new URL(url);
      image = image.startsWith("/")
        ? `${urlObj.protocol}//${urlObj.host}${image}`
        : `${urlObj.protocol}//${urlObj.host}/${image}`;
    } catch {
      // Keep relative URL if parsing fails
    }
  }

  // Extract site name
  const siteName =
    getMetaContent("og:site_name") ||
    (() => {
      try {
        return new URL(url).hostname.replace("www.", "");
      } catch {
        return null;
      }
    })();

  // Extract favicon
  let favicon: string | null = null;
  const faviconMatch = html.match(
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i
  );
  if (faviconMatch) {
    favicon = faviconMatch[1];
    if (!favicon.startsWith("http")) {
      try {
        const urlObj = new URL(url);
        favicon = favicon.startsWith("/")
          ? `${urlObj.protocol}//${urlObj.host}${favicon}`
          : `${urlObj.protocol}//${urlObj.host}/${favicon}`;
      } catch {
        favicon = null;
      }
    }
  }

  // Fallback to default favicon location
  if (!favicon) {
    try {
      const urlObj = new URL(url);
      favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
    } catch {
      // Ignore
    }
  }

  return {
    url,
    title: clampText(title ? decodeHTMLEntities(title) : null, 200),
    description: clampText(
      description ? decodeHTMLEntities(description) : null,
      300,
    ),
    image: sanitizeHttpUrl(image),
    siteName: clampText(siteName ? decodeHTMLEntities(siteName) : null, 80),
    favicon: sanitizeHttpUrl(favicon),
  };
}

// Decode HTML entities
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

// GET /link-preview?url=...
router.get("/", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: "Invalid URL protocol" });
      }
      if (parsedUrl.username || parsedUrl.password) {
        return res.status(400).json({ error: "URL credentials not allowed" });
      }
      // Only allow default web ports (reduce abuse surface in rich preview mode).
      if (parsedUrl.port && !["80", "443"].includes(parsedUrl.port)) {
        return res.status(400).json({ error: "Invalid URL port" });
      }
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const hostname = canonicalizeHostname(parsedUrl.hostname);

    // Rewrite youtu.be short links to full youtube.com URLs so the rich
    // preview fetch hits youtube.com and gets OG tags (including the thumbnail).
    // This is safe because youtu.be is in RICH_PREVIEW_HOSTS and we only
    // rewrite based on the path — no HTTP redirect is followed.
    if (hostname === "youtu.be") {
      const videoId = parsedUrl.pathname.replace(/^\//, "").split("/")[0];
      if (videoId) {
        const rewritten = new URL("https://www.youtube.com/watch");
        rewritten.searchParams.set("v", videoId);
        parsedUrl = rewritten;
      }
    }

    const resolvedHostname = canonicalizeHostname(parsedUrl.hostname);

    // Default behavior: SSRF-safe basic preview for any URL (no server-side fetch).
    if (!RICH_PREVIEW_HOSTS.has(resolvedHostname)) {
      return res.json(buildBasicPreview(parsedUrl, { includeFavicon: false }));
    }

    // Rich preview: only for allowlisted hosts.
    // Cache key uses the original user-supplied URL so repeated youtu.be requests
    // also hit the cache after the first rewrite.
    const cached = cacheGet(url);
    if (cached) {
      return res.json(cached);
    }

    // Fetch the URL with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      // Defense-in-depth: prevent fetching private/local addresses even for allowlisted hosts.
      await assertPublicHost(resolvedHostname);

      const fetchUrl = parsedUrl.toString();
      const response = await fetch(fetchUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; GatherendBot/1.0; +https://gatherend.com)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        // Do NOT follow redirects (avoid redirect-based SSRF).
        redirect: "manual",
      });

      clearTimeout(timeout);

      // If server responds with a redirect, fall back to basic preview without following.
      if (response.status >= 300 && response.status < 400) {
        const data = buildBasicPreview(parsedUrl, { includeFavicon: true });
        cacheSet(url, data);
        return res.json(data);
      }

      if (!response.ok) {
        const data = buildBasicPreview(parsedUrl, { includeFavicon: true });
        cacheSet(url, data);
        return res.json(data);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        const data = buildBasicPreview(parsedUrl, { includeFavicon: true });
        cacheSet(url, data);
        return res.json(data);
      }

      const html = await readHtmlWithLimit(response);
      const data = extractMetadata(html, fetchUrl);

      cacheSet(url, data);
      return res.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeout);
      if (fetchError.name === "AbortError") {
        return res.status(504).json({ error: "Request timeout" });
      }

      // Safe fallback: never error the UI for preview failures; return a basic preview.
      // Avoid logging full user URLs; log host only.
      logger.warn(
        `[LINK_PREVIEW] Rich preview failed for host=${resolvedHostname}: ${String(
          fetchError?.message || fetchError,
        )}`,
      );
      const data = buildBasicPreview(parsedUrl, { includeFavicon: true });
      cacheSet(url, data);
      return res.json(data);
    }
  } catch (error) {
    logger.error("[LINK_PREVIEW]", error);
    res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
