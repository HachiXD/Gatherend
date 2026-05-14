import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { Text, TextInput } from "@/src/components/app-typography";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { useUpdateChannel } from "@/src/features/boards/hooks/use-update-channel";
import { useTheme } from "@/src/theme/theme-provider";

function isValidChannelName(name: string) {
  return name.trim().length >= 1 && name.trim().length <= 50;
}

export default function EditChannelModalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { boardId, channelId } = useLocalSearchParams<{
    boardId?: string;
    channelId?: string;
  }>();

  const boardQuery = useBoard(boardId);
  const updateChannelMutation = useUpdateChannel();
  const channel = useMemo(
    () => boardQuery.data?.channels.find((item) => item.id === channelId),
    [boardQuery.data?.channels, channelId],
  );
  const [name, setName] = useState("");

  useEffect(() => {
    if (channel) setName(channel.name);
  }, [channel]);

  if (!boardId || !channelId) {
    return <Redirect href="/boards" />;
  }

  const isLoading = boardQuery.isLoading && !boardQuery.data;
  const isSubmitting = updateChannelMutation.isPending;
  const trimmedName = name.trim();
  const canSubmit =
    Boolean(channel) &&
    isValidChannelName(name) &&
    trimmedName !== channel?.name &&
    !isSubmitting;

  const handleUpdate = async () => {
    if (!channel || !canSubmit) return;

    try {
      await updateChannelMutation.mutateAsync({
        boardId,
        channelId: channel.id,
        name: trimmedName,
      });
      router.back();
    } catch {
      // el error se expone via mutation.error
    }
  };

  const errorMessage =
    updateChannelMutation.error instanceof Error
      ? updateChannelMutation.error.message
      : boardQuery.error instanceof Error
        ? boardQuery.error.message
        : null;

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom", "left", "right"]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons
              color={colors.textPrimary}
              name="pencil-outline"
              size={30}
            />
            <Text style={styles.title}>Editar canal</Text>
          </View>
          <Pressable
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Ionicons color={colors.textPrimary} name="close" size={20} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.textPrimary} size="small" />
            </View>
          ) : channel ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  editable={!isSubmitting}
                  maxLength={50}
                  onChangeText={setName}
                  placeholder="Nombre del canal"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={name}
                />
                <Text style={styles.helperText}>{trimmedName.length}/50</Text>
              </View>
            </>
          ) : (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>No se encontro este canal.</Text>
            </View>
          )}

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
              void handleUpdate();
            }}
            style={({ pressed }) => [
              styles.createButton,
              !canSubmit ? styles.createButtonDisabled : null,
              pressed && canSubmit ? styles.buttonPressed : null,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.textPrimary} size="small" />
            ) : (
              <Text style={styles.createButtonText}>Guardar cambios</Text>
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
    titleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "700",
    },
    closeButton: {
      alignItems: "center",
      height: 36,
      justifyContent: "center",
      width: 36,
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
    label: {
      color: colors.textSubtle,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.6,
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
      fontSize: 13,
    },
    loadingBox: {
      alignItems: "center",
      minHeight: 120,
      justifyContent: "center",
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
      backgroundColor: colors.tabActiveBg,
      borderRadius: 18,
      justifyContent: "center",
      minHeight: 52,
      paddingHorizontal: 16,
    },
    createButtonDisabled: {
      opacity: 0.45,
    },
    createButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.88,
    },
  });
}
