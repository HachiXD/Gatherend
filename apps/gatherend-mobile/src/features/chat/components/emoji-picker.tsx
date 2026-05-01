import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import EmojiKeyboard, { type EmojiType } from "rn-emoji-keyboard";
import { useTheme } from "@/src/theme/theme-provider";

type EmojiPickerProps = {
  onChange: (emoji: string) => void;
  buttonStyle?: object;
  iconColor?: string;
};

export function EmojiPicker({ onChange, buttonStyle, iconColor }: EmojiPickerProps) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  function handleSelect(emoji: EmojiType) {
    onChange(emoji.emoji);
    setIsOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [buttonStyle, pressed ? styles.pressed : null]}
      >
        <Ionicons
          color={iconColor ?? colors.textMuted}
          name="happy-outline"
          size={20}
        />
      </Pressable>

      <EmojiKeyboard
        onClose={() => setIsOpen(false)}
        onEmojiSelected={handleSelect}
        open={isOpen}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.72,
  },
});
