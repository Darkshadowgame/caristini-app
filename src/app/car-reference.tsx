import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CarPack, Fact, KnownFault, packFor } from '../data/cars';
import { SECTIONS } from '../help';
import { MONO, space, type, useTheme } from '../theme';
import { GlowCard, Group, Icon, ListRow, Notice, Pill, Screen } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';

// Car reference: fluids, specs, service schedule, known faults and recalls
// researched for one car, built into the app so it reads offline.
export default function CarReference() {
  const t = useTheme();
  const garage = useGarage();
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const v = garage.get(vin);
  const [open, setOpen] = useState<number | null>(null);
  const match = v ? packFor(v.vin, v.year, v.ids?.codes?.engineCode?.value) : null;

  if (!v || !match) {
    return (
      <Screen>
        <Notice text="There is no built-in reference for this car yet." />
      </Screen>
    );
  }
  const pack: CarPack = match.pack;

  const SourceLink = ({ s }: { s: Fact['source'] }) => (
    <Pressable accessibilityRole="link" accessibilityLabel={`Open source: ${s.label}`} onPress={() => Linking.openURL(s.url)} hitSlop={6}>
      <Text style={[type.caption, { color: t.faint, textDecorationLine: 'underline' }]}>{s.label}</Text>
    </Pressable>
  );

  const factRows = (rows: Fact[]) =>
    rows.map((f, i) => (
      <View key={`${f.item}-${i}`} style={[styles.fact, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'baseline' }}>
          <Text style={[type.small, { color: t.muted, flex: 2 }]}>{f.item}</Text>
          <Text selectable style={[type.body, { color: t.text, flex: 3 }]}>
            {f.value}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          {f.confidence === 'Medium' ? <Pill text="One source" /> : null}
          <View style={{ flex: 1 }}>
            <SourceLink s={f.source} />
          </View>
        </View>
      </View>
    ));

  const faultRow = (f: KnownFault, i: number) => {
    const shown = open === i;
    return (
      <View key={f.title} style={{ borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: t.border }}>
        <ListRow
          first
          title={f.title}
          subtitle={f.codes.length ? f.codes.join(', ') : f.symptoms}
          right={<Icon name={shown ? 'chevron-up' : 'chevron-down'} size={13} color={t.faint} />}
          noChevron
          onPress={() => setOpen(shown ? null : i)}
        />
        {shown ? (
          <View style={styles.detail}>
            {[
              ['Signs', f.symptoms],
              ['Codes', f.codes.join(', ')],
              ['Cause', f.cause],
              ['Usual fix', f.fix],
            ]
              .filter(([, x]) => x)
              .map(([k, x]) => (
                <View key={k} style={styles.kv}>
                  <Text style={[type.small, { color: t.muted, width: 80 }]}>{k}</Text>
                  <Text selectable style={[type.small, { color: t.text, flex: 1, fontFamily: k === 'Codes' ? MONO : undefined }]}>
                    {x}
                  </Text>
                </View>
              ))}
            {f.confidence === 'Medium' ? <Pill text="One source" /> : f.confidence === 'Low' ? <Pill text="Owners report" /> : null}
            <SourceLink s={f.source} />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <GlowCard tone="brand" style={{ padding: space.lg, gap: space.xs }}>
        <Text style={[type.title3, { color: t.text }]}>{pack.title}</Text>
        <Text style={[type.small, { color: t.muted }]}>
          For {vehicleTitle(v)}. Researched {pack.researched} from public pages; every line links to its source.
        </Text>
      </GlowCard>

      {!match.sure ? <Notice tone="info" icon="information-outline" text={`This is for engine code ${pack.engineCode}. Check the engine code on the data label and type it on Parts and IDs.`} /> : null}

      {pack.faults.length ? (
        <Group header="Known faults" help={SECTIONS.refFaults} footer="Faults owners and garages report most on this engine and model. Tap one for the signs, codes and usual fix.">
          {pack.faults.map(faultRow)}
        </Group>
      ) : null}

      {pack.fluids.length ? (
        <Group header="Fluids and capacities" help={SECTIONS.refFacts}>
          {factRows(pack.fluids)}
        </Group>
      ) : null}

      {pack.schedule.length ? (
        <Group header="Service schedule" help={SECTIONS.refFacts}>
          {factRows(pack.schedule)}
        </Group>
      ) : null}

      {pack.specs.length ? (
        <Group header="Specs and torque settings" help={SECTIONS.refFacts}>
          {factRows(pack.specs)}
        </Group>
      ) : null}

      <Group header="Recalls" help={SECTIONS.refRecalls} footer="Check open recalls for your own VIN with SEAT or on the GOV.UK vehicle recall checker.">
        {pack.recalls.length ? (
          pack.recalls.map((r, i) => (
            <View key={r.ref} style={[styles.fact, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
              <Text style={[type.body, { color: t.text }]}>{r.title}</Text>
              <Text style={[type.small, { color: t.muted }]}>
                {r.ref}
                {r.date ? `, ${r.date}` : ''}
              </Text>
              <SourceLink s={r.source} />
            </View>
          ))
        ) : (
          <ListRow first title="None found in public sources" noChevron />
        )}
        <ListRow icon="open-in-new" iconColour="blue" title="Check recalls on GOV.UK" onPress={() => Linking.openURL('https://www.check-vehicle-recalls.service.gov.uk/')} />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fact: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, gap: 4 },
  detail: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: 6 },
  kv: { flexDirection: 'row', gap: space.sm },
});
