import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { expressFetch } from "@/src/services/express/express-fetch";

function getEasProjectId(): string | undefined {
  return (
    (
      Constants.expoConfig?.extra as
        | { eas?: { projectId?: string } }
        | undefined
    )?.eas?.projectId ?? Constants.easConfig?.projectId
  );
}

export function usePushTokenRegistration(profileId: string | undefined) {
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profileId) return;

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "Gatherend",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#3D6E58",
        enableLights: true,
        enableVibrate: true,
      }).catch(() => {});
    }

    let pushTokenSubscription: Notifications.Subscription | null = null;

    const register = async (token: string) => {
      if (registeredTokenRef.current === token) return;
      try {
        const res = await expressFetch("/push-tokens", {
          method: "POST",
          profileId,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
          }),
        });
        if (res.ok) {
          registeredTokenRef.current = token;
        }
      } catch (err) {
        console.error("[push] register failed:", err);
      }
    };

    const setup = async () => {
      try {
        const { status: currentStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = currentStatus;

        if (currentStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") return;

        const projectId = getEasProjectId();
        const opts = projectId ? { projectId } : {};
        const { data: token } =
          await Notifications.getExpoPushTokenAsync(opts);

        await register(token);

        // Device token can rotate (reinstall, token expiry) — re-fetch Expo token
        pushTokenSubscription = Notifications.addPushTokenListener(
          async () => {
            try {
              const { data: refreshedToken } =
                await Notifications.getExpoPushTokenAsync(opts);
              await register(refreshedToken);
            } catch (err) {
              console.error("[push] token refresh failed:", err);
            }
          },
        );
      } catch (err) {
        console.error("[push] setup failed:", err);
      }
    };

    setup();

    return () => {
      pushTokenSubscription?.remove();

      // Deregister token on logout / provider unmount
      const token = registeredTokenRef.current;
      if (token) {
        expressFetch("/push-tokens", {
          method: "DELETE",
          profileId,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).catch(() => {});
        registeredTokenRef.current = null;
      }
    };
  }, [profileId]);
}
