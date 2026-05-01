"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n";
import { useRateLimit, RATE_LIMIT_CONFIGS } from "@/hooks/use-rate-limit";
import { checkUserBanStatus } from "@/lib/check-ban-client";
import { signIn, signUp } from "@/lib/better-auth-client";
import { generateRandomUsername } from "@/lib/username/random";

type SignUpStep = "details" | "verification";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const shouldUseTurnstile =
  process.env.NODE_ENV !== "development" && Boolean(turnstileSiteKey);

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (
    err &&
    typeof err === "object" &&
    "error" in err &&
    err.error &&
    typeof err.error === "object" &&
    "message" in err.error &&
    typeof err.error.message === "string"
  ) {
    return err.error.message;
  }

  return fallback;
}

function buildDefaultName(email: string): string {
  // `User.name` is required by Better Auth's core user schema, but our product
  // uses `Profile` as the canonical display identity. Keep this non-PII.
  void email;
  return generateRandomUsername();
}

export const CustomSignUp = () => {
  const router = useRouter();
  const { t } = useTranslation();

  const {
    lockoutSecondsRemaining: signUpLockout,
    checkAndRecord: checkSignUpRateLimit,
  } = useRateLimit(RATE_LIMIT_CONFIGS.auth);

  const [step, setStep] = useState<SignUpStep>("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  const resetTurnstile = () => {
    setTurnstileToken("");
    turnstileRef.current?.reset();
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkSignUpRateLimit()) {
      setError(
        t.auth.tooManyAttempts ||
          `Too many attempts. Please wait ${signUpLockout} seconds.`,
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    setError("");
    setEmailError("");
    setPasswordError("");

    let hasError = false;

    if (!email || !emailRegex.test(email.trim())) {
      setEmailError(t.auth.invalidEmail);
      hasError = true;
    }

    if (!password || password.length < 8) {
      setPasswordError(t.auth.passwordTooShort);
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);

    try {
      const result = await signUp.email(
        {
          name: buildDefaultName(email.trim()),
          email: email.trim(),
          password,
          callbackURL: "/sign-in?verified=1",
        },
        turnstileToken
          ? {
              headers: {
                "x-captcha-response": turnstileToken,
              },
            }
          : undefined,
      );

      const resultError = (result as { error?: { message?: string } }).error;
      if (resultError?.message) {
        setError(t.auth.failedToCreateAccount);
        resetTurnstile();
        return;
      }

      const token = (result as { data?: { token?: string | null } }).data?.token;

      if (token) {
        const banStatus = await checkUserBanStatus();
        if (banStatus?.banned) {
          router.push("/banned");
          return;
        }
        router.push("/boards");
        return;
      }

      setStep("verification");
    } catch (err: unknown) {
      void err;
      setError(t.auth.failedToCreateAccount);
      resetTurnstile();
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignUp = async (provider: "google" | "discord") => {
    setOauthLoading(provider);
    setError("");

    try {
      await signIn.social({
        provider,
        callbackURL: "/boards",
        errorCallbackURL: "/sign-up",
      });
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.auth.failedToCreateAccount));
      setOauthLoading(null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-[#1B2A28] rounded-xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">{t.auth.createYourAccount}</h1>
          <p className="text-sm text-zinc-400 mt-2">{t.auth.joinGatherend}</p>
        </div>

        {step === "details" && (
          <form onSubmit={handleSignUpSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-zinc-300">
                {t.auth.email}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t.auth.enterYourEmail}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                  setError("");
                }}
                className="mt-1 bg-zinc-900/50 border-zinc-600 focus-visible:ring-1 focus-visible:border-[#109e92] focus-visible:ring-[#109e92]"
                disabled={isLoading}
              />
              {emailError && <p className="text-xs text-red-400 mt-1">{emailError}</p>}
            </div>

            <div>
              <Label htmlFor="password" className="text-zinc-300">
                {t.auth.password}
              </Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t.auth.createPassword}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                    setError("");
                  }}
                  className="bg-zinc-900/50 border-zinc-600 focus-visible:ring-1 focus-visible:border-[#109e92] focus-visible:ring-[#109e92] pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute cursor-pointer right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {passwordError && <p className="text-xs text-red-400 mt-1">{passwordError}</p>}
            </div>

            {error && (
              <div className="p-3 rounded-md bg-red-900/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {shouldUseTurnstile ? (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={turnstileSiteKey!}
                  onSuccess={setTurnstileToken}
                  onExpire={() => setTurnstileToken("")}
                  onError={() => setTurnstileToken("")}
                  onTimeout={() => setTurnstileToken("")}
                  options={{
                    action: "sign-up",
                    appearance: "always",
                    execution: "render",
                    size: "normal",
                    theme: "dark",
                  }}
                />
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full bg-[#368780] cursor-pointer hover:bg-[#17968b] text-white"
              disabled={
                isLoading ||
                !email ||
                !password ||
                Boolean(shouldUseTurnstile && !turnstileToken)
              }
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t.auth.continue}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#1B2A28] text-zinc-500">{t.auth.orContinueWith}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthSignUp("google")}
                disabled={oauthLoading !== null}
                className="bg-zinc-900/50 hover:ring-1 hover:border-[#109e92] hover:ring-[#109e92] cursor-pointer hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === "google" ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Google
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthSignUp("discord")}
                disabled={oauthLoading !== null}
                className="bg-zinc-900/50 cursor-pointer hover:ring-1 hover:border-[#109e92] hover:ring-[#109e92] hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === "discord" ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
                  </svg>
                )}
                {t.auth.discord}
              </Button>
            </div>

            <p className="text-center text-sm text-zinc-400 mt-6">
              {t.auth.alreadyHaveAccount}{" "}
              <Link href="/sign-in" className="text-[#109e92] hover:underline font-medium">
                {t.auth.signIn}
              </Link>
            </p>
          </form>
        )}

        {step === "verification" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-zinc-300">{t.auth.verificationCodeSent}</p>
            <p className="font-medium text-white">{email}</p>
            <p className="text-xs text-zinc-400">
              Check your inbox to verify your email before signing in.
            </p>

            <Button
              type="button"
              onClick={() => router.push("/sign-in")}
              className="w-full cursor-pointer bg-[#109e92] hover:bg-[#0d7e74] text-white"
            >
              {t.auth.signIn}
            </Button>

            <Button
              type="button"
              onClick={() => setStep("details")}
              className="w-full cursor-pointer bg-[#2B3B39] hover:bg-[#344644] text-[#AFC7C3] hover:text-[#D6E2DF]"
            >
              {t.auth.back}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
