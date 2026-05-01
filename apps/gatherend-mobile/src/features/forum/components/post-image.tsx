import { Image } from "expo-image";
import { useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useTheme } from "@/src/theme/theme-provider";

const MAX_IMAGE_HEIGHT = 340;

function getImageDimensions(
  originalWidth: number | null | undefined,
  originalHeight: number | null | undefined,
  containerWidth: number,
): { width: number; height: number } {
  if (!originalWidth || !originalHeight) {
    return { width: containerWidth, height: 220 };
  }
  const ratio = originalWidth / originalHeight;
  const height = Math.min(containerWidth / ratio, MAX_IMAGE_HEIGHT);
  return { width: containerWidth, height };
}

type PostImageProps = {
  imageUrl: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
};

export function PostImage({ imageUrl, imageWidth, imageHeight }: PostImageProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const containerWidth = screenWidth - 32;
  const { width, height } = getImageDimensions(imageWidth, imageHeight, containerWidth);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setLightboxOpen(true)}
        style={[
          styles.imageContainer,
          {
            width,
            height,
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
          style={styles.lightboxBackdrop}
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
  imageContainer: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden",
  },
  lightboxBackdrop: {
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
