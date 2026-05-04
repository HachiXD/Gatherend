import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCreateWikiPage } from "@/src/features/wiki/hooks/use-create-wiki-page";
import { ImageUploadPicker } from "@/src/features/uploads/components/image-upload-picker";
import { getStoredUploadAssetId } from "@/src/features/uploads/utils/upload-values";
import { Text, TextInput } from "@/src/components/app-typography";
import { useTheme } from "@/src/theme/theme-provider";

const MAX_TITLE = 200;
const MAX_CONTENT = 5000;

export default function CreateWikiModalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();

  const createMutation = useCreateWikiPage(boardId ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUpload, setImageUpload] = useState("");

  if (!boardId) {
    return <Redirect href="/(app)/(tabs)/boards" />;
  }

  const isSubmitting = createMutation.isPending;
  const canSubmit = !isSubmitting && title.trim().length > 0;

  const handlePublish = async () => {
    if (!canSubmit) return;
    try {
      await createMutation.mutateAsync({
        boardId,
        title: title.trim(),
        content: content.trim() || null,
        imageAssetId: getStoredUploadAssetId(imageUpload),
      });
      router.back();
    } catch {
      // error exposed via mutation.error
    }
  };

  const errorMessage =
    createMutation.error instanceof Error ? createMutation.error.message : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Nueva página</Text>
          <Pressable
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.closeButton,
              pressed ? styles.closeButtonPressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="close" size={20} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Text style={styles.label}>Imagen (opcional)</Text>
            <View style={styles.imagePickerWrap}>
              <ImageUploadPicker
                allowEditing
                boardId={boardId}
                context="wiki_page_image"
                label="Imagen de la página"
                onChange={setImageUpload}
                size={96}
                value={imageUpload}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Título *</Text>
            <TextInput
              editable={!isSubmitting}
              maxLength={MAX_TITLE}
              onChangeText={setTitle}
              placeholder="Nombre de la página..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={title}
            />
            <Text style={styles.helperText}>
              {title.trim().length}/{MAX_TITLE}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Contenido (opcional)</Text>
            <TextInput
              editable={!isSubmitting}
              maxLength={MAX_CONTENT}
              multiline
              numberOfLines={8}
              onChangeText={setContent}
              placeholder="Escribe el contenido de la página..."
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.textarea]}
              textAlignVertical="top"
              value={content}
            />
            <Text style={styles.helperText}>
              {content.length}/{MAX_CONTENT}
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            disabled={!canSubmit}
            onPress={() => {
              void handlePublish();
            }}
            style={({ pressed }) => [
              styles.publishButton,
              !canSubmit ? styles.publishButtonDisabled : null,
              pressed && canSubmit ? styles.buttonPressed : null,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.bgPrimary} size="small" />
            ) : (
              <Text style={styles.publishButtonText}>Publicar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    safeArea: {
      backgroundColor: colors.bgPrimary,
      flex: 1,
    },
    flex: {
      flex: 1,
    },
    header: {
      alignItems: "center",
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 14,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "700",
    },
    closeButton: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 14,
      borderWidth: 1,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    closeButtonPressed: {
      opacity: 0.8,
    },
    scrollContent: {
      gap: 22,
      paddingBottom: 24,
      paddingHorizontal: 20,
      paddingTop: 22,
    },
    field: {
      gap: 8,
    },
    imagePickerWrap: {
      alignItems: "flex-start",
    },
    label: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    input: {
      backgroundColor: colors.bgInput,
      borderColor: colors.borderPrimary,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.textPrimary,
      fontSize: 15,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    textarea: {
      minHeight: 180,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    errorBox: {
      backgroundColor: "rgba(239, 68, 68, 0.12)",
      borderColor: "rgba(248, 113, 113, 0.35)",
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    errorText: {
      color: "#fecaca",
      fontSize: 13,
      lineHeight: 19,
    },
    footer: {
      borderTopColor: colors.borderPrimary,
      borderTopWidth: 1,
      paddingBottom: 20,
      paddingHorizontal: 20,
      paddingTop: 14,
    },
    publishButton: {
      alignItems: "center",
      backgroundColor: colors.textPrimary,
      borderRadius: 18,
      justifyContent: "center",
      minHeight: 52,
      paddingHorizontal: 16,
    },
    publishButtonDisabled: {
      opacity: 0.45,
    },
    publishButtonText: {
      color: colors.bgPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.88,
    },
  });
}
