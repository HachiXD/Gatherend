import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCreatePost } from "@/src/features/forum/hooks/use-create-post";
import type { UploadedFile } from "@/src/features/uploads/domain/uploaded-file";
import { useUpload } from "@/src/features/uploads/hooks/use-upload";
import { Text, TextInput } from "@/src/components/app-typography";
import { useTheme } from "@/src/theme/theme-provider";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function getImageName(uri: string) {
  const clean = uri.split("?")[0] ?? uri;
  return clean.split("/").pop() || `image-${Date.now()}.jpg`;
}

function getImageType(uri: string) {
  const ext = uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  return "image/jpeg";
}

const MAX_TITLE = 200;
const MAX_CONTENT = 2000;

export default function CreatePostModalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();

  const createPostMutation = useCreatePost(boardId ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imagePreview, setImagePreview] = useState<UploadedFile | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { uploadFile, isUploading } = useUpload({
    onUploadError: setUploadError,
    onModerationBlock: setUploadError,
  });

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (!boardId) {
    return <Redirect href="/boards" />;
  }

  const isSubmitting = createPostMutation.isPending;
  const isBusy = isSubmitting || isUploading;
  const canSubmit =
    !isBusy && (content.trim().length > 0 || imagePreview !== null);

  const handlePublish = async () => {
    if (!canSubmit) return;
    try {
      await createPostMutation.mutateAsync({
        boardId,
        title: title.trim() || null,
        content: content.trim() || null,
        imageAssetId: imagePreview?.assetId ?? null,
      });
      router.back();
    } catch {
      // error exposed via mutation.error
    }
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handlePickImage = useCallback(async () => {
    if (isBusy) return;
    setUploadError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError("Permiso de galería requerido.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ["images"],
      quality: 0.9,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.uri) {
      setUploadError("No se pudo leer la imagen.");
      return;
    }

    if (
      typeof asset.fileSize === "number" &&
      asset.fileSize > MAX_IMAGE_BYTES
    ) {
      setUploadError(
        `La imagen supera el límite de ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
      );
      return;
    }

    try {
      const uploaded = await uploadFile({
        boardId,
        context: "community_post_image",
        file: {
          uri: asset.uri,
          name: asset.fileName ?? getImageName(asset.uri),
          type: asset.mimeType ?? getImageType(asset.uri),
          size: asset.fileSize,
        },
      });
      setImagePreview(uploaded);
    } catch {
      // forwarded via onUploadError
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, isBusy, uploadFile]);

  const errorMessage =
    uploadError ??
    (createPostMutation.error instanceof Error
      ? createPostMutation.error.message
      : null);

  return (
    <SafeAreaView
      style={styles.root}
      edges={["top", "bottom", "left", "right"]}
    >
      {/* Header */}
      <View
        style={[styles.header, { borderBottomColor: colors.borderPrimary }]}
      >
        <View style={styles.headerLeftGroup}>
          <Pressable
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.textMuted} name="close" size={22} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Crear post
          </Text>
        </View>
        <Pressable
          disabled={!canSubmit}
          onPress={() => {
            void handlePublish();
          }}
          style={({ pressed }) => [
            styles.headerButton,
            !canSubmit ? styles.disabledButton : null,
            pressed && canSubmit ? styles.pressed : null,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.accentPrimary} size="small" />
          ) : (
            <Text
              style={[
                styles.headerAction,
                styles.headerActionPublish,
                { color: colors.accentPrimary },
                !canSubmit ? styles.disabledButton : null,
              ]}
            >
              Publicar
            </Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : keyboardVisible
              ? "height"
              : undefined
        }
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.body}
        >
          {/* Title input */}
          <View style={styles.titleRow}>
            <TextInput
              editable={!isBusy}
              maxLength={MAX_TITLE}
              onChangeText={setTitle}
              placeholder="Título (opcional)"
              placeholderTextColor={colors.textTertiary}
              style={[styles.titleInput, { color: colors.textPrimary }]}
              value={title}
              returnKeyType="next"
            />
          </View>

          {/* Content input */}
          <View style={styles.composerRow}>
            <TextInput
              editable={!isBusy}
              maxLength={MAX_CONTENT}
              multiline
              onChangeText={setContent}
              placeholder="¿Qué quieres compartir?"
              placeholderTextColor={colors.textTertiary}
              scrollEnabled={false}
              style={[styles.input, { color: colors.textPrimary }]}
              textAlignVertical="top"
              value={content}
            />
          </View>

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
        </ScrollView>

        {/* Bottom area */}
        <View style={styles.bottomArea}>
          {imagePreview ? (
            <View
              style={[
                styles.filePreview,
                {
                  backgroundColor: colors.bgTertiary,
                  borderColor: colors.borderPrimary,
                },
              ]}
            >
              <Image
                contentFit="cover"
                source={{ uri: imagePreview.url }}
                style={styles.filePreviewImage}
              />
              <View style={styles.filePreviewCopy}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.filePreviewName,
                    { color: colors.textPrimary },
                  ]}
                >
                  {imagePreview.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.filePreviewMeta, { color: colors.textMuted }]}
                >
                  Imagen · {Math.max(1, Math.round(imagePreview.size / 1024))}{" "}
                  KB
                </Text>
              </View>
              <Pressable
                disabled={isBusy}
                onPress={() => setImagePreview(null)}
                style={({ pressed }) => [
                  styles.filePreviewRemoveButton,
                  pressed && !isBusy ? styles.pressed : null,
                ]}
              >
                <Ionicons color={colors.textMuted} name="close" size={19} />
              </Pressable>
            </View>
          ) : null}

          <View
            style={[styles.footer, { borderTopColor: colors.borderPrimary }]}
          >
            <View style={styles.footerActions}>
              <Pressable
                disabled={isBusy}
                onPress={() => {
                  void handlePickImage();
                }}
                style={({ pressed }) => [
                  styles.footerIconButton,
                  isBusy ? styles.disabledButton : null,
                  pressed && !isBusy ? styles.pressed : null,
                ]}
              >
                {isUploading ? (
                  <ActivityIndicator color={colors.textMuted} size="small" />
                ) : (
                  <Ionicons
                    color={colors.textMuted}
                    name="image-outline"
                    size={21}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    root: {
      backgroundColor: colors.bgPrimary,
      flex: 1,
    },
    flex: {
      flex: 1,
    },
    body: {
      flex: 1,
      minHeight: 0,
    },
    bodyContent: {
      flexGrow: 1,
    },
    bottomArea: {
      paddingBottom: 2,
    },
    // Header
    header: {
      alignItems: "center",
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerLeftGroup: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minWidth: 0,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "600",
    },
    closeButton: {
      alignItems: "center",
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    headerButton: {
      minWidth: 70,
      paddingVertical: 4,
    },
    headerAction: {
      fontSize: 15,
    },
    headerActionPublish: {
      fontWeight: "600",
      textAlign: "right",
    },
    // Body inputs
    titleRow: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 0,
    },
    titleInput: {
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 28,
    },
    composerRow: {
      paddingHorizontal: 16,
      paddingTop: 0,
      paddingBottom: 16,
    },
    input: {
      fontSize: 15,
      lineHeight: 22,
      minHeight: 120,
    },
    errorText: {
      color: "#fca5a5",
      fontSize: 13,
      lineHeight: 19,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    // Image preview
    filePreview: {
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      marginHorizontal: 10,
      marginBottom: 8,
      overflow: "hidden",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    filePreviewImage: {
      borderRadius: 6,
      height: 44,
      width: 44,
    },
    filePreviewCopy: {
      flex: 1,
      gap: 2,
    },
    filePreviewName: {
      fontSize: 13,
      fontWeight: "600",
    },
    filePreviewMeta: {
      fontSize: 12,
    },
    filePreviewRemoveButton: {
      alignItems: "center",
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    // Footer
    footer: {
      borderTopWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    footerActions: {
      flexDirection: "row",
      gap: 4,
    },
    footerIconButton: {
      alignItems: "center",
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    // Shared states
    pressed: {
      opacity: 0.6,
    },
    disabledButton: {
      opacity: 0.4,
    },
  });
}
