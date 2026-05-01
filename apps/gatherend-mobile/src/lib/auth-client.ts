import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { authBaseUrl, mobileScheme } from "@/src/lib/env";

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [
    expoClient({
      scheme: mobileScheme,
      storage: SecureStore,
      storagePrefix: mobileScheme,
    }),
  ],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
