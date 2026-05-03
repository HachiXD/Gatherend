import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { resolveProfileCardLayout } from "@/src/features/profile/lib/card/profile-card-layout";
import type { ProfileCardConfig } from "@/src/features/profile/lib/card/profile-card-config";
import { Text } from "@/src/components/app-typography";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CARD_BG = "#707070";
const DEFAULT_BOX_COLOR = "#8a8a8a";

// ── Exported helpers (shared with the /me screen) ─────────────────────────────

export function getCardStyle(config: unknown) {
  if (config && typeof config === "object" && !Array.isArray(config)) {
    const c = config as {
      style?: {
        backgroundColor?: unknown;
        boxColor?: unknown;
        rounded?: unknown;
        shadows?: unknown;
      };
    };
    return {
      bg:
        typeof c.style?.backgroundColor === "string"
          ? c.style.backgroundColor
          : DEFAULT_CARD_BG,
      box:
        typeof c.style?.boxColor === "string"
          ? c.style.boxColor
          : DEFAULT_BOX_COLOR,
      rounded: typeof c.style?.rounded === "boolean" ? c.style.rounded : false,
      shadows: typeof c.style?.shadows === "boolean" ? c.style.shadows : true,
    };
  }
  return {
    bg: DEFAULT_CARD_BG,
    box: DEFAULT_BOX_COLOR,
    rounded: false,
    shadows: true,
  };
}

export function getFgFromBg(bgHex: string) {
  const r = parseInt(bgHex.slice(1, 3), 16);
  const g = parseInt(bgHex.slice(3, 5), 16);
  const b = parseInt(bgHex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return {
      fg: "#ffffff",
      fgSubtle: "rgba(255,255,255,0.65)",
      fgMuted: "rgba(255,255,255,0.45)",
      border: "rgba(255,255,255,0.12)",
    };
  }
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const onDark = luma <= 0.5;
  return {
    fg: onDark ? "#ffffff" : "#1a1a1a",
    fgSubtle: onDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)",
    fgMuted: onDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.40)",
    border: onDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)",
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function trimToNull(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function BoxShell({
  title,
  hideTitle = false,
  rounded,
  shadows,
  boxColor,
  children,
  style,
}: {
  title?: string | null;
  hideTitle?: boolean;
  rounded: boolean;
  shadows: boolean;
  boxColor: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = getFgFromBg(boxColor);
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: boxColor,
          borderRadius: rounded ? 8 : 2,
          elevation: shadows ? 2 : 0,
          shadowOpacity: shadows ? 0.18 : 0,
        },
        style,
      ]}
    >
      {!hideTitle && title ? (
        <Text
          numberOfLines={1}
          style={[
            styles.boxTitle,
            { borderBottomColor: fg.fgMuted, color: fg.fgSubtle },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <View style={styles.boxBody}>{children}</View>
    </View>
  );
}

function ContentTextBox({
  title,
  content,
  rounded,
  shadows,
  boxColor,
  style,
}: {
  title?: string | null;
  content: string;
  rounded: boolean;
  shadows: boolean;
  boxColor: string;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = getFgFromBg(boxColor);
  return (
    <BoxShell
      title={title}
      rounded={rounded}
      shadows={shadows}
      boxColor={boxColor}
      style={style}
    >
      <Text style={[styles.boxText, { color: fg.fg }]}>{content}</Text>
    </BoxShell>
  );
}

function ContentImageBox({
  title,
  url,
  rounded,
  shadows,
  boxColor,
  hideTitle = false,
  minHeight = 132,
  style,
}: {
  title?: string | null;
  url?: string | null;
  rounded: boolean;
  shadows: boolean;
  boxColor: string;
  hideTitle?: boolean;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <BoxShell
      title={title}
      hideTitle={hideTitle}
      rounded={rounded}
      shadows={shadows}
      boxColor={boxColor}
      style={[{ minHeight }, style]}
    >
      {url ? (
        <Image
          contentFit="cover"
          source={{ uri: url }}
          style={[styles.cardImage, { borderRadius: rounded ? 7 : 0 }]}
        />
      ) : null}
    </BoxShell>
  );
}

function StatPill({
  value,
  label,
  fg,
  fgMuted,
}: {
  value: string | number;
  label: string;
  fg: string;
  fgMuted: string;
}) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statPillValue, { color: fg }]}>{value}</Text>
      <Text style={[styles.statPillLabel, { color: fgMuted }]}>{label}</Text>
    </View>
  );
}

