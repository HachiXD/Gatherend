import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "@/src/components/app-typography";
import { ProfileCardInlineView, getCardStyle } from "@/src/features/profile/components/profile-card-inline-view";
import { useUpdateProfile } from "@/src/features/profile/hooks/use-update-profile";
import {
  buildProfileCardConfigFromDraft,
  createBoardImageAssetFromUpload,
  createInitialProfileCardDraft,
  type ProfileCardEditorDraft,
  type ProfileCardImageSlot,
} from "@/src/features/profile/lib/card/profile-card-draft";
import { useProfile } from "@/src/features/profile/providers/current-profile-provider";
import { useUpload } from "@/src/features/uploads/hooks/use-upload";
import ColorPicker, {
  HueSlider,
  Panel1,
} from "reanimated-color-picker";
import { useTheme } from "@/src/theme/theme-provider";

const HEX_REGEX = /^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

const IMAGE_SLOT_LABELS: Record<ProfileCardImageSlot, string> = {
  leftTopImage: "Imagen superior",
  leftBottomRightTopImage: "Imagen media",
  leftBottomRightBottomImage: "Imagen inferior",
  rightTopImage: "Imagen destacada A",
  rightBottomImage: "Imagen destacada B",
};

function getImageName(uri: string) {
  const cleanUri = uri.split("?")[0] ?? uri;
  return cleanUri.split("/").pop() || `profile-card-${Date.now()}.jpg`;
}

function getImageType(uri: string) {
  const ext = uri.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function normalizeHex(value: string, fallback: string) {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const normalized = withHash.slice(0, 7);
  return HEX_REGEX.test(normalized) ? normalized : fallback;
}

function updateDraftStyle(
  draft: ProfileCardEditorDraft,
  field: keyof ProfileCardEditorDraft["style"],
  value: string | boolean,
): ProfileCardEditorDraft {
  return {
    ...draft,
    style: {
      ...draft.style,
      [field]: value,
    },
  };
}

function updateDraftContent(
  draft: ProfileCardEditorDraft,
  field: keyof ProfileCardEditorDraft["content"],
  value: string,
): ProfileCardEditorDraft {
  return {
    ...draft,
    content: {
      ...draft.content,
      [field]: value,
    },
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
        {title}
      </Text>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.bgSecondary,
            borderColor: colors.borderPrimary,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <TextInput
        autoCorrect={false}
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.textInput,
          multiline ? styles.textArea : null,
          {
            backgroundColor: colors.bgTertiary,
            borderColor: colors.borderPrimary,
            color: colors.textPrimary,
          },
        ]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.fieldDivider, { backgroundColor: colors.borderPrimary }]}
    />
  );
}

function ToggleButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleButton,
        {
          backgroundColor: active ? colors.tabButtonBg : colors.bgTertiary,
          borderColor: active ? colors.tabButtonBg : colors.borderPrimary,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.toggleButtonText,
          { color: active ? "#fff" : colors.textSubtle },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  const [draftValue, setDraftValue] = useState(value);
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <View style={styles.colorRow}>
        <Pressable
          onPress={() => setShowPicker((v) => !v)}
          style={[
            styles.swatch,
            { backgroundColor: value, borderColor: showPicker ? colors.channelTypeActiveBorder : colors.borderPrimary },
          ]}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          onBlur={() => {
            const normalized = normalizeHex(draftValue, value);
            setDraftValue(normalized);
            onChange(normalized);
          }}
          onChangeText={(next) => {
            setDraftValue(next);
            if (HEX_REGEX.test(next)) {
              onChange(next);
            }
          }}
          placeholder="#707070"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.textInput,
            styles.colorInput,
            {
              backgroundColor: colors.bgTertiary,
              borderColor: colors.borderPrimary,
              color: colors.textPrimary,
            },
          ]}
          value={draftValue}
        />
      </View>
      <View style={showPicker ? null : styles.colorPickerCollapsed}>
        <ColorPicker
          value={HEX_REGEX.test(value) ? value : "#707070"}
          onCompleteJS={({ hex }) => {
            const normalized = hex.slice(0, 7).toUpperCase();
            setDraftValue(normalized);
            onChange(normalized);
          }}
          style={styles.colorPicker}
        >
          <Panel1 style={styles.colorPickerPanel} />
          <HueSlider style={styles.colorPickerSlider} />
        </ColorPicker>
      </View>
    </View>
  );
}

