/**
 * Rate Limiting Middleware
 * Protege endpoints contra ataques de fuerza bruta, DDoS y spam
 */

import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { logger } from "../lib/logger.js";

// Interface para Request con profile adjunto por middleware de autenticación
interface RequestWithProfile extends Request {
  profile?: {
    id: string;
    userId: string;
    username: string;
    discriminator: string;
    email: string;
    imageUrl: string | null;
  };
}

// Helper para obtener IP de forma segura (manejando IPv6)
const getClientIp = (req: Request): string => {
  // Express normaliza IPv6 automáticamente en req.ip
  return req.ip || "unknown";
};

// Mensaje de error personalizado
const rateLimitMessage = {
  error: "Too many requests",
  message: "You have exceeded the rate limit. Please try again later.",
  retryAfter: 60,
};

/**
 * Rate limiter global - Límite general para todas las requests
 * 500 requests por minuto por IP (aumentado para SPA que hace muchas requests iniciales)
 * Este es un límite muy permisivo ya que la mayoría son operaciones de lectura
 */
export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 500, // Máximo 500 requests por minuto
  message: rateLimitMessage,
  standardHeaders: true, // Incluir headers `RateLimit-*`
  legacyHeaders: false, // Deshabilitar headers `X-RateLimit-*`
  validate: { xForwardedForHeader: false, ip: false }, // Desactivar validación estricta de IP
  keyGenerator: (req: Request) => {
    // Usar profileId si está disponible, sino IP
    const profileId =
      (req as RequestWithProfile).profile?.id || req.headers["x-profile-id"];
    return (profileId as string) || getClientIp(req);
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for ${getClientIp(req)} on ${req.path}`);
    res.status(429).json(rateLimitMessage);
  },
  // Saltar rate limit para métodos GET (lectura)
  skip: (req: Request) => req.method === "GET",
});

/**
 * Rate limiter para operaciones de lectura (GET)
 * Muy permisivo: 1000 requests por minuto
 */
export const readRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 1000, // Muy permisivo para lecturas
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
  keyGenerator: (req: Request) => {
    const profileId =
      (req as RequestWithProfile).profile?.id || req.headers["x-profile-id"];
    return `read:${(profileId as string) || getClientIp(req)}`;
  },
});

/**
 * Rate limiter estricto para mensajes
 * 30 mensajes por minuto por usuario
 */
export const messageRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // Máximo 30 mensajes por minuto
  message: {
    error: "Message rate limit exceeded",
    message: "You are sending messages too quickly. Please slow down.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
  keyGenerator: (req: Request) => {
    const profileId =
      (req as RequestWithProfile).profile?.id || req.headers["x-profile-id"];
    return `msg:${(profileId as string) || getClientIp(req)}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(
      `Message rate limit exceeded for profile ${req.headers["x-profile-id"]}`
    );
    res.status(429).json({
      error: "Message rate limit exceeded",
      message: "You are sending messages too quickly. Please slow down.",
    });
  },
});

/**
 * Rate limiter para uploads de archivos
 * 20 uploads por minuto por usuario
 *
 * Rationale:
 * - Chat activo puede requerir varios uploads seguidos
 * - Profile/Board updates son menos frecuentes pero comparten el límite
 * - Balance entre UX y protección contra spam
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // Máximo 10 uploads por minuto
  message: {
    error: "Upload rate limit exceeded",
    message: "You are uploading files too quickly. Please wait a moment.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
  keyGenerator: (req: Request) => {
    const profileId =
      (req as RequestWithProfile).profile?.id || req.headers["x-profile-id"];
    return `upload:${(profileId as string) || getClientIp(req)}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(
      `Upload rate limit exceeded for profile ${
        req.headers["x-profile-id"]
      } / IP ${getClientIp(req)}`
    );
    res.status(429).json({
      error: "Upload rate limit exceeded",
      message: "You are uploading files too quickly. Please wait a moment.",
      retryAfter: 60,
    });
  },
});

/**
 * Rate limiter para reacciones
 * 60 reacciones por minuto por usuario
 */
export const reactionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // Máximo 60 reacciones por minuto
  message: {
    error: "Reaction rate limit exceeded",
    message: "You are adding reactions too quickly. Please slow down.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
  keyGenerator: (req: Request) => {
    const profileId =
      (req as RequestWithProfile).profile?.id || req.headers["x-profile-id"];
    return `reaction:${(profileId as string) || getClientIp(req)}`;
  },
});

/**
 * Rate limiter para autenticación/login
 * 5 intentos por minuto por IP (más estricto)
 */
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // Máximo 5 intentos por minuto
  message: {
    error: "Too many authentication attempts",
    message: "Too many login attempts. Please try again later.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
  keyGenerator: (req: Request) => {
    return `auth:${getClientIp(req)}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Auth rate limit exceeded for IP ${getClientIp(req)}`);
    res.status(429).json({
      error: "Too many authentication attempts",
      message: "Too many login attempts. Please try again later.",
    });
  },
});

/**
 * Rate limiter para endpoints de presencia
 * 30 requests por minuto por usuario
 */
export const presenceRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: "Presence rate limit exceeded",
    message: "Too many presence checks. Please slow down.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
  keyGenerator: (req: Request) => {
    const profileId =
      (req as RequestWithProfile).profile?.id || req.headers["x-profile-id"];
    return `presence:${(profileId as string) || getClientIp(req)}`;
  },
});

/**
 * Rate limiter para endpoints de emisión de eventos (interno)
 * Solo accesible desde el frontend de Next.js
 * 200 requests por minuto
 */
export const emitRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: {
    error: "Emit rate limit exceeded",
    message: "Too many emit requests.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
  keyGenerator: (req: Request) => {
    return `emit:${getClientIp(req)}`;
  },
});

/**
 * Rate limiter para registro de push tokens
 * 10 registros por minuto por usuario — protege contra token flooding
 */
export const pushTokenRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: "Push token rate limit exceeded",
    message: "Too many token registration requests. Please try again later.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
  keyGenerator: (req: Request) => {
    const profileId =
      (req as RequestWithProfile).profile?.id || req.headers["x-profile-id"];
    return `push-token:${(profileId as string) || getClientIp(req)}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(
      `Push token rate limit exceeded for profile ${req.headers["x-profile-id"]}`,
    );
    res.status(429).json({
      error: "Push token rate limit exceeded",
      message: "Too many token registration requests. Please try again later.",
    });
  },
});

/**
 * Rate limiter para WebSocket typing events
 * Almacenado en memoria, usado directamente en el servidor de socket
 */
interface TypingLimit {
  count: number;
  resetAt: number;
}

const typingLimits = new Map<string, TypingLimit>();

export function checkTypingRateLimit(identifier: string): boolean {
  const now = Date.now();
  const limit = typingLimits.get(identifier);

  if (!limit || now > limit.resetAt) {
    typingLimits.set(identifier, { count: 1, resetAt: now + 1000 });
    return true;
  }

  if (limit.count >= 5) {
    return false; // Máximo 5 eventos por segundo
  }

  limit.count++;
  return true;
}

/**
 * Limpiar rate limits de typing expirados
 * Llamar periódicamente para evitar memory leaks
 */
export function cleanupTypingRateLimits(): void {
  const now = Date.now();
  for (const [id, limit] of typingLimits.entries()) {
    if (now > limit.resetAt + 60000) {
      typingLimits.delete(id);
    }
  }
}

// Limpiar cada minuto
setInterval(cleanupTypingRateLimits, 60000);
