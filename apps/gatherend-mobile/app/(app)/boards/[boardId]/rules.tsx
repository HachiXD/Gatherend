import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBoardRules } from "@/src/features/rules/hooks/use-board-rules";
import { useSaveBoardRules } from "@/src/features/rules/hooks/use-save-board-rules";
import { useDeleteBoardRules } from "@/src/features/rules/hooks/use-delete-board-rules";
import { useTheme } from "@/src/theme/theme-provider";
import { Text, TextInput } from "@/src/components/app-typography";

const MAX_CONTENT = 10000;

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function BoardRulesScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: rules, isLoading } = useBoardRules(boardId);
  const saveMutation = useSaveBoardRules();
  const deleteMutation = useDeleteBoardRules();

  const [content, setContent] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form once after first load
  useEffect(() => {
    if (isInitialized || isLoading) return;
    if (rules) {
      setContent(rules.content);
    }
    setIsInitialized(true);
  }, [isInitialized, isLoading, rules]);

  const isSubmitting = saveMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isBusy = isSubmitting || isDeleting;

  const canSubmit = isInitialized && !isBusy && content.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!boardId || !canSubmit) return;
    const isEdit = rules !== null;
    try {
      await saveMutation.mutateAsync({
        boardId,
        isEdit,
        content: content.trim(),
      });
    } catch {
      // error exposed via mutation.error
    }
  }, [boardId, canSubmit, content, rules, saveMutation]);

  const handleDeletePress = useCallback(() => {
    if (!boardId) return;
    Alert.alert(
      "Borrar reglas",
      "Esta acción no se puede deshacer. Las reglas del board serán eliminadas permanentemente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(boardId, {
              onSuccess: () => {
                setContent("");
                saveMutation.reset();
              },
            });
          },
        },
      ],
    );
  }, [boardId, deleteMutation, saveMutation]);

  const errorMessage =
    (saveMutation.error instanceof Error ? saveMutation.error.message : null) ||
    (deleteMutation.error instanceof Error ? deleteMutation.error.message : null);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!isInitialized) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
        <Text style={styles.stateText}>Cargando reglas...</Text>
      </View>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Contenido */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reglas</Text>
          <TextInput
            editable={!isBusy}
            maxLength={MAX_CONTENT}
            multiline
            numberOfLines={12}
            onChangeText={setContent}
            placeholder="Escribe las reglas del board..."
            placeholderTextColor={colors.textMuted}
            style={[styles.textarea]}
            textAlignVertical="top"
            value={content}
          />
          <Text style={styles.counter}>
            {content.length}/{MAX_CONTENT}
          </Text>
        </View>

        {/* Error */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {rules !== null ? (
          <Pressable
            disabled={isBusy}
            onPress={handleDeletePress}
            style={({ pressed }) => [
              styles.deleteButton,
              isBusy ? styles.buttonDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            {isDeleting ? (
              <ActivityIndicator color="#fca5a5" size="small" />
            ) : (
              <Text style={styles.deleteButtonText}>Borrar reglas</Text>
            )}
          </Pressable>
        ) : null}

        <Pressable
          disabled={!canSubmit}
          onPress={() => void handleSave()}
          style={({ pressed }) => [
            styles.saveButton,
            !canSubmit ? styles.buttonDisabled : null,
            pressed && canSubmit ? styles.pressed : null,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.bgPrimary} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>
              {rules !== null ? "Guardar cambios" : "Crear reglas"}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    scrollContent: {
      gap: 24,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 16,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    stateText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    section: {
      gap: 12,
    },
    sectionLabel: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    textarea: {
      backgroundColor: colors.bgInput,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.textPrimary,
      fontSize: 15,
      minHeight: 240,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    counter: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: "right",
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
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    deleteButton: {
      alignItems: "center",
      backgroundColor: "rgba(239, 68, 68, 0.12)",
      borderColor: "rgba(248, 113, 113, 0.35)",
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 50,
      paddingHorizontal: 16,
    },
    deleteButtonText: {
      color: "#fca5a5",
      fontSize: 14,
      fontWeight: "700",
    },
    saveButton: {
      alignItems: "center",
      backgroundColor: colors.textPrimary,
      borderRadius: 16,
      flex: 1,
      justifyContent: "center",
      minHeight: 50,
      paddingHorizontal: 16,
    },
    saveButtonText: {
      color: colors.bgPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    buttonDisabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
