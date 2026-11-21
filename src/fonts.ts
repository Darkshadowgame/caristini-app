import { useSyncExternalStore } from 'react';
import type { TextStyle } from 'react-native';
import { DISPLAY_FONT } from './theme';

// Whether the display font has loaded. The app never waits for it: until it
// is ready (or if it fails) display text uses the system font.
let ready = false;
const listeners = new Set<() => void>();

export function setDisplayFontReady(value: boolean) {
  if (ready === value) return;
  ready = value;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useDisplayFontReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => false);
}

// Style to add after a type.* style on display text. Empty until the font is
// ready, so the system font shows.
export function useDisplay(weight: keyof typeof DISPLAY_FONT = 'semibold'): TextStyle {
  return useDisplayFontReady() ? { fontFamily: DISPLAY_FONT[weight], fontWeight: 'normal' } : {};
}
