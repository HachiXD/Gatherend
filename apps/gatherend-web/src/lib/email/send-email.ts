import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { db } from "../db";
import { logger } from "../logger";

type EmailInput = {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  tag?: string;
};

let cachedTransport: Transporter | null = null;
let warnedMissingConfig = false;

// Returns a nodemailer transporter or null if SMTP is not configured
function getTransport(): Transporter | null {
  if (cachedTransport) return cachedTransport;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[EMAIL] Missing SMTP_HOST.");
    }
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      logger.server("[EMAIL] SMTP not configured; email sending disabled.");
    }
    return null;
  }

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });

  return cachedTransport;
}

function getFrom(): string {
  const email =
    process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@localhost";
  const name = process.env.SMTP_FROM_NAME;
  return name ? `${name} <${email}>` : email;
}

export async function sendEmail(input: EmailInput): Promise<void> {
  const to = input.to.toLowerCase().trim();
  if (!to) return;

  // Check suppression list before sending
  const suppression = await db.emailSuppression.findUnique({
    where: { email: to },
  });
  if (suppression?.isSuppressed) {
    logger.server("[EMAIL] Suppressed recipient; skipping.", {
      to,
      tag: input.tag,
    });
    return;
  }

  const transport = getTransport();
  if (!transport) return;

  try {
    await transport.sendMail({
      from: getFrom(),
      to,
      subject: input.subject,
      html: input.htmlBody,
      text: input.textBody,
    });
  } catch (err) {
    logger.server("[EMAIL] Failed to send.", {
      to,
      subject: input.subject,
      tag: input.tag,
      error: err instanceof Error ? err.message : String(err),
    });
    if (process.env.NODE_ENV === "production") {
      throw err;
    }
  }
}
