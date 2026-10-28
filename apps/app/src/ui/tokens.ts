import { palette } from "@revive-st/design";
import type { TextStyle } from "react-native";

/**
 * Design tokens for the app. Colours come from the shared dark palette in
 * `@revive-st/design` (also used by the website), plus app-only overlays.
 */
export const color = {
  ...palette.dark,
  scrim: "rgba(0,0,0,0.55)",
  shadow: "#000000",
} as const;

export type ColorName = keyof typeof color;

/** Muted hues for artwork placeholders, picked deterministically per title. */
export const artworkPalette = [
  "#3B2F4A",
  "#2F3F4A",
  "#2F4A3B",
  "#4A3B2F",
  "#4A2F35",
  "#2F4747",
  "#3F3F2A",
  "#352F4A",
] as const;

export const type = {
  largeTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
  subhead: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  /** Horizontal padding of every screen. */
  screen: 20,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const artwork = {
  row: 48,
  card: 64,
  tile: 132,
} as const;
