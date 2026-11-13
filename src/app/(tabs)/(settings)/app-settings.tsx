import React from 'react';
import { GUIDES } from '../../../help';
import SettingsScreen from '../../settings';

// The Settings tab: the same page as /settings, with its own large title.
export default function SettingsTab() {
  return <SettingsScreen title="Settings" guide={GUIDES.settings} />;
}
