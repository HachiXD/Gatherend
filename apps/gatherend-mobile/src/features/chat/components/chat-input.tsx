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
  type TextLayoutEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createTempId,
  useSendChannelMessage,
} from "../hooks/use-send-channel-message";
import type { ChatMessage } from "../chat-message";
import { getMessageAuthor } from "../utils/message-author";
import {
  createTempDirectMessageId,
  useSendDirectMessage,
} from "@/src/features/conversations/hooks/use-send-direct-message";
import { useUpload } from "@/src/features/uploads/hooks/use-upload";
import type { UploadedFile } from "@/src/features/uploads/domain/uploaded-file";
import { useTheme } from "@/src/theme/theme-provider";
import type { ClientSticker } from "../types";
import { Text, TextInput } from "@/src/components/app-typography";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MIN_INPUT_HEIGHT = 42;
const MAX_INPUT_HEIGHT = 120;
const MAX_MESSAGE_LENGTH = 2000;
const MULTILINE_VERTICAL_PADDING = 12;
const INPUT_LINE_HEIGHT = 20;

export type ChatInputHandle = {
  sendSticker: (sticker: ClientSticker) => void;
  appendEmoji: (emoji: string) => void;
};

type ChatInputContext =
  | {
      type: "channel";
      boardId: string;
      channelId: string;
    }
  | {
      type: "conversation";
      conversationId: string;
    };

type ChatInputProps = {
  context: ChatInputContext;
  windowKey: string;
  disabled?: boolean;
  onStickerPickerPress?: () => void;
  onEmojiPickerPress?: () => void;
  onInputFocus?: () => void;
  isComposerCompact?: boolean;
  bottomInset?: number;
  replyTo?: ChatMessage | null;
  onClearReply?: () => void;
};

