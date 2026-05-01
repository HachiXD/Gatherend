import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import type { SocialProvider } from "@/src/features/auth/api/social-auth";
import { Text } from "@/src/components/app-typography";
import { BRAND_COLORS } from "@/src/theme/brand-colors";

type SocialAuthButtonsProps = {
  disabled?: boolean;
  loadingProvider: SocialProvider | null;
  onPress: (provider: SocialProvider) => void;
};

export function SocialAuthButtons({
  disabled = false,
  loadingProvider,
  onPress,
}: SocialAuthButtonsProps) {
  return (
    <View style={styles.section}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>o continua con</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.row}>
        <Pressable
          disabled={disabled}
          onPress={() => onPress("google")}
          style={({ pressed }) => [
            styles.button,
            pressed && !disabled ? styles.buttonPressed : null,
            disabled ? styles.buttonDisabled : null,
          ]}
        >
          {loadingProvider === "google" ? (
            <ActivityIndicator color={BRAND_COLORS.text} size="small" />
          ) : (
            <Text style={styles.buttonText}>Google</Text>
          )}
        </Pressable>

        <Pressable
          disabled={disabled}
          onPress={() => onPress("discord")}
          style={({ pressed }) => [
            styles.button,
            pressed && !disabled ? styles.buttonPressed : null,
            disabled ? styles.buttonDisabled : null,
          ]}
        >
          {loadingProvider === "discord" ? (
            <ActivityIndicator color={BRAND_COLORS.text} size="small" />
          ) : (
            <Text style={styles.buttonText}>Discord</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  divider: {
    backgroundColor: BRAND_COLORS.border,
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: BRAND_COLORS.textSubtle,
    fontSize: 13,
    textTransform: "lowercase",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    alignItems: "center",
    backgroundColor: BRAND_COLORS.surface,
    borderColor: BRAND_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: BRAND_COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
});
