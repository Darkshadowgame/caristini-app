// The last health check of a car, from History: readable with no adapter.
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { HistoryEntry, loadHistory, onHistory } from '../history';
import { SECTIONS } from '../help';
import { Group, ListRow } from '../ui';

export function useLastScan(vin: string | undefined): HistoryEntry | null {
  const [last, setLast] = useState<HistoryEntry | null>(null);
  useEffect(() => {
    if (!vin) return;
    const load = () => loadHistory(vin).then((l) => setLast(l.find((e) => e.kind === 'scan') ?? null));
    load();
    return onHistory(load);
  }, [vin]);
  return last;
}

// UDS codes carry a fault-type byte (P0011B5): people look up P0011.
export const shortCode = (code: string) => (/^[PCBU][0-9A-F]{4}[0-9A-F]{2}$/.test(code) ? code.slice(0, 5) : code);

export function when(at: number): string {
  const d = new Date(at);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function LastScan({ vin, entry, limit = 12 }: { vin: string; entry: HistoryEntry; limit?: number }) {
  const faults = entry.faults ?? [];
  return (
    <Group
      header={`Last health check, ${when(entry.at)}${entry.complete === false ? ' (stopped early)' : ''}`}
      footer={faults.length ? 'Tap a fault for what it means and what to do.' : undefined}
      help={SECTIONS.lastScan}
    >
      {faults.length ? (
        faults.slice(0, limit).map((f, i) => (
          <ListRow
            key={`${f.module}-${f.code}-${i}`}
            first={i === 0}
            title={f.text ?? 'Meaning not in the library yet'}
            subtitle={`${shortCode(f.code)} · ${f.module}`}
            onPress={() => router.push({ pathname: '/code/[code]', params: { code: f.code, module: f.module } })}
          />
        ))
      ) : (
        <ListRow first icon="check-circle-outline" iconColour="green" title="No faults found" subtitle={entry.detail} noChevron />
      )}
      {faults.length > limit ? <ListRow title={`${faults.length - limit} more in History`} onPress={() => router.push({ pathname: '/history', params: { vin } })} /> : null}
    </Group>
  );
}
