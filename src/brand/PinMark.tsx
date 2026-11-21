// The Pin16 mark: the OBD2 port outline with pin 16 lit. The lit pin goes grey
// for "nothing here" and "not connected". Drawn on the 130 x 130 brand grid and
// cropped to the port.
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

const HOUSING = 'M28 38 H102 Q110 38 108.3 45.8 L99.7 84.2 Q98 92 90 92 H40 Q32 92 30.3 84.2 L21.7 45.8 Q20 38 28 38 Z';
const PIN = '#4A4A50';
const TOP = [37, 45, 53, 61, 69, 77, 85, 93];
const BOTTOM = [40, 47.14, 54.29, 61.43, 68.57, 75.71, 82.86, 90];

// The screen reader says "Pin16" when lit and "Not connected" when grey, or the
// label passed in. A mark that sits beside a title saying the same thing is
// `decorative`: hidden from the screen reader.
export function PinMark({ size = 64, lit = true, label, decorative = false }: { size?: number; lit?: boolean; label?: string; decorative?: boolean }) {
  const t = useTheme();
  const accent = lit ? t.accent : t.grey;
  const a11y = decorative
    ? ({ accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: label ?? (lit ? 'Pin16' : 'Not connected') } as const);
  return (
    <Svg width={size} height={size * (68 / 104)} viewBox="13 31 104 68" {...a11y}>
      <Path d={HOUSING} fill="none" stroke={accent} strokeWidth={4.5} strokeLinejoin="round" />
      {TOP.map((x) => (
        <Rect key={`t${x}`} x={x - 2.5} y={50} width={5} height={9} rx={1.6} fill={PIN} />
      ))}
      {BOTTOM.map((x, i) => (
        <Rect key={`b${x}`} x={x - 2.5} y={70} width={5} height={9} rx={1.6} fill={i === BOTTOM.length - 1 ? accent : PIN} />
      ))}
    </Svg>
  );
}
