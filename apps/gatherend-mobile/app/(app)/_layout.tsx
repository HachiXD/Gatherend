import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { useSession } from "@/src/features/auth/hooks/use-session";
import { VoiceLiveKitProvider } from "@/src/features/voice/providers/voice-livekit-provider";
import { CurrentProfileProvider } from "@/src/features/profile/providers/current-profile-provider";
import { SocketProvider } from "@/src/providers/socket-provider";
import { ThemeProvider, useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";
import { hideStartupSplash } from "@/src/lib/startup-splash";
import { BRAND_COLORS } from "@/src/theme/brand-colors";
import { NotificationsProvider } from "@/src/features/notifications/notifications-provider";

function ThemedAppStack() {
  const { colors } = useTheme();

  return (
    <View
      onLayout={() => {
        hideStartupSplash("app themed stack layout");
      }}
      style={{ backgroundColor: colors.bgPrimary, flex: 1 }}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.bgPrimary,
          },
        }}
      />
    </View>
  );
}

function isUnauthorizedSessionError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const status =
    "status" in error && typeof error.status === "number"
      ? error.status
      : "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : null;

  return status === 401;
}

export default function AppLayout() {
  const {
    isPending,
    isAuthenticated,
    sessionError,
    refetchSession,
  } = useSession();
  const [sessionRetryCount, setSessionRetryCount] = useState(0);
  const shouldRecoverSession =
    Boolean(sessionError) && !isUnauthorizedSessionError(sessionError);

  useEffect(() => {
    if (
      isPending ||
      isAuthenticated ||
      !shouldRecoverSession ||
      sessionRetryCount >= 2
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      setSessionRetryCount((count) => count + 1);
      void refetchSession();
    }, sessionRetryCount === 0 ? 300 : 900);

    return () => clearTimeout(timeout);
  }, [
    isAuthenticated,
    isPending,
    refetchSession,
    sessionRetryCount,
    shouldRecoverSession,
  ]);

  if (isPending) {
    return (
      <View
        onLayout={() => {
          hideStartupSplash("app session loading layout");
        }}
        style={styles.container}
      >
        <ActivityIndicator size="small" color={BRAND_COLORS.primaryHover} />
        <Text style={styles.text}>Cargando sesion...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    if (shouldRecoverSession && sessionRetryCount < 2) {
      return (
        <View
          onLayout={() => {
            hideStartupSplash("app session recovery layout");
          }}
          style={styles.container}
        >
          <ActivityIndicator size="small" color={BRAND_COLORS.primaryHover} />
          <Text style={styles.text}>Recuperando sesion...</Text>
        </View>
      );
    }

    return <Redirect href="/sign-in" />;
  }

  return (
    <CurrentProfileProvider>
      <ThemeProvider>
        <SocketProvider>
          <NotificationsProvider>
            <VoiceLiveKitProvider>
              <ThemedAppStack />
            </VoiceLiveKitProvider>
          </NotificationsProvider>
        </SocketProvider>
      </ThemeProvider>
    </CurrentProfileProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: BRAND_COLORS.background,
  },
  text: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
  },
});
