import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { BoardSettingsCenterState } from "@/src/features/board-settings/components/settings-states";
import {
  getVisibleSettingsSections,
  normalizeRole,
} from "@/src/features/board-settings/utils/permissions";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

export default function BoardSettingsIndexScreen() {
  const router = useRouter();
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data: board,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useBoard(boardId);

  if (isLoading && !board) {
    return <BoardSettingsCenterState message="Cargando settings..." loading />;
  }

  if (isError && !board) {
    return (
      <BoardSettingsCenterState
        title="No se pudo cargar este board"
        message={error instanceof Error ? error.message : "Intenta nuevamente."}
        actionLabel="Reintentar"
        actionLoadingLabel="Reintentando..."
        actionLoading={isFetching}
        onAction={() => void refetch()}
      />
    );
  }

  const role = normalizeRole(board?.currentMember?.role);
  const sections = getVisibleSettingsSections(role);

  if (!board || !role || sections.length === 0) {
    return (
      <BoardSettingsCenterState
        title="Sin acceso"
        message="No tienes permisos para administrar este board."
      />
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
      <View style={styles.list}>
        {sections.map((section) => (
          <Pressable
            key={section.id}
            onPress={() => {
              if (!boardId) return;
              router.push(
                `/boards/${boardId}/settings/${section.route}` as Href,
              );
            }}
            style={({ pressed }) => [
              styles.row,
              pressed ? styles.rowPressed : null,
            ]}
          >
            <View style={styles.iconBox}>
              <Ionicons
                name={section.icon as keyof typeof Ionicons.glyphMap}
                size={19}
                color={section.id === "danger" ? "#fb7185" : colors.textPrimary}
              />
            </View>
            <View style={styles.rowCopy}>
              <Text
                style={[
                  styles.rowTitle,
                  section.id === "danger" ? styles.dangerText : null,
                ]}
                numberOfLines={1}
              >
                {section.title}
              </Text>
              <Text style={styles.rowDescription} numberOfLines={2}>
                {section.description}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        ))}
      </View>

      {isFetching ? (
        <View style={styles.refreshingRow}>
          <ActivityIndicator color={colors.accentPrimary} size="small" />
          <Text style={styles.refreshingText}>Actualizando...</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    content: {
      gap: 18,
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    dangerText: {
      color: "#fb7185",
    },
    header: {
      gap: 4,
    },
    iconBox: {
      alignItems: "center",
      borderRadius: 12,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    list: {
      gap: 8,
    },
    refreshingRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      paddingVertical: 8,
    },
    refreshingText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    row: {
      alignItems: "center",
      backgroundColor: colors.bgEditForm,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      minHeight: 72,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    rowCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    rowDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    rowPressed: {
      opacity: 0.9,
    },
    rowTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    scroll: {
      flex: 1,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "800",
      lineHeight: 30,
    },
  });
}
