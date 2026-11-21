import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HISTORY_LABEL, HistoryEntry, HistoryKind, loadHistory, onHistory, removeHistory } from '../history';
import { diffScans, previousFull } from '../diag/scanDiff';
import { useSettings } from '../settings';
import { useConnection } from '../state';
import { MONO, onTool, radius, space, type, useTheme } from '../theme';
import { Chips, ConfirmSheet, Group, Icon, ListRow, Pill, Screen, tap, tool, ToolId, TOOLS } from '../ui';
import { faultLabel } from '../diag/faults';
import { clockText, dateText } from '../timeText';
import { useGarage, vehicleTitle } from '../vehicle/garage';

// Each entry wears the square of the tool that made it (TOOLS in src/ui.tsx),
// the same icon and colour that tool has on the Car tab.
const KIND_TOOL: Record<HistoryKind, ToolId> = {
  scan: 'health',
  clear: 'clear',
  change: 'customise',
  service: 'service',
  sensors: 'sensors',
  discover: 'discover',
  mot: 'mot',
  battery: 'battery',
};
const FILTERS: { key: 'all' | HistoryKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'scan', label: 'Health checks' },
  { key: 'clear', label: 'Cleared' },
  { key: 'change', label: 'Changes' },
  { key: 'service', label: 'Service' },
  { key: 'sensors', label: 'Sensors' },
  { key: 'discover', label: 'Learn my car' },
  { key: 'mot', label: 'MOT' },
  { key: 'battery', label: 'Battery' },
];

