import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { BoardSettingsCenterState } from "@/src/features/board-settings/components/settings-states";
import { useDeleteBoard } from "@/src/features/board-settings/hooks/use-board-settings";
import { canViewSettingsSection } from "@/src/features/board-settings/utils/permissions";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

export default function BoardDangerSettingsScreen() {
  const router = useRouter();
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: board, isLoading } = useBoard(boardId);
  const deleteMutation = useDeleteBoard(boardId ?? "");

  if (isLoading && !board) {
    return <BoardSettingsCenterState message="Cargando zona de peligro..." loading />;
  }

  if (!board || !canViewSettingsSection(board.currentMember?.role, "danger")) {
    return (
      <BoardSettingsCenterState
        title="Sin acceso"
        message="Solo el owner puede eliminar este board."
      />
    );
  }

  const handleDelete = () => {
    Alert.alert(
      "Eliminar board",
      `${board.name} sera eliminado permanentemente. Esta accion no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync();
              router.replace("/boards");
            } catch (error) {
              Alert.alert(
                "No se pudo eliminar",
                error instanceof Error ? error.message : "Intenta nuevamente.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
      <View style={styles.panel}>
        <View style={styles.warningHeader}>
          <Ionicons name="warning-outline" size={22} color="#fb7185" />
          <Text style={styles.warningTitle}>Eliminar board</Text>
        </View>
        <Text style={styles.warningText}>
          Esto elimina canales, miembros y configuracion asociada. No podras
          recuperar el board despues.
        </Text>
        <Pressable
          onPress={handleDelete}
          disabled={deleteMutation.isPending}
          style={({ pressed }) => [
            styles.deleteButton,
            (pressed || deleteMutation.isPending) ? styles.pressed : null,
          ]}
        >
          <Text style={styles.deleteButtonText}>
            {deleteMutation.isPending ? "Eliminando..." : "Eliminar board"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    content: {
      gap: 16,
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    deleteButton: {
      alignItems: "center",
      backgroundColor: "rgba(190, 18, 60, 0.55)",
      borderColor: "rgba(251, 113, 133, 0.55)",
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 14,
    },
    deleteButtonText: {
      color: "#ffe4e6",
      fontSize: 14,
      fontWeight: "800",
    },
    panel: {
      backgroundColor: "rgba(127, 29, 29, 0.22)",
      borderColor: "rgba(251, 113, 133, 0.42)",
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
      padding: 14,
    },
    pressed: {
      opacity: 0.72,
    },
    scroll: {
      flex: 1,
    },
    warningHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    warningText: {
      color: "#fda4af",
      fontSize: 13,
      lineHeight: 19,
    },
    warningTitle: {
      color: "#fecdd3",
      fontSize: 16,
      fontWeight: "800",
    },
  });
}
