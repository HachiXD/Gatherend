import { Redirect, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

export default function BoardScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();

  if (!boardId) {
    return <Redirect href="/boards" />;
  }

  return <View />;
}
