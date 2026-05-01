import { signUp } from "@/src/lib/auth-client";

function buildDefaultName() {
  return `gatherend-${Math.random().toString(36).slice(2, 10)}`;
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  captchaToken?: string;
}) {
  const headers = input.captchaToken
    ? {
        "x-captcha-response": input.captchaToken,
      }
    : undefined;

  const result = await signUp.email(
    {
      name: buildDefaultName(),
      email: input.email.trim(),
      password: input.password,
      callbackURL: "/sign-in?verified=1",
    },
    headers ? { headers } : undefined,
  );

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
