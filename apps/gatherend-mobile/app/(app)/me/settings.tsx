import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authClient } from "@/src/lib/auth-client";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import type { ClientProfile } from "@/src/features/profile/types/current-profile";
import { CURRENT_PROFILE_QUERY_KEY } from "@/src/features/profile/lib/current-profile-cache";
import { useSession } from "@/src/features/auth/hooks/use-session";
import { useSocket } from "@/src/providers/socket-context";
import { LEGAL_LINKS } from "@/src/lib/legal-links";
import {
  nextApiFetch,
  readNextApiError,
} from "@/src/services/next-api/next-api-fetch";
import { DEFAULT_BASE_COLOR, THEME_PRESETS } from "@/src/theme/presets";
import { getThemeBaseColor, normalizeThemeConfig } from "@/src/theme/runtime";
import { useTheme } from "@/src/theme/theme-provider";
import type { ThemeConfig, ThemeMode } from "@/src/theme/types";
import { isValidHexColor } from "@/src/theme/utils";
import ColorPicker, {
  HueSlider,
  Panel1,
} from "reanimated-color-picker";
import { Text, TextInput } from "@/src/components/app-typography";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = "none" | "theme" | "change-password";

function normalizeHexDraft(value: string): string {
  const withHash = value.startsWith("#") ? value : `#${value}`;
  return withHash.slice(0, 7).toUpperCase();
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const { signOut } = useSession();
  const { goOffline } = useSocket();
  const { colors, config, mode } = useTheme();
  const insets = useSafeAreaInsets();

  const [openSection, setOpenSection] = useState<Section>("none");

  const effectiveBaseColor = getThemeBaseColor(config);
  const [themeBaseColor, setThemeBaseColor] = useState(effectiveBaseColor);
  const [themeMode, setThemeMode] = useState<ThemeMode>(mode);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => {
    setThemeBaseColor(effectiveBaseColor);
    setThemeMode(mode);
  }, [effectiveBaseColor, mode]);

  // ── Change password state ─────────────────────────────────────────────────

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ── Delete account state ──────────────────────────────────────────────────

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // ── Logout ────────────────────────────────────────────────────────────────

  const [isSigningOut, setIsSigningOut] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function toggleSection(section: Section) {
    setOpenSection((prev) => (prev === section ? "none" : section));
    setPasswordError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleChangePassword() {
    setPasswordError(null);

    if (!currentPassword.trim()) {
      setPasswordError("Ingresa tu contraseña actual.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setIsSavingPassword(true);
      const { error } = await authClient.changePassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        revokeOtherSessions: true,
      });

      if (error) {
        setPasswordError(error.message ?? "Error al cambiar la contraseña.");
        return;
      }

      setOpenSection("none");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Contraseña cambiada", "Tu contraseña fue actualizada.");
    } catch {
      setPasswordError("Error inesperado. Intenta de nuevo.");
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleSaveTheme() {
    const normalizedColor = normalizeHexDraft(themeBaseColor);

    if (!isValidHexColor(normalizedColor)) {
      setThemeError("Ingresa un color hex valido, por ejemplo #2E8376.");
      return;
    }

    const themeConfig: ThemeConfig = {
      baseColor:
        normalizedColor !== DEFAULT_BASE_COLOR ? normalizedColor : undefined,
      mode: themeMode !== "dark" ? themeMode : undefined,
    };
    const normalizedConfig = normalizeThemeConfig(themeConfig);

    try {
      setThemeError(null);
      setIsSavingTheme(true);

      const response = await nextApiFetch("/api/profile/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseColor: normalizedConfig?.baseColor ?? null,
          mode: normalizedConfig?.mode ?? null,
          gradient: null,
        }),
      });

      if (!response.ok) {
        const message = await readNextApiError(
          response,
          "No se pudo guardar el tema.",
        );
        setThemeError(message);
        return;
      }

      const serverProfile = (await response.json()) as ClientProfile;
      queryClient.setQueryData<ClientProfile>(
        CURRENT_PROFILE_QUERY_KEY,
        (old) => (old ? { ...old, ...serverProfile } : serverProfile),
      );
      setOpenSection("none");
      Alert.alert("Tema actualizado", "Tu tema fue guardado.");
    } catch {
      setThemeError("Ocurrio un error inesperado.");
    } finally {
      setIsSavingTheme(false);
    }
  }

  function handleResetThemeDraft() {
    setThemeError(null);
    setThemeBaseColor(DEFAULT_BASE_COLOR);
    setThemeMode("dark");
  }

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      goOffline();
      await signOut();
      queryClient.clear();
      router.replace("/sign-in");
    } catch {
      setIsSigningOut(false);
      Alert.alert("Error", "No se pudo cerrar sesión.");
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Eliminar cuenta",
      "Esta acción es permanente. Tu cuenta será anonimizada y no podrás recuperarla. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeletingAccount(true);
              goOffline();

              const res = await nextApiFetch("/api/profile", {
                method: "DELETE",
              });

              if (!res.ok) {
                setIsDeletingAccount(false);
                Alert.alert("Error", "No se pudo eliminar la cuenta.");
                return;
              }

              try {
                await authClient.signOut();
              } catch {
                // Best-effort — session may already be invalid
              }

              queryClient.clear();
              router.replace("/sign-in");
            } catch {
              setIsDeletingAccount(false);
              Alert.alert("Error", "Ocurrió un error inesperado.");
            }
          },
        },
      ],
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.root, { backgroundColor: colors.bgPrimary }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 8, backgroundColor: colors.bgPrimary },
          ]}
        >
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons
              color={colors.textPrimary}
              name="chevron-back"
              size={24}
            />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Ajustes
          </Text>
          {/* Spacer to balance the back button */}
          <View style={styles.headerBtn} />
        </View>

        {/* ── Section: Cuenta ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cuenta</Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            <InfoRow
              label="Usuario"
              value={`${profile.username}/${profile.discriminator}`}
              colors={colors}
            />
            <View
              style={[
                styles.rowDivider,
                { backgroundColor: colors.borderPrimary },
              ]}
            />
            <InfoRow label="Email" value={profile.email} last colors={colors} />
          </View>
        </View>

        {/* ── Section: Seguridad ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Apariencia</Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            <Pressable
              onPress={() => toggleSection("theme")}
              style={({ pressed }) => [
                styles.actionRow,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons
                color={colors.textSubtle}
                name="color-palette-outline"
                size={18}
              />
              <View style={styles.actionRowBody}>
                <Text
                  style={[styles.actionRowTitle, { color: colors.textPrimary }]}
                >
                  Tema de la app
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.actionRowSubtext, { color: colors.textMuted }]}
                >
                  {themeMode === "light" ? "Claro" : "Oscuro"} -{" "}
                  {themeBaseColor.toUpperCase()}
                </Text>
              </View>
              <View
                style={[
                  styles.themePreviewSwatch,
                  {
                    backgroundColor: isValidHexColor(themeBaseColor)
                      ? themeBaseColor
                      : DEFAULT_BASE_COLOR,
                    borderColor: colors.borderPrimary,
                  },
                ]}
              />
              <Ionicons
                color={colors.textMuted}
                name={
                  openSection === "theme" ? "chevron-up" : "chevron-forward"
                }
                size={16}
              />
            </Pressable>

            {openSection === "theme" && (
              <View
                style={[
                  styles.themeForm,
                  { borderTopColor: colors.borderPrimary },
                ]}
              >
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Modo</Text>
                  <View
                    style={[
                      styles.segmentedControl,
                      { borderColor: colors.borderPrimary },
                    ]}
                  >
                    <Pressable
                      onPress={() => setThemeMode("dark")}
                      style={[
                        styles.segmentButton,
                        themeMode === "dark"
                          ? { backgroundColor: colors.channelTypeActiveBg }
                          : null,
                      ]}
                    >
                      <Ionicons
                        color={
                          themeMode === "dark"
                            ? colors.channelTypeActiveText
                            : colors.textSubtle
                        }
                        name="moon-outline"
                        size={16}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color:
                              themeMode === "dark"
                                ? colors.channelTypeActiveText
                                : colors.textSubtle,
                          },
                        ]}
                      >
                        Oscuro
                      </Text>
                    </Pressable>
                    <View
                      style={[
                        styles.segmentDivider,
                        { backgroundColor: colors.borderPrimary },
                      ]}
                    />
                    <Pressable
                      onPress={() => setThemeMode("light")}
                      style={[
                        styles.segmentButton,
                        themeMode === "light"
                          ? { backgroundColor: colors.channelTypeActiveBg }
                          : null,
                      ]}
                    >
                      <Ionicons
                        color={
                          themeMode === "light"
                            ? colors.channelTypeActiveText
                            : colors.textSubtle
                        }
                        name="sunny-outline"
                        size={16}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color:
                              themeMode === "light"
                                ? colors.channelTypeActiveText
                                : colors.textSubtle,
                          },
                        ]}
                      >
                        Claro
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Color base</Text>
                  <View style={styles.themeColorInputRow}>
                    <Pressable
                      onPress={() => setShowThemePicker((v) => !v)}
                      style={[
                        styles.themeColorSwatch,
                        {
                          backgroundColor: isValidHexColor(themeBaseColor)
                            ? themeBaseColor
                            : DEFAULT_BASE_COLOR,
                          borderColor: showThemePicker ? colors.channelTypeActiveBorder : colors.borderPrimary,
                        },
                      ]}
                    />
                    <TextInput
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!isSavingTheme}
                      onBlur={() => {
                        const normalized = normalizeHexDraft(themeBaseColor);
                        if (isValidHexColor(normalized)) {
                          setThemeBaseColor(normalized);
                        }
                      }}
                      onChangeText={(value) => {
                        setThemeError(null);
                        setThemeBaseColor(normalizeHexDraft(value));
                      }}
                      placeholder="#2E8376"
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.themeColorInput,
                        {
                          color: colors.textPrimary,
                          borderColor: colors.borderPrimary,
                          backgroundColor: colors.bgTertiary,
                        },
                      ]}
                      value={themeBaseColor}
                    />
                  </View>
                  <View style={showThemePicker ? null : styles.colorPickerCollapsed}>
                    <ColorPicker
                      value={
                        isValidHexColor(themeBaseColor)
                          ? themeBaseColor
                          : DEFAULT_BASE_COLOR
                      }
                      onCompleteJS={({ hex }) => {
                        setThemeError(null);
                        setThemeBaseColor(hex.slice(0, 7).toUpperCase());
                      }}
                      style={styles.colorPicker}
                    >
                      <Panel1 style={styles.colorPickerPanel} />
                      <HueSlider style={styles.colorPickerSlider} />
                    </ColorPicker>
                  </View>
                </View>

                <View style={styles.themePresetGrid}>
                  {THEME_PRESETS.map((preset) => {
                    const isSelected =
                      themeBaseColor.toUpperCase() === preset.baseColor;

                    return (
                      <Pressable
                        accessibilityLabel={preset.name}
                        key={preset.name}
                        onPress={() => {
                          setThemeError(null);
                          setThemeBaseColor(preset.baseColor);
                        }}
                        style={({ pressed }) => [
                          styles.themePresetButton,
                          {
                            backgroundColor: preset.baseColor,
                            borderColor: isSelected
                              ? colors.channelTypeActiveBorder
                              : colors.borderPrimary,
                            opacity: pressed ? 0.75 : 1,
                          },
                        ]}
                      >
                        {isSelected ? (
                          <Ionicons color="#fff" name="checkmark" size={14} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                {config?.gradient ? (
                  <Text style={[styles.themeHint, { color: colors.textMuted }]}>
                    Tu tema actual venia de un gradiente; mobile usa su primer
                    color como base solida.
                  </Text>
                ) : null}

                {themeError ? (
                  <Text style={styles.errorText}>{themeError}</Text>
                ) : null}

                <View style={styles.themeActions}>
                  <Pressable
                    disabled={isSavingTheme}
                    onPress={handleResetThemeDraft}
                    style={({ pressed }) => [
                      styles.secondaryThemeBtn,
                      {
                        backgroundColor: colors.bgTertiary,
                        borderColor: colors.borderPrimary,
                        opacity: pressed || isSavingTheme ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      color={colors.textSubtle}
                      name="refresh-outline"
                      size={16}
                    />
                    <Text
                      style={[
                        styles.secondaryThemeBtnText,
                        { color: colors.textSubtle },
                      ]}
                    >
                      Reset
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={isSavingTheme}
                    onPress={() => {
                      void handleSaveTheme();
                    }}
                    style={({ pressed }) => [
                      styles.primaryThemeBtn,
                      {
                        backgroundColor: colors.tabButtonBg,
                        opacity: pressed || isSavingTheme ? 0.75 : 1,
                      },
                    ]}
                  >
                    {isSavingTheme ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.primaryThemeBtnText}>
                        Guardar tema
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Seguridad</Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            {/* Cambiar contraseña — accordion */}
            <Pressable
              onPress={() => toggleSection("change-password")}
              style={({ pressed }) => [
                styles.actionRow,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons
                color={colors.textSubtle}
                name="lock-closed-outline"
                size={18}
              />
              <Text
                style={[styles.actionRowText, { color: colors.textPrimary }]}
              >
                Cambiar contraseña
              </Text>
              <Ionicons
                color={colors.textMuted}
                name={
                  openSection === "change-password"
                    ? "chevron-up"
                    : "chevron-forward"
                }
                size={16}
              />
            </Pressable>

            {openSection === "change-password" && (
              <View
                style={[
                  styles.passwordForm,
                  { borderTopColor: colors.borderPrimary },
                ]}
              >
                {/* Current password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Contraseña actual</Text>
                  <View style={styles.passwordInputRow}>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSavingPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="••••••••"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showCurrent}
                      style={[
                        styles.passwordInput,
                        {
                          color: colors.textPrimary,
                          borderColor: colors.borderPrimary,
                          backgroundColor: colors.bgTertiary,
                        },
                      ]}
                      value={currentPassword}
                    />
                    <Pressable
                      hitSlop={8}
                      onPress={() => setShowCurrent((v) => !v)}
                      style={styles.eyeBtn}
                    >
                      <Ionicons
                        color={colors.textMuted}
                        name={showCurrent ? "eye-off-outline" : "eye-outline"}
                        size={18}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* New password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Nueva contraseña</Text>
                  <View style={styles.passwordInputRow}>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSavingPassword}
                      onChangeText={setNewPassword}
                      placeholder="Mínimo 8 caracteres"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showNew}
                      style={[
                        styles.passwordInput,
                        {
                          color: colors.textPrimary,
                          borderColor: colors.borderPrimary,
                          backgroundColor: colors.bgTertiary,
                        },
                      ]}
                      value={newPassword}
                    />
                    <Pressable
                      hitSlop={8}
                      onPress={() => setShowNew((v) => !v)}
                      style={styles.eyeBtn}
                    >
                      <Ionicons
                        color={colors.textMuted}
                        name={showNew ? "eye-off-outline" : "eye-outline"}
                        size={18}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Confirm new password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Confirmar nueva contraseña
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSavingPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repite la nueva contraseña"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    style={[
                      styles.passwordInput,
                      {
                        color: colors.textPrimary,
                        borderColor: colors.borderPrimary,
                        backgroundColor: colors.bgTertiary,
                      },
                    ]}
                    value={confirmPassword}
                  />
                </View>

                {passwordError ? (
                  <Text style={styles.errorText}>{passwordError}</Text>
                ) : null}

                <Pressable
                  disabled={isSavingPassword}
                  onPress={() => {
                    void handleChangePassword();
                  }}
                  style={({ pressed }) => [
                    styles.savePasswordBtn,
                    {
                      backgroundColor: colors.tabButtonBg,
                      opacity: pressed || isSavingPassword ? 0.75 : 1,
                    },
                  ]}
                >
                  {isSavingPassword ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.savePasswordBtnText}>
                      Guardar contraseña
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Legal</Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            {LEGAL_LINKS.map((link, index) => (
              <View key={link.url}>
                <Pressable
                  onPress={() => {
                    void Linking.openURL(link.url);
                  }}
                  style={({ pressed }) => [
                    styles.actionRow,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Ionicons
                    color={colors.textSubtle}
                    name="document-text-outline"
                    size={18}
                  />
                  <Text
                    style={[
                      styles.actionRowText,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {link.title}
                  </Text>
                  <Ionicons
                    color={colors.textMuted}
                    name="open-outline"
                    size={16}
                  />
                </Pressable>
                {index < LEGAL_LINKS.length - 1 ? (
                  <View
                    style={[
                      styles.rowDivider,
                      { backgroundColor: colors.borderPrimary },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {/* ── Section: Sesión ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sesión</Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            <Pressable
              disabled={isSigningOut}
              onPress={() => {
                void handleSignOut();
              }}
              style={({ pressed }) => [
                styles.actionRow,
                { opacity: pressed || isSigningOut ? 0.75 : 1 },
              ]}
            >
              <Ionicons
                color={colors.textSubtle}
                name="log-out-outline"
                size={18}
              />
              <Text
                style={[styles.actionRowText, { color: colors.textPrimary }]}
              >
                Cerrar sesión
              </Text>
              {isSigningOut ? (
                <ActivityIndicator color={colors.textMuted} size="small" />
              ) : (
                <Ionicons
                  color={colors.textMuted}
                  name="chevron-forward"
                  size={16}
                />
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Section: Zona de peligro ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Zona de peligro</Text>
          <View style={[styles.card, styles.dangerCard]}>
            <Pressable
              disabled={isDeletingAccount}
              onPress={() => {
                void handleDeleteAccount();
              }}
              style={({ pressed }) => [
                styles.actionRow,
                { opacity: pressed || isDeletingAccount ? 0.75 : 1 },
              ]}
            >
              {isDeletingAccount ? (
                <ActivityIndicator color="#f87171" size="small" />
              ) : (
                <Ionicons color="#f87171" name="trash-outline" size={18} />
              )}
              <Text style={[styles.actionRowText, { color: "#f87171" }]}>
                Eliminar cuenta
              </Text>
              {!isDeletingAccount && (
                <Ionicons color="#f87171" name="chevron-forward" size={16} />
              )}
            </Pressable>
          </View>
          <Text style={[styles.dangerHint, { color: colors.textMuted }]}>
            Esta acción es permanente e irreversible. Tu cuenta será
            anonimizada.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  last = false,
  colors,
}: {
  label: string;
  value: string;
  last?: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={[styles.infoRow, last ? styles.infoRowLast : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[styles.infoValue, { color: colors.textPrimary }]}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    gap: 14,
  },

  // Header
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },

  // Sections
  section: {
    gap: 6,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  dangerCard: {
    backgroundColor: "rgba(239,68,68,0.07)",
    borderColor: "rgba(239,68,68,0.3)",
  },
  dangerHint: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 2,
  },

  // Info rows (read-only)
  infoRow: {
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 14,
  },

  // Action rows
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  actionRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  actionRowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionRowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  actionRowSubtext: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Theme form (accordion)
  themeForm: {
    borderTopWidth: 1,
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  themePreviewSwatch: {
    borderRadius: 8,
    borderWidth: 1,
    height: 24,
    width: 24,
  },
  segmentedControl: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    height: 40,
    overflow: "hidden",
  },
  segmentButton: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
  },
  segmentDivider: {
    width: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
  },
  themeColorInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  themeColorSwatch: {
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    width: 44,
  },
  themeColorInput: {
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    height: 44,
    letterSpacing: 0,
    paddingHorizontal: 12,
  },
  colorPickerCollapsed: {
    height: 0,
    overflow: "hidden",
  },
  colorPicker: {
    gap: 12,
    marginTop: 10,
  },
  colorPickerPanel: {
    borderRadius: 8,
    height: 180,
  },
  colorPickerSlider: {
    borderRadius: 8,
    height: 28,
  },
  themePresetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  themePresetButton: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  themeHint: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },
  themeActions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryThemeBtn: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryThemeBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  primaryThemeBtn: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    height: 44,
    justifyContent: "center",
  },
  primaryThemeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // Password form (accordion)
  passwordForm: {
    borderTopWidth: 1,
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  passwordInputRow: {
    alignItems: "center",
    flexDirection: "row",
    position: "relative",
  },
  passwordInput: {
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    height: 44,
    paddingHorizontal: 12,
    paddingRight: 44,
  },
  eyeBtn: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 0,
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "600",
  },
  savePasswordBtn: {
    alignItems: "center",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    marginTop: 2,
  },
  savePasswordBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
