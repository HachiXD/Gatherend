import { Image } from "expo-image";
import { memo, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLinkPreview } from "../hooks/use-link-preview";
import { useTheme } from "@/src/theme/theme-provider";
import { Text } from "@/src/components/app-typography";

// Mirror of the server-side RICH_PREVIEW_HOSTS allowlist.
// These are the only hosts the server fetches rich OG data for.
const TRUSTED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
]);

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isTrustedHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TRUSTED_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert("Error", "No se pudo abrir el enlace.");
  });
}

function handleTap(url: string) {
  if (isTrustedHost(url)) {
    openUrl(url);
    return;
  }

  Alert.alert(
    "Enlace externo",
    `¿Confías en este enlace?\n\n${url}`,
    [
      { text: "Cancelar", style: "cancel" },
      { text: "Abrir", style: "destructive", onPress: () => openUrl(url) },
    ],
    { cancelable: true },
  );
}

interface LinkPreviewCardProps {
  url: string;
}

export const LinkPreviewCard = memo(function LinkPreviewCard({
  url,
}: LinkPreviewCardProps) {
  const { colors } = useTheme();
  const { data, isLoading, isError } = useLinkPreview(url);
  const [imageError, setImageError] = useState(false);

  // Loading skeleton
  if (isLoading) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bgSecondary,
            borderColor: colors.borderPrimary,
          },
        ]}
      >
        <View style={styles.loadingRow}>
          <Ionicons color={colors.textMuted} name="link-outline" size={14} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Cargando vista previa...
          </Text>
        </View>
      </View>
    );
  }

  // Nothing to show
  if (isError || !data) return null;
  if (!data.title && !data.description && !data.image) return null;

  const hostname = getHostname(url);

  return (
    <Pressable
      onPress={() => handleTap(url)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.bgSecondary,
          borderColor: colors.borderPrimary,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* OG image */}
      {data.image ? (
        imageError ? (
          <View style={[styles.ogImage, styles.ogImageError, { backgroundColor: colors.bgTertiary }]}>
            <Text style={[styles.ogImageErrorText, { color: colors.textMuted }]}>
              No se encontró :(
            </Text>
          </View>
        ) : (
          <Image
            contentFit="cover"
            onError={() => setImageError(true)}
            source={{ uri: data.image }}
            style={styles.ogImage}
          />
        )
      ) : null}

      <View style={styles.body}>
        {/* Site row */}
        <View style={styles.siteRow}>
          <Ionicons color={colors.textMuted} name="link-outline" size={12} />
          <Text
            numberOfLines={1}
            style={[styles.hostname, { color: colors.textMuted }]}
          >
            {hostname}
          </Text>
        </View>

        {/* Title */}
        {data.title ? (
          <Text
            numberOfLines={2}
            style={[styles.title, { color: colors.textPrimary }]}
          >
            {data.title}
          </Text>
        ) : null}

        {/* Description */}
        {data.description ? (
          <Text
            numberOfLines={2}
            style={[styles.description, { color: colors.textMuted }]}
          >
            {data.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
    overflow: "hidden",
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    padding: 10,
  },
  loadingText: {
    fontSize: 12,
  },
  ogImage: {
    height: 140,
    width: "100%",
  },
  ogImageError: {
    alignItems: "center",
    justifyContent: "center",
  },
  ogImageErrorText: {
    fontSize: 13,
  },
  body: {
    gap: 3,
    padding: 10,
  },
  siteRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginBottom: 2,
  },
  hostname: {
    fontSize: 11,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
  },
});
