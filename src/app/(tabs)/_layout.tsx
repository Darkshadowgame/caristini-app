import { NativeTabs } from 'expo-router/native-tabs';
import React from 'react';
import { useConnection } from '../../state';
import { useTheme } from '../../theme';

// The system tab bar: Liquid Glass on iOS 26, SF Symbols, one amber tint.
export default function TabsLayout() {
  const t = useTheme();
  const conn = useConnection();
  return (
    <NativeTabs tintColor={t.accent} badgeBackgroundColor={t.red}>
      <NativeTabs.Trigger name="(car)">
        <NativeTabs.Trigger.Icon sf={{ default: 'car', selected: 'car.fill' }} md="directions_car" />
        <NativeTabs.Trigger.Label>Car</NativeTabs.Trigger.Label>
        {conn.info?.milOn ? <NativeTabs.Trigger.Badge>!</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(ai)">
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
        <NativeTabs.Trigger.Label>AI</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(lookup)">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Lookup</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(diary)">
        <NativeTabs.Trigger.Icon sf={{ default: 'book.closed', selected: 'book.closed.fill' }} md="menu_book" />
        <NativeTabs.Trigger.Label>Diary</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
