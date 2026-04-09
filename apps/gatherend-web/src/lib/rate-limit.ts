/**
 * Rate Limiting para API Routes de Next.js
 * Implementación en memoria para desarrollo y Upstash para producción
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";

// Almacenamiento en memoria para rate limiting (desarrollo/fallback)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Limpiar entradas expiradas cada 5 minutos
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, value] of rateLimitStore.entries()) {
        if (value.resetTime < now) {
          rateLimitStore.delete(key);
        }
      }
    },
    5 * 60 * 1000,
  );
}

interface RateLimitConfig {
  /** Número máximo de requests permitidos */
  limit: number;
  /** Ventana de tiempo en segundos */
  windowSeconds: number;
  /** Prefijo para la key (para diferenciar endpoints) */
  prefix?: string;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Obtiene el IP del cliente desde los headers
 */
export async function getClientIP(): Promise<string> {
  const headersList = await headers();
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Rate limiter en memoria (para desarrollo o cuando no hay Redis)
 */
function inMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const resetTime = now + windowMs;

  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetTime < now) {
    // Nueva ventana o ventana expirada
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: resetTime,
    };
  }

  // Ventana existente
  existing.count++;

  if (existing.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: existing.resetTime,
    };
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - existing.count,
    reset: existing.resetTime,
  };
}

/**
 * Aplica rate limiting a una request
 * @param identifier - Identificador único (IP, userId, etc.)
 * @param config - Configuración del rate limit
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = config.prefix ? `${config.prefix}:${identifier}` : identifier;

  // Usar rate limiting en memoria
  return inMemoryRateLimit(key, config);
}

/**
 * Middleware helper para aplicar rate limiting en API routes
 * Retorna NextResponse si excede el límite, null si está ok
 */
export async function checkRateLimit(
  config: RateLimitConfig,
): Promise<NextResponse | null> {
  const ip = await getClientIP();
  const result = await rateLimit(ip, config);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.reset),
          "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
        },
      },
    );
  }

  return null;
}

// Configuraciones predefinidas para diferentes endpoints
export const RATE_LIMITS = {
  /** Auth endpoints - 5 requests por minuto */
  auth: {
    limit: 5,
    windowSeconds: 60,
    prefix: "auth",
  } as RateLimitConfig,

  /** Check username endpoint - 10 requests por minuto */
  checkUsername: {
    limit: 10,
    windowSeconds: 60,
    prefix: "check-username",
  } as RateLimitConfig,

  /** General API - moderado: 60 requests por minuto */
  api: {
    limit: 60,
    windowSeconds: 60,
    prefix: "api",
  } as RateLimitConfig,

  /** Verificación de código - muy estricto: 3 intentos por minuto */
  verification: {
    limit: 3,
    windowSeconds: 60,
    prefix: "verify",
  } as RateLimitConfig,

  /** Resend code - muy estricto: 2 por minuto */
  resendCode: {
    limit: 2,
    windowSeconds: 60,
    prefix: "resend",
  } as RateLimitConfig,

  /** Moderation actions (ban/unban/kick) - 10 por minuto */
  moderation: {
    limit: 10,
    windowSeconds: 60,
    prefix: "moderation",
  } as RateLimitConfig,

  /** Reading moderation data (bans list, etc) - 30 por minuto */
  moderationRead: {
    limit: 30,
    windowSeconds: 60,
    prefix: "moderation-read",
  } as RateLimitConfig,

  /** Invite code management (regenerate/enable/disable) - 10 por minuto */
  inviteCode: {
    limit: 10,
    windowSeconds: 60,
    prefix: "invite-code",
  } as RateLimitConfig,

  /** Board join - 10 por minuto (evita spam de joins) */
  boardJoin: {
    limit: 10,
    windowSeconds: 60,
    prefix: "board-join",
  } as RateLimitConfig,

  /** Board create - 5 por minuto (crear boards es costoso) */
  boardCreate: {
    limit: 5,
    windowSeconds: 60,
    prefix: "board-create",
  } as RateLimitConfig,

  /** Invite preview - 20 por minuto (prevenir enumeration attacks) */
  invitePreview: {
    limit: 20,
    windowSeconds: 60,
    prefix: "invite-preview",
  } as RateLimitConfig,

  /** LiveKit token generation - muy estricto: 10 requests por 10 minutos (tokens duran 10 min) */
  livekitToken: {
    limit: 10,
    windowSeconds: 600, // 10 minutos
    prefix: "livekit-token",
  } as RateLimitConfig,

  channelJoin: {
    limit: 20,
    windowSeconds: 60,
    prefix: "channel-join",
  } as RateLimitConfig,
} as const;
