import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { UserAvatar } from "@/src/components/user-avatar";
import { Text } from "@/src/components/app-typography";
import { useProfileCard } from "../hooks/use-profile-card";
import { useOpenConversation } from "@/src/features/conversations/hooks/use-open-conversation";
import { useTheme } from "@/src/theme/theme-provider";
import type { ClientProfileSummary } from "../types";

type UserProfileSheetProps = {
  author: ClientProfileSummary | null;
  currentProfileId: string;
  visible: boolean;
  onClose: () => void;
  onReport?: () => void;
};

export function UserProfileSheet({
  author,
  currentProfileId,
  visible,
  onClose,
  onReport,
}: UserProfileSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isSelf = author?.id === currentProfileId;

  const { data: profileCard, isLoading } = useProfileCard(
    author?.id ?? null,
    currentProfileId,
    visible && !!author,
  );

  const openConversation = useOpenConversation();

  const handleSendMessage = () => {
    if (!author || isSelf) return;
    onClose();
    openConversation.mutate(author.id);
  };

  const bannerUrl = profileCard?.bannerAsset?.url ?? null;
  const avatarUrl =
    profileCard?.avatarAsset?.url ?? author?.avatarAsset?.url ?? null;
  const username = profileCard?.username ?? author?.username ?? "Usuario";
  const discriminator = profileCard?.discriminator ?? null;
  const badge = profileCard?.badge ?? author?.badge ?? null;
  const profileTags = profileCard?.profileTags ?? [];

  return (
    <BottomSheet maxHeight={520} onClose={onClose} visible={visible}>
      {/* Banner */}
      <View style={styles.banner}>
        {bannerUrl ? (
          <Image
            contentFit="cover"
            source={{ uri: bannerUrl }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.bannerFallback]} />
        )}
      </View>

      {/* Avatar overlapping banner */}
      <View style={styles.avatarRow}>
        <View
          style={[styles.avatarBorder, { borderColor: colors.bgSecondary }]}
        >
          {isLoading && !author ? (
            <View
              style={[
                styles.avatarSkeleton,
                { backgroundColor: colors.bgQuaternary },
              ]}
            />
          ) : (
            <UserAvatar avatarUrl={avatarUrl} size={72} username={username} />
          )}
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        {isLoading && !author ? (
          <View
            style={[
              styles.skeleton,
              { backgroundColor: colors.bgQuaternary, height: 22, width: 130 },
            ]}
          />
        ) : (
          <Text numberOfLines={1} style={styles.username}>
            {username}
            {discriminator ? (
              <Text style={[styles.discriminator, { color: colors.textMuted }]}>
                #{discriminator}
              </Text>
            ) : null}
          </Text>
        )}

        {badge ? (
          <View
            style={[
              styles.badgePill,
              {
                backgroundColor: colors.bgTertiary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.textSubtle }]}>
              {badge}
            </Text>
          </View>
        ) : isLoading ? (
          <View
            style={[
              styles.skeleton,
              { backgroundColor: colors.bgQuaternary, height: 16, width: 72 },
            ]}
          />
        ) : null}

        {profileTags.length > 0 ? (
          <View style={styles.tagsRow}>
            {profileTags.slice(0, 4).map((tag) => (
              <View
                key={tag}
                style={[styles.tag, { backgroundColor: colors.bgTertiary }]}
              >
                <Text style={[styles.tagText, { color: colors.textMuted }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* Actions */}
      {!isSelf ? (
        <View style={styles.actions}>
          <Pressable
            disabled={openConversation.isPending}
            onPress={handleSendMessage}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.textPrimary },
              pressed && styles.pressed,
            ]}
          >
            {openConversation.isPending ? (
              <ActivityIndicator color={colors.bgPrimary} size="small" />
            ) : (
              <>
                <Ionicons
                  color={colors.bgPrimary}
                  name="chatbubble-outline"
                  size={17}
                />
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: colors.bgPrimary },
                  ]}
                >
                  Enviar mensaje
                </Text>
              </>
            )}
          </Pressable>

          {onReport ? (
            <Pressable
              onPress={onReport}
              style={({ pressed }) => [
                styles.actionButton,
                styles.reportButton,
                {
                  borderColor: colors.borderPrimary,
                  backgroundColor: colors.bgTertiary,
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons color="#f87171" name="flag-outline" size={17} />
              <Text style={[styles.actionButtonText, { color: "#f87171" }]}>
                Reportar usuario
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    banner: {
      height: 100,
      overflow: "hidden",
    },
    bannerFallback: {
      backgroundColor: colors.bgTertiary,
    },
    avatarRow: {
      marginTop: -36,
      paddingHorizontal: 16,
    },
    avatarBorder: {
      borderRadius: 40,
      borderWidth: 3,
      alignSelf: "flex-start",
      overflow: "hidden",
    },
    avatarSkeleton: {
      borderRadius: 36,
      height: 72,
      width: 72,
    },
    info: {
      gap: 8,
      paddingBottom: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    username: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
    },
    discriminator: {
      fontSize: 16,
      fontWeight: "400",
    },
    badgePill: {
      alignSelf: "flex-start",
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    tagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    tag: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    tagText: {
      fontSize: 11,
      fontWeight: "600",
    },
    skeleton: {
      borderRadius: 6,
    },
    actions: {
      gap: 10,
      paddingBottom: 4,
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    actionButton: {
      alignItems: "center",
      borderRadius: 14,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 16,
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: "700",
    },
    reportButton: {
      borderWidth: 1,
    },
    pressed: {
      opacity: 0.88,
    },
  });
}
