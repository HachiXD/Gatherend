import { NextRequest, NextResponse } from "next/server";

// Locales soportados (debe coincidir con i18n/types.ts)
const SUPPORTED_LOCALES = ["en", "es"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";
const LOCALE_COOKIE_NAME = "gatherend-locale";
const TURNSTILE_CSP_SOURCE = "https://challenges.cloudflare.com";

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api");
}

function toConnectCspSource(urlString: string | undefined): string | null {
  if (!urlString) return null;
  try {
    const u = new URL(urlString);
    if (!["http:", "https:", "ws:", "wss:"].includes(u.protocol)) return null;

    // Never advertise private/internal hostnames in CSP headers.
    const hostname = u.hostname.toLowerCase();
    if (
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".cluster.local")
    ) {
      return null;
    }

    return u.origin;
  } catch {
    return null;
  }
}

function toWebSocketEquivalent(origin: string): string | null {
  try {
    const u = new URL(origin);
    if (u.protocol === "https:") u.protocol = "wss:";
    else if (u.protocol === "http:") u.protocol = "ws:";
    else return null;
    return u.origin;
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  // Works in both Node and Edge runtimes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybeBuffer = (globalThis as any).Buffer as typeof Buffer | undefined;
  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

function isPublicRoute(pathname: string): boolean {
  const publicMatchers: RegExp[] = [
    /^\/$/,
    /^\/sign-in(\/.*)?$/,
    /^\/sign-up(\/.*)?$/,
    /^\/create-password(\/.*)?$/,
    /^\/sso-callback(\/.*)?$/,
    /^\/banned(\/.*)?$/,
    /^\/api\/health(\/.*)?$/,
    /^\/api\/auth\/check-username$/,
    /^\/api\/auth\/lookup-email(\/.*)?$/,
    /^\/api\/auth(\/.*)?$/,
  ];

  return publicMatchers.some((re) => re.test(pathname));
}

// LOCALE DETECTION
function detectLocaleFromHeaders(request: Request): Locale {
  const acceptLanguage = request.headers.get("accept-language");

  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim());

    for (const lang of languages) {
      const baseLang = lang.split("-")[0].toLowerCase() as Locale;
      if (SUPPORTED_LOCALES.includes(baseLang)) {
        return baseLang;
      }
    }
  }

  return DEFAULT_LOCALE;
}

function setLocaleCookie(response: NextResponse, locale: Locale): void {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 31536000, // 1 año
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function getOrDetectLocale(request: NextRequest): {
  locale: Locale;
  needsSet: boolean;
} {
  const existingLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;

  if (existingLocale && SUPPORTED_LOCALES.includes(existingLocale as Locale)) {
    return { locale: existingLocale as Locale, needsSet: false };
  }

  return { locale: detectLocaleFromHeaders(request), needsSet: true };
}

function buildContentSecurityPolicy(params: {
  nonce: string;
  isDev: boolean;
  pathname: string;
  requestOrigin: string;
}): string {
  const { nonce, isDev, pathname, requestOrigin } = params;

  // Nonces require dynamic rendering. In development, Next/Turbopack often needs unsafe-eval.
  const scriptSrc = [
    `'self'`,
    `'nonce-${nonce}'`,
    `'strict-dynamic'`,
    TURNSTILE_CSP_SOURCE,
    ...(isDev ? [`'unsafe-eval'`] : []),
  ].join(" ");

  // Block inline event handlers (e.g. onclick="...") even though we allow nonced inline scripts.
  const scriptSrcAttr = `'none'`;

  const connectSources = new Set<string>();

  // Allow same-host WebSockets explicitly (some clients will connect to wss:// even when the page is https://).
  const selfWs = toWebSocketEquivalent(requestOrigin);
  if (selfWs) connectSources.add(selfWs);

  // Production allowlist: prefer explicit origins from env URLs instead of broad https:/wss:.
  // IMPORTANT: do NOT add internal-only URLs (e.g. Railway private DNS) to CSP headers.
  const publicEnvUrls = [
    process.env.SITE_URL,
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_SOCKET_URL,
    process.env.NEXT_PUBLIC_LIVEKIT_URL,
    process.env.NEXT_PUBLIC_CDN_URL,
    process.env.ATTACHMENTS_BASE_URL,
    process.env.NEXT_PUBLIC_IMGPROXY_URL,
  ];

  for (const v of publicEnvUrls) {
    const src = toConnectCspSource(v);
    if (!src) continue;
    connectSources.add(src);

    const wsEq = toWebSocketEquivalent(src);
    if (wsEq) connectSources.add(wsEq);

    // If an env provides wss://..., also allow the https:// equivalent for long-polling / REST fallbacks.
    if (src.startsWith("wss://")) connectSources.add(src.replace(/^wss:\/\//, "https://"));
    if (src.startsWith("ws://")) connectSources.add(src.replace(/^ws:\/\//, "http://"));
  }

  const connectSrc = [
    `'self'`,
    ...Array.from(connectSources),
    ...(isDev ? ["ws:", "http://localhost:3000", "http://localhost:3001"] : []),
  ].join(" ");

  // NOTE: We allow inline styles because the app uses React `style={...}` in multiple places.
  // Tightening this would require refactors to remove style attributes.
  const styleSrc = [`'self'`, `'unsafe-inline'`, "https:"].join(" ");
  const frameSrc = [`'self'`, TURNSTILE_CSP_SOURCE].join(" ");

  // In dev we load some assets from http://localhost:* (e.g. Express media proxy).
  // Keep production strict (https only).
  const imgSrc = [
    `'self'`,
    "data:",
    "blob:",
    "https:",
    ...(isDev ? ["http:"] : []),
  ].join(" ");

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `form-action 'self'`,
    `img-src ${imgSrc}`,
    `font-src 'self' data: https:`,
    `style-src ${styleSrc}`,
    `script-src ${scriptSrc}`,
    `script-src-elem ${scriptSrc}`,
    `script-src-attr ${scriptSrcAttr}`,
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    // Avoid upgrading localhost in dev.
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];

  // Minimal CSP for API routes (nonce not needed).
  if (isApiRoute(pathname)) {
    return "frame-ancestors 'none'";
  }

  return directives.join("; ");
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = generateNonce();

  const csp = buildContentSecurityPolicy({
    nonce,
    isDev,
    pathname,
    requestOrigin: req.nextUrl.origin,
  });

  // Set CSP and nonce on the *request* so Next can apply the nonce to its scripts.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // Locale cookie (pages only).
  const { locale, needsSet } = getOrDetectLocale(req);
  if (!isApiRoute(pathname) && needsSet) {
    const existingCookies = requestHeaders.get("cookie") || "";
    const separator = existingCookies ? "; " : "";
    requestHeaders.set(
      "cookie",
      `${existingCookies}${separator}${LOCALE_COOKIE_NAME}=${locale}`,
    );
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Always set CSP on the response as well.
  response.headers.set("Content-Security-Policy", csp);

  // Public routes always pass.
  if (isPublicRoute(pathname)) {
    if (!isApiRoute(pathname) && needsSet) {
      setLocaleCookie(response, locale);
    }
    return response;
  }

  // API routes: do not enforce auth here (edge/runtime); route handlers validate sessions.
  if (isApiRoute(pathname)) {
    return response;
  }

  // Pages: apply locale cookie.
  if (needsSet) {
    setLocaleCookie(response, locale);
  }
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    // También excluir prefetches para mejor performance
    {
      source:
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
