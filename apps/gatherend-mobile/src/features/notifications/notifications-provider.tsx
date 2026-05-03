import { useEffect, type ReactNode } from "react";
import * as Notifications from "expo-notifications";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useGlobalUnreadSocket } from "./hooks/use-global-unread-socket";
import { useChannelReadState } from "./hooks/use-channel-read-state";
import { useMentionNotifications } from "./hooks/use-mention-notifications";
import { usePushTokenRegistration } from "./hooks/use-push-token-registration";
import { usePushNotificationHandler } from "./hooks/use-push-notification-handler";
import { useMentionStore } from "./stores/use-mention-store";
import { useUnreadStore } from "./stores/use-unread-store";

interface NotificationsProviderProps {
  children: ReactNode;
}

/**
 * Initializes the in-app and push notification infrastructure:
 * - Loads initial unread/mention state from the server.
 * - Listens for real-time channel and DM activity via socket events.
 * - Registers the device push token with the backend.
 * - Handles navigation from notification taps (background and killed state).
 * - Syncs the app icon badge count with the stores.
 *
 * Must be mounted inside SocketProvider and CurrentProfileProvider.
 */
function NotificationsInner({ children }: NotificationsProviderProps) {
  const profile = useProfile();

  useChannelReadState(profile.id);
  useGlobalUnreadSocket({ currentProfileId: profile.id });
  useMentionNotifications(profile.id);
  usePushTokenRegistration(profile.id);
  usePushNotificationHandler();

  // Keep app icon badge count in sync with unread mention + DM counts
  useEffect(() => {
    const syncBadge = () => {
      const { mentions } = useMentionStore.getState();
      const { dmUnreads } = useUnreadStore.getState();

      const mentionCount = Object.values(mentions).filter(Boolean).length;
      const dmCount = Object.keys(dmUnreads).filter(
        (id) => (dmUnreads[id] ?? 0) > 0,
      ).length;

      Notifications.setBadgeCountAsync(mentionCount + dmCount).catch(() => {});
    };

    const unsubMentions = useMentionStore.subscribe(syncBadge);
    const unsubUnreads = useUnreadStore.subscribe(syncBadge);
    syncBadge();

    return () => {
      unsubMentions();
      unsubUnreads();
    };
  }, []);

  return <>{children}</>;
}

export function NotificationsProvider({
  children,
}: NotificationsProviderProps) {
  return <NotificationsInner>{children}</NotificationsInner>;
}
