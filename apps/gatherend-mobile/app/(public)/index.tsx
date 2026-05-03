import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { Pressable, Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/src/components/app-typography";
import { useSession } from "@/src/features/auth/hooks/use-session";
import { LEGAL_LINKS } from "@/src/lib/legal-links";
import { hideStartupSplash } from "@/src/lib/startup-splash";
import { BRAND_COLORS } from "@/src/theme/brand-colors";

export default function PublicIndexScreen() {
  const router = useRouter();
  const { isAuthenticated } = useSession();

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/boards/index" />;
  }

  return (
    <SafeAreaView
      onLayout={() => {
        hideStartupSplash("public index layout");
      }}
      style={styles.safeArea}
    >
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            contentFit="cover"
            source={require("../../assets/images/HeaderRandom.webp")}
            style={styles.headerImage}
          />
          <View style={styles.brandRow}>
            <Image
              contentFit="contain"
              source={require("../../assets/images/GATHEREND_OUTLINE_RELLENADO_V1_BOTAS.webp")}
              style={styles.brandIcon}
            />
            <Image
              contentFit="contain"
              source={require("../../assets/images/GatherendTitulo.webp")}
              style={styles.brandTitle}
            />
          </View>
        </View>

        <View style={styles.hero}>
          <Image
            contentFit="contain"
            source={require("../../assets/images/ArdillaGath.webp")}
            style={styles.mascot}
          />

          <View style={styles.copy}>
            <Text style={styles.title}>Comunidades para socializar :D</Text>
            <Text style={styles.description}>
              Crea o unete a boards, conversa con tu comunidad y lleva tus
              espacios contigo desde el telefono.
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push("/(auth)/sign-up")}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>Entrar a Gatherend</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(auth)/sign-in")}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Ya tengo cuenta</Text>
            </Pressable>
          </View>

          <View style={styles.previewStack}>
            <Image
              contentFit="cover"
              source={require("../../assets/images/FOTO_FRONT_1.webp")}
              style={styles.previewImage}
            />
            <Image
              contentFit="cover"
              source={require("../../assets/images/FOTO_FRONT_2.webp")}
              style={styles.previewImage}
            />
          </View>

          <View style={styles.footerLinks}>
            {LEGAL_LINKS.map((link, index) => (
              <View key={link.url} style={styles.footerLinkItem}>
                {index > 0 ? (
                  <Text style={styles.footerSeparator}>·</Text>
                ) : null}
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    void Linking.openURL(link.url);
                  }}
                >
                  <Text style={styles.footerLinkText}>{link.title}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.background,
  },
  content: {
    paddingBottom: 28,
  },
  header: {
    height: 112,
    justifyContent: "flex-start",
  },
  headerImage: {
    height: 96,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  brandIcon: {
    height: 42,
    width: 42,
  },
  brandTitle: {
    height: 34,
    width: 206,
  },
  hero: {
    gap: 24,
    paddingHorizontal: 22,
  },
  mascot: {
    alignSelf: "flex-end",
    height: 180,
    marginBottom: -28,
    marginRight: -4,
    marginTop: -65,
    width: 180,
  },
  copy: {
    gap: 12,
  },
  title: {
    color: BRAND_COLORS.text,
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 42,
  },
  description: {
    color: BRAND_COLORS.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: BRAND_COLORS.tabButtonBg,
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: BRAND_COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: BRAND_COLORS.tabButtonBg,
    borderColor: BRAND_COLORS.tabButtonBg,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: BRAND_COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  buttonPressed: {
    backgroundColor: BRAND_COLORS.tabButtonHover,
    opacity: 0.9,
  },
  previewStack: {
    gap: 14,
  },
  previewImage: {
    aspectRatio: 1.52,
    backgroundColor: BRAND_COLORS.surfaceMuted,
    borderColor: BRAND_COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  footerLinks: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingTop: 2,
  },
  footerLinkItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  footerLinkText: {
    color: BRAND_COLORS.textSubtle,
    fontSize: 12,
    fontWeight: "700",
  },
  footerSeparator: {
    color: BRAND_COLORS.borderStrong,
    fontSize: 13,
    fontWeight: "700",
  },
});
