import { DarkTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { usePathname } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { InteractionManager, StyleSheet, View } from "react-native";
import { AppBottomTabBar } from "@/src/features/navigation/components/app-bottom-tab-bar";
import { useTheme } from "@/src/theme/theme-provider";

type AppShellTab = "boards" | "chats" | "discovery" | "me";

function getActiveTab(pathname: string): AppShellTab {
  if (pathname.startsWith("/chats")) return "chats";
  if (pathname.startsWith("/discovery")) return "discovery";
  if (pathname.startsWith("/me")) return "me";
  return "boards";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const pathname = usePathname();
  const activeTab = getActiveTab(pathname);
  const [holdTabBarForBoards, setHoldTabBarForBoards] = useState(false);
  const previousIsInBoardsRef = useRef(pathname.startsWith("/boards"));

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
  const showAppShellTabBar = !isInBoards || holdTabBarForBoards;

  useEffect(() => {
    const wasInBoards = previousIsInBoardsRef.current;
    previousIsInBoardsRef.current = isInBoards;

    if (!isInBoards) {
      setHoldTabBarForBoards(false);
      return;
    }

    if (wasInBoards) return;

    setHoldTabBarForBoards(true);
    const interaction = InteractionManager.runAfterInteractions(() => {
      setHoldTabBarForBoards(false);
    });

    return () => {
      interaction.cancel();
    };
  }, [isInBoards]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bgPrimary }]}>
      <NavigationThemeProvider value={navigationTheme}>
        <View style={styles.navigator}>{children}</View>
      </NavigationThemeProvider>
      {showAppShellTabBar && (
        <View style={styles.bottomTabBar}>
          <AppBottomTabBar activeTab={activeTab} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navigator: {
    flex: 1,
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
