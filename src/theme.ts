import { Platform, useColorScheme } from 'react-native';

// Monospace for codes and VINs: SF Mono's sibling Menlo on iPhone.
export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, Consolas, monospace' });
// For SVG text (chart labels), which does not inherit the app font: without
// it a browser draws Times.
export const SANS = Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif', default: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" });

// Pin16 colours: graphite ground, burnt orange accent. Dark is the main
// scene: the driver's seat at night. Orange fills the primary button, the lit
// pin and the selected state; switches that are on are green. Orange as text
// uses accentText, a lighter orange that holds 4.5:1 on every surface. Status
// is green, warn yellow and danger pink-red; orange is never a status colour.
//
// Contrast: every text colour (text, muted, faint, accentText, danger, ok,
// info, warn) is at least 4.5:1 on bg, surface, raised, sunken and its own
// soft wash, in both appearances (WCAG AA; __tests__/contrast.test.ts checks
// it).
const light = {
  bg: '#EFEFF2',
  surface: '#FFFFFF',
  raised: '#FFFFFF',
  sunken: '#E4E4E9',
  text: '#131316',
  muted: 'rgba(19,19,22,0.72)',
  faint: 'rgba(19,19,22,0.64)',
  border: 'rgba(19,19,22,0.14)',
  accent: '#E2560B',
  accentSoft: 'rgba(226,86,11,0.12)',
  accentText: '#A63A00',
  onAccent: '#0A0A0A',
  danger: '#B8123A',
  onDanger: '#FFFFFF',
  dangerSoft: 'rgba(184,18,58,0.1)',
  ok: '#196B2D',
  okSoft: 'rgba(52,199,89,0.14)',
  info: '#0058BA',
  infoSoft: 'rgba(0,122,255,0.12)',
  warn: '#6E5000',
  warnSoft: 'rgba(214,170,0,0.18)',
  hero: '#FFFFFF',
  onHero: '#131316',
  onHeroMuted: 'rgba(19,19,22,0.72)',
  // Tool icon squares (glyph colour from onTool).
  red: '#E5304F',
  blue: '#007AFF',
  green: '#34C759',
  indigo: '#5856D6',
  purple: '#AF52DE',
  teal: '#30B0C7',
  gold: '#C99700',
  grey: '#8E8E93',
  // Gradient pairs for state cards: brand (waiting), ok, fault.
  glowBrand: ['#FFE6D8', '#FFFFFF'] as [string, string],
  glowOk: ['#E2F6E8', '#FFFFFF'] as [string, string],
  glowFault: ['#FDE1E8', '#FFFFFF'] as [string, string],
};

const dark: typeof light = {
  bg: '#131316',
  surface: '#1B1B1F',
  raised: '#24242A',
  sunken: '#24242A',
  text: '#F5F5F7',
  muted: '#B0B0BB',
  faint: '#9A9AA6',
  border: '#303036',
  accent: '#E2560B',
  accentSoft: 'rgba(226,86,11,0.2)',
  accentText: '#FF8546',
  onAccent: '#0A0A0A',
  danger: '#FF7A97',
  onDanger: '#2A0612',
  dangerSoft: 'rgba(255,72,110,0.16)',
  ok: '#30D158',
  okSoft: 'rgba(48,209,88,0.16)',
  info: '#64B5FF',
  infoSoft: 'rgba(10,132,255,0.18)',
  warn: '#F5D33B',
  warnSoft: 'rgba(245,211,59,0.14)',
  hero: '#1B1B1F',
  onHero: '#F5F5F7',
  onHeroMuted: '#B0B0BB',
  red: '#FF5C7A',
  blue: '#0A84FF',
  green: '#30D158',
  indigo: '#5E5CE6',
  purple: '#BF5AF2',
  teal: '#40C8E0',
  gold: '#D9A400',
  grey: '#8E8E93',
  glowBrand: ['#3A1F10', '#1B1B1F'],
  glowOk: ['#0F2A1A', '#1B1B1F'],
  glowFault: ['#3A1620', '#1B1B1F'],
};

export const themes = { light, dark };

export type Theme = typeof light;
export type ToolColour = 'red' | 'blue' | 'green' | 'indigo' | 'purple' | 'teal' | 'gold' | 'grey';

// The glyph on a tool square: white on the deep colours, near-black on the
// light ones (gold, teal, green), where white would be under 3:1.
export function onTool(colour: ToolColour): string {
  return colour === 'gold' || colour === 'teal' || colour === 'green' ? '#0A0A0A' : '#FFFFFF';
}

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark;
}

export function useIsDark(): boolean {
  return useColorScheme() !== 'light';
}

// 8-point grid.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, field: 10, md: 12, lg: 16, xl: 22 };

// iOS Dynamic Type sizes at the default reading size; RN scales them with
// the user's text-size setting.
export const type = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const, letterSpacing: 0.37 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const, letterSpacing: 0.38 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, letterSpacing: -0.32 },
  sub: { fontSize: 15, lineHeight: 20, letterSpacing: -0.24 },
  small: { fontSize: 13, lineHeight: 18, letterSpacing: -0.08 },
  // Chart axes, tile footers and the label over a small figure.
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 13, lineHeight: 18, letterSpacing: -0.08, textTransform: 'uppercase' as const },
  // The headline count (faults, likely fails) and the running figure of a
  // drive tool (log length, trip distance, knock retard).
  figure: { fontSize: 56, lineHeight: 62, fontWeight: '700' as const, letterSpacing: -1 },
  figureMid: { fontSize: 48, lineHeight: 56, fontWeight: '700' as const, letterSpacing: -1 },
  number: { fontVariant: ['tabular-nums' as const] },
};

// Display face (Space Grotesk) for large titles, hero numbers and the
// wordmark only; body text stays the system font.
export const DISPLAY_FONT = { medium: 'SpaceGrotesk_500Medium', semibold: 'SpaceGrotesk_600SemiBold' } as const;
