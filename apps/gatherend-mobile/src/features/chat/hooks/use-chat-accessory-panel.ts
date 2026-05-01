import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Keyboard, type ViewStyle } from "react-native";
import {
  getCachedKeyboardHeight,
  getEstimatedKeyboardHeight,
  getKeyboardHeightDimensions,
  KEYBOARD_HEIGHT_UI_THRESHOLD,
  loadPersistedKeyboardHeight,
  saveMeasuredKeyboardHeight,
  type KeyboardHeightDimensions,
} from "../utils/keyboard-height-cache";

type ChatAccessoryPanel = "emoji" | "sticker";

const MIN_PANEL_HEIGHT = 260;
const PANEL_HEIGHT_EXTRA = 3;

function resolvePanelHeight(height: number) {
  return Math.max(MIN_PANEL_HEIGHT, height) + PANEL_HEIGHT_EXTRA;
}

function resolveKeyboardEventHeight(
  dimensions: KeyboardHeightDimensions,
  event: {
    endCoordinates?: { height?: number; screenY?: number };
  },
) {
  const reportedHeight = event.endCoordinates?.height ?? 0;
  const screenY = event.endCoordinates?.screenY;
  const visualHeight =
    typeof screenY === "number"
      ? Math.max(0, dimensions.screenHeight - screenY)
      : 0;

  return Math.max(reportedHeight, visualHeight);
}

export function useChatAccessoryPanel() {
  const initialKeyboardHeight = getCachedKeyboardHeight(
    getKeyboardHeightDimensions(),
  );
  const [activePanel, setActivePanel] = useState<ChatAccessoryPanel | null>(
    null,
  );
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const activePanelRef = useRef(activePanel);
  const keyboardVisibleRef = useRef(isKeyboardVisible);
  const lastKeyboardHeightRef = useRef<number | null>(initialKeyboardHeight);
  const hasMeasuredKeyboardRef = useRef(initialKeyboardHeight !== null);

  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    keyboardVisibleRef.current = isKeyboardVisible;
  }, [isKeyboardVisible]);

  useEffect(() => {
    let isMounted = true;
    const dimensions = getKeyboardHeightDimensions();

    void loadPersistedKeyboardHeight(dimensions).then((height) => {
      if (!isMounted || height === null) return;

      lastKeyboardHeightRef.current = height;
      hasMeasuredKeyboardRef.current = true;

      if (activePanelRef.current || keyboardVisibleRef.current) {
        const nextHeight = resolvePanelHeight(height);
        setPanelHeight((currentHeight) =>
          Math.abs(currentHeight - nextHeight) > KEYBOARD_HEIGHT_UI_THRESHOLD
            ? nextHeight
            : currentHeight,
        );
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyboardShow = (event: {
      endCoordinates?: { height?: number; screenY?: number };
    }) => {
      const dimensions = getKeyboardHeightDimensions();
      const resolvedHeight = resolveKeyboardEventHeight(dimensions, event);
      if (resolvedHeight > 0) {
        lastKeyboardHeightRef.current = resolvedHeight;
        hasMeasuredKeyboardRef.current = true;
        void saveMeasuredKeyboardHeight(dimensions, resolvedHeight);

        if (!activePanelRef.current) {
          setPanelHeight((currentHeight) => {
            const nextHeight = resolvePanelHeight(resolvedHeight);
            return Math.abs(currentHeight - nextHeight) >
              KEYBOARD_HEIGHT_UI_THRESHOLD
              ? nextHeight
              : currentHeight;
          });
        }
      }

      keyboardVisibleRef.current = true;
      setKeyboardVisible(true);
    };

    const handleKeyboardHide = () => {
      keyboardVisibleRef.current = false;
      setKeyboardVisible(false);
      if (!activePanelRef.current) {
        setPanelHeight(0);
      }
    };

    const show = Keyboard.addListener("keyboardDidShow", handleKeyboardShow);
    const hide = Keyboard.addListener("keyboardDidHide", handleKeyboardHide);

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (isKeyboardVisible || activePanel) {
      return;
    }

    setPanelHeight(0);
  }, [activePanel, isKeyboardVisible]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!activePanelRef.current) {
          return false;
        }

        activePanelRef.current = null;
        setActivePanel(null);
        setPanelHeight(0);
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const panelAnimatedStyle = useMemo<ViewStyle>(
    () => ({
      height: panelHeight,
      overflow: "hidden",
    }),
    [panelHeight],
  );

  function openPanel(type: ChatAccessoryPanel) {
    const dimensions = getKeyboardHeightDimensions();
    const cachedHeight =
      lastKeyboardHeightRef.current ?? getCachedKeyboardHeight(dimensions);
    const targetHeight = resolvePanelHeight(
      cachedHeight ?? getEstimatedKeyboardHeight(dimensions),
    );

    activePanelRef.current = type;
    keyboardVisibleRef.current = false;
    setKeyboardVisible(false);
    setActivePanel(type);
    setPanelHeight(targetHeight);
    Keyboard.dismiss();
  }

  function closePanel() {
    activePanelRef.current = null;
    setActivePanel(null);
    setPanelHeight(0);
  }

  function handleInputFocus() {
    activePanelRef.current = null;
    keyboardVisibleRef.current = true;
    setKeyboardVisible(true);
    setActivePanel(null);

    if (hasMeasuredKeyboardRef.current) {
      const keyboardHeight =
        lastKeyboardHeightRef.current ??
        getCachedKeyboardHeight(getKeyboardHeightDimensions());

      if (keyboardHeight !== null) {
        setPanelHeight(resolvePanelHeight(keyboardHeight));
      }
    }
  }

  return {
    activePanel,
    closePanel,
    isComposerCompact: activePanel !== null || isKeyboardVisible,
    onInputFocus: handleInputFocus,
    openPanel,
    panelAnimatedStyle,
  };
}
