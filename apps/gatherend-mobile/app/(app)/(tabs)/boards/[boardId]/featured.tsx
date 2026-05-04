import { Ionicons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "@/src/components/app-typography";
import { PostPreviewCard } from "@/src/features/forum/components/post-preview-card";
import type { ForumPostPreview } from "@/src/features/forum/domain/post";
import { useBoardFeatured } from "@/src/features/featured/hooks/use-board-featured";
import type { FeaturedChannel } from "@/src/features/featured/domain/featured";
import { useTheme } from "@/src/theme/theme-provider";

export default function BoardFeaturedScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useBoardFeatured(boardId);

  const heroPost: ForumPostPreview | undefined = data?.topPosts[0];
  const gridPosts: ForumPostPreview[] = data?.topPosts.slice(1) ?? [];
  const channels: FeaturedChannel[] = data?.topChannels ?? [];

  function openPost(postId: string) {
    if (!boardId) return;
    router.push(`/(app)/boards/${boardId}/posts/${postId}` as Href);
  }

  function openChannel(channelId: string) {
    if (!boardId) return;
    router.push(`/(app)/(tabs)/boards/${boardId}/chats/${channelId}` as Href);
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          Cargando destacados...
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
          No se pudieron cargar los destacados
        </Text>
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          {error instanceof Error ? error.message : "Intenta nuevamente."}
        </Text>
        <Pressable
          onPress={() => void refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            {
              borderColor: colors.borderSecondary,
              backgroundColor: colors.bgTertiary,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.retryButtonText, { color: colors.textPrimary }]}>
            {isRefetching ? "Reintentando..." : "Reintentar"}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!heroPost) {
    return (
      <View style={styles.center}>
        <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
          Sin contenido destacado
        </Text>
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          Vuelve más tarde o sé el primero en publicar y recibir likes.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.accentPrimary}
        />
      }
    >
      {/* Hero post — full width */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
        🔥 Post más popular
      </Text>
      <PostPreviewCard
        post={heroPost}
        boardId={boardId ?? ""}
        onPress={() => openPost(heroPost.id)}
      />

      {/* Grid — 2 columns */}
      {gridPosts.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            También populares
          </Text>
          <View style={styles.grid}>
            {gridPosts.map((post) => (
              <View key={post.id} style={styles.gridCell}>
                <PostPreviewCard
                  post={post}
                  boardId={boardId ?? ""}
                  onPress={() => openPost(post.id)}
                />
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Top channels */}
      {channels.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            Chats con más miembros
          </Text>
          <View
            style={[styles.channelList, { borderColor: colors.borderPrimary }]}
          >
            {channels.map((channel, idx) => (
              <Pressable
                key={channel.id}
                onPress={() => openChannel(channel.id)}
                style={({ pressed }) => [
                  styles.channelRow,
                  {
                    backgroundColor: colors.bgEditForm,
                    borderBottomColor: colors.borderPrimary,
                  },
                  idx === channels.length - 1 && styles.channelRowLast,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.channelIcon,
                    { backgroundColor: colors.bgTertiary },
                  ]}
                >
                  <Ionicons
                    name={
                      channel.type === "VOICE"
                        ? "volume-medium-outline"
                        : "chatbubble-ellipses-outline"
                    }
                    size={18}
                    color={colors.textSecondary}
                  />
                </View>
                <View style={styles.channelMeta}>
                  <Text
                    style={[styles.channelName, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {channel.name}
                  </Text>
                  <Text
                    style={[styles.channelCount, { color: colors.textMuted }]}
                  >
                    {channel.memberCount}{" "}
                    {channel.memberCount === 1 ? "miembro" : "miembros"}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    scrollContent: {
      paddingBottom: 32,
      paddingTop: 8,
    },
    center: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 60,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.5,
      marginBottom: 4,
      marginHorizontal: 16,
      marginTop: 20,
      textTransform: "uppercase",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 6,
    },
    gridCell: {
      width: "50%",
    },
    channelList: {
      borderRadius: 12,
      borderWidth: 1,
      marginHorizontal: 12,
      overflow: "hidden",
    },
    channelRow: {
      alignItems: "center",
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    channelRowLast: {
      borderBottomWidth: 0,
    },
    channelIcon: {
      alignItems: "center",
      borderRadius: 10,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    channelMeta: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    channelName: {
      fontSize: 15,
      fontWeight: "600",
    },
    channelCount: {
      fontSize: 12,
    },
    stateTitle: {
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
    },
    stateText: {
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    retryButton: {
      alignItems: "center",
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 18,
    },
    retryButtonText: {
      fontSize: 14,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
