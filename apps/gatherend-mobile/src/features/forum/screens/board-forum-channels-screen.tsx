import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import type { BoardChannel } from "@/src/features/boards/types/board";
import { Text } from "@/src/components/app-typography";
import { useTheme } from "@/src/theme/theme-provider";

export default function BoardForumChannelsScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: board, isLoading } = useBoard(boardId);

  const forumChannels = useMemo(
    () =>
      (board?.channels ?? [])
        .filter((channel) => channel.type === "FORUM")
        .sort((a, b) => a.position - b.position),
    [board?.channels],
  );

  if (isLoading && !board) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={styles.stateText}>Cargando foros...</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.listContent}
      data={forumChannels}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Todavía no hay foros</Text>
          <Text style={styles.stateText}>
            Crea un canal tipo foro para empezar discusiones.
          </Text>
        </View>
      }
      renderItem={({ item }: { item: BoardChannel }) => (
        <Pressable
          onPress={() => {
            if (!boardId) return;
            router.push(`/boards/${boardId}/forum/${item.id}` as Href);
          }}
          style={({ pressed }) => [
            styles.channelCard,
            pressed ? styles.pressed : null,
          ]}
        >
          <View style={styles.iconWrap}>
            <Ionicons color={colors.textPrimary} name="chatbox" size={22} />
          </View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.title}>
              /{item.name}
            </Text>
          </View>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
        </Pressable>
      )}
    />
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    listContent: {
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    channelCard: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    iconWrap: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      borderRadius: 14,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    copy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "700",
    },
    meta: {
      color: colors.textMuted,
      fontSize: 13,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 60,
    },
    stateTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
    },
    stateText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    pressed: {
      opacity: 0.86,
    },
  });
}
