import { Router } from "express";
import { Expo } from "expo-server-sdk";
import { PushTokenPlatform } from "@prisma/client";
import { upsertPushToken, disablePushToken } from "./push-notifications.service.js";
import { logger } from "../../lib/logger.js";

const router = Router();

const VALID_PLATFORMS: PushTokenPlatform[] = ["IOS", "ANDROID"];

// POST /push-tokens — Register or refresh a device push token
router.post("/", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    if (!profileId) return res.status(401).json({ error: "Unauthorized" });

    const { token, platform, projectId, appId, deviceId, deviceName } = req.body;

    if (!token || typeof token !== "string")
      return res.status(400).json({ error: "token is required" });

    if (!platform || !VALID_PLATFORMS.includes(platform))
      return res.status(400).json({ error: "platform must be IOS or ANDROID" });

    if (!Expo.isExpoPushToken(token))
      return res.status(400).json({ error: "Invalid Expo push token format" });

    const pushToken = await upsertPushToken({
      profileId,
      token,
      platform: platform as PushTokenPlatform,
      projectId: typeof projectId === "string" ? projectId : undefined,
      appId: typeof appId === "string" ? appId : undefined,
      deviceId: typeof deviceId === "string" ? deviceId : undefined,
      deviceName: typeof deviceName === "string" ? deviceName : undefined,
    });

    return res.json({ id: pushToken.id, token: pushToken.token, status: pushToken.status });
  } catch (err) {
    logger.error("[PUSH_TOKEN_POST]", err);
    return res.status(500).json({ error: "Internal Error" });
  }
});

// DELETE /push-tokens — Deactivate a token on logout
router.delete("/", async (req, res) => {
  try {
    const profileId = req.profile?.id;
    if (!profileId) return res.status(401).json({ error: "Unauthorized" });

    const { token } = req.body;
    if (!token || typeof token !== "string")
      return res.status(400).json({ error: "token is required" });

    await disablePushToken(token, profileId);
    return res.json({ success: true });
  } catch (err) {
    logger.error("[PUSH_TOKEN_DELETE]", err);
    return res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
