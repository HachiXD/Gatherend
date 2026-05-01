import type { EmojiType } from "rn-emoji-keyboard";
import { useMemo } from "react";
import { StyleSheet } from "react-native";

// @ts-ignore — EmojiStaticKeyboard is not in the public type exports
import { EmojiStaticKeyboard } from "rn-emoji-keyboard/lib/commonjs/components/EmojiStaticKeyboard";

// @ts-ignore — KeyboardProvider is not in the public type exports
import { KeyboardProvider } from "rn-emoji-keyboard/lib/commonjs/contexts/KeyboardProvider";
import { useTheme } from "@/src/theme/theme-provider";

type EmojiPanelProps = {
  onSelect: (emoji: string) => void;
};

export function EmojiPanel({ onSelect }: EmojiPanelProps) {
  const { colors } = useTheme();
  const emojiKeyboardTheme = useMemo(
    () => ({
      backdrop: "transparent",
      knob: colors.borderPrimary,
      container: colors.bgPrimary,
      header: colors.textPrimary,
      skinTonesContainer: colors.bgSecondary,
      category: {
        icon: colors.textMuted,
        iconActive: colors.accentPrimary,
        container: colors.bgSecondary,
        containerActive: colors.bgQuaternary,
      },
      search: {
        background: colors.bgSecondary,
        text: colors.textPrimary,
        placeholder: colors.textTertiary,
        icon: colors.textMuted,
      },
      customButton: {
        icon: colors.textMuted,
        iconPressed: colors.accentPrimary,
        background: colors.bgSecondary,
        backgroundPressed: colors.bgQuaternary,
      },
      emoji: {
        selected: colors.bgQuaternary,
      },
    }),
    [colors],
  );
  const emojiKeyboardStyles = useMemo(
    () => ({
      container: styles.keyboardContainer,
      category: {
        container: {
          borderColor: colors.borderPrimary,
        },
      },
      searchBar: {
        container: {
          borderColor: colors.borderPrimary,
        },
      },
      emoji: {
        selected: styles.selectedEmoji,
      },
    }),
    [colors.borderPrimary],
  );

  function handleSelect(emoji: EmojiType) {
    onSelect(emoji.emoji);
  }

  return (
    <KeyboardProvider
      onEmojiSelected={handleSelect}
      styles={emojiKeyboardStyles}
      theme={emojiKeyboardTheme}
    >
      <EmojiStaticKeyboard />
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  selectedEmoji: {
    borderRadius: 10,
  },
});
