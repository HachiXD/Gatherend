import { Redirect, Stack } from "expo-router";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { useSession } from "@/src/features/auth/hooks/use-session";
import { CurrentProfileProvider } from "@/src/features/profile/providers/current-profile-provider";
import { ThemeProvider, useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";
import { BRAND_COLORS } from "@/src/theme/brand-colors";

function ThemedModalStack() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        contentStyle: {
          backgroundColor: colors.bgPrimary,
        },
        headerShown: false,
        presentation: "modal",
      }}
    />
  );
}

export default function ModalLayout() {
  const { isPending, isAuthenticated } = useSession();

  if (isPending) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={BRAND_COLORS.primaryHover} size="small" />
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
        <ThemedModalStack />
      </ThemeProvider>
    </CurrentProfileProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: BRAND_COLORS.background,
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  text: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
  },
});
