import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { theme } from "../theme";
import type { Product } from "../catalog";

/** Grid tile: 4:5 image on a hairline-tone plate (reserved space), name, price. */
export function ProductCard({ product, onPress }: { product: Product; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.category}, $${product.price}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
    >
      <Image source={product.image} style={styles.image} contentFit="cover" transition={150} />
      <Text style={styles.name} numberOfLines={1}>
        {product.name}
      </Text>
      <Text style={styles.price}>${product.price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  image: { width: "100%", aspectRatio: 4 / 5, backgroundColor: theme.color.hairline },
  name: { ...theme.type.title, color: theme.color.ink, marginTop: theme.space.s2 },
  price: { ...theme.type.price, color: theme.color.muted, marginTop: 1 },
});
