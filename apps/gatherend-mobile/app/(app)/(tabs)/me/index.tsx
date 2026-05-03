import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useCallback, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import {
  getFgFromBg,
  getCardStyle,
  ProfileCardInlineView,
} from "@/src/features/profile/components/profile-card-inline-view";

import { Text } from "@/src/components/app-typography";

const BANNER_HEIGHT = 180;
const AVATAR_SIZE = 120;
const AVATAR_OVERLAP = AVATAR_SIZE / 2;

function getUsernameColorHex(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const c = value as { type?: unknown; color?: unknown };
    if (c.type === "solid" && typeof c.color === "string") return c.color;
  }
  return null;
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b))
    return `rgba(0,0,0,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getInitial(username: string) {
  return username.trim().charAt(0).toUpperCase() || "?";
}

export default function MeScreen() {
  const router = useRouter();
  const profile = useProfile();
  const navigating = useRef(false);

  useFocusEffect(useCallback(() => {
    navigating.current = false;
  }, []));

  const insets = useSafeAreaInsets();

  const cardStyle = getCardStyle(profile.profileCardConfig);
  const bgFg = getFgFromBg(cardStyle.bg);
  const boxFg = getFgFromBg(cardStyle.box);

  const avatarUrl = profile.avatarAsset?.url;
  const bannerUrl = profile.bannerAsset?.url;

  return (
    <View style={[styles.root, { backgroundColor: cardStyle.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: banner + avatar centrado ── */}
        <View style={styles.hero}>
          <View style={[styles.banner, { backgroundColor: cardStyle.box }]}>
            {bannerUrl ? (
              <Image
                contentFit="cover"
                source={{ uri: bannerUrl }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Pressable
              hitSlop={12}
              style={({ pressed }) => [
                styles.settingsBtn,
                {
                  backgroundColor: hexToRgba(cardStyle.bg, 1),
                  borderColor: "rgba(255,255,255,0.25)",
                },
              ]}
              onPress={() => {
                if (navigating.current) return;
                navigating.current = true;
                router.push("/(app)/(tabs)/me/settings");
              }}
            >
              <Ionicons color="#ffffff" name="settings-outline" size={26} />
            </Pressable>
          </View>

          <View style={styles.avatarWrapper}>
            {avatarUrl ? (
              <Image
                contentFit="cover"
                source={{ uri: avatarUrl }}
                style={[
                  styles.avatar,
                  { borderColor: cardStyle.bg, backgroundColor: cardStyle.box },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarFallback,
                  { borderColor: cardStyle.bg, backgroundColor: cardStyle.box },
                ]}
              >
                <Text style={[styles.avatarFallbackText, { color: boxFg.fg }]}>
                  {getInitial(profile.username)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Identity ── */}
        <View style={styles.identity}>
          <Text numberOfLines={1} style={[styles.username, { color: bgFg.fg }]}>
            {profile.username}
            {profile.discriminator ? (
              <Text style={[styles.discriminator, { color: bgFg.fgSubtle }]}>
                {" "}
                /{profile.discriminator}
              </Text>
            ) : null}
          </Text>
          {profile.badge
            ? (() => {
                const pillColor =
                  getUsernameColorHex(profile.usernameColor) ?? cardStyle.box;
                const pillFg = getFgFromBg(pillColor);
                return (
                  <View
                    style={[
                      styles.badgePill,
                      { backgroundColor: pillColor, borderColor: bgFg.border },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: pillFg.fg }]}>
                      {profile.badge}
                    </Text>
                  </View>
                );
              })()
            : null}
          {profile.profileTags.length > 0 ? (
            <View style={styles.tagsRow}>
              {profile.profileTags.slice(0, 4).map((tag) => (
                <View
                  key={tag}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: cardStyle.box,
                      borderColor: bgFg.border,
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: boxFg.fgSubtle }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Edit buttons ── */}
        <View style={styles.editBtnsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.editBtn,
              {
                backgroundColor: cardStyle.box,
                borderColor: bgFg.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => {
                if (navigating.current) return;
                navigating.current = true;
                router.push("/(app)/(tabs)/me/edit-profile");
              }}
          >
            <Ionicons color={boxFg.fg} name="create-outline" size={16} />
            <Text style={[styles.editBtnText, { color: boxFg.fg }]}>
              Editar perfil
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.editBtn,
              {
                backgroundColor: cardStyle.box,
                borderColor: bgFg.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => {
                if (navigating.current) return;
                navigating.current = true;
                router.push("/(app)/(tabs)/me/edit-wall");
              }}
          >
            <Ionicons color={boxFg.fg} name="albums-outline" size={16} />
            <Text style={[styles.editBtnText, { color: boxFg.fg }]}>
              Editar muro
            </Text>
          </Pressable>
        </View>

        {/* ── Card content + stats + info ── */}
        <ProfileCardInlineView profile={profile} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 0,
  },

  // Hero
  hero: {
    alignItems: "center",
    marginHorizontal: -16,
  },
  banner: {
    height: BANNER_HEIGHT,
    overflow: "hidden",
    width: "100%",
  },
  settingsBtn: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    bottom: 10,
    height: 42,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    width: 42,
  },
  avatarWrapper: {
    marginTop: -AVATAR_OVERLAP,
    zIndex: 2,
  },
  avatar: {
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 28,
    fontWeight: "800",
  },

  // Identity
  identity: {
    alignItems: "center",
    gap: 6,
    marginTop: -12,
  },
  username: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  discriminator: {
    fontSize: 22,
    fontWeight: "600",
  },
  badgePill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginTop: 2,
  },
  tag: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Edit buttons
  editBtnsRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  editBtn: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },


});
