import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import type { DiscoveryBoard } from "@/src/features/discovery/types";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

type DiscoveryBoardCardProps = {
  board: DiscoveryBoard;
  onPress: (boardId: string) => void;
  disabled?: boolean;
  onReport?: () => void;
};

export function DiscoveryBoardCard({
  board,
  onPress,
  disabled = false,
  onReport,
}: DiscoveryBoardCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bannerAsset = board.bannerAsset ?? board.imageAsset;

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
            <Text style={styles.imageFallbackText}>
              {board.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {onReport ? (
          <Pressable
            hitSlop={10}
            onPress={onReport}
            style={({ pressed }) => [
              styles.reportButton,
              pressed && styles.reportButtonPressed,
            ]}
          >
            <Ionicons color="rgba(255,255,255,0.9)" name="flag-outline" size={18} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          {board.name}
        </Text>
        <Text style={styles.meta}>
          {board.memberCount} miembro{board.memberCount === 1 ? "" : "s"}
        </Text>
        <Text style={styles.meta}>
          {board.recentPostCount7d} post
          {board.recentPostCount7d === 1 ? "" : "s"} esta semana
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderPrimary,
      borderRadius: 24,
      borderWidth: 1,
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
    reportButtonPressed: {
      backgroundColor: "rgba(239,68,68,0.5)",
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
      fontSize: 34,
      fontWeight: "800",
    },
    copy: {
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    meta: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
