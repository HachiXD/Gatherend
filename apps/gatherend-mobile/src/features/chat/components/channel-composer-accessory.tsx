import { memo, useCallback, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  ChatInput,
  type ChatInputHandle,
} from "@/src/features/chat/components/chat-input";
import { EmojiPanel } from "@/src/features/chat/components/emoji-panel";
import { StickerPanel } from "@/src/features/chat/components/sticker-panel";
import { useChatAccessoryPanel } from "@/src/features/chat/hooks/use-chat-accessory-panel";
import type { ChatMessage } from "@/src/features/chat/lib/chat-message";
import { useTheme } from "@/src/theme/theme-provider";

export const ChannelComposerAccessory = memo(function ChannelComposerAccessory({
  boardId,
  channelId,
  profileId,
  windowKey,
  replyTo,
  onClearReply,
}: {
  boardId: string;
  channelId: string;
  profileId: string;
  windowKey: string;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const {
    activePanel,
    closePanel,
    isComposerCompact,
    onInputFocus,
    openPanel,
    panelAnimatedStyle,
  } = useChatAccessoryPanel();

  const handleEmojiPickerPress = useCallback(() => {
    if (activePanel === "emoji") {
      closePanel();
    } else {
      openPanel("emoji");
    }
  }, [activePanel, closePanel, openPanel]);

  const handleStickerPickerPress = useCallback(() => {
    if (activePanel === "sticker") {
      closePanel();
    } else {
      openPanel("sticker");
    }
  }, [activePanel, closePanel, openPanel]);

  return (
    <>
      <View
        pointerEvents="none"
        style={styles.composerTopSpacer}
      />
      <ChatInput
        ref={chatInputRef}
        bottomInset={0}
        context={{ type: "channel", boardId, channelId }}
        isComposerCompact={isComposerCompact}
        windowKey={windowKey}
        replyTo={replyTo}
        onClearReply={onClearReply}
        onEmojiPickerPress={handleEmojiPickerPress}
        onInputFocus={onInputFocus}
        onStickerPickerPress={handleStickerPickerPress}
      />

      <View style={[styles.pickerPanel, panelAnimatedStyle]}>
        {activePanel === "sticker" ? (
          <StickerPanel
            profileId={profileId}
            onSelect={(sticker) => {
              void chatInputRef.current?.sendSticker(sticker);
            }}
          />
        ) : null}
        {activePanel === "emoji" ? (
          <EmojiPanel
            onSelect={(emoji) => {
              chatInputRef.current?.appendEmoji(emoji);
            }}
          />
        ) : null}
      </View>
    </>
  );
});

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    composerTopSpacer: {
      height: 8,
    },
    pickerPanel: {
      backgroundColor: colors.bgPrimary,
      borderTopColor: colors.borderPrimary,
      borderTopWidth: 1,
    },
  });
}
