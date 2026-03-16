import { headers } from "next/headers";
import { auth as betterAuth } from "@/lib/better-auth";

export interface ServerSession {
  userId: string;
  name: string | null;
  email: string | null;
}

export async function getServerSession(): Promise<ServerSession | null> {
  try {
    const requestHeaders = await headers();
    const session = await betterAuth.api.getSession({
      headers: new Headers(requestHeaders),
    });

    if (!session?.user?.id) {
      return null;
    }

    return {
      userId: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
    };
  } catch {
    return null;
  }
}
