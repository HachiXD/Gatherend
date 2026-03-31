// app/(main)/(routes)/boards/page.tsx

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { redirect } from "next/navigation";
import { AutoCreateBoard } from "./auto-create-board";
import { BoardRedirect } from "./board-redirect";

export default async function BoardsHome() {
  logger.server("[BOARDS_PAGE] Starting...");
  const profile = await currentProfile();
  logger.server("[BOARDS_PAGE] Profile result:", !!profile, profile?.id);

  if (!profile) {
    logger.server("[BOARDS_PAGE] No profile, redirecting to sign-in");
    redirect("/sign-in");
  }

  // 1) Buscar el board propio del usuario (su comunidad personal)
  logger.server("[BOARDS_PAGE] Searching for existing board...");
  const board = await db.board.findFirst({
    where: { profileId: profile.id },
  });
  logger.server("[BOARDS_PAGE] Board found:", !!board, board?.id);

  if (board) {
    logger.server("[BOARDS_PAGE] Redirecting to board:", board.id);
    // Usar componente cliente para redirección que funciona con navegación del cliente
    return <BoardRedirect boardId={board.id} />;
  }

  // 2) Si no existe → mostrar componente cliente que lo creará
  logger.server("[BOARDS_PAGE] No board found, showing AutoCreateBoard");
  return <AutoCreateBoard profile={profile} />;
}