function SectionRow({
  icon,
  label,
  value,
  fg,
  fgMuted,
  borderColor,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  fg: string;
  fgMuted: string;
  borderColor: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.sectionRow,
        { borderBottomWidth: last ? 0 : 1, borderBottomColor: borderColor },
      ]}
    >
      <View style={styles.sectionRowIcon}>
        <Ionicons color={fgMuted} name={icon} size={17} />
      </View>
      <View style={styles.sectionRowCopy}>
        <Text style={[styles.sectionRowLabel, { color: fgMuted }]}>
          {label}
        </Text>
        <Text numberOfLines={1} style={[styles.sectionRowValue, { color: fg }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ── Public type ────────────────────────────────────────────────────────────────

export type ProfileCardViewProfile = {
  profileCardConfig: unknown;
  profileCardLeftTopImageAsset?: { url?: string | null } | null;
  profileCardLeftBottomRightTopImageAsset?: { url?: string | null } | null;
  profileCardLeftBottomRightBottomImageAsset?: { url?: string | null } | null;
  profileCardRightTopImageAsset?: { url?: string | null } | null;
  profileCardRightBottomImageAsset?: { url?: string | null } | null;
  reputationScore?: number;
  languages?: string[];
  profileTags: string[];
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileCardInlineView({
  profile,
}: {
  profile: ProfileCardViewProfile;
}){
  const cardStyle = getCardStyle(profile.profileCardConfig);
  const bgFg = getFgFromBg(cardStyle.bg);
  const boxFg = getFgFromBg(cardStyle.box);

  const effectiveConfig: ProfileCardConfig =
    (profile.profileCardConfig as ProfileCardConfig | null) ?? {
      version: 1,
      style: {
        backgroundColor: DEFAULT_CARD_BG,
        boxColor: DEFAULT_BOX_COLOR,
        rounded: false,
        shadows: true,
      },
      content: {},
    };

  const layout = resolveProfileCardLayout({
    profileCardConfig: effectiveConfig,
    profileCardLeftTopImageAsset: profile.profileCardLeftTopImageAsset,
    profileCardLeftBottomRightTopImageAsset:
      profile.profileCardLeftBottomRightTopImageAsset,
    profileCardLeftBottomRightBottomImageAsset:
      profile.profileCardLeftBottomRightBottomImageAsset,
    profileCardRightTopImageAsset: profile.profileCardRightTopImageAsset,
    profileCardRightBottomImageAsset: profile.profileCardRightBottomImageAsset,
  });
  const content = effectiveConfig.content;

  const languageSummary =
    profile.languages && profile.languages.length > 0
      ? profile.languages.join(", ")
      : "Sin idiomas";
  const tagSummary =
    profile.profileTags.length > 0
      ? profile.profileTags.slice(0, 3).join(", ")
      : "Sin tags";

  const showStats =
    profile.reputationScore !== undefined || profile.languages !== undefined;

  const boxSharedStyle = {
    backgroundColor: cardStyle.box,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: cardStyle.rounded ? 8 : 2,
    elevation: cardStyle.shadows ? 2 : 0,
    shadowOpacity: cardStyle.shadows ? 0.18 : 0,
  };

  return (
    <View style={styles.container}>
      {/* ── Card content (pageTitle, boxes, images) ── */}
      {layout.activeSlots.mainBody || trimToNull(content.pageTitle) ? (
        <View style={styles.cardBody}>
          {trimToNull(content.pageTitle) ? (
            <ContentTextBox
              content={content.pageTitle!}
              rounded={cardStyle.rounded}
              shadows={cardStyle.shadows}
              boxColor={cardStyle.box}
            />
          ) : null}

          {layout.activeSlots.topRow ? (
            <View style={styles.cardRow}>
              {layout.activeSlots.leftTopImage ? (
                <View style={styles.narrowColumn}>
                  <ContentImageBox
                    hideTitle
                    url={profile.profileCardLeftTopImageAsset?.url}
                    rounded={cardStyle.rounded}
                    shadows={cardStyle.shadows}
                    boxColor={cardStyle.box}
                    minHeight={150}
                    style={styles.fillFlex}
                  />
                </View>
              ) : null}
              {layout.activeSlots.leftTopText &&
              trimToNull(content.leftTopText?.content) ? (
                <View style={styles.wideColumn}>
                  <ContentTextBox
                    title={trimToNull(content.leftTopText?.title)}
                    content={content.leftTopText!.content}
                    rounded={cardStyle.rounded}
                    shadows={cardStyle.shadows}
                    boxColor={cardStyle.box}
                    style={styles.fillFlex}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {layout.activeSlots.bottomRow ? (
            <View style={styles.cardRow}>
              {layout.activeSlots.bottomTextColumn ? (
                <View style={styles.wideColumn}>
                  <BoxShell
                    rounded={cardStyle.rounded}
                    shadows={cardStyle.shadows}
                    boxColor={cardStyle.box}
                    style={styles.fillFlex}
                  >
                    {content.leftBottomText?.sectionA ? (
                      <ContentTextBox
                        title={content.leftBottomText.sectionA.title}
                        content={content.leftBottomText.sectionA.content}
                        rounded={cardStyle.rounded}
                        shadows={false}
                        boxColor={cardStyle.box}
                      />
                    ) : null}
                    {content.leftBottomText?.sectionB ? (
                      <ContentTextBox
                        title={content.leftBottomText.sectionB.title}
                        content={content.leftBottomText.sectionB.content}
                        rounded={cardStyle.rounded}
                        shadows={false}
                        boxColor={cardStyle.box}
                      />
                    ) : null}
                  </BoxShell>
                </View>
              ) : null}
              {layout.activeSlots.bottomImagesColumn ? (
                <View style={[styles.cardRowVertical, styles.narrowColumn]}>
                  {layout.activeSlots.leftBottomRightTopImage ? (
                    <ContentImageBox
                      hideTitle
                      url={
                        profile.profileCardLeftBottomRightTopImageAsset?.url
                      }
                      rounded={cardStyle.rounded}
                      shadows={cardStyle.shadows}
                      boxColor={cardStyle.box}
                      minHeight={108}
                      style={styles.fillFlex}
                    />
                  ) : null}
                  {layout.activeSlots.leftBottomRightBottomImage ? (
                    <ContentImageBox
                      hideTitle
                      url={
                        profile.profileCardLeftBottomRightBottomImageAsset?.url
                      }
                      rounded={cardStyle.rounded}
                      shadows={cardStyle.shadows}
                      boxColor={cardStyle.box}
                      minHeight={108}
                      style={styles.fillFlex}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {layout.activeSlots.rightRow ? (
            <View style={styles.cardRow}>
              {layout.activeSlots.rightTopImage ? (
                <View style={styles.equalColumn}>
                  <ContentImageBox
                    title={trimToNull(content.rightTopImage?.title)}
                    url={profile.profileCardRightTopImageAsset?.url}
                    rounded={cardStyle.rounded}
                    shadows={cardStyle.shadows}
                    boxColor={cardStyle.box}
                    style={styles.fillFlex}
                  />
                </View>
              ) : null}
              {layout.activeSlots.rightBottomImage ? (
                <View style={styles.equalColumn}>
                  <ContentImageBox
                    title={trimToNull(content.rightBottomImage?.title)}
                    url={profile.profileCardRightBottomImageAsset?.url}
                    rounded={cardStyle.rounded}
                    shadows={cardStyle.shadows}
                    boxColor={cardStyle.box}
                    style={styles.fillFlex}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Stats strip ── */}
      {showStats ? (
        <View style={[styles.statsStrip, boxSharedStyle]}>
          <StatPill
            label="Reputación"
            value={profile.reputationScore ?? 0}
            fg={boxFg.fg}
            fgMuted={boxFg.fgMuted}
          />
          <View style={[styles.statDivider, { backgroundColor: bgFg.border }]} />
          <StatPill
            label="Idiomas"
            value={profile.languages?.length ?? 0}
            fg={boxFg.fg}
            fgMuted={boxFg.fgMuted}
          />
          <View style={[styles.statDivider, { backgroundColor: bgFg.border }]} />
          <StatPill
            label="Tags"
            value={profile.profileTags.length}
            fg={boxFg.fg}
            fgMuted={boxFg.fgMuted}
          />
        </View>
      ) : null}

      {/* ── Info section ── */}
      {showStats ? (
        <View style={[styles.section, boxSharedStyle]}>
          <SectionRow
            icon="language-outline"
            label="Idiomas"
            value={languageSummary}
            fg={boxFg.fg}
            fgMuted={boxFg.fgMuted}
            borderColor={bgFg.border}
          />
          <SectionRow
            icon="pricetag-outline"
            label="Tags"
            value={tagSummary}
            fg={boxFg.fg}
            fgMuted={boxFg.fgMuted}
            borderColor={bgFg.border}
            last
          />
        </View>
      ) : null}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },

  // Stats strip
  statsStrip: {
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 2 },
    shadowRadius: 0,
  },
  statPill: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  statPillValue: {
    fontSize: 15,
    fontWeight: "500",
  },
  statPillLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statDivider: {
    width: 1,
  },

  // Box content
  box: {
    borderColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 2 },
    shadowRadius: 0,
  },
  boxBody: {
    flex: 1,
    gap: 8,
    minHeight: 0,
  },
  boxText: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 19,
  },
  boxTitle: {
    borderBottomWidth: 1,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
    paddingBottom: 5,
    textTransform: "uppercase",
  },
  cardImage: {
    flex: 1,
    minHeight: 92,
    width: "100%",
  },
  cardBody: {
    gap: 10,
  },
  cardRow: {
    flexDirection: "row",
    gap: 10,
  },
  cardRowVertical: {
    gap: 10,
  },
  fillFlex: {
    flex: 1,
  },
  narrowColumn: {
    flex: 0.75,
    minWidth: 0,
  },
  wideColumn: {
    flex: 1.25,
    minWidth: 0,
  },
  equalColumn: {
    flex: 1,
    minWidth: 0,
  },

  // Section rows
  section: {
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 2 },
    shadowRadius: 0,
  },
  sectionRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sectionRowValue: {
    fontSize: 15,
    fontWeight: "500",
  },
});
