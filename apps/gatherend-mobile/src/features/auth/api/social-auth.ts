import { signIn } from "@/src/lib/auth-client";

export type SocialProvider = "google" | "discord";

export async function signInWithSocial(input: {
  provider: SocialProvider;
  errorCallbackURL: "/sign-in" | "/sign-up";
}) {
  const result = await signIn.social({
    provider: input.provider,
    callbackURL: "/boards",
    errorCallbackURL: input.errorCallbackURL,
  });

  const resultError = (
    result as {
      error?: { message?: string; code?: string; status?: number };
    }
  ).error;

  if (resultError?.message) {
    throw new Error(resultError.message);
  }

  return result;
}
