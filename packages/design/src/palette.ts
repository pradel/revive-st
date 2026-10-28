/**
 * Revive ST colour palette, shared by the app (dark only) and the website
 * (light and dark). Structure comes from surface steps, not borders; `accent`
 * is reserved for the primary action and active/selected states.
 */
const dark = {
  bg: "#0B0B0C",
  surface1: "#161618",
  surface2: "#1F1F22",
  surface3: "#2A2A2E",
  separator: "rgba(255,255,255,0.08)",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.68)",
  textTertiary: "rgba(255,255,255,0.45)",
  /** Revive mint: the logo's neon green shifted towards teal, distinct from Spotify's brand green. */
  accent: "#2EDCA0",
  accentMuted: "rgba(46,220,160,0.16)",
  onAccent: "#04160F",
  danger: "#FF5449",
  /** Danger tint behind error banners. */
  dangerMuted: "rgba(255,84,73,0.16)",
  warning: "#FFB86C",
} as const;

export type ColorToken = keyof typeof dark;

/**
 * Same structure on light surfaces. The accent is a deeper Revive mint so text
 * and links stay WCAG AA: #0A7F5C is 5.0:1 on white and 4.55:1 on surface1,
 * and white text on it is 5.0:1.
 */
const light: Record<ColorToken, string> = {
  bg: "#FFFFFF",
  surface1: "#F4F4F5",
  surface2: "#EBEBED",
  surface3: "#E0E0E3",
  separator: "rgba(11,11,12,0.08)",
  textPrimary: "#0B0B0C",
  textSecondary: "rgba(11,11,12,0.68)",
  textTertiary: "rgba(11,11,12,0.6)",
  accent: "#0A7F5C",
  accentMuted: "rgba(46,220,160,0.18)",
  onAccent: "#FFFFFF",
  danger: "#C5221F",
  dangerMuted: "rgba(197,34,31,0.1)",
  warning: "#A15C00",
};

export const palette = { dark, light } as const;

/**
 * CSS custom property declarations for a palette, named after the tokens in
 * kebab case: `surface1` → `--surface-1`, `textPrimary` → `--text-primary`.
 */
export function cssVariables(colors: Record<ColorToken, string>): string {
  return Object.entries(colors)
    .map(
      ([token, value]) =>
        `--${token.replaceAll(/[A-Z]|\d+/gu, (part) => `-${part.toLowerCase()}`)}: ${value};`,
    )
    .join(" ");
}
