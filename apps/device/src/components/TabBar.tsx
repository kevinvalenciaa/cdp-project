import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";

export type Tab = "shop" | "bag";

export function TabBar({
  active,
  bagCount,
  onChange,
}: {
  active: Tab;
  bagCount: number;
  onChange: (tab: Tab) => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <TabButton
        icon="grid"
        label="Shop"
        active={active === "shop"}
        onPress={() => onChange("shop")}
        a11y="Shop tab"
      />
      <TabButton
        icon="shopping-bag"
        label="Bag"
        active={active === "bag"}
        badge={bagCount}
        onPress={() => onChange("bag")}
        a11y={`Bag tab, ${bagCount} item${bagCount === 1 ? "" : "s"}`}
      />
    </View>
  );
}

function TabButton({
  icon,
  label,
  active,
  badge = 0,
  onPress,
  a11y,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
  a11y: string;
}): React.JSX.Element {
  const color = active ? theme.color.ink : theme.color.muted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
    >
      <View>
        <Feather name={icon} size={20} color={color} />
        {badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color }, active && { fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.hairline,
    backgroundColor: theme.color.paper,
  },
  tab: {
    flex: 1,
    minHeight: theme.hit.min + 8,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: theme.space.s2,
    gap: 3,
  },
  label: { ...theme.type.caption, fontSize: 11 },
  badge: {
    position: "absolute",
    top: -5,
    right: -9,
    minWidth: 15,
    height: 15,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 9, color: theme.color.inverse },
});
