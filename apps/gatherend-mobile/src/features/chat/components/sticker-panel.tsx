import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useTheme } from "@/src/theme/theme-provider";
import { AnimatedSticker } from "./animated-sticker";
import { useDeleteSticker, useUploadSticker } from "../hooks/use-upload-sticker";
import { useStickers } from "../hooks/use-stickers";
import type { ClientSticker } from "../types";
import { Text } from "@/src/components/app-typography";

const MAX_STICKER_BYTES = 2 * 1024 * 1024;
const NUM_COLUMNS = 3;
const GRID_H_PADDING = 16;
const COL_GAP = 8;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CELL_WIDTH = Math.floor(
  (SCREEN_WIDTH - GRID_H_PADDING * 2 - COL_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS,
);

type StickerPanelProps = {
  profileId: string;
  onSelect: (sticker: ClientSticker) => void;
};

export function StickerPanel({ profileId, onSelect }: StickerPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: stickers, isLoading } = useStickers(profileId);
  const uploadMutation = useUploadSticker(profileId);
  const deleteMutation = useDeleteSticker(profileId);

  async function handleUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso requerido", "Necesitas permitir el acceso a tu galería.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    if (asset.fileSize && asset.fileSize > MAX_STICKER_BYTES) {
      Alert.alert("Archivo demasiado grande", "El sticker no puede superar 2 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("image", {
      uri: asset.uri,
      name: asset.fileName ?? "sticker.png",
      type: asset.mimeType ?? "image/png",
    } as unknown as Blob);

    try {
      await uploadMutation.mutateAsync(formData);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo subir el sticker.",
      );
    }
  }

  function handleLongPress(sticker: ClientSticker) {
    if (sticker.uploaderId !== profileId) return;

    Alert.alert(
      "Eliminar sticker",
      `¿Quieres eliminar "${sticker.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(sticker.id);
            } catch {
              Alert.alert("Error", "No se pudo eliminar el sticker.");
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stickers</Text>
        <Pressable
          disabled={uploadMutation.isPending}
          onPress={() => {
            void handleUpload();
          }}
          style={({ pressed }) => [
            styles.uploadButton,
            pressed ? styles.pressed : null,
          ]}
        >
          {uploadMutation.isPending ? (
            <ActivityIndicator color={colors.textSecondary} size="small" />
          ) : (
            <Ionicons
              color={colors.textSecondary}
              name="add-circle-outline"
              size={22}
            />
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : !stickers?.length ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Sin stickers todavía.{"\n"}Toca + para subir el tuyo.
          </Text>
        </View>
      ) : (
        <FlatList
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.gridContent}
          data={stickers}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => handleLongPress(item)}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                styles.stickerCell,
                pressed ? styles.pressed : null,
              ]}
            >
              <AnimatedSticker size={CELL_WIDTH - 20} sticker={item} />
            </Pressable>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    center: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    gridContent: {
      gap: 8,
      paddingBottom: 24,
      paddingHorizontal: GRID_H_PADDING,
      paddingTop: 12,
    },
    header: {
      alignItems: "center",
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    panel: {
      backgroundColor: colors.bgPrimary,
      flex: 1,
    },
    pressed: {
      opacity: 0.72,
    },
    row: {
      gap: COL_GAP,
    },
    stickerCell: {
      alignItems: "center",
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: "center",
      paddingVertical: 10,
      width: CELL_WIDTH,
    },
    uploadButton: {
      alignItems: "center",
      height: 36,
      justifyContent: "center",
      width: 36,
    },
  });
}
