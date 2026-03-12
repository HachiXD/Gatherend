import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { sendEmail } from "./email/send-email";
import { generateRandomUsername } from "./username/random";

const isDevelopment = process.env.NODE_ENV === "development";

function buildDefaultName(email: string): string {
  // `User.name` is required by Better Auth's core user schema, but our product
  // uses `Profile` as the canonical display identity. Keep this non-PII.
  void email;
  return generateRandomUsername();
}

const googleMinimalScope = ["openid", "email"] as const;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, rawPayload] = token.split(".");
  if (!rawPayload) return null;

  const base64 = rawPayload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    if (typeof Buffer === "undefined") return null;

    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

const trustedOrigins = Array.from(
  new Set(
    [
      process.env.BETTER_AUTH_URL,
      ...(isDevelopment ? ["http://localhost:3000"] : []),
    ].filter((origin): origin is string => Boolean(origin)),
  ),
);

const appName = "Gatherend";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  emailVerification: {
    sendOnSignIn: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: `Verify your email for ${appName}`,
        textBody: `Verify your email by opening this link:\n\n${url}\n\nIf you didn't request this, you can ignore this email.`,
        htmlBody: `<p>Verify your email by opening this link:</p><p><a href="${url}">${url}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
        tag: "email-verification",
      });
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    onExistingUserSignUp: async ({ user }) => {
      const signInUrl = `${process.env.BETTER_AUTH_URL}/sign-in`;
      await sendEmail({
        to: user.email,
        subject: `Sign-up attempt for ${appName}`,
        textBody: `Someone tried to create an account with your email address. If this was you, sign in instead:\n\n${signInUrl}\n\nIf you didn't request this, you can ignore this email.`,
        htmlBody: `<p>Someone tried to create an account with your email address.</p><p>If this was you, <a href="${signInUrl}">sign in instead</a>.</p><p>If you didn't request this, you can ignore this email.</p>`,
        tag: "existing-user-signup",
      });
    },
    sendResetPassword: async ({ user, url }) => {
      // Do not log reset URLs/tokens (they can be used to take over accounts if leaked via logs).
      await sendEmail({
        to: user.email,
        subject: `Reset your ${appName} password`,
        textBody: `Reset your password by opening this link:\n\n${url}\n\nIf you didn't request this, you can ignore this email.`,
        htmlBody: `<p>Reset your password by opening this link:</p><p><a href="${url}">${url}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
        tag: "password-reset",
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      disableDefaultScope: true,
      scope: [...googleMinimalScope],
      prompt: "select_account",
      // Never persist Google profile data (name/picture) into our `user` table.
      // Keep `user` as an internal auth identity; `Profile` is the canonical public-facing profile.
      getUserInfo: async (tokens) => {
        if (!tokens.idToken) return null;

        const payload = decodeJwtPayload(tokens.idToken);
        const sub = payload?.sub;
        const email = payload?.email;
        const emailVerified = payload?.email_verified;

        if (typeof sub !== "string" || typeof email !== "string") {
          return null;
        }

        return {
          user: {
            id: sub,
            email,
            emailVerified: emailVerified === true,
            name: buildDefaultName(email),
          },
          data: payload,
        };
      },
    },
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? {
          discord: {
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            scope: ["identify", "email"],
          },
        }
      : {}),
  },
  databaseHooks: {
    account: {
      create: {
        before: async (account) => {
          if (account.providerId === "google") {
            return {
              data: { ...account, scope: googleMinimalScope.join(",") },
            };
          }
        },
      },
      update: {
        before: async (account) => {
          if (account.providerId === "google") {
            return {
              data: { ...account, scope: googleMinimalScope.join(",") },
            };
          }
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
  plugins: [nextCookies()],
});

export type BetterAuthSession = typeof auth.$Infer.Session;
export type BetterAuthUser = typeof auth.$Infer.Session.user;
