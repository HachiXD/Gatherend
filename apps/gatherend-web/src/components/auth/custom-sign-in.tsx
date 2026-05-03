"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n";
import { useRateLimit, RATE_LIMIT_CONFIGS } from "@/hooks/use-rate-limit";
import { checkUserBanStatus } from "@/lib/check-ban-client";
import { signIn } from "@/lib/better-auth-client";
import { prefetchCurrentProfile } from "@/lib/current-profile-cache";

type SignInStep = "credentials" | "verification";

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

export const CustomSignIn = ({
  showEmailVerifiedMessage = false,
}: {
  showEmailVerifiedMessage?: boolean;
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { lockoutSecondsRemaining, checkAndRecord: checkRateLimit } =
    useRateLimit(RATE_LIMIT_CONFIGS.auth);

  const [step, setStep] = useState<SignInStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkRateLimit()) {
      setError(
        t.auth.tooManyAttempts ||
          `Too many attempts. Please wait ${lockoutSecondsRemaining} seconds.`,
      );
      return;
    }

    setError("");
    setEmailError("");
    setPasswordError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      setEmailError(t.auth.invalidEmail);
      return;
    }

    if (!password) {
      setPasswordError(t.auth.invalidEmailOrPassword);
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn.email({
        email: email.trim(),
        password,
        rememberMe: true,
        callbackURL: "/sign-in?verified=1",
      });

      const resultError = (result as { error?: { message?: string; code?: string; status?: number } }).error;
      if (resultError?.message) {
        if (resultError.code === "EMAIL_NOT_VERIFIED" || resultError.status === 403) {
          setStep("verification");
          return;
        }
        setEmailError(t.auth.invalidEmailOrPassword);
        setPasswordError(t.auth.invalidEmailOrPassword);
        return;
      }

      const banStatus = await checkUserBanStatus();
      if (banStatus?.banned) {
        router.push("/banned");
        return;
      }

      await prefetchCurrentProfile(queryClient);
      router.push("/boards");
    } catch (err: unknown) {
      const message = extractErrorMessage(err, t.auth.invalidCredentials);

      if (
        message.toLowerCase().includes("invalid") ||
        message.toLowerCase().includes("credential") ||
        message.toLowerCase().includes("email") ||
        message.toLowerCase().includes("password")
      ) {
        setEmailError(t.auth.invalidEmailOrPassword);
        setPasswordError(t.auth.invalidEmailOrPassword);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "discord") => {
    setOauthLoading(provider);
    setError("");

    try {
      await signIn.social({
        provider,
        callbackURL: "/boards",
        errorCallbackURL: "/sign-in",
      });
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.auth.invalidCredentials));
      setOauthLoading(null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-[#1B2A28] rounded-xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">{t.auth.welcomeBack}</h1>
          <p className="text-sm text-zinc-400 mt-2">{t.auth.signInToContinue}</p>
        </div>

        {showEmailVerifiedMessage && step === "credentials" && (
          <div className="mb-4 rounded-md bg-emerald-900/30 border border-emerald-700/40 p-3 text-sm text-emerald-300">
            {t.auth.emailVerifiedSuccess}
          </div>
        )}

        {step === "verification" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-zinc-300">{t.auth.emailNotVerifiedYet}</p>
            <p className="font-medium text-white">{email}</p>
            <p className="text-xs text-zinc-400">
              {t.auth.verificationEmailResent}
            </p>

            <Button
              type="button"
              onClick={() => {
                setStep("credentials");
                setError("");
              }}
              className="w-full cursor-pointer bg-[#368780] hover:bg-[#17968b] text-white"
            >
              {t.auth.backToSignIn}
            </Button>
          </div>
        )}

        {step === "credentials" && <form onSubmit={handleSubmit} className="space-y-4">
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
              }}
              className="mt-1 bg-zinc-900/50 border-zinc-600 focus-visible:ring-1 focus-visible:border-[#109e92] focus-visible:ring-[#109e92]"
              disabled={isLoading}
              autoFocus
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
                placeholder={t.auth.enterYourPassword}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
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
            <div className="text-right">
              <Link href="/create-password" className="text-xs text-[#109e92] hover:underline">
                {t.auth.forgotPassword}
              </Link>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-900/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-[#368780] cursor-pointer hover:bg-[#17968b] text-white"
            disabled={isLoading || !email.trim() || !password}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t.auth.signIn}
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
              onClick={() => handleOAuthSignIn("google")}
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
              {t.auth.google}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuthSignIn("discord")}
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
            {t.auth.dontHaveAccount}{" "}
            <Link href="/sign-up" className="text-[#109e92] hover:underline font-medium">
              {t.auth.signUp}
            </Link>
          </p>
        </form>}
      </div>
    </div>
  );
};
