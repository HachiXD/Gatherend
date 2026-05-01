import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHandleFriendRequest } from "@/src/features/friends/hooks/use-handle-friend-request";
import { usePendingFriendRequests } from "@/src/features/friends/hooks/use-pending-friend-requests";
import { useSendFriendRequest } from "@/src/features/friends/hooks/use-send-friend-request";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

type FeedbackMessage = { type: "success" | "error"; text: string } | null;

export default function AddFriendScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [username, setUsername] = useState("");
  const [feedback, setFeedback] = useState<FeedbackMessage>(null);

  const { data: pendingRequests = [], isLoading: isLoadingRequests } =
    usePendingFriendRequests();

  const sendMutation = useSendFriendRequest();
  const handleMutation = useHandleFriendRequest();

  const handleSend = () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setFeedback({ type: "error", text: "Ingresa un usuario (ej. alex/g5x)" });
      return;
    }

    sendMutation.mutate(trimmed, {
      onSuccess: (data) => {
        setFeedback({
          type: "success",
          text: data.message || "¡Solicitud enviada!",
        });
        setUsername("");
        setTimeout(() => setFeedback(null), 3000);
      },
      onError: (err) => {
        setFeedback({
          type: "error",
          text: err instanceof Error ? err.message : "No se pudo enviar la solicitud",
        });
      },
    });
  };

  const handleAction = (friendshipId: string, action: "accept" | "reject") => {
    handleMutation.mutate({ friendshipId, action });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Agregar amigo</Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Send request section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              ENVIAR SOLICITUD
            </Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              Usa el formato usuario/discriminador (ej. alejandro/g5x)
            </Text>

            <View
              style={[
                styles.inputRow,
                {
                  borderColor: colors.borderPrimary,
                  backgroundColor: colors.bgEditForm,
                },
              ]}
            >
              <TextInput
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                editable={!sendMutation.isPending}
                onChangeText={(v) => {
                  setUsername(v);
                  if (feedback) setFeedback(null);
                }}
                onSubmitEditing={handleSend}
                placeholder="usuario/discriminador"
                placeholderTextColor={colors.textMuted}
                returnKeyType="send"
                style={[styles.input, { color: colors.textPrimary }]}
                value={username}
              />
              <Pressable
                disabled={sendMutation.isPending || !username.trim()}
                onPress={handleSend}
                style={({ pressed }) => [
                  styles.sendButton,
                  { backgroundColor: colors.tabButtonBg },
                  (sendMutation.isPending || !username.trim()) &&
                    styles.sendButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {sendMutation.isPending ? (
                  <ActivityIndicator color={colors.textPrimary} size="small" />
                ) : (
                  <Ionicons
                    name="person-add"
                    size={18}
                    color={colors.textPrimary}
                  />
                )}
              </Pressable>
            </View>

            {feedback ? (
              <View
                style={[
                  styles.feedbackBox,
                  feedback.type === "success"
                    ? {
                        borderColor: colors.channelTypeActiveSoftBg,
                        backgroundColor: colors.channelTypeActiveSoftBg,
                      }
                    : {
                        borderColor: "rgba(244,63,94,0.3)",
                        backgroundColor: "rgba(244,63,94,0.1)",
                      },
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    {
                      color:
                        feedback.type === "success"
                          ? colors.channelTypeActiveText
                          : "#fb7185",
                    },
                  ]}
                >
                  {feedback.text}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Pending requests section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              SOLICITUDES PENDIENTES
            </Text>

            {isLoadingRequests ? (
              <View style={styles.loadingState}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.skeletonRow,
                      {
                        borderColor: colors.borderPrimary,
                        backgroundColor: colors.bgEditForm,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : pendingRequests.length === 0 ? (
              <View
                style={[
                  styles.emptyState,
                  {
                    borderColor: colors.borderPrimary,
                    backgroundColor: colors.bgEditForm,
                  },
                ]}
              >
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Sin solicitudes pendientes
                </Text>
              </View>
            ) : (
              <View style={styles.requestList}>
                {pendingRequests.map((req) => (
                  <View
                    key={req.id}
                    style={[
                      styles.requestRow,
                      {
                        borderColor: colors.borderPrimary,
                        backgroundColor: colors.bgEditForm,
                      },
                    ]}
                  >
                    {req.requester.avatarAsset?.url ? (
                      <Image
                        contentFit="cover"
                        source={{ uri: req.requester.avatarAsset.url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatar,
                          styles.avatarFallback,
                          { backgroundColor: colors.bgQuaternary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarInitial,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {req.requester.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.requestCopy}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.requestUsername,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {req.requester.username}
                        <Text
                          style={[
                            styles.requestDiscriminator,
                            { color: colors.textMuted },
                          ]}
                        >
                          /{req.requester.discriminator}
                        </Text>
                      </Text>
                    </View>

                    <View style={styles.requestActions}>
                      <Pressable
                        disabled={handleMutation.isPending}
                        onPress={() => handleAction(req.id, "accept")}
                        style={({ pressed }) => [
                          styles.actionButton,
                          {
                            backgroundColor: colors.channelTypeActiveSoftBg,
                            borderColor: colors.channelTypeActiveSoftBg,
                          },
                          (handleMutation.isPending || pressed) && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={colors.channelTypeActiveText}
                        />
                      </Pressable>
                      <Pressable
                        disabled={handleMutation.isPending}
                        onPress={() => handleAction(req.id, "reject")}
                        style={({ pressed }) => [
                          styles.actionButton,
                          {
                            backgroundColor: colors.bgCancelButton,
                            borderColor: colors.borderPrimary,
                          },
                          (handleMutation.isPending || pressed) && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color={colors.textMuted}
                        />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      alignItems: "center",
      borderBottomColor: colors.borderPrimary,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingBottom: 14,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.bgQuaternary,
      borderColor: colors.borderPrimary,
      borderRadius: 16,
      borderWidth: 1,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    content: {
      gap: 24,
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    section: {
      gap: 8,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.8,
    },
    sectionHint: {
      fontSize: 13,
      lineHeight: 18,
    },
    inputRow: {
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    input: {
      flex: 1,
      fontSize: 14,
      height: 36,
    },
    sendButton: {
      alignItems: "center",
      borderRadius: 10,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    sendButtonDisabled: {
      opacity: 0.45,
    },
    feedbackBox: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    feedbackText: {
      fontSize: 13,
      fontWeight: "500",
    },
    loadingState: {
      gap: 8,
    },
    skeletonRow: {
      borderRadius: 10,
      borderWidth: 1,
      height: 56,
    },
    emptyState: {
      alignItems: "center",
      borderRadius: 10,
      borderStyle: "dashed",
      borderWidth: 1,
      paddingVertical: 24,
    },
    emptyText: {
      fontSize: 14,
    },
    requestList: {
      gap: 8,
    },
    requestRow: {
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    avatar: {
      borderRadius: 20,
      height: 36,
      width: 36,
    },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: {
      fontSize: 14,
      fontWeight: "700",
    },
    requestCopy: {
      flex: 1,
      minWidth: 0,
    },
    requestUsername: {
      fontSize: 14,
      fontWeight: "600",
    },
    requestDiscriminator: {
      fontSize: 13,
      fontWeight: "400",
    },
    requestActions: {
      flexDirection: "row",
      gap: 6,
    },
    actionButton: {
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
