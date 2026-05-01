import { forwardRef } from "react";
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
} from "react-native";
import type {
  ComponentRef,
  ComponentPropsWithoutRef,
} from "react";
import type { TextStyle } from "react-native";

const GEIST_REGULAR = "Geist_400Regular";
const GEIST_MEDIUM = "Geist_500Medium";
const GEIST_SEMIBOLD = "Geist_600SemiBold";
const GEIST_BOLD = "Geist_700Bold";
const GEIST_EXTRABOLD = "Geist_800ExtraBold";

type TextStyleSource = ComponentPropsWithoutRef<typeof NativeText>["style"];
type TextInputStyleSource = ComponentPropsWithoutRef<
  typeof NativeTextInput
>["style"];

function getGeistFamily(style: TextStyleSource | TextInputStyleSource) {
  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;

  if (flattened?.fontFamily) return null;

  switch (flattened?.fontWeight) {
    case "500":
      return GEIST_MEDIUM;
    case "600":
      return GEIST_SEMIBOLD;
    case "700":
    case "bold":
      return GEIST_BOLD;
    case "800":
      return GEIST_EXTRABOLD;
    default:
      return GEIST_REGULAR;
  }
}

export const Text = forwardRef<
  ComponentRef<typeof NativeText>,
  ComponentPropsWithoutRef<typeof NativeText>
>(function Text({ style, ...props }, ref) {
  const fontFamily = getGeistFamily(style);
  return (
    <NativeText
      ref={ref}
      style={fontFamily ? [style, { fontFamily }] : style}
      {...props}
    />
  );
});

export const TextInput = forwardRef<
  ComponentRef<typeof NativeTextInput>,
  ComponentPropsWithoutRef<typeof NativeTextInput>
>(function TextInput({ style, ...props }, ref) {
  const fontFamily = getGeistFamily(style);
  return (
    <NativeTextInput
      ref={ref}
      style={fontFamily ? [style, { fontFamily }] : style}
      {...props}
    />
  );
});