function ImageSlotEditor({
  slot,
  draft,
  uploadingSlot,
  onPick,
  onClear,
}: {
  slot: ProfileCardImageSlot;
  draft: ProfileCardEditorDraft;
  uploadingSlot: ProfileCardImageSlot | null;
  onPick: (slot: ProfileCardImageSlot) => void;
  onClear: (slot: ProfileCardImageSlot) => void;
}) {
  const { colors } = useTheme();
  const asset = draft.images[slot].asset;
  const isUploading = uploadingSlot === slot;

  return (
    <View style={styles.imageSlot}>
      <View style={styles.imageSlotHeader}>
        <Text style={[styles.imageSlotTitle, { color: colors.textSubtle }]}>
          {IMAGE_SLOT_LABELS[slot]}
        </Text>
        {asset ? (
          <Pressable
            disabled={isUploading}
            hitSlop={8}
            onPress={() => onClear(slot)}
          >
            <Ionicons color={colors.textMuted} name="close" size={18} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        disabled={isUploading}
        onPress={() => onPick(slot)}
        style={({ pressed }) => [
          styles.imagePicker,
          {
            backgroundColor: colors.bgTertiary,
            borderColor: colors.borderPrimary,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        {asset?.url ? (
          <Image
            contentFit="cover"
            source={{ uri: asset.url }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.imagePickerOverlay}>
          {isUploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons color="#fff" name="image-outline" size={18} />
              <Text style={styles.imagePickerText}>
                {asset ? "Reemplazar" : "Subir imagen"}
              </Text>
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}

export default function EditWallScreen() {
  const router = useRouter();
  const profile = useProfile();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const mutation = useUpdateProfile();
  const { uploadFile } = useUpload({
    onUploadError: (error) => Alert.alert("Error", error),
    onModerationBlock: (reason) => Alert.alert("Bloqueado", reason),
  });
  const [draft, setDraft] = useState(() =>
    createInitialProfileCardDraft(profile),
  );
  const [uploadingSlot, setUploadingSlot] =
    useState<ProfileCardImageSlot | null>(null);

  const isSaving = mutation.isPending;
  const isBusy = isSaving || uploadingSlot !== null;

  const previewProfile = useMemo(() => {
    const { config } = buildProfileCardConfigFromDraft(draft);
    return {
      id: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatarAsset: profile.avatarAsset,
      bannerAsset: profile.bannerAsset,
      usernameColor: profile.usernameColor,
      usernameFormat: profile.usernameFormat,
      badge: profile.badge,
      badgeSticker: profile.badgeSticker,
      profileTags: profile.profileTags,
      profileCardConfig: config,
      profileCardLeftTopImageAsset: draft.images.leftTopImage.asset,
      profileCardLeftBottomRightTopImageAsset:
        draft.images.leftBottomRightTopImage.asset,
      profileCardLeftBottomRightBottomImageAsset:
        draft.images.leftBottomRightBottomImage.asset,
      profileCardRightTopImageAsset: draft.images.rightTopImage.asset,
      profileCardRightBottomImageAsset: draft.images.rightBottomImage.asset,
      reputationScore: profile.reputationScore,
      languages: profile.languages,
    };
  }, [draft, profile]);

  const pickImage = useCallback(
    async (slot: ProfileCardImageSlot) => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        mediaTypes: ["images"],
        quality: 0.9,
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
        setUploadingSlot(slot);
        const uploaded = await uploadFile({
          file,
          context: "profile_card_image",
        });
        const imageAsset = createBoardImageAssetFromUpload(uploaded);
        setDraft((current) => ({
          ...current,
          images: {
            ...current.images,
            [slot]: {
              assetId: uploaded.assetId,
              asset: imageAsset,
            },
          },
        }));
      } finally {
        setUploadingSlot(null);
      }
    },
    [uploadFile],
  );

  const clearImage = useCallback((slot: ProfileCardImageSlot) => {
    setDraft((current) => ({
      ...current,
      content: {
        ...current.content,
        ...(slot === "rightTopImage" ? { rightTopImageTitle: "" } : {}),
        ...(slot === "rightBottomImage" ? { rightBottomImageTitle: "" } : {}),
      },
      images: {
        ...current.images,
        [slot]: { assetId: null, asset: null },
      },
    }));
  }, []);

  const save = useCallback(async () => {
    const { config, error } = buildProfileCardConfigFromDraft(draft);
    if (error) {
      Alert.alert("Muro", error);
      return;
    }

    try {
      await mutation.mutateAsync({
        profileCardConfig: config,
        profileCardLeftTopImageAssetId: draft.images.leftTopImage.assetId,
        profileCardLeftBottomRightTopImageAssetId:
          draft.images.leftBottomRightTopImage.assetId,
        profileCardLeftBottomRightBottomImageAssetId:
          draft.images.leftBottomRightBottomImage.assetId,
        profileCardRightTopImageAssetId: draft.images.rightTopImage.assetId,
        profileCardRightBottomImageAssetId:
          draft.images.rightBottomImage.assetId,
      });
      router.back();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo guardar el muro.",
      );
    }
  }, [draft, mutation, router]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.root, { backgroundColor: colors.bgPrimary }]}
    >
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.bgPrimary,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerIconButton,
            { opacity: pressed ? 0.62 : 1 },
          ]}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={24} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Editar muro
        </Text>
        <Pressable
          disabled={isBusy}
          hitSlop={12}
          onPress={() => {
            void save();
          }}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: isBusy ? colors.bgTertiary : colors.tabButtonBg,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Section title="Vista previa">
          <View style={[styles.previewWrap, { backgroundColor: getCardStyle(previewProfile.profileCardConfig).bg }]}>
            <ProfileCardInlineView profile={previewProfile} />
          </View>
        </Section>

        <Section title="Estilo">
          <ColorField
            label="Color de las cajas"
            value={draft.style.boxColor}
            onChange={(value) =>
              setDraft((current) => updateDraftStyle(current, "boxColor", value))
            }
          />
          <Divider />
          <View style={styles.toggleRow}>
            <ToggleButton
              active={draft.style.rounded}
              label="Redondeado"
              onPress={() =>
                setDraft((current) =>
                  updateDraftStyle(current, "rounded", !current.style.rounded),
                )
              }
            />
            <ToggleButton
              active={draft.style.shadows}
              label="Sombra"
              onPress={() =>
                setDraft((current) =>
                  updateDraftStyle(current, "shadows", !current.style.shadows),
                )
              }
            />
          </View>
        </Section>

        <Section title="Contenido">
          <Field
            label="Titulo principal"
            maxLength={40}
            onChangeText={(value) =>
              setDraft((current) =>
                updateDraftContent(current, "pageTitle", value),
              )
            }
            placeholder="Introduce un titulo para tu perfil"
            value={draft.content.pageTitle}
          />
          <Divider />
          <Field
            label="Titulo superior"
            maxLength={10}
            onChangeText={(value) =>
              setDraft((current) =>
                updateDraftContent(current, "leftTopTextTitle", value),
              )
            }
            placeholder="Opcional"
            value={draft.content.leftTopTextTitle}
          />
          <Field
            label="Texto superior"
            maxLength={280}
            multiline
            onChangeText={(value) =>
              setDraft((current) =>
                updateDraftContent(current, "leftTopTextContent", value),
              )
            }
            placeholder="Escribe algo interesante"
            value={draft.content.leftTopTextContent}
          />
          <Divider />
          <Field
            label="Seccion A"
            maxLength={10}
            onChangeText={(value) =>
              setDraft((current) =>
                updateDraftContent(current, "sectionATitle", value),
              )
            }
            placeholder="Titulo"
            value={draft.content.sectionATitle}
          />
          <Field
            label="Contenido A"
            maxLength={280}
            multiline
            onChangeText={(value) =>
              setDraft((current) =>
                updateDraftContent(current, "sectionAContent", value),
              )
            }
            placeholder="Escribe algo interesante"
            value={draft.content.sectionAContent}
          />
          <Divider />
          <Field
            label="Seccion B"
            maxLength={10}
            onChangeText={(value) =>
              setDraft((current) =>
                updateDraftContent(current, "sectionBTitle", value),
              )
            }
            placeholder="Titulo"
            value={draft.content.sectionBTitle}
          />
          <Field
            label="Contenido B"
            maxLength={280}
            multiline
            onChangeText={(value) =>
              setDraft((current) =>
                updateDraftContent(current, "sectionBContent", value),
              )
            }
            placeholder="Escribe algo interesante"
            value={draft.content.sectionBContent}
          />
        </Section>

        <Section title="Imagenes">
          <View style={styles.imageGrid}>
            {(
              [
                "leftTopImage",
                "leftBottomRightTopImage",
                "leftBottomRightBottomImage",
                "rightTopImage",
                "rightBottomImage",
              ] as ProfileCardImageSlot[]
            ).map((slot) => (
              <ImageSlotEditor
                key={slot}
                draft={draft}
                onClear={clearImage}
                onPick={(nextSlot) => {
                  void pickImage(nextSlot);
                }}
                slot={slot}
                uploadingSlot={uploadingSlot}
              />
            ))}
          </View>
          <Divider />
          <Field
            label="Titulo imagen A"
            maxLength={10}
            onChangeText={(value) =>
              setDraft((current) =>
                updateDraftContent(current, "rightTopImageTitle", value),
              )
            }
            placeholder="Opcional"
            value={draft.content.rightTopImageTitle}
          />
          <Field
            label="Titulo imagen B"
            maxLength={10}
            onChangeText={(value) =>
              setDraft((current) =>
                updateDraftContent(current, "rightBottomImageTitle", value),
              )
            }
            placeholder="Opcional"
            value={draft.content.rightBottomImageTitle}
          />
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  colorInput: {
    flex: 1,
  },
  colorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
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
  fieldDivider: {
    height: 1,
    marginHorizontal: 14,
  },
  fieldGroup: {
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  headerBar: {
    alignItems: "center",
    flexDirection: "row",
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerIconButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  imageGrid: {
    gap: 10,
    padding: 14,
  },
  imagePicker: {
    borderRadius: 12,
    borderWidth: 1,
    height: 118,
    overflow: "hidden",
  },
  imagePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.34)",
    gap: 5,
    justifyContent: "center",
  },
  imagePickerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  imageSlot: {
    gap: 6,
  },
  imageSlotHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  imageSlotTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  previewWrap: {
    padding: 10,
  },
  root: {
    flex: 1,
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    minWidth: 80,
    paddingHorizontal: 14,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  scrollContent: {
    gap: 14,
    paddingHorizontal: 16,
  },
  section: {
    gap: 6,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  swatch: {
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    width: 44,
  },
  textArea: {
    height: 96,
    paddingTop: 11,
  },
  textInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: "600",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  toggleButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
});
