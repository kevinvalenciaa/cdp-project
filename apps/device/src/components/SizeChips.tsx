import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
import { SIZES, type Size } from "../catalog";

export function SizeChips({ selected, onSelect }: { selected: Size; onSelect: (s: Size) => void }): React.JSX.Element {
  return (
    <View style={styles.row}>
      {SIZES.map((s) => {
        const active = s === selected;
        return (
          <Pressable
            key={s}
            onPress={() => onSelect(s)}
            accessibilityRole="button"
            accessibilityLabel={`Size ${s}`}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.75 }]}
          >
            <Text style={[styles.label, active && { color: theme.color.inverse }]}>{s}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: theme.space.s2 },
  chip: {
    minWidth: theme.hit.min,
    height: theme.hit.min,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: theme.color.hairline,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space.s3,
    backgroundColor: theme.color.surface,
  },
  chipActive: { backgroundColor: theme.color.ink, borderColor: theme.color.ink },
  label: { ...theme.type.title, fontSize: 13, color: theme.color.ink },
});
