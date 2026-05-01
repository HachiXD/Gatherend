import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
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

type AttachmentUploadPickerProps = {
  context: Extract<UploadContext, "message_attachment" | "dm_attachment">;
  value: string;
  onChange: (value: string) => void;
  boardId?: string;
  label?: string;
};

function isImage(type?: string, url?: string) {
  if (type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(url?.split("?")[0] ?? "");
}

function formatSize(size?: number) {
  if (!size) return null;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentUploadPicker({
  context,
  value,
  onChange,
  boardId,
  label = "Adjuntar archivo",
}: AttachmentUploadPickerProps) {
  const { colors } = useTheme();
  const [localError, setLocalError] = useState<string | null>(null);
  const fileData = parseStoredUploadValue(value);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { uploadFile, isUploading } = useUpload({
    onUploadError: setLocalError,
    onModerationBlock: setLocalError,
  });

  async function pickAttachment() {
    setLocalError(null);

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ["image/*", "application/pdf"],
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    if (!asset?.uri) {
      setLocalError("No se pudo leer el archivo.");
      return;
    }

    try {
      const uploaded = await uploadFile({
        boardId,
        context,
        file: {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? "application/octet-stream",
          size: asset.size,
        },
      });

      onChange(getStoredUploadValueFromUploadedFile(uploaded));
    } catch {
      // The hook maps the error to localError through callbacks.
    }
  }

  return (
    <View style={styles.container}>
      {fileData ? (
        <View style={styles.previewRow}>
          {isImage(fileData.type, fileData.url) ? (
            <Image
              contentFit="cover"
              source={{ uri: fileData.url }}
              style={styles.previewImage}
            />
          ) : (
            <View style={styles.fileIcon}>
              <Ionicons
                color={colors.textMuted}
                name="document-text-outline"
                size={22}
              />
            </View>
          )}

          <View style={styles.fileMeta}>
            <Text numberOfLines={1} style={styles.fileName}>
              {fileData.name || "Archivo adjunto"}
            </Text>
            <Text numberOfLines={1} style={styles.fileDetails}>
              {fileData.type || "Archivo"}
              {formatSize(fileData.size) ? ` · ${formatSize(fileData.size)}` : ""}
            </Text>
          </View>

          <Pressable
            disabled={isUploading}
            onPress={() => onChange("")}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && !isUploading ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="close" size={18} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          disabled={isUploading}
          onPress={pickAttachment}
          style={({ pressed }) => [
            styles.attachButton,
            pressed && !isUploading ? styles.pressed : null,
          ]}
        >
          {isUploading ? (
            <ActivityIndicator color={colors.accentPrimary} size="small" />
          ) : (
            <Ionicons color={colors.textPrimary} name="attach-outline" size={19} />
          )}
          <Text style={styles.attachLabel}>
            {isUploading ? "Subiendo" : label}
          </Text>
        </Pressable>
      )}

      {fileData ? (
        <Pressable
          disabled={isUploading}
          onPress={pickAttachment}
          style={({ pressed }) => [
            styles.replaceButton,
            pressed && !isUploading ? styles.pressed : null,
          ]}
        >
          {isUploading ? (
            <ActivityIndicator color={colors.textMuted} size="small" />
          ) : (
            <Ionicons color={colors.textMuted} name="swap-horizontal" size={16} />
          )}
          <Text style={styles.replaceText}>Cambiar archivo</Text>
        </Pressable>
      ) : null}

      {localError ? <Text style={styles.error}>{localError}</Text> : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    attachButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      minHeight: 42,
      paddingHorizontal: 12,
    },
    attachLabel: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    container: {
      alignSelf: "stretch",
    },
    error: {
      color: "#fb7185",
      fontSize: 12,
      marginTop: 8,
    },
    fileDetails: {
      color: colors.textMuted,
      fontSize: 12,
    },
    fileIcon: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      borderRadius: 10,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    fileMeta: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    fileName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    iconButton: {
      alignItems: "center",
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    pressed: {
      opacity: 0.88,
    },
    previewImage: {
      backgroundColor: colors.bgQuaternary,
      borderRadius: 10,
      height: 42,
      width: 42,
    },
    previewRow: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      minHeight: 58,
      paddingHorizontal: 8,
    },
    replaceButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: 6,
      marginTop: 8,
      minHeight: 32,
    },
    replaceText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
  });
}

