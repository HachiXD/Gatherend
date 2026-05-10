import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/src/components/app-typography";
import { useMentionStore } from "@/src/features/notifications/stores/use-mention-store";
import { useAppShellStore } from "@/src/features/navigation/stores/use-app-shell-store";
import { useTheme } from "@/src/theme/theme-provider";

export const APP_TAB_BAR_CONTENT_HEIGHT = 84;
export const APP_TAB_BAR_BOTTOM_PADDING = 12;

type AppBottomTabKey = "boards" | "discovery" | "me";
type BoardSectionKey = "home" | "forum" | "wiki" | "chats" | "settings";

function getBoardSectionPathname(section: BoardSectionKey) {
  switch (section) {
    case "forum":
      return "/boards/[boardId]/forum";
    case "wiki":
      return "/boards/[boardId]/wiki";
    case "settings":
      return "/boards/[boardId]/settings";
    case "chats":
      return "/boards/[boardId]/chats";
    case "home":
    default:
      return "/boards/[boardId]/home";
  }
}

const APP_BOTTOM_TABS: {
  key: AppBottomTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  pathname: Href;
}[] = [
  {
    key: "boards",
    label: "Boards",
    icon: "grid-outline",
    pathname: "/boards",
  },
  {
    key: "discovery",
    label: "Descubrir",
    icon: "compass-outline",
    pathname: "/discovery",
  },
  {
    key: "me",
    label: "Perfil",
    icon: "person-outline",
    pathname: "/me",
  },
];

const TabIcon = memo(function TabIcon({
  focused,
  name,
}: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  const iconColor = focused ? colors.accentPrimary : colors.textMutedAlt;
  const filledName = name.replace(
    "-outline",
    "",
  ) as keyof typeof Ionicons.glyphMap;
  const iconName = focused ? filledName : name;

  return (
    <View style={styles.iconSlot}>
      <Ionicons color={iconColor} name={iconName} size={28} />
    </View>
  );
});

function BadgeCount({ count }: { count: number }) {
  const { colors } = useTheme();
  if (count <= 0) return null;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.accentPrimary,
          borderColor: colors.bgSecondary,
        },
      ]}
    >
      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

const TabBadge = memo(function TabBadge({ tabKey }: { tabKey: AppBottomTabKey }) {
  const mentionCount = useMentionStore(
    (state) =>
      tabKey === "boards"
        ? Object.values(state.mentions).filter(Boolean).length
        : 0,
  );

  return <BadgeCount count={mentionCount} />;
});

type BottomTabItemProps = {
  focused: boolean;
  labelActiveStyle: { color: string };
  labelInactiveStyle: { color: string };
  onBoardsPress?: () => void;
  tab: (typeof APP_BOTTOM_TABS)[number];
};

const BottomTabItem = memo(function BottomTabItem({
  focused,
  labelActiveStyle,
  labelInactiveStyle,
  onBoardsPress,
  tab,
}: BottomTabItemProps) {
  const router = useRouter();
  const lastBoardId = useAppShellStore((state) => state.lastBoardId);
  const lastBoardSection = useAppShellStore((state) => state.lastBoardSection);
  const accessibilityState = useMemo(
    () => ({ selected: focused }),
    [focused],
  );

  const handlePress = useCallback(() => {
    if (focused) {
      if (tab.key === "boards") onBoardsPress?.();
      return;
    }

    if (tab.key === "boards" && lastBoardId) {
      router.replace({
        pathname: getBoardSectionPathname(lastBoardSection),
        params: { boardId: lastBoardId },
      });
      return;
    }

    router.replace(tab.pathname);
  }, [
    focused,
    lastBoardId,
    lastBoardSection,
    onBoardsPress,
    router,
    tab.key,
    tab.pathname,
  ]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={accessibilityState}
      onPress={handlePress}
      style={styles.item}
    >
      <View style={styles.iconWrap}>
        <TabIcon focused={focused} name={tab.icon} />
        <TabBadge tabKey={tab.key} />
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          focused ? labelActiveStyle : labelInactiveStyle,
        ]}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
});

export const AppBottomTabBar = memo(function AppBottomTabBar({
  activeTab,
  onBoardsPress,
}: {
  activeTab: AppBottomTabKey;
  onBoardsPress?: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, APP_TAB_BAR_BOTTOM_PADDING);
  const stylesWithTheme = useMemo(
    () => ({
      root: {
        backgroundColor: colors.bgSecondary,
        borderTopColor: colors.borderSecondary,
        height: APP_TAB_BAR_CONTENT_HEIGHT + bottomInset,
        paddingBottom: bottomInset,
      },
      labelInactive: {
        color: colors.textMutedAlt,
      },
      labelActive: {
        color: colors.accentPrimary,
      },
    }),
    [bottomInset, colors],
  );

  return (
    <View style={[styles.root, stylesWithTheme.root]}>
      {APP_BOTTOM_TABS.map((tab) => (
        <BottomTabItem
          focused={tab.key === activeTab}
          key={tab.key}
          labelActiveStyle={stylesWithTheme.labelActive}
          labelInactiveStyle={stylesWithTheme.labelInactive}
          onBoardsPress={onBoardsPress}
          tab={tab}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    borderTopWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    paddingTop: 0,
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: 0,
    justifyContent: "flex-start",
    paddingTop: 10,
  },
  iconWrap: {
    height: 34,
    justifyContent: "flex-end",
    position: "relative",
  },
  iconSlot: {
    alignItems: "center",
    height: 34,
    justifyContent: "flex-end",
    position: "relative",
    transform: [{ translateY: -4 }],
    width: 44,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 7,
  },
  badge: {
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    minWidth: 18,
    paddingHorizontal: 5,
    position: "absolute",
    right: -4,
    top: -7,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
  },
});
