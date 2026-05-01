import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { parsePostContent } from "@/src/lib/parse-post-formatting";
import { useTheme } from "@/src/theme/theme-provider";
import type { ClientRuleItem } from "../domain/rules";
import { Text } from "@/src/components/app-typography";

type RuleItemProps = {
  rule: ClientRuleItem;
};

export function RuleItem({ rule }: RuleItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: colors.borderPrimary,
          backgroundColor: colors.bgEditForm,
        },
      ]}
    >
      <View
        style={[
          styles.badge,
          {
            borderColor: colors.tabButtonBg,
            backgroundColor: colors.tabButtonBg + "66",
          },
        ]}
      >
        <Text style={[styles.badgeText, { color: colors.textPrimary }]}>
          {rule.order}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {parsePostContent(rule.title, colors.textAccent)}
        </Text>
        {rule.description ? (
          <Text style={[styles.description, { color: colors.textSubtle }]}>
            {parsePostContent(rule.description, colors.textAccent)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      alignItems: "flex-start",
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    badge: {
      alignItems: "center",
      borderRadius: 6,
      borderWidth: 1,
      height: 30,
      justifyContent: "center",
      minWidth: 30,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: "700",
    },
    body: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22,
    },
    description: {
      fontSize: 14,
      lineHeight: 21,
    },
  });
}
