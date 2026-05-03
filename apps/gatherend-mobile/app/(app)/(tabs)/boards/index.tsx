import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { BoardsGrid } from "@/src/features/boards/components/boards-grid";
import { useUserBoards } from "@/src/features/boards/hooks/use-user-boards";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

export default function BoardsScreen() {
  const router = useRouter();
  const navigating = useRef(false);

  useFocusEffect(useCallback(() => {
    navigating.current = false;
  }, []));
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top ?? StatusBar.currentHeight ?? 0,
  );
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data: boards = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useUserBoards();
  const hasBoards = boards.length > 0;

  return (
    <View style={[styles.safeArea, { paddingTop: topInset }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mis Boards</Text>
        </View>

        <Pressable
          onPress={() => {
            if (navigating.current) return;
            navigating.current = true;
            router.push("/modal/create-board");
          }}
          style={({ pressed }) => [
            styles.createButton,
            pressed ? styles.createButtonPressed : null,
          ]}
        >
          <Text style={styles.createButtonText}>Crea tu board +</Text>
        </Pressable>

        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.accentPrimary} size="small" />
              <Text style={styles.stateText}>Cargando tus boards...</Text>
            </View>
          ) : null}

          {!isLoading && isError ? (
            <View style={styles.centerState}>
              <Text style={styles.stateTitle}>
                No se pudieron cargar tus boards
              </Text>
              <Text style={styles.stateText}>
                Reintenta para volver a consultar el backend autenticado.
              </Text>
              <Pressable
                onPress={() => {
                  void refetch();
                }}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed ? styles.retryButtonPressed : null,
                ]}
              >
                <Text style={styles.retryButtonText}>
                  {isFetching ? "Reintentando..." : "Reintentar"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!isLoading && !isError && !hasBoards ? (
            <View style={styles.centerState}>
              <Text style={styles.stateTitle}>Todavia no tienes boards</Text>
              <Text style={styles.stateText}>
                En cuanto formes parte de uno, lo veras aqui en un grid simple
                de dos columnas.
              </Text>
            </View>
          ) : null}

          {!isLoading && !isError && hasBoards ? (
            <BoardsGrid boards={boards} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 20,
    },
    header: {
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
      paddingBottom: 14,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 30,
      fontWeight: "700",
      lineHeight: 36,
    },
    content: {
      flex: 1,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 8,
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
    createButton: {
      alignItems: "center",
      backgroundColor: colors.buttonPrimary,
      borderRadius: 18,
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    createButtonPressed: {
      opacity: 0.92,
    },
    createButtonText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    retryButton: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderSecondary,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 18,
    },
    retryButtonPressed: {
      opacity: 0.92,
    },
    retryButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
