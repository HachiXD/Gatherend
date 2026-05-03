import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Redirect,
  useRouter,
} from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuthErrorMessage } from "@/src/features/auth/api/sign-in";
import { signUpWithEmail } from "@/src/features/auth/api/sign-up";
import { signInWithSocial, type SocialProvider } from "@/src/features/auth/api/social-auth";
import { SocialAuthButtons } from "@/src/features/auth/components/social-auth-buttons";
import { TurnstileVerificationModal } from "@/src/features/auth/components/turnstile-verification-modal";
import { useSession } from "@/src/features/auth/hooks/use-session";
import { prefetchCurrentProfile } from "@/src/features/profile/lib/current-profile-cache";
import { Text, TextInput } from "@/src/components/app-typography";
import { LEGAL_LINKS } from "@/src/lib/legal-links";
import { hideStartupSplash } from "@/src/lib/startup-splash";
import { BRAND_COLORS } from "@/src/theme/brand-colors";

type SignUpStep = "details" | "verification";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useSession();
  const [step, setStep] = useState<SignUpStep>("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<SocialProvider | null>(null);
  const [isTurnstileVisible, setIsTurnstileVisible] = useState(false);

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/boards/index" />;
  }

  function resetErrors() {
    setEmailError("");
    setPasswordError("");
    setError("");
  }

  function validateForm() {
    resetErrors();

    let hasError = false;

    if (!email.trim() || !emailRegex.test(email.trim())) {
      setEmailError("Ingresa un email valido.");
      hasError = true;
    }

    if (!password || password.length < 8) {
      setPasswordError("La password debe tener al menos 8 caracteres.");
      hasError = true;
    }

    return !hasError;
  }

  function handleBeginSignUp() {
    if (!validateForm()) {
      return;
    }

    setIsTurnstileVisible(true);
  }

  async function handleVerified(result: { token?: string }) {
    setIsTurnstileVisible(false);
    setIsSubmitting(true);

    try {
      const signUpResult = await signUpWithEmail({
        email,
        password,
        captchaToken: result.token,
      });

      const token = (
        signUpResult as {
          data?: { token?: string | null };
        }
      ).data?.token;

      if (token) {
        await prefetchCurrentProfile(queryClient);
        router.replace("/(app)/(tabs)/boards/index");
        return;
      }

      setStep("verification");
    } catch (submitError) {
      setError(
        getAuthErrorMessage(
          submitError,
          "No se pudo crear la cuenta. Resuelve el captcha e intenta otra vez.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSocialAuth(provider: SocialProvider) {
    setError("");
    setOauthLoading(provider);

    try {
      await signInWithSocial({
        provider,
        errorCallbackURL: "/sign-up",
      });
    } catch (submitError) {
      setError(
        getAuthErrorMessage(
          submitError,
          "No se pudo continuar con el proveedor seleccionado.",
        ),
      );
      setOauthLoading(null);
    }
  }

  return (
    <SafeAreaView
      onLayout={() => {
        hideStartupSplash("sign-up layout");
      }}
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Link href="/" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed ? styles.backButtonPressed : null,
              ]}
            >
              <View style={styles.backButtonInner}>
                <Ionicons
                  color={BRAND_COLORS.textMuted}
                  name="arrow-back"
                  size={16}
                />
                <Text style={styles.backButtonText}>Volver al inicio</Text>
              </View>
            </Pressable>
          </Link>

          <View style={styles.header}>
            <Text style={styles.title}>Crea tu cuenta</Text>
            <Text style={styles.description}>
              ¡Únete a Gatherend y socializa en pequeñas comunidades!
            </Text>
          </View>

          {step === "details" ? (
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onChangeText={(value) => {
                    setEmail(value);
                    setEmailError("");
                    setError("");
                  }}
                  placeholder="tu@email.com"
                  placeholderTextColor={BRAND_COLORS.textSubtle}
                  style={styles.input}
                  value={email}
                />
                {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="new-password"
                  onChangeText={(value) => {
                    setPassword(value);
                    setPasswordError("");
                    setError("");
                  }}
                  placeholder="Crea una password"
                  placeholderTextColor={BRAND_COLORS.textSubtle}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
                {passwordError ? (
                  <Text style={styles.fieldError}>{passwordError}</Text>
                ) : null}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                disabled={isSubmitting || oauthLoading !== null}
                onPress={handleBeginSignUp}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !isSubmitting && oauthLoading === null
                    ? styles.primaryButtonPressed
                    : null,
                  isSubmitting || oauthLoading !== null
                    ? styles.primaryButtonDisabled
                    : null,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={BRAND_COLORS.text} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Crear cuenta</Text>
                )}
              </Pressable>

              <SocialAuthButtons
                disabled={isSubmitting || oauthLoading !== null}
                loadingProvider={oauthLoading}
                onPress={handleSocialAuth}
              />

              <Link href="/(auth)/sign-in" asChild>
                <Pressable>
                  <Text style={styles.secondaryAction}>
                    Ya tienes cuenta? Inicia sesion
                  </Text>
                </Pressable>
              </Link>

              <View style={styles.legalBlock}>
                <Text style={styles.legalText}>
                  Al crear una cuenta aceptas las reglas y políticas de
                  Gatherend.
                </Text>
                <View style={styles.legalLinks}>
                  {LEGAL_LINKS.map((link, index) => (
                    <View key={link.url} style={styles.legalLinkItem}>
                      {index > 0 ? (
                        <Text style={styles.legalSeparator}>·</Text>
                      ) : null}
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          void Linking.openURL(link.url);
                        }}
                      >
                        <Text style={styles.legalLinkText}>{link.title}</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.verificationCard}>
              <Text style={styles.verificationTitle}>Revisa tu correo</Text>
              <Text style={styles.verificationDescription}>
                Te enviamos un email de verificacion a:
              </Text>
              <Text style={styles.verificationEmail}>{email}</Text>
              <Text style={styles.verificationHint}>
                Cuando confirmes tu email, vuelve aqui e inicia sesion.
              </Text>

              <Pressable
                onPress={() => router.replace("/(auth)/sign-in")}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed ? styles.primaryButtonPressed : null,
                ]}
              >
                <Text style={styles.primaryButtonText}>Ir a sign in</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setStep("details");
                  setError("");
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.secondaryButtonPressed : null,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Volver</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <TurnstileVerificationModal
        visible={isTurnstileVisible}
        onCancel={() => {
          setIsTurnstileVisible(false);
          if (!isSubmitting) {
            setError("Debes completar el captcha para crear la cuenta.");
          }
        }}
        onVerified={handleVerified}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 28,
  },
  header: {
    gap: 10,
  },
  backButton: {
    alignSelf: "flex-start",
    borderColor: BRAND_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  backButtonInner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  backButtonPressed: {
    backgroundColor: BRAND_COLORS.surface,
  },
  backButtonText: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: BRAND_COLORS.text,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40,
  },
  description: {
    color: BRAND_COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    gap: 18,
  },
  field: {
    gap: 8,
  },
  label: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    backgroundColor: BRAND_COLORS.surfaceMuted,
    borderColor: BRAND_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    color: BRAND_COLORS.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldError: {
    color: BRAND_COLORS.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: BRAND_COLORS.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: BRAND_COLORS.tabButtonBg,
    borderRadius: 18,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryButtonPressed: {
    backgroundColor: BRAND_COLORS.tabButtonHover,
    opacity: 0.92,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: BRAND_COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryAction: {
    color: BRAND_COLORS.primaryHover,
    fontSize: 14,
    textAlign: "center",
  },
  legalBlock: {
    gap: 8,
    paddingTop: 2,
  },
  legalText: {
    color: BRAND_COLORS.textSubtle,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  legalLinks: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  legalLinkItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  legalLinkText: {
    color: BRAND_COLORS.primaryHover,
    fontSize: 12,
    fontWeight: "700",
  },
  legalSeparator: {
    color: BRAND_COLORS.borderStrong,
    fontSize: 13,
    fontWeight: "700",
  },
  verificationCard: {
    gap: 14,
  },
  verificationTitle: {
    color: BRAND_COLORS.text,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  verificationDescription: {
    color: BRAND_COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  verificationEmail: {
    color: BRAND_COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  verificationHint: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: BRAND_COLORS.surface,
    borderColor: BRAND_COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 20,
  },
  secondaryButtonPressed: {
    opacity: 0.92,
  },
  secondaryButtonText: {
    color: BRAND_COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
});
