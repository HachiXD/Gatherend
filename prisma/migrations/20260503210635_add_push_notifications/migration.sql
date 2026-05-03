-- CreateEnum
CREATE TYPE "PushProvider" AS ENUM ('EXPO');

-- CreateEnum
CREATE TYPE "PushTokenPlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "PushTokenStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "PushNotificationType" AS ENUM ('MENTION', 'DIRECT_MESSAGE', 'CHANNEL_MESSAGE', 'FRIEND_REQUEST', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PushNotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "provider" "PushProvider" NOT NULL DEFAULT 'EXPO',
    "platform" "PushTokenPlatform" NOT NULL,
    "status" "PushTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "projectId" TEXT,
    "appId" TEXT,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    "disableReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushNotificationDelivery" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "pushTokenId" TEXT,
    "notificationType" "PushNotificationType" NOT NULL,
    "status" "PushNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "body" TEXT,
    "data" JSONB,
    "expoTicketId" TEXT,
    "expoTicketStatus" TEXT,
    "expoReceiptStatus" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "receiptCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_profileId_status_idx" ON "PushToken"("profileId", "status");

-- CreateIndex
CREATE INDEX "PushToken_platform_idx" ON "PushToken"("platform");

-- CreateIndex
CREATE INDEX "PushToken_lastSeenAt_idx" ON "PushToken"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushNotificationDelivery_expoTicketId_key" ON "PushNotificationDelivery"("expoTicketId");

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_profileId_createdAt_idx" ON "PushNotificationDelivery"("profileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_pushTokenId_createdAt_idx" ON "PushNotificationDelivery"("pushTokenId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_status_createdAt_idx" ON "PushNotificationDelivery"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_expoTicketId_idx" ON "PushNotificationDelivery"("expoTicketId");

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_notificationType_createdAt_idx" ON "PushNotificationDelivery"("notificationType", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationDelivery" ADD CONSTRAINT "PushNotificationDelivery_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationDelivery" ADD CONSTRAINT "PushNotificationDelivery_pushTokenId_fkey" FOREIGN KEY ("pushTokenId") REFERENCES "PushToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
