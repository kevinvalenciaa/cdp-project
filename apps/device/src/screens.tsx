import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { HeroSurface } from "./components/HeroSurface";
import { useLift } from "./lift";

/**
 * Three screens of a plausible fashion-retail app (matching the warehouse
 * fixture's Outerwear/Workwear world). Each screen reports itself with
 * lift.screen(); actions report with lift.track(). That is the entire
 * behavioural-collection integration — two calls.
 */

const PRODUCTS = [
  { id: "wax-canvas-jacket", name: "Wax Canvas Jacket", category: "Outerwear", price: 248 },
  { id: "chore-coat", name: "Heavyweight Chore Coat", category: "Workwear", price: 186 },
  { id: "flannel-overshirt", name: "Brushed Flannel Overshirt", category: "Workwear", price: 98 },
];

export type Screen = "home" | "product" | "cart";

export function Screens(): React.JSX.Element {
  const lift = useLift();
  const [screen, setScreen] = useState<Screen>("home");
  const [product, setProduct] = useState(PRODUCTS[0]!);
  const [cart, setCart] = useState<string[]>([]);
  // Bumped on every home visit → a fresh decide() per visit, which is what
  // makes the second visit's suppression demonstrable on camera.
  const [homeVisit, setHomeVisit] = useState(0);

  useEffect(() => {
    if (!lift) return;
    void lift.screen(screen, screen === "product" ? { product_id: product.id, category: product.category } : {});
    if (screen === "home") setHomeVisit((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lift, screen, product.id]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
        {screen === "home" && (
          <>
            <Text style={styles.h1}>New Season</Text>
            <HeroSurface visit={homeVisit} />
            {PRODUCTS.map((p) => (
              <Pressable
                key={p.id}
                style={styles.card}
                onPress={() => {
                  setProduct(p);
                  setScreen("product");
                }}
              >
                <Text style={styles.cardTitle}>{p.name}</Text>
                <Text style={styles.cardMeta}>
                  {p.category} · ${p.price}
                </Text>
              </Pressable>
            ))}
          </>
        )}

        {screen === "product" && (
          <>
            <Text style={styles.h1}>{product.name}</Text>
            <Text style={styles.cardMeta}>
              {product.category} · ${product.price}
            </Text>
            <Pressable
              style={styles.buy}
              onPress={() => {
                setCart((c) => [...c, product.id]);
                void useLiftSafeTrack(lift, "add_to_cart", { product_id: product.id, category: product.category, price: product.price });
                setScreen("cart");
              }}
            >
              <Text style={styles.buyText}>Add to cart</Text>
            </Pressable>
          </>
        )}

        {screen === "cart" && (
          <>
            <Text style={styles.h1}>Cart</Text>
            {cart.length === 0 ? (
              <Text style={styles.cardMeta}>Empty — add something you’ll wear for a decade.</Text>
            ) : (
              cart.map((id, i) => {
                const p = PRODUCTS.find((x) => x.id === id)!;
                return (
                  <View key={`${id}-${i}`} style={styles.card}>
                    <Text style={styles.cardTitle}>{p.name}</Text>
                    <Text style={styles.cardMeta}>${p.price}</Text>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.tabs}>
        {(["home", "product", "cart"] as const).map((s) => (
          <Pressable key={s} style={styles.tab} onPress={() => setScreen(s)}>
            <Text style={[styles.tabText, screen === s && styles.tabActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** track() is fire-and-forget from UI handlers; never let it throw into React. */
function useLiftSafeTrack(lift: ReturnType<typeof useLift>, name: string, props: Record<string, unknown>): void {
  void lift?.track(name, props).catch(() => {});
}

const styles = StyleSheet.create({
  content: { flex: 1, backgroundColor: "#07080b" },
  h1: { color: "#f2f5fa", fontSize: 24, fontWeight: "800", marginBottom: 14 },
  card: { backgroundColor: "#101420", borderWidth: 1, borderColor: "#232838", borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTitle: { color: "#f2f5fa", fontSize: 15, fontWeight: "600" },
  cardMeta: { color: "#5a6474", fontSize: 13, marginTop: 2 },
  buy: { backgroundColor: "#5b8def", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 18 },
  buyText: { color: "#0d1017", fontSize: 15, fontWeight: "700" },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#232838", backgroundColor: "#0a0d15" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { color: "#5a6474", fontSize: 12, textTransform: "capitalize" },
  tabActive: { color: "#5b8def", fontWeight: "700" },
});
