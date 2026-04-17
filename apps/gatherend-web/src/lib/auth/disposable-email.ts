import "server-only";

import { domainToASCII } from "node:url";
import { disposableEmailBlocklistSet } from "disposable-email-domains-js";

const disposableDomains = disposableEmailBlocklistSet();

const allowedDomains = new Set<string>([]);

const extraBlockedDomains = new Set([
  "10minutemail.com",
  "dispostable.com",
  "emailondeck.com",
  "getnada.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "moakt.com",
  "sharklasers.com",
  "temp-mail.org",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
]);

export function normalizeEmailDomain(email: string): string | null {
  const trimmed = email.trim();
  const separatorIndex = trimmed.lastIndexOf("@");

  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return null;
  }

  const rawDomain = trimmed.slice(separatorIndex + 1).trim().replace(/\.$/, "");
  const asciiDomain = domainToASCII(rawDomain);

  if (!asciiDomain) {
    return null;
  }

  return asciiDomain.toLowerCase();
}

function getDomainCandidates(domain: string): string[] {
  const labels = domain.split(".").filter(Boolean);
  const candidates: string[] = [];

  for (let index = 0; index <= labels.length - 2; index += 1) {
    candidates.push(labels.slice(index).join("."));
  }

  return candidates;
}

export function isDisposableEmailDomain(domain: string): boolean {
  const normalizedDomain = domainToASCII(domain.trim().replace(/\.$/, ""));

  if (!normalizedDomain) {
    return false;
  }

  for (const candidate of getDomainCandidates(normalizedDomain.toLowerCase())) {
    if (allowedDomains.has(candidate)) {
      return false;
    }

    if (
      extraBlockedDomains.has(candidate) ||
      disposableDomains.has(candidate)
    ) {
      return true;
    }
  }

  return false;
}

export function isDisposableEmailAddress(email: string): boolean {
  const domain = normalizeEmailDomain(email);

  if (!domain) {
    return false;
  }

  return isDisposableEmailDomain(domain);
}
