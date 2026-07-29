import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../theme";

export function QtyStepper({ qty, onChange }: { qty: number; onChange: (next: number) => void }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Step icon="minus" label="Decrease quantity" onPress={() => onChange(qty - 1)} />
      <Text style={styles.qty} accessibilityLabel={`Quantity ${qty}`}>
        {qty}
      </Text>
      <Step icon="plus" label="Increase quantity" onPress={() => onChange(qty + 1)} />
    </View>
  );
}

function Step({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
    >
      <Feather name={icon} size={14} color={theme.color.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: theme.space.s2 },
  btn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: theme.color.hairline,
    borderRadius: theme.radius.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.surface,
  },
  qty: { ...theme.type.price, color: theme.color.ink, minWidth: 18, textAlign: "center" },
});
