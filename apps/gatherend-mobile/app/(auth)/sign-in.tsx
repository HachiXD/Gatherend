import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getAuthErrorMessage,
  signInWithEmail,
} from "@/src/features/auth/api/sign-in";
import {
  signInWithSocial,
  type SocialProvider,
} from "@/src/features/auth/api/social-auth";
import { SocialAuthButtons } from "@/src/features/auth/components/social-auth-buttons";
import { useSession } from "@/src/features/auth/hooks/use-session";
import { prefetchCurrentProfile } from "@/src/features/profile/lib/current-profile-cache";
import { Text, TextInput } from "@/src/components/app-typography";
import { hideStartupSplash } from "@/src/lib/startup-splash";
import { BRAND_COLORS } from "@/src/theme/brand-colors";

export default function SignInScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<SocialProvider | null>(null);

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/boards/index" />;
  }

  async function handleSubmit() {
    setError("");

    if (!email.trim() || !password) {
      setError("Ingresa tu email y tu password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await signInWithEmail({ email, password });
      await prefetchCurrentProfile(queryClient);
      router.replace("/(app)/(tabs)/boards/index");
    } catch (submitError) {
      setError(
        getAuthErrorMessage(
          submitError,
          "No se pudo iniciar sesion. Intenta de nuevo.",
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
        errorCallbackURL: "/sign-in",
      });
    } catch (submitError) {
      setError(
        getAuthErrorMessage(
          submitError,
          "No se pudo iniciar con el proveedor seleccionado.",
        ),
      );
      setOauthLoading(null);
    }
  }

  return (
    <SafeAreaView
      onLayout={() => {
        hideStartupSplash("sign-in layout");
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
            <Text style={styles.title}>Inicia sesion</Text>
            <Text style={styles.subtitle}>
              Inicia sesión para entrar a Gatherend
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor={BRAND_COLORS.textSubtle}
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={setPassword}
                placeholder="Tu password"
                placeholderTextColor={BRAND_COLORS.textSubtle}
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={isSubmitting || oauthLoading !== null}
              onPress={handleSubmit}
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
                <Text style={styles.primaryButtonText}>Entrar</Text>
              )}
            </Pressable>

            <SocialAuthButtons
              disabled={isSubmitting || oauthLoading !== null}
              loadingProvider={oauthLoading}
              onPress={handleSocialAuth}
            />

            <Link href="/(auth)/sign-up" asChild>
              <Pressable>
                <Text style={styles.secondaryAction}>Crear una cuenta</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  subtitle: {
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
});