function isImageFile(file: UploadedFile) {
  return file.type.startsWith("image/");
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    {
      context,
      windowKey,
      disabled = false,
      onStickerPickerPress,
      onEmojiPickerPress,
      onInputFocus,
      isComposerCompact = false,
      bottomInset,
      replyTo = null,
      onClearReply,
    },
    ref,
  ) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const inputRef = useRef<NativeTextInput>(null);
    const contentRef = useRef("");
    const inputHeightRef = useRef(MIN_INPUT_HEIGHT);
    const [content, setContent] = useState("");
    const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
    const [filePreview, setFilePreview] = useState<UploadedFile | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);

    const sendChannelMessageMutation = useSendChannelMessage(windowKey);
    const sendDirectMessageMutation = useSendDirectMessage(windowKey);
    const { uploadFile, isUploading } = useUpload({
      onUploadError: setLocalError,
      onModerationBlock: setLocalError,
    });

    const trimmedContent = content.trim();
    const sendMessageMutation =
      context.type === "channel"
        ? sendChannelMessageMutation
        : sendDirectMessageMutation;
    const isBusy = disabled || isUploading || sendMessageMutation.isPending;
    const canSend =
      !isBusy && (trimmedContent.length > 0 || Boolean(filePreview));
    const resolvedBottomInset = bottomInset ?? insets.bottom;
    const bottomPadding = isComposerCompact ? 8 : 10 + resolvedBottomInset;

    function setMeasuredInputHeight(nextHeight: number) {
      inputHeightRef.current = nextHeight;
      setInputHeight(nextHeight);
    }

    function updateContent(nextContent: string) {
      contentRef.current = nextContent;
      setContent(nextContent);

      if (nextContent.length === 0) {
        setMeasuredInputHeight(MIN_INPUT_HEIGHT);
      }
    }

    useImperativeHandle(ref, () => ({
      sendSticker: handleStickerSubmit,
      appendEmoji: (emoji) => updateContent(contentRef.current + emoji),
    }));

    function handleMirrorTextLayout(event: TextLayoutEvent) {
      const lineCount = Math.max(1, event.nativeEvent.lines.length);
      const nextHeight =
        lineCount <= 1
          ? MIN_INPUT_HEIGHT
          : Math.min(
              MAX_INPUT_HEIGHT,
              Math.max(
                MIN_INPUT_HEIGHT,
                lineCount * INPUT_LINE_HEIGHT + MULTILINE_VERTICAL_PADDING,
              ),
            );

      if (nextHeight !== inputHeightRef.current) {
        setMeasuredInputHeight(nextHeight);
      }
    }

    async function pickAttachment() {
      if (isBusy) return;

      setLocalError(null);

      if (filePreview) {
        setLocalError("Solo puedes adjuntar un archivo por mensaje.");
        return;
      }

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

      if (typeof asset.size === "number" && asset.size > MAX_UPLOAD_BYTES) {
        setLocalError(
          `El archivo supera el limite de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
        );
        return;
      }

      try {
        const uploaded = await uploadFile({
          boardId: context.type === "channel" ? context.boardId : undefined,
          context:
            context.type === "channel" ? "message_attachment" : "dm_attachment",
          file: {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType ?? "application/octet-stream",
            size: asset.size,
          },
        });

        setFilePreview(uploaded);
      } catch {
        // The hook maps the error to localError through callbacks.
      }
    }

    async function handleSend() {
      if (!canSend) return;

      const attachment = filePreview;
      const contentToSend = trimmedContent || attachment?.name || "";

      updateContent("");
      setMeasuredInputHeight(MIN_INPUT_HEIGHT);
      setFilePreview(null);
      setLocalError(null);
      onClearReply?.();

      try {
        if (context.type === "channel") {
          await sendChannelMessageMutation.mutateAsync({
            boardId: context.boardId,
            channelId: context.channelId,
            content: contentToSend,
            tempId: createTempId(),
            attachmentAssetId: attachment?.assetId,
            replyToMessageId: replyTo?.id,
          });
        } else {
          await sendDirectMessageMutation.mutateAsync({
            conversationId: context.conversationId,
            content: contentToSend,
            tempId: createTempDirectMessageId(),
            attachmentAssetId: attachment?.assetId,
          });
        }
      } catch (error) {
        updateContent(contentToSend);
        setFilePreview(attachment ?? null);
        setLocalError(
          error instanceof Error
            ? error.message
            : "No se pudo enviar el mensaje.",
        );
      }
    }

    async function handleStickerSubmit(sticker: ClientSticker) {
      setLocalError(null);

      try {
        if (context.type === "channel") {
          await sendChannelMessageMutation.mutateAsync({
            boardId: context.boardId,
            channelId: context.channelId,
            content: "",
            tempId: createTempId(),
            sticker,
          });
        } else {
          await sendDirectMessageMutation.mutateAsync({
            conversationId: context.conversationId,
            content: "",
            tempId: createTempDirectMessageId(),
            sticker,
          });
        }
      } catch {
        setLocalError("No se pudo enviar el sticker.");
      }
    }

    const replyAuthor = replyTo ? getMessageAuthor(replyTo) : null;

    return (
      <View style={[styles.container, { paddingBottom: bottomPadding }]}>
        {replyTo ? (
          <View
            style={[
              styles.replyPreview,
              {
                backgroundColor: colors.bgTertiary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            <View style={styles.replyPreviewCopy}>
              <Text
                numberOfLines={1}
                style={[styles.replyPreviewAuthor, { color: colors.accentPrimary }]}
              >
                {replyAuthor?.username ?? "Usuario"}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.replyPreviewText, { color: colors.textMuted }]}
              >
                {(replyTo as { content?: string }).content?.trim() || "Mensaje"}
              </Text>
            </View>
            <Pressable
              onPress={onClearReply}
              style={({ pressed }) => [
                styles.previewRemoveButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Ionicons color={colors.textMuted} name="close" size={17} />
            </Pressable>
          </View>
        ) : null}

        {filePreview ? (
          <View style={styles.preview}>
            {isImageFile(filePreview) ? (
              <Image
                contentFit="cover"
                source={{ uri: filePreview.url }}
                style={styles.previewImage}
              />
            ) : (
              <View style={styles.previewIcon}>
                <Ionicons
                  color={colors.textMuted}
                  name="document-text-outline"
                  size={24}
                />
              </View>
            )}

            <View style={styles.previewCopy}>
              <Text numberOfLines={1} style={styles.previewName}>
                {filePreview.name}
              </Text>
              <Text numberOfLines={1} style={styles.previewMeta}>
                {isImageFile(filePreview) ? "Imagen" : "PDF"} ·{" "}
                {formatFileSize(filePreview.size)}
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
          <Pressable
            disabled={isBusy || Boolean(filePreview)}
            onPress={() => {
              void pickAttachment();
            }}
            style={({ pressed }) => [
              styles.toolButton,
              isBusy || filePreview ? styles.disabledButton : null,
              pressed && !isBusy && !filePreview ? styles.pressed : null,
            ]}
          >
            {isUploading ? (
              <ActivityIndicator color={colors.textSecondary} size="small" />
            ) : (
              <Ionicons color={colors.textSecondary} name="add" size={25} />
            )}
          </Pressable>

          <View style={styles.inputShell}>
            <View style={[styles.inputTextArea, { height: inputHeight }]}>
              <TextInput
                ref={inputRef}
                editable={!disabled}
                maxLength={MAX_MESSAGE_LENGTH}
                multiline
                onChangeText={updateContent}
                onFocus={onInputFocus}
                placeholder="Mensaje"
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  inputHeight <= MIN_INPUT_HEIGHT
                    ? styles.inputSingleLine
                    : styles.inputMultiline,
                  { height: inputHeight },
                ]}
                textAlignVertical={
                  inputHeight <= MIN_INPUT_HEIGHT ? "center" : "top"
                }
                value={content}
              />
              <Text
                onTextLayout={handleMirrorTextLayout}
                style={[styles.input, styles.inputMirror]}
              >
                {content.length > 0 ? `${content}\u200B` : " "}
              </Text>
            </View>

            <View style={styles.inputActions}>
              <Pressable
                onPress={onStickerPickerPress}
                style={({ pressed }) => [
                  styles.inputActionButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={colors.textMuted}
                  name="sticker-outline"
                  size={20}
                />
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

          <Pressable
            disabled={!canSend}
            onPress={() => {
              void handleSend();
            }}
            style={({ pressed }) => [
              styles.sendButton,
              !canSend ? styles.disabledButton : null,
              pressed && canSend ? styles.pressed : null,
            ]}
          >
            {sendMessageMutation.isPending ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Ionicons color={colors.textSecondary} name="send" size={19} />
            )}
          </Pressable>
        </View>
      </View>
    );
  },
);

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.bgSecondary,

      gap: 7,
      paddingBottom: 10,
      paddingHorizontal: 10,
      paddingTop: 8,
    },
    disabledButton: {
      opacity: 0.5,
    },
    errorText: {
      color: "#fb7185",
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 4,
    },
    input: {
      color: colors.textSecondary,
      fontSize: 15,
      includeFontPadding: false,
      lineHeight: 20,
      paddingHorizontal: 11,
      paddingBottom: 0,
      paddingTop: 0,
      width: "100%",
    },
    inputSingleLine: {
      paddingBottom: 0,
      paddingTop: 0,
    },
    inputMirror: {
      color: "transparent",
      left: 0,
      opacity: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    inputMultiline: {
      paddingBottom: 6,
      paddingTop: 6,
    },
    inputRow: {
      alignItems: "stretch",
      flexDirection: "row",
      gap: 6,
      minHeight: MIN_INPUT_HEIGHT,
    },
    inputActions: {
      alignSelf: "center",
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 0,
      gap: 2,
      paddingBottom: 0,
      paddingRight: 5,
    },
    inputActionButton: {
      alignItems: "center",
      borderRadius: 8,
      height: 30,
      justifyContent: "center",
      width: 30,
    },
    inputShell: {
      alignItems: "flex-end",
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 11,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      minHeight: MIN_INPUT_HEIGHT,
      overflow: "hidden",
    },
    inputTextArea: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      overflow: "hidden",
    },
    pressed: {
      opacity: 0.88,
    },
    preview: {
      alignItems: "center",
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      minHeight: 64,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    previewCopy: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    previewIcon: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      borderRadius: 10,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    previewImage: {
      backgroundColor: colors.bgQuaternary,
      borderRadius: 10,
      height: 46,
      width: 46,
    },
    previewMeta: {
      color: colors.textMuted,
      fontSize: 12,
    },
    previewName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    previewRemoveButton: {
      alignItems: "center",
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    replyPreview: {
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    replyPreviewCopy: {
      flex: 1,
      gap: 1,
      minWidth: 0,
    },
    replyPreviewAuthor: {
      fontSize: 12,
      fontWeight: "700",
    },
    replyPreviewText: {
      fontSize: 12,
    },
    sendButton: {
      alignItems: "center",
      alignSelf: "stretch",
      backgroundColor: colors.buttonPrimary,
      borderRadius: 11,
      justifyContent: "center",
      minHeight: MIN_INPUT_HEIGHT,
      width: 42,
    },
    toolButton: {
      alignItems: "center",
      alignSelf: "stretch",
      backgroundColor: colors.bgSecondary,
      borderColor: colors.borderPrimary,
      borderRadius: 11,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: MIN_INPUT_HEIGHT,
      width: 42,
    },
  });
}
