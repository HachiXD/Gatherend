import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput } from "@/src/components/app-typography";
import { submitReport, type ReportTargetType } from "../api/submit-report";
import { useTheme } from "@/src/theme/theme-provider";

export type ReportCategory =
  | "CSAM"
  | "SEXUAL_CONTENT"
  | "HARASSMENT"
  | "HATE_SPEECH"
  | "SPAM"
  | "IMPERSONATION"
  | "OTHER";

export type ReportCategoryConfig = {
  value: ReportCategory;
  label: string;
  description: string;
};

export type ReportScreenProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  previewLabel: string;
  categories: ReportCategoryConfig[];
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId?: string;
  channelId?: string;
  snapshot?: Record<string, unknown>;
};

export function ReportScreen({
  visible,
  onClose,
  title,
  previewLabel,
  categories,
  targetType,
  targetId,
  targetOwnerId,
  channelId,
  snapshot,
}: ReportScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedCategory, setSelectedCategory] =
    useState<ReportCategory | null>(null);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setSelectedCategory(null);
    setDescription("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedCategory) return;
    try {
      setIsLoading(true);
      setError(null);
      await submitReport({
        targetType,
        targetId,
        category: selectedCategory,
        description: description.trim() || null,
        snapshot,
        targetOwnerId,
        channelId,
      });
      setSuccess(true);
      setTimeout(handleClose, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al enviar el reporte",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[styles.root, { backgroundColor: colors.bgSecondary }]}
      >
        {/* Header */}
        <View
          style={[styles.header, { borderBottomColor: colors.borderPrimary }]}
        >
          <View style={styles.headerSide} />
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSide}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons color={colors.textPrimary} name="close" size={22} />
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <View style={styles.flex}>
            <View
              style={styles.scrollContent}
              // ScrollView omitted: list is fixed-length, no overflow expected
            >
              {/* Preview */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  Contenido reportado
                </Text>
                <View
                  style={[
                    styles.previewBox,
                    {
                      backgroundColor: colors.bgTertiary,
                      borderColor: colors.borderPrimary,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={3}
                    style={[styles.previewText, { color: colors.textSecondary }]}
                  >
                    {previewLabel}
                  </Text>
                </View>
              </View>

              {/* Categories */}
              <View style={styles.section}>
                <Text
                  style={[styles.sectionLabel, { color: colors.textMuted }]}
                >
                  ¿Por qué estás reportando esto?
                </Text>
                <View
                  style={[
                    styles.categoryList,
                    { borderColor: colors.borderPrimary },
                  ]}
                >
                  {categories.map((cat, index) => {
                    const isSelected = selectedCategory === cat.value;
                    const isLast = index === categories.length - 1;
                    return (
                      <Pressable
                        key={cat.value}
                        disabled={isLoading}
                        onPress={() => setSelectedCategory(cat.value)}
                        style={({ pressed }) => [
                          styles.categoryRow,
                          isSelected && {
                            backgroundColor: colors.accentPrimary + "1a",
                          },
                          !isLast && {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: colors.borderPrimary,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.categoryText}>
                          <Text
                            style={[
                              styles.categoryLabel,
                              {
                                color: isSelected
                                  ? colors.accentPrimary
                                  : colors.textPrimary,
                              },
                            ]}
                          >
                            {cat.label}
                          </Text>
                          <Text
                            style={[
                              styles.categoryDescription,
                              { color: colors.textMuted },
                            ]}
                          >
                            {cat.description}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.radio,
                            {
                              borderColor: isSelected
                                ? colors.accentPrimary
                                : colors.borderPrimary,
                              backgroundColor: isSelected
                                ? colors.accentPrimary
                                : "transparent",
                            },
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Additional details */}
              <View style={styles.section}>
                <Text
                  style={[styles.sectionLabel, { color: colors.textMuted }]}
                >
                  Detalles adicionales (opcional)
                </Text>
                <TextInput
                  maxLength={500}
                  multiline
                  onChangeText={setDescription}
                  placeholder="Agrega más contexto si lo deseas..."
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.descriptionInput,
                    {
                      backgroundColor: colors.bgTertiary,
                      borderColor: colors.borderPrimary,
                      color: colors.textPrimary,
                    },
                  ]}
                  textAlignVertical="top"
                  value={description}
                />
              </View>

              {success ? (
                <View
                  style={[
                    styles.feedbackBox,
                    {
                      backgroundColor: "#16a34a18",
                      borderColor: "#16a34a40",
                    },
                  ]}
                >
                  <Text style={styles.successText}>
                    Reporte enviado. Gracias por ayudar a mantener la comunidad
                    segura.
                  </Text>
                </View>
              ) : null}

              {error && !success ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}
            </View>
          </View>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: colors.borderPrimary,
                backgroundColor: colors.bgSecondary,
              },
            ]}
          >
            <Pressable
              disabled={!selectedCategory || isLoading}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.submitButton,
                (!selectedCategory || isLoading) && styles.submitDisabled,
                pressed && !!selectedCategory && !isLoading
                  ? styles.pressed
                  : null,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Enviar reporte</Text>
              )}
            </Pressable>
          </View>
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
    header: {
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      height: 52,
      justifyContent: "space-between",
      paddingHorizontal: 8,
    },
    headerSide: {
      alignItems: "center",
      justifyContent: "center",
      width: 48,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    closeButton: {
      alignItems: "center",
      borderRadius: 20,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    scrollContent: {
      flex: 1,
      gap: 20,
      overflow: "hidden",
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    section: {
      gap: 8,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    previewBox: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    previewText: {
      fontSize: 14,
      lineHeight: 20,
    },
    categoryList: {
      borderRadius: 12,
      borderWidth: 1,
      overflow: "hidden",
    },
    categoryRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    categoryText: {
      flex: 1,
      gap: 2,
    },
    categoryLabel: {
      fontSize: 14,
      fontWeight: "600",
    },
    categoryDescription: {
      fontSize: 12,
      lineHeight: 16,
    },
    radio: {
      borderRadius: 8,
      borderWidth: 2,
      height: 16,
      width: 16,
    },
    descriptionInput: {
      borderRadius: 10,
      borderWidth: 1,
      fontSize: 14,
      height: 88,
      lineHeight: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    feedbackBox: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    successText: {
      color: "#16a34a",
      fontSize: 14,
      lineHeight: 20,
    },
    errorText: {
      color: "#f87171",
      fontSize: 13,
      textAlign: "center",
    },
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    submitButton: {
      alignItems: "center",
      backgroundColor: "#ef4444",
      borderRadius: 14,
      height: 50,
      justifyContent: "center",
    },
    submitDisabled: {
      opacity: 0.45,
    },
    submitText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.82,
    },
  });
}
