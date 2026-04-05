import { readFileSync } from "fs";
import { resolve } from "path";
import type { WizardConfig, ServerConfig, Module } from "../types.js";

const SNIPPETS_DIR = resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "apps",
  "gatherend-gateway",
  "snippets"
);

function readSnippet(name: string): string {
  return readFileSync(resolve(SNIPPETS_DIR, name), "utf-8");
}

/**
 * Module -> snippet file mapping.
 * images maps to two snippets (imgproxy + dicebear).
 */
const MODULE_SNIPPETS: Record<Module, string[] | undefined> = {
  images: ["imgproxy.caddy", "dicebear.caddy"],
  moderation: ["content-moderation.caddy"],
  minio: ["minio.caddy"],
  livekit: undefined,
};

/**
 * Generate a Caddyfile for the main (local) server.
 * Core routes (express + web) are always included.
 * If livekit is co-located, uses L4 base for SNI routing.
 */
export function generateMainCaddyfile(
  config: WizardConfig,
  server: ServerConfig
): string {
  // Local-only mode: keep it simple and HTTP-only.
  if (config.isLocalOnly) {
    return readSnippet("base_http.caddy");
  }

  const hasLivekit = server.modules.includes("livekit");
  if (hasLivekit) {
    return generateMainL4LivekitCaddyfile(server);
  }

  const base = generateMainHttpsCaddyfile(server);

  const snippets: string[] = [];
  for (const mod of server.modules) {
    const files = MODULE_SNIPPETS[mod];
    if (!files) continue;
    for (const f of files) {
      snippets.push(readSnippet(f));
    }
  }

  const parts = [base];
  if (snippets.length > 0) {
    parts.push(snippets.join("\n"));
  }

  return parts.join("\n");
}

/**
 * Generate a Caddyfile for a services (remote) server.
 * No core routes - only module-specific site blocks.
 *
 * Supports:
 * - LiveKit-only: L4 SNI routing on :443 to livekit:7880 and livekit:5349
 * - LiveKit + other modules: L4 SNI routing on :443; LiveKit terminates TLS in L4, and
 *   all other domains are passed through to an internal TLS server on :8443.
 * - No LiveKit: regular HTTP site blocks (snippets) with auto HTTPS.
 */
export function generateServicesCaddyfile(
  config: WizardConfig,
  server: ServerConfig
): string {
  const hasLivekit = server.modules.includes("livekit");
  const otherModules = server.modules.filter((m) => m !== "livekit");

  if (hasLivekit && otherModules.length > 0) {
    return generateServicesMixedLivekitCaddyfile(server);
  }

  if (hasLivekit && otherModules.length === 0) {
    return generateServicesLivekitOnlyCaddyfile();
  }

  const globalBlock = `{
    log {
        output stdout
        format console
    }
}
`;

  const snippets: string[] = [];
  for (const mod of otherModules) {
    const files = MODULE_SNIPPETS[mod];
    if (!files) continue;
    for (const f of files) {
      snippets.push(readSnippet(f));
    }
  }

  return globalBlock + "\n" + snippets.join("\n");
}

function generateMainHttpsCaddyfile(server: ServerConfig): string {
  const lines: string[] = [
    `{`,
    `    log {`,
    `        output stdout`,
    `        format console`,
    `    }`,
    `}`,
    ``,
    `{$APP_DOMAIN} {`,
    `    route {`,
    `        handle_path /api/r2/* {`,
    `            reverse_proxy {$EXPRESS_UPSTREAM}`,
    `        }`,
    ``,
    `        handle {`,
    `            reverse_proxy {$NEXT_UPSTREAM}`,
    `        }`,
    `    }`,
    `}`,
  ];

  return lines.join("\n");
}

