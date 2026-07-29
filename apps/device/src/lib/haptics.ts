import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/** Tap feedback that quietly does nothing on web. */
export const haptics = {
  tap(): void {
    if (Platform.OS === "web") return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success(): void {
    if (Platform.OS === "web") return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};