// Everything Pin16 did with a car, readable with no adapter connected:
// each scan with its faults, what was cleared, every setting changed.
export default function History() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ vin?: string }>();
  const vin = params.vin ?? conn.vehicle?.vin ?? garage.vehicles[0]?.vin;
  const v = garage.get(vin);
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  const [filter, setFilter] = useState<'all' | HistoryKind>('all');
  const [open, setOpen] = useState<string | null>(null);
  // The entry the owner asked to delete; deleted only after the confirm.
  const [removing, setRemoving] = useState<HistoryEntry | null>(null);

  const load = useCallback(() => {
    if (vin) loadHistory(vin).then(setList);
  }, [vin]);
  useEffect(() => {
    load();
    return onHistory(load);
  }, [load]);

  if (!vin || !v) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.muted, textAlign: 'center', marginTop: space.xxl }]}>No car yet. Connect once and every health check is kept here.</Text>
      </Screen>
    );
  }

  const shown = (list ?? []).filter((e) => filter === 'all' || e.kind === filter);
  const changes = (list ?? []).filter((e) => e.kind === 'change').length;
  // The app's one date and time format (src/timeText.ts).
  const day = dateText;
  const time = clockText;
  const miles = (km?: number) => (km == null ? null : settings.speed === 'mph' ? `${Math.round(km / 1.609344).toLocaleString('en-GB')} mi` : `${Math.round(km).toLocaleString('en-GB')} km`);

  // Group by day for the timeline.
  const days: { day: string; items: HistoryEntry[] }[] = [];
  for (const e of shown) {
    const d = day(e.at);
    const last = days[days.length - 1];
    if (last?.day === d) last.items.push(e);
    else days.push({ day: d, items: [e] });
  }

  return (
    <Screen>
      <Text style={[type.sub, { color: t.muted, marginBottom: space.md }]}>{vehicleTitle(v)}</Text>
      <Chips scroll options={FILTERS.map((f) => ({ id: f.key, label: f.label }))} value={filter} onPick={setFilter} />

      {/* Always shown, so the timeline can be found before the first change. */}
      {filter === 'all' || filter === 'change' ? (
        <Group>
          <ListRow
            first
            {...tool('timeline')}
            title="Change timeline"
            subtitle={changes ? `${changes} change${changes === 1 ? '' : 's'}, with old and new values. Put one back or share the list.` : 'No setting changes yet. Each one you make is listed here.'}
            onPress={() => router.push({ pathname: '/customise/timeline', params: { vin } })}
          />
        </Group>
      ) : null}

      {list && !shown.length ? (
        <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Icon name="progress-clock" size={40} color={t.faint} />
          <Text style={[type.heading, { color: t.text, marginTop: space.md }]}>No entries yet</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: 4 }]}>Run a health check and it is saved here, with every fault, so you can look back any time.</Text>
        </View>
      ) : null}

      {days.map((d) => (
        <Group key={d.day} header={d.day}>
          {d.items.map((e, i) => {
            const expanded = open === e.id;
            // Compared with the full check before it: new, recurring and cleared.
            const diff = e.kind === 'scan' ? diffScans(previousFull(list ?? [], e), e) : null;
            const tagOf = new Map<string, 'New' | 'Seen before'>();
            for (const m of diff?.modules ?? []) {
              m.added.forEach((f) => tagOf.set(`${f.module}|${f.code}`, 'New'));
              m.recurring.forEach((f) => tagOf.set(`${f.module}|${f.code}`, 'Seen before'));
            }
            const gone = (diff?.modules ?? []).flatMap((m) => m.cleared);
            const tag = (f: { module: string; code: string }) => tagOf.get(`${f.module}|${f.code}`);
            return (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                onPress={() => {
                  tap();
                  setOpen(expanded ? null : e.id);
                }}
                style={({ pressed }) => [styles.entry, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }, pressed && { backgroundColor: t.raised }]}
              >
                <View style={[styles.icon, { backgroundColor: t[TOOLS[KIND_TOOL[e.kind]].colour] }]}>
                  <Icon name={TOOLS[KIND_TOOL[e.kind]].icon} size={17} color={onTool(TOOLS[KIND_TOOL[e.kind]].colour)} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text style={[type.heading, { color: t.text, flex: 1 }]}>{e.title}</Text>
                    <Text style={[type.small, type.number, { color: t.muted }]}>{time(e.at)}</Text>
                  </View>
                  <Text style={[type.small, { color: t.muted, marginTop: 1 }]}>
                    {HISTORY_LABEL[e.kind]}
                    {e.detail ? ` · ${e.detail}` : ''}
                    {miles(e.odometerKm) ? ` · ${miles(e.odometerKm)}` : ''}
                  </Text>
                  {/* The title already gives the fault count; these say how it compares with the check before. */}
                  {e.kind === 'scan' && (diff?.added || diff?.recurring || gone.length) ? (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {diff?.added ? <Pill text={`${diff.added} new`} tone="danger" /> : null}
                      {diff?.recurring ? <Pill text={`${diff.recurring} seen before`} /> : null}
                      {gone.length ? <Pill text={`${gone.length} cleared`} tone="ok" /> : null}
                    </View>
                  ) : null}
                  {expanded && diff ? (
                    <Text style={[type.small, { color: t.muted, marginTop: space.sm }]}>
                      Compared with the full check of {day(diff.since.at)}, {time(diff.since.at)}.{diff.recurring ? ' Seen before: the fault was there then too, so it has not gone away.' : ''}
                    </Text>
                  ) : null}
                  {expanded && (e.faults?.length || gone.length) ? (
                    <View style={{ marginTop: space.sm, gap: 6 }}>
                      {(e.faults ?? []).map((f, k) => (
                        <Pressable
                          key={`${f.module}-${f.code}-${k}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${f.code}, ${f.module}${faultLabel(f) ? `, ${faultLabel(f)}` : ''}${tag(f) ? `, ${tag(f)!.toLowerCase()}` : ''}`}
                          onPress={() => router.push({ pathname: '/code/[code]', params: { code: f.code, module: f.module } })}
                          style={[styles.fault, { backgroundColor: t.sunken }]}
                        >
                          <Text style={[type.sub, { color: t.text, fontFamily: MONO }]}>{f.code}</Text>
                          <Text style={[type.small, { color: t.muted, flex: 1 }]} numberOfLines={2}>
                            {f.module}
                            {faultLabel(f) ? ` · ${faultLabel(f)}` : ''}
                          </Text>
                          {tag(f) ? <Pill text={tag(f)!} tone={tag(f) === 'New' ? 'danger' : 'neutral'} /> : null}
                        </Pressable>
                      ))}
                      {gone.map((f, k) => (
                        <View key={`gone-${f.code}-${k}`} style={[styles.fault, { backgroundColor: t.okSoft }]}>
                          <Text style={[type.sub, { color: t.ok, fontFamily: MONO, textDecorationLine: 'line-through' }]}>{f.code}</Text>
                          <Text style={[type.small, { color: t.ok, flex: 1 }]}>{f.module} · cleared since that check</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {expanded && e.motText ? (
                    <Text selectable style={[type.small, { color: t.text, marginTop: space.sm }]}>
                      {e.motText}
                    </Text>
                  ) : null}
                  {expanded && e.changes?.length
                    ? e.changes.map((c, k) => (
                        <View key={`${c.key ?? c.module}-${k}`} style={{ marginTop: space.sm }}>
                          <Text style={[type.small, { color: t.text }]}>
                            {c.module}: {c.setting}
                            {c.from || c.to ? `, ${c.from ?? '?'} to ${c.to ?? '?'}` : ''}
                          </Text>
                          <Text selectable style={[type.small, { color: t.muted, fontFamily: MONO }]}>
                            {c.before} → {c.after}
                          </Text>
                        </View>
                      ))
                    : expanded && e.before ? (
                        <Text selectable style={[type.small, { color: t.muted, fontFamily: MONO, marginTop: space.sm }]}>
                          {e.before} → {e.after}
                        </Text>
                      ) : null}
                  {/* On an opened entry only, and it asks first, like every other delete of saved data. */}
                  {expanded ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Delete this entry: ${e.title}`} onPress={() => setRemoving(e)} style={styles.delete}>
                      <Text style={[type.sub, { color: t.danger }]}>Delete entry</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Group>
      ))}

      <ConfirmSheet
        visible={!!removing}
        title="Delete this entry?"
        lines={removing ? [`${removing.title}, ${day(removing.at)}, ${time(removing.at)}. Taken out of History on this phone. This cannot be undone.`] : []}
        confirmLabel="Delete entry"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const e = removing;
          setRemoving(null);
          if (!e) return;
          setOpen(null);
          await removeHistory(e.id);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  icon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  delete: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: space.xs },
  fault: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.sm },
});
