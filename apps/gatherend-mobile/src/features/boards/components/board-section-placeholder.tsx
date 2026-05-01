import { StyleSheet, View } from "react-native";
import { Text } from "@/src/components/app-typography";

type BoardSectionPlaceholderProps = {
  description: string;
  title: string;
};

export function BoardSectionPlaceholder({
  description,
  title,
}: BoardSectionPlaceholderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: "#f8fafc",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 32,
    textAlign: "center",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
