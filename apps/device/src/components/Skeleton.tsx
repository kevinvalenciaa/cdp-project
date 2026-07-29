import React, { useEffect, useRef } from "react";
import { Animated, type ViewStyle } from "react-native";
import { theme } from "../theme";
import { useReducedMotion } from "../hooks/useReducedMotion";

/** Reserved-space loading block with a quiet opacity pulse. */
export function Skeleton({ height, style }: { height: number; style?: ViewStyle }): React.JSX.Element {
  const opacity = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);

  return (
    <Animated.View
      style={[{ height, backgroundColor: theme.color.hairline, opacity }, style]}
      accessibilityLabel="Loading"
    />
  );
}
