import { Ionicons } from "@expo/vector-icons";
import {
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type TextInput as NativeTextInput,
} from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useTheme } from "@/src/theme/theme-provider";
import { TextInput } from "@/src/components/app-typography";

type PostInlineCommentInputProps = {
  postId: string;
  isSubmitting: boolean;
  onSubmit: (postId: string, content: string) => void;
};

export function PostInlineCommentInput({
  postId,
  isSubmitting,
  onSubmit,
}: PostInlineCommentInputProps) {
  const profile = useProfile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [content, setContent] = useState("");
  const inputRef = useRef<NativeTextInput>(null);
  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(postId, trimmed);
    setContent("");
    inputRef.current?.blur();
  };

  return (
    <View style={styles.container}>
      <UserAvatar
        avatarUrl={profile.avatarAsset?.url}
        username={profile.username}
        size={28}
      />
      <View
        style={[
          styles.inputRow,
          { borderColor: colors.borderPrimary, backgroundColor: colors.bgInput },
        ]}
      >
        <TextInput
          ref={inputRef}
          value={content}
          onChangeText={setContent}
          placeholder="Comentar..."
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.textPrimary }]}
          editable={!isSubmitting}
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
          blurOnSubmit
        />
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: canSubmit ? colors.tabButtonBg : "transparent" },
            pressed && styles.pressed,
          ]}
          hitSlop={8}
        >
          <Ionicons
            name="send"
            size={14}
            color={canSubmit ? colors.textInverse : colors.textTertiary}
          />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
    },
    inputRow: {
      alignItems: "center",
      borderRadius: 999,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    input: {
      flex: 1,
      fontSize: 13,
      paddingVertical: 0,
    },
    sendButton: {
      alignItems: "center",
      borderRadius: 999,
      height: 24,
      justifyContent: "center",
      marginLeft: 6,
      width: 24,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
