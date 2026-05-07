import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

const MIN_INPUT_HEIGHT = 42;

type PostCommentFakeInputProps = {
  onPress: () => void;
  onImagePress: () => void;
};

export function PostCommentFakeInput({
  onPress,
  onImagePress,
}: PostCommentFakeInputProps) {
  const profile = useProfile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <UserAvatar
        avatarUrl={profile.avatarAsset?.url}
        username={profile.username}
        size={32}
      />

      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: colors.bgQuaternary,
            borderColor: colors.borderPrimary,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            onPress();
          }}
          style={({ pressed }) => [
            styles.inputPressArea,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text
            style={[styles.placeholder, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            Comentar...
          </Text>
        </Pressable>

        <View style={styles.inputActions}>
          <Pressable
            onPress={() => {
              onImagePress();
            }}
            style={({ pressed }) => [
              styles.inputActionButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.textMuted} name="image-outline" size={20} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    inputShell: {
      alignItems: "center",
      borderRadius: 11,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      minHeight: MIN_INPUT_HEIGHT,
      overflow: "hidden",
    },
    placeholder: {
      fontSize: 15,
      paddingHorizontal: 11,
    },
    inputPressArea: {
      alignSelf: "stretch",
      flex: 1,
      justifyContent: "center",
    },
    inputActions: {
      alignItems: "center",
      alignSelf: "center",
      flexDirection: "row",
      flexShrink: 0,
      gap: 2,
      paddingRight: 5,
    },
    inputActionButton: {
      alignItems: "center",
      borderRadius: 8,
      height: 30,
      justifyContent: "center",
      width: 30,
    },
    pressed: {
      opacity: 0.88,
    },
  });
}
