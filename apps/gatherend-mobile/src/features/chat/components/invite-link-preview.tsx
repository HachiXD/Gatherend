import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/src/components/app-typography";
import {
  getInvitePreview,
  type InvitePreviewData,
} from "@/src/features/boards/api/get-invite-preview";
import { joinBoard } from "@/src/features/boards/api/join-board";
import { useTheme } from "@/src/theme/theme-provider";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: InvitePreviewData };

export function InviteLinkPreview({ inviteCode }: { inviteCode: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [isJoining, setIsJoining] = useState(false);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getInvitePreview(inviteCode)
      .then((data) => {
        if (!cancelled) setState({ kind: "ready", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load invite";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  const handleJoin = async () => {
    if (isJoining || isBanned) return;

    if (state.kind !== "ready") {
      router.push({
        pathname: "/(public)/index",
      });
      return;
    }

    const { data } = state;

    try {
      setIsJoining(true);
      setIsBanned(false);

      const result = await joinBoard({
        boardId: data.id,
        inviteCode,
      });

      if (result.success || result.alreadyMember) {
        if (result.success && !result.alreadyMember) {
          router.push({
            pathname: "/(app)/(tabs)/boards/[boardId]/home",
            params: { boardId: data.id },
          });
        } else {
          router.push({
            pathname: "/(app)/(tabs)/boards/[boardId]/chats",
            params: { boardId: data.id },
          });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message === "Banned from this board") {
        setIsBanned(true);
      }
    } finally {
      setIsJoining(false);
    }
  };

  if (state.kind === "loading") {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bgTertiary,
            borderColor: colors.borderPrimary,
          },
        ]}
      >
        <View
          style={[styles.imagePlaceholder, { backgroundColor: colors.bgQuaternary }]}
        />
        <View style={styles.info}>
          <View
            style={[styles.skeletonLine, { backgroundColor: colors.bgQuaternary, width: 96 }]}
          />
          <View
            style={[styles.skeletonLine, { backgroundColor: colors.bgQuaternary, width: 64, marginTop: 6 }]}
          />
        </View>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
      </View>
    );
  }

  if (state.kind === "error") {
    const isDisabled = state.message === "Invitations disabled";
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bgTertiary,
            borderColor: colors.borderPrimary,
          },
        ]}
      >
        <View
          style={[
            styles.imagePlaceholder,
            { backgroundColor: colors.borderPrimary },
          ]}
        >
          <Ionicons color={colors.textMuted} name="people-outline" size={22} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>
            {isDisabled ? "Invitations are disabled" : "Invalid invite link"}
          </Text>
        </View>
      </View>
    );
  }

  const { data } = state;
  const coverAsset = data.bannerAsset ?? data.imageAsset;
  const coverUrl = coverAsset?.url ?? null;
  const initial = data.name.charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgTertiary,
          borderColor: colors.borderPrimary,
        },
      ]}
    >
      {/* Board image */}
      <View
        style={[styles.imageWrap, { backgroundColor: colors.bgTertiary }]}
      >
        {coverUrl ? (
          <Image
            contentFit="cover"
            source={{ uri: coverUrl }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.imageFallback,
              { backgroundColor: colors.accentPrimary },
            ]}
          >
            <Text style={styles.imageFallbackText}>{initial}</Text>
          </View>
        )}
      </View>

      {/* Board info */}
      <View style={styles.info}>
        <Text
          numberOfLines={1}
          style={[styles.boardName, { color: colors.textPrimary }]}
        >
          {data.name}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.boardSubtitle, { color: colors.textMuted }]}
        >
          Has sido invitado
        </Text>
      </View>

      {/* Join button */}
      <Pressable
        disabled={isJoining || isBanned}
        onPress={() => void handleJoin()}
        style={({ pressed }) => [
          styles.joinButton,
          { backgroundColor: colors.buttonPrimary },
          (isJoining || isBanned) && styles.joinButtonDisabled,
          pressed && styles.joinButtonPressed,
        ]}
      >
        <Text style={styles.joinButtonText}>
          {isBanned ? "Bloqueado" : isJoining ? "Uniéndome..." : "Unirme"}
        </Text>
      </Pressable>
    </View>
  );
}

const CARD_MAX_WIDTH = 320;
const IMAGE_SIZE = 48;

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    maxWidth: CARD_MAX_WIDTH,
    padding: 12,
  },
  imageWrap: {
    borderRadius: 10,
    flexShrink: 0,
    height: IMAGE_SIZE,
    overflow: "hidden",
    width: IMAGE_SIZE,
  },
  imagePlaceholder: {
    alignItems: "center",
    borderRadius: 10,
    flexShrink: 0,
    height: IMAGE_SIZE,
    justifyContent: "center",
    width: IMAGE_SIZE,
  },
  imageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  imageFallbackText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  boardName: {
    fontSize: 14,
    fontWeight: "700",
  },
  boardSubtitle: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 13,
  },
  skeletonLine: {
    borderRadius: 4,
    height: 12,
  },
  joinButton: {
    alignItems: "center",
    borderRadius: 8,
    flexShrink: 0,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonPressed: {
    opacity: 0.85,
  },
  joinButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
