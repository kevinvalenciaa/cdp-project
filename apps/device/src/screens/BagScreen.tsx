import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { theme } from "../theme";
import { Header } from "../components/Header";
import { PrimaryButton } from "../components/PrimaryButton";
import { QtyStepper } from "../components/QtyStepper";
import { Sheet } from "../components/Sheet";
import { useCart } from "../cart";
import { useLift } from "../lift";

export function BagScreen({ onShop }: { onShop: () => void }): React.JSX.Element {
  const lift = useLift();
  const { lines, subtotal, setQty } = useCart();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onCheckout = (): void => {
    setConfirmOpen(true);
    void lift
      ?.track("begin_checkout", { items: lines.reduce((n, l) => n + l.qty, 0), subtotal })
      .catch(() => {});
  };

  const onQty = (productId: string, size: string, next: number): void => {
    if (next <= 0) void lift?.track("remove_from_cart", { product_id: productId }).catch(() => {});
    setQty(productId, size as never, next);
  };

  return (
    <View style={styles.root}>
      <Header variant="wordmark" />
      {lines.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyHead}>Nothing yet.</Text>
          <Text style={styles.emptyBody}>Pieces you add will wait for you here.</Text>
          <Pressable onPress={onShop} accessibilityRole="button" accessibilityLabel="Shop the collection" hitSlop={8}>
            <Text style={styles.emptyLink}>Shop the collection</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {lines.map((l) => (
            <View key={`${l.product.id}-${l.size}`} style={styles.line}>
              <Image source={l.product.image} style={styles.thumb} contentFit="cover" />
              <View style={styles.lineBody}>
                <Text style={styles.lineName} numberOfLines={1}>
                  {l.product.name}
                </Text>
                <Text style={styles.lineMeta}>Size {l.size}</Text>
                <View style={{ marginTop: theme.space.s2 }}>
                  <QtyStepper qty={l.qty} onChange={(n) => onQty(l.product.id, l.size, n)} />
                </View>
              </View>
              <Text style={styles.linePrice}>${l.qty * l.product.price}</Text>
            </View>
          ))}

          <View style={styles.totals}>
            <Row label="Subtotal" value={`$${subtotal}`} />
            <Row label="Shipping" value="Free" />
            <Row label="Total" value={`$${subtotal}`} strong />
          </View>
          <PrimaryButton label="CHECKOUT" onPress={onCheckout} style={{ marginHorizontal: theme.space.s4 }} />
        </ScrollView>
      )}

      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <Text style={styles.confirmHead}>Order placed</Text>
        <Text style={styles.confirmBody}>
          This is where the demo ends — everything above the fold was real, though.
        </Text>
        <PrimaryButton
          label="CONTINUE BROWSING"
          onPress={() => {
            setConfirmOpen(false);
            onShop();
          }}
          style={{ marginTop: theme.space.s5 }}
        />
      </Sheet>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }): React.JSX.Element {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, strong && styles.totalStrong]}>{label}</Text>
      <Text style={[styles.totalValue, strong && styles.totalStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  scroll: { paddingBottom: theme.space.s7, paddingTop: theme.space.s4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.space.s6 },
  emptyHead: { ...theme.type.headline, color: theme.color.ink },
  emptyBody: { ...theme.type.body, color: theme.color.muted, marginTop: theme.space.s2 },
  emptyLink: {
    ...theme.type.eyebrow,
    color: theme.color.ink,
    marginTop: theme.space.s5,
    textDecorationLine: "underline",
    paddingVertical: theme.space.s3,
  },
  line: {
    flexDirection: "row",
    paddingHorizontal: theme.space.s4,
    paddingVertical: theme.space.s3,
    gap: theme.space.s3,
    alignItems: "flex-start",
  },
  thumb: { width: 64, aspectRatio: 4 / 5, backgroundColor: theme.color.hairline },
  lineBody: { flex: 1 },
  lineName: { ...theme.type.title, color: theme.color.ink },
  lineMeta: { ...theme.type.caption, color: theme.color.muted, marginTop: 1 },
  linePrice: { ...theme.type.price, color: theme.color.ink },
  totals: {
    marginHorizontal: theme.space.s4,
    marginTop: theme.space.s4,
    marginBottom: theme.space.s5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.hairline,
    paddingTop: theme.space.s3,
    gap: theme.space.s2,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { ...theme.type.body, color: theme.color.muted },
  totalValue: { ...theme.type.price, color: theme.color.muted },
  totalStrong: { color: theme.color.ink, fontFamily: "Inter_600SemiBold" },
  confirmHead: { ...theme.type.headline, color: theme.color.ink },
  confirmBody: { ...theme.type.body, color: theme.color.muted, marginTop: theme.space.s2 },
});
