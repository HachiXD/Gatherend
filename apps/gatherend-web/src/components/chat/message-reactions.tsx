"use client";

import { useState, useRef, useEffect, memo } from "react";
import { useAddReaction, useRemoveReaction } from "@/hooks/use-reactions";
import { cn } from "@/lib/utils";
import { Smile } from "lucide-react";
import { ActionTooltip } from "../action-tooltip";
import { logger } from "@/lib/logger";

interface Reaction {
  id: string;
  emoji: string;
  profileId: string;
  profile: {
    id: string;
    username: string;
  };
}

interface MessageReactionsProps {
  reactions: Reaction[];
  messageId?: string;
  directMessageId?: string;
  currentProfileId: string;
  channelId?: string;
  conversationId?: string;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "💀", "😭", "🤑"];

// Component to show existing reactions only
export const MessageReactionsDisplay = memo(
  function MessageReactionsDisplay({
    reactions,
    messageId,
    directMessageId,
    currentProfileId,
    channelId,
    conversationId,
  }: MessageReactionsProps) {
    const { mutate: addReaction } = useAddReaction();
    const { mutate: removeReaction } = useRemoveReaction();

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction);
      return acc;
    }, {} as Record<string, Reaction[]>);

    const handleEmojiClick = (emoji: string) => {
      // Check if user already reacted with this emoji
      const existingReaction = reactions.find(
        (r) => r.emoji === emoji && r.profileId === currentProfileId
      );

      if (existingReaction) {
        // Remove reaction
        removeReaction({
          reactionId: existingReaction.id,
          profileId: currentProfileId,
          channelId,
          conversationId,
        });
      } else {
        // Add reaction
        addReaction({
          emoji,
          messageId,
          directMessageId,
          profileId: currentProfileId,
          channelId,
          conversationId,
        });
      }
    };

    if (Object.keys(groupedReactions).length === 0) {
      return null;
    }

    return (
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        {/* Existing reactions */}
        {Object.entries(groupedReactions).map(([emoji, reactionList]) => {
          const userReacted = reactionList.some(
            (r) => r.profileId === currentProfileId
          );
          const count = reactionList.length;

          return (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                "border transition-colors cursor-pointer",
                userReacted
                  ? "bg-theme-reaction-active-bg border-theme-reaction-active-border text-theme-reaction-active-text"
                  : "bg-theme-reaction-bg border-theme-reaction-border text-theme-reaction-text"
              )}
              title={reactionList.map((r) => r.profile.username).join(", ")}
            >
              <span>{emoji}</span>
              <span className="font-medium">{count}</span>
            </button>
          );
        })}
      </div>
    );
  },
  (prev, next) => {
    // Custom comparator - only re-render when reactions actually change
    return (
      prev.reactions.length === next.reactions.length &&
      prev.currentProfileId === next.currentProfileId &&
      prev.reactions.every(
        (r, i) =>
          r.id === next.reactions[i]?.id && r.emoji === next.reactions[i]?.emoji
      )
    );
  }
);

// Component for the add reaction button (toolbar)
export const AddReactionButton = ({
  reactions,
  messageId,
  directMessageId,
  currentProfileId,
  channelId,
  conversationId,
}: MessageReactionsProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);
  const { mutate: addReaction } = useAddReaction();
  const { mutate: removeReaction } = useRemoveReaction();

  // Close picker on click outside
  useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setShowPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPicker]);

  // Close picker on Escape key
  useEffect(() => {
    if (!showPicker) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowPicker(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPicker]);

  const handleEmojiClick = (emoji: string) => {
    // Check if user already reacted with this emoji
    const existingReaction = reactions.find(
      (r) => r.emoji === emoji && r.profileId === currentProfileId
    );

    if (existingReaction) {
      // Remove reaction
      removeReaction({
        reactionId: existingReaction.id,
        profileId: currentProfileId,
        channelId,
        conversationId,
      });
    } else {
      // Add reaction
      addReaction({
        emoji,
        messageId,
        directMessageId,
        profileId: currentProfileId,
        channelId,
        conversationId,
      });
    }
    setShowPicker(false);
  };

  const handleOpenPicker = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPickerPosition({
      top: rect.top - 48, // Position above the button (picker height ~40px + 8px gap)
      left: rect.right - 220, // Align to the right, picker is ~220px wide
    });
    setShowPicker(!showPicker);
  };

  return (
    <div className="relative" ref={pickerRef}>
      <ActionTooltip label="Add Reaction">
        <Smile
          onClick={handleOpenPicker}
          className="cursor-pointer w-5 h-5 text-theme-text-subtle hover:text-theme-text-light transition"
        />
      </ActionTooltip>

      {/* Emoji picker */}
      {showPicker && (
        <div
          className="fixed z-50 flex gap-1 p-2 bg-theme-bg-secondary border border-theme-border-secondary rounded-full shadow-lg"
          style={{
            top: pickerPosition.top,
            left: pickerPosition.left,
          }}
        >
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className="text-2xl hover:scale-125 cursor-pointer transition-transform"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Legacy export for backwards compatibility
export const MessageReactions = MessageReactionsDisplay;
