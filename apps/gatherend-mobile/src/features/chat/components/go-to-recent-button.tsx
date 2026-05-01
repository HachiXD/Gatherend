import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

type GoToRecentButtonProps = {
  onPress: () => void;
};

export function GoToRecentButton({ onPress }: GoToRecentButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.buttonPrimary },
        pressed ? styles.pressed : null,
      ]}
    >
      <Ionicons color="#fff" name="chevron-down" size={14} />
      <Text style={styles.label}>Mensajes recientes</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 20,
    bottom: 10,
    elevation: 4,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  label: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
});
