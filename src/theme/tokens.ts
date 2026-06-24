/**
 * Golf Kaki — design tokens.
 * Source: design/design_handoff_golf_kaki/design-system/tokens/*.css
 * This is the single source of truth for color, type, spacing, radius,
 * shadow, and motion values. Never hardcode these in components.
 */

// ---- Fairway green (primary) ----
const green = {
  950: '#0A2C0C',
  900: '#0E3A10',
  800: '#134914', // brand deep green
  700: '#195C12', // wordmark green
  600: '#1E6E16', // tagline green
  500: '#237E1A', // tagline green (light)
  400: '#499A3E',
  300: '#7AB86F',
  200: '#AED4A9',
  100: '#DFEEDC',
  50: '#F0F6EE',
} as const;

// ---- Flag orange (accent) ----
const orange = {
  700: '#C75F1E',
  600: '#E0742E',
  500: '#FF914D', // brand accent (flag)
  400: '#FFA86E',
  300: '#FFC79E',
  200: '#FFDCC2',
  100: '#FFEEE0',
} as const;

// ---- Sand / parchment (neutral surfaces) ----
const sand = {
  50: '#FCFAF3',
  100: '#F7F2E6', // brand background
  200: '#EFE8D5',
  300: '#E3D9C0',
  400: '#CFC3A4',
  500: '#B3A581',
} as const;

// ---- Ink (warm, green-tinted neutrals for text) ----
const ink = {
  900: '#1C2B22',
  700: '#3A4A40',
  500: '#5E6B62',
  400: '#8A958C',
  300: '#B4BCB5',
} as const;

const white = '#FFFFFF';

// ---- Golf score colors (scorecard notation) ----
const score = {
  eagle: '#C98A23', // gold — 2 under or better
  birdie: '#E0742E', // orange — 1 under
  par: '#1E6E16', // green — even
  bogey: '#4E6E8E', // slate blue — 1 over
  double: '#B23B2E', // red — 2 over or worse
} as const;

// ---- Functional / status ----
const status = {
  success: '#237E1A',
  warning: '#E0742E',
  danger: '#B23B2E',
  info: '#4E6E8E',
} as const;

export const palette = { green, orange, sand, ink, white, score, status } as const;

/** Semantic color aliases — prefer these in components. */
export const colors = {
  // Brand
  primary: green[800],
  primaryHover: green[900],
  primaryActive: green[950],
  accent: orange[500],
  accentHover: orange[600],
  accentActive: orange[700],

  // Surfaces
  surfacePage: sand[100],
  surfaceCard: white,
  surfaceRaised: sand[50],
  surfaceSunken: sand[200],
  surfaceInverse: green[800],
  surfaceAccentSoft: orange[100],
  surfaceBrandSoft: green[50],

  // Text
  textPrimary: ink[900],
  textSecondary: ink[700],
  textMuted: ink[500],
  textDisabled: ink[400],
  textInverse: sand[50],
  textBrand: green[800],
  textAccent: orange[600],
  textOnAccent: white,

  // Borders
  borderSubtle: sand[200],
  borderDefault: sand[300],
  borderStrong: sand[400],
  borderBrand: green[800],
  borderFocus: green[500],

  // Score notation
  scoreEagle: score.eagle,
  scoreBirdie: score.birdie,
  scorePar: score.par,
  scoreBogey: score.bogey,
  scoreDouble: score.double,

  // Status
  statusSuccess: status.success,
  statusWarning: status.warning,
  statusDanger: status.danger,
  statusInfo: status.info,

  // Misc (RN can't render rgba() strings via shorthand, so spell them out)
  overlayScrim: 'rgba(14, 58, 40, 0.45)',
  focusRing: 'rgba(26, 126, 72, 0.35)',
} as const;

/** Font families. Load Quicksand, Plus Jakarta Sans & Space Grotesk via expo-font/useFonts before use. */
export const fontFamily = {
  display: 'Quicksand', // headings, big moments, brand wordmark
  body: 'PlusJakartaSans', // all UI / reading text
  numeric: 'SpaceGrotesk', // scores, handicaps, stats, money — tabular figures
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Type scale, in px (1rem = 16px). */
export const fontSize = {
  '2xs': 11,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 36,
  '4xl': 48,
  '5xl': 64, // hero score
} as const;

/** Line-height ratios — multiply by fontSize to get an RN lineHeight (see getLineHeight). */
export const leading = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.65,
} as const;

/** Letter-spacing ratios (em) — multiply by fontSize to get an RN letterSpacing (see getLetterSpacing). */
export const tracking = {
  tight: -0.02,
  normal: 0,
  wide: 0.04,
  wider: 0.12, // tagline / overline (TRACK SCORE · ADD FUN)
  widest: 0.2,
} as const;

/** RN's lineHeight is absolute px, unlike CSS's unitless ratio — derive it from a fontSize + leading ratio. */
export function getLineHeight(size: number, ratio: number): number {
  return Math.round(size * ratio);
}

/** RN's letterSpacing is absolute px, unlike CSS's `em` — derive it from a fontSize + tracking ratio. */
export function getLetterSpacing(size: number, ratio: number): number {
  return Math.round(size * ratio * 100) / 100;
}

/** Spacing — 4px base grid, in px. */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
  12: 96,
} as const;

/** Layout sizing. */
export const layout = {
  containerSm: 480,
  containerMd: 768,
  containerLg: 1100,
  gutter: spacing[4], // mobile side gutters — 18px per spec, see note below
  controlSm: 32,
  controlMd: 44, // default tap target
  controlLg: 54,
} as const;

/**
 * Spec README calls out 18px side gutters explicitly (not on the 4px grid) —
 * use this rather than `layout.gutter` (16px) for screen-edge padding.
 */
export const screenGutter = 18;

/** Corner radii, in px (radius-pill/circle are unitless RN conventions). */
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  pill: 999,
  circle: 9999,
} as const;

export const borderWidth = {
  thin: 1,
  med: 1.5,
  thick: 2,
} as const;

type ShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number; // Android
};

/** Shadows — warm green-tinted (never grey), as RN shadow* + Android elevation. */
export const shadows: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'accent', ShadowStyle> = {
  xs: { shadowColor: '#0E3A28', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  sm: { shadowColor: '#0E3A28', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  md: { shadowColor: '#0E3A28', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  lg: { shadowColor: '#0E3A28', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.14, shadowRadius: 32, elevation: 8 },
  xl: { shadowColor: '#0E3A28', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.18, shadowRadius: 56, elevation: 16 },
  // Accent CTA glow — flag-orange, for the one accent action per view.
  accent: { shadowColor: orange[500], shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6 },
};

/** Motion — quick + tactile. Durations in ms; easings as cubic-bezier params for Reanimated's Easing.bezier(...). */
export const motion = {
  duration: {
    fast: 120,
    base: 200,
    slow: 320,
  },
  easing: {
    out: [0.22, 1, 0.36, 1] as const,
    inOut: [0.65, 0, 0.35, 1] as const,
    bounce: [0.34, 1.56, 0.64, 1] as const, // playful overshoot — switch thumbs
  },
  pressScale: 0.985,
} as const;

export const tokens = {
  colors,
  palette,
  fontFamily,
  fontWeight,
  fontSize,
  leading,
  tracking,
  getLineHeight,
  getLetterSpacing,
  spacing,
  layout,
  screenGutter,
  radius,
  borderWidth,
  shadows,
  motion,
} as const;

export default tokens;
