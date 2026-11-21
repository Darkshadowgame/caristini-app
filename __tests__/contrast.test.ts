import { themes } from '../src/theme';

type RGB = [number, number, number];

function parse(c: string): { rgb: RGB; a: number } {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`colour ${c}`);
  const p = m[1].split(',').map((x) => parseFloat(x));
  return { rgb: [p[0], p[1], p[2]], a: p[3] ?? 1 };
}

// Colour c laid over an opaque background.
function over(c: string, bg: RGB): RGB {
  const { rgb, a } = parse(c);
  return [0, 1, 2].map((i) => rgb[i] * a + bg[i] * (1 - a)) as RGB;
}

function lum(c: RGB) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

function ratio(a: RGB, b: RGB) {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const TEXT = ['text', 'muted', 'faint', 'accentText', 'danger', 'ok', 'info', 'warn'] as const;
const SOFT: Record<string, 'accentSoft' | 'dangerSoft' | 'okSoft' | 'infoSoft' | 'warnSoft'> = {
  accentText: 'accentSoft',
  danger: 'dangerSoft',
  ok: 'okSoft',
  info: 'infoSoft',
  warn: 'warnSoft',
};

describe.each(Object.entries(themes))('%s theme contrast (WCAG AA, 4.5:1)', (_name, t) => {
  const grounds: [string, RGB][] = [
    ['bg', parse(t.bg).rgb],
    ['surface', parse(t.surface).rgb],
    ['raised', parse(t.raised).rgb],
    ['sunken', parse(t.sunken).rgb],
    ['glowBrand', parse(t.glowBrand[0]).rgb],
    ['glowOk', parse(t.glowOk[0]).rgb],
    ['glowFault', parse(t.glowFault[0]).rgb],
  ];
  for (const token of TEXT) {
    for (const [gname, g] of grounds) {
      it(`${token} on ${gname}`, () => {
        expect(ratio(over(t[token], g), g)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  for (const [token, soft] of Object.entries(SOFT)) {
    for (const gname of ['bg', 'surface', 'raised']) {
      it(`${token} on its own wash over ${gname}`, () => {
        const g = parse(t[gname as 'bg' | 'surface' | 'raised']).rgb;
        const wash = over(t[soft], g);
        expect(ratio(over(t[token as 'danger'], wash), wash)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('text on the accent and danger fills', () => {
    expect(ratio(parse(t.onAccent).rgb, parse(t.accent).rgb)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(parse(t.onDanger).rgb, parse(t.danger).rgb)).toBeGreaterThanOrEqual(4.5);
  });
});
