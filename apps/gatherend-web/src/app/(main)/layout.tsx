import { currentProfile } from "@/lib/current-profile";
import { redirect } from "next/navigation";
import { SessionGuard } from "@/components/auth/session-guard";
import { getServerSession } from "@/lib/auth/server-session";
import { AuthenticatedAppProviders } from "@/components/providers/authenticated-app-providers";

/**
 * Main layout auth gate (server-side).
 *
 * Responsibilities:
 * 1. Validate session with server session check.
 * 2. Fallback to SessionGuard for client-side session refresh.
 * 3. Enforce banned-user redirect.
 */
const MainLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getServerSession();

  if (!session) {
    return <SessionGuard>{children}</SessionGuard>;
  }

  const profile = await currentProfile();

  if (!profile) {
    return redirect("/sign-in");
  }

  if (profile.banned) {
    const params = new URLSearchParams();
    if (profile.banReason) {
      params.set("reason", profile.banReason);
    }
    if (profile.bannedAt) {
      params.set("bannedAt", profile.bannedAt.toISOString());
    }
    return redirect(`/banned?${params.toString()}`);
  }

  return (
    <AuthenticatedAppProviders>
      <div className="h-full">{children}</div>
    </AuthenticatedAppProviders>
  );
};

export default MainLayout;
