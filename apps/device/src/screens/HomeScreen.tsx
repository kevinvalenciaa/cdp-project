import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { theme } from "../theme";
import { MASTHEAD, PRODUCTS, type Product } from "../catalog";
import { Header } from "../components/Header";
import { HeroSurface } from "../components/HeroSurface";
import { ProductCard } from "../components/ProductCard";
import { Skeleton } from "../components/Skeleton";
import { useLift } from "../lift";

/**
 * Editorial home: masthead → the SDK's message surface → product grid.
 * The hero region is the ONLY place delivery shows up in the storefront —
 * everything else is an ordinary retail page, which is the point.
 */
export function HomeScreen({
  visit,
  onOpenProduct,
}: {
  visit: number;
  onOpenProduct: (p: Product) => void;
}): React.JSX.Element {
  const lift = useLift();

  return (
    <View style={styles.root}>
      <Header variant="wordmark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View>
          <Image source={MASTHEAD} style={styles.masthead} contentFit="cover" transition={200} />
          <View style={styles.mastCaption}>
            <Text style={styles.eyebrow}>FALL 2026</Text>
            <Text style={styles.headline}>Field-Tested Outerwear</Text>
          </View>
        </View>

        {/* SDK surface: reserved space while the bundle decision is pending,
            the delivered arm when it lands, nothing (honestly) when capped. */}
        {lift === null ? <Skeleton height={140} style={styles.heroSkeleton} /> : <HeroSurface visit={visit} />}

        <View style={styles.sectionHead}>
          <Text style={styles.eyebrow}>SHOP ALL</Text>
        </View>
        <View style={styles.grid}>
          {PRODUCTS.map((p) => (
            <View key={p.id} style={styles.cell}>
              <ProductCard product={p} onPress={() => onOpenProduct(p)} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  scroll: { paddingBottom: theme.space.s7 },
  masthead: { width: "100%", aspectRatio: 3 / 2, backgroundColor: theme.color.hairline },
  mastCaption: { paddingHorizontal: theme.space.s4, paddingTop: theme.space.s4, paddingBottom: theme.space.s2 },
  eyebrow: { ...theme.type.eyebrow, color: theme.color.muted },
  headline: { ...theme.type.display, color: theme.color.ink, marginTop: theme.space.s2 },
  heroSkeleton: { marginHorizontal: theme.space.s4, marginTop: theme.space.s4 },
  sectionHead: {
    marginTop: theme.space.s6,
    marginHorizontal: theme.space.s4,
    paddingTop: theme.space.s4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.hairline,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.space.s4,
    marginTop: theme.space.s3,
    columnGap: theme.space.s3,
    rowGap: theme.space.s5,
  },
  cell: { width: "48%", flexGrow: 1 },
});
