import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";

import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

const BANNER_HEIGHT = 180;
const AVATAR_SIZE = 80;
const AVATAR_OVERLAP = AVATAR_SIZE / 2;

function getInitial(username: string) {
  return username.trim().charAt(0).toUpperCase() || "?";
}

function StatPill({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillValue}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

function SectionRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.sectionRow, last ? styles.sectionRowLast : null]}>
      <View style={styles.sectionRowIcon}>
        <Ionicons color="#94a3b8" name={icon} size={17} />
      </View>
      <View style={styles.sectionRowCopy}>
        <Text style={styles.sectionRowLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.sectionRowValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function MeScreen() {
  const router = useRouter();
  const profile = useProfile();

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const avatarUrl = profile.avatarAsset?.url;
  const bannerUrl = profile.bannerAsset?.url;
  const languageSummary =
    profile.languages.length > 0 ? profile.languages.join(", ") : "Sin idiomas";
  const tagSummary =
    profile.profileTags.length > 0
      ? profile.profileTags.slice(0, 3).join(", ")
      : "Sin tags";

  return (
    <View style={[styles.root, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: banner + avatar centrado ── */}
        <View style={styles.hero}>
          {/* Banner */}
          <View style={[styles.banner, { backgroundColor: colors.bgTertiary }]}>
            {bannerUrl ? (
              <Image
                contentFit="cover"
                source={{ uri: bannerUrl }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {/* Settings button top-right */}
            <Pressable
              hitSlop={12}
              style={({ pressed }) => [
                styles.settingsBtn,
                {
                  backgroundColor: colors.bgSecondary,
                  borderColor: colors.borderPrimary,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={() => router.push("/(app)/(tabs)/me/settings")}
            >
              <Ionicons
                color={colors.textSubtle}
                name="settings-outline"
                size={26}
              />
            </Pressable>
          </View>

          {/* Avatar centered over banner bottom edge */}
          <View style={styles.avatarWrapper}>
            {avatarUrl ? (
              <Image
                contentFit="cover"
                source={{ uri: avatarUrl }}
                style={[
                  styles.avatar,
                  {
                    borderColor: colors.bgPrimary,
                    backgroundColor: colors.bgSecondary,
                  },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarFallback,
                  {
                    borderColor: colors.bgPrimary,
                    backgroundColor: colors.bgSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.avatarFallbackText,
                    { color: colors.textPrimary },
                  ]}
                >
                  {getInitial(profile.username)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Identity ── */}
        <View style={styles.identity}>
          <Text
            numberOfLines={1}
            style={[styles.username, { color: colors.textPrimary }]}
          >
            {profile.username}
            {profile.discriminator ? (
              <Text style={[styles.discriminator, { color: colors.textMuted }]}>
                {" "}
                /{profile.discriminator}
              </Text>
            ) : null}
          </Text>
          {profile.badge ? (
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
                {profile.badge}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Edit button ── */}
        <Pressable
          style={({ pressed }) => [
            styles.editBtn,
            {
              backgroundColor: colors.bgTertiary,
              borderColor: colors.borderPrimary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={() => router.push("/(app)/(tabs)/me/edit-profile")}
        >
          <Ionicons color={colors.textSubtle} name="create-outline" size={16} />
          <Text style={[styles.editBtnText, { color: colors.textSubtle }]}>
            Editar perfil
          </Text>
        </Pressable>

        {/* ── Stats strip ── */}
        <View
          style={[
            styles.statsStrip,
            {
              backgroundColor: colors.bgSecondary,
              borderColor: colors.borderPrimary,
            },
          ]}
        >
          <StatPill label="Reputación" value={profile.reputationScore} />
          <View
            style={[
              styles.statDivider,
              { backgroundColor: colors.borderPrimary },
            ]}
          />
          <StatPill label="Idiomas" value={profile.languages.length} />
          <View
            style={[
              styles.statDivider,
              { backgroundColor: colors.borderPrimary },
            ]}
          />
          <StatPill label="Tags" value={profile.profileTags.length} />
        </View>

        {/* ── Info section ── */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.bgSecondary,
              borderColor: colors.borderPrimary,
            },
          ]}
        >
          <SectionRow
            icon="language-outline"
            label="Idiomas"
            value={languageSummary}
          />
          <SectionRow
            icon="pricetag-outline"
            label="Tags"
            value={tagSummary}
            last
          />
        </View>
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
    marginTop: 6,
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

  // Edit button
  editBtn: {
    alignItems: "center",
    alignSelf: "center",
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

  // Stats strip
  statsStrip: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: 14,
  },
  statPill: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  statPillValue: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
  },
  statPillLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statDivider: {
    width: 1,
  },

  // Section rows
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionRow: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sectionRowLast: {
    borderBottomWidth: 0,
  },
  sectionRowIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 22,
  },
  sectionRowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  sectionRowLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sectionRowValue: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
  },

  // Sign out
  signOutButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 6,
  },
  signOutText: {
    color: "#fda4af",
    fontSize: 14,
    fontWeight: "700",
  },
});
