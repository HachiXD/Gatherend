import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { BoardChannelsList } from "@/src/features/boards/components/board-channels-list";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { useBoardVoiceParticipantsSocket } from "@/src/features/voice/hooks/use-board-voice-participants-socket";
import { useVoiceStore } from "@/src/features/voice/store/use-voice-store";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

export default function BoardChatsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const {
    data: board,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useBoard(boardId);

  const startConnecting = useVoiceStore((s) => s.startConnecting);
  useBoardVoiceParticipantsSocket(boardId);

  const handleJoinVoice = useCallback(
    (channelId: string, channelName: string) => {
      if (!boardId) return;
      const voiceState = useVoiceStore.getState();
      const isInThisVoiceChannel =
        voiceState.context === "board" &&
        voiceState.channelId === channelId &&
        (voiceState.isConnected || voiceState.isConnecting);

      if (isInThisVoiceChannel) {
        router.replace({
          pathname: "/(app)/boards/[boardId]/chats/[channelId]",
          params: { boardId, channelId },
        });
        return;
      }

      startConnecting(channelId, channelName, "board", boardId);
    },
    [boardId, router, startConnecting],
  );

  if (isLoading && !board) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={styles.stateText}>Cargando chats del board...</Text>
      </View>
    );
  }

  if (isError && !board) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>No se pudo cargar este board</Text>
        <Text style={styles.stateText}>
          {error instanceof Error ? error.message : "Intenta nuevamente."}
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
    );
  }

  if (!board) {
    return null;
  }

  if (board.channels.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>Todavia no hay chats</Text>
        <Text style={styles.stateText}>
          En cuanto existan canales dentro de {board.name}, apareceran aqui en
          una lista simple de una columna.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BoardChannelsList
        channels={board.channels}
        onSelectChannel={(channelId) => {
          if (!boardId) return;
          router.replace({
            pathname: "/(app)/boards/[boardId]/chats/[channelId]",
            params: { boardId, channelId },
          });
        }}
        onJoinVoice={handleJoinVoice}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: 18,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 18,
    },
    header: {
      gap: 6,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 26,
      fontWeight: "700",
      lineHeight: 32,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
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
