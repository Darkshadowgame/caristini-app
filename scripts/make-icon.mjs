// Writes the HTML used to render Caristini's app icon, splash and Android
// adaptive icon foreground at full resolution (rendered to PNG in a browser).
// The artwork mirrors src/brand/Mascot.tsx (happy face).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });

const mascot = (mood = 'happy') => `
  <ellipse cx="100" cy="151" rx="70" ry="6" fill="#000" opacity="0.28"/>
  <rect x="38" y="116" width="30" height="30" rx="9" fill="#1E2430"/>
  <rect x="132" y="116" width="30" height="30" rx="9" fill="#1E2430"/>
  <ellipse cx="20" cy="76" rx="9" ry="6" fill="#FFB340"/>
  <ellipse cx="180" cy="76" rx="9" ry="6" fill="#FFB340"/>
  <path d="M58 34 Q64 22 80 22 L120 22 Q136 22 142 34 L162 76 L38 76 Z" fill="#FFB340"/>
  <path d="M66 38 Q70 31 80 31 L120 31 Q130 31 134 38 L149 70 L51 70 Z" fill="#26324A"/>
  <path d="M71 40 L84 40 L72 64 L61 64 Z" fill="#fff" opacity="0.16"/>
  <rect x="18" y="70" width="164" height="64" rx="26" fill="#FFB340"/>
  <rect x="30" y="124" width="140" height="7" rx="3.5" fill="#E8902A"/>
  <path d="M64 27 Q100 -16 136 27 Z" fill="#2B3A63"/>
  <rect x="62" y="21" width="76" height="8" rx="4" fill="#FFB340"/>
  <path d="M128 25 Q156 19 168 30 Q146 34 122 30 Z" fill="#2B3A63"/>
  <circle cx="100" cy="9" r="5" fill="#FFB340"/>
  ${[58, 142]
    .map((cx) =>
      mood === 'asleep'
        ? `<path d="M${cx - 12} 98 Q${cx} 107 ${cx + 12} 98" stroke="#1E2430" stroke-width="4.5" stroke-linecap="round" fill="none"/>`
        : `<circle cx="${cx}" cy="98" r="15" fill="#fff"/><circle cx="${cx + 2}" cy="100" r="7" fill="#1E2430"/><circle cx="${cx + 5}" cy="97" r="2.4" fill="#fff"/>`,
    )
    .join('')}
  <path d="M82 110 Q100 124 118 110" stroke="#1E2430" stroke-width="5" stroke-linecap="round" fill="none"/>`;

const page = (body, bg) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden;background:${bg}}
svg{display:block}
</style></head><body>${body}</body></html>`;

// App icon: navy field, amber glow, the mascot filling about two thirds.
const icon = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22305A"/><stop offset="1" stop-color="#0B1020"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.56" r="0.5">
      <stop offset="0" stop-color="#FFA21F" stop-opacity="0.38"/><stop offset="1" stop-color="#FFB340" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <g transform="translate(152 262) scale(3.6)">${mascot('happy')}</g>
</svg>`;

// Android adaptive foreground: transparent, artwork inside the safe 66% circle.
const adaptive = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(272 332) scale(2.4)">${mascot('happy')}</g>
</svg>`;

// Splash: the mascot alone on transparent, shown on the splash background colour.
const splash = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(212 312) scale(3)">${mascot('happy')}</g>
</svg>`;

writeFileSync(join(out, 'icon.html'), page(icon, '#0B1020'));
writeFileSync(join(out, 'adaptive.html'), page(adaptive, 'transparent'));
writeFileSync(join(out, 'splash.html'), page(splash, 'transparent'));
console.log('written to', out);
