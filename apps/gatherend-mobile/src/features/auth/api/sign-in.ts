import { signIn } from "@/src/lib/auth-client";

export function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "error" in error &&
    error.error &&
    typeof error.error === "object" &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }

  return fallback;
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
}) {
  const result = await signIn.email({
    email: input.email.trim(),
    password: input.password,
    rememberMe: true,
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
