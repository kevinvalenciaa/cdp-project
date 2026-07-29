import { Easing, type FontVariant } from "react-native";

/**
 * Editorial-light design tokens — the storefront's single source of truth.
 * SSENSE/Aritzia direction: warm paper ground, ink type, hairline structure,
 * sharp corners, one restrained accent. The debug surface deliberately stays
 * dark: the storefront is paper, the SDK x-ray is ink.
 *
 * Contrast pairs (WCAG, on paper #FAFAF7): ink 19.2:1 · muted 7.4:1 ·
 * accent 7.0:1 · all ≥ 4.5:1. On debugBg #0C0A09: debugText 13.9:1.
 */
export const theme = {
  color: {
    paper: "#FAFAF7",
    surface: "#FFFFFF",
    ink: "#0C0A09",
    muted: "#57534E",
    hairline: "#E7E5E4",
    accent: "#9A3412",
    inverse: "#FAFAF7",

    debugBg: "#0C0A09",
    debugSurface: "#1C1917",
    debugText: "#D6D3D1",
    debugKey: "#78716C",
    debugWarn: "#F5B14C",
    debugOk: "#3DDC97",
    debugBad: "#FB7185",
  },
  space: { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48, s8: 64 },
  /** Sharp corners are the editorial stance; only chips soften (2) and the debug pill rounds. */
  radius: { none: 0, chip: 2, pill: 999 },
  type: {
    display: { fontFamily: "Fraunces_600SemiBold", fontSize: 32, lineHeight: 36, letterSpacing: -0.5 },
    headline: { fontFamily: "Fraunces_500Medium", fontSize: 22, lineHeight: 27 },
    title: { fontFamily: "Inter_600SemiBold", fontSize: 15, lineHeight: 20 },
    body: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
    price: { fontFamily: "Inter_500Medium", fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] as FontVariant[] },
    eyebrow: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.6,
      textTransform: "uppercase" as const,
    },
    caption: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 16 },
    /** Debug metrics — tabular so counters do not jitter. */
    mono: { fontFamily: "Inter_500Medium", fontSize: 11, lineHeight: 15, fontVariant: ["tabular-nums"] as FontVariant[] },
  },
  motion: {
    fast: 150,
    base: 200,
    slow: 300,
    easing: Easing.out(Easing.cubic),
  },
  hit: { min: 44 },
} as const;

export type Theme = typeof theme;
