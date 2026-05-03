import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useUpdateProfile } from "@/src/features/profile/hooks/use-update-profile";
import { useUsernameColorReducer } from "@/src/features/profile/hooks/use-username-color-reducer";
import { useUsernameValidation } from "@/src/features/profile/hooks/use-username-validation";
import { useProfileTags } from "@/src/features/profile/hooks/use-profile-tags";
import {
  normalizeChatBubbleStyle,
  EDITOR_DEFAULT_CHAT_BUBBLE_STYLE,
  type ChatBubbleStyle,
} from "@/src/features/profile/lib/chat-bubble-style";
import { useUpload } from "@/src/features/uploads/hooks/use-upload";
import {
  getStoredUploadValueFromAsset,
  getStoredUploadValueFromUploadedFile,
  parseStoredUploadValue,
} from "@/src/features/uploads/utils/upload-values";
import ColorPicker, { HueSlider, Panel1 } from "reanimated-color-picker";
import { getCardStyle } from "@/src/features/profile/components/profile-card-inline-view";
import { THEME_PRESETS } from "@/src/theme/presets";
import { useTheme } from "@/src/theme/theme-provider";
import { Text, TextInput } from "@/src/components/app-typography";

// ── Constants ────────────────────────────────────────────────────────────────

const BANNER_HEIGHT = 140;
const AVATAR_SIZE = 120;
const AVATAR_OVERLAP = AVATAR_SIZE / 2;

