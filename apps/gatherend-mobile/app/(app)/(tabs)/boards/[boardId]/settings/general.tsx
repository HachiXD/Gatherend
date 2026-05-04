import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ImageUploadPicker } from "@/src/features/uploads/components/image-upload-picker";
import {
  getStoredUploadAssetId,
  getStoredUploadValueFromAsset,
} from "@/src/features/uploads/utils/upload-values";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { BoardSettingsCenterState } from "@/src/features/board-settings/components/settings-states";
import {
  useRefreshBoard,
  useUpdateBoardSettings,
} from "@/src/features/board-settings/hooks/use-board-settings";
import { canViewSettingsSection } from "@/src/features/board-settings/utils/permissions";
import { useTheme } from "@/src/theme/theme-provider";
import { Text, TextInput } from "@/src/components/app-typography";
import type { BoardTabNames } from "@/src/features/boards/types/board";

const TAB_FIELDS: { key: keyof BoardTabNames; defaultLabel: string }[] = [
  { key: "home", defaultLabel: "Casa" },
  { key: "chats", defaultLabel: "Chats" },
  { key: "forum", defaultLabel: "Foro" },
  { key: "rules", defaultLabel: "Reglas" },
  { key: "wiki", defaultLabel: "Wiki" },
  { key: "ranking", defaultLabel: "Ranking" },
  { key: "members", defaultLabel: "Miembros" },
  { key: "invite", defaultLabel: "Invitar amigos" },
];

export default function BoardGeneralSettingsScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: board, isLoading, isError, error, refetch } = useBoard(boardId);
  const updateSettings = useUpdateBoardSettings(boardId ?? "");
  const refreshBoard = useRefreshBoard(boardId ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUpload, setImageUpload] = useState("");
  const [bannerUpload, setBannerUpload] = useState("");
  const [tabNames, setTabNames] = useState<BoardTabNames>({});

  useEffect(() => {
    if (!board) return;
    setName(board.name);
    setDescription(board.description ?? "");
    setImageUpload(getStoredUploadValueFromAsset(board.imageAsset));
    setBannerUpload(getStoredUploadValueFromAsset(board.bannerAsset));
    setTabNames(board.tabNames ?? {});
  }, [board]);

  if (isLoading && !board) {
    return <BoardSettingsCenterState message="Cargando general..." loading />;
  }

  if (isError && !board) {
    return (
      <BoardSettingsCenterState
        title="No se pudo cargar general"
        message={error instanceof Error ? error.message : "Intenta nuevamente."}
        actionLabel="Reintentar"
        onAction={() => void refetch()}
      />
    );
  }

  if (!board || !canViewSettingsSection(board.currentMember?.role, "general")) {
    return (
      <BoardSettingsCenterState
        title="Sin acceso"
        message="Solo owner y admins pueden editar la configuracion general."
      />
    );
  }

  const trimmedName = name.trim();
  const canSave =
    !updateSettings.isPending &&
    trimmedName.length >= 2 &&
    trimmedName.length <= 50 &&
    description.length <= 300;

  const handleSave = async () => {
    if (!canSave) return;

    try {
      await updateSettings.mutateAsync({
        name: trimmedName,
        description: description.trim() || null,
        imageAssetId: getStoredUploadAssetId(imageUpload),
        bannerAssetId: getStoredUploadAssetId(bannerUpload),
        tabNames,
      });
      Alert.alert("Guardado", "El board fue actualizado.");
    } catch (saveError) {
      Alert.alert(
        "No se pudo guardar",
        saveError instanceof Error ? saveError.message : "Intenta nuevamente.",
      );
    }
  };

  const handleBump = async () => {
    try {
      await refreshBoard.mutateAsync();
      Alert.alert("Bump listo", "El board fue actualizado en discovery.");
    } catch (bumpError) {
      Alert.alert(
        "No se pudo hacer bump",
        bumpError instanceof Error ? bumpError.message : "Intenta mas tarde.",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.panel}>
          <ImageUploadPicker
            boardId={board.id}
            context="board_image"
            fullWidth
            value={imageUpload}
            onChange={setImageUpload}
            label="Imagen del board"
            size={104}
            allowEditing
          />

          <ImageUploadPicker
            boardId={board.id}
            context="board_banner"
            fullWidth
            value={bannerUpload}
            onChange={setBannerUpload}
            label="Banner del board"
            size={104}
            allowEditing
          />

          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={styles.label}>NOMBRE DEL BOARD</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                editable={!updateSettings.isPending}
                maxLength={50}
                placeholder="Nombre"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
              {trimmedName.length > 0 && trimmedName.length < 2 ? (
                <Text style={styles.error}>Minimo 2 caracteres.</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>DESCRIPCION</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                editable={!updateSettings.isPending}
                maxLength={300}
                multiline
                placeholder="Descripcion opcional"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, styles.textarea]}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>{description.length}/300</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>NOMBRES DE SECCIONES</Text>
          <Text style={styles.sectionHint}>
            Deja vacío para usar el nombre por defecto.
          </Text>
          {TAB_FIELDS.map(({ key, defaultLabel }) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{defaultLabel.toUpperCase()}</Text>
              <TextInput
                value={tabNames[key] ?? ""}
                onChangeText={(val) =>
                  setTabNames((prev) => ({ ...prev, [key]: val || null }))
                }
                editable={!updateSettings.isPending}
                maxLength={30}
                placeholder={defaultLabel}
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleBump}
            disabled={refreshBoard.isPending}
            style={({ pressed }) => [
              styles.secondaryButton,
              (pressed || refreshBoard.isPending) ? styles.pressed : null,
            ]}
          >
            <Ionicons name="arrow-up-circle-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.secondaryButtonText}>
              {refreshBoard.isPending ? "Haciendo bump..." : "Bump board"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.primaryButton,
              (!canSave || pressed) ? styles.pressed : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {updateSettings.isPending ? "Guardando..." : "Guardar cambios"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    actions: {
      gap: 10,
    },
    content: {
      gap: 16,
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    counter: {
      alignSelf: "flex-end",
      color: colors.textMuted,
      fontSize: 11,
    },
    error: {
      color: "#fb7185",
      fontSize: 12,
    },
    field: {
      gap: 7,
    },
    fields: {
      flex: 1,
      gap: 12,
      minWidth: 0,
    },
    input: {
      backgroundColor: colors.bgInput,
      borderColor: colors.borderSecondary,
      borderRadius: 10,
      borderWidth: 1,
      color: colors.textPrimary,
      fontSize: 14,
      minHeight: 42,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    keyboard: {
      flex: 1,
    },
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
    },
    panel: {
      backgroundColor: colors.bgEditForm,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      gap: 16,
      padding: 14,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
    },
    sectionHint: {
      color: colors.textTertiary,
      fontSize: 12,
      marginTop: -8,
    },
    pressed: {
      opacity: 0.65,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.tabButtonBg,
      borderRadius: 12,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 14,
    },
    primaryButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    scroll: {
      flex: 1,
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 7,
      justifyContent: "center",
      minHeight: 42,
      paddingHorizontal: 14,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    textarea: {
      minHeight: 104,
    },
  });
}
