import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, space, type, useTheme } from '../theme';
import { useConnection } from '../state';
import { Body, Button, Card, ConfirmSheet, Group, IconName, Label, ListRow, Notice, Row, Screen, tap } from '../ui';
import { useGarage, Vehicle } from '../vehicle/garage';
import { LastScan, useLastScan } from '../components/LastScan';
import { decodeVin, GROUP_LABEL, MakeGroup } from '../vehicle/vin';

const GROUPS: MakeGroup[] = ['vag', 'ford', 'mazda', 'other'];
const PLATFORMS = ['MQB', 'MQB evo', 'MQB A0', 'PQ35', 'PQ25', 'PQ26', 'PQ46', 'MLB', 'MLB evo'];

export default function VehicleDetails() {
  const t = useTheme();
  const garage = useGarage();
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const v = garage.get(vin);
  const conn = useConnection();
  const [draft, setDraft] = useState<Vehicle | null>(v ?? null);
  const [yearText, setYearText] = useState(v?.year ? String(v.year) : '');
  const [confirmRemove, setConfirmRemove] = useState(false);
  // The last scan, readable with no adapter connected.
  const lastScan = useLastScan(vin);

  useEffect(() => {
    if (v && !draft) {
      setDraft(v);
      setYearText(v.year ? String(v.year) : '');
    }
  }, [v, draft]);

  if (!v || !draft) {
    return (
      <Screen>
        <Notice text="This car is not in Your cars. Connect to it once and it is saved." />
      </Screen>
    );
  }

  const decoded = decodeVin(v.vin);
  const isCurrent = conn.vehicle?.vin === v.vin;
  const set = (patch: Partial<Vehicle>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Screen>
      {lastScan ? <LastScan vin={v.vin} entry={lastScan} /> : null}
      <Group header="Records" footer="Kept on this phone, readable without the adapter.">
        <ListRow first icon={'barcode' as IconName} iconColour="indigo" title="Parts and IDs" subtitle="VIN, codes, module part numbers, service parts" onPress={() => router.push({ pathname: '/car-ids', params: { vin: v.vin } })} />
        <ListRow icon="progress-clock" iconColour="blue" title="History" subtitle="Every health check and its faults, clears and setting changes" onPress={() => router.push({ pathname: '/history', params: { vin: v.vin } })} />
        <ListRow icon={'book-open-variant' as IconName} iconColour="purple" title="Knowledge" subtitle="What the AI researched for this car" onPress={() => router.push('/knowledge')} />
        <ListRow icon="notebook-outline" iconColour="orange" title="Diary" subtitle="Services, repairs and notes" onPress={() => router.push('/diary')} />
      </Group>

      <Card>
        <Label>Detected from the VIN</Label>
        <Row label="VIN" value={v.vin} mono />
        <Row label="Make" value={decoded.brand ?? 'Not recognised'} />
        <Row label="Model" value={decoded.model ? `${decoded.model} (likely)` : 'Not in the VIN table'} />
        <Row label="Model year" value={decoded.year ? `${decoded.year}${decoded.yearReliable ? '' : ' (check)'}` : 'Not encoded'} />
        <Row label="Fuel" value={v.fuel ?? 'Unknown'} />
      </Card>

      <Card>
        <Label>Your details</Label>
        <Field label="Nickname" value={draft.nickname} onChange={(x) => set({ nickname: x })} placeholder="For example the owner's Golf" />
        <Field label="Make" value={draft.brand} onChange={(x) => set({ brand: x })} />
        <Field label="Model" value={draft.model} onChange={(x) => set({ model: x })} placeholder="For example Golf VII" />
        <Field
          label="Model year"
          value={yearText}
          onChange={(x) => setYearText(x.replace(/\D/g, '').slice(0, 4))}
          placeholder="For example 2018"
          keyboard="number-pad"
        />
        <Body muted small style={{ marginTop: space.md, marginBottom: space.sm }}>
          Maker group (decides service guides and customisations)
        </Body>
        <Choices options={GROUPS.map((g) => ({ id: g, label: GROUP_LABEL[g] }))} value={draft.group} onPick={(g) => set({ group: g as MakeGroup })} />
        {draft.group === 'vag' ? (
          <>
            <Body muted small style={{ marginTop: space.md, marginBottom: space.sm }}>
              Platform
            </Body>
            <Choices
              options={[{ id: '', label: 'Not sure' }, ...PLATFORMS.map((p) => ({ id: p, label: p }))]}
              value={draft.platform ?? ''}
              onPick={(p) => set({ platform: p || null })}
            />
          </>
        ) : null}
        <Body muted small style={{ marginTop: space.md, marginBottom: space.sm }}>
          Fuel
        </Body>
        <Choices
          options={[
            { id: 'Petrol', label: 'Petrol' },
            { id: 'Diesel', label: 'Diesel' },
          ]}
          value={draft.fuel ?? ''}
          onPick={(f) => set({ fuel: f as 'Petrol' | 'Diesel' })}
        />
      </Card>

      <View style={{ gap: space.sm }}>
        <Button
          label="Save"
          icon="content-save-outline"
          onPress={async () => {
            const year = /^\d{4}$/.test(yearText) ? Number(yearText) : null;
            await garage.update(v.vin, { ...draft, year, edited: true });
            router.back();
          }}
        />
        <Button label="Remove this car" icon="trash-can-outline" variant="ghost" onPress={() => setConfirmRemove(true)} />
      </View>
      <Text style={[type.small, { color: t.faint, marginTop: space.md }]}>Saved on this phone only.</Text>
      <ConfirmSheet
        visible={confirmRemove}
        title="Remove this car?"
        lines={[
          'Its details, nickname and last fault codes are deleted from this phone. Diary entries stay.',
          ...(isCurrent ? ['This is the car you are connected to, so Caristini disconnects first.'] : []),
        ]}
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={async () => {
          setConfirmRemove(false);
          if (isCurrent) await conn.disconnect();
          await garage.remove(v.vin);
          router.back();
        }}
      />
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: 'number-pad';
}) {
  const t = useTheme();
  return (
    <View style={{ marginTop: space.sm }}>
      <Text style={[type.small, { color: t.muted, marginBottom: 4 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.faint}
        keyboardType={keyboard}
        accessibilityLabel={label}
        style={[
          type.body,
          styles.input,
          { color: t.text, borderColor: t.border, backgroundColor: t.bg },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
        ]}
      />
    </View>
  );
}

export function Choices({ options, value, onPick }: { options: { id: string; label: string }[]; value: string; onPick: (id: string) => void }) {
  const t = useTheme();
  return (
    <View style={styles.choices}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id || 'none'}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              tap();
              onPick(o.id);
            }}
            style={[styles.choice, { borderColor: on ? t.accent : t.border, backgroundColor: on ? t.accentSoft : t.surface }]}
          >
            <Text style={[type.small, { fontWeight: '700', color: on ? t.accentText : t.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
});
