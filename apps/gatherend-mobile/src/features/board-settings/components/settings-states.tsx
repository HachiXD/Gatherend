import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

type CenterStateProps = {
  title?: string;
  message: string;
  loading?: boolean;
  actionLabel?: string;
  actionLoadingLabel?: string;
  actionLoading?: boolean;
  onAction?: () => void;
};

export function BoardSettingsCenterState({
  title,
  message,
  loading = false,
  actionLabel,
  actionLoadingLabel,
  actionLoading = false,
  onAction,
}: CenterStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.centerState}>
      {loading ? <ActivityIndicator color={colors.accentPrimary} size="small" /> : null}
      {title ? (
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      ) : null}
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.bgTertiary,
              borderColor: colors.borderSecondary,
            },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
            {actionLoading ? actionLoadingLabel ?? actionLabel : actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 18,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.88,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
});
