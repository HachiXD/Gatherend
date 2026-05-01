import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import type { ChatMessage } from "@/src/features/chat/chat-message";
import type {
  ChatReaction,
  ChatReplyTarget,
  ClientAttachmentAsset,
} from "@/src/features/chat/types";
import {
  getMessageAuthor,
  getMessageOwnerProfileId,
  getReplyAuthor,
} from "@/src/features/chat/utils/message-author";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

// --- pure helpers ---

function isUpdated(
  createdAt: string | Date,
  updatedAt: string | Date,
): boolean {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 2000;
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

const MONTH_ABBREVIATIONS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

function getLocalDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateSeparator(date: Date): string {
  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(date);
  const dayDiff = Math.round(
    (today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dayDiff === 0) return "Hoy";
  if (dayDiff === 1) return "Ayer";

  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_ABBREVIATIONS[date.getMonth()] ?? "";
  return `${day} ${month} ${date.getFullYear()}`;
}

export function getChatDateSeparatorLabel(
  currentValue: string | Date,
  previousValue?: string | Date | null,
): string | null {
  const current = new Date(currentValue);
  if (!Number.isFinite(current.getTime())) return null;

  if (previousValue) {
    const previous = new Date(previousValue);
    if (
      Number.isFinite(previous.getTime()) &&
      getLocalDayKey(current) === getLocalDayKey(previous)
    ) {
      return null;
    }
  }

  return formatDateSeparator(current);
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const HEX_COLOR_RE = /^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

type UsernameColorValue =
  | string
  | {
      type?: "solid";
      color?: unknown;
    }
  | {
      type?: "gradient";
      colors?: unknown;
    };

type ChatBubbleStyle = {
  background: string | null;
  borderWidth: number;
  shadowEnabled: boolean;
  roundedEnabled: boolean;
};

function getUsernamePillColor(
  usernameColor: unknown,
  fallbackColor: string,
): string {
  if (!usernameColor) return fallbackColor;

  if (typeof usernameColor === "string") {
    return HEX_COLOR_RE.test(usernameColor) ? usernameColor : fallbackColor;
  }

  if (typeof usernameColor !== "object") return fallbackColor;

  const value = usernameColor as UsernameColorValue;
  if (value.type === "solid" && typeof value.color === "string") {
    return HEX_COLOR_RE.test(value.color) ? value.color : fallbackColor;
  }

  if (value.type === "gradient" && Array.isArray(value.colors)) {
    const firstStop = value.colors
      .filter(
        (stop): stop is { color: string; position?: number } =>
          typeof stop === "object" &&
          stop !== null &&
          typeof (stop as { color?: unknown }).color === "string",
      )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];

    return firstStop && HEX_COLOR_RE.test(firstStop.color)
      ? firstStop.color
      : fallbackColor;
  }

  return fallbackColor;
}

function mixHexWithBlack(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[A-Fa-f0-9]{6}$/.test(full)) return "rgba(0,0,0,0.24)";

  const weight = Math.max(0, Math.min(1, amount));
  const r = Math.round(parseInt(full.slice(0, 2), 16) * (1 - weight));
  const g = Math.round(parseInt(full.slice(2, 4), 16) * (1 - weight));
  const b = Math.round(parseInt(full.slice(4, 6), 16) * (1 - weight));
  return `rgb(${r} ${g} ${b})`;
}

function parseChatBubbleStyle(value: unknown): ChatBubbleStyle | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const background =
    v.background === null
      ? null
      : typeof v.background === "string" && HEX_COLOR_RE.test(v.background)
        ? v.background
        : null;
  const borderWidth =
    typeof v.borderWidth === "number" &&
    Number.isInteger(v.borderWidth) &&
    v.borderWidth >= 0 &&
    v.borderWidth <= 5
      ? v.borderWidth
      : null;
  const shadowEnabled =
    typeof v.shadowEnabled === "boolean" ? v.shadowEnabled : null;
  const roundedEnabled =
    typeof v.roundedEnabled === "boolean" ? v.roundedEnabled : null;
  if (borderWidth === null || shadowEnabled === null || roundedEnabled === null)
    return null;
  return { background, borderWidth, shadowEnabled, roundedEnabled };
}

