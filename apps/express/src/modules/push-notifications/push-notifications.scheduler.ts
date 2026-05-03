import { processPendingReceipts } from "./push-notifications.service.js";
import { logger } from "../../lib/logger.js";

const RECEIPT_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes per Expo docs

export function startReceiptScheduler(): void {
  setInterval(async () => {
    try {
      await processPendingReceipts();
    } catch (err) {
      logger.error("[PUSH_SCHEDULER] Receipt check failed:", err);
    }
  }, RECEIPT_CHECK_INTERVAL_MS);

  logger.info("[PUSH] Receipt scheduler started (15 min interval)");
}
