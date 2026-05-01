import {
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { authBaseUrl, turnstileMobileUrl } from "@/src/lib/env";
import type { TurnstileBridgeMessage } from "@/src/features/auth/types/turnstile";
import { Text } from "@/src/components/app-typography";
import { BRAND_COLORS } from "@/src/theme/brand-colors";

type TurnstileVerificationModalProps = {
  visible: boolean;
  onCancel: () => void;
  onVerified: (result: { token?: string }) => void;
};

function parseBridgeMessage(rawMessage: string): TurnstileBridgeMessage | null {
  try {
    const payload = JSON.parse(rawMessage) as Partial<TurnstileBridgeMessage>;

    switch (payload.type) {
      case "turnstile-success":
        return typeof payload.token === "string" && payload.token
          ? { type: "turnstile-success", token: payload.token }
          : null;
      case "turnstile-skip":
        return { type: "turnstile-skip" };
      case "turnstile-expired":
        return { type: "turnstile-expired" };
      case "turnstile-error":
        return {
          type: "turnstile-error",
          reason:
            typeof payload.reason === "string" ? payload.reason : undefined,
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function TurnstileVerificationModal({
  visible,
  onCancel,
  onVerified,
}: TurnstileVerificationModalProps) {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState(
    "Carga el captcha para completar el registro.",
  );

  const trustedBaseUrl = useMemo(() => normalizeBaseUrl(authBaseUrl), []);

  function handleReload() {
    setStatusMessage("Recargando captcha...");
    setIsLoading(true);
    webViewRef.current?.reload();
  }

  function handleMessage(event: WebViewMessageEvent) {
    const sourceUrl = normalizeBaseUrl(event.nativeEvent.url);

    if (!sourceUrl.startsWith(trustedBaseUrl)) {
      return;
    }

    const message = parseBridgeMessage(event.nativeEvent.data);

    if (!message) {
      return;
    }

    if (message.type === "turnstile-success") {
      setStatusMessage("Verificacion completada.");
      onVerified({ token: message.token });
      return;
    }

    if (message.type === "turnstile-skip") {
      setStatusMessage("Captcha omitido para este entorno.");
      onVerified({});
      return;
    }

    if (message.type === "turnstile-expired") {
      setStatusMessage("El captcha expiro. Recargalo para intentar otra vez.");
      return;
    }

    setStatusMessage(
      message.reason || "No se pudo completar el captcha. Intenta otra vez.",
    );
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      transparent={false}
      visible={visible}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Verificacion de seguridad</Text>
            <Text style={styles.subtitle}>
              Completa el captcha para terminar de crear tu cuenta.
            </Text>
          </View>

          <Pressable onPress={onCancel} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </Pressable>
        </View>

        <View style={styles.statusRow}>
          {isLoading ? (
            <ActivityIndicator color={BRAND_COLORS.primaryHover} size="small" />
          ) : null}
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>

        <View style={styles.webViewCard}>
          <WebView
            ref={webViewRef}
            source={{ uri: turnstileMobileUrl }}
            onLoadEnd={() => {
              setIsLoading(false);
              setStatusMessage("Resuelve el captcha para continuar.");
            }}
            onLoadStart={() => {
              setIsLoading(true);
            }}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            style={styles.webView}
          />
        </View>

        <View style={styles.actions}>
          <Pressable onPress={handleReload} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Recargar captcha</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.background,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: BRAND_COLORS.text,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
  },
  subtitle: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  closeButton: {
    alignItems: "center",
    borderColor: BRAND_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 14,
  },
  closeButtonText: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  statusText: {
    color: BRAND_COLORS.textMuted,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  webViewCard: {
    backgroundColor: BRAND_COLORS.surfaceMuted,
    borderColor: BRAND_COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    marginHorizontal: 20,
    marginTop: 18,
    overflow: "hidden",
  },
  webView: {
    backgroundColor: BRAND_COLORS.surfaceMuted,
    flex: 1,
  },
  actions: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: BRAND_COLORS.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: BRAND_COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
});
