import { useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useUserBoards } from "@/src/features/boards/hooks/use-user-boards";
import {
  DISCOVERY_BOARD_CARD_HEIGHT,
  DiscoveryBoardCard,
} from "@/src/features/discovery/components/discovery-board-card";
import { useDiscoveryBoards } from "@/src/features/discovery/hooks/use-discovery-boards";
import { useExploreBoard } from "@/src/features/discovery/hooks/use-explore-board";
import type { DiscoveryBoard } from "@/src/features/discovery/types";
import {
  ReportScreen,
  type ReportCategoryConfig,
} from "@/src/features/report/components/report-screen";
import type { ReportTargetType } from "@/src/features/report/api/submit-report";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

const BOARD_REPORT_CATEGORIES: ReportCategoryConfig[] = [
  {
    value: "CSAM",
    label: "Seguridad infantil",
    description: "Este board contiene material inapropiado de menores",
  },
  {
    value: "SEXUAL_CONTENT",
    label: "Contenido sexual",
    description: "Este board contiene material explícito o no solicitado",
  },
  {
    value: "HARASSMENT",
    label: "Acoso",
    description: "Este board promueve el acoso o la intimidación",
  },
  {
    value: "HATE_SPEECH",
    label: "Discurso de odio",
    description: "Este board promueve odio contra grupos o personas",
  },
  {
    value: "SPAM",
    label: "Spam",
    description: "Contenido repetitivo, engañoso o no solicitado",
  },
  {
    value: "IMPERSONATION",
    label: "Suplantación de identidad",
    description: "Se hace pasar por otra comunidad o entidad",
  },
  {
    value: "OTHER",
    label: "Otro",
    description: "Razón no listada anteriormente",
  },
];

const DISCOVERY_CARD_GAP = 16;
const DISCOVERY_ITEM_HEIGHT =
  DISCOVERY_BOARD_CARD_HEIGHT + DISCOVERY_CARD_GAP;

type ReportConfig = {
  title: string;
  previewLabel: string;
  categories: ReportCategoryConfig[];
  targetType: ReportTargetType;
  targetId: string;
  snapshot?: Record<string, unknown>;
};

export default function DiscoveryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top ?? StatusBar.currentHeight ?? 0,
  );
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useDiscoveryBoards();
  const { data: userBoards = [] } = useUserBoards();
  const exploreBoardMutation = useExploreBoard();
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);

  const userBoardIds = useMemo(
    () => new Set(userBoards.map((board) => board.id)),
    [userBoards],
  );
  const boards = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data?.pages],
  );

  const handleExploreBoard = useCallback(
    async (boardId: string) => {
      try {
        await exploreBoardMutation.mutateAsync({
          boardId,
          isMember: userBoardIds.has(boardId),
        });

        router.push({
          pathname: "/boards/[boardId]",
          params: { boardId },
        });
      } catch {
        // Surface through mutation.error below.
      }
    },
    [exploreBoardMutation, router, userBoardIds],
  );

  const handleReportBoard = useCallback(
    (item: DiscoveryBoard) => {
      setReportConfig({
        title: "Reportar board",
        previewLabel: item.name,
        categories: BOARD_REPORT_CATEGORIES,
        targetType: "BOARD",
        targetId: item.id,
        snapshot: {
          name: item.name,
          imageUrl: (item.bannerAsset ?? item.imageAsset)?.url,
        },
      });
    },
    [],
  );

  const renderBoard = useCallback(
    ({ item }: { item: DiscoveryBoard }) => (
      <DiscoveryBoardCard
        board={item}
        disabled={exploreBoardMutation.isPending}
        onPress={handleExploreBoard}
        onReport={() => handleReportBoard(item)}
      />
    ),
    [exploreBoardMutation.isPending, handleExploreBoard, handleReportBoard],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<DiscoveryBoard> | null | undefined, index: number) => ({
      length: DISCOVERY_ITEM_HEIGHT,
      offset: DISCOVERY_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const keyExtractor = useCallback((item: DiscoveryBoard) => item.id, []);

  const itemSeparatorComponent = useCallback(
    () => <View style={styles.itemSeparator} />,
    [styles],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const emptyComponent = useMemo(
    () => (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>No hay boards públicos</Text>
        <Text style={styles.stateText}>
          Cuando existan boards discoverables aparecerán aquí en una lista
          simple.
        </Text>
      </View>
    ),
    [styles],
  );

  const footerComponent = useMemo(
    () =>
      isFetchingNextPage ? (
        <View style={styles.footerLoader}>
          <ActivityIndicator color={colors.accentPrimary} size="small" />
          <Text style={styles.footerLoaderText}>Cargando más boards...</Text>
        </View>
      ) : null,
    [colors.accentPrimary, isFetchingNextPage, styles],
  );

  const handleCloseReport = useCallback(() => {
    setReportConfig(null);
  }, []);

  return (
    <View style={[styles.safeArea, { paddingTop: topInset }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Discovery</Text>
        </View>

        {exploreBoardMutation.isError ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>
              {exploreBoardMutation.error instanceof Error
                ? exploreBoardMutation.error.message
                : "No se pudo entrar al board."}
            </Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.accentPrimary} size="small" />
            <Text style={styles.stateText}>Cargando boards públicos...</Text>
          </View>
        ) : null}

        {!isLoading && isError ? (
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>No se pudo cargar Discovery</Text>
            <Text style={styles.stateText}>
              {error instanceof Error
                ? error.message
                : "Intenta de nuevo para consultar el feed público."}
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
                {isRefetching ? "Reintentando..." : "Reintentar"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !isError ? (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={boards}
            getItemLayout={getItemLayout}
            initialNumToRender={3}
            ItemSeparatorComponent={itemSeparatorComponent}
            keyExtractor={keyExtractor}
            maxToRenderPerBatch={3}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.35}
            renderItem={renderBoard}
            showsVerticalScrollIndicator={false}
            updateCellsBatchingPeriod={40}
            windowSize={5}
            ListEmptyComponent={emptyComponent}
            ListFooterComponent={footerComponent}
          />
        ) : null}
      </View>

      {reportConfig ? (
        <ReportScreen
          visible
          onClose={handleCloseReport}
          title={reportConfig.title}
          previewLabel={reportConfig.previewLabel}
          categories={reportConfig.categories}
          targetType={reportConfig.targetType}
          targetId={reportConfig.targetId}
          snapshot={reportConfig.snapshot}
        />
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
    container: {
      flex: 1,
      gap: 18,
      paddingHorizontal: 20,
      paddingTop: 12,
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
    inlineError: {
      backgroundColor: colors.bgCancelButton,
      borderColor: colors.borderPrimary,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    inlineErrorText: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 20,
    },
    listContent: {
      paddingBottom: 20,
    },
    itemSeparator: {
      height: DISCOVERY_CARD_GAP,
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
    footerLoader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      paddingTop: 6,
      paddingBottom: 14,
    },
    footerLoaderText: {
      color: colors.textMuted,
      fontSize: 13,
    },
  });
}
