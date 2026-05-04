import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { isModerator } from "@/src/features/boards/member-role";
import { useWikiPage } from "@/src/features/wiki/hooks/use-wiki-page";
import { useEditWikiPage } from "@/src/features/wiki/hooks/use-edit-wiki-page";
import { useDeleteWikiPage } from "@/src/features/wiki/hooks/use-delete-wiki-page";
import { UserAvatar } from "@/src/components/user-avatar";
import { Text, TextInput } from "@/src/components/app-typography";
import { useTheme } from "@/src/theme/theme-provider";

const MAX_TITLE = 200;
const MAX_CONTENT = 5000;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function WikiPageDetailScreen() {
  const { boardId, pageId } = useLocalSearchParams<{
    boardId: string;
    pageId: string;
  }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const profile = useProfile();
  const { data: board } = useBoard(boardId);
  const { data: page, isLoading, isError } = useWikiPage(boardId, pageId);

  const editMutation = useEditWikiPage(boardId ?? "", pageId ?? "");
  const deleteMutation = useDeleteWikiPage(boardId ?? "");

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const currentMemberRole = board?.currentMember?.role ?? null;
  const isAuthor = page?.author.id === profile.id;
  const canEdit = isAuthor || isModerator(currentMemberRole);
  const canDelete = isAuthor || isModerator(currentMemberRole);

  const handleStartEdit = useCallback(() => {
    if (!page) return;
    setEditTitle(page.title);
    setEditContent(page.content ?? "");
    setIsEditing(true);
  }, [page]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editTitle.trim()) return;
    try {
      await editMutation.mutateAsync({
        title: editTitle.trim(),
        content: editContent.trim() || undefined,
      });
      setIsEditing(false);
    } catch {
      // error exposed via mutation.error
    }
  }, [editMutation, editTitle, editContent]);

  const handleDelete = useCallback(() => {
    if (!pageId) return;
    Alert.alert(
      "Eliminar página",
      "¿Seguro que quieres eliminar esta página? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(pageId, {
              onSuccess: () => router.back(),
            });
          },
        },
      ],
    );
  }, [pageId, deleteMutation, router]);

  if (isLoading) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
      </View>
    );
  }

  if (isError || !page) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          No se pudo cargar la página.
        </Text>
      </View>
    );
  }

  const editError =
    editMutation.error instanceof Error ? editMutation.error.message : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bgPrimary }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={{ backgroundColor: colors.bgPrimary }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Image */}
        {page.imageAsset?.url ? (
          <Image
            contentFit="cover"
            source={{ uri: page.imageAsset.url }}
            style={styles.headerImage}
          />
        ) : null}

        {/* Title */}
        {isEditing ? (
          <View style={styles.section}>
            <Text style={[styles.fieldLabel, { color: colors.textSubtle }]}>
              Título *
            </Text>
            <TextInput
              maxLength={MAX_TITLE}
              onChangeText={setEditTitle}
              placeholder="Título..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: colors.bgInput,
                  borderColor: colors.borderPrimary,
                  color: colors.textPrimary,
                },
              ]}
              value={editTitle}
            />
          </View>
        ) : (
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>
            {page.title}
          </Text>
        )}

        {/* Author meta */}
        <View style={styles.authorRow}>
          <UserAvatar
            avatarUrl={page.author.avatarAsset?.url}
            username={page.author.username}
            size={28}
          />
          <View style={styles.authorMeta}>
            <Text
              style={[styles.authorName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {page.author.username}
            </Text>
            <Text style={[styles.dateText, { color: colors.textTertiary }]}>
              Actualizado {formatDate(page.updatedAt)}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View
          style={[styles.divider, { backgroundColor: colors.borderPrimary }]}
        />

        {/* Content */}
        {isEditing ? (
          <View style={styles.section}>
            <Text style={[styles.fieldLabel, { color: colors.textSubtle }]}>
              Contenido (opcional)
            </Text>
            <TextInput
              maxLength={MAX_CONTENT}
              multiline
              numberOfLines={10}
              onChangeText={setEditContent}
              placeholder="Contenido de la página..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                styles.textarea,
                {
                  backgroundColor: colors.bgInput,
                  borderColor: colors.borderPrimary,
                  color: colors.textPrimary,
                },
              ]}
              textAlignVertical="top"
              value={editContent}
            />
            <Text style={[styles.helperText, { color: colors.textMuted }]}>
              {editContent.length}/{MAX_CONTENT}
            </Text>
          </View>
        ) : page.content ? (
          <Text style={[styles.pageContent, { color: colors.textPrimary }]}>
            {page.content}
          </Text>
        ) : (
          <Text style={[styles.emptyContent, { color: colors.textMuted }]}>
            Sin contenido.
          </Text>
        )}

        {/* Edit error */}
        {editError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{editError}</Text>
          </View>
        ) : null}

        {/* Actions */}
        {!isEditing && (canEdit || canDelete) ? (
          <View style={styles.actionRow}>
            {canEdit ? (
              <Pressable
                onPress={handleStartEdit}
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    borderColor: colors.borderPrimary,
                    backgroundColor: colors.bgSecondary,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="pencil-outline"
                  size={16}
                  color={colors.textPrimary}
                />
                <Text
                  style={[styles.actionText, { color: colors.textPrimary }]}
                >
                  Editar
                </Text>
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable
                onPress={handleDelete}
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    borderColor: "rgba(248, 113, 113, 0.35)",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                  },
                  pressed && styles.pressed,
                ]}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator color="#fca5a5" size="small" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color="#fca5a5" />
                    <Text style={[styles.actionText, { color: "#fca5a5" }]}>
                      Eliminar
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Edit mode buttons */}
        {isEditing ? (
          <View style={styles.editButtons}>
            <Pressable
              onPress={handleCancelEdit}
              style={({ pressed }) => [
                styles.cancelButton,
                { borderColor: colors.borderPrimary },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.cancelButtonText, { color: colors.textPrimary }]}
              >
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              disabled={!editTitle.trim() || editMutation.isPending}
              onPress={() => {
                void handleSaveEdit();
              }}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: colors.textPrimary },
                (!editTitle.trim() || editMutation.isPending) &&
                  styles.saveButtonDisabled,
                pressed && editTitle.trim() && styles.pressed,
              ]}
            >
              {editMutation.isPending ? (
                <ActivityIndicator color={colors.bgPrimary} size="small" />
              ) : (
                <Text
                  style={[styles.saveButtonText, { color: colors.bgPrimary }]}
                >
                  Guardar
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    scrollContent: {
      gap: 16,
      paddingBottom: 40,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    headerImage: {
      borderRadius: 12,
      height: 200,
      width: "100%",
    },
    pageTitle: {
      fontSize: 26,
      fontWeight: "700",
      lineHeight: 32,
    },
    authorRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    authorMeta: {
      flex: 1,
      minWidth: 0,
    },
    authorName: {
      fontSize: 13,
      fontWeight: "600",
    },
    dateText: {
      fontSize: 12,
    },
    divider: {
      height: 1,
      marginVertical: 4,
    },
    pageContent: {
      fontSize: 15,
      lineHeight: 24,
    },
    emptyContent: {
      fontSize: 14,
      fontStyle: "italic",
    },
    section: {
      gap: 8,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    input: {
      borderRadius: 16,
      borderWidth: 1,
      fontSize: 15,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    textarea: {
      minHeight: 200,
    },
    helperText: {
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
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    actionButton: {
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    actionText: {
      fontSize: 14,
      fontWeight: "600",
    },
    pressed: {
      opacity: 0.75,
    },
    editButtons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    cancelButton: {
      alignItems: "center",
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 50,
    },
    cancelButtonText: {
      fontSize: 15,
      fontWeight: "600",
    },
    saveButton: {
      alignItems: "center",
      borderRadius: 18,
      flex: 1,
      justifyContent: "center",
      minHeight: 50,
    },
    saveButtonDisabled: {
      opacity: 0.45,
    },
    saveButtonText: {
      fontSize: 15,
      fontWeight: "700",
    },
  });
}
