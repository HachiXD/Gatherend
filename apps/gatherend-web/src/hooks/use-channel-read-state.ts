import { useEffect, useCallback, useRef, useMemo } from "react";
import { useUnreadStore } from "./use-unread-store";
import { useMentionStore } from "./use-mention-store";
import {
  useTokenGetter,
  useTokenReady,
} from "@/components/providers/token-manager-provider";
import { useSocketRecoveryVersion } from "@/components/providers/socket-provider";
import { getExpressAuthHeaders } from "@/lib/express-fetch";

/**
 * Hook para cargar el estado de lectura inicial de todos los boards del usuario
 * y marcar canales/conversaciones como leídos cuando el usuario los visita.
 *
 * También carga el estado de unreads de conversaciones (DMs) desde el servidor.
 */
export function useChannelReadState(
  profileId: string | undefined,
  boardIds: string[],
) {
  const {
    initializeFromServer,
    replaceFromServer,
    clearUnread,
    setViewingRoom,
    setLastAck,
  } =
    useUnreadStore();
  const {
    initializeFromServer: initializeMentions,
    replaceFromServer: replaceMentionsFromServer,
    clearMention,
  } =
    useMentionStore();
  const getToken = useTokenGetter();
  const tokenReady = useTokenReady();
  const reconnectVersion = useSocketRecoveryVersion();
  const loadedRef = useRef<Set<string>>(new Set());
  const conversationsLoadedRef = useRef(false);
  const channelUnreadSnapshotRef = useRef<Record<string, number>>({});
  const conversationUnreadSnapshotRef = useRef<Record<string, number>>({});
  const mentionsSnapshotRef = useRef<string[]>([]);

  // Estabilizar boardIds para evitar renders infinitos
  const stableBoardIds = useMemo(() => boardIds.join(","), [boardIds]);

  // Cargar estado inicial de todos los boards
  useEffect(() => {
    if (!profileId || !stableBoardIds || !tokenReady) return;

    const boardIdArray = stableBoardIds.split(",").filter(Boolean);
    const shouldReload = reconnectVersion > 0;

    const loadAllBoardStates = async () => {
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

      // Cargar solo los boards que no hemos cargado aún
      const boardsToLoad = shouldReload
        ? boardIdArray
        : boardIdArray.filter((id) => !loadedRef.current.has(id));

      if (boardsToLoad.length === 0) return;

      // Get fresh token for auth
      const token = await getToken();

      // Procesar en lotes pequeños para evitar rate limiting
      const BATCH_SIZE = 3;
      const allCounts: Record<string, number> = {};
      const allMentions: string[] = [];

      for (let i = 0; i < boardsToLoad.length; i += BATCH_SIZE) {
        const batch = boardsToLoad.slice(i, i + BATCH_SIZE);

        // Cargar estado de lectura y menciones para este lote en paralelo
        const batchResults = await Promise.all(
          batch.map(async (boardId) => {
            try {
              const authHeaders = getExpressAuthHeaders(profileId, token);
              // Hacer ambas requests para este board
              const [stateRes, mentionsRes] = await Promise.all([
                fetch(`${socketUrl}/channel-read-state/board/${boardId}`, {
                  credentials: "include",
                  headers: authHeaders,
                }),
                fetch(
                  `${socketUrl}/channel-read-state/board/${boardId}/mentions`,
                  {
                    credentials: "include",
                    headers: authHeaders,
                  },
                ),
              ]);

              const counts = stateRes.ok ? await stateRes.json() : {};
              const mentions = mentionsRes.ok ? await mentionsRes.json() : [];

              loadedRef.current.add(boardId);
              return { counts, mentions };
            } catch (error) {
              console.error(
                `[channel-read-state] Error loading board ${boardId}:`,
                error,
              );
              return { counts: {}, mentions: [] };
            }
          }),
        );

        // Acumular resultados
        batchResults.forEach(({ counts, mentions }) => {
          Object.assign(allCounts, counts);
          allMentions.push(...mentions);
        });

        // Actualizar stores incrementalmente para que la UI se actualice más rápido
        if (shouldReload) {
          channelUnreadSnapshotRef.current = allCounts;
          mentionsSnapshotRef.current = allMentions;
          replaceFromServer({
            ...allCounts,
            ...conversationUnreadSnapshotRef.current,
          });
          replaceMentionsFromServer(allMentions);
        } else {
          channelUnreadSnapshotRef.current = {
            ...channelUnreadSnapshotRef.current,
            ...allCounts,
          };
          mentionsSnapshotRef.current = [
            ...new Set([...mentionsSnapshotRef.current, ...allMentions]),
          ];
          if (Object.keys(allCounts).length > 0) {
            initializeFromServer(allCounts);
          }
          if (allMentions.length > 0) {
            initializeMentions(allMentions);
          }
        }

        // Pequeña pausa entre lotes para no saturar el rate limit
        if (i + BATCH_SIZE < boardsToLoad.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    };

    loadAllBoardStates();
  }, [
    profileId,
    stableBoardIds,
    tokenReady,
    reconnectVersion,
    getToken,
    initializeFromServer,
    initializeMentions,
    replaceFromServer,
    replaceMentionsFromServer,
  ]);

  // Cargar unreads de conversaciones (DMs) solo una vez
  useEffect(() => {
    if (!profileId || !tokenReady) return;
    if (reconnectVersion === 0 && conversationsLoadedRef.current) return;

    const loadConversationUnreads = async () => {
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

      try {
        // Get fresh token for auth
        const token = await getToken();
        const authHeaders = getExpressAuthHeaders(profileId, token);

        const res = await fetch(
          `${socketUrl}/conversation-read-state/unreads`,
          {
            credentials: "include",
            headers: authHeaders,
          },
        );

        if (res.ok) {
          const unreadCounts = await res.json();
          if (reconnectVersion > 0) {
            conversationUnreadSnapshotRef.current = unreadCounts;
            replaceFromServer({
              ...channelUnreadSnapshotRef.current,
              ...unreadCounts,
            });
          } else if (Object.keys(unreadCounts).length > 0) {
            conversationUnreadSnapshotRef.current = {
              ...conversationUnreadSnapshotRef.current,
              ...unreadCounts,
            };
            initializeFromServer(unreadCounts);
          }
          conversationsLoadedRef.current = true;
        }
      } catch (error) {
        console.error(
          "[channel-read-state] Error loading conversation unreads:",
          error,
        );
      }
    };

    loadConversationUnreads();
  }, [profileId, tokenReady, reconnectVersion, getToken, initializeFromServer, replaceFromServer]);

  // Función para marcar un canal como leído
  const markAsRead = useCallback(
    async (roomId: string, isConversation = false) => {
      if (!profileId) return;

      // Establecer que estamos viendo este room (previene race conditions)
      setViewingRoom(roomId);

      // Limpiar inmediatamente en el store local
      clearUnread(roomId);
      clearMention(roomId);

      // Actualizar lastAck
      setLastAck(roomId);

      try {
        const socketUrl =
          process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

        // Get fresh token for auth
        const token = await getToken();
        const authHeaders = getExpressAuthHeaders(profileId, token);

        // Usar el endpoint correcto según el tipo
        const endpoint = isConversation
          ? `${socketUrl}/conversation-read-state/${roomId}/read`
          : `${socketUrl}/channel-read-state/${roomId}/read`;

        await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: authHeaders,
        });
      } catch (error) {
        console.error("[channel-read-state] Error marking as read:", error);
      }
    },
    [
      profileId,
      getToken,
      clearUnread,
      clearMention,
      setViewingRoom,
      setLastAck,
    ],
  );

  // Función para limpiar viewingRoom cuando el usuario sale
  const clearViewingRoom = useCallback(() => {
    setViewingRoom(null);
  }, [setViewingRoom]);

  return { markAsRead, clearViewingRoom };
}
