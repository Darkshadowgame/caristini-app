import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { syncKb } from '../kb';
import { flushOutbox } from '../share/sendBack';
import { Platform, Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '../settings';
import { ConnectionProvider } from '../state';
import { useIsDark, useTheme } from '../theme';
import { GuideButton } from '../ui';
import { GarageProvider } from '../vehicle/garage';

export default function RootLayout() {
  const t = useTheme();
  const dark = useIsDark();
  // New knowledge (from any install or the AI) arrives when the app opens.
  useEffect(() => {
    syncKb().catch(() => undefined);
    // Findings that could not be sent before go now.
    flushOutbox().catch(() => undefined);
  }, []);
  return (
    <SafeAreaProvider>
      <SettingsProvider>
      <GarageProvider>
        <ConnectionProvider>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              // iOS: the system bar material over scrolling content; other platforms: solid.
              ...(Platform.OS === 'ios'
                ? { headerTransparent: true, headerBlurEffect: dark ? ('systemChromeMaterialDark' as const) : ('systemChromeMaterialLight' as const) }
                : { headerStyle: { backgroundColor: t.bg } }),
              headerTintColor: t.accentText,
              headerTitleStyle: { fontWeight: '600', color: t.text },
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: t.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
            <Stack.Screen name="connect" options={{ title: 'Connect', presentation: 'modal', headerLeft: () => <Cancel colour={t.accentText} />, headerRight: () => <GuideButton id="connect" /> }} />
            <Stack.Screen name="diagnostics" options={{ title: 'Health check', headerRight: () => <GuideButton id="diagnostics" /> }} />
            <Stack.Screen name="live" options={{ title: 'Live data', headerRight: () => <GuideButton id="live" /> }} />
            <Stack.Screen name="service" options={{ title: 'Service', headerRight: () => <GuideButton id="service" /> }} />
            <Stack.Screen name="car-ids" options={{ title: 'Parts and IDs', headerRight: () => <GuideButton id="carIds" /> }} />
            <Stack.Screen name="car-reference" options={{ title: 'Car reference', headerRight: () => <GuideButton id="carIds" /> }} />
            <Stack.Screen name="service-reset" options={{ title: 'Reset with the adapter', headerRight: () => <GuideButton id="serviceReset" /> }} />
            <Stack.Screen name="modules" options={{ title: 'Read part numbers', headerRight: () => <GuideButton id="partNumbers" /> }} />
            <Stack.Screen name="workshop/index" options={{ title: 'Workshop', headerRight: () => <GuideButton id="workshop" /> }} />
            <Stack.Screen name="fuses" options={{ title: 'Fuses and manuals', headerRight: () => <GuideButton id="fuses" /> }} />
            <Stack.Screen name="listen" options={{ title: 'Listen mode', headerRight: () => <GuideButton id="listen" /> }} />
            <Stack.Screen name="settings" options={{ title: 'Settings', headerRight: () => <GuideButton id="settings" /> }} />
            <Stack.Screen name="dashboard" options={{ title: 'Dashboard', headerRight: () => <GuideButton id="dashboard" /> }} />
            <Stack.Screen name="performance" options={{ title: 'Performance', headerRight: () => <GuideButton id="performance" /> }} />
            <Stack.Screen name="battery" options={{ title: 'Battery test', headerRight: () => <GuideButton id="battery" /> }} />
            <Stack.Screen name="report" options={{ title: 'Health report', headerRight: () => <GuideButton id="report" /> }} />
            <Stack.Screen name="sensors" options={{ title: 'Sensors', headerRight: () => <GuideButton id="sensors" /> }} />
            <Stack.Screen name="discover" options={{ title: 'Unknown values', headerRight: () => <GuideButton id="discover" /> }} />
            <Stack.Screen name="history" options={{ title: 'History', headerRight: () => <GuideButton id="history" /> }} />
            <Stack.Screen name="ask" options={{ title: 'Caristini AI', headerRight: () => <GuideButton id="ai" /> }} />
            <Stack.Screen name="learn-car" options={{ title: 'Learn my car', headerRight: () => <GuideButton id="learnCar" /> }} />
            <Stack.Screen name="knowledge" options={{ title: 'Research notes', headerRight: () => <GuideButton id="knowledge" /> }} />
            <Stack.Screen name="workshop/[id]" options={{ title: 'Control module', headerRight: () => <GuideButton id="module" /> }} />
            <Stack.Screen name="customise/index" options={{ title: 'Customise', headerRight: () => <GuideButton id="customise" /> }} />
            <Stack.Screen name="customise/[id]" options={{ title: '', headerRight: () => <GuideButton id="customiseGuide" /> }} />
            <Stack.Screen name="customise/learn" options={{ title: 'Learn from Carista', headerRight: () => <GuideButton id="learnSetting" /> }} />
            <Stack.Screen name="code/[code]" options={{ title: 'Fault code', headerRight: () => <GuideButton id="code" /> }} />
            <Stack.Screen name="vehicle" options={{ title: 'Vehicle details', headerRight: () => <GuideButton id="vehicle" /> }} />
            <Stack.Screen name="guide" options={{ title: 'User guide' }} />
            <Stack.Screen name="diary-add" options={{ title: 'Add to diary', presentation: 'modal', headerLeft: () => <Cancel colour={t.accentText} />, headerRight: () => <GuideButton id="diaryAdd" /> }} />
          </Stack>
        </ConnectionProvider>
      </GarageProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

// Cancel for modal sheets, in the tint, as iOS places it.
function Cancel({ colour }: { colour: string }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: colour, fontSize: 17, letterSpacing: -0.41 }}>Cancel</Text>
    </Pressable>
  );
}
