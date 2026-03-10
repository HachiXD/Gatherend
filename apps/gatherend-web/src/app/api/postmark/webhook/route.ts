import "server-only";

import crypto from "crypto";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

type PostmarkEventBase = {
  RecordType?: string;
  Recipient?: string;
  Email?: string;
  Type?: string;
  SuppressSending?: boolean;
  SubscriptionStatus?: string;
  ID?: number | string;
  MessageID?: string;
  Tag?: string;
};

let warnedMissingWebhookSecret = false;

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyPostmarkSignature(
  rawBody: string,
  signatureHeader: string,
): boolean {
  const secret = process.env.POSTMARK_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[POSTMARK] Missing POSTMARK_WEBHOOK_SECRET.");
    }
    if (!warnedMissingWebhookSecret) {
      warnedMissingWebhookSecret = true;
      logger.server(
        "[POSTMARK] Missing POSTMARK_WEBHOOK_SECRET; webhook signature verification disabled (dev only).",
      );
    }
    return true;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  return timingSafeEqualString(expected, signatureHeader);
}

async function suppressEmail(params: {
  email: string;
  recordType: string;
  reason: string;
  bounceType?: string;
  details?: unknown;
}) {
  const email = params.email.toLowerCase().trim();
  if (!email) return;

  await db.emailSuppression.upsert({
    where: { email },
    create: {
      email,
      isSuppressed: true,
      reason: params.reason,
      recordType: params.recordType,
      bounceType: params.bounceType,
      details: params.details as never,
    },
    update: {
      isSuppressed: true,
      reason: params.reason,
      recordType: params.recordType,
      bounceType: params.bounceType,
      details: params.details as never,
    },
  });
}

async function unsuppressEmail(params: { email: string; details?: unknown }) {
  const email = params.email.toLowerCase().trim();
  if (!email) return;

  await db.emailSuppression.upsert({
    where: { email },
    create: {
      email,
      isSuppressed: false,
      reason: "resubscribed",
      recordType: "SubscriptionChange",
      details: params.details as never,
    },
    update: {
      isSuppressed: false,
      reason: "resubscribed",
      recordType: "SubscriptionChange",
      details: params.details as never,
    },
  });
}

function getRecipient(event: PostmarkEventBase): string | null {
  const email = event.Recipient || event.Email;
  if (!email || typeof email !== "string") return null;
  return email;
}

async function handleEvent(event: PostmarkEventBase) {
  const recordType = event.RecordType || "Unknown";
  const recipient = getRecipient(event);
  if (!recipient) return;

  if (recordType === "Bounce") {
    const bounceType = event.Type || "Unknown";
    // Suppress hard bounces and spam complaints. Soft bounces can recover.
    if (bounceType === "HardBounce" || bounceType === "SpamComplaint") {
      await suppressEmail({
        email: recipient,
        recordType,
        reason: bounceType,
        bounceType,
        details: event,
      });
    }
    return;
  }

  if (recordType === "SpamComplaint") {
    await suppressEmail({
      email: recipient,
      recordType,
      reason: "SpamComplaint",
      details: event,
    });
    return;
  }

  if (recordType === "SubscriptionChange") {
    const suppressSending = event.SuppressSending === true;
    const status =
      typeof event.SubscriptionStatus === "string"
        ? event.SubscriptionStatus.toLowerCase()
        : "";

    if (suppressSending || status === "unsubscribed" || status === "inactive") {
      await suppressEmail({
        email: recipient,
        recordType,
        reason: "unsubscribed",
        details: event,
      });
    } else if (status === "active") {
      await unsuppressEmail({ email: recipient, details: event });
    }
  }
}

export async function POST(request: Request) {
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get("x-postmark-signature") ||
    request.headers.get("X-Postmark-Signature");

  if (!signatureHeader) {
    return NextResponse.json(
      { ok: false, error: "Missing x-postmark-signature" },
      { status: 401 },
    );
  }

  try {
    const ok = verifyPostmarkSignature(rawBody, signatureHeader);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Invalid signature" },
        { status: 401 },
      );
    }

    const parsed = JSON.parse(rawBody) as unknown;
    const events: PostmarkEventBase[] = Array.isArray(parsed)
      ? (parsed as PostmarkEventBase[])
      : [parsed as PostmarkEventBase];

    await Promise.all(events.map((e) => handleEvent(e)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.server("[POSTMARK] Webhook handler failed.", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
