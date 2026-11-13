import React, { useState } from 'react';
import { Text } from 'react-native';
import { GUIDE_GROUPS, GuideId, GUIDES } from '../help';
import { space, type, useTheme } from '../theme';
import { Group, HelpSheet, IconName, ListRow, Screen } from '../ui';

const ICON: Record<GuideId, IconName> = {
  home: 'car-side',
  connect: 'bluetooth',
  garage: 'garage-variant',
  vehicle: 'car-info',
  diagnostics: 'heart-pulse',
  code: 'alert-circle-outline',
  lookup: 'magnify',
  history: 'progress-clock',
  report: 'file-document-outline',
  live: 'chart-timeline-variant',
  sensors: 'radar' as IconName,
  dashboard: 'speedometer',
  battery: 'car-battery',
  performance: 'timer-outline',
  customise: 'tune-variant',
  customiseGuide: 'clipboard-check-outline',
  learnSetting: 'compare-horizontal',
  service: 'wrench-clock',
  serviceReset: 'wrench-clock',
  carIds: 'barcode',
  ai: 'creation' as IconName,
  knowledge: 'book-open-variant' as IconName,
  fuses: 'flash-outline',
  diary: 'notebook-outline',
  diaryAdd: 'pencil-outline',
  workshop: 'wrench-outline',
  module: 'chip',
  partNumbers: 'chip',
  learnCar: 'brain' as IconName,
  discover: 'telescope' as IconName,
  listen: 'record-circle-outline',
  settings: 'tune-variant',
};

const firstSentence = (s: string) => {
  const i = s.indexOf('. ');
  return i < 0 ? s : s.slice(0, i + 1);
};

// User guide: every screen's own help, grouped by what you want to do.
export default function Guide() {
  const t = useTheme();
  const [open, setOpen] = useState<GuideId | null>(null);
  return (
    <Screen>
      <Text style={[type.sub, { color: t.muted, marginBottom: space.lg }]}>
        What each screen does and how to use it. On any screen, tap the ? at the top right for its guide, or the ? beside a section for that section.
      </Text>
      {GUIDE_GROUPS.map((g) => (
        <Group key={g.title} header={g.title}>
          {g.ids.map((id, i) => (
            <ListRow key={id} first={i === 0} icon={ICON[id]} iconColour="grey" title={GUIDES[id].title} subtitle={firstSentence(GUIDES[id].what)}onPress={() => setOpen(id)} />
          ))}
        </Group>
      ))}
      {open ? <HelpSheet help={GUIDES[open]} visible onClose={() => setOpen(null)} /> : null}
    </Screen>
  );
}
