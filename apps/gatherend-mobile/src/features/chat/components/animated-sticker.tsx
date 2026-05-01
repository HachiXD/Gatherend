import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import type { ClientSticker } from "../types";
import { Text } from "@/src/components/app-typography";

type AnimatedStickerProps = {
  sticker: ClientSticker;
  size?: number;
};

export function AnimatedSticker({ sticker, size = 80 }: AnimatedStickerProps) {
  if (!sticker.asset?.url) {
    return (
      <View style={[styles.fallback, { height: size, width: size }]}>
        <Text numberOfLines={2} style={styles.fallbackText}>
          {sticker.name}
        </Text>
      </View>
    );
  }

  return (
    <Image
      contentFit="contain"
      source={{ uri: sticker.asset.url }}
      style={{ height: size, width: size }}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    justifyContent: "center",
  },
  fallbackText: {
    color: "#94a3b8",
    fontSize: 11,
    paddingHorizontal: 4,
    textAlign: "center",
  },
});
