import AsyncStorage from "@react-native-async-storage/async-storage";
import { authClient } from "@/src/lib/auth-client";
import { authBaseUrl } from "@/src/lib/env";
import type { CreatedBoard } from "../types/board";

const IDEMPOTENCY_STORAGE_KEY = "auto-create-board-idempotency-key";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function autoCreateBoard(name: string): Promise<CreatedBoard> {
  let idempotencyKey = await AsyncStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
  if (!idempotencyKey) {
    idempotencyKey = generateUUID();
    await AsyncStorage.setItem(IDEMPOTENCY_STORAGE_KEY, idempotencyKey);
  }

  const cookie = authClient.getCookie();
  const response = await fetch(`${authBaseUrl}/api/boards/auto-create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    credentials: "omit",
    body: JSON.stringify({ name }),
  });

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
    if (
      typeof errorPayload?.error === "string" &&
      errorPayload.error.length > 0
    ) {
      throw new Error(errorPayload.error);
    }
    throw new Error("No se pudo crear el board");
  }

  const board = (await response.json()) as CreatedBoard;
  await AsyncStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
  return board;
}