function getBubbleCustomStyle(
  bubbleStyle: ChatBubbleStyle | null,
  fallbackColor: string,
): {
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
} {
  if (!bubbleStyle) {
    return {
      backgroundColor: fallbackColor,
      borderWidth: 0,
      borderColor: "transparent",
      borderRadius: 16,
    };
  }
  const bg = bubbleStyle.background ?? fallbackColor;
  const radius = bubbleStyle.roundedEnabled ? 16 : 0;
  const bw = bubbleStyle.borderWidth;
  const borderColor = bw > 0 ? mixHexDarker(bg, 0.3) : "transparent";
  return {
    backgroundColor: bg,
    borderWidth: bw,
    borderColor,
    borderRadius: radius,
  };
}

function mixHexDarker(hex: string, weight: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[A-Fa-f0-9]{6}$/.test(full)) return "rgba(0,0,0,0.3)";
  const r = Math.round(parseInt(full.slice(0, 2), 16) * (1 - weight));
  const g = Math.round(parseInt(full.slice(2, 4), 16) * (1 - weight));
  const b = Math.round(parseInt(full.slice(4, 6), 16) * (1 - weight));
  return `rgb(${r} ${g} ${b})`;
}

function groupReactions(reactions: ChatReaction[]) {
  const map = new Map<
    string,
    { emoji: string; count: number; profileIds: Set<string> }
  >();
  for (const r of reactions) {
    const entry = map.get(r.emoji);
    if (entry) {
      entry.count += 1;
      entry.profileIds.add(r.profileId);
    } else {
      map.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        profileIds: new Set([r.profileId]),
      });
    }
  }
  return Array.from(map.values());
}

function getReplyPreviewText(replyTo: ChatReplyTarget): string {
  if (replyTo.sticker) return "🎨 Sticker";
  if (replyTo.attachmentAsset) return "📎 Adjunto";
  return replyTo.content.trim() || "Mensaje anterior";
}

// --- sub-components ---

