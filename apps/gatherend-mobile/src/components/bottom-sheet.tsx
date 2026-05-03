import { Dimensions, Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme/theme-provider";

const SCREEN_HEIGHT = Dimensions.get("screen").height;

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number;
  hideHandle?: boolean;
};

export function BottomSheet({
  visible,
  onClose,
  children,
  maxHeight,
  hideHandle = false,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.container}>
        <Pressable onPress={onClose} style={styles.backdrop} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgSecondary,
              borderColor: colors.borderPrimary,
              borderTopWidth: hideHandle ? 0 : 1,
              maxHeight: maxHeight ?? screenHeight * 0.85,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          {!hideHandle ? (
            <View
              style={[styles.handle, { backgroundColor: colors.borderPrimary }]}
            />
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    height: SCREEN_HEIGHT,
    backgroundColor: "rgba(2, 6, 23, 0.62)",
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    borderRadius: 3,
    height: 4,
    marginBottom: 6,
    marginTop: 12,
    width: 40,
  },
});
