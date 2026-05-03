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
  statusSize?: number;
  statusOffsetX?: number;
  statusOffsetY?: number;
  statusRingColor?: string;
  status?: "active" | "inactive";
};

export function UserAvatar({
  avatarUrl,
  username,
  profileId,
  showStatus = false,
  size = 36,
  statusSize,
  statusOffsetX,
  statusOffsetY,
  statusRingColor,
  status,
}: UserAvatarProps) {
  const { colors } = useTheme();
  const radius = size / 2;
  const initial = username.trim().charAt(0).toUpperCase() || "?";
  const isOnlineFromStore = usePresenceStore((state) =>
    profileId ? state.onlineUsers.has(profileId) : false,
  );
  const isOnline = profileId ? isOnlineFromStore : status === "active";

  const ringSize = statusSize ?? Math.max(11, Math.round(size * 0.32));
  const dotSize = statusSize ? Math.round(statusSize * 0.68) : Math.max(7, Math.round(size * 0.22));

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
              backgroundColor: statusRingColor ?? colors.bgSecondary,
              borderRadius: Math.round(ringSize / 2),
              bottom: statusOffsetY ?? -1,
              height: ringSize,
              right: statusOffsetX ?? -1,
              width: ringSize,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isOnline ? "#059669" : "#71717a",
                borderRadius: Math.round(dotSize / 2),
                height: dotSize,
                width: dotSize,
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
    justifyContent: "center",
    position: "absolute",
  },
});
