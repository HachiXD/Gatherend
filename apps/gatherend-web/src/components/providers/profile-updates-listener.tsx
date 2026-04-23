"use client";

import { useProfileUpdatesSocket } from "@/hooks/use-profile-updates-socket";

export function ProfileUpdatesListener() {
  useProfileUpdatesSocket();
  return null;
}
