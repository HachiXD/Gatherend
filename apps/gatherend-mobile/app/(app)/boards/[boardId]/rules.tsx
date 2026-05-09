import { Ionicons } from "@expo/vector-icons";
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
import type { ClientBoardRulesImageAsset, ClientRuleItem } from "@/src/features/rules/domain/rules";
import { useBoardRules } from "@/src/features/rules/hooks/use-board-rules";
import { useSaveBoardRules } from "@/src/features/rules/hooks/use-save-board-rules";
import { useDeleteBoardRules } from "@/src/features/rules/hooks/use-delete-board-rules";
import { ImageUploadPicker } from "@/src/features/uploads/components/image-upload-picker";
import { getStoredUploadAssetId } from "@/src/features/uploads/utils/upload-values";
import { useTheme } from "@/src/theme/theme-provider";
import { Text, TextInput } from "@/src/components/app-typography";

const MAX_TITLE = 200;
const MAX_DESC = 1000;

interface RuleDraft {
  title: string;
  description: string;
}

function createEmptyDraft(): RuleDraft {
  return { title: "", description: "" };
}

function toRuleDrafts(items: ClientRuleItem[]): RuleDraft[] {
  if (!items.length) return [createEmptyDraft()];
  return items.map((item) => ({
    title: item.title,
    description: item.description ?? "",
  }));
}

function buildStoredUploadValue(
  asset: ClientBoardRulesImageAsset | null,
): string {
  if (!asset) return "";
  return JSON.stringify({
    assetId: asset.id,
    url: asset.url,
    width: asset.width ?? null,
    height: asset.height ?? null,
  });
}

// ─── RuleCard ────────────────────────────────────────────────────────────────

interface RuleCardProps {
  draft: RuleDraft;
  index: number;
  disabled: boolean;
  onChange: (index: number, field: keyof RuleDraft, value: string) => void;
  onRemove: (index: number) => void;
}

function RuleCard({ draft, index, disabled, onChange, onRemove }: RuleCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.ruleCard}>
      <View style={styles.ruleCardHeader}>
        <View style={styles.ruleBadge}>
          <Text style={styles.ruleBadgeText}>{index + 1}</Text>
        </View>
        <Text style={styles.ruleCardTitle}>Regla {index + 1}</Text>
        <Pressable
          disabled={disabled}
          onPress={() => onRemove(index)}
          style={({ pressed }) => [
            styles.ruleRemoveButton,
            pressed ? styles.pressed : null,
          ]}
          accessibilityLabel={`Eliminar regla ${index + 1}`}
        >
          <Ionicons color={colors.textMuted} name="trash-outline" size={17} />
        </Pressable>
      </View>

      <View style={styles.ruleCardBody}>
        <TextInput
          editable={!disabled}
          maxLength={MAX_TITLE}
          onChangeText={(v) => onChange(index, "title", v)}
          placeholder="Título de la regla *"
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
          style={styles.ruleInput}
          value={draft.title}
        />

        <TextInput
          editable={!disabled}
          maxLength={MAX_DESC}
          multiline
          numberOfLines={3}
          onChangeText={(v) => onChange(index, "description", v)}
          placeholder="Descripción opcional..."
          placeholderTextColor={colors.textMuted}
          style={[styles.ruleInput, styles.ruleTextarea]}
          textAlignVertical="top"
          value={draft.description}
        />

        <Text style={styles.ruleCounter}>
          {draft.description.length}/{MAX_DESC}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function BoardRulesScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: rules, isLoading } = useBoardRules(boardId);
  const saveMutation = useSaveBoardRules();
  const deleteMutation = useDeleteBoardRules();

  const [ruleDrafts, setRuleDrafts] = useState<RuleDraft[]>([createEmptyDraft()]);
  const [imageUpload, setImageUpload] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form once after first load
  useEffect(() => {
    if (isInitialized || isLoading) return;
    if (rules) {
      setRuleDrafts(toRuleDrafts(rules.items));
      setImageUpload(buildStoredUploadValue(rules.imageAsset));
    }
    setIsInitialized(true);
  }, [isInitialized, isLoading, rules]);

  const isSubmitting = saveMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isBusy = isSubmitting || isDeleting;

  const canSubmit =
    isInitialized &&
    !isBusy &&
    ruleDrafts.length > 0 &&
    ruleDrafts.every((r) => r.title.trim().length > 0);

  const updateDraft = useCallback(
    (index: number, field: keyof RuleDraft, value: string) => {
      setRuleDrafts((prev) =>
        prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
      );
    },
    [],
  );

  const addDraft = useCallback(() => {
    setRuleDrafts((prev) => [...prev, createEmptyDraft()]);
  }, []);

  const removeDraft = useCallback((index: number) => {
    setRuleDrafts((prev) => {
      if (prev.length === 1) return [createEmptyDraft()];
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!boardId || !canSubmit) return;
    const isEdit = rules !== null;
    try {
      await saveMutation.mutateAsync({
        boardId,
        isEdit,
        items: ruleDrafts.map((d, i) => ({
          title: d.title.trim(),
          description: d.description.trim() || null,
          order: i + 1,
        })),
        imageAssetId: getStoredUploadAssetId(imageUpload),
      });
    } catch {
      // el error se expone vía mutation.error
    }
  }, [boardId, canSubmit, imageUpload, ruleDrafts, rules, saveMutation]);

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
                setRuleDrafts([createEmptyDraft()]);
                setImageUpload("");
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
        {/* Imagen */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Imagen (opcional)</Text>
          <ImageUploadPicker
            allowEditing
            boardId={boardId}
            context="board_rules_image"
            label="Imagen de reglas"
            onChange={setImageUpload}
            size={100}
            value={imageUpload}
          />
        </View>

        {/* Reglas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionLabel}>Reglas</Text>
              <Text style={styles.sectionHint}>
                Título obligatorio · Descripción opcional
              </Text>
            </View>
            <Pressable
              disabled={isBusy}
              onPress={addDraft}
              style={({ pressed }) => [
                styles.addButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Ionicons color={colors.textPrimary} name="add" size={18} />
              <Text style={styles.addButtonText}>Añadir</Text>
            </Pressable>
          </View>

          {ruleDrafts.map((draft, i) => (
            <RuleCard
              key={i}
              draft={draft}
              index={i}
              disabled={isBusy}
              onChange={updateDraft}
              onRemove={removeDraft}
            />
          ))}
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
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    sectionHeaderCopy: {
      flex: 1,
      gap: 2,
    },
    sectionLabel: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    sectionHint: {
      color: colors.textMuted,
      fontSize: 11,
    },
    addButton: {
      alignItems: "center",
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    addButtonText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    // Rule card
    ruleCard: {
      backgroundColor: colors.bgTertiary,
      borderColor: colors.borderPrimary,
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
    },
    ruleCardHeader: {
      alignItems: "center",
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    ruleBadge: {
      alignItems: "center",
      backgroundColor: colors.accentPrimary,
      borderRadius: 8,
      height: 26,
      justifyContent: "center",
      width: 26,
    },
    ruleBadgeText: {
      color: colors.bgPrimary,
      fontSize: 12,
      fontWeight: "800",
    },
    ruleCardTitle: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
    },
    ruleRemoveButton: {
      alignItems: "center",
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    ruleCardBody: {
      gap: 10,
      padding: 12,
    },
    ruleInput: {
      backgroundColor: colors.bgInput,
      borderColor: colors.borderPrimary,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.textPrimary,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    ruleTextarea: {
      minHeight: 80,
    },
    ruleCounter: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: "right",
    },
    // Error
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
    // Footer
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
