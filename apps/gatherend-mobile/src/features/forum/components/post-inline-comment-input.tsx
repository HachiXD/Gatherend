import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type TextInput as NativeTextInput,
} from "react-native";
import { UserAvatar } from "@/src/components/user-avatar";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useTheme } from "@/src/theme/theme-provider";
import { Text, TextInput } from "@/src/components/app-typography";
import { useUpload } from "@/src/features/uploads/hooks/use-upload";
import type { UploadedFile } from "@/src/features/uploads/domain/uploaded-file";

const MIN_INPUT_HEIGHT = 42;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type PostInlineCommentInputHandle = {
  appendEmoji: (emoji: string) => void;
};

type PostInlineCommentInputProps = {
  postId: string;
  isSubmitting: boolean;
  onSubmit: (
    postId: string,
    content: string,
    imageAssetId?: string | null,
  ) => void;
  onEmojiPickerPress?: () => void;
  onInputFocus?: () => void;
};

export const PostInlineCommentInput = forwardRef<
  PostInlineCommentInputHandle,
  PostInlineCommentInputProps
>(function PostInlineCommentInput(
  { postId, isSubmitting, onSubmit, onEmojiPickerPress, onInputFocus },
  ref,
) {
  const profile = useProfile();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [content, setContent] = useState("");
  const [filePreview, setFilePreview] = useState<UploadedFile | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<NativeTextInput>(null);
  const contentRef = useRef("");

  const { uploadFile, isUploading } = useUpload({
    onUploadError: setLocalError,
    onModerationBlock: setLocalError,
  });

  const isBusy = isSubmitting || isUploading;
  const trimmed = content.trim();
  const canSubmit = (trimmed.length > 0 || Boolean(filePreview)) && !isBusy;

  useImperativeHandle(ref, () => ({
    appendEmoji: (emoji) => {
      const next = contentRef.current + emoji;
      contentRef.current = next;
      setContent(next);
    },
  }));

  function updateContent(next: string) {
    contentRef.current = next;
    setContent(next);
  }

  async function pickAttachment() {
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
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const imageAssetId = filePreview?.assetId ?? null;
    onSubmit(postId, trimmed, imageAssetId);
    updateContent("");
    setFilePreview(null);
    setLocalError(null);
    inputRef.current?.blur();
  }

  return (
    <View style={styles.container}>
      <UserAvatar
        avatarUrl={profile.avatarAsset?.url}
        username={profile.username}
        size={32}
      />

      <View style={styles.composerColumn}>
        {filePreview ? (
          <View
            style={[
              styles.preview,
              {
                backgroundColor: colors.bgTertiary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            <Image
              contentFit="cover"
              source={{ uri: filePreview.url }}
              style={styles.previewImage}
            />
            <View style={styles.previewCopy}>
              <Text
                numberOfLines={1}
                style={[styles.previewName, { color: colors.textPrimary }]}
              >
                {filePreview.name}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.previewMeta, { color: colors.textMuted }]}
              >
                Imagen · {Math.max(1, Math.round(filePreview.size / 1024))} KB
              </Text>
            </View>
            <Pressable
              disabled={isBusy}
              onPress={() => setFilePreview(null)}
              style={({ pressed }) => [
                styles.previewRemoveButton,
                pressed && !isBusy ? styles.pressed : null,
              ]}
            >
              <Ionicons color={colors.textMuted} name="close" size={19} />
            </Pressable>
          </View>
        ) : null}

        {localError ? <Text style={styles.errorText}>{localError}</Text> : null}

        <View style={styles.inputRow}>
          <View
            style={[
              styles.inputShell,
              {
                backgroundColor: colors.bgQuaternary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              value={content}
              onChangeText={updateContent}
              placeholder="Comentar..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.textSecondary }]}
              editable={!isBusy}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              onFocus={onInputFocus}
              blurOnSubmit
            />

            <View style={styles.inputActions}>
              <Pressable
                disabled={isBusy || Boolean(filePreview)}
                onPress={() => {
                  void pickAttachment();
                }}
                style={({ pressed }) => [
                  styles.inputActionButton,
                  isBusy || filePreview ? styles.disabledButton : null,
                  pressed && !isBusy && !filePreview ? styles.pressed : null,
                ]}
              >
                {isUploading ? (
                  <ActivityIndicator color={colors.textMuted} size="small" />
                ) : (
                  <Ionicons
                    color={colors.textMuted}
                    name="image-outline"
                    size={20}
                  />
                )}
              </Pressable>
              <Pressable
                onPress={onEmojiPickerPress}
                style={({ pressed }) => [
                  styles.inputActionButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={colors.textMuted}
                  name="emoticon-outline"
                  size={20}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
});

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    composerColumn: {
      flex: 1,
      gap: 6,
    },
    inputRow: {
      alignItems: "stretch",
      flexDirection: "row",
      gap: 6,
      minHeight: MIN_INPUT_HEIGHT,
    },
    inputShell: {
      alignItems: "center",
      borderRadius: 11,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      minHeight: MIN_INPUT_HEIGHT,
      overflow: "hidden",
    },
    input: {
      flex: 1,
      fontSize: 15,
      includeFontPadding: false,
      lineHeight: 20,
      paddingHorizontal: 11,
      paddingVertical: 0,
    },
    inputActions: {
      alignItems: "center",
      alignSelf: "center",
      flexDirection: "row",
      flexShrink: 0,
      gap: 2,
      paddingRight: 5,
    },
    inputActionButton: {
      alignItems: "center",
      borderRadius: 8,
      height: 30,
      justifyContent: "center",
      width: 30,
    },
    preview: {
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      minHeight: 56,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    previewImage: {
      backgroundColor: colors.bgSecondary,
      borderRadius: 8,
      height: 40,
      width: 40,
    },
    previewCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    previewName: {
      fontSize: 13,
      fontWeight: "700",
    },
    previewMeta: {
      fontSize: 12,
    },
    previewRemoveButton: {
      alignItems: "center",
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    errorText: {
      color: "#fb7185",
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 4,
    },
    disabledButton: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.88,
    },
  });
}