function generateMainL4LivekitCaddyfile(server: ServerConfig): string {
  const hasImages = server.modules.includes("images");
  const hasModeration = server.modules.includes("moderation");
  const hasMinio = server.modules.includes("minio");

  const redirectHosts: string[] = [
    `http://{$APP_DOMAIN}`,
    `http://{$LIVEKIT_DOMAIN}`,
    `http://{$LIVEKIT_TURN_DOMAIN}`,
  ];
  if (hasImages)
    redirectHosts.push(`http://{$IMAGES_DOMAIN}`, `http://{$AVATARS_DOMAIN}`);
  if (hasModeration) redirectHosts.push(`http://{$MODERATION_DOMAIN}`);
  if (hasMinio) redirectHosts.push(`http://{$MINIO_DOMAIN}`);

  const lines: string[] = [
    `{`,
    `    log {`,
    `        output stdout`,
    `        format console`,
    `    }`,
    ``,
    `    layer4 {`,
    `        :443 {`,
    `            @livekit tls sni {$LIVEKIT_DOMAIN}`,
    `            route @livekit {`,
    `                tls`,
    `                proxy livekit:7880`,
    `            }`,
    ``,
    `            @turn tls sni {$LIVEKIT_TURN_DOMAIN}`,
    `            route @turn {`,
    `                tls`,
    `                proxy livekit:5349`,
    `            }`,
    ``,
    `            # Everything else (app + modules) is handled by the internal TLS server.`,
    `            route {`,
    `                proxy localhost:8443`,
    `            }`,
    `        }`,
    `    }`,
    `}`,
    ``,
    `${redirectHosts.join(" ")} {`,
    `    redir https://{host}{uri} permanent`,
    `}`,
    ``,
    `{$APP_DOMAIN}:8443 {`,
    `    route {`,
    `        handle_path /api/r2/* {`,
    `            reverse_proxy {$EXPRESS_UPSTREAM}`,
    `        }`,
    ``,
    `        handle {`,
    `            reverse_proxy {$NEXT_UPSTREAM}`,
    `        }`,
    `    }`,
    `}`,
    ``,
    `# Ensure certs exist for the LiveKit domains used by layer4 TLS termination.`,
    `{$LIVEKIT_DOMAIN}:8443 {`,
    `    respond "Not found" 404`,
    `}`,
    `{$LIVEKIT_TURN_DOMAIN}:8443 {`,
    `    respond "Not found" 404`,
    `}`,
  ];

  if (hasImages) {
    lines.push(
      ``,
      `{$IMAGES_DOMAIN}:8443 {`,
      `    reverse_proxy imgproxy:8080`,
      `}`,
      ``,
      `{$AVATARS_DOMAIN}:8443 {`,
      `    @bad_referer {`,
      `        not header Referer *{$APP_DOMAIN}*`,
      `    }`,
      `    respond @bad_referer 403`,
      ``,
      `    rate_limit {`,
      `        zone dicebear_per_ip {`,
      `            key    {http.request.remote.host}`,
      `            window 1m`,
      `            events 60`,
      `        }`,
      `    }`,
      ``,
      `    reverse_proxy dicebear:3000`,
      `}`
    );
  }

  if (hasModeration) {
    lines.push(
      ``,
      `{$MODERATION_DOMAIN}:8443 {`,
      `    @authorized {`,
      `        header X-API-Key {$CONTENT_MODERATION_API_KEY}`,
      `    }`,
      ``,
      `    handle @authorized {`,
      `        reverse_proxy nsfwjs:5000`,
      `    }`,
      ``,
      `    handle {`,
      `        respond "Unauthorized" 401`,
      `    }`,
      `}`
    );
  }

  if (hasMinio) {
    lines.push(
      ``,
      `{$MINIO_DOMAIN}:8443 {`,
      `    reverse_proxy minio:9000`,
      `}`
    );
  }

  return lines.join("\n");
}

