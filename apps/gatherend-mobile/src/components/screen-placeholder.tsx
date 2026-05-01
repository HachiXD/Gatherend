import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";
import { Text } from "@/src/components/app-typography";

type ScreenPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function ScreenPlaceholder({
  eyebrow,
  title,
  description,
}: ScreenPlaceholderProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0b1020",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  eyebrow: {
    color: "#7dd3fc",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40,
  },
  description: {
    color: "#94a3b8",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
  },
});
