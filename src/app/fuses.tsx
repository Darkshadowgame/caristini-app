import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MakeBadge } from '../brand/MakeBadge';
import { Fuse, FUSE_CARS, FuseCar } from '../data/fuses';
import { useConnection } from '../state';
import { MONO, radius, space, type, useTheme } from '../theme';
import { Group, ListRow, Notice, Pill, Screen, SearchField } from '../ui';
import { Vehicle } from '../vehicle/garage';
import { SECTIONS } from '../help';

// Which fuse set matches a saved car: same maker group and brand, and a model word.
export function fuseCarFor(v: Pick<Vehicle, 'group' | 'brand' | 'model'> | null | undefined): FuseCar | undefined {
  if (!v) return undefined;
  const model = (v.model ?? '').toLowerCase().replace(/\s+/g, '');
  return FUSE_CARS.find(
    (c) => c.group === v.group && v.brand.toLowerCase().startsWith(c.brand.toLowerCase()) && c.models.some((m) => model.includes(m)),
  ) ?? FUSE_CARS.find((c) => c.group === v.group && c.models.some((m) => model.includes(m)));
}

const amps = (f: Fuse) => (f.notUsed || !f.amps ? 'Not used' : `${f.amps.join(' / ')} A`);

export default function Fuses() {
  const t = useTheme();
  const conn = useConnection();
  const params = useLocalSearchParams<{ car?: string }>();
  const [picked, setPicked] = useState<string | undefined>(params.car);
  const [q, setQ] = useState('');
  const car = FUSE_CARS.find((c) => c.id === picked) ?? fuseCarFor(conn.vehicle);

  if (!car) {
    return (
      <Screen>
        <Text style={[type.sub, { color: t.muted, marginBottom: space.md }]}>
          Fuse boxes and manual links are set up for these cars. Pick one.
        </Text>
        <CarPicker onPick={setPicked} />
      </Screen>
    );
  }

  const query = q.trim().toLowerCase();
  const match = (f: Fuse) => !query || f.fn.toLowerCase().includes(query) || f.id.toLowerCase() === query || (f.label ?? '').toLowerCase().includes(query);

  return (
    <Screen>
      <View style={styles.head}>
        <MakeBadge brand={car.brand} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={[type.title3, { color: t.text }]}>{car.title}</Text>
          <Text style={[type.small, { color: t.muted }]}>{car.manual}</Text>
        </View>
      </View>

      {car.caveats.length ? <Notice icon="information-outline" text={car.caveats.join(' ')} /> : null}

      <View style={{ marginBottom: space.lg }}>
        <SearchField value={q} onChange={setQ} placeholder="What stopped working? For example radio" />
      </View>

      {car.boxes.map((box, k) => {
        const list = box.fuses.filter(match);
        if (query && !list.length) return null;
        return (
          <Group key={box.id} header={box.name} help={k === 0 ? SECTIONS.fusesBox : undefined} footer={`${box.location}. ${box.access}${box.note ? ` ${box.note}` : ''}`}>
            {list.map((f, i) => (
              <View key={`${box.id}-${f.id}-${i}`} style={[styles.fuse, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, opacity: f.notUsed ? 0.5 : 1 }]}>
                <View style={[styles.id, { backgroundColor: t.sunken }]}>
                  <Text style={[type.small, { color: t.text, fontFamily: MONO }]}>{f.label ?? f.id}</Text>
                </View>
                <Text style={[type.sub, { color: t.text, flex: 1 }]}>
                  {f.fn}
                  {f.varies ? <Text style={{ color: t.muted }}> (some cars)</Text> : null}
                </Text>
                <Text style={[type.sub, type.number, { color: t.muted }]}>{amps(f)}</Text>
              </View>
            ))}
          </Group>
        );
      })}

      <Group header="Manuals and wiring" help={SECTIONS.fusesManuals} footer="Workshop manuals and wiring diagrams are sold by the maker; these are the official portals.">
        {car.links.map((l, i) => (
          <ListRow
            key={l.url}
            first={i === 0}
            icon="open-in-new"
            iconColour={l.official ? 'blue' : 'grey'}
            title={l.label}
            subtitle={l.note}
            right={l.official ? undefined : <Pill text="Unofficial copy" />}
            onPress={() => Linking.openURL(l.url)}
          />
        ))}
      </Group>

      <Group header="Other cars">
        <CarPicker onPick={setPicked} exclude={car.id} />
      </Group>
    </Screen>
  );
}

function CarPicker({ onPick, exclude }: { onPick: (id: string) => void; exclude?: string }) {
  const t = useTheme();
  return (
    <View>
      {FUSE_CARS.filter((c) => c.id !== exclude).map((c, i) => (
        <Pressable
          key={c.id}
          accessibilityRole="button"
          onPress={() => onPick(c.id)}
          style={({ pressed }) => [styles.pick, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, backgroundColor: pressed ? t.raised : t.surface }]}
        >
          <MakeBadge brand={c.brand} size={28} />
          <Text style={[type.body, { color: t.text, flex: 1 }]}>{c.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  fuse: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: space.lg },
  id: { minWidth: 44, alignItems: 'center', paddingVertical: 3, paddingHorizontal: 6, borderRadius: radius.sm },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
});
