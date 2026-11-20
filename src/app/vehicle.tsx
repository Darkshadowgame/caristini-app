import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { space, type, useTheme } from '../theme';
import { useConnection } from '../state';
import { Body, Button, Chips, ConfirmSheet, Field, Group, ListRow, Notice, Screen, tool } from '../ui';
import { useGarage, Vehicle } from '../vehicle/garage';
import { CarRecordRows } from '../components/CarRecords';
import { LastScan, useLastScan } from '../components/LastScan';
import { detailsPatch } from '../vehicle/records';
import { decodeVin, GROUP_LABEL, MakeGroup, platformModels } from '../vehicle/vin';

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
      <Group header="Your details" padded>
        <Field label="Nickname" value={draft.nickname} onChange={(x) => set({ nickname: x })} placeholder="For example the owner’s Golf" />
        <Field label="Make" value={draft.brand} onChange={(x) => set({ brand: x })} style={{ marginTop: space.md }} />
        <Field label="Model" value={draft.model} onChange={(x) => set({ model: x })} placeholder="For example Golf VII" style={{ marginTop: space.md }} />
        <Field
          label="Model year"
          value={yearText}
          onChange={(x) => setYearText(x.replace(/\D/g, '').slice(0, 4))}
          placeholder="For example 2018"
          keyboard="number-pad"
          number
          style={{ marginTop: space.md }}
        />
        <Text style={[type.small, { color: t.muted, marginTop: space.md, marginBottom: space.sm }]}>Maker group (decides service guides and settings)</Text>
        <Chips onCard role="radio" options={GROUPS.map((g) => ({ id: g, label: GROUP_LABEL[g] }))} value={draft.group} onPick={(g) => set({ group: g as MakeGroup })} />
        {draft.group === 'vag' ? (
          <>
            <Text style={[type.small, { color: t.muted, marginTop: space.md, marginBottom: space.sm }]}>Platform</Text>
            <Chips
              onCard
              role="radio"
              options={[{ id: '', label: 'Not sure' }, ...PLATFORMS.map((p) => ({ id: p, label: p }))]}
              value={draft.platform ?? ''}
              onPick={(p) => set({ platform: p || null })}
            />
            <Body muted small style={{ marginTop: space.sm }}>
              {draft.platform
                ? `${draft.platform} includes ${platformModels(draft.platform).slice(0, 6).join(', ') || 'other VW group models'}.`
                : 'The platform is the base a car is built on. Not sure? Leave it: Caristini fills it in from the VIN or part numbers when it can.'}
            </Body>
          </>
        ) : null}
        <Text style={[type.small, { color: t.muted, marginTop: space.md, marginBottom: space.sm }]}>Fuel</Text>
        <Chips
          onCard
          role="radio"
          options={[
            { id: 'Petrol', label: 'Petrol' },
            { id: 'Diesel', label: 'Diesel' },
          ]}
          value={draft.fuel ?? ''}
          onPick={(f) => set({ fuel: f as 'Petrol' | 'Diesel' })}
        />
      </Group>

      <Button
        label="Save"
        icon="content-save-outline"
        onPress={async () => {
          // Only what this page edits: anything saved on the car since the
          // page opened (Parts and IDs, a health check) is kept.
          await garage.update(v.vin, detailsPatch(draft, yearText));
          router.back();
        }}
      />
      <Text style={[type.small, { color: t.muted, marginTop: space.sm, marginBottom: space.xl, textAlign: 'center' }]}>Saved on this phone only.</Text>

      <Group header="Detected from the VIN">
        <ListRow first title="VIN" value={v.vin} mono />
        <ListRow title="Make" value={decoded.brand ?? 'Not recognised'} />
        <ListRow title="Model" value={decoded.model ? `${decoded.model} (likely)` : 'Not in the VIN table'} />
        <ListRow title="Model year" value={decoded.year ? `${decoded.year}${decoded.yearReliable ? '' : ' (check)'}` : 'Not encoded'} />
        <ListRow title="Fuel" value={v.fuel ?? 'Unknown'} />
      </Group>

      {lastScan ? <LastScan vin={v.vin} entry={lastScan} /> : null}
      <Group header="Records" footer="Kept on this phone, readable without the adapter.">
        <ListRow first {...tool('ids')} title="Parts and IDs" subtitle="VIN, codes, module part numbers, service parts" onPress={() => router.push({ pathname: '/car-ids', params: { vin: v.vin } })} />
        <ListRow {...tool('history')} title="History" subtitle="Every health check and its faults, clears and setting changes" onPress={() => router.push({ pathname: '/history', params: { vin: v.vin } })} />
        {/* MOT check, saved logs, last battery reading and emissions read: all open with no adapter. */}
        <CarRecordRows v={v} />
        <ListRow {...tool('notes')} title="Research notes" subtitle="Notes saved for this kind of car" onPress={() => router.push('/knowledge')} />
        <ListRow {...tool('diary')} title="Diary" subtitle="Services, repairs and notes" onPress={() => router.push('/diary')} />
      </Group>

      <Button label="Remove this car" icon="trash-can-outline" variant="ghost" onPress={() => setConfirmRemove(true)} />
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


