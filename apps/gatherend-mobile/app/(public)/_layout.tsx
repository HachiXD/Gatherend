import { Stack } from "expo-router";
import { BRAND_COLORS } from "@/src/theme/brand-colors";

export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: BRAND_COLORS.background },
        headerShown: false,
      }}
    />
  );
}
