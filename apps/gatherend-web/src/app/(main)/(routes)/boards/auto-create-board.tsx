"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

interface AutoCreateBoardProps {
  profile: {
    id: string;
    userId: string;
    username: string | null;
    email: string | null;
  };
}

const IDEMPOTENCY_STORAGE_KEY = "auto-create-board-idempotency-key";

export function AutoCreateBoard({ profile }: AutoCreateBoardProps) {
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;

    async function create() {
      try {
        let idempotencyKey = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
        if (!idempotencyKey) {
          idempotencyKey = uuidv4();
          sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, idempotencyKey);
        }

        const displayName =
          profile.username || profile.email?.split("@")[0] || "User";
        const autoBoardName = `${displayName}'s Board`;

        const res = await fetch("/api/boards/auto-create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            name: autoBoardName,
          }),
        });

        if (!res.ok) {
          console.error(
            "[AutoCreateBoard] Error creando board:",
            await res.text(),
          );
          return;
        }

        const board = await res.json();
        sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
        router.replace(`/boards/${board.id}/discovery`);
      } catch (error) {
        console.error("[AutoCreateBoard] Internal error:", error);
      }
    }

    create();
  }, [profile, router]);

  return (
    <div className="flex flex-col items-center pt-32">
      <p className="text-white/80">Creating your special board! :D...</p>
    </div>
  );
}
