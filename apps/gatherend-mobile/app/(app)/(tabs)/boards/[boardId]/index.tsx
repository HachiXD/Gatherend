import { Redirect, useLocalSearchParams } from "expo-router";

export default function BoardScreen() {
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();

  if (!boardId) {
    return <Redirect href="/(app)/(tabs)/boards" />;
  }

  return (
    <Redirect
      href={{
        pathname: "/(app)/(tabs)/boards/[boardId]/home",
        params: { boardId },
      }}
    />
  );
}
