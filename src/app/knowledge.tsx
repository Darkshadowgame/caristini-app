import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KB_KIND_LABEL, KbEntry, KbKind, kbForCar, loadKb, onKb, syncKb } from '../kb';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { Group, Icon, IconName, ListRow, Notice, Pill, Screen, SearchField, tap } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';
import { loadDiscovery } from '../discover';
import { ENRICHED_MODULES } from '../coding/enriched';
import { SECTIONS } from '../help';

const KIND_ICON: Record<KbKind, IconName> = {
  fuse: 'flash-outline',
  modification: 'wrench-outline',
  setting: 'tune-variant',
  sensor: 'radar' as IconName,
  procedure: 'clipboard-check-outline',
  module: 'chip',
  note: 'note-outline',
};

const RESEARCH = [
  { label: 'Fuse box layout', q: 'Find the fuse box layouts for my car and save them' },
  { label: 'Popular modifications', q: 'What are the most popular modifications for my car? Research and save the useful ones with sources' },
  { label: 'Hidden settings', q: 'Research coding settings owners have published for my car and save the ones with exact bytes and bits' },
  { label: 'Common faults', q: 'What are the common faults on my car and how are they fixed? Save the useful ones' },
  { label: 'Service schedule', q: 'What is the service schedule for my car, with oil grade and capacities? Save it' },
];

// Everything Caristini knows about this car beyond the built-in lists: what
// the AI researched and saved, shared through the repo with every install.
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
    setSync('Checking for new knowledge…');
    try {
      const n = await syncKb();
      setSync(n ? `${n} new or updated entries.` : 'Up to date.');
    } catch (e) {
      setSync(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <Text style={[type.sub, { color: t.muted, marginBottom: space.md }]}>
        {v ? `${vehicleTitle(v)}: ` : ''}what the AI researched and saved, shared with every Caristini install. It grows each time you ask.
      </Text>

      {garage.vehicles.length ? (
        <Group header="Parts and IDs" footer="VIN, codes, module part numbers and service parts for each of your cars, readable without the adapter.">
          {garage.vehicles.map((c, i) => (
            <ListRow key={c.vin} first={i === 0} icon={'barcode' as IconName} iconColour="indigo" title={vehicleTitle(c)} subtitle={c.vin} onPress={() => router.push({ pathname: '/car-ids', params: { vin: c.vin } })} />
          ))}
        </Group>
      ) : null}

      {v ? (
        <Group header={`Learned on ${vehicleTitle(v)}`} footer="Saved on this phone by Learn my car, health checks and the sensor search.">
          <ListRow first icon="radar" iconColour="blue" title="Sensors found" value={String(v.sensorsFound?.length ?? 0)} onPress={() => router.push('/sensors')} />
          <ListRow icon={'telescope' as IconName} iconColour="purple" title="Unknown values found" value={values.toLocaleString('en-GB')} onPress={() => router.push('/discover')} />
          <ListRow icon="chip" iconColour="indigo" title="Older modules found" value={String(v.deepFound?.length ?? 0)} onPress={() => router.push('/diagnostics')} />
          <ListRow icon="tune-variant" iconColour="green" title="Settings found by the AI" value={String(v.aiItems?.length ?? 0)} onPress={() => router.push('/customise')} />
          {learned.map(([id, k]) => (
            <ListRow
              key={id}
              icon="chip"
              iconColour="teal"
              title={k.plainName}
              subtitle={[k.part, k.what].filter(Boolean).join(' · ') || undefined}
              onPress={() => router.push(`/workshop/${id}`)}
            />
          ))}
          {!learned.length ? <ListRow icon="school-outline" iconColour="teal" title="Learn my car" subtitle="Finds every module and has the AI say what each one is" onPress={() => router.push('/learn-car')} /> : null}
        </Group>
      ) : null}

      <Text style={[type.label, { color: t.muted, marginBottom: space.sm, marginLeft: space.xs }]}>Ask the AI to research</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.lg }}>
        {RESEARCH.map((r) => (
          <Pressable
            key={r.label}
            accessibilityRole="button"
            onPress={() => {
              tap();
              router.push({ pathname: '/ask', params: { q: r.q } });
            }}
            style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? t.raised : t.surface }]}
          >
            <Icon name={'creation' as IconName} size={15} color={t.accent} />
            <Text style={[type.sub, { color: t.text, fontWeight: '600' }]}>{r.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SearchField value={query} onChange={setQuery} placeholder="Search saved knowledge" />
      <View style={{ height: space.lg }} />
      {sync ? <Notice icon="information-outline" text={sync} /> : null}

      {!shown.length ? (
        <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Icon name={'book-open-variant' as IconName} size={40} color={t.faint} />
          <Text style={[type.heading, { color: t.text, marginTop: space.md }]}>Nothing saved yet</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: 4 }]}>Tap one of the research buttons above, or ask Caristini AI anything about your car.</Text>
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
                  <View style={[styles.icon, { backgroundColor: t.accentSoft }]}>
                    <Icon name={KIND_ICON[e.kind]} size={16} color={t.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.heading, { color: t.text }]}>{e.title}</Text>
                    <Text style={[type.small, { color: t.muted }]} numberOfLines={expanded ? undefined : 2}>
                      {e.body}
                    </Text>
                    {expanded ? (
                      <View style={{ marginTop: space.sm, gap: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                          <Pill text={e.addedBy === 'ai' ? 'Found by AI' : 'Added by owner'} />
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
                        <Text style={[type.caption, { color: t.faint }]}>Saved {new Date(e.at).toLocaleDateString('en-GB')}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
        </Group>
      ))}

      <Group footer="New knowledge also arrives by itself each time the app opens.">
        <ListRow first icon="refresh" iconColour="blue" title="Check for new knowledge" onPress={refresh} />
        <ListRow icon={'creation' as IconName} iconColour="purple" title="Ask Caristini AI" onPress={() => router.push('/ask')} />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 9, borderRadius: 999 },
  entry: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  icon: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
