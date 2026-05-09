import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
} from "react-native";
import type { DiscoveryBoard } from "@/src/features/discovery/types";
import { useTheme } from "@/src/theme/theme-provider";

const GEIST_BOLD = "Geist_700Bold";
const GEIST_REGULAR = "Geist_400Regular";

export const DISCOVERY_BOARD_CARD_HEIGHT = 246;

type DiscoveryBoardCardProps = {
  board: DiscoveryBoard;
  onPress: (boardId: string) => void;
  disabled?: boolean;
  onReport?: () => void;
};

export const DiscoveryBoardCard = memo(function DiscoveryBoardCard({
  board,
  onPress,
  disabled = false,
  onReport,
}: DiscoveryBoardCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bannerAsset = board.bannerAsset ?? board.imageAsset;
  const memberLabel = board.memberCount === 1 ? "miembro" : "miembros";

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onPress(board.id)}
      style={({ pressed }) => [
        styles.card,
        disabled ? styles.cardDisabled : null,
        pressed && !disabled ? styles.cardPressed : null,
      ]}
    >
      <View style={styles.imageShell}>
        {bannerAsset?.url ? (
          <Image
            contentFit="cover"
            source={{ uri: bannerAsset.url }}
            style={styles.image}
          />
        ) : (
          <View style={styles.imageFallback}>
            <NativeText style={styles.imageFallbackText}>
              {board.name.charAt(0).toUpperCase()}
            </NativeText>
          </View>
        )}

        {onReport ? (
          <Pressable
            hitSlop={10}
            onPress={onReport}
            style={styles.reportButton}
          >
            <Ionicons color="rgba(255,255,255,0.9)" name="flag-outline" size={18} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.copy}>
        <NativeText numberOfLines={1} style={styles.title}>
          {board.name}
        </NativeText>
        <NativeText style={styles.meta}>
          {board.memberCount} {memberLabel}
        </NativeText>
      </View>
    </Pressable>
  );
});

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderPrimary,
      borderRadius: 24,
      borderWidth: 1,
      height: DISCOVERY_BOARD_CARD_HEIGHT,
    },
    cardPressed: {
      opacity: 0.94,
    },
    cardDisabled: {
      opacity: 0.72,
    },
    imageShell: {
      backgroundColor: colors.bgQuaternary,
      borderTopLeftRadius: 23,
      borderTopRightRadius: 23,
      height: 168,
      overflow: "hidden",
      width: "100%",
    },
    reportButton: {
      backgroundColor: "rgba(0,0,0,0.45)",
      borderRadius: 10,
      padding: 9,
      position: "absolute",
      right: 10,
      top: 10,
    },
    image: {
      height: "100%",
      width: "100%",
    },
    imageFallback: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
    },
    imageFallbackText: {
      color: colors.textPrimary,
      fontFamily: GEIST_BOLD,
      fontSize: 34,
    },
    copy: {
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: GEIST_BOLD,
      fontSize: 20,
      lineHeight: 24,
    },
    meta: {
      color: colors.textMuted,
      fontFamily: GEIST_REGULAR,
      fontSize: 14,
      lineHeight: 20,
      minHeight: 20,
    },
  });
}
