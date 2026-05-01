import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { useCreateBoard } from "@/src/features/boards/hooks/use-create-board";
import { ImageUploadPicker } from "@/src/features/uploads/components/image-upload-picker";
import { getStoredUploadAssetId } from "@/src/features/uploads/utils/upload-values";
import { Text, TextInput } from "@/src/components/app-typography";
import { useTheme } from "@/src/theme/theme-provider";

function isValidBoardName(name: string) {
  return name.trim().length >= 2 && name.trim().length <= 50;
}

export default function CreateBoardModalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const createBoardMutation = useCreateBoard();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUpload, setImageUpload] = useState("");
  const [bannerUpload, setBannerUpload] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const isSubmitting = createBoardMutation.isPending;
  const canSubmit = useMemo(
    () => isValidBoardName(name) && !isSubmitting,
    [isSubmitting, name],
  );

  const handleCreateBoard = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!isValidBoardName(trimmedName)) {
      setLocalError("El nombre debe tener entre 2 y 50 caracteres.");
      return;
    }

    if (trimmedDescription.length > 300) {
      setLocalError("La descripcion no puede exceder 300 caracteres.");
      return;
    }

    setLocalError(null);

    try {
      const board = await createBoardMutation.mutateAsync({
        name: trimmedName,
        description: trimmedDescription || undefined,
        imageAssetId: getStoredUploadAssetId(imageUpload),
        bannerAssetId: getStoredUploadAssetId(bannerUpload),
        isPrivate,
      });

      router.replace({
        pathname: "/(app)/(tabs)/boards/[boardId]",
        params: { boardId: board.id },
      });
    } catch {
      // La mutation ya expone el mensaje del backend; aqui solo evitamos
      // que la promesa rechazada rompa el flujo del handler.
    }
  };

  const errorMessage =
    localError ||
    (createBoardMutation.error instanceof Error
      ? createBoardMutation.error.message
      : null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Crea tu board</Text>
            <Text style={styles.subtitle}>
              Dale una imagen, un nombre y define como quieres abrir el espacio.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.imageField}>
              <ImageUploadPicker
                context="board_image"
                fullWidth
                label="Imagen opcional"
                onChange={setImageUpload}
                size={104}
                value={imageUpload}
              />
              <ImageUploadPicker
                context="board_banner"
                fullWidth
                label="Banner opcional"
                onChange={setBannerUpload}
                size={104}
                value={bannerUpload}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                autoCapitalize="sentences"
                autoCorrect={false}
                editable={!isSubmitting}
                maxLength={50}
                onChangeText={setName}
                placeholder="Ej. Gatherend Creators"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                value={name}
              />
              <Text style={styles.helperText}>
                {name.trim().length}/50 caracteres
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Descripcion</Text>
              <TextInput
                autoCapitalize="sentences"
                editable={!isSubmitting}
                maxLength={300}
                multiline
                onChangeText={setDescription}
                placeholder="Describe brevemente de que trata este board."
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, styles.textarea]}
                textAlignVertical="top"
                value={description}
              />
              <Text style={styles.helperText}>
                {description.trim().length}/300 caracteres
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Publico / Privado</Text>
              <View style={styles.visibilitySegment}>
                <Pressable
                  disabled={isSubmitting}
                  onPress={() => setIsPrivate(false)}
                  style={({ pressed }) => [
                    styles.visibilityOption,
                    !isPrivate ? styles.visibilityOptionActive : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Ionicons
                    color={!isPrivate ? colors.textPrimary : colors.textMuted}
                    name="globe-outline"
                    size={18}
                  />
                  <Text
                    style={[
                      styles.visibilityOptionText,
                      !isPrivate ? styles.visibilityOptionTextActive : null,
                    ]}
                  >
                    Publico
                  </Text>
                </Pressable>

                <Pressable
                  disabled={isSubmitting}
                  onPress={() => setIsPrivate(true)}
                  style={({ pressed }) => [
                    styles.visibilityOption,
                    isPrivate ? styles.visibilityOptionActive : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Ionicons
                    color={isPrivate ? colors.textPrimary : colors.textMuted}
                    name="lock-closed-outline"
                    size={18}
                  />
                  <Text
                    style={[
                      styles.visibilityOptionText,
                      isPrivate ? styles.visibilityOptionTextActive : null,
                    ]}
                  >
                    Privado
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.visibilityText}>
                {isPrivate
                  ? "Solo los miembros invitados podran ver y entrar al board."
                  : "Cualquier persona podra descubrir el board y solicitar entrar."}
              </Text>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            disabled={isSubmitting}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </Pressable>

          <Pressable
            disabled={!canSubmit}
            onPress={() => {
              void handleCreateBoard();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              !canSubmit || isSubmitting ? styles.primaryButtonDisabled : null,
              pressed && canSubmit ? styles.buttonPressed : null,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Crear board</Text>
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
      flex: 1,
      backgroundColor: colors.bgModal,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 24,
      gap: 24,
    },
    header: {
      gap: 10,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: "700",
      lineHeight: 34,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    form: {
      gap: 18,
    },
    imageField: {
      alignItems: "center",
      gap: 16,
    },
    field: {
      gap: 8,
    },
    label: {
      color: colors.textSubtle,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    input: {
      backgroundColor: colors.bgInputModal,
      borderColor: colors.borderPrimary,
      borderRadius: 18,
      borderWidth: 1,
      color: colors.textPrimary,
      fontSize: 15,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    textarea: {
      minHeight: 120,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    visibilitySegment: {
      backgroundColor: colors.bgInputModal,
      borderColor: colors.borderPrimary,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      padding: 4,
    },
    visibilityOption: {
      alignItems: "center",
      borderRadius: 14,
      flex: 1,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 12,
    },
    visibilityOptionActive: {
      backgroundColor: colors.buttonPrimary,
    },
    visibilityOptionText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
    visibilityOptionTextActive: {
      color: colors.textPrimary,
    },
    visibilityText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
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
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 18,
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: colors.bgCancelButton,
      borderColor: colors.borderPrimary,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 52,
      paddingHorizontal: 16,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.buttonPrimary,
      borderRadius: 18,
      flex: 1.2,
      justifyContent: "center",
      minHeight: 52,
      paddingHorizontal: 16,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.92,
    },
  });
}
