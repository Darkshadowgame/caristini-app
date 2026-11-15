import { Stack } from 'expo-router';
import React from 'react';
import { GuideButton } from '../../../ui';
import Ask from '../../ask';

// The Caristini AI tab: the same assistant as the Ask screen, always one tap away.
export default function AiTab() {
  return (
    <>
      <Stack.Screen options={{ title: 'Caristini AI', headerLargeTitle: false, headerRight: () => <GuideButton id="ai" /> }} />
      <Ask />
    </>
  );
}
