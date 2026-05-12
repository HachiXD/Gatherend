import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Text } from "@/src/components/app-typography";
import { autoCreateBoard } from "@/src/features/boards/api/auto-create-board";
import { useUserBoards } from "@/src/features/boards/hooks/use-user-boards";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useTheme } from "@/src/theme/theme-provider";

export default function BoardsEntryScreen() {
  const router = useRouter();
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
  const profile = useProfile();

  const [autoCreateFailed, setAutoCreateFailed] = useState(false);
  const hasAutoCreated = useRef(false);

  // When boards load empty and no error, auto-create the first board.
  useEffect(() => {
    if (isLoading || isError || boards.length > 0 || hasAutoCreated.current) return;
    hasAutoCreated.current = true;

    const displayName = profile.username || "User";
    const boardName = `${displayName}'s Board`;

    autoCreateBoard(boardName)
      .then((board) => {
        router.replace({
          pathname: "/boards/[boardId]/home",
          params: { boardId: board.id, drawerOpen: "1" },
        });
      })
      .catch(() => {
        setAutoCreateFailed(true);
      });
  }, [isLoading, isError, boards.length, profile.username, router]);

  const firstBoard = boards[0];
  if (firstBoard) {
    return (
      <Redirect
        href={{
          pathname: "/boards/[boardId]/home",
          params: { boardId: firstBoard.id, drawerOpen: "1" },
        }}
      />
    );
  }

  return (
    <View style={[styles.safeArea, { paddingTop: topInset }]}>
      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.accentPrimary} size="small" />
          <Text style={styles.stateText}>Cargando boards...</Text>
        </View>
      ) : null}

      {!isLoading && isError ? (
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>No se pudieron cargar tus boards</Text>
          <Text style={styles.stateText}>
            Reintenta para volver a consultar el backend autenticado.
          </Text>
          <Pressable
            onPress={() => {
              void refetch();
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isFetching ? "Reintentando..." : "Reintentar"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !isError && !autoCreateFailed ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.accentPrimary} size="small" />
          <Text style={styles.stateText}>Preparando tu board...</Text>
        </View>
      ) : null}

      {!isLoading && !isError && autoCreateFailed ? (
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Crea tu primer board</Text>
          <Text style={styles.stateText}>
            No pudimos crear tu board automáticamente.
          </Text>
          <Pressable
            onPress={() => {
              router.push("/modal/create-board");
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>Crear board +</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 12,
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    stateTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    stateText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.buttonPrimary,
      borderRadius: 18,
      marginTop: 6,
      minHeight: 52,
      justifyContent: "center",
      paddingHorizontal: 22,
    },
    primaryButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderSecondary,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 18,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.92,
    },
  });
}
