import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../theme";

/** Wordmark header (Home/Bag) or back-chevron header (product detail). */
export function Header({
  variant,
  eyebrow,
  onBack,
}: {
  variant: "wordmark" | "back";
  eyebrow?: string;
  onBack?: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.bar}>
      {variant === "back" ? (
        <>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
          >
            <Feather name="chevron-left" size={22} color={theme.color.ink} />
          </Pressable>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <View style={styles.back} />
        </>
      ) : (
        <Text style={styles.wordmark}>MERIDIAN</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.hairline,
    backgroundColor: theme.color.paper,
    paddingHorizontal: theme.space.s2,
  },
  wordmark: {
    fontFamily: "Fraunces_600SemiBold",
    fontSize: 18,
    letterSpacing: 4,
    color: theme.color.ink,
  },
  eyebrow: { ...theme.type.eyebrow, color: theme.color.muted, flex: 1, textAlign: "center" },
  back: { width: theme.hit.min, height: theme.hit.min, alignItems: "center", justifyContent: "center" },
});
