import { authClient } from "@/src/lib/auth-client";
import { expressBaseUrl } from "@/src/lib/env";

type ExpressFetchOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
  profileId?: string;
};

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function resolveExpressUrl(url: string) {
  if (isAbsoluteUrl(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${expressBaseUrl}${url}`;
  }

  return `${expressBaseUrl}/${url}`;
}

export function getExpressAuthHeaders(
  profileId?: string,
): Record<string, string> {
  const cookie = authClient.getCookie();

  if (cookie) {
    return {
      Cookie: cookie,
    };
  }

  if (__DEV__) {
    return profileId ? { "x-profile-id": profileId } : {};
  }

  return {};
}

export async function expressFetch(
  url: string,
  options: ExpressFetchOptions = {},
) {
  const authHeaders = getExpressAuthHeaders(options.profileId);

  return fetch(resolveExpressUrl(url), {
    ...options,
    credentials: options.credentials ?? "omit",
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });
}
