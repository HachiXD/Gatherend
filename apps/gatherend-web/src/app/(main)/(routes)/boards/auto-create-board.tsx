"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { generateBoardAvatarUrl } from "@/lib/avatar-utils";

interface AutoCreateBoardProps {
  profile: {
    id: string;
    userId: string;
    username: string | null;
    email: string | null;
  };
}

// Clave para sessionStorage
const IDEMPOTENCY_STORAGE_KEY = "auto-create-board-idempotency-key";

export function AutoCreateBoard({ profile }: AutoCreateBoardProps) {
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Evitar múltiples ejecuciones en React 18 Strict Mode
    if (hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;

    async function create() {
      try {
        // --- 1. Obtener o generar Idempotency Key persistente en sessionStorage ---
        let idempotencyKey = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
        if (!idempotencyKey) {
          idempotencyKey = uuidv4();
          sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, idempotencyKey);
        }

        // --- 2. Preparar imagen automática ---
        const firstLetter =
          (profile.username ?? profile.userId ?? "G")[0]?.toUpperCase() ?? "G";

        const autoImage =
          generateBoardAvatarUrl(profile.userId, firstLetter, 256) ?? "";

        // --- 3. Preparar nombre automático ---
        const displayName =
          profile.username || profile.email?.split("@")[0] || "User";

        const autoBoardName = `${displayName}'s Board`;

        // --- 4. Request idempotente al backend ---
        const res = await fetch("/api/boards/auto-create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            name: autoBoardName,
            ...(autoImage ? { imageUrl: autoImage } : {}),
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

        // --- 5. Limpiar idempotency key y redirigir al board discovery ---
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
