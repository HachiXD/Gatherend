import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { usePresenceStore } from "@/src/features/presence/store/use-presence-store";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

type UserAvatarProps = {
  avatarUrl?: string | null;
  username: string;
  profileId?: string;
  showStatus?: boolean;
  size?: number;
  status?: "active" | "inactive";
};

export function UserAvatar({
  avatarUrl,
  username,
  profileId,
  showStatus = false,
  size = 36,
  status,
}: UserAvatarProps) {
  const { colors } = useTheme();
  const radius = size / 2;
  const initial = username.trim().charAt(0).toUpperCase() || "?";
  const isOnlineFromStore = usePresenceStore((state) =>
    profileId ? state.onlineUsers.has(profileId) : false,
  );
  const isOnline = profileId ? isOnlineFromStore : status === "active";

  const avatar = avatarUrl ? (
    <Image
      contentFit="cover"
      source={{ uri: avatarUrl }}
      style={{
        borderRadius: radius,
        flexShrink: 0,
        height: size,
        width: size,
      }}
    />
  ) : (
    <View
      style={[
        styles.fallback,
        {
          backgroundColor: colors.avatarFallbackBg,
          borderRadius: radius,
          height: size,
          width: size,
        },
      ]}
    >
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]}>
        {initial}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { height: size, width: size }]}>
      {avatar}
      {showStatus ? (
        <View
          style={[
            styles.statusRing,
            {
              backgroundColor: colors.bgSecondary,
              borderRadius: Math.round(size * 0.18),
              height: Math.max(11, Math.round(size * 0.32)),
              width: Math.max(11, Math.round(size * 0.32)),
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isOnline ? "#059669" : "#71717a",
                borderRadius: Math.round(size * 0.13),
                height: Math.max(7, Math.round(size * 0.22)),
                width: Math.max(7, Math.round(size * 0.22)),
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    position: "relative",
  },
  fallback: {
    alignItems: "center",
    flexShrink: 0,
    justifyContent: "center",
  },
  initial: {
    color: "#f8fafc",
    fontWeight: "700",
  },
  statusDot: {},
  statusRing: {
    alignItems: "center",
    bottom: -1,
    justifyContent: "center",
    position: "absolute",
    right: -1,
  },
});
