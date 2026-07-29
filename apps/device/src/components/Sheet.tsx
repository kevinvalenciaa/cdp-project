import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { useReducedMotion } from "../hooks/useReducedMotion";

/**
 * Shared bottom sheet (checkout confirmation, SDK debug x-ray). translateY
 * slide with scrim tap-to-close; jump-cuts under reduce-motion.
 */
export function Sheet({
  visible,
  onClose,
  variant = "light",
  children,
}: {
  visible: boolean;
  onClose: () => void;
  variant?: "light" | "dark";
  children: React.ReactNode;
}): React.JSX.Element | null {
  const y = useRef(new Animated.Value(600)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      y.setValue(0);
      return;
    }
    y.setValue(600);
    Animated.timing(y, {
      toValue: 0,
      duration: theme.motion.slow,
      easing: theme.motion.easing,
      useNativeDriver: true,
    }).start();
  }, [visible, y, reduced]);

  const insets = useSafeAreaInsets();
  const dark = variant === "dark";
  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sheet" />
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: y }], paddingBottom: insets.bottom + theme.space.s5 },
            dark && { backgroundColor: theme.color.debugBg },
          ]}
        >
          <View style={[styles.handle, dark && { backgroundColor: theme.color.debugKey }]} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,10,9,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.space.s5,
    paddingTop: theme.space.s3,
    maxHeight: "78%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.hairline,
    marginBottom: theme.space.s4,
  },
});
