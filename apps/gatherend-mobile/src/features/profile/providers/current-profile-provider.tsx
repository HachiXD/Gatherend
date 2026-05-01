import {
  createContext,
  useContext,
  type Context,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useCurrentProfile } from "../hooks/use-current-profile";
import type { ClientProfile } from "../types/current-profile";
import { Text } from "@/src/components/app-typography";
import { BRAND_COLORS } from "@/src/theme/brand-colors";

const CurrentProfileContext: Context<ClientProfile | null> =
  createContext<ClientProfile | null>(null);

type CurrentProfileProviderProps = {
  children: ReactNode;
};

export function CurrentProfileProvider({
  children,
}: CurrentProfileProviderProps) {
  const {
    data: profile,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useCurrentProfile();

  if (isLoading || isFetching || !profile) {
    if (isError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>No se pudo cargar tu perfil</Text>
          <Text style={styles.subtitle}>
            {error instanceof Error ? error.message : "Intenta de nuevo."}
          </Text>
          <Pressable
            onPress={() => {
              void refetch();
            }}
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.buttonText}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={BRAND_COLORS.primaryHover} />
        <Text style={styles.subtitle}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <CurrentProfileContext.Provider value={profile}>
      {children}
    </CurrentProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(CurrentProfileContext);

  if (!context) {
    throw new Error(
      "useProfile must be used within a CurrentProfileProvider.",
    );
  }

  return context;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: BRAND_COLORS.background,
  },
  title: {
    color: BRAND_COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: BRAND_COLORS.primary,
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonText: {
    color: BRAND_COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
