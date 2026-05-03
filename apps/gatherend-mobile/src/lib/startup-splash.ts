import * as SplashScreen from "expo-splash-screen";

let hasHiddenSplash = false;

export function hideStartupSplash(_source: string) {
  if (hasHiddenSplash) return;

  hasHiddenSplash = true;
  void SplashScreen.hideAsync();
}
