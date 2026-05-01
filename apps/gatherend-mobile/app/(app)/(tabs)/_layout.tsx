import { Ionicons } from "@expo/vector-icons";
import { DarkTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Tabs } from "expo-router";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme/theme-provider";

const TAB_BAR_CONTENT_HEIGHT = 84;
const TAB_BAR_BOTTOM_PADDING = 12;

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

function TabIcon({
  focused,
  name,
}: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, {
      damping: 14,
      stiffness: 200,
      mass: 0.7,
    });
  }, [focused, progress]);

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.045 }],
  }));

  const outlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.85],
      [1, 0.12],
      Extrapolation.CLAMP,
    ),
  }));

  const filledStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.12, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const fillRevealStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0.08, 1],
      [0, 28],
      Extrapolation.CLAMP,
    ),
  }));

  const iconProps = useAnimatedProps(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [colors.textMutedAlt, colors.accentPrimary],
    ),
  }));

  const filledName = name.replace(
    "-outline",
    "",
  ) as keyof typeof Ionicons.glyphMap;

  return (
    <View style={styles.iconSlot}>
      <Animated.View style={[styles.iconWrapper, iconContainerStyle]}>
        <Animated.View style={[styles.iconAbsolute, outlineStyle]}>
          <AnimatedIonicons name={name} size={28} animatedProps={iconProps} />
        </Animated.View>
        <Animated.View style={[styles.iconAbsolute, filledStyle]}>
          <Animated.View style={[styles.fillReveal, fillRevealStyle]}>
            <AnimatedIonicons
              name={filledName}
              size={28}
              animatedProps={iconProps}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING);
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

  return (
    <View style={[styles.root, { backgroundColor: colors.bgPrimary }]}>
      <NavigationThemeProvider value={navigationTheme}>
        <Tabs
          initialRouteName="boards"
          screenOptions={{
            animation: "fade",
            headerShown: false,
            tabBarActiveTintColor: colors.accentPrimary,
            tabBarInactiveTintColor: colors.textMutedAlt,
            tabBarLabelStyle: {
              fontSize: 13,
              fontWeight: "700",
              lineHeight: 15,
              marginTop: 9,
            },
            tabBarStyle: {
              backgroundColor: colors.bgSecondary,
              borderTopColor: colors.borderSecondary,
              borderTopWidth: 1,
              display: "flex",
              height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
              paddingBottom: bottomInset,
              paddingTop: 0,
              overflow: "hidden",
            },
            sceneStyle: {
              backgroundColor: colors.bgPrimary,
            },
            tabBarItemStyle: {
              gap: 0,
              paddingTop: 10,
            },
          }}
        >
          <Tabs.Screen
            name="boards"
            options={{
              title: "Boards",
              tabBarIcon: ({ focused }) => (
                <TabIcon focused={focused} name="grid-outline" />
              ),
            }}
          />
          <Tabs.Screen
            name="chats"
            options={{
              title: "Chats",
              tabBarIcon: ({ focused }) => (
                <TabIcon focused={focused} name="chatbubble-outline" />
              ),
            }}
          />
          <Tabs.Screen
            name="discovery/index"
            options={{
              title: "Descubrir",
              tabBarIcon: ({ focused }) => (
                <TabIcon focused={focused} name="compass-outline" />
              ),
            }}
          />
          <Tabs.Screen
            name="me"
            options={{
              title: "Perfil",
              tabBarIcon: ({ focused }) => (
                <TabIcon focused={focused} name="person-outline" />
              ),
            }}
          />
        </Tabs>
      </NavigationThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  iconSlot: {
    alignItems: "center",
    height: 34,
    justifyContent: "flex-end",
    position: "relative",
    transform: [{ translateY: -4 }],
    width: 44,
  },
  iconWrapper: {
    height: 28,
    width: 28,
  },
  iconAbsolute: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  fillReveal: {
    bottom: 0,
    height: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
  },
});
