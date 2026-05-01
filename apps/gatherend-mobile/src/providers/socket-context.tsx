import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";

export type SocketClientContextType = {
  socket: Socket | null;
  goOffline: () => void;
};

export const SocketClientContext = createContext<SocketClientContextType>({
  socket: null,
  goOffline: () => {},
});

export const SocketConnectionContext = createContext(false);
export const SocketRecoveryContext = createContext(0);

export function useSocketClient() {
  return useContext(SocketClientContext);
}

export function useSocketConnection() {
  return useContext(SocketConnectionContext);
}

export function useSocketRecoveryVersion() {
  return useContext(SocketRecoveryContext);
}

export function useSocket() {
  const { socket, goOffline } = useSocketClient();
  const isConnected = useSocketConnection();
  const recoveryVersion = useSocketRecoveryVersion();

  return {
    socket,
    isConnected,
    recoveryVersion,
    goOffline,
  };
}
