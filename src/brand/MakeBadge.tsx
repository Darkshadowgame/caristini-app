// The connected car's maker mark, drawn white on the maker's own colour.
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MAKE_LOGOS } from './makeLogos';

const BY_BRAND: Record<string, string> = {
  audi: 'audi',
  volkswagen: 'volkswagen',
  vw: 'volkswagen',
  seat: 'seat',
  'seat / cupra': 'seat',
  cupra: 'seat',
  skoda: 'skoda',
  ford: 'ford',
  mazda: 'mazda',
};

export function makeLogoFor(brand: string | null | undefined) {
  if (!brand) return null;
  const key = BY_BRAND[brand.toLowerCase()] ?? BY_BRAND[brand.toLowerCase().split(' ')[0]];
  return key ? MAKE_LOGOS[key] : null;
}

export function MakeBadge({ brand, size = 30 }: { brand: string | null | undefined; size?: number }) {
  const logo = makeLogoFor(brand);
  if (!logo) return null;
  const pad = size * 0.18;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={logo.title}
      style={{ width: size, height: size, borderRadius: size * 0.24, backgroundColor: logo.hex, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size - pad * 2} height={size - pad * 2} viewBox="0 0 24 24">
        <Path d={logo.path} fill="#FFFFFF" />
      </Svg>
    </View>
  );
}
