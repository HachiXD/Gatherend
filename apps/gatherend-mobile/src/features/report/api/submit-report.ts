import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";

export type ReportTargetType =
  | "CHANNEL_MESSAGE"
  | "DIRECT_MESSAGE"
  | "PROFILE"
  | "BOARD"
  | "COMMUNITY_POST"
  | "COMMUNITY_POST_COMMENT";

export type SubmitReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  category: string;
  description?: string | null;
  snapshot?: Record<string, unknown>;
  targetOwnerId?: string;
  channelId?: string;
  conversationId?: string;
};

export async function submitReport(input: SubmitReportInput): Promise<void> {
  const response = await nextApiFetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      await readNextApiError(response, "Error al enviar el reporte"),
    );
  }
}
