"use client";

import { useState, useRef, useCallback, useEffect } from "react";

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

/**
 * Hook dedicado para validación de username con debounce.
 * Separa la lógica de validación del componente principal para evitar re-renders.
 */
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

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const checkUsername = useCallback(
    async (value: string) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Same as original - no need to check
      if (value === originalUsername) {
        setStatus({ checking: false, valid: true, message: "" });
        return;
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/auth/check-username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: value }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          let errorMessage = `Server error: ${response.status}`;

          try {
            const errorData = (await response.json()) as { error?: string };
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // Keep fallback message when error body is missing/invalid
          }

          setStatus({
            checking: false,
            valid: false,
            message: errorMessage,
          });
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
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus({
          checking: false,
          valid: false,
          message: translations.errorCheckingUsername,
        });
      }
    },
    [originalUsername, translations]
  );

  const validate = useCallback(
    (value: string) => {
      // Clear pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Same as original
      if (value === originalUsername) {
        setStatus({ checking: false, valid: true, message: "" });
        return;
      }

      // Too short
      if (value.length < 2) {
        setStatus({
          checking: false,
          valid: false,
          message: value.length > 0 ? translations.usernameTooShort : "",
        });
        return;
      }

      // Start checking with debounce
      setStatus({
        checking: true,
        valid: false,
        message: translations.checking,
      });
      timeoutRef.current = setTimeout(() => checkUsername(value), debounceMs);
    },
    [originalUsername, debounceMs, translations, checkUsername]
  );

  return { status, validate };
}
