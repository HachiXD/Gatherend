import type { Socket } from "socket.io-client";

type SocketBinding = {
  socket: Socket;
  onConnect: () => void;
  onVisibility: () => void;
};

const refCounts = new Map<string, number>();
let socketBinding: SocketBinding | null = null;

export function getTrackedProfileIds(): string[] {
  return [...refCounts.keys()];
}

function emitSubscriptions(socket: Socket, profileIds: string[]) {
  if (profileIds.length === 0 || !socket.connected) return;
  socket.emit("profile:subscribe", { profileIds });
}

export function ensureProfileWatchSocketBound(socket: Socket) {
  if (socketBinding?.socket === socket) return;

  if (socketBinding) {
    socketBinding.socket.off("connect", socketBinding.onConnect);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", socketBinding.onVisibility);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener(
        "visibilitychange",
        socketBinding.onVisibility,
      );
    }
    socketBinding = null;
  }

  const onConnect = () => {
    emitSubscriptions(socket, getTrackedProfileIds());
  };

  const onVisibility = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState !== "visible") return;
    if (!socket.connected) return;
    onConnect();
  };

  socket.on("connect", onConnect);
  if (typeof window !== "undefined") {
    window.addEventListener("focus", onVisibility);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  socketBinding = { socket, onConnect, onVisibility };

  if (socket.connected) {
    onConnect();
  }
}

export function subscribeToProfileWatches(socket: Socket, profileIds: string[]) {
  const added: string[] = [];

  for (const id of profileIds) {
    const prev = refCounts.get(id) ?? 0;
    const next = prev + 1;
    refCounts.set(id, next);
    if (prev === 0) {
      added.push(id);
    }
  }

  emitSubscriptions(socket, added);
}

export function unsubscribeFromProfileWatches(
  socket: Socket,
  profileIds: string[],
) {
  const removed: string[] = [];

  for (const id of profileIds) {
    const prev = refCounts.get(id) ?? 0;
    if (prev <= 1) {
      refCounts.delete(id);
      removed.push(id);
      continue;
    }
    refCounts.set(id, prev - 1);
  }

  if (removed.length === 0 || !socket.connected) return;
  socket.emit("profile:unsubscribe", { profileIds: removed });
}
