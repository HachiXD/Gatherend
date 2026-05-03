import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Text } from "@/src/components/app-typography";
import { UserAvatar } from "@/src/components/user-avatar";
import type { ProfileCardConfig } from "@/src/features/profile/lib/card/profile-card-config";
import { parseUsernameFormat } from "@/src/features/profile/lib/username/username-format";
import {
  getCardStyle,
  getFgFromBg,
  ProfileCardInlineView,
} from "./profile-card-inline-view";

type AssetLike = {
  id?: string | null;
  url?: string | null;
} | null;

export type MobileProfileCardRenderable = {
  id: string;
  username: string;
  discriminator?: string | null;
  avatarAsset?: AssetLike;
  bannerAsset?: AssetLike;
  usernameColor?: unknown;
  usernameFormat?: unknown;
  badge?: string | null;
  badgeSticker?: { asset?: AssetLike } | null;
  profileTags?: string[];
  profileCardConfig?: ProfileCardConfig | null;
  profileCardLeftTopImageAsset?: AssetLike;
  profileCardLeftBottomRightTopImageAsset?: AssetLike;
  profileCardLeftBottomRightBottomImageAsset?: AssetLike;
  profileCardRightTopImageAsset?: AssetLike;
  profileCardRightBottomImageAsset?: AssetLike;
};

type ProfileCardRendererProps = {
  profile: MobileProfileCardRenderable;
  showStatus?: boolean;
  style?: ViewStyle;
  onSendMessage?: () => void;
  onReport?: () => void;
  isSendingMessage?: boolean;
  onCustomize?: () => void;
  flush?: boolean;
};

function getUsernameColorHex(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const color = value as { type?: unknown; color?: unknown };
    if (color.type === "solid" && typeof color.color === "string") {
      return color.color;
    }
  }
  return null;
}

function getUsernameFormatStyle(value: unknown): TextStyle {
  const format = parseUsernameFormat(value);
  return {
    fontStyle: format.italic ? "italic" : "normal",
    fontWeight: format.bold ? "800" : "700",
    textDecorationLine: format.underline ? "underline" : "none",
  };
}

