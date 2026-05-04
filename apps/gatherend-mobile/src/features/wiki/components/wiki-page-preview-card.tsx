import { Ionicons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import { Text } from "@/src/components/app-typography";
import { useTheme } from "@/src/theme/theme-provider";
import type { WikiPagePreview } from "../domain/wiki";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type WikiPagePreviewCardProps = {
  page: WikiPagePreview;
  onPress: () => void;
};

function WikiPagePreviewCardInner({ page, onPress }: WikiPagePreviewCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: colors.borderPrimary,
          backgroundColor: colors.bgEditForm,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        <Ionicons
          name="document-text-outline"
          size={18}
          color={colors.textSubtle}
          style={styles.icon}
        />
        <View style={styles.content}>
          <Text
            style={[styles.title, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {page.title}
          </Text>
          <View style={styles.meta}>
            <UserAvatar
              avatarUrl={page.author.avatarAsset?.url}
              username={page.author.username}
              size={16}
            />
            <Text
              style={[styles.metaText, { color: colors.textTertiary }]}
              numberOfLines={1}
            >
              {page.author.username} · {formatDate(page.updatedAt)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

export const WikiPagePreviewCard = memo(WikiPagePreviewCardInner);

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      borderRadius: 12,
      borderWidth: 1,
      marginHorizontal: 12,
      marginVertical: 5,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    pressed: {
      opacity: 0.8,
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    icon: {
      marginTop: 1,
    },
    content: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 20,
    },
    meta: {
      alignItems: "center",
      flexDirection: "row",
      gap: 5,
    },
    metaText: {
      flex: 1,
      fontSize: 12,
    },
  });
}
