import "react-native";

declare module "react-native" {
  interface TextInputProps {
    preventTransientVerticalScroll?: boolean;
  }
}