const AVAILABLE_LANGUAGES = [
  { value: "EN", label: "English" },
  { value: "ES", label: "Español" },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getImageName(uri: string) {
  const cleanUri = uri.split("?")[0] ?? uri;
  return cleanUri.split("/").pop() || `image-${Date.now()}.jpg`;
}

function getImageType(uri: string) {
  const ext = uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

const HEX_REGEX = /^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;
const DEFAULT_USERNAME_COLOR = "#B5B5B5";

function normalizeHexDraft(value: string): string {
  const withHash = value.startsWith("#") ? value : `#${value}`;
  return withHash.slice(0, 7).toUpperCase();
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router = useRouter();
  const profile = useProfile();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // ── Initial state ─────────────────────────────────────────────────────────

  const originalUsername = useRef(profile.username).current;

  const [username, setUsername] = useState(profile.username);
  const [badge, setBadge] = useState(profile.badge ?? "");
  const [avatarValue, setAvatarValue] = useState(() =>
    getStoredUploadValueFromAsset(profile.avatarAsset),
  );
  const [bannerValue, setBannerValue] = useState(() =>
    getStoredUploadValueFromAsset(profile.bannerAsset),
  );
  const [languages, setLanguages] = useState<string[]>(profile.languages);
  const [chatBubbleStyle, setChatBubbleStyle] = useState<ChatBubbleStyle>(
    () =>
      normalizeChatBubbleStyle(profile.chatBubbleStyle) ?? {
        ...EDITOR_DEFAULT_CHAT_BUBBLE_STYLE,
      },
  );
  const usernameColor = useUsernameColorReducer(profile.usernameColor);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showUsernameColorPicker, setShowUsernameColorPicker] = useState(false);
  const [showBubblePicker, setShowBubblePicker] = useState(false);
  const [cardBgColor, setCardBgColor] = useState(
    () => getCardStyle(profile.profileCardConfig).bg,
  );
  const [showCardBgPicker, setShowCardBgPicker] = useState(false);

  // ── Hooks ─────────────────────────────────────────────────────────────────

  const mutation = useUpdateProfile();

  const usernameValidation = useUsernameValidation({
    originalUsername,
    translations: {
      checking: "Verificando...",
      usernameTooShort: "Muy corto (mínimo 2 caracteres)",
      youllBe: "Disponible como",
      usernameNotAvailable: "Nombre de usuario no disponible",
      errorCheckingUsername: "Error al verificar disponibilidad",
    },
  });

  const profileTags = useProfileTags({
    initialTags: profile.profileTags,
    onError: (msg) => Alert.alert("Tags", msg),
  });

  const { uploadFile: uploadAvatarFile } = useUpload({
    onUploadError: (e) => Alert.alert("Error", e),
    onModerationBlock: (e) => Alert.alert("Bloqueado", e),
  });

  const { uploadFile: uploadBannerFile } = useUpload({
    onUploadError: (e) => Alert.alert("Error", e),
    onModerationBlock: (e) => Alert.alert("Bloqueado", e),
  });

  // ── Image picker ──────────────────────────────────────────────────────────

  const pickImage = useCallback(
    async (target: "avatar" | "banner") => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        mediaTypes: ["images"],
        quality: 0.9,
        aspect: target === "banner" ? [16, 5] : [1, 1],
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      const file = {
        uri: asset.uri,
        name: asset.fileName ?? getImageName(asset.uri),
        type: asset.mimeType ?? getImageType(asset.uri),
        size: asset.fileSize,
      };

      try {
        if (target === "avatar") {
          setUploadingAvatar(true);
          const uploaded = await uploadAvatarFile({
            file,
            context: "profile_avatar",
          });
          setAvatarValue(getStoredUploadValueFromUploadedFile(uploaded));
        } else {
          setUploadingBanner(true);
          const uploaded = await uploadBannerFile({
            file,
            context: "profile_banner",
          });
          setBannerValue(getStoredUploadValueFromUploadedFile(uploaded));
        }
      } finally {
        if (target === "avatar") setUploadingAvatar(false);
        else setUploadingBanner(false);
      }
    },
    [uploadAvatarFile, uploadBannerFile],
  );

  // ── Language toggle ───────────────────────────────────────────────────────

  const toggleLanguage = useCallback((lang: string) => {
    setLanguages((prev) => {
      if (prev.includes(lang)) {
        // Keep at least one language selected
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== lang);
      }
      return [...prev, lang];
    });
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────

  const isSaving = mutation.isPending;
  const normalizedUsernameColor = normalizeHexDraft(
    usernameColor.state.solidColor,
  );
  const isUsernameColorValid = HEX_REGEX.test(normalizedUsernameColor);
  const normalizedCardBgColor = normalizeHexDraft(cardBgColor);
  const isCardBgColorValid = HEX_REGEX.test(normalizedCardBgColor);
  const canSave =
    !isSaving &&
    !uploadingAvatar &&
    !uploadingBanner &&
    isUsernameColorValid &&
    isCardBgColorValid &&
    usernameValidation.status.valid &&
    !usernameValidation.status.checking;

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    const avatarData = parseStoredUploadValue(avatarValue);
    const bannerData = parseStoredUploadValue(bannerValue);

    await mutation.mutateAsync({
      username: username.trim(),
      badge: badge.trim() || null,
      avatarAssetId: avatarData?.assetId ?? profile.avatarAssetId,
      bannerAssetId: bannerData?.assetId ?? profile.bannerAssetId,
      languages,
      chatBubbleStyle,
      usernameColor: { type: "solid", color: normalizedUsernameColor },
      profileTags: profileTags.state.tags,
      profileCardConfig: {
        ...((profile.profileCardConfig as object | null) ?? {}),
        style: {
          ...((profile.profileCardConfig as { style?: object } | null)?.style ??
            {}),
          backgroundColor: normalizedCardBgColor,
        },
      },
    });

    router.back();
  }, [
    canSave,
    avatarValue,
    bannerValue,
    username,
    badge,
    profile.avatarAssetId,
    profile.bannerAssetId,
    languages,
    chatBubbleStyle,
    normalizedUsernameColor,
    normalizedCardBgColor,
    profileTags.state.tags,
    profile.profileCardConfig,
    mutation,
    router,
  ]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const avatarPreviewUrl =
    parseStoredUploadValue(avatarValue)?.url ?? profile.avatarAsset?.url;
  const bannerPreviewUrl =
    parseStoredUploadValue(bannerValue)?.url ?? profile.bannerAsset?.url;

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
        {/* ── Custom header ── */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 8,
              backgroundColor: colors.bgPrimary,
            },
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
            Editar perfil
          </Text>

          <Pressable
            disabled={!canSave}
            hitSlop={12}
            onPress={() => {
              void handleSave();
            }}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: canSave
                  ? colors.tabButtonBg
                  : colors.bgTertiary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar</Text>
            )}
          </Pressable>
        </View>

        {/* ── Hero: Banner + Avatar ── */}
        <View style={styles.heroContainer}>
          {/* Banner — tap to upload */}
          <Pressable
            disabled={uploadingBanner}
            onPress={() => {
              void pickImage("banner");
            }}
            style={styles.bannerPressable}
          >
            <View
              style={[styles.banner, { backgroundColor: colors.bgTertiary }]}
            >
              {bannerPreviewUrl ? (
                <Image
                  contentFit="cover"
                  source={{ uri: bannerPreviewUrl }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}

              {uploadingBanner ? (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color="#fff" size="large" />
                </View>
              ) : (
                <View style={styles.heroCameraBtn}>
                  <Ionicons color="#fff" name="camera-outline" size={16} />
                </View>
              )}
            </View>
          </Pressable>

          {/* Avatar — centered, overlapping banner bottom */}
          <View style={styles.avatarAnchor}>
            <Pressable
              disabled={uploadingAvatar}
              onPress={() => {
                void pickImage("avatar");
              }}
              style={styles.avatarPressable}
            >
              {avatarPreviewUrl ? (
                <Image
                  contentFit="cover"
                  source={{ uri: avatarPreviewUrl }}
                  style={[
                    styles.avatar,
                    {
                      borderColor: colors.bgPrimary,
                      backgroundColor: colors.bgSecondary,
                    },
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarFallback,
                    {
                      borderColor: colors.bgPrimary,
                      backgroundColor: colors.bgSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarInitial,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {profile.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              {uploadingAvatar && (
                <View style={styles.avatarUploadOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}

              <View
                style={[
                  styles.avatarCameraIcon,
                  { backgroundColor: colors.tabButtonBg },
                ]}
              >
                <Ionicons color="#fff" name="camera" size={16} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Section: Identidad ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Identidad</Text>
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nombre de usuario</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
                maxLength={20}
                onChangeText={(val) => {
                  setUsername(val);
                  usernameValidation.validate(val);
                }}
                placeholder="Nombre de usuario"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.textInput,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.borderPrimary,
                    backgroundColor: colors.bgTertiary,
                  },
                ]}
                value={username}
              />
              {usernameValidation.status.message ? (
                <Text
                  style={[
                    styles.validationMsg,
                    {
                      color: usernameValidation.status.valid
                        ? "#4ade80"
                        : "#f87171",
                    },
                  ]}
                >
                  {usernameValidation.status.message}
                </Text>
              ) : null}
            </View>

            <View
              style={[
                styles.fieldDivider,
                { backgroundColor: colors.borderPrimary },
              ]}
            />

            {/* Color del perfil */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Color del perfil</Text>
              <View style={styles.colorInputRow}>
                <Pressable
                  onPress={() => setShowCardBgPicker((v) => !v)}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: isCardBgColorValid
                        ? normalizedCardBgColor
                        : "#707070",
                      borderColor: showCardBgPicker
                        ? colors.channelTypeActiveBorder
                        : colors.borderPrimary,
                    },
                  ]}
                />
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!isSaving}
                  maxLength={7}
                  onBlur={() => {
                    if (isCardBgColorValid) {
                      setCardBgColor(normalizedCardBgColor);
                    }
                  }}
                  onChangeText={(value) => {
                    setCardBgColor(normalizeHexDraft(value));
                  }}
                  placeholder="#707070"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.textInput,
                    {
                      flex: 1,
                      color: colors.textPrimary,
                      borderColor: colors.borderPrimary,
                      backgroundColor: colors.bgTertiary,
                    },
                  ]}
                  value={cardBgColor}
                />
              </View>
              <View
                style={showCardBgPicker ? null : styles.colorPickerCollapsed}
              >
                <ColorPicker
                  value={isCardBgColorValid ? normalizedCardBgColor : "#707070"}
                  onCompleteJS={({ hex }) => {
                    setCardBgColor(hex.slice(0, 7).toUpperCase());
                  }}
                  style={styles.colorPicker}
                >
                  <Panel1 style={styles.colorPickerPanel} />
                  <HueSlider style={styles.colorPickerSlider} />
                </ColorPicker>
              </View>
              {!isCardBgColorValid ? (
                <Text style={[styles.validationMsg, { color: "#f87171" }]}>
                  Ingresa un color hex válido.
                </Text>
              ) : null}
            </View>

            <View
              style={[
                styles.fieldDivider,
                { backgroundColor: colors.borderPrimary },
              ]}
            />

            {/* Username color */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Color de tu insignia</Text>
              <View style={styles.colorInputRow}>
                <Pressable
                  onPress={() => setShowUsernameColorPicker((v) => !v)}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: isUsernameColorValid
                        ? normalizedUsernameColor
                        : DEFAULT_USERNAME_COLOR,
                      borderColor: showUsernameColorPicker
                        ? colors.channelTypeActiveBorder
                        : colors.borderPrimary,
                    },
                  ]}
                />
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!isSaving}
                  maxLength={7}
                  onBlur={() => {
                    if (isUsernameColorValid) {
                      usernameColor.actions.setSolidColor(
                        normalizedUsernameColor,
                      );
                    }
                  }}
                  onChangeText={(value) => {
                    usernameColor.actions.setSolidColor(
                      normalizeHexDraft(value),
                    );
                  }}
                  placeholder="#B5B5B5"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.textInput,
                    {
                      flex: 1,
                      color: colors.textPrimary,
                      borderColor: colors.borderPrimary,
                      backgroundColor: colors.bgTertiary,
                    },
                  ]}
                  value={usernameColor.state.solidColor}
                />
              </View>

              <View style={styles.colorPresetGrid}>
                {[
                  DEFAULT_USERNAME_COLOR,
                  ...THEME_PRESETS.map((preset) => preset.baseColor),
                ].map((presetColor) => {
                  const isSelected =
                    normalizedUsernameColor === presetColor.toUpperCase();

                  return (
                    <Pressable
                      accessibilityLabel={`Color ${presetColor}`}
                      key={presetColor}
                      onPress={() => {
                        usernameColor.actions.setSolidColor(presetColor);
                      }}
                      style={({ pressed }) => [
                        styles.colorPresetButton,
                        {
                          backgroundColor: presetColor,
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

              <View
                style={
                  showUsernameColorPicker ? null : styles.colorPickerCollapsed
                }
              >
                <ColorPicker
                  value={
                    isUsernameColorValid
                      ? normalizedUsernameColor
                      : DEFAULT_USERNAME_COLOR
                  }
                  onCompleteJS={({ hex }) => {
                    usernameColor.actions.setSolidColor(
                      hex.slice(0, 7).toUpperCase(),
                    );
                  }}
                  style={styles.colorPicker}
                >
                  <Panel1 style={styles.colorPickerPanel} />
                  <HueSlider style={styles.colorPickerSlider} />
                </ColorPicker>
              </View>

              {!isUsernameColorValid ? (
                <Text style={[styles.validationMsg, { color: "#f87171" }]}>
                  Ingresa un color hex valido.
                </Text>
              ) : null}
            </View>

            <View
              style={[
                styles.fieldDivider,
                { backgroundColor: colors.borderPrimary },
              ]}
            />

            {/* Badge */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Badge</Text>
              <TextInput
                autoCorrect={false}
                editable={!isSaving}
                maxLength={30}
                onChangeText={setBadge}
                placeholder="Sin badge"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.textInput,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.borderPrimary,
                    backgroundColor: colors.bgTertiary,
                  },
                ]}
                value={badge}
              />
            </View>
          </View>
        </View>

        {/* ── Section: Tags ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tags</Text>
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            {profileTags.state.tags.length > 0 && (
              <View style={styles.tagsWrap}>
                {profileTags.state.tags.map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => profileTags.actions.removeTag(tag)}
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: colors.bgTertiary,
                        borderColor: colors.borderPrimary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagChipText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {tag}
                    </Text>
                    <Ionicons color={colors.textMuted} name="close" size={12} />
                  </Pressable>
                ))}
              </View>
            )}

            {profileTags.state.canAddMore && (
              <View style={styles.tagInputRow}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSaving}
                  maxLength={profileTags.state.maxTagLength}
                  onChangeText={profileTags.actions.setInput}
                  onSubmitEditing={() => {
                    profileTags.actions.addTag(profileTags.state.input);
                  }}
                  placeholder="Agregar tag..."
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  style={[
                    styles.tagInput,
                    {
                      color: colors.textPrimary,
                      borderColor: colors.borderPrimary,
                      backgroundColor: colors.bgTertiary,
                    },
                  ]}
                  value={profileTags.state.input}
                />
                <Pressable
                  disabled={!profileTags.state.input.trim() || isSaving}
                  onPress={() =>
                    profileTags.actions.addTag(profileTags.state.input)
                  }
                  style={({ pressed }) => [
                    styles.tagAddBtn,
                    {
                      backgroundColor: colors.tabButtonBg,
                      opacity:
                        pressed || !profileTags.state.input.trim() ? 0.55 : 1,
                    },
                  ]}
                >
                  <Ionicons color="#fff" name="add" size={20} />
                </Pressable>
              </View>
            )}

            <Text style={[styles.tagCount, { color: colors.textMuted }]}>
              {profileTags.state.count}/{profileTags.state.maxTags} tags · Toca
              un tag para eliminarlo
            </Text>
          </View>
        </View>

        {/* ── Section: Idiomas ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Idiomas</Text>
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            <View style={styles.languageRow}>
              {AVAILABLE_LANGUAGES.map((lang) => {
                const active = languages.includes(lang.value);
                return (
                  <Pressable
                    key={lang.value}
                    onPress={() => toggleLanguage(lang.value)}
                    style={({ pressed }) => [
                      styles.langToggle,
                      {
                        backgroundColor: active
                          ? colors.tabButtonBg
                          : colors.bgTertiary,
                        borderColor: active
                          ? colors.tabButtonBg
                          : colors.borderPrimary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.langToggleText,
                        { color: active ? "#fff" : colors.textSubtle },
                      ]}
                    >
                      {lang.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Section: Burbuja de chat ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Burbuja de chat</Text>
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderPrimary,
              },
            ]}
          >
            {/* Background color */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Color de tu burbuja</Text>
              <View style={styles.colorInputRow}>
                <Pressable
                  onPress={() => setShowBubblePicker((v) => !v)}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor:
                        chatBubbleStyle.background ?? "transparent",
                      borderColor: showBubblePicker
                        ? colors.channelTypeActiveBorder
                        : colors.borderPrimary,
                    },
                  ]}
                >
                  {!chatBubbleStyle.background && (
                    <Ionicons
                      color={colors.textMuted}
                      name="close-outline"
                      size={18}
                    />
                  )}
                </Pressable>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSaving}
                  maxLength={7}
                  onChangeText={(val) =>
                    setChatBubbleStyle((s) => ({
                      ...s,
                      background: val || null,
                    }))
                  }
                  onBlur={(e) => {
                    const v = e.nativeEvent.text.trim();
                    setChatBubbleStyle((s) => ({
                      ...s,
                      background: HEX_REGEX.test(v) ? v : null,
                    }));
                  }}
                  placeholder="#sin color"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.textInput,
                    {
                      flex: 1,
                      color: colors.textPrimary,
                      borderColor: colors.borderPrimary,
                      backgroundColor: colors.bgTertiary,
                    },
                  ]}
                  value={chatBubbleStyle.background ?? ""}
                />
              </View>
              <View
                style={showBubblePicker ? null : styles.colorPickerCollapsed}
              >
                <ColorPicker
                  value={
                    HEX_REGEX.test(chatBubbleStyle.background ?? "")
                      ? chatBubbleStyle.background!
                      : "#B5B5B5"
                  }
                  onCompleteJS={({ hex }) => {
                    setChatBubbleStyle((s) => ({
                      ...s,
                      background: hex.slice(0, 7),
                    }));
                  }}
                  style={styles.colorPicker}
                >
                  <Panel1 style={styles.colorPickerPanel} />
                  <HueSlider style={styles.colorPickerSlider} />
                </ColorPicker>
              </View>
            </View>

            <View
              style={[
                styles.fieldDivider,
                { backgroundColor: colors.borderPrimary },
              ]}
            />

            {/* Rounded / Square */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Esquinas</Text>
              <View style={styles.segmentRow}>
                <Pressable
                  onPress={() =>
                    setChatBubbleStyle((s) => ({ ...s, roundedEnabled: true }))
                  }
                  style={[
                    styles.segmentBtn,
                    styles.segmentBtnLeft,
                    {
                      borderColor: colors.borderPrimary,
                      backgroundColor: chatBubbleStyle.roundedEnabled
                        ? colors.tabButtonBg
                        : colors.bgTertiary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      {
                        color: chatBubbleStyle.roundedEnabled
                          ? "#fff"
                          : colors.textSubtle,
                      },
                    ]}
                  >
                    Redondeadas
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setChatBubbleStyle((s) => ({ ...s, roundedEnabled: false }))
                  }
                  style={[
                    styles.segmentBtn,
                    styles.segmentBtnRight,
                    {
                      borderColor: colors.borderPrimary,
                      backgroundColor: !chatBubbleStyle.roundedEnabled
                        ? colors.tabButtonBg
                        : colors.bgTertiary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      {
                        color: !chatBubbleStyle.roundedEnabled
                          ? "#fff"
                          : colors.textSubtle,
                      },
                    ]}
                  >
                    Cuadradas
                  </Text>
                </Pressable>
              </View>
            </View>

            <View
              style={[
                styles.fieldDivider,
                { backgroundColor: colors.borderPrimary },
              ]}
            />

            {/* Shadow */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sombra</Text>
              <View style={styles.segmentRow}>
                <Pressable
                  onPress={() =>
                    setChatBubbleStyle((s) => ({ ...s, shadowEnabled: true }))
                  }
                  style={[
                    styles.segmentBtn,
                    styles.segmentBtnLeft,
                    {
                      borderColor: colors.borderPrimary,
                      backgroundColor: chatBubbleStyle.shadowEnabled
                        ? colors.tabButtonBg
                        : colors.bgTertiary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      {
                        color: chatBubbleStyle.shadowEnabled
                          ? "#fff"
                          : colors.textSubtle,
                      },
                    ]}
                  >
                    Con sombra
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setChatBubbleStyle((s) => ({ ...s, shadowEnabled: false }))
                  }
                  style={[
                    styles.segmentBtn,
                    styles.segmentBtnRight,
                    {
                      borderColor: colors.borderPrimary,
                      backgroundColor: !chatBubbleStyle.shadowEnabled
                        ? colors.tabButtonBg
                        : colors.bgTertiary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      {
                        color: !chatBubbleStyle.shadowEnabled
                          ? "#fff"
                          : colors.textSubtle,
                      },
                    ]}
                  >
                    Sin sombra
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
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
  saveBtn: {
    alignItems: "center",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    minWidth: 80,
    paddingHorizontal: 14,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Hero
  heroContainer: {
    alignItems: "center",
    marginHorizontal: -16,
  },
  bannerPressable: {
    width: "100%",
  },
  banner: {
    height: BANNER_HEIGHT,
    overflow: "hidden",
    width: "100%",
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.52)",
    justifyContent: "center",
  },
  heroCameraBtn: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    bottom: 10,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: 22,
    width: 34,
  },
  avatarAnchor: {
    marginTop: -AVATAR_OVERLAP,
    zIndex: 2,
  },
  avatarPressable: {
    position: "relative",
  },
  avatar: {
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    height: AVATAR_SIZE,
    overflow: "hidden",
    width: AVATAR_SIZE,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: "800",
  },
  avatarUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: "center",
  },
  avatarCameraIcon: {
    alignItems: "center",
    borderRadius: 14,
    bottom: 4,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 10,
    width: 28,
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
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Fields
  fieldGroup: {
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  fieldDivider: {
    height: 1,
    marginHorizontal: 14,
  },
  textInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: "500",
    height: 44,
    paddingHorizontal: 12,
  },
  validationMsg: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },

  // Color picker row
  colorInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  colorSwatch: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  colorPresetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorPresetButton: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    width: 34,
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

  // Tags
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  tagChip: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tagInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  tagInput: {
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    height: 42,
    paddingHorizontal: 12,
  },
  tagAddBtn: {
    alignItems: "center",
    borderRadius: 10,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  tagCount: {
    fontSize: 11,
    fontWeight: "600",
    paddingBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 6,
  },

  // Languages
  languageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  langToggle: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  langToggleText: {
    fontSize: 14,
    fontWeight: "700",
  },

  // Segment toggles (chat bubble style)
  segmentRow: {
    borderRadius: 10,
    flexDirection: "row",
    overflow: "hidden",
  },
  segmentBtn: {
    alignItems: "center",
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 9,
  },
  segmentBtnLeft: {
    borderBottomLeftRadius: 10,
    borderRightWidth: 0,
    borderTopLeftRadius: 10,
  },
  segmentBtnRight: {
    borderBottomRightRadius: 10,
    borderLeftWidth: 0,
    borderTopRightRadius: 10,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
