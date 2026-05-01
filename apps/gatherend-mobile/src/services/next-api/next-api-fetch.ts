import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";

type NextApiFetchOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function resolveNextApiUrl(url: string) {
  if (isAbsoluteUrl(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${authBaseUrl}${url}`;
  }

  return `${authBaseUrl}/${url}`;
}

export async function nextApiFetch(
  url: string,
  options: NextApiFetchOptions = {},
) {
  const cookie = authClient.getCookie();

  return fetch(resolveNextApiUrl(url), {
    ...options,
    credentials: options.credentials ?? "omit",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });
}

export async function readNextApiError(
  response: Response,
  fallbackMessage: string,
) {
  const errorPayload = await response
    .json()
    .catch(() => ({ error: fallbackMessage }));

  return typeof errorPayload?.error === "string"
    ? errorPayload.error
    : fallbackMessage;
}
