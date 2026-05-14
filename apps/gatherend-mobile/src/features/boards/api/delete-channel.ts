import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";

export type DeleteChannelInput = {
  boardId: string;
  channelId: string;
};

export async function deleteChannel(input: DeleteChannelInput): Promise<void> {
  const cookie = authClient.getCookie();
  const response = await fetch(
    `${authBaseUrl}/api/boards/${input.boardId}/channels/${input.channelId}`,
    {
      method: "DELETE",
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
      },
      credentials: "omit",
    },
  );

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ error: "Unknown error", message: undefined }));

    if (
      typeof errorPayload?.message === "string" &&
      errorPayload.message.length > 0
    ) {
      throw new Error(errorPayload.message);
    }
    throw new Error("Error al eliminar el canal");
  }
}
