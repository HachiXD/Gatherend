import { useState, useRef, useCallback, useEffect } from "react";
import {
  nextApiFetch,
} from "@/src/services/next-api/next-api-fetch";

export interface UsernameValidationState {
  checking: boolean;
  valid: boolean;
  message: string;
}

interface UseUsernameValidationOptions {
  originalUsername: string;
  debounceMs?: number;
  translations: {
    checking: string;
    usernameTooShort: string;
    youllBe: string;
    usernameNotAvailable: string;
    errorCheckingUsername: string;
  };
}

export function useUsernameValidation({
  originalUsername,
  debounceMs = 400,
  translations,
}: UseUsernameValidationOptions) {
  const [status, setStatus] = useState<UsernameValidationState>({
    checking: false,
    valid: true,
    message: "",
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const checkUsername = useCallback(
    async (value: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (value === originalUsername) {
        setStatus({ checking: false, valid: true, message: "" });
        return;
      }

      abortControllerRef.current = new AbortController();

      try {
        const response = await nextApiFetch("/api/auth/check-username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: value }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          let errorMessage = `Server error: ${response.status}`;
          try {
            const errorData = (await response.json()) as { error?: string };
            if (errorData.error) errorMessage = errorData.error;
          } catch {
            // keep fallback
          }
          setStatus({ checking: false, valid: false, message: errorMessage });
          return;
        }

        const data = await response.json();
        if (data.available) {
          setStatus({
            checking: false,
            valid: true,
            message: `${translations.youllBe} ${data.sanitized}`,
          });
        } else {
          setStatus({
            checking: false,
            valid: false,
            message: data.error || translations.usernameNotAvailable,
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus({
          checking: false,
          valid: false,
          message: translations.errorCheckingUsername,
        });
      }
    },
    [originalUsername, translations],
  );

  const validate = useCallback(
    (value: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (value === originalUsername) {
        setStatus({ checking: false, valid: true, message: "" });
        return;
      }

      if (value.length < 2) {
        setStatus({
          checking: false,
          valid: false,
          message: value.length > 0 ? translations.usernameTooShort : "",
        });
        return;
      }

      setStatus({
        checking: true,
        valid: false,
        message: translations.checking,
      });
      timeoutRef.current = setTimeout(() => checkUsername(value), debounceMs);
    },
    [originalUsername, debounceMs, translations, checkUsername],
  );

  return { status, validate };
}