export function ProfileCardRenderer({
  profile,
  showStatus = true,
  style,
  onSendMessage,
  onReport,
  isSendingMessage = false,
  onCustomize,
  flush = false,
}: ProfileCardRendererProps) {
  const cardStyle = getCardStyle(profile.profileCardConfig);
  const cardFg = getFgFromBg(cardStyle.bg);
  const pillColorHex = getUsernameColorHex(profile.usernameColor);
  const pillBg = pillColorHex ?? cardStyle.box;
  const pillFg = getFgFromBg(pillBg);
  const badgeStickerUrl = profile.badgeSticker?.asset?.url ?? null;

  const avatarSize = 120;
  const bannerHeight = 150;

  return (
    <View style={[styles.card, flush && styles.cardFlush, { backgroundColor: cardStyle.bg }, style]}>
      {/* Banner */}
      <View
        style={[
          styles.banner,
          { backgroundColor: cardStyle.box, height: bannerHeight },
        ]}
      >
        {profile.bannerAsset?.url ? (
          <Image
            contentFit="cover"
            source={{ uri: profile.bannerAsset.url }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {flush ? (
          <View style={styles.handleOverlay}>
            <View style={styles.handlePill} />
          </View>
        ) : null}
      </View>

      {/* Avatar — overlapping banner bottom */}
      <View style={[styles.avatarAnchor, { marginTop: -(avatarSize / 2) }]}>
        <View
          style={[
            styles.avatarBorder,
            {
              borderColor: cardStyle.bg,
              borderRadius: avatarSize / 2 + 3,
              height: avatarSize + 6,
              width: avatarSize + 6,
            },
          ]}
        >
          <UserAvatar
            avatarUrl={profile.avatarAsset?.url}
            profileId={profile.id}
            showStatus={showStatus}
            size={avatarSize}
            statusSize={22}
            statusOffsetX={6}
            statusOffsetY={12}
            statusRingColor={cardStyle.bg}
            username={profile.username}
          />
        </View>
      </View>

      {/* Identity */}
      <View style={styles.identity}>
        <Text
          numberOfLines={1}
          style={[
            styles.username,
            { color: cardFg.fg },
            getUsernameFormatStyle(profile.usernameFormat),
          ]}
        >
          {profile.username}
          {profile.discriminator ? (
            <Text style={[styles.discriminator, { color: cardFg.fgSubtle }]}>
              {" "}
              /{profile.discriminator}
            </Text>
          ) : null}
        </Text>

        {profile.badge || badgeStickerUrl ? (
          <View style={styles.badgeRow}>
            {badgeStickerUrl ? (
              <Image
                contentFit="contain"
                source={{ uri: badgeStickerUrl }}
                style={styles.badgeSticker}
              />
            ) : null}
            {profile.badge ? (
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: pillBg, borderColor: cardFg.fgMuted },
                ]}
              >
                <Text style={[styles.badgeText, { color: pillFg.fg }]}>
                  {profile.badge}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {profile.profileTags?.length ? (
          <View style={styles.tagsRow}>
            {profile.profileTags.slice(0, 4).map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tag,
                  {
                    backgroundColor: cardStyle.box,
                    borderColor: cardFg.fgMuted,
                  },
                ]}
              >
                <Text style={[styles.tagText, { color: cardFg.fgSubtle }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* Action buttons */}
      {(onSendMessage || onReport || onCustomize) ? (
        <View style={styles.actions}>
          {onCustomize ? (
            <Pressable
              onPress={onCustomize}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: "rgba(255,255,255,0.70)" },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons color="#000" name="pencil-outline" size={16} />
              <Text style={[styles.actionButtonText, { color: "#000" }]}>
                Personalizar perfil
              </Text>
            </Pressable>
          ) : null}
          {onSendMessage ? (
            <Pressable
              disabled={isSendingMessage}
              onPress={onSendMessage}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: "rgba(255,255,255,0.70)" },
                pressed && styles.pressed,
              ]}
            >
              {isSendingMessage ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Ionicons color="#000" name="chatbubble-outline" size={16} />
                  <Text style={[styles.actionButtonText, { color: "#000" }]}>
                    Enviar mensaje
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
          {onReport ? (
            <Pressable
              onPress={onReport}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: "rgba(0,0,0,0.70)" },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons color="#f87171" name="flag-outline" size={16} />
              <Text style={[styles.actionButtonText, { color: "#f87171" }]}>
                Reportar usuario
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Card body: boxes, images, stats */}
      <View style={styles.body}>
        <ProfileCardInlineView
          profile={{
            profileCardConfig: profile.profileCardConfig ?? null,
            profileCardLeftTopImageAsset: profile.profileCardLeftTopImageAsset,
            profileCardLeftBottomRightTopImageAsset:
              profile.profileCardLeftBottomRightTopImageAsset,
            profileCardLeftBottomRightBottomImageAsset:
              profile.profileCardLeftBottomRightBottomImageAsset,
            profileCardRightTopImageAsset:
              profile.profileCardRightTopImageAsset,
            profileCardRightBottomImageAsset:
              profile.profileCardRightBottomImageAsset,
            profileTags: profile.profileTags ?? [],
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  handleOverlay: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 10,
  },
  handlePill: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 3,
    height: 4,
    width: 40,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
  },
  cardFlush: {
    borderRadius: 0,
  },
  banner: {
    overflow: "hidden",
    width: "100%",
  },
  avatarAnchor: {
    alignItems: "center",
    zIndex: 2,
  },
  avatarBorder: {
    alignItems: "center",
    borderWidth: 3,
    justifyContent: "center",
  },
  identity: {
    alignItems: "center",
    gap: 4,
    paddingBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 0,
  },
  username: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    maxWidth: "96%",
    textAlign: "center",
  },
  discriminator: {
    fontSize: 18,
    fontWeight: "500",
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  badgePill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeSticker: {
    height: 26,
    width: 26,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    justifyContent: "center",
  },
  tag: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  body: {
    padding: 10,
    paddingTop: 0,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.82,
  },
});
