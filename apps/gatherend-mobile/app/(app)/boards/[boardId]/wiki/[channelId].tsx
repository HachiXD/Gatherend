import { FlashList } from "@shopify/flash-list";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { useWikiPages } from "@/src/features/wiki/hooks/use-wiki-pages";
import { WikiPagePreviewCard } from "@/src/features/wiki/components/wiki-page-preview-card";
import { useTheme } from "@/src/theme/theme-provider";
import type { WikiPagePreview } from "@/src/features/wiki/domain/wiki";
import { Text } from "@/src/components/app-typography";

export default function BoardWikiChannelScreen() {
  const { boardId, channelId } = useLocalSearchParams<{
    boardId?: string;
    channelId?: string;
  }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { data: board } = useBoard(boardId);
  const wikiChannel = board?.channels.find((channel) => channel.id === channelId);

  const {
    data,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useWikiPages(boardId, channelId);

  const allPages = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const handleOpenPage = useCallback(
    (pageId: string) => {
      if (!boardId || !channelId) return;
      router.push(
        `/boards/${boardId}/wiki-pages/${pageId}?channelId=${channelId}` as Href,
      );
    },
    [boardId, channelId, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: WikiPagePreview }) => (
      <WikiPagePreviewCard
        page={item}
        onPress={() => handleOpenPage(item.id)}
      />
    ),
    [handleOpenPage],
  );

  if (isLoading && allPages.length === 0) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={styles.stateText}>Cargando wiki...</Text>
      </View>
    );
  }

  if (isError && allPages.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>No se pudo cargar la wiki</Text>
        <Text style={styles.stateText}>
          {error instanceof Error ? error.message : "Intenta nuevamente."}
        </Text>
        <Pressable
          onPress={() => void refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.retryButtonText}>
            {isRefetching ? "Reintentando..." : "Reintentar"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlashList
      data={allPages}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.accentPrimary}
        />
      }
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Todavía no hay páginas</Text>
          <Text style={styles.stateText}>
            Sé el primero en crear una página en{" "}
            {wikiChannel?.name ? `/${wikiChannel.name}` : "esta wiki"}.
          </Text>
        </View>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator color={colors.accentPrimary} size="small" />
          </View>
        ) : null
      }
    />
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    listContent: {
      paddingVertical: 8,
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
    retryButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    footerLoader: {
      alignItems: "center",
      paddingVertical: 16,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
