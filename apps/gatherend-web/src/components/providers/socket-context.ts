"use client";

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

export const SocketConnectionContext = createContext<boolean>(false);
export const SocketRecoveryContext = createContext<number>(0);

export const useSocketClient = () => {
  return useContext(SocketClientContext);
};

export const useSocketConnection = () => {
  return useContext(SocketConnectionContext);
};

export const useSocketRecoveryVersion = () => {
  return useContext(SocketRecoveryContext);
};

export const useSocket = () => {
  const { socket, goOffline } = useSocketClient();
  const isConnected = useSocketConnection();
  return { socket, isConnected, goOffline };
};
