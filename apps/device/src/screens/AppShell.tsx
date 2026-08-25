import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";
import { theme } from "../theme";
import type { Product } from "../catalog";
import { TabBar, type Tab } from "../components/TabBar";
import { useCart } from "../cart";
import { useLift } from "../lift";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { HomeScreen } from "./HomeScreen";
import { ProductScreen } from "./ProductScreen";
import { BagScreen } from "./BagScreen";

/**
 * Typed state navigation: two tabs + a product slide-over. All lift.screen()
 * dispatch lives in the ONE effect below - the entire "what does integration
 * cost a host app" answer is this file plus src/lift.tsx.
 */
type Route = { tab: Tab; detail: Product | null };

export function AppShell(): React.JSX.Element {
  const lift = useLift();
  const { count } = useCart();
  const [route, setRoute] = useState<Route>({ tab: "shop", detail: null });
  // Bumped every time Home regains focus → a fresh decide() per visit.
  const [homeVisit, setHomeVisit] = useState(0);

  useEffect(() => {
    if (!lift) return;
    if (route.detail) {
      void lift
        .screen("product", { product_id: route.detail.id, category: route.detail.category, price: route.detail.price })
        .catch(() => {});
    } else if (route.tab === "shop") {
      void lift.screen("home").catch(() => {});
      setHomeVisit((v) => v + 1);
    } else {
      void lift.screen("cart", { items: count }).catch(() => {});
    }
    // count deliberately excluded: cart focus logs the size at entry, not every change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lift, route]);

  // Slide-over animation for the product detail.
  const width = Dimensions.get("window").width;
  const slide = useRef(new Animated.Value(width)).current;
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState<Product | null>(null);

  useEffect(() => {
    if (route.detail) {
      setMounted(route.detail);
      if (reduced) {
        slide.setValue(0);
        return;
      }
      slide.setValue(width);
      Animated.timing(slide, {
        toValue: 0,
        duration: theme.motion.base,
        easing: theme.motion.easing,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      if (reduced) {
        setMounted(null);
        return;
      }
      Animated.timing(slide, {
        toValue: width,
        duration: theme.motion.base,
        easing: theme.motion.easing,
        useNativeDriver: true,
      }).start(() => setMounted(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.detail]);

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {route.tab === "shop" ? (
          <HomeScreen visit={homeVisit} onOpenProduct={(p) => setRoute((r) => ({ ...r, detail: p }))} />
        ) : (
          <BagScreen onShop={() => setRoute({ tab: "shop", detail: null })} />
        )}
      </View>
      <TabBar active={route.tab} bagCount={count} onChange={(tab) => setRoute({ tab, detail: null })} />

      {mounted ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.detail, { transform: [{ translateX: slide }] }]}>
          <ProductScreen product={mounted} onBack={() => setRoute((r) => ({ ...r, detail: null }))} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  content: { flex: 1 },
  detail: { backgroundColor: theme.color.paper },
});
