// What changed since the previous full health check of the same car: new,
// seen before (also in the last check) and cleared faults per module, in the
// words History uses. Used on the result and in History.
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { SECTIONS } from '../help';
import { HistoryEntry, HistoryFault, loadHistory, onHistory } from '../history';
import { diffScans, diffSummary, previousFull, ScanDiff } from '../diag/scanDiff';
import { Group, ListRow, Pill } from '../ui';
import { faultLabel } from '../diag/faults';
import { shortCode, when } from './LastScan';

// A saved check compared with the full check before it.
export function useScanDiff(entry: HistoryEntry | null): ScanDiff | null {
  const [diff, setDiff] = useState<ScanDiff | null>(null);
  useEffect(() => {
    if (!entry) {
      setDiff(null);
      return;
    }
    const load = () => loadHistory(entry.vin).then((l) => setDiff(diffScans(previousFull(l, entry), entry)));
    load();
    return onHistory(load);
  }, [entry]);
  return diff;
}

const open = (f: HistoryFault) => router.push({ pathname: '/code/[code]', params: { code: f.code, module: f.module } });

export function ScanChanges({ diff }: { diff: ScanDiff }) {
  const rows: { f: HistoryFault; tag: 'New' | 'Seen before' | 'Cleared' | 'Not read' | 'Not read last time'; module: string }[] = [];
  for (const m of diff.modules) {
    m.added.forEach((f) => rows.push({ f, tag: 'New', module: m.module }));
    m.recurring.forEach((f) => rows.push({ f, tag: 'Seen before', module: m.module }));
    m.cleared.forEach((f) => rows.push({ f, tag: 'Cleared', module: m.module }));
    m.notRead.forEach((f) => rows.push({ f, tag: 'Not read', module: m.module }));
    m.notReadBefore.forEach((f) => rows.push({ f, tag: 'Not read last time', module: m.module }));
  }
  const tone = { New: 'danger', 'Seen before': 'accent', Cleared: 'ok', 'Not read': 'neutral', 'Not read last time': 'neutral' } as const;
  return (
    <Group
      header={`Since the last check, ${when(diff.since.at)}`}
      help={SECTIONS.diagScanChanges}
      footer={[diff.recurring ? 'Seen before: the fault was there at the last check too, so it has not gone away.' : null, diff.notRead ? 'Not read: the module did not answer this time, so its faults are not counted as cleared.' : null, diff.notReadBefore ? 'Not read last time: the module did not answer at the last check, so these may not be new.' : null].filter(Boolean).join(' ') || undefined}
    >
      <ListRow first icon="compare-horizontal" iconColour="blue" title={diffSummary(diff)} noChevron />
      {rows.map(({ f, tag, module }, i) => (
        <ListRow
          key={`${tag}-${module}-${f.code}-${i}`}
          title={faultLabel(f) ?? 'Meaning not in the library yet'}
          subtitle={`${shortCode(f.code)} · ${module}`}
          right={<Pill text={tag} tone={tone[tag]} />}
          onPress={() => open(f)}
        />
      ))}
    </Group>
  );
}
