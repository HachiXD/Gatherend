import { Image } from "expo-image";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/src/components/app-typography";
import { useTheme } from "@/src/theme/theme-provider";

const GATHEREND_ICON =
  require("@/assets/images/GATHEREND_OUTLINE_RELLENADO_V1_BOTAS.png") as number;

type WelcomeMessageCardProps = {
  boardName: string;
  username?: string | null;
};

export const WelcomeMessageCard = memo(
  function WelcomeMessageCard({
    boardName,
    username,
  }: WelcomeMessageCardProps) {
    const { colors } = useTheme();

    return (
      <View style={styles.container}>
        <View
          style={[styles.iconCircle, { backgroundColor: colors.bgQuaternary }]}
        >
          <Image
            contentFit="contain"
            source={GATHEREND_ICON}
            style={[styles.icon, { tintColor: colors.accentLight }]}
          />
        </View>

        <Text style={[styles.text, { color: colors.textSubtle }]}>
          {username ? (
            <>
              <Text style={[styles.bold, { color: colors.textSubtle }]}>
                @{username}
              </Text>
              {" se unió a "}
            </>
          ) : null}
          <Text style={[styles.bold, { color: colors.textSubtle }]}>
            {boardName}
          </Text>
          {"!\n"}
          {"¡Espero que la pases bien :D, preséntate y únete a la discusión!"}
        </Text>
      </View>
    );
  },
  (prev, next) =>
    prev.boardName === next.boardName && prev.username === next.username,
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
    opacity: 0.9,
  },
  iconCircle: {
    alignItems: "center",
    borderRadius: 999,
    height: 112,
    justifyContent: "center",
    marginBottom: 12,
    width: 112,
  },
  icon: {
    height: 72,
    width: 72,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  bold: {
    fontWeight: "700",
  },
});
