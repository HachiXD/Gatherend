import { Expo } from "expo-server-sdk";
import type { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { PushNotificationType, PushTokenPlatform } from "@prisma/client";
import { db } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
});

export type UpsertPushTokenParams = {
  profileId: string;
  token: string;
  platform: PushTokenPlatform;
  projectId?: string;
  appId?: string;
  deviceId?: string;
  deviceName?: string;
};

export async function upsertPushToken(params: UpsertPushTokenParams) {
  const { profileId, token, platform, projectId, appId, deviceId, deviceName } =
    params;

  return db.pushToken.upsert({
    where: { token },
    create: {
      profileId,
      token,
      platform,
      projectId,
      appId,
      deviceId,
      deviceName,
      status: "ACTIVE",
      lastSeenAt: new Date(),
    },
    update: {
      // Re-assign token if user logged out and back in on the same device
      profileId,
      platform,
      projectId,
      appId,
      deviceId,
      deviceName,
      status: "ACTIVE",
      disabledAt: null,
      disableReason: null,
      lastSeenAt: new Date(),
    },
    select: { id: true, token: true, status: true },
  });
}

export async function disablePushToken(token: string, profileId: string) {
  return db.pushToken.updateMany({
    where: { token, profileId },
    data: {
      status: "DISABLED",
      disabledAt: new Date(),
      disableReason: "user_logout",
    },
  });
}

export type SendPushParams = {
  profileIds: string[];
  notificationType: PushNotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendPushToProfiles({
  profileIds,
  notificationType,
  title,
  body,
  data,
}: SendPushParams): Promise<void> {
  if (profileIds.length === 0) return;

  const activeTokens = await db.pushToken.findMany({
    where: { profileId: { in: profileIds }, status: "ACTIVE" },
    select: { id: true, token: true, profileId: true },
  });

  if (activeTokens.length === 0) return;

  const validTokens = activeTokens.filter((t) => Expo.isExpoPushToken(t.token));
  if (validTokens.length === 0) return;

  const messages: ExpoPushMessage[] = validTokens.map((t) => ({
    to: t.token,
    sound: "default",
    title,
    body,
    data: { notificationType, ...data },
  }));

  let tickets: ExpoPushTicket[];
  try {
    // SDK handles chunking (max 100 per request) and retries internally
    tickets = await expo.sendPushNotificationsAsync(messages);
  } catch (err) {
    logger.error("[PUSH] sendPushNotificationsAsync failed:", err);
    await db.pushNotificationDelivery.createMany({
      data: validTokens.map((t) => ({
        profileId: t.profileId,
        pushTokenId: t.id,
        notificationType,
        status: "FAILED" as const,
        title,
        body,
        data: (data ?? {}) as object,
        errorMessage: "Send request failed",
      })),
    });
    return;
  }

  await db.pushNotificationDelivery.createMany({
    skipDuplicates: true,
    data: tickets.map((ticket, i) => {
      const tokenRecord = validTokens[i];
      if (ticket.status === "ok") {
        return {
          profileId: tokenRecord.profileId,
          pushTokenId: tokenRecord.id,
          notificationType,
          status: "SENT" as const,
          title,
          body,
          data: (data ?? {}) as object,
          expoTicketId: ticket.id,
          expoTicketStatus: "ok",
          sentAt: new Date(),
        };
      }
      return {
        profileId: tokenRecord.profileId,
        pushTokenId: tokenRecord.id,
        notificationType,
        status: "FAILED" as const,
        title,
        body,
        data: (data ?? {}) as object,
        expoTicketStatus: "error",
        errorCode: ticket.details?.error,
        errorMessage: ticket.message,
        sentAt: new Date(),
      };
    }),
  });

  // Disable tokens that Expo already knows are invalid
  const tokensToDisable = tickets
    .map((ticket, i) => ({ ticket, tokenId: validTokens[i].id }))
    .filter(
      ({ ticket }) =>
        ticket.status === "error" &&
        (ticket.details?.error === "DeviceNotRegistered" ||
          ticket.details?.error === "InvalidCredentials"),
    )
    .map(({ tokenId }) => tokenId);

  if (tokensToDisable.length > 0) {
    await db.pushToken.updateMany({
      where: { id: { in: tokensToDisable } },
      data: {
        status: "DISABLED",
        disabledAt: new Date(),
        disableReason: "DeviceNotRegistered",
      },
    });
  }
}

export async function processPendingReceipts(): Promise<void> {
  // Expo recommends checking receipts at least 15 minutes after sending
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);

  const sentDeliveries = await db.pushNotificationDelivery.findMany({
    where: {
      status: "SENT",
      expoTicketId: { not: null },
      sentAt: { lte: cutoff },
      receiptCheckedAt: null,
    },
    take: 300,
    orderBy: { sentAt: "asc" },
    select: { id: true, expoTicketId: true, pushTokenId: true },
  });

  if (sentDeliveries.length === 0) return;

  const ticketIds = sentDeliveries.map((d) => d.expoTicketId!);

  let receipts: Awaited<
    ReturnType<typeof expo.getPushNotificationReceiptsAsync>
  >;
  try {
    receipts = await expo.getPushNotificationReceiptsAsync(ticketIds);
  } catch (err) {
    logger.error("[PUSH] getPushNotificationReceiptsAsync failed:", err);
    return;
  }

  const tokensToDisable: string[] = [];

  const updates = sentDeliveries.map(async (delivery) => {
    const receipt = receipts[delivery.expoTicketId!];
    if (!receipt) return;

    if (receipt.status === "ok") {
      await db.pushNotificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "DELIVERED",
          expoReceiptStatus: "ok",
          receiptCheckedAt: new Date(),
        },
      });
    } else {
      await db.pushNotificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          expoReceiptStatus: "error",
          errorCode: receipt.details?.error,
          errorMessage: receipt.message,
          receiptCheckedAt: new Date(),
        },
      });

      if (
        delivery.pushTokenId &&
        (receipt.details?.error === "DeviceNotRegistered" ||
          receipt.details?.error === "InvalidCredentials")
      ) {
        tokensToDisable.push(delivery.pushTokenId);
      }
    }
  });

  await Promise.allSettled(updates);

  if (tokensToDisable.length > 0) {
    await db.pushToken.updateMany({
      where: { id: { in: tokensToDisable } },
      data: {
        status: "DISABLED",
        disabledAt: new Date(),
        disableReason: "DeviceNotRegistered",
      },
    });
  }

  logger.info(`[PUSH] Processed ${sentDeliveries.length} receipts`);
}
