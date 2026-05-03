import {
  createContext,
  useContext,
  type ReactNode,
  type Context,
} from "react";
import {
  signOut,
  useSession as useBetterAuthSession,
} from "@/src/lib/auth-client";

type SessionState = ReturnType<typeof useBetterAuthSession>;
type SessionData = SessionState["data"];

type AuthContextValue = {
  session: SessionData;
  isPending: boolean;
  isAuthenticated: boolean;
  sessionError: SessionState["error"];
  refetchSession: SessionState["refetch"];
  signOut: typeof signOut;
};

const AuthContext: Context<AuthContextValue | null> =
  createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const sessionState = useBetterAuthSession();
  const isAuthenticated = Boolean(sessionState.data?.user?.id);

  const value: AuthContextValue = {
    session: sessionState.data,
    isPending: sessionState.isPending,
    isAuthenticated,
    sessionError: sessionState.error,
    refetchSession: sessionState.refetch,
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
