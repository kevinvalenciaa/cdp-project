import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { useLift, useLiftDebug } from "../lift";
import { Sheet } from "./Sheet";

/**
 * The SDK x-ray. Collapsed: a floating pill with a live status dot - the way a
 * production app would ship a hidden debug surface. Expanded: the full panel a
 * host engineer actually wants - which bundle is loaded, how wrong the clock
 * is, what is queued, what was suppressed and WHY, and a per-campaign
 * explain() readout. Deliberately dark: the storefront is paper; the x-ray is
 * ink.
 */
export function DebugPanel(): React.JSX.Element | null {
  const lift = useLift();
  const s = useLiftDebug();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  // Campaign ids worth explaining, derived host-side from observable state.
  const campaignIds = useMemo(() => {
    if (!s) return [];
    const ids = new Set<string>();
    for (const e of s.ledger) if (e.channel === "in_app") ids.add(e.campaign_id);
    for (const c of s.skippedCampaigns) ids.add(c.campaign_id);
    if (s.lastDecision?.campaign_id) ids.add(s.lastDecision.campaign_id);
    return [...ids];
  }, [s]);

  if (!s) return null;

  const dotColor = s.droppedSinceLastFlush > 0 ? theme.color.debugBad : s.online ? theme.color.debugOk : theme.color.debugWarn;
  const d = s.lastDecision;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open Lift SDK debug panel"
        style={({ pressed }) => [
          styles.pill,
          { bottom: insets.bottom + 76 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.pillText}>LIFT · {s.bundleId ? s.bundleId.slice(0, 9) + "…" : "no bundle"}</Text>
        {s.queueDepth > 0 ? <Text style={styles.pillCount}>{s.queueDepth}</Text> : null}
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} variant="dark">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>LIFT SDK</Text>

          <Row k="bundle" v={s.bundleId ?? "none"} />
          <Row k="net" v={s.online ? "online" : `offline${s.lastError ? ` - ${s.lastError}` : ""}`} warn={!s.online} />
          <Row k="clock skew" v={`${s.skewMs >= 0 ? "+" : ""}${Math.round(s.skewMs)} ms`} />
          <Row
            k="queue"
            v={`${s.queueDepth} events${s.droppedSinceLastFlush ? ` · ${s.droppedSinceLastFlush} DROPPED` : ""}`}
            warn={s.droppedSinceLastFlush > 0}
          />
          <Row k="ledger" v={`${s.ledger.length} entries`} />
          {s.skippedCampaigns.length > 0 ? (
            <Row k="skipped" v={s.skippedCampaigns.map((c) => `${c.campaign_id}: ${c.reason}`).join("  |  ")} warn />
          ) : null}

          {d ? (
            <View style={styles.block}>
              <Text style={styles.blockHead}>LAST DECISION</Text>
              <Row
                k="outcome"
                v={`${d.outcome}${d.campaign_id ? ` · ${d.campaign_id}` : ""}${d.arm_id ? ` · arm ${d.arm_id}` : ""}`}
                strong
                warn={d.outcome === "suppressed"}
              />
              <Text style={styles.reason}>{d.reason}</Text>
              {d.trail.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: theme.space.s2 }}>
                  <Text style={styles.trail}>{d.trail.join("   •   ")}</Text>
                </ScrollView>
              ) : null}
            </View>
          ) : null}

          {campaignIds.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockHead}>EXPLAIN - WOULD THIS USER QUALIFY NOW?</Text>
              {campaignIds.map((id) => {
                const verdict = lift?.explain(id) ?? "sdk not ready";
                return <Row key={id} k={id} v={verdict} ok={verdict === "eligible"} />;
              })}
            </View>
          ) : null}
          <View style={{ height: theme.space.s4 }} />
        </ScrollView>
      </Sheet>
    </>
  );
}

function Row({
  k,
  v,
  warn,
  ok,
  strong,
}: {
  k: string;
  v: string;
  warn?: boolean;
  ok?: boolean;
  strong?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.key} numberOfLines={1}>
        {k}
      </Text>
      <Text
        style={[styles.val, warn && { color: theme.color.debugWarn }, ok && { color: theme.color.debugOk }, strong && styles.strong]}
        numberOfLines={3}
      >
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    right: theme.space.s4,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.s2,
    minHeight: theme.hit.min,
    paddingHorizontal: theme.space.s4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.debugBg,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  dot: { width: 6, height: 6, borderRadius: theme.radius.pill },
  pillText: { ...theme.type.mono, color: theme.color.debugText },
  pillCount: { ...theme.type.mono, color: theme.color.debugWarn },
  title: {
    ...theme.type.eyebrow,
    color: theme.color.debugKey,
    marginBottom: theme.space.s3,
  },
  row: { flexDirection: "row", marginBottom: theme.space.s2, gap: theme.space.s3 },
  key: { ...theme.type.mono, color: theme.color.debugKey, width: 104 },
  val: { ...theme.type.mono, color: theme.color.debugText, flex: 1 },
  strong: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold" },
  reason: { ...theme.type.mono, color: theme.color.debugOk, marginTop: 2 },
  trail: { ...theme.type.mono, color: theme.color.debugKey },
  block: {
    marginTop: theme.space.s4,
    paddingTop: theme.space.s3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.debugSurface,
  },
  blockHead: { ...theme.type.mono, color: theme.color.debugKey, letterSpacing: 1.2, marginBottom: theme.space.s2 },
});
