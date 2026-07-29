import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useLiftMessage } from "../lift";

/**
 * A host-owned message surface. The contract with the SDK is exactly this:
 * ask decide("home_hero"), render the arm that comes back (or nothing).
 * No campaign rules, no caps, no eligibility — the host never knows them.
 */
export function HeroSurface({ visit }: { visit: number }): React.JSX.Element | null {
  const decision = useLiftMessage("home_hero", visit);
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!decision || decision.outcome !== "delivered") return null; // suppression is visible in the DebugPanel, never as blank UI jank
  const arm = decision.arm!;
  if (dismissed === `${decision.campaign_id}:${visit}`) return null;

  if (arm.template === "modal") {
    return (
      <Modal transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.title}>{arm.title}</Text>
            <Text style={styles.body}>{arm.body}</Text>
            <Pressable style={styles.cta} onPress={() => setDismissed(`${decision.campaign_id}:${visit}`)}>
              <Text style={styles.ctaText}>{arm.cta}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.banner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{arm.title}</Text>
        <Text style={styles.body}>{arm.body}</Text>
      </View>
      <Pressable style={styles.cta} onPress={() => setDismissed(`${decision.campaign_id}:${visit}`)}>
        <Text style={styles.ctaText}>{arm.cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#151b2c",
    borderWidth: 1,
    borderColor: "#2c4a85",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 28 },
  modalCard: { backgroundColor: "#151b2c", borderRadius: 18, borderWidth: 1, borderColor: "#2c4a85", padding: 22, width: "100%" },
  title: { color: "#f2f5fa", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  body: { color: "#98a2b3", fontSize: 13, lineHeight: 18, marginBottom: 8 },
  cta: { backgroundColor: "#5b8def", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "flex-start" },
  ctaText: { color: "#0d1017", fontSize: 13, fontWeight: "700" },
});
