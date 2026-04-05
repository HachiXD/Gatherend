/**
 * Authentication middleware for Express.
 *
 * Production: validates BetterAuth session via cookies.
 * Development: allows `x-profile-id` fallback for faster iteration.
 */

import { Request, Response, NextFunction } from "express";
import { AuthProvider } from "@prisma/client";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { getProfileByIdentityCached } from "../lib/cache.js";
import { getBetterAuth, toHeaders } from "../lib/better-auth.js";

// Extend Express Request to include profile/auth data.
declare global {
  namespace Express {
    interface Request {
      profile?: {
        id: string;
        userId: string;
        username: string;
        email: string;
        reputationScore?: number;
        banned?: boolean;
        bannedAt?: Date | null;
        banReason?: string | null;
      };
      auth?: {
        userId: string;
        sessionId: string;
      };
    }
  }
}

async function tryBetterAuth(req: Request): Promise<{
  userId: string;
  sessionId: string;
  profile: NonNullable<Request["profile"]>;
} | null> {
  try {
    const auth = await getBetterAuth();
    const session = await auth.api.getSession({
      headers: toHeaders(req.headers as Record<string, any>),
    });

    const providerUserId = session?.user?.id as string | undefined;
    if (!providerUserId) return null;

    const profile =
      (await getProfileByIdentityCached({
        provider: AuthProvider.BETTER_AUTH,
        providerUserId,
      })) ||
      (await db.profile.findUnique({
        where: { userId: providerUserId },
        select: {
          id: true,
          userId: true,
          username: true,
          email: true,
          reputationScore: true,
          banned: true,
          bannedAt: true,
          banReason: true,
        },
      }));

    if (!profile) return null;

    return {
      userId: providerUserId,
      sessionId: String(session?.session?.id || ""),
      profile,
    };
  } catch (error) {
    logger.error("[AUTH_TRY_BETTER_AUTH]", error);
    return null;
  }
}

export const authenticateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await tryBetterAuth(req);
    if (result) {
      if (result.profile.banned) {
        return res.status(403).json({
          error: "Account suspended",
          message: "Your account has been banned from Gatherend.",
          banned: true,
          bannedAt: result.profile.bannedAt?.toISOString() || null,
          banReason: result.profile.banReason || null,
        });
      }

      req.profile = result.profile;
      req.auth = { userId: result.userId, sessionId: result.sessionId };
      return next();
    }

    const profileId = req.headers["x-profile-id"] as string;
    const isDevelopment = process.env.NODE_ENV !== "production";
    if (profileId && isDevelopment) {
      logger.warn(`[DEV ONLY] Using x-profile-id fallback for profile: ${profileId}`);
      const profile = await db.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          userId: true,
          username: true,
          email: true,
          reputationScore: true,
          banned: true,
          bannedAt: true,
          banReason: true,
        },
      });

      if (profile) {
        if (profile.banned) {
          return res.status(403).json({
            error: "Account suspended",
            message: "Your account has been banned from Gatherend.",
            banned: true,
            bannedAt: profile.bannedAt?.toISOString() || null,
            banReason: profile.banReason || null,
          });
        }
        req.profile = profile;
        req.auth = { userId: profile.userId, sessionId: "" };
        return next();
      }
    }

    return res.status(401).json({ error: "Authentication required" });
  } catch (error) {
    logger.error("Error in authenticateRequest:", error);
    return res.status(500).json({ error: "Authentication error" });
  }
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const result = await tryBetterAuth(req);
    if (result && !result.profile.banned) {
      req.profile = result.profile;
      req.auth = { userId: result.userId, sessionId: result.sessionId };
      return next();
    }

    const profileId = req.headers["x-profile-id"] as string;
    const isDevelopment = process.env.NODE_ENV !== "production";
    if (profileId && isDevelopment) {
      const profile = await db.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          userId: true,
          username: true,
          email: true,
          reputationScore: true,
        },
      });

      if (profile) {
        req.profile = profile;
      }
    }

    next();
  } catch (error) {
    logger.error("Error in optionalAuth:", error);
    next();
  }
};

export const requireBoardMembership = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const boardId = (req.query.boardId || req.params.boardId) as string;

    if (!boardId) {
      return res.status(400).json({ error: "Board ID required" });
    }

    const member = await db.member.findFirst({
      where: {
        boardId,
        profileId: req.profile.id,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!member) {
      return res.status(403).json({ error: "Not a member of this board" });
    }

    (req as any).member = member;

    next();
  } catch (error) {
    logger.error("Error in requireBoardMembership:", error);
    return res.status(500).json({ error: "Authorization error" });
  }
};

