import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { ProfileCardRenderer } from "@/src/features/profile/components/profile-card-renderer";
import { useProfileCard } from "@/src/features/profile/hooks/use-profile-card";
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
  const router = useRouter();
  const isSelf = author?.id === currentProfileId;

  const { data: profileCard } = useProfileCard(
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

  const handleCustomize = () => {
    onClose();
    router.push("/(app)/(tabs)/me");
  };

  const fallbackProfile = author
    ? {
        id: author.id,
        username: author.username,
        discriminator: author.discriminator,
        avatarAsset: author.avatarAsset,
        bannerAsset: null,
        usernameColor: author.usernameColor,
        usernameFormat: author.usernameFormat,
        badge: author.badge,
        badgeSticker: author.badgeSticker,
        profileTags: author.profileTags,
        profileCardConfig: null,
        profileCardLeftTopImageAsset: null,
        profileCardLeftBottomRightTopImageAsset: null,
        profileCardLeftBottomRightBottomImageAsset: null,
        profileCardRightTopImageAsset: null,
        profileCardRightBottomImageAsset: null,
      }
    : null;
  const renderProfile = profileCard ?? fallbackProfile;

  return (
    <BottomSheet hideHandle maxHeight={680} onClose={onClose} visible={visible}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderProfile ? (
          <ProfileCardRenderer
            flush
            profile={renderProfile}
            onSendMessage={!isSelf ? handleSendMessage : undefined}
            onReport={!isSelf ? onReport : undefined}
            isSendingMessage={openConversation.isPending}
            onCustomize={isSelf ? handleCustomize : undefined}
          />
        ) : (
          <View
            style={[
              styles.loadingCard,
              {
                backgroundColor: colors.bgTertiary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            <ActivityIndicator color={colors.textPrimary} size="small" />
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    loadingCard: {
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      height: 220,
      justifyContent: "center",
    },
    scrollContent: {
      gap: 0,
      padding: 0,
    },
  });
}
