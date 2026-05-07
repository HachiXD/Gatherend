import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInput as NativeTextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput } from "@/src/components/app-typography";
import { UserAvatar } from "@/src/components/user-avatar";
import type { UploadedFile } from "@/src/features/uploads/domain/uploaded-file";
import { useUpload } from "@/src/features/uploads/hooks/use-upload";
import { useTheme } from "@/src/theme/theme-provider";
import type { ForumPost, ForumPostComment } from "../domain/post";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type ComposerMode = "create-comment" | "edit-post" | "edit-comment";

type PostCommentComposerModalProps = {
  visible: boolean;
  onClose: () => void;
  postId: string;
  isSubmitting: boolean;
  onSubmit?: (
    postId: string,
    content: string,
    imageAssetId?: string | null,
  ) => void;
  post: ForumPost;
  replyToComment?: ForumPostComment | null;
  openImagePickerOnShow?: boolean;
  onImagePickerOpened?: () => void;
  mode?: ComposerMode;
  initialContent?: string;
  canSubmitEmptyContent?: boolean;
  onEditSubmit?: (content: string) => void;
};

export function PostCommentComposerModal({
  visible,
  onClose,
  postId,
  isSubmitting,
  onSubmit,
  post,
  replyToComment,
  openImagePickerOnShow = false,
  onImagePickerOpened,
  mode = "create-comment",
  initialContent = "",
  canSubmitEmptyContent = false,
  onEditSubmit,
}: PostCommentComposerModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const inputRef = useRef<NativeTextInput>(null);
  const imagePickerRequestHandledRef = useRef(false);
  const [content, setContent] = useState("");
  const [filePreview, setFilePreview] = useState<UploadedFile | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const { uploadFile, isUploading } = useUpload({
    onUploadError: setLocalError,
    onModerationBlock: setLocalError,
  });

  const isEditing = mode !== "create-comment";
  const isReplying = !isEditing && Boolean(replyToComment);
  const title =
    mode === "edit-post"
      ? "Editar post"
      : mode === "edit-comment"
        ? "Editar comentario"
        : isReplying
          ? "Responder"
          : "Comentar";
  const isBusy = isSubmitting || isUploading;
  const canSubmit =
    (content.trim().length > 0 ||
      (!isEditing && Boolean(filePreview)) ||
      (isEditing && canSubmitEmptyContent)) &&
    !isBusy;

  useEffect(() => {
    if (visible && !openImagePickerOnShow) {
      // Small delay so modal animation completes before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [openImagePickerOnShow, visible]);

  useEffect(() => {
    if (!visible) return;

    setContent(isEditing ? initialContent : "");
    setFilePreview(null);
    setLocalError(null);
  }, [initialContent, isEditing, visible]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  function handleClose() {
    setContent("");
    setFilePreview(null);
    setLocalError(null);
    onClose();
  }

  function handleSubmit() {
    if (!canSubmit) return;

    if (isEditing) {
      onEditSubmit?.(content.trim());
    } else {
      onSubmit?.(postId, content.trim(), filePreview?.assetId ?? null);
    }

    setContent("");
    setFilePreview(null);
    setLocalError(null);
    onClose();
  }

  const handlePickImage = useCallback(async () => {
    if (isEditing) return;
    if (isBusy) return;
    setLocalError(null);

    if (filePreview) {
      setLocalError("Solo puedes adjuntar una imagen por comentario.");
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ["image/*"],
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.uri) {
      setLocalError("No se pudo leer el archivo.");
      return;
    }

    if (typeof asset.size === "number" && asset.size > MAX_UPLOAD_BYTES) {
      setLocalError(
        `La imagen supera el límite de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      );
      return;
    }

    try {
      const uploaded = await uploadFile({
        context: "community_post_comment_image",
        file: {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? "image/jpeg",
          size: asset.size,
        },
      });
      setFilePreview(uploaded);
    } catch {
      // error forwarded via onUploadError callback
    }
  }, [filePreview, isBusy, isEditing, uploadFile]);

  useEffect(() => {
    if (isEditing) return;
    if (!visible || !openImagePickerOnShow) return;
    if (imagePickerRequestHandledRef.current) return;

    imagePickerRequestHandledRef.current = true;
    const t = setTimeout(() => {
      onImagePickerOpened?.();
      void handlePickImage();
    }, 250);

    return () => clearTimeout(t);
  }, [
    handlePickImage,
    isEditing,
    onImagePickerOpened,
    openImagePickerOnShow,
    visible,
  ]);

  useEffect(() => {
    if (!visible || !openImagePickerOnShow) {
      imagePickerRequestHandledRef.current = false;
    }
  }, [openImagePickerOnShow, visible]);

  const previewAuthor = isReplying
    ? replyToComment!.author.username
    : post.author.username;

  const previewText = isReplying
    ? replyToComment!.content
    : (post.title ?? post.content);

  const previewAvatarUrl = isReplying
    ? replyToComment!.author.avatarAsset?.url
    : post.author.avatarAsset?.url;

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[styles.root, { backgroundColor: colors.bgPrimary }]}
      >
        {/* Header */}
        <View
          style={[styles.header, { borderBottomColor: colors.borderPrimary }]}
        >
          <View style={styles.headerLeftGroup}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons color={colors.textMuted} name="close" size={22} />
            </Pressable>

            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {title}
            </Text>
          </View>

          <Pressable
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.headerButton,
              !canSubmit && styles.disabledButton,
              pressed && canSubmit && styles.pressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.accentPrimary} size="small" />
            ) : (
              <Text
                style={[
                  styles.headerAction,
                  styles.headerActionSend,
                  { color: colors.accentPrimary },
                ]}
              >
                {isEditing ? "Guardar" : "Enviar"}
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
            style={styles.body}
          >
            {!isEditing ? (
              <View
                style={[
                  styles.previewSection,
                  { borderBottomColor: colors.borderPrimary },
                ]}
              >
                <View style={styles.previewRow}>
                  <UserAvatar
                    avatarUrl={previewAvatarUrl}
                    username={previewAuthor}
                    size={32}
                  />
                  <View style={styles.previewContent}>
                    <Text
                      style={[
                        styles.previewAuthor,
                        { color: colors.textMuted },
                      ]}
                    >
                      {previewAuthor}
                    </Text>
                    <Text
                      numberOfLines={3}
                      style={[
                        styles.previewText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {previewText}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.replyLine,
                      { backgroundColor: colors.borderPrimary },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            {/* Composer */}
            <View style={styles.composerRow}>
              <TextInput
                ref={inputRef}
                value={content}
                onChangeText={setContent}
                placeholder={
                  mode === "edit-post"
                    ? "Editar post..."
                    : mode === "edit-comment"
                      ? "Editar comentario..."
                      : isReplying
                        ? `Responder a ${previewAuthor}...`
                        : "Escribe un comentario..."
                }
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary }]}
                multiline
                scrollEnabled={false}
                preventTransientVerticalScroll
                editable={!isBusy}
                returnKeyType="default"
                autoFocus={false}
              />
            </View>

            {localError ? (
              <Text style={styles.errorText}>{localError}</Text>
            ) : null}
          </ScrollView>

          {!isEditing ? (
            <View style={styles.bottomArea}>
              {filePreview ? (
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
                    source={{ uri: filePreview.url }}
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
                      {filePreview.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.filePreviewMeta,
                        { color: colors.textMuted },
                      ]}
                    >
                      Imagen ·{" "}
                      {Math.max(1, Math.round(filePreview.size / 1024))} KB
                    </Text>
                  </View>
                  <Pressable
                    disabled={isBusy}
                    onPress={() => setFilePreview(null)}
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
                style={[
                  styles.footer,
                  { borderTopColor: colors.borderPrimary },
                ]}
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
                      <ActivityIndicator
                        color={colors.textMuted}
                        size="small"
                      />
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
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    root: {
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
    headerActionSend: {
      fontWeight: "600",
      textAlign: "right",
    },
    previewSection: {
      borderBottomWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    previewRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    previewContent: {
      flex: 1,
      gap: 3,
    },
    previewAuthor: {
      fontSize: 15,
      fontWeight: "600",
    },
    previewText: {
      fontSize: 15,
      lineHeight: 20,
    },
    replyLine: {
      bottom: 0,
      left: 29,
      position: "absolute",
      top: 36,
      width: 1,
    },
    composerRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      flexGrow: 1,
      minHeight: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    input: {
      flex: 1,
      fontSize: 15,

      lineHeight: 22,
      minHeight: 0,
      paddingBottom: 12,
      paddingTop: 4,
      textAlignVertical: "top",
    },
    errorText: {
      color: "#fb7185",
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 16,
      paddingTop: 6,
    },
    filePreview: {
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      marginHorizontal: 10,
      marginTop: 10,
      marginBottom: 10,
      minHeight: 56,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    filePreviewImage: {
      borderRadius: 8,
      height: 40,
      width: 40,
    },
    filePreviewCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    filePreviewName: {
      fontSize: 13,
      fontWeight: "700",
    },
    filePreviewMeta: {
      fontSize: 12,
    },
    filePreviewRemoveButton: {
      alignItems: "center",
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    footer: {
      borderTopWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    footerActions: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "flex-end",
    },
    footerIconButton: {
      alignItems: "center",
      borderRadius: 10,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    disabledButton: {
      opacity: 0.4,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
