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
import { useCreateChannel } from "@/src/features/boards/hooks/use-create-channel";
import type { BoardChannelType } from "@/src/features/boards/types/board";
import { ImageUploadPicker } from "@/src/features/uploads/components/image-upload-picker";
import { getStoredUploadAssetId } from "@/src/features/uploads/utils/upload-values";
import { Text, TextInput } from "@/src/components/app-typography";
import { useTheme } from "@/src/theme/theme-provider";

function isValidChannelName(name: string) {
  return name.trim().length >= 1 && name.trim().length <= 50;
}

export default function CreateChannelModalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();

  const createChannelMutation = useCreateChannel();
  const [name, setName] = useState("");
  const [type, setType] = useState<BoardChannelType>("TEXT");
  const [imageUpload, setImageUpload] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  if (!boardId) {
    return <Redirect href="/(app)/(tabs)/boards" />;
  }

  const isSubmitting = createChannelMutation.isPending;
  const canSubmit = isValidChannelName(name) && !isSubmitting;

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setLocalError(null);

    try {
      await createChannelMutation.mutateAsync({
        boardId,
        name: trimmedName,
        type,
        imageAssetId: getStoredUploadAssetId(imageUpload),
      });
      router.back();
    } catch {
      // el error se expone vía mutation.error
    }
  };

  const errorMessage =
    localError ||
    (createChannelMutation.error instanceof Error
      ? createChannelMutation.error.message
      : null);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        {/* Header fijo */}
        <View style={styles.header}>
          <Text style={styles.title}>Crear chat</Text>
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
        >
          {/* Imagen */}
          <View style={styles.field}>
            <Text style={styles.label}>Imagen (opcional)</Text>
            <View style={styles.imagePickerWrap}>
              <ImageUploadPicker
                allowEditing
                context="channel_image"
                boardId={boardId}
                label="Imagen del canal"
                onChange={setImageUpload}
                size={96}
                value={imageUpload}
              />
            </View>
          </View>

          {/* Nombre */}
          <View style={styles.field}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              maxLength={50}
              onChangeText={setName}
              placeholder="Ej. general, anuncios..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={name}
            />
            <Text style={styles.helperText}>{name.trim().length}/50</Text>
          </View>

          {/* Tipo */}
          <View style={styles.field}>
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.typeSegment}>
              <Pressable
                disabled={isSubmitting}
                onPress={() => setType("TEXT")}
                style={({ pressed }) => [
                  styles.typeOption,
                  type === "TEXT" ? styles.typeOptionActive : null,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Ionicons
                  color={type === "TEXT" ? colors.bgPrimary : colors.textMuted}
                  name="chatbubble-outline"
                  size={17}
                />
                <Text
                  style={[
                    styles.typeOptionText,
                    type === "TEXT" ? styles.typeOptionTextActive : null,
                  ]}
                >
                  Texto
                </Text>
              </Pressable>

              <Pressable
                disabled={isSubmitting}
                onPress={() => setType("VOICE")}
                style={({ pressed }) => [
                  styles.typeOption,
                  type === "VOICE" ? styles.typeOptionActive : null,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Ionicons
                  color={type === "VOICE" ? colors.bgPrimary : colors.textMuted}
                  name="mic-outline"
                  size={17}
                />
                <Text
                  style={[
                    styles.typeOptionText,
                    type === "VOICE" ? styles.typeOptionTextActive : null,
                  ]}
                >
                  Voz
                </Text>
              </Pressable>
            </View>
            <Text style={styles.helperText}>
              {type === "TEXT"
                ? "Canal de mensajes de texto."
                : "Canal de audio en tiempo real."}
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            disabled={!canSubmit}
            onPress={() => {
              void handleCreate();
            }}
            style={({ pressed }) => [
              styles.createButton,
              !canSubmit ? styles.createButtonDisabled : null,
              pressed && canSubmit ? styles.buttonPressed : null,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.bgPrimary} size="small" />
            ) : (
              <Text style={styles.createButtonText}>Crear canal</Text>
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
    helperText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    typeSegment: {
      backgroundColor: colors.bgInput,
      borderColor: colors.borderPrimary,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      padding: 4,
    },
    typeOption: {
      alignItems: "center",
      borderRadius: 12,
      flex: 1,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 12,
    },
    typeOptionActive: {
      backgroundColor: colors.textPrimary,
    },
    typeOptionText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
    typeOptionTextActive: {
      color: colors.bgPrimary,
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
    createButton: {
      alignItems: "center",
      backgroundColor: colors.textPrimary,
      borderRadius: 18,
      justifyContent: "center",
      minHeight: 52,
      paddingHorizontal: 16,
    },
    createButtonDisabled: {
      opacity: 0.45,
    },
    createButtonText: {
      color: colors.bgPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.88,
    },
  });
}
