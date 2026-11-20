import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DiaryEntry, loadDiary, removeDiary } from '../../../diary';
import { diaryCars, entryCarKey, entryCarName } from '../../../diaryCars';
import { useGarage, vehicleTitle } from '../../../vehicle/garage';
import { space, ToolColour, type, useTheme } from '../../../theme';
import { Mascot } from '../../../brand/Mascot';
import { GUIDES } from '../../../help';
import { useSettings } from '../../../settings';
import { Chips, ConfirmSheet, Group, HeaderButton, Icon, IconName, Screen, tap } from '../../../ui';
import { dateText } from '../../../timeText';

const KIND: Record<string, { icon: IconName; colour: ToolColour }> = {
  'Oil service': { icon: 'oil', colour: 'orange' },
  Inspection: { icon: 'clipboard-check-outline', colour: 'blue' },
  'Service reset': { icon: 'wrench-clock', colour: 'green' },
  'Faults cleared': { icon: 'broom', colour: 'red' },
  // Entries saved before the rename keep their icon.
  'Codes cleared': { icon: 'broom', colour: 'red' },
  Brakes: { icon: 'car-brake-alert', colour: 'red' },
  Tyres: { icon: 'tire', colour: 'grey' },
  Battery: { icon: 'car-battery', colour: 'green' },
  Repair: { icon: 'wrench-outline', colour: 'indigo' },
  'Setting changed': { icon: 'tune-variant', colour: 'purple' },
  Other: { icon: 'note-outline', colour: 'grey' },
};

export default function Diary() {
  const t = useTheme();
  const { settings } = useSettings();
  const distanceUnit = settings.speed === 'mph' ? 'mi' : 'km';
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [remove, setRemove] = useState<DiaryEntry | null>(null);
  // With more than one car, a chip per car filters the list. Cars go by VIN,
  // so a renamed car keeps its entries and 2 cars with one name stay apart.
  const garage = useGarage();
  const nameOf = (vin: string) => {
    const v = garage.get(vin);
    return v ? vehicleTitle(v) : null;
  };
  const [car, setCar] = useState<string | null>(null);
  const cars = diaryCars(entries ?? [], nameOf);
  const shown = (entries ?? []).filter((e) => !car || entryCarKey(e) === car);

  useFocusEffect(
    useCallback(() => {
      loadDiary().then(setEntries);
    }, []),
  );

  return (
    <Screen
      title="Diary"
      guide={GUIDES.diary}
      trailing={<HeaderButton icon="plus" label="Add entry" filled onPress={() => router.push('/diary-add')} />}
    >
      {entries && entries.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: space.xxl * 2, paddingHorizontal: space.xl }}>
          <Mascot mood="happy" size={130} />
          <Text style={[type.title3, { color: t.text, marginTop: space.lg }]}>No entries yet</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: space.sm }]}>
            Services, repairs and notes you add show here. Cleared faults, service resets and setting changes are added for you.
          </Text>
        </View>
      ) : null}

      {cars.length > 1 ? (
        <Chips
          options={[{ id: '', label: 'All cars' }, ...cars.map((c) => ({ id: c.key, label: c.label }))]}
          value={car ?? ''}
          onPick={(id) => setCar(id || null)}
          style={{ marginBottom: space.lg }}
        />
      ) : null}

      {entries && entries.length ? (
        <Group header="Entries">
          {shown.map((e, i) => {
            const k = KIND[e.kind] ?? KIND.Other;
            return (
              <View key={e.id} style={[styles.entry, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
                <View style={[styles.icon, { backgroundColor: t[k.colour] }]}>
                  <Icon name={k.icon} size={17} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[type.heading, { color: t.text, flex: 1 }]}>{e.kind}</Text>
                    <Text style={[type.sub, type.number, { color: t.muted }]}>{formatDate(e.date)}</Text>
                  </View>
                  <Text style={[type.sub, { color: t.muted }]}>
                    {entryCarName(e, nameOf)}
                    {e.mileage != null ? ` · ${e.mileage.toLocaleString('en-GB')} ${e.unit ? (e.unit === 'mi' ? 'mi' : 'km') : distanceUnit}` : ''}
                  </Text>
                  {e.notes ? <Text style={[type.callout, { color: t.text, marginTop: space.xs }]}>{e.notes}</Text> : null}
                </View>
                {/* A bin at the row's end, as on a saved speed range; it asks first. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${e.kind} entry`}
                  onPress={() => {
                    tap();
                    setRemove(e);
                  }}
                  style={({ pressed }) => [styles.delete, { opacity: pressed ? 0.5 : 1 }]}
                >
                  <Icon name="trash-can-outline" size={18} color={t.danger} />
                </Pressable>
              </View>
            );
          })}
        </Group>
      ) : null}

      <ConfirmSheet
        visible={!!remove}
        title="Delete this entry?"
        lines={remove ? [`${remove.kind}, ${formatDate(remove.date)}, ${remove.vehicleName}. This cannot be undone.`] : []}
        confirmLabel="Delete entry"
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const e = remove;
          setRemove(null);
          if (!e) return;
          await removeDiary(e.id);
          setEntries(await loadDiary());
        }}
      />
    </Screen>
  );
}

// "9 Nov 2026" from the diary's own date (2026-11-09): src/timeText.ts.
const formatDate = (iso: string): string => dateText(iso);

const styles = StyleSheet.create({
  add: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  entry: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, alignItems: 'flex-start' },
  icon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  delete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginRight: -space.md },
});
