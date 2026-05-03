import { registerGlobals } from "@livekit/react-native";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/geist";
import { DarkTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/src/providers/auth-provider";
import { QueryProvider } from "@/src/providers/query-provider";
import { BRAND_COLORS } from "@/src/theme/brand-colors";

registerGlobals();
void SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(BRAND_COLORS.background);

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: BRAND_COLORS.background,
    border: BRAND_COLORS.border,
    card: BRAND_COLORS.background,
    notification: BRAND_COLORS.primaryHover,
    primary: BRAND_COLORS.primaryHover,
    text: BRAND_COLORS.text,
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          backgroundColor: BRAND_COLORS.background,
          flex: 1,
        }}
      />
    );
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: BRAND_COLORS.background }}
    >
      <SafeAreaProvider>
        <NavigationThemeProvider value={navigationTheme}>
          <QueryProvider>
            <AuthProvider>
              <Stack
                screenOptions={{
                  contentStyle: { backgroundColor: BRAND_COLORS.background },
                  headerShown: false,
                }}
              >
                <Stack.Screen name="(public)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
                <Stack.Screen name="modal" options={{ presentation: "modal" }} />
              </Stack>
              <StatusBar style="light" />
            </AuthProvider>
          </QueryProvider>
        </NavigationThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
