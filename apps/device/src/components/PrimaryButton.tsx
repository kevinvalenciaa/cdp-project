import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../theme";

export type ButtonState = "idle" | "loading" | "done";

/**
 * The ink CTA bar. Fixed height so label ↔ spinner ↔ "added" swaps never move
 * layout; pressed state is opacity only (no scale, no shift).
 */
export function PrimaryButton({
  label,
  doneLabel = "ADDED",
  state = "idle",
  onPress,
  style,
}: {
  label: string;
  doneLabel?: string;
  state?: ButtonState;
  onPress: () => void;
  style?: ViewStyle;
}): React.JSX.Element {
  const disabled = state !== "idle";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: state === "loading" }}
      style={({ pressed }) => [styles.bar, pressed && { opacity: 0.85 }, style]}
    >
      {state === "loading" ? (
        <ActivityIndicator size="small" color={theme.color.inverse} />
      ) : state === "done" ? (
        <View style={styles.row}>
          <Feather name="check" size={15} color={theme.color.inverse} />
          <Text style={styles.label}>{doneLabel}</Text>
        </View>
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 52,
    backgroundColor: theme.color.ink,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.none,
  },
  row: { flexDirection: "row", alignItems: "center", gap: theme.space.s2 },
  label: {
    ...theme.type.eyebrow,
    fontSize: 12,
    color: theme.color.inverse,
  },
});