function generateServicesLivekitOnlyCaddyfile(): string {
  return [
    `{`,
    `    log {`,
    `        output stdout`,
    `        format console`,
    `    }`,
    ``,
    `    layer4 {`,
    `        :443 {`,
    `            @livekit tls sni {$LIVEKIT_DOMAIN}`,
    `            route @livekit {`,
    `                tls`,
    `                proxy livekit:7880`,
    `            }`,
    ``,
    `            @turn tls sni {$LIVEKIT_TURN_DOMAIN}`,
    `            route @turn {`,
    `                tls`,
    `                proxy livekit:5349`,
    `            }`,
    `        }`,
    `    }`,
    `}`,
    ``,
    `# Redirect :80 -> https for convenience (and HTTP-01 if needed).`,
    `http://{$LIVEKIT_DOMAIN} http://{$LIVEKIT_TURN_DOMAIN} {`,
    `    redir https://{host}{uri} permanent`,
    `}`,
    ``,
    `# Ensure certs exist for the LiveKit domains used by layer4 TLS termination.`,
    `{$LIVEKIT_DOMAIN}:8443 {`,
    `    respond "Not found" 404`,
    `}`,
    `{$LIVEKIT_TURN_DOMAIN}:8443 {`,
    `    respond "Not found" 404`,
    `}`,
  ].join("\n");
}

function generateServicesMixedLivekitCaddyfile(server: ServerConfig): string {
  const hasImages = server.modules.includes("images");
  const hasModeration = server.modules.includes("moderation");
  const hasMinio = server.modules.includes("minio");

  const redirectHosts: string[] = [
    `http://{$LIVEKIT_DOMAIN}`,
    `http://{$LIVEKIT_TURN_DOMAIN}`,
  ];
  if (hasImages)
    redirectHosts.push(`http://{$IMAGES_DOMAIN}`, `http://{$AVATARS_DOMAIN}`);
  if (hasModeration) redirectHosts.push(`http://{$MODERATION_DOMAIN}`);
  if (hasMinio) redirectHosts.push(`http://{$MINIO_DOMAIN}`);

  const lines: string[] = [
    `{`,
    `    log {`,
    `        output stdout`,
    `        format console`,
    `    }`,
    ``,
    `    layer4 {`,
    `        :443 {`,
    `            @livekit tls sni {$LIVEKIT_DOMAIN}`,
    `            route @livekit {`,
    `                tls`,
    `                proxy livekit:7880`,
    `            }`,
    ``,
    `            @turn tls sni {$LIVEKIT_TURN_DOMAIN}`,
    `            route @turn {`,
    `                tls`,
    `                proxy livekit:5349`,
    `            }`,
    ``,
    `            # Module domains are handled by the internal TLS server.`,
    `            route {`,
    `                proxy localhost:8443`,
    `            }`,
    `        }`,
    `    }`,
    `}`,
    ``,
    `${redirectHosts.join(" ")} {`,
    `    redir https://{host}{uri} permanent`,
    `}`,
    ``,
    `# Ensure certs exist for the LiveKit domains used by layer4 TLS termination.`,
    `{$LIVEKIT_DOMAIN}:8443 {`,
    `    respond "Not found" 404`,
    `}`,
    `{$LIVEKIT_TURN_DOMAIN}:8443 {`,
    `    respond "Not found" 404`,
    `}`,
  ];

  if (hasImages) {
    lines.push(
      ``,
      `{$IMAGES_DOMAIN}:8443 {`,
      `    reverse_proxy imgproxy:8080`,
      `}`,
      ``,
      `{$AVATARS_DOMAIN}:8443 {`,
      `    @bad_referer {`,
      `        not header Referer *{$APP_DOMAIN}*`,
      `    }`,
      `    respond @bad_referer 403`,
      ``,
      `    rate_limit {`,
      `        zone dicebear_per_ip {`,
      `            key    {http.request.remote.host}`,
      `            window 1m`,
      `            events 60`,
      `        }`,
      `    }`,
      ``,
      `    reverse_proxy dicebear:3000`,
      `}`
    );
  }

  if (hasModeration) {
    lines.push(
      ``,
      `{$MODERATION_DOMAIN}:8443 {`,
      `    @authorized {`,
      `        header X-API-Key {$CONTENT_MODERATION_API_KEY}`,
      `    }`,
      ``,
      `    handle @authorized {`,
      `        reverse_proxy nsfwjs:5000`,
      `    }`,
      ``,
      `    handle {`,
      `        respond "Unauthorized" 401`,
      `    }`,
      `}`
    );
  }

  if (hasMinio) {
    lines.push(
      ``,
      `{$MINIO_DOMAIN}:8443 {`,
      `    reverse_proxy minio:9000`,
      `}`
    );
  }

  return lines.join("\n");
}
