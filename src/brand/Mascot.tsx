// Caristini's mascot: a little car in a mechanic's cap. Its face follows what
// the app is doing: asleep before a car is connected, wide-eyed while it
// scans, happy with no faults, worried when faults are found.
import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export type Mood = 'happy' | 'worried' | 'scanning' | 'asleep';

export const MASCOT = {
  body: '#FFB340',
  bodyShade: '#E8902A',
  ink: '#1E2430',
  cap: '#2B3A63',
  capBand: '#FFB340',
  glass: '#26324A',
};

export function Mascot({ mood = 'happy', size = 120, body = MASCOT.body }: { mood?: Mood; size?: number; body?: string }) {
  const ink = MASCOT.ink;
  const look = mood === 'scanning' ? 4 : 0;
  return (
    <Svg width={size} height={size * 0.8} viewBox="0 0 200 160" accessibilityRole="image" accessibilityLabel="Caristini car">
      <Ellipse cx={100} cy={151} rx={70} ry={6} fill="#000000" opacity={0.25} />
      {/* wheels */}
      <Rect x={38} y={116} width={30} height={30} rx={9} fill={ink} />
      <Rect x={132} y={116} width={30} height={30} rx={9} fill={ink} />
      {/* mirrors */}
      <Ellipse cx={20} cy={76} rx={9} ry={6} fill={body} />
      <Ellipse cx={180} cy={76} rx={9} ry={6} fill={body} />
      {/* cabin and windscreen */}
      <Path d="M58 34 Q64 22 80 22 L120 22 Q136 22 142 34 L162 76 L38 76 Z" fill={body} />
      <Path d="M66 38 Q70 31 80 31 L120 31 Q130 31 134 38 L149 70 L51 70 Z" fill={MASCOT.glass} />
      <Path d="M71 40 L84 40 L72 64 L61 64 Z" fill="#FFFFFF" opacity={0.16} />
      {/* body and bumper */}
      <Rect x={18} y={70} width={164} height={64} rx={26} fill={body} />
      <Rect x={30} y={124} width={140} height={7} rx={3.5} fill={MASCOT.bodyShade} />
      {/* mechanic's cap */}
      <Path d="M64 27 Q100 -16 136 27 Z" fill={MASCOT.cap} />
      <Rect x={62} y={21} width={76} height={8} rx={4} fill={MASCOT.capBand} />
      <Path d="M128 25 Q156 19 168 30 Q146 34 122 30 Z" fill={MASCOT.cap} />
      <Circle cx={100} cy={9} r={5} fill={MASCOT.capBand} />
      {/* headlight eyes */}
      <Eye cx={58} cy={98} mood={mood} look={look} />
      <Eye cx={142} cy={98} mood={mood} look={look} />
      {mood === 'worried' ? (
        <G stroke={ink} strokeWidth={4.5} strokeLinecap="round">
          <Path d="M44 78 L68 84" />
          <Path d="M156 78 L132 84" />
        </G>
      ) : null}
      {/* grille mouth */}
      <Mouth mood={mood} />
    </Svg>
  );
}

function Eye({ cx, cy, mood, look }: { cx: number; cy: number; mood: Mood; look: number }) {
  const ink = MASCOT.ink;
  if (mood === 'asleep') {
    return <Path d={`M${cx - 12} ${cy} Q${cx} ${cy + 9} ${cx + 12} ${cy}`} stroke={ink} strokeWidth={4.5} strokeLinecap="round" fill="none" />;
  }
  const r = mood === 'scanning' ? 16 : 15;
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill="#FFFFFF" />
      <Circle cx={cx + 2 + look} cy={cy + 2} r={mood === 'scanning' ? 6 : 7} fill={ink} />
      <Circle cx={cx + 5 + look} cy={cy - 1} r={2.4} fill="#FFFFFF" />
    </G>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  const ink = MASCOT.ink;
  const p = { stroke: ink, strokeWidth: 5, strokeLinecap: 'round' as const, fill: 'none' };
  if (mood === 'happy') return <Path d="M82 110 Q100 124 118 110" {...p} />;
  if (mood === 'worried') return <Path d="M84 120 Q100 110 116 120" {...p} />;
  if (mood === 'scanning') return <Ellipse cx={100} cy={115} rx={6} ry={7} fill={ink} />;
  return <Path d="M88 116 L112 116" {...p} />;
}
