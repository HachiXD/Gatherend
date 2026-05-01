import { Image } from "expo-image";
import { useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "@/src/theme/theme-provider";

const MAX_IMAGE_HEIGHT = 340;

type RulesImageProps = {
  imageUrl: string;
  width?: number | null;
  height?: number | null;
};

export function RulesImage({ imageUrl, width, height }: RulesImageProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const containerWidth = screenWidth - 32;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const displayHeight = (() => {
    if (!width || !height) return 220;
    const ratio = width / height;
    return Math.min(containerWidth / ratio, MAX_IMAGE_HEIGHT);
  })();

  return (
    <>
      <Pressable
        onPress={() => setLightboxOpen(true)}
        style={[
          styles.container,
          {
            width: containerWidth,
            height: displayHeight,
            borderColor: colors.borderPrimary,
            backgroundColor: colors.bgPrimary,
          },
        ]}
      >
        <Image
          source={{ uri: imageUrl }}
          contentFit="contain"
          style={StyleSheet.absoluteFill}
          transition={150}
        />
      </Pressable>

      <Modal
        visible={lightboxOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setLightboxOpen(false)}
        >
          <Image
            source={{ uri: imageUrl }}
            contentFit="contain"
            style={styles.lightboxImage}
          />
        </Pressable>
      </Modal>
    </>
  );
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden",
  },
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.88)",
    flex: 1,
    justifyContent: "center",
  },
  lightboxImage: {
    height: SCREEN_H * 0.88,
    width: SCREEN_W,
  },
});
