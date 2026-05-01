"use client";

import { useEffect } from "react";
import type { CSSProperties } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

type TurnstileBridgeMessage =
  | {
      type: "turnstile-success";
      token: string;
    }
  | {
      type: "turnstile-error";
      reason?: string;
    }
  | {
      type: "turnstile-expired";
    }
  | {
      type: "turnstile-skip";
    };

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const shouldUseTurnstile =
  process.env.NODE_ENV !== "development" && Boolean(turnstileSiteKey);

function postToNative(message: TurnstileBridgeMessage) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

export default function MobileTurnstilePage() {
  useEffect(() => {
    if (!shouldUseTurnstile) {
      postToNative({ type: "turnstile-skip" });
    }
  }, []);

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <span style={styles.eyebrow}>Gatherend Security</span>
        <h1 style={styles.title}>Verifica que eres humano</h1>
        <p style={styles.description}>
          Completa el captcha para terminar de crear tu cuenta en la app mobile.
        </p>

        {shouldUseTurnstile ? (
          <div style={styles.widgetWrap}>
            <Turnstile
              siteKey={turnstileSiteKey!}
              onSuccess={(token) =>
                postToNative({ type: "turnstile-success", token })
              }
              onExpire={() => postToNative({ type: "turnstile-expired" })}
              onTimeout={() => postToNative({ type: "turnstile-expired" })}
              onError={(error) =>
                postToNative({
                  type: "turnstile-error",
                  reason:
                    typeof error === "string"
                      ? error
                      : "Turnstile no pudo completarse.",
                })
              }
              options={{
                action: "sign-up",
                appearance: "always",
                execution: "render",
                size: "normal",
                theme: "dark",
              }}
            />
          </div>
        ) : (
          <p style={styles.skipMessage}>
            Este entorno no requiere captcha. Puedes volver a la app.
          </p>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    alignItems: "center",
    background:
      "radial-gradient(circle at top, rgba(22,163,74,0.12), transparent 42%), #071019",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "24px",
  },
  card: {
    background: "rgba(15, 23, 42, 0.94)",
    border: "1px solid rgba(51, 65, 85, 0.7)",
    borderRadius: "28px",
    boxSizing: "border-box",
    color: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    maxWidth: "420px",
    padding: "28px 24px",
    width: "100%",
  },
  eyebrow: {
    color: "#7dd3fc",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    lineHeight: 1.15,
    margin: 0,
  },
  description: {
    color: "#94a3b8",
    fontSize: "15px",
    lineHeight: 1.6,
    margin: 0,
  },
  widgetWrap: {
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    marginTop: "8px",
    minHeight: "72px",
  },
  skipMessage: {
    color: "#cbd5e1",
    fontSize: "14px",
    lineHeight: 1.6,
    margin: "8px 0 0",
  },
};
