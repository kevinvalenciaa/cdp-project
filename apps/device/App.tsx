import React from "react";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Fraunces_500Medium, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { LiftProvider } from "./src/lift";
import { CartProvider } from "./src/cart";
import { AppShell } from "./src/screens/AppShell";
import { DebugPanel } from "./src/components/DebugPanel";
import { theme } from "./src/theme";

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
 * owns the decision; the host owns the rendering; the DebugPanel (floating
 * pill, bottom-right) makes the invisible half legible.
 */
export default function App(): React.JSX.Element {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
  });

  if (!fontsLoaded) {
    // Paper-colored blank beats a spinner or a flash of fallback type.
    return <View style={{ flex: 1, backgroundColor: theme.color.paper }} />;
  }

  return (
    <SafeAreaProvider>
      <LiftProvider>
        <CartProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.paper }} edges={["top"]}>
            <StatusBar style="dark" />
            <AppShell />
            <DebugPanel />
          </SafeAreaView>
        </CartProvider>
      </LiftProvider>
    </SafeAreaProvider>
  );
}
