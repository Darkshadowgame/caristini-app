import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useIsDark, useTheme } from './theme';

// Each tab's own navigation stack: an iOS large title that collapses into the
// system bar material on scroll. The web preview draws its tab bar over the
// top, so it keeps the title in the page instead.
export function TabStack() {
  const t = useTheme();
  const dark = useIsDark();
  return (
    <Stack
      screenOptions={{
        headerShown: Platform.OS !== 'web',
        ...(Platform.OS === 'ios'
          ? {
              headerLargeTitle: true,
              headerTransparent: true,
              headerBlurEffect: dark ? ('systemChromeMaterialDark' as const) : ('systemChromeMaterialLight' as const),
              headerLargeStyle: { backgroundColor: 'transparent' },
              headerLargeTitleShadowVisible: false,
            }
          : { headerStyle: { backgroundColor: t.bg } }),
        headerShadowVisible: false,
        headerTintColor: t.accentText,
        headerTitleStyle: { color: t.text, fontWeight: '600' },
        headerLargeTitleStyle: { color: t.text },
        contentStyle: { backgroundColor: t.bg },
      }}
    />
  );
}
