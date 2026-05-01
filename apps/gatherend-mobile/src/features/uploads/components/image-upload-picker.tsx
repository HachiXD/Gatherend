import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useTheme } from "@/src/theme/theme-provider";
import type { UploadContext } from "../domain/upload-context";
import { useUpload } from "../hooks/use-upload";
import { getStoredUploadValueFromUploadedFile, parseStoredUploadValue } from "../utils/upload-values";
import { Text } from "@/src/components/app-typography";

type ImageUploadPickerProps = {
  context: Exclude<UploadContext, "message_attachment" | "dm_attachment">;
  value: string;
  onChange: (value: string) => void;
  boardId?: string;
  label?: string;
  size?: number;
  allowEditing?: boolean;
  fullWidth?: boolean;
};

function getImageName(uri: string) {
  const cleanUri = uri.split("?")[0] ?? uri;
  return cleanUri.split("/").pop() || `image-${Date.now()}.jpg`;
}

function getImageType(uri: string) {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase();

  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";

  return "image/jpeg";
}

export function ImageUploadPicker({
  context,
  value,
  onChange,
  boardId,
  label = "Subir imagen",
  size = 96,
  allowEditing = false,
  fullWidth = false,
}: ImageUploadPickerProps) {
  const { colors } = useTheme();
  const [localError, setLocalError] = useState<string | null>(null);
  const fileData = parseStoredUploadValue(value);
  const previewUrl = fileData?.url;
  const styles = useMemo(
    () => createStyles(colors, size, fullWidth),
    [colors, fullWidth, size],
  );
  const { uploadFile, isUploading } = useUpload({
    onUploadError: setLocalError,
    onModerationBlock: setLocalError,
  });

  async function pickImage() {
    setLocalError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setLocalError("Permiso de galeria requerido.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: allowEditing,
      mediaTypes: ["images"],
      quality: 0.9,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    if (!asset?.uri) {
      setLocalError("No se pudo leer la imagen.");
      return;
    }

    try {
      const uploaded = await uploadFile({
        boardId,
        context,
        file: {
          uri: asset.uri,
          name: asset.fileName ?? getImageName(asset.uri),
          type: asset.mimeType ?? getImageType(asset.uri),
          size: asset.fileSize,
        },
      });

      onChange(getStoredUploadValueFromUploadedFile(uploaded));
    } catch {
      // The hook maps the error to localError through callbacks.
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        disabled={isUploading}
        onPress={pickImage}
        style={({ pressed }) => [
          styles.picker,
          pressed && !isUploading ? styles.pressed : null,
        ]}
      >
        {previewUrl ? (
          <Image contentFit="cover" source={{ uri: previewUrl }} style={styles.image} />
        ) : (
          <View style={styles.emptyState}>
            {isUploading ? (
              <ActivityIndicator color={colors.accentPrimary} size="small" />
            ) : (
              <Ionicons color={colors.textMuted} name="image-outline" size={24} />
            )}
            <Text numberOfLines={2} style={styles.label}>
              {isUploading ? "Subiendo" : label}
            </Text>
          </View>
        )}
      </Pressable>

      {previewUrl ? (
        <View style={styles.actions}>
          <Pressable
            disabled={isUploading}
            onPress={pickImage}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && !isUploading ? styles.pressed : null,
            ]}
          >
            {isUploading ? (
              <ActivityIndicator color={colors.textPrimary} size="small" />
            ) : (
              <Ionicons color={colors.textPrimary} name="pencil" size={16} />
            )}
          </Pressable>
          <Pressable
            disabled={isUploading}
            onPress={() => onChange("")}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && !isUploading ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="close" size={18} />
          </Pressable>
        </View>
      ) : null}

      {localError ? <Text style={styles.error}>{localError}</Text> : null}
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>["colors"],
  size: number,
  fullWidth: boolean,
) {
  return StyleSheet.create({
    actionButton: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    actions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
    },
    container: {
      alignItems: "center",
      alignSelf: fullWidth ? "stretch" : "flex-start",
    },
    emptyState: {
      alignItems: "center",
      gap: 6,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    error: {
      color: "#fb7185",
      fontSize: 12,
      marginTop: 8,
      maxWidth: fullWidth ? "100%" : size + 48,
      textAlign: "center",
    },
    image: {
      height: "100%",
      width: "100%",
    },
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 14,
      textAlign: "center",
    },
    picker: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 18,
      borderStyle: "dashed",
      borderWidth: 1,
      height: size,
      justifyContent: "center",
      overflow: "hidden",
      width: fullWidth ? "100%" : size,
    },
    pressed: {
      opacity: 0.88,
    },
  });
}
