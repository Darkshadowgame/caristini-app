import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DiaryEntry, loadDiary, removeDiary } from '../../../diary';
import { space, ToolColour, type, useTheme } from '../../../theme';
import { Mascot } from '../../../brand/Mascot';
import { GUIDES } from '../../../help';
import { useSettings } from '../../../settings';
import { ConfirmSheet, Group, HeaderButton, Icon, IconName, Screen } from '../../../ui';

const KIND: Record<string, { icon: IconName; colour: ToolColour }> = {
  'Oil service': { icon: 'oil', colour: 'orange' },
  Inspection: { icon: 'clipboard-check-outline', colour: 'blue' },
  'Service reset': { icon: 'wrench-clock', colour: 'green' },
  'Faults cleared': { icon: 'broom', colour: 'red' },
  // Entries saved before the rename keep their icon.
  'Codes cleared': { icon: 'broom', colour: 'red' },
  Brakes: { icon: 'car-brake-alert', colour: 'red' },
  Tyres: { icon: 'tire', colour: 'grey' },
  Battery: { icon: 'car-battery', colour: 'teal' },
  Repair: { icon: 'wrench-outline', colour: 'indigo' },
  Other: { icon: 'note-outline', colour: 'grey' },
};

export default function Diary() {
  const t = useTheme();
  const { settings } = useSettings();
  const distanceUnit = settings.speed === 'mph' ? 'miles' : 'km';
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [remove, setRemove] = useState<DiaryEntry | null>(null);
  // With more than one car, a chip per car filters the list.
  const [car, setCar] = useState<string | null>(null);
  const cars = [...new Set((entries ?? []).map((e) => e.vehicleName).filter(Boolean))] as string[];
  const shown = (entries ?? []).filter((e) => !car || e.vehicleName === car);

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
          <Text style={[type.title3, { color: t.text, marginTop: space.lg }]}>Nothing logged yet</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: space.sm }]}>
            Services, repairs and notes you add show here. Cleared faults, service resets and setting changes are added for you.
          </Text>
        </View>
      ) : null}

      {cars.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
          {[null, ...cars].map((c) => (
            <Pressable
              key={c ?? 'all'}
              accessibilityRole="button"
              accessibilityState={{ selected: car === c }}
              onPress={() => setCar(c)}
              style={{ minHeight: 36, paddingHorizontal: space.md, borderRadius: 18, justifyContent: 'center', backgroundColor: car === c ? t.accent : t.surface }}
            >
              <Text style={[type.sub, { color: car === c ? t.onAccent : t.text, fontWeight: '600' }]}>{c ?? 'All cars'}</Text>
            </Pressable>
          ))}
        </View>
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
                    {e.vehicleName}
                    {e.mileage != null ? ` · ${e.mileage.toLocaleString('en-GB')} ${distanceUnit}` : ''}
                  </Text>
                  {e.notes ? <Text style={[type.callout, { color: t.text, marginTop: space.xs }]}>{e.notes}</Text> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${e.kind} entry`} hitSlop={8} onPress={() => setRemove(e)} style={styles.delete}>
                    <Text style={[type.small, { color: t.danger }]}>Delete</Text>
                  </Pressable>
                </View>
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

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  add: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  entry: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, alignItems: 'flex-start' },
  icon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  delete: { alignSelf: 'flex-start', marginTop: space.xs, minHeight: 44, justifyContent: 'center' },
});
