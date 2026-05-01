import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useBoard } from "@/src/features/boards/hooks/use-board";
import { useUpdateInviteCode } from "@/src/features/invite/hooks/use-update-invite-code";
import { useTheme } from "@/src/theme/theme-provider";
import { authBaseUrl } from "@/src/lib/env";
import { Text } from "@/src/components/app-typography";

const MODERATOR_ROLES = new Set(["OWNER", "ADMIN"]);

export default function BoardInviteScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: board, isLoading } = useBoard(boardId);
  const { mutate: updateCode, isPending } = useUpdateInviteCode(boardId ?? "");

  const canManage = MODERATOR_ROLES.has(board?.currentMember?.role ?? "");
  const inviteUrl = board ? `${authBaseUrl}/invite/${board.inviteCode}` : "";

  const handleShare = () => {
    if (!board?.inviteEnabled || !inviteUrl) return;
    void Share.share({ message: inviteUrl, url: inviteUrl });
  };

  const handleSetEnabled = (next: boolean) => {
    if (!boardId || isPending) return;
    if (board?.inviteEnabled === next) return;
    updateCode(next ? "enable" : "disable");
  };

  const handleRegenerate = () => {
    if (!boardId || isPending) return;
    Alert.alert(
      "Regenerar código",
      "El link actual dejará de funcionar. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Regenerar",
          style: "destructive",
          onPress: () => updateCode("regenerate"),
        },
      ],
    );
  };

  if (isLoading || !board) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.accentPrimary} size="small" />
      </View>
    );
  }

  const linkDisabled = !board.inviteEnabled || isPending;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
    >
      {/* Enable / disable toggle — solo OWNER/ADMIN */}
      {canManage && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            PERMITIR INVITACIONES
          </Text>
          <View
            style={[
              styles.row,
              {
                borderColor: colors.borderPrimary,
                backgroundColor: colors.bgEditForm,
              },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Invitaciones habilitadas
            </Text>
            <View
              style={[styles.toggle, { borderColor: colors.borderPrimary }]}
            >
              <Pressable
                onPress={() => handleSetEnabled(true)}
                disabled={isPending}
                style={[
                  styles.toggleOption,
                  board.inviteEnabled
                    ? [
                        styles.toggleOptionActive,
                        { backgroundColor: colors.tabButtonBg },
                      ]
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.toggleOptionText,
                    {
                      color: board.inviteEnabled
                        ? colors.textPrimary
                        : colors.textMuted,
                    },
                  ]}
                >
                  Sí
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSetEnabled(false)}
                disabled={isPending}
                style={[
                  styles.toggleOption,
                  styles.toggleOptionRight,
                  { borderLeftColor: colors.borderPrimary },
                  !board.inviteEnabled
                    ? [
                        styles.toggleOptionActive,
                        { backgroundColor: colors.tabButtonBg },
                      ]
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.toggleOptionText,
                    {
                      color: !board.inviteEnabled
                        ? colors.textPrimary
                        : colors.textMuted,
                    },
                  ]}
                >
                  No
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Invite link */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          LINK DE INVITACIÓN
        </Text>

        <View
          style={[
            styles.linkBox,
            {
              borderColor: colors.borderPrimary,
              backgroundColor: colors.bgEditForm,
              opacity: linkDisabled ? 0.5 : 1,
            },
          ]}
        >
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.linkScroll}
          >
            <Text
              style={[styles.linkText, { color: colors.textPrimary }]}
              numberOfLines={1}
              selectable={!linkDisabled}
            >
              {inviteUrl}
            </Text>
          </ScrollView>
          <Pressable
            onPress={handleShare}
            disabled={linkDisabled}
            style={({ pressed }) => [
              styles.shareButton,
              { backgroundColor: colors.tabButtonBg },
              (linkDisabled || pressed) && styles.pressed,
            ]}
          >
            <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {!board.inviteEnabled && (
          <Text style={[styles.disabledNote, { color: colors.textMuted }]}>
            Las invitaciones están deshabilitadas. El link no funcionará.
          </Text>
        )}

        {/* Regenerate — solo OWNER/ADMIN */}
        {canManage && (
          <Pressable
            onPress={handleRegenerate}
            disabled={isPending || !board.inviteEnabled}
            style={({ pressed }) => [
              styles.regenerateButton,
              (isPending || !board.inviteEnabled) && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={14}
              color={colors.textMuted}
            />
            <Text style={[styles.regenerateText, { color: colors.textMuted }]}>
              {isPending ? "Actualizando..." : "Generar nuevo link"}
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      gap: 24,
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    centerState: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
    },
    section: {
      gap: 8,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.8,
    },
    row: {
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    rowLabel: {
      fontSize: 14,
    },
    toggle: {
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      overflow: "hidden",
    },
    toggleOption: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    toggleOptionRight: {
      borderLeftWidth: 1,
    },
    toggleOptionActive: {
      borderRadius: 0,
    },
    toggleOptionText: {
      fontSize: 13,
      fontWeight: "600",
    },
    linkBox: {
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    linkScroll: {
      flex: 1,
      minWidth: 0,
    },
    linkText: {
      fontFamily: "monospace",
      fontSize: 13,
    },
    shareButton: {
      alignItems: "center",
      borderRadius: 8,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    disabledNote: {
      fontSize: 12,
      lineHeight: 17,
    },
    regenerateButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: 5,
      paddingVertical: 4,
    },
    regenerateText: {
      fontSize: 12,
    },
    disabledButton: {
      opacity: 0.4,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
