import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { theme } from "../theme";
import type { Product, Size } from "../catalog";
import { Header } from "../components/Header";
import { PrimaryButton, type ButtonState } from "../components/PrimaryButton";
import { SizeChips } from "../components/SizeChips";
import { useCart } from "../cart";
import { haptics } from "../lib/haptics";
import { useLift } from "../lift";

export function ProductScreen({ product, onBack }: { product: Product; onBack: () => void }): React.JSX.Element {
  const lift = useLift();
  const { add } = useCart();
  const [size, setSize] = useState<Size>("M");
  const [state, setState] = useState<ButtonState>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const onSelectSize = (s: Size): void => {
    setSize(s);
    void lift?.track("select_size", { product_id: product.id, size: s }).catch(() => {});
  };

  const onAdd = (): void => {
    setState("loading");
    haptics.tap();
    void lift
      ?.track("add_to_cart", { product_id: product.id, category: product.category, price: product.price, size, qty: 1 })
      .catch(() => {});
    timers.current.push(
      setTimeout(() => {
        add(product, size);
        haptics.success();
        setState("done");
        timers.current.push(setTimeout(() => setState("idle"), 900));
      }, 350),
    );
  };

  return (
    <View style={styles.root}>
      <Header variant="back" eyebrow={product.category.toUpperCase()} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Image source={product.image} style={styles.image} contentFit="cover" transition={200} />
        <View style={styles.body}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>${product.price}</Text>
          <View style={styles.rule} />
          <Text style={styles.eyebrow}>SIZE</Text>
          <View style={{ marginTop: theme.space.s3 }}>
            <SizeChips selected={size} onSelect={onSelectSize} />
          </View>
          <PrimaryButton label="ADD TO BAG" state={state} onPress={onAdd} style={{ marginTop: theme.space.s5 }} />
          <View style={styles.rule} />
          <Text style={styles.eyebrow}>DETAILS</Text>
          <Text style={styles.detail}>{product.detail}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  scroll: { paddingBottom: theme.space.s7 },
  image: { width: "100%", aspectRatio: 4 / 5, backgroundColor: theme.color.hairline },
  body: { paddingHorizontal: theme.space.s4, paddingTop: theme.space.s5 },
  name: { ...theme.type.headline, color: theme.color.ink },
  price: { ...theme.type.price, fontSize: 15, color: theme.color.muted, marginTop: theme.space.s1 },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.color.hairline,
    marginVertical: theme.space.s5,
  },
  eyebrow: { ...theme.type.eyebrow, color: theme.color.muted },
  detail: { ...theme.type.body, color: theme.color.ink, marginTop: theme.space.s3 },
});