const ReplyPreview = memo(function ReplyPreview({
  replyTo,
}: {
  replyTo: ChatReplyTarget;
}) {
  const { colors } = useTheme();
  const author = getReplyAuthor(replyTo, { includeFallback: true });

  return (
    <View
      style={[
        styles.replyPreview,
        {
          backgroundColor: colors.bgSecondary,
          borderColor: colors.borderAccentItemReplyPreview,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.replyPreviewText, { color: colors.textMuted }]}
      >
        <Text
          style={[styles.replyPreviewAuthor, { color: colors.textSecondary }]}
        >
          {author?.username ?? "Usuario"}:{" "}
        </Text>
        {getReplyPreviewText(replyTo)}
      </Text>
    </View>
  );
});

const ReactionsRow = memo(function ReactionsRow({
  reactions,
  currentProfileId,
}: {
  reactions: ChatReaction[];
  currentProfileId: string;
}) {
  const { colors } = useTheme();
  const groups = useMemo(() => groupReactions(reactions), [reactions]);
  if (groups.length === 0) return null;

  return (
    <View style={styles.reactionsRow}>
      {groups.map((group) => {
        const isActive = group.profileIds.has(currentProfileId);
        return (
          <View
            key={group.emoji}
            style={[
              styles.reactionChip,
              {
                backgroundColor: isActive
                  ? colors.reactionActiveBg
                  : colors.reactionBg,
                borderColor: isActive
                  ? colors.reactionActiveBorder
                  : colors.reactionBorder,
              },
            ]}
          >
            <Text style={styles.reactionEmoji}>{group.emoji}</Text>
            <Text
              style={[
                styles.reactionCount,
                {
                  color: isActive
                    ? colors.reactionActiveText
                    : colors.reactionText,
                },
              ]}
            >
              {group.count}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

const ImageBody = memo(function ImageBody({
  asset,
}: {
  asset: ClientAttachmentAsset;
}) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  // screenWidth - container h-padding(12*2) - avatar col(36) - gap(10)
  const contentWidth = screenWidth - 70;
  const imageHeight =
    asset.width && asset.height
      ? Math.min(300, (contentWidth * asset.height) / asset.width)
      : 200;
  const [modalVisible, setModalVisible] = useState(false);

  if (!asset.url) return null;

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={[styles.imageWrapper, { backgroundColor: colors.bgSecondary }]}
      >
        <Image
          contentFit="cover"
          source={{ uri: asset.url }}
          style={{ borderRadius: 10, height: imageHeight, width: contentWidth }}
        />
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        transparent
        visible={modalVisible}
      >
        <Pressable
          onPress={() => setModalVisible(false)}
          style={styles.imageModalOverlay}
        >
          <Image
            contentFit="contain"
            source={{ uri: asset.url }}
            style={styles.imageModalFull}
          />
        </Pressable>
      </Modal>
    </>
  );
});

const FileBody = memo(function FileBody({
  asset,
}: {
  asset: ClientAttachmentAsset;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.fileCard,
        {
          backgroundColor: colors.bgSecondary,
          borderColor: colors.borderPrimary,
        },
      ]}
    >
      <View
        style={[styles.fileIconWrap, { backgroundColor: colors.bgQuaternary }]}
      >
        <Ionicons
          color={colors.textMuted}
          name="document-text-outline"
          size={22}
        />
      </View>
      <View style={styles.fileCopy}>
        <Text
          numberOfLines={1}
          style={[styles.fileName, { color: colors.textPrimary }]}
        >
          {asset.originalName ?? "Archivo"}
        </Text>
        <Text style={[styles.fileMeta, { color: colors.textMuted }]}>
          {asset.mimeType.includes("pdf") ? "PDF" : "Archivo"} ·{" "}
          {formatFileSize(asset.sizeBytes)}
        </Text>
      </View>
    </View>
  );
});

// --- main component ---

export type ChatItemProps = {
  message: ChatMessage;
  currentProfileId: string;
  isCompact?: boolean;
  dateSeparatorLabel?: string | null;
  onLongPress?: (message: ChatMessage) => void;
  onAvatarPress?: (author: ReturnType<typeof getMessageAuthor>) => void;
};

export const ChatItem = memo(function ChatItem({
  message,
  currentProfileId,
  isCompact = false,
  dateSeparatorLabel = null,
  onLongPress,
  onAvatarPress,
}: ChatItemProps) {
  const { colors } = useTheme();

  const author = getMessageAuthor(message);
  const isOwnMessage = getMessageOwnerProfileId(message) === currentProfileId;
  const avatarUrl = author?.avatarAsset?.url ?? null;
  const username = author?.username ?? "Usuario";
  const badge = author?.badge?.trim() ?? "";
  const badgeColor = getUsernamePillColor(
    author?.usernameColor,
    colors.bgQuaternary,
  );
  const edited = isUpdated(message.createdAt, message.updatedAt);
  const isOptimistic = message.isOptimistic === true;
  const reactions = message.reactions ?? [];

  const chatBubbleStyle = parseChatBubbleStyle(author?.chatBubbleStyle);
  const bubbleStyle = getBubbleCustomStyle(
    chatBubbleStyle,
    isOwnMessage ? colors.buttonPrimary : colors.bgTertiary,
  );

  const hasSticker = Boolean(message.sticker?.asset?.url);
  const hasImage =
    Boolean(message.attachmentAsset) &&
    isImageMime(message.attachmentAsset!.mimeType);
  const hasFile =
    Boolean(message.attachmentAsset) &&
    !isImageMime(message.attachmentAsset!.mimeType);
  const hasTextContent = message.content.trim().length > 0;

  // Bubbled content: text/deleted. Unbubbled: sticker, image, file.
  const showBubble = !hasSticker && !hasImage && !hasFile;

  return (
    <>
      {dateSeparatorLabel ? (
        <View style={styles.dateSeparator}>
          <View
            style={[
              styles.dateSeparatorRule,
              { backgroundColor: colors.borderPrimary },
            ]}
          />
          <View
            style={[
              styles.dateSeparatorPill,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            <Text
              style={[styles.dateSeparatorText, { color: colors.textMuted }]}
            >
              {dateSeparatorLabel}
            </Text>
          </View>
          <View
            style={[
              styles.dateSeparatorRule,
              { backgroundColor: colors.borderPrimary },
            ]}
          />
        </View>
      ) : null}

      <Pressable
        delayLongPress={380}
        onLongPress={onLongPress ? () => onLongPress(message) : undefined}
        style={[
          styles.container,
          isOwnMessage ? styles.containerOwn : styles.containerOther,
          isCompact ? styles.containerCompact : styles.containerFull,
          isOptimistic ? styles.optimistic : null,
        ]}
      >
      {/* Avatar column — 36 px wide in both states */}
      {!isCompact ? (
        <Pressable
          onPress={onAvatarPress ? () => onAvatarPress(author) : undefined}
        >
          <UserAvatar avatarUrl={avatarUrl} size={40} username={username} />
        </Pressable>
      ) : (
        <View style={styles.avatarSpacer} />
      )}

      <View
        style={[
          styles.content,
          isOwnMessage ? styles.contentOwn : styles.contentOther,
        ]}
      >
        {/* Header — only in non-compact */}
        {!isCompact ? (
          <View
            style={[
              styles.headerRow,
              isOwnMessage ? styles.headerRowOwn : styles.headerRowOther,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.username,
                isOwnMessage ? styles.usernameOwn : null,
                { color: colors.textPrimary },
              ]}
            >
              {username}
            </Text>
            {badge ? (
              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor: badgeColor,
                    borderColor: mixHexWithBlack(badgeColor, 0.24),
                  },
                ]}
              >
                <Text numberOfLines={1} style={styles.badgePillText}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Body */}
        {showBubble ? (
          <View style={[styles.bubble, bubbleStyle]}>
            {message.replyTo ? (
              <ReplyPreview replyTo={message.replyTo} />
            ) : null}

            {message.deleted ? (
              <Text
                style={[
                  styles.deletedText,
                  {
                    color: isOwnMessage ? colors.textInverse : colors.textMuted,
                  },
                ]}
              >
                Mensaje eliminado
              </Text>
            ) : hasTextContent ? (
              <Text
                style={[
                  styles.bodyText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                {message.content}
                {edited ? (
                  <Text
                    style={[
                      styles.editedLabel,
                      {
                        color: isOwnMessage
                          ? colors.textInverse
                          : colors.textMuted,
                      },
                    ]}
                  >
                    {" "}
                    (editado)
                  </Text>
                ) : null}
              </Text>
            ) : null}
          </View>
        ) : (
          /* Unbubbled: sticker / image / file */
          <View>
            {message.replyTo ? (
              <ReplyPreview replyTo={message.replyTo} />
            ) : null}

            {hasSticker ? (
              <Image
                contentFit="contain"
                source={{ uri: message.sticker!.asset!.url! }}
                style={styles.sticker}
              />
            ) : hasImage ? (
              <ImageBody asset={message.attachmentAsset!} />
            ) : hasFile ? (
              <FileBody asset={message.attachmentAsset!} />
            ) : null}
          </View>
        )}

        {reactions.length > 0 && !message.deleted ? (
          <ReactionsRow
            currentProfileId={currentProfileId}
            reactions={reactions}
          />
        ) : null}
      </View>
      </Pressable>
    </>
  );
});

const AVATAR_GAP = 6;
const AVATAR_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: AVATAR_GAP,
    paddingHorizontal: 8,
  },
  containerOther: {
    justifyContent: "flex-start",
  },
  containerOwn: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
  },
  containerFull: {
    paddingBottom: 4,
    paddingTop: 10,
  },
  containerCompact: {
    paddingBottom: 2,
    paddingTop: 2,
  },
  optimistic: {
    opacity: 0.5,
  },
  dateSeparator: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingBottom: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  dateSeparatorRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dateSeparatorPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },

  avatarSpacer: {
    width: AVATAR_SIZE,
  },
  content: {
    flex: 1,
    gap: 4,
    maxWidth: "78%",
    minWidth: 0,
  },
  contentOther: {
    alignItems: "flex-start",
  },
  contentOwn: {
    alignItems: "flex-end",
  },
  headerRow: {
    alignItems: "baseline",
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 8,
    maxWidth: "100%",
  },
  headerRowOther: {
    justifyContent: "flex-start",
  },
  headerRowOwn: {
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
  },
  username: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
    minWidth: 0,
  },
  usernameOwn: {
    textAlign: "right",
  },
  badgePill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    justifyContent: "center",
    maxWidth: 104,
    minHeight: 18,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgePillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 12,
  },
  bubble: {
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  editedLabel: {
    fontSize: 12,
    fontStyle: "italic",
  },
  deletedText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  replyPreviewText: {
    fontSize: 12,
    lineHeight: 17,
  },
  replyPreviewAuthor: {
    fontWeight: "700",
  },
  sticker: {
    height: 120,
    width: 120,
  },
  imageWrapper: {
    borderRadius: 10,
    overflow: "hidden",
  },
  imageModalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.92)",
    flex: 1,
    justifyContent: "center",
  },
  imageModalFull: {
    height: "100%",
    width: "100%",
  },
  fileCard: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  fileIconWrap: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  fileCopy: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "700",
  },
  fileMeta: {
    fontSize: 11,
  },
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingTop: 2,
  },
  reactionChip: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: "600",
  },
});
