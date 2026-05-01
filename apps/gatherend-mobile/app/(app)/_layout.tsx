import { Redirect, Stack } from "expo-router";
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
import { BRAND_COLORS } from "@/src/theme/brand-colors";

function ThemedAppStack() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.bgPrimary,
        },
      }}
    />
  );
}

export default function AppLayout() {
  const { isPending, isAuthenticated } = useSession();

  if (isPending) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={BRAND_COLORS.primaryHover} />
        <Text style={styles.text}>Cargando sesion...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <CurrentProfileProvider>
      <ThemeProvider>
        <SocketProvider>
          <VoiceLiveKitProvider>
            <ThemedAppStack />
          </VoiceLiveKitProvider>
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
