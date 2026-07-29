import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLiftDebug } from "../lift";

/**
 * The honest surface. Everything invisible about delivery — which bundle is
 * loaded, how far off the clock is, what is queued, what was suppressed and
 * WHY — is legible here. This panel is simultaneously the demo's visual
 * argument and the debugging surface a host engineer would actually want.
 */
export function DebugPanel(): React.JSX.Element {
  const s = useLiftDebug();

  if (!s) {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>LIFT SDK</Text>
        <Text style={styles.dim}>initialising…</Text>
      </View>
    );
  }

  const d = s.lastDecision;
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>LIFT SDK</Text>
      <Row k="bundle" v={s.bundleId ?? "none"} />
      <Row k="net" v={s.online ? "online" : `offline${s.lastError ? ` (${s.lastError})` : ""}`} warn={!s.online} />
      <Row k="clock skew" v={`${s.skewMs >= 0 ? "+" : ""}${Math.round(s.skewMs)} ms`} />
      <Row k="queue" v={`${s.queueDepth} events${s.droppedSinceLastFlush ? ` · ${s.droppedSinceLastFlush} DROPPED` : ""}`} warn={s.droppedSinceLastFlush > 0} />
      <Row k="ledger" v={`${s.ledger.length} entries`} />
      {s.skippedCampaigns.length > 0 && (
        <Row k="skipped" v={s.skippedCampaigns.map((c) => `${c.campaign_id}: ${c.reason}`).join(" | ")} warn />
      )}
      {d && (
        <View style={styles.decision}>
          <Row
            k="last decision"
            v={`${d.outcome}${d.campaign_id ? ` · ${d.campaign_id}` : ""}${d.arm_id ? ` · arm ${d.arm_id}` : ""}`}
            strong
            warn={d.outcome === "suppressed"}
          />
          <Text style={styles.reason}>{d.reason}</Text>
          {d.trail.length > 0 && (
            <ScrollView style={styles.trail} horizontal>
              <Text style={styles.trailText}>{d.trail.join("   •   ")}</Text>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

function Row({ k, v, warn, strong }: { k: string; v: string; warn?: boolean; strong?: boolean }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{k}</Text>
      <Text style={[styles.val, warn && styles.warn, strong && styles.strong]} numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: "#0d1017", borderTopWidth: 1, borderTopColor: "#232838", paddingHorizontal: 14, paddingVertical: 10 },
  title: { color: "#5b8def", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 3 },
  key: { color: "#5a6474", fontSize: 11, width: 92, fontVariant: ["tabular-nums"] },
  val: { color: "#98a2b3", fontSize: 11, flex: 1, fontVariant: ["tabular-nums"] },
  warn: { color: "#f5b14c" },
  strong: { color: "#f2f5fa", fontWeight: "600" },
  dim: { color: "#5a6474", fontSize: 11 },
  decision: { marginTop: 4, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#232838" },
  reason: { color: "#3ddc97", fontSize: 11, marginTop: 2, fontVariant: ["tabular-nums"] },
  trail: { marginTop: 4 },
  trailText: { color: "#5a6474", fontSize: 10 },
});
