import { Ionicons } from "@expo/vector-icons";
import { useLocalParticipant } from "@livekit/react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme/theme-provider";
import { useVoiceStore } from "../store/use-voice-store";
import { Text } from "@/src/components/app-typography";

type FloatingPosition = {
  x: number;
  y: number;
};

type FloatingSize = {
  height: number;
  width: number;
};

const EDGE_GAP = 12;
const DRAG_THRESHOLD = 6;

export function VoiceControlBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [barSize, setBarSize] = useState<FloatingSize | null>(null);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const positionRef = useRef<FloatingPosition | null>(null);
  const dragStartRef = useRef<FloatingPosition | null>(null);
  const barSizeRef = useRef<FloatingSize | null>(null);

  const {
    channelName,
    isConnecting,
    isConnected,
    isReconnecting,
    isDeafened,
    errorMessage,
    toggleDeafen,
    leaveVoice,
    setVoiceError,
  } = useVoiceStore();

  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  const isActive = isConnecting || isConnected || isReconnecting || !!errorMessage;

  const clampPosition = useCallback(
    (next: FloatingPosition, size: FloatingSize) => {
      const minX = EDGE_GAP;
      const maxX = Math.max(minX, windowWidth - size.width - EDGE_GAP);
      const minY = insets.top + EDGE_GAP;
      const maxY = Math.max(
        minY,
        windowHeight - size.height - insets.bottom - EDGE_GAP,
      );

      return {
        x: Math.min(Math.max(next.x, minX), maxX),
        y: Math.min(Math.max(next.y, minY), maxY),
      };
    },
    [insets.bottom, insets.top, windowHeight, windowWidth],
  );

  const setFloatingPosition = useCallback((next: FloatingPosition) => {
    positionRef.current = next;
    setPosition(next);
  }, []);

  const handleBarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;
      const currentSize = barSizeRef.current;
      const didSizeChange =
        !currentSize ||
        Math.abs(currentSize.height - height) > 1 ||
        Math.abs(currentSize.width - width) > 1;

      if (!didSizeChange) return;

      const nextSize = { height, width };
      barSizeRef.current = nextSize;
      setBarSize(nextSize);
      if (dragStartRef.current) return;

      const current = positionRef.current;
      const nextPosition = current
        ? clampPosition(current, nextSize)
        : clampPosition(
            {
              x: EDGE_GAP,
              y: windowHeight - height - insets.bottom - EDGE_GAP,
            },
            nextSize,
          );

      setFloatingPosition(nextPosition);
    },
    [clampPosition, insets.bottom, setFloatingPosition, windowHeight],
  );

  useEffect(() => {
    if (!barSize || !positionRef.current) return;
    setFloatingPosition(clampPosition(positionRef.current, barSize));
  }, [barSize, clampPosition, setFloatingPosition]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > DRAG_THRESHOLD ||
          Math.abs(gesture.dy) > DRAG_THRESHOLD,
        onPanResponderGrant: () => {
          dragStartRef.current = positionRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          if (!barSize || !dragStartRef.current) return;

          setFloatingPosition(
            clampPosition(
              {
                x: dragStartRef.current.x + gesture.dx,
                y: dragStartRef.current.y + gesture.dy,
              },
              barSize,
            ),
          );
        },
        onPanResponderRelease: () => {
          dragStartRef.current = null;
        },
        onPanResponderTerminate: () => {
          dragStartRef.current = null;
        },
      }),
    [barSize, clampPosition, setFloatingPosition],
  );

  useEffect(() => {
    if (!errorMessage) return;

    const timeout = setTimeout(() => {
      setVoiceError(null);
    }, 6000);

    return () => clearTimeout(timeout);
  }, [errorMessage, setVoiceError]);

  if (!isActive) return null;

  const handleToggleMic = () => {
    if (!localParticipant || !isConnected) return;
    void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const statusLabel = isReconnecting
    ? "Reconectando..."
    : errorMessage
      ? "No se pudo entrar"
      : isConnecting
        ? "Conectando..."
        : channelName ?? "Canal de voz";

  return (
    <View
      onLayout={handleBarLayout}
      style={[
        styles.bar,
        {
          backgroundColor: colors.bgSecondary,
          borderColor: colors.borderPrimary,
        },
        position
          ? {
              left: position.x,
              top: position.y,
              width: barSize?.width ?? windowWidth - EDGE_GAP * 2,
            }
          : {
              bottom: insets.bottom + EDGE_GAP,
              left: EDGE_GAP,
              right: EDGE_GAP,
            },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Status */}
      <View style={styles.info}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: errorMessage
                ? "#ef4444"
                : isConnected
                  ? "#4ade80"
                  : colors.textMuted,
            },
          ]}
        />
        <View style={styles.statusCopy}>
          <Text style={[styles.channelName, { color: colors.textPrimary }]} numberOfLines={1}>
            {statusLabel}
          </Text>
          {errorMessage ? (
            <Text style={styles.errorText} numberOfLines={1}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
        {(isConnecting || isReconnecting) && (
          <ActivityIndicator size="small" color={colors.textMuted} style={styles.spinner} />
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Deafen */}
        <Pressable
          onPress={toggleDeafen}
          disabled={!isConnected || !!errorMessage}
          style={({ pressed }) => [
            styles.controlBtn,
            { backgroundColor: isDeafened ? colors.accentPrimary : colors.bgTertiary },
            (!isConnected || !!errorMessage || pressed) && styles.pressed,
          ]}
          hitSlop={8}
        >
          <Ionicons
            name={isDeafened ? "volume-mute" : "volume-high"}
            size={17}
            color={isDeafened ? colors.textInverse : colors.textMuted}
          />
        </Pressable>

        {/* Mute */}
        <Pressable
          onPress={handleToggleMic}
          disabled={!isConnected || !!errorMessage}
          style={({ pressed }) => [
            styles.controlBtn,
            { backgroundColor: !isMicrophoneEnabled ? colors.accentPrimary : colors.bgTertiary },
            (!isConnected || !!errorMessage || pressed) && styles.pressed,
          ]}
          hitSlop={8}
        >
          <Ionicons
            name={isMicrophoneEnabled ? "mic" : "mic-off"}
            size={17}
            color={!isMicrophoneEnabled ? colors.textInverse : colors.textMuted}
          />
        </Pressable>

        {/* Disconnect */}
        <Pressable
          onPress={() => {
            setVoiceError(null);
            leaveVoice();
          }}
          style={({ pressed }) => [
            styles.controlBtn,
            styles.disconnectBtn,
            pressed && styles.pressed,
          ]}
          hitSlop={8}
        >
          <Ionicons name="call" size={17} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    bar: {
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      elevation: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 10,
      position: "absolute",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      zIndex: 999,
    },
    info: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: 8,
      minWidth: 0,
    },
    dot: {
      borderRadius: 999,
      height: 8,
      width: 8,
    },
    channelName: {
      fontSize: 13,
      fontWeight: "600",
    },
    errorText: {
      color: "#fca5a5",
      fontSize: 11,
      fontWeight: "600",
    },
    statusCopy: {
      flex: 1,
      gap: 1,
      minWidth: 0,
    },
    spinner: {
      marginLeft: 2,
    },
    controls: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    controlBtn: {
      alignItems: "center",
      borderRadius: 10,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    disconnectBtn: {
      backgroundColor: "#ef4444",
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
