import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

// Must be set at module level so the handler is ready before any notification arrives
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Suppress OS banners while the app is in foreground — the in-app system
    // already shows badge counts and updates the UI in real time.
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type MentionData = {
  notificationType: "MENTION";
  messageId: string;
  channelId: string;
  boardId: string;
};

type DirectMessageData = {
  notificationType: "DIRECT_MESSAGE";
  conversationId: string;
};

type PushNotificationData = MentionData | DirectMessageData | Record<string, unknown>;

function navigateFromNotification(
  router: ReturnType<typeof useRouter>,
  data: PushNotificationData,
) {
  if (!data || typeof data.notificationType !== "string") return;

  if (data.notificationType === "MENTION") {
    const { channelId, boardId } = data as MentionData;
    if (channelId && boardId) {
      router.push({
        pathname: "/(app)/boards/[boardId]/chats/[channelId]",
        params: { boardId, channelId },
      });
    }
  } else if (data.notificationType === "DIRECT_MESSAGE") {
    const { conversationId } = data as DirectMessageData;
    if (conversationId) {
      router.push({
        pathname: "/(app)/chats/[conversationId]",
        params: { conversationId },
      });
    }
  }
}

export function usePushNotificationHandler() {
  const router = useRouter();
  const initialHandled = useRef(false);

  useEffect(() => {
    // Taps on notifications while the app was in background
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content
          .data as PushNotificationData;
        navigateFromNotification(router, data);
      });

    // Tap that cold-launched the app from killed state (runs once per lifecycle)
    if (!initialHandled.current) {
      initialHandled.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (!response?.notification?.request?.content?.data) return;
          navigateFromNotification(
            router,
            response.notification.request.content.data as PushNotificationData,
          );
        })
        .catch(() => {});
    }

    return () => {
      responseSubscription.remove();
    };
  }, [router]);
}
