import {
  createContext,
  useContext,
  type ReactNode,
  type Context,
} from "react";
import { signOut, useSession } from "@/src/lib/auth-client";

type SessionData = ReturnType<typeof useSession>["data"];

type AuthContextValue = {
  session: SessionData;
  isPending: boolean;
  isAuthenticated: boolean;
  signOut: typeof signOut;
};

const AuthContext: Context<AuthContextValue | null> =
  createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const sessionState = useSession();

  const value: AuthContextValue = {
    session: sessionState.data,
    isPending: sessionState.isPending,
    isAuthenticated: Boolean(sessionState.data?.user?.id),
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider.");
  }

  return context;
}
