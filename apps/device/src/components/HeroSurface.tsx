import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../theme";
import { useLift, useLiftMessage } from "../lift";
import { useReducedMotion } from "../hooks/useReducedMotion";

/**
 * A host-owned message surface, editorial-styled. The contract with the SDK is
 * exactly this: ask decide("home_hero"), render the arm that comes back (or
 * nothing). No campaign rules, no caps, no eligibility - the host never knows
 * them. Suppression is visible in the DebugPanel, never as blank UI jank.
 */
export function HeroSurface({ visit }: { visit: number }): React.JSX.Element | null {
  const lift = useLift();
  const decision = useLiftMessage("home_hero", visit);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const enter = useRef(new Animated.Value(0)).current;
  const delivered = decision?.outcome === "delivered";
  useEffect(() => {
    if (!delivered) return;
    if (reduced) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: theme.motion.base,
      easing: theme.motion.easing,
      useNativeDriver: true,
    }).start();
  }, [delivered, visit, enter, reduced]);

  if (!decision || decision.outcome !== "delivered") return null;
  const arm = decision.arm!;
  const key = `${decision.campaign_id}:${visit}`;
  if (dismissed === key) return null;

  const report = (event: "hero_cta_tap" | "hero_dismissed"): void => {
    // Host-side conversion reporting of a rendered decision - not campaign logic.
    void lift
      ?.track(event, { campaign_id: decision.campaign_id, arm_id: decision.arm_id, surface: decision.surface })
      .catch(() => {});
  };
  const close = (event: "hero_cta_tap" | "hero_dismissed"): void => {
    report(event);
    setDismissed(key);
  };

  if (arm.template === "modal") {
    return (
      <Modal transparent={false} animationType={reduced ? "none" : "fade"} onRequestClose={() => close("hero_dismissed")}>
        <View style={styles.interstitial}>
          <Pressable
            onPress={() => close("hero_dismissed")}
            accessibilityRole="button"
            accessibilityLabel="Dismiss offer"
            hitSlop={8}
            style={styles.interstitialClose}
          >
            <Feather name="x" size={22} color={theme.color.ink} />
          </Pressable>
          <View style={styles.interstitialBody}>
            <Text style={styles.eyebrow}>OFFER</Text>
            <Text style={styles.interstitialTitle}>{arm.title}</Text>
            <Text style={styles.body}>{arm.body}</Text>
            <Pressable
              onPress={() => close("hero_cta_tap")}
              accessibilityRole="button"
              accessibilityLabel={arm.cta}
              style={({ pressed }) => [styles.ctaBar, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaBarText}>{arm.cta.toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      <View style={styles.bannerText}>
        <Text style={styles.eyebrow}>OFFER</Text>
        <Text style={styles.bannerTitle}>{arm.title}</Text>
        <Text style={styles.body} numberOfLines={2}>
          {arm.body}
        </Text>
        <Pressable
          onPress={() => close("hero_cta_tap")}
          accessibilityRole="button"
          accessibilityLabel={arm.cta}
          style={({ pressed }) => [styles.ctaCompact, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaCompactText}>{arm.cta.toUpperCase()}</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => close("hero_dismissed")}
        accessibilityRole="button"
        accessibilityLabel="Dismiss offer"
        hitSlop={10}
        style={styles.dismiss}
      >
        <Feather name="x" size={16} color={theme.color.muted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    marginHorizontal: theme.space.s4,
    marginTop: theme.space.s4,
    paddingVertical: theme.space.s4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.paper,
  },
  bannerText: { flex: 1 },
  eyebrow: { ...theme.type.eyebrow, color: theme.color.accent },
  bannerTitle: { ...theme.type.headline, color: theme.color.ink, marginTop: theme.space.s2 },
  body: { ...theme.type.body, color: theme.color.muted, marginTop: theme.space.s2 },
  ctaCompact: {
    alignSelf: "flex-start",
    backgroundColor: theme.color.ink,
    paddingHorizontal: theme.space.s4,
    height: 40,
    justifyContent: "center",
    marginTop: theme.space.s3,
  },
  ctaCompactText: { ...theme.type.eyebrow, fontSize: 11, color: theme.color.inverse },
  dismiss: {
    width: theme.hit.min,
    height: theme.hit.min,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: theme.space.s1,
    marginRight: -theme.space.s2,
  },
  interstitial: { flex: 1, backgroundColor: theme.color.paper },
  interstitialClose: {
    position: "absolute",
    top: theme.space.s7,
    right: theme.space.s4,
    width: theme.hit.min,
    height: theme.hit.min,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  interstitialBody: { flex: 1, justifyContent: "center", paddingHorizontal: theme.space.s6 },
  interstitialTitle: { ...theme.type.display, color: theme.color.ink, marginTop: theme.space.s3 },
  ctaBar: {
    height: 52,
    backgroundColor: theme.color.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.space.s6,
  },
  ctaBarText: { ...theme.type.eyebrow, fontSize: 12, color: theme.color.inverse },
});
