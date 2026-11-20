import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { KB_KIND_LABEL, KbEntry, KbKind, kbForCar, loadKb, onKb, syncKb } from '../kb';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { Group, Icon, IconName, ListRow, Notice, Pill, Screen, SearchField, tap, tool } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';
import { loadDiscovery } from '../discover';
import { ENRICHED_MODULES } from '../coding/enriched';
import { sensorCount, sensorCountText } from '../vehicle/counts';
import { SECTIONS, WHAT_IS_SENT } from '../help';
import { dateText } from '../timeText';

const KIND_ICON: Record<KbKind, IconName> = {
  fuse: 'flash-outline',
  modification: 'wrench-outline',
  setting: 'tune-variant',
  sensor: 'radar' as IconName,
  procedure: 'clipboard-check-outline',
  module: 'chip',
  note: 'note-outline',
};

// Everything Caristini knows about this car beyond the built-in lists, shared
// through the repo with every install.
export default function Knowledge() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const v = conn.vehicle ?? garage.vehicles[0];
  const [all, setAll] = useState<KbEntry[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [sync, setSync] = useState<string | null>(null);

  const load = useCallback(() => {
    loadKb().then(setAll);
  }, []);
  useEffect(() => {
    load();
    return onKb(load);
  }, [load]);

  const mine = useMemo(() => (v ? kbForCar(all, v) : all), [all, v]);
  // What Learn my car, the deep scan, Discover and the sensor search saved on
  // this car (kept on the phone, separate from the shared notes below).
  const [values, setValues] = useState(0);
  useEffect(() => {
    if (!v) return;
    loadDiscovery(v.vin)
      .then((d) => setValues(Object.values(d.modules).reduce((n, m) => n + Object.keys(m.found).length, 0)))
      .catch(() => setValues(0));
  }, [v?.vin]);
  // Module notes researched for the A6 C7 (MLB) fill in modules not learned on the car.
  const builtIn =
    v?.group === 'vag' && v.platform === 'MLB'
      ? ENRICHED_MODULES.filter((m) => !v.knowledge?.[m.id]).map((m) => [m.id, { plainName: m.plainName, what: m.what, part: m.part, at: 0 }] as const)
      : [];
  const learned = v ? [...Object.entries(v.knowledge ?? {}), ...builtIn] : [];
  const q = query.trim().toLowerCase();
  const shown = mine.filter((e) => !q || `${e.title} ${e.body}`.toLowerCase().includes(q));
  const kinds = (Object.keys(KB_KIND_LABEL) as KbKind[]).filter((k) => shown.some((e) => e.kind === k));

  const refresh = async () => {
    setSync('Checking for new notes…');
    try {
      const n = await syncKb();
      setSync(n ? `${n} new or updated note${n === 1 ? '' : 's'}.` : 'Up to date.');
    } catch (e) {
      setSync(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <Text style={[type.sub, { color: t.muted, marginBottom: space.md }]}>
        {v ? `${vehicleTitle(v)}: ` : ''}notes for this kind of car, read from your findings store when the app opens. Each entry links to its sources.
      </Text>

      {garage.vehicles.length ? (
        <Group header="Parts and IDs" footer="VIN, codes, module part numbers and service parts for each of your cars, readable without the adapter.">
          {garage.vehicles.map((c, i) => (
            <ListRow key={c.vin} first={i === 0} {...tool('ids')} title={vehicleTitle(c)} subtitle={c.vin} onPress={() => router.push({ pathname: '/car-ids', params: { vin: c.vin } })} />
          ))}
        </Group>
      ) : null}

      {v ? (
        <Group header={`Learned on ${vehicleTitle(v)}`} footer={`Saved on this phone by Learn my car, health checks and Find my car’s sensors. ${WHAT_IS_SENT}`}>
          <ListRow first {...tool('sensors')} title="Sensors found" subtitle={sensorCountText(sensorCount(v))} onPress={() => router.push('/sensors')} />
          <ListRow {...tool('discover')} title="Unknown values found" value={values.toLocaleString('en-GB')} onPress={() => router.push('/discover')} />
          <ListRow {...tool('module')} title="Older VW modules found" value={String(v.deepFound?.length ?? 0)} onPress={() => router.push('/diagnostics')} />
          {learned.map(([id, k]) => (
            <ListRow
              key={id}
              {...tool('module')}
              title={k.plainName}
              subtitle={[k.part, k.what].filter(Boolean).join(' · ') || undefined}
              onPress={() => router.push(`/workshop/${id}`)}
            />
          ))}
          {!learned.length ? <ListRow {...tool('learn')} title="Learn my car" subtitle="Finds every module and value on this car" onPress={() => router.push('/learn-car')} /> : null}
        </Group>
      ) : null}

      <SearchField value={query} onChange={setQuery} placeholder="Search research notes" caps={false} />
      <View style={{ height: space.lg }} />
      {sync ? <Notice icon="information-outline" text={sync} /> : null}

      {!shown.length ? (
        <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Icon name={'book-open-variant' as IconName} size={40} color={t.faint} />
          <Text style={[type.heading, { color: t.text, marginTop: space.md }]}>No notes yet</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: 4 }]}>Notes for your kind of car arrive here when the app opens.</Text>
        </View>
      ) : null}

      {kinds.map((k, n) => (
        <Group key={k} header={KB_KIND_LABEL[k]} help={n === 0 ? SECTIONS.knowledgeEntries : undefined}>
          {shown
            .filter((e) => e.kind === k)
            .map((e, i) => {
              const expanded = open === e.id;
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
                  {/* A grey square: a note is a fact about the car, not a tool. */}
                  <View style={[styles.icon, { backgroundColor: t.grey }]}>
                    <Icon name={KIND_ICON[e.kind]} size={17} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.heading, { color: t.text }]}>{e.title}</Text>
                    <Text style={[type.small, { color: t.muted }]} numberOfLines={expanded ? undefined : 2}>
                      {e.body}
                    </Text>
                    {expanded ? (
                      <View style={{ marginTop: space.sm, gap: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                          <Pill text={e.addedBy === 'ai' ? 'From a web search' : 'Added by owner'} />
                          {e.car.model ? <Pill text={`${e.car.make} ${e.car.model}`} /> : <Pill text={e.car.make} />}
                          {e.car.platform ? <Pill text={e.car.platform} /> : null}
                        </View>
                        {e.sources.map((s) => (
                          <Pressable key={s.url} onPress={() => Linking.openURL(s.url)}>
                            <Text style={[type.small, { color: t.accentText }]} numberOfLines={1}>
                              {s.label}: {s.url}
                            </Text>
                          </Pressable>
                        ))}
                        <Text style={[type.caption, { color: t.muted }]}>Saved {dateText(e.at)}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
        </Group>
      ))}

      <Group footer="New notes also arrive by themselves each time the app opens.">
        <ListRow first icon="refresh" iconColour="blue" title="Check for new notes" onPress={refresh} />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  icon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
