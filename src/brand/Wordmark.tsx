import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useDisplay } from '../fonts';
import { useTheme } from '../theme';

// "Pin" in the text colour, "16" in the accent (accentText below 24 px, where
// the plain accent is under 4.5:1 on light grounds). Display face when loaded.
export function Wordmark({ size = 34, style }: { size?: number; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  const display = useDisplay('medium');
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="Pin16"
      style={[{ fontSize: size, lineHeight: Math.round(size * 1.2), letterSpacing: -0.02 * size, color: t.text, fontWeight: '600' }, display, style]}
    >
      Pin<Text style={{ color: size < 24 ? t.accentText : t.accent }}>16</Text>
    </Text>
  );
}
