import type { NextConfig } from "next";

// Security headers básicos
const securityHeaders = [
  {
    // Fuerza HTTPS en el navegador por 1 año
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    // Previene clickjacking - tu sitio no puede ser embebido en iframes
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Previene MIME type sniffing
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Controla información del referrer enviada a otros sitios
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Previene algunos ataques XSS en navegadores antiguos
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    // Controla qué features del navegador puede usar tu app
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
  {
    // Aísla la ventana de otras tabs - previene ataques via window.opener
    // same-origin-allow-popups permite OAuth popups (Clerk)
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  // CSP se maneja dinámicamente en proxy.ts con nonces únicos por request
];

function getRemotePatternFromUrl(urlString: string | undefined) {
  if (!urlString) return null;
  try {
    const u = new URL(urlString);
    const protocol = u.protocol.replace(":", "");
    if (protocol !== "http" && protocol !== "https") return null;

    return {
      protocol: protocol as "http" | "https",
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
    };
  } catch {
    return null;
  }
}

const imgproxyEnvPattern = getRemotePatternFromUrl(
  process.env.NEXT_PUBLIC_IMGPROXY_URL,
);

const apiEnvPattern = getRemotePatternFromUrl(process.env.NEXT_PUBLIC_API_URL);
const cdnPattern = getRemotePatternFromUrl(process.env.NEXT_PUBLIC_CDN_URL);
const dicebearPattern = getRemotePatternFromUrl(
  process.env.NEXT_PUBLIC_DICEBEAR_URL,
);

const nextConfig: NextConfig = {
  // Strict Mode deshabilitado temporalmente para debugging de renders
  reactStrictMode: false,

  // Standalone output para Docker
  output: "standalone",

  // Security headers
  async headers() {
    return [
      {
        // Aplicar a todas las rutas
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  images: {
    remotePatterns: [
      ...(dicebearPattern ? [dicebearPattern] : []), // NEXT_PUBLIC_DICEBEAR_URL
      ...(cdnPattern ? [cdnPattern] : []), // R2 custom domain (NEXT_PUBLIC_CDN_URL)
      ...(imgproxyEnvPattern ? [imgproxyEnvPattern] : []),
      ...(apiEnvPattern ? [apiEnvPattern] : []), // Express API (dev/prod)
    ],
    minimumCacheTTL: 60,
  },

  // Experimental: Optimizar imports de paquetes pesados
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "emoji-picker-react",
      "@radix-ui/react-icons",
    ],
  },

  // Comprimir páginas
  compress: true,
};

export default nextConfig;
