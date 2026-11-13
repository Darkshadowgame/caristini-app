import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { goneSince, HISTORY_LABEL, HistoryEntry, HistoryKind, loadHistory, onHistory } from '../history';
import { useSettings } from '../settings';
import { useConnection } from '../state';
import { MONO, radius, space, type, useTheme, ToolColour } from '../theme';
import { Group, Icon, IconName, Pill, Screen, tap } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';

const KIND_ICON: Record<HistoryKind, IconName> = {
  scan: 'stethoscope',
  clear: 'broom',
  change: 'tune-variant',
  service: 'wrench-clock',
  sensors: 'radar' as IconName,
  discover: 'telescope' as IconName,
};
const KIND_COLOUR: Record<HistoryKind, ToolColour> = { scan: 'blue', clear: 'orange', change: 'purple', service: 'green', sensors: 'teal', discover: 'indigo' };
const FILTERS: { key: 'all' | HistoryKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'scan', label: 'Health checks' },
  { key: 'clear', label: 'Cleared' },
  { key: 'change', label: 'Changes' },
  { key: 'service', label: 'Service' },
  { key: 'sensors', label: 'Sensors' },
  { key: 'discover', label: 'Learning' },
];

// Everything Caristini did with a car, readable with no adapter connected:
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
  const scans = (list ?? []).filter((e) => e.kind === 'scan');
  const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.lg }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                setFilter(f.key);
              }}
              style={[styles.chip, { backgroundColor: on ? t.accent : t.surface }]}
            >
              <Text style={[type.sub, { color: on ? t.onAccent : t.text, fontWeight: '600' }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {list && !shown.length ? (
        <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Icon name="progress-clock" size={40} color={t.faint} />
          <Text style={[type.heading, { color: t.text, marginTop: space.md }]}>Nothing here yet</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: 4 }]}>Run a health check and it is saved here, with every fault, so you can look back any time.</Text>
        </View>
      ) : null}

      {days.map((d) => (
        <Group key={d.day} header={d.day}>
          {d.items.map((e, i) => {
            const expanded = open === e.id;
            const prev = e.kind === 'scan' ? scans[scans.indexOf(e) + 1] : undefined;
            const gone = e.kind === 'scan' ? goneSince(prev, e.faults ?? []) : [];
            const isNew = (f: { module: string; code: string }) => !!prev && !(prev.faults ?? []).some((p) => p.module === f.module && p.code === f.code);
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
                <View style={[styles.icon, { backgroundColor: t[KIND_COLOUR[e.kind]] }]}>
                  <Icon name={KIND_ICON[e.kind]} size={16} color="#FFFFFF" />
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
                  {e.kind === 'scan' && (e.faults?.length || gone.length) ? (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {e.faults?.length ? <Pill text={`${e.faults.length} fault${e.faults.length === 1 ? '' : 's'}`} tone="danger" /> : null}
                      {gone.length ? <Pill text={`${gone.length} gone since the last check`} tone="ok" /> : null}
                      {e.faults?.filter(isNew).length ? <Pill text={`${e.faults.filter(isNew).length} new`} tone="accent" /> : null}
                    </View>
                  ) : null}
                  {expanded && e.faults?.length ? (
                    <View style={{ marginTop: space.sm, gap: 6 }}>
                      {e.faults.map((f, k) => (
                        <Pressable
                          key={`${f.module}-${f.code}-${k}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${f.code}, ${f.module}${f.text ? `, ${f.text}` : ''}${isNew(f) ? ', new' : ''}`}
                          onPress={() => router.push({ pathname: '/code/[code]', params: { code: f.code, module: f.module } })}
                          style={[styles.fault, { backgroundColor: t.sunken }]}
                        >
                          <Text style={[type.sub, { color: t.text, fontFamily: MONO }]}>{f.code}</Text>
                          <Text style={[type.small, { color: t.muted, flex: 1 }]} numberOfLines={2}>
                            {f.module}
                            {f.text ? ` · ${f.text}` : ''}
                          </Text>
                          {isNew(f) ? <Pill text="New" tone="accent" /> : null}
                        </Pressable>
                      ))}
                      {gone.map((f, k) => (
                        <View key={`gone-${f.code}-${k}`} style={[styles.fault, { backgroundColor: t.okSoft }]}>
                          <Text style={[type.sub, { color: t.ok, fontFamily: MONO, textDecorationLine: 'line-through' }]}>{f.code}</Text>
                          <Text style={[type.small, { color: t.ok, flex: 1 }]}>{f.module} · gone since the check before</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {expanded && e.before ? (
                    <Text selectable style={[type.small, { color: t.muted, fontFamily: MONO, marginTop: space.sm }]}>
                      {e.before} → {e.after}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Group>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: space.md + 2, paddingVertical: 7, borderRadius: 999 },
  entry: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  icon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  fault: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.sm },
});
