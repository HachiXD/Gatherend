import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useRef, useState } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/src/components/app-typography";
import { useTheme } from "@/src/theme/theme-provider";

export type BoardQuickActionKey = "chat" | "post" | "rules" | "wiki";

interface QuickAction {
  key: BoardQuickActionKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  angleDeg: number;
}

// Fan above the press point (standard math angles: 0°=right, 90°=down)
const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "chat",
    label: "Chat",
    icon: "chatbubble-ellipses-outline",
    angleDeg: 270,
  },
  {
    key: "post",
    label: "Post",
    icon: "create-outline",
    angleDeg: 210,
  },
  {
    key: "rules",
    label: "Reglas",
    icon: "document-text-outline",
    angleDeg: 330,
  },
  {
    key: "wiki",
    label: "Wiki",
    icon: "book-outline",
    angleDeg: 150,
  },
];

const RADIUS = 92;
const BUTTON_SIZE = 62;

interface BoardQuickActionsMenuProps {
  children: React.ReactNode;
  onAction?: (key: BoardQuickActionKey) => void;
}

export function BoardQuickActionsMenu({
  children,
  onAction,
}: BoardQuickActionsMenuProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isVisible, setIsVisible] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  // One Animated.Value per button driving 0 → 1 progress
  const buttonAnims = useRef(
    QUICK_ACTIONS.map(() => new Animated.Value(0)),
  ).current;

  const show = useCallback(
    (x: number, y: number) => {
      setOrigin({ x, y });
      setIsVisible(true);
      buttonAnims.forEach((a) => a.setValue(0));
      Animated.parallel(
        buttonAnims.map((anim, i) =>
          Animated.spring(anim, {
            toValue: 1,
            damping: 16,
            stiffness: 300,
            mass: 0.55,
            delay: i * 55,
            useNativeDriver: true,
          }),
        ),
      ).start();
    },
    [buttonAnims],
  );

  const hide = useCallback(() => {
    Animated.parallel(
      buttonAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 0,
          duration: 110,
          useNativeDriver: true,
        }),
      ),
    ).start(({ finished }) => {
      if (finished) setIsVisible(false);
    });
  }, [buttonAnims]);

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(450)
        .enabled(!isVisible)
        .onStart((e) => {
          runOnJS(show)(e.absoluteX, e.absoluteY);
        }),
    [isVisible, show],
  );

  return (
    <GestureDetector gesture={longPressGesture}>
      <View style={styles.wrapper}>
        {children}

        {isVisible ? (
          <View style={StyleSheet.absoluteFill}>
            {/* Backdrop — tapping anywhere dismisses */}
            <Pressable
              style={[StyleSheet.absoluteFill, styles.backdrop]}
              onPress={hide}
            />

            {/* Small dot at the press origin */}
            <View
              pointerEvents="none"
              style={[
                styles.originDot,
                { left: origin.x - 5, top: origin.y - 5 },
              ]}
            />

            {QUICK_ACTIONS.map((action, i) => {
              const rad = (action.angleDeg * Math.PI) / 180;
              const finalTx = Math.cos(rad) * RADIUS;
              const finalTy = Math.sin(rad) * RADIUS;
              const anim = buttonAnims[i];

              const translateX = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, finalTx],
              });
              const translateY = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, finalTy],
              });
              const scale = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.25, 1],
              });
              const opacity = anim.interpolate({
                inputRange: [0, 0.45, 1],
                outputRange: [0, 1, 1],
              });

              return (
                <Animated.View
                  key={action.key}
                  style={[
                    styles.actionContainer,
                    {
                      left: origin.x - BUTTON_SIZE / 2,
                      top: origin.y - BUTTON_SIZE / 2,
                      opacity,
                      transform: [
                        { translateX },
                        { translateY },
                        { scale },
                      ],
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      hide();
                      onAction?.(action.key);
                    }}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed ? styles.actionButtonPressed : null,
                    ]}
                  >
                    <Ionicons
                      color={colors.textPrimary}
                      name={action.icon}
                      size={24}
                    />
                  </Pressable>

                  <Text numberOfLines={1} style={styles.actionLabel}>
                    {action.label}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    wrapper: {
      flex: 1,
    },
    backdrop: {
      backgroundColor: "rgba(2, 6, 23, 0.42)",
    },
    originDot: {
      backgroundColor: colors.accentPrimary,
      borderRadius: 5,
      height: 10,
      position: "absolute",
      width: 10,
    },
    actionContainer: {
      alignItems: "center",
      gap: 7,
      position: "absolute",
      width: BUTTON_SIZE + 20,
    },
    actionButton: {
      alignItems: "center",
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderPrimary,
      borderRadius: BUTTON_SIZE / 2,
      borderWidth: 1,
      elevation: 10,
      height: BUTTON_SIZE,
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      width: BUTTON_SIZE,
    },
    actionButtonPressed: {
      opacity: 0.78,
      transform: [{ scale: 0.92 }],
    },
    actionLabel: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center",
      textShadowColor: "rgba(2, 6, 23, 0.9)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 5,
    },
  });
}
