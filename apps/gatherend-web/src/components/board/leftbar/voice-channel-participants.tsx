"use client";

import { memo } from "react";
import { UserAvatar } from "@/components/user-avatar";
import {
  useVoiceParticipantsStore,
  type VoiceParticipant,
} from "@/hooks/use-voice-participants-store";
import { cn } from "@/lib/utils";

interface VoiceChannelParticipantsProps {
  channelId: string;
  className?: string;
}

// Max 49 participants displayed (10 columns x 5 rows)
const MAX_DISPLAYED = 49;

// Stable empty array reference
const EMPTY_ARRAY: VoiceParticipant[] = [];

const VoiceChannelParticipantsComponent = ({
  channelId,
  className,
}: VoiceChannelParticipantsProps) => {
  // Get the participants object for this channel (can be undefined)
  const channelParticipants = useVoiceParticipantsStore(
    (state) => state.participants[channelId]
  );

  // Use stable empty array when undefined
  const participants = channelParticipants ?? EMPTY_ARRAY;

  if (participants.length === 0) {
    return null;
  }

  const displayedParticipants = participants.slice(0, MAX_DISPLAYED);
  const hiddenCount = participants.length - MAX_DISPLAYED;

  return (
    <div className={cn("flex flex-col pl-7 py-1 gap-1", className)}>
      {/* "X connected" text */}
      <span className="text-xs text-theme-text-tertiary">
        {participants.length} connected
      </span>

      {/* Grid of avatars - 10 columns, flexible rows up to 5 */}
      <div className="grid grid-cols-10 gap-0.5 max-w-fit">
        {displayedParticipants.map((participant: VoiceParticipant) => (
          <UserAvatar
            key={participant.profileId}
            src={participant.avatarUrl || undefined}
            profileId={participant.profileId}
            usernameColor={participant.usernameColor}
            className="h-5 w-5"
            showStatus={false}
            animationMode="never"
          />
        ))}
      </div>

      {/* Show hidden count if more than 50 */}
      {hiddenCount > 0 && (
        <span className="text-xs text-theme-text-quaternary">
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
};

export const VoiceChannelParticipants = memo(VoiceChannelParticipantsComponent);
