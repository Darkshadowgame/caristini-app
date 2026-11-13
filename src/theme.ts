import { Platform, useColorScheme } from 'react-native';

// Monospace for codes and VINs: SF Mono's sibling Menlo on iPhone.
export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, Consolas, monospace' });

// Caristini on iOS conventions: system grounds and grouped lists, one amber
// tint for everything you can tap, and system colours for state and for each
// tool's icon square (as in iOS Settings). Dark is the default scene: the
// driver's seat at night.
const light = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  raised: '#FFFFFF',
  sunken: '#E5E5EA',
  text: '#000000',
  muted: 'rgba(60,60,67,0.72)',
  faint: 'rgba(60,60,67,0.36)',
  border: 'rgba(60,60,67,0.22)',
  accent: '#FF9F0A',
  accentSoft: 'rgba(255,159,10,0.16)',
  accentText: '#A65F00',
  onAccent: '#1A1205',
  danger: '#D70015',
  onDanger: '#FFFFFF',
  dangerSoft: 'rgba(255,59,48,0.12)',
  ok: '#1F7A35',
  okSoft: 'rgba(52,199,89,0.14)',
  info: '#0062CC',
  infoSoft: 'rgba(0,122,255,0.12)',
  hero: '#FFFFFF',
  onHero: '#000000',
  onHeroMuted: 'rgba(60,60,67,0.72)',
  // Tool icon squares (white glyph on these).
  red: '#FF3B30',
  blue: '#007AFF',
  green: '#34C759',
  indigo: '#5856D6',
  purple: '#AF52DE',
  teal: '#30B0C7',
  orange: '#FF9500',
  grey: '#8E8E93',
  // Gradient pairs for state cards: brand (waiting), ok, fault.
  glowBrand: ['#FFF0D6', '#FFFFFF'] as [string, string],
  glowOk: ['#E2F6E8', '#FFFFFF'] as [string, string],
  glowFault: ['#FDE3E1', '#FFFFFF'] as [string, string],
};

const dark: typeof light = {
  bg: '#000000',
  surface: '#1C1C1E',
  raised: '#2C2C2E',
  sunken: '#2C2C2E',
  text: '#FFFFFF',
  muted: 'rgba(235,235,245,0.72)',
  faint: 'rgba(235,235,245,0.4)',
  border: 'rgba(84,84,88,0.6)',
  accent: '#FFB340',
  accentSoft: 'rgba(255,179,64,0.18)',
  accentText: '#FFB340',
  onAccent: '#1A1205',
  danger: '#FF6961',
  onDanger: '#FFFFFF',
  dangerSoft: 'rgba(255,69,58,0.2)',
  ok: '#30D158',
  okSoft: 'rgba(48,209,88,0.18)',
  info: '#64B5FF',
  infoSoft: 'rgba(10,132,255,0.2)',
  hero: '#1C1C1E',
  onHero: '#FFFFFF',
  onHeroMuted: 'rgba(235,235,245,0.64)',
  red: '#FF453A',
  blue: '#0A84FF',
  green: '#30D158',
  indigo: '#5E5CE6',
  purple: '#BF5AF2',
  teal: '#40C8E0',
  orange: '#FF9F0A',
  grey: '#8E8E93',
  glowBrand: ['#3D2A0C', '#1C1C1E'],
  glowOk: ['#0E2E1A', '#1C1C1E'],
  glowFault: ['#3F1412', '#1C1C1E'],
};

export type Theme = typeof light;
export type ToolColour = 'red' | 'blue' | 'green' | 'indigo' | 'purple' | 'teal' | 'orange' | 'grey';

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark;
}

export function useIsDark(): boolean {
  return useColorScheme() !== 'light';
}

// 8-point grid.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22 };

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
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 13, lineHeight: 18, letterSpacing: -0.08, textTransform: 'uppercase' as const },
  number: { fontVariant: ['tabular-nums' as const] },
};
