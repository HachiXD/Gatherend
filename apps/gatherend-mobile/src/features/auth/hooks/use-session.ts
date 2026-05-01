import { useAuthContext } from "@/src/providers/auth-provider";

export function useSession() {
  return useAuthContext();
}
