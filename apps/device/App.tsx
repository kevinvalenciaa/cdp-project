import React from "react";
import { SafeAreaView, StatusBar, StyleSheet } from "react-native";
import { LiftProvider } from "./src/lift";
import { Screens } from "./src/screens";
import { DebugPanel } from "./src/components/DebugPanel";

/**
 * The whole SDK integration a host app writes lives in src/lift.tsx:
 *
 *   const sdk = await LiftCompass.init({
 *     apiBase: API_BASE,       // your dashboard
 *     storage,                 // AsyncStorage adapter, ~10 lines
 *     attrs: { ... },          // who this user is
 *   });
 *   sdk.start();               // bundle polling + event flushing
 *
 * Screens call lift.screen()/lift.track(); surfaces call decide(). The SDK
 * owns the decision; the host owns the rendering; the DebugPanel makes the
 * invisible half (suppressions, caps, queue, clock skew) legible.
 */
export default function App(): React.JSX.Element {
  return (
    <LiftProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" />
        <Screens />
        <DebugPanel />
      </SafeAreaView>
    </LiftProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#07080b" },
});
