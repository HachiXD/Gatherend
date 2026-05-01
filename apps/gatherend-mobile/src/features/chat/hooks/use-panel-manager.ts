import { useState } from "react";
import { Keyboard } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type PanelType = "sticker" | "emoji";

const DEFAULT_PANEL_HEIGHT = 300;
const MIN_PANEL_HEIGHT = 260;

function resolvePanelHeight(height: number) {
  return Math.max(MIN_PANEL_HEIGHT, height || DEFAULT_PANEL_HEIGHT);
}

export function usePanelManager() {
  const [activePanel, setActivePanel] = useState<PanelType | null>(null);
  const panelHeight = useSharedValue(0);
  const savedKeyboardHeight = useSharedValue(DEFAULT_PANEL_HEIGHT);
  const isPanelOpen = useSharedValue(false);

  const panelAnimatedStyle = useAnimatedStyle(() => ({
    height: panelHeight.value,
    overflow: "hidden",
  }));

  function openPanel(type: PanelType) {
    const targetHeight = resolvePanelHeight(savedKeyboardHeight.value);
    isPanelOpen.value = true;
    setActivePanel(type);
    Keyboard.dismiss();
    panelHeight.value = withTiming(targetHeight, { duration: 250 });
  }

  function closePanel() {
    isPanelOpen.value = false;
    setActivePanel(null);
    panelHeight.value = withTiming(0, { duration: 200 });
  }

  // Call this from the TextInput's onFocus prop so opening the keyboard
  // collapses any open panel and lets the keyboard drive the height again.
  function onInputFocus() {
    if (isPanelOpen.value) {
      isPanelOpen.value = false;
      panelHeight.value = 0;
      setActivePanel(null);
    }
  }

  return { activePanel, openPanel, closePanel, onInputFocus, panelAnimatedStyle };
}
