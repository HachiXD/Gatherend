const authBaseUrlFromEnv = process.env.EXPO_PUBLIC_AUTH_BASE_URL?.trim();
const expressBaseUrlFromEnv = process.env.EXPO_PUBLIC_EXPRESS_BASE_URL?.trim();
const dicebearBaseUrlFromEnv = process.env.EXPO_PUBLIC_DICEBEAR_URL?.trim();

function resolveAuthBaseUrl() {
  if (authBaseUrlFromEnv) {
    return authBaseUrlFromEnv.replace(/\/+$/, "");
  }

  if (__DEV__) {
    return "http://10.0.2.2:3000";
  }

  throw new Error(
    "EXPO_PUBLIC_AUTH_BASE_URL is required in production builds.",
  );
}

function resolveExpressBaseUrl() {
  if (expressBaseUrlFromEnv) {
    return expressBaseUrlFromEnv.replace(/\/+$/, "");
  }

  if (__DEV__) {
    return "http://10.0.2.2:3001";
  }

  throw new Error(
    "EXPO_PUBLIC_EXPRESS_BASE_URL is required in production builds.",
  );
}

export const authBaseUrl = resolveAuthBaseUrl();
export const livekitUrl = process.env.EXPO_PUBLIC_LIVEKIT_URL?.trim() ?? "";
export const expressBaseUrl = resolveExpressBaseUrl();
export const dicebearBaseUrl =
  dicebearBaseUrlFromEnv?.replace(/\/+$/, "") ?? "https://avatars.gatherend.com";
export const mobileScheme = "gatherendmobile";
export const turnstileMobileUrl = `${authBaseUrl}/turnstile/mobile`;
