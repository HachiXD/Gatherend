import { DarkTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { usePathname } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { AppBottomTabBar } from "@/src/features/navigation/components/app-bottom-tab-bar";
import { useAppShellStore } from "@/src/features/navigation/stores/use-app-shell-store";
import { useTheme } from "@/src/theme/theme-provider";

type AppShellTab = "boards" | "discovery" | "me";

function getActiveTab(pathname: string): AppShellTab {
  if (pathname.startsWith("/discovery")) return "discovery";
  if (pathname.startsWith("/me")) return "me";
  return "boards";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const pathname = usePathname();
  const activeTab = getActiveTab(pathname);
  const isBoardDrawerOpen = useAppShellStore(
    (state) => state.isBoardDrawerOpen,
  );

  const navigationTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: colors.bgPrimary,
        border: colors.borderSecondary,
        card: colors.bgSecondary,
        notification: colors.accentPrimary,
        primary: colors.accentPrimary,
        text: colors.textPrimary,
      },
    }),
    [colors],
  );

  const isInBoards = pathname.startsWith("/boards");
  const shouldNavigatorCoverTabBar = isInBoards && !isBoardDrawerOpen;

  return (
    <View style={[styles.root, { backgroundColor: colors.bgPrimary }]}>
      <NavigationThemeProvider value={navigationTheme}>
        <View
          style={[
            styles.navigator,
            shouldNavigatorCoverTabBar ? styles.navigatorAboveTabBar : null,
          ]}
        >
          {children}
        </View>
      </NavigationThemeProvider>
      <View style={styles.bottomTabBar}>
        <AppBottomTabBar activeTab={activeTab} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navigator: {
    flex: 1,
    zIndex: 1,
  },
  navigatorAboveTabBar: {
    zIndex: 10,
  },
  bottomTabBar: {
    bottom: 0,
    elevation: 5,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 5,
  },
});
