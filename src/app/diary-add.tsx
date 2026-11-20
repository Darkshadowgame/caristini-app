import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { addDiary, DIARY_KINDS, parseUkDate, shiftDate, today, ukDate } from '../diary';
import { useSettings } from '../settings';
import { useConnection } from '../state';
import { space, useTheme } from '../theme';
import { Body, Button, Chips, Field, Group, Screen } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';

export default function DiaryAdd() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const [vin, setVin] = useState<string>(conn.vehicle?.vin ?? garage.vehicles[0]?.vin ?? '');
  const [kind, setKind] = useState('Oil service');
  // Typed and shown as DD/MM/YYYY; saved as year-month-day.
  const [dateText, setDateText] = useState(ukDate(today()));
  const [mileage, setMileage] = useState('');
  const [notes, setNotes] = useState('');
  const date = parseUkDate(dateText);
  const vehicle = garage.get(vin);
  const { settings } = useSettings();
  const unit = settings.speed === 'mph' ? 'mi' : 'km';
  const quick = [
    { id: today(), label: 'Today' },
    { id: shiftDate(today(), -1), label: 'Yesterday' },
  ];

  return (
    <Screen>
      {garage.vehicles.length ? (
        <Group header="Car" padded>
          <Chips onCard role="radio" options={garage.vehicles.map((v) => ({ id: v.vin, label: vehicleTitle(v) }))} value={vin} onPick={setVin} />
        </Group>
      ) : null}
      <Group header="What was done" padded>
        <Chips onCard role="radio" options={DIARY_KINDS.map((k) => ({ id: k, label: k }))} value={kind} onPick={setKind} />
      </Group>
      <Group header="Details" padded>
        <Field
          label="Date (day/month/year)"
          value={dateText}
          onChange={setDateText}
          accessibilityLabel="Date, day/month/year"
          placeholder="For example 12/11/2026"
          keyboard="numbers-and-punctuation"
          number
        />
        <Chips onCard options={quick} value={date ?? ''} onPick={(iso) => setDateText(ukDate(iso))} style={{ marginTop: space.sm }} />
        <Field
          label={`Mileage in ${unit === 'mi' ? 'miles' : 'km'} (optional)`}
          value={mileage}
          onChange={(x) => setMileage(x.replace(/[^\d]/g, ''))}
          keyboard="number-pad"
          accessibilityLabel={`Mileage in ${unit === 'mi' ? 'miles' : 'km'}`}
          placeholder="For example 48200"
          number
          style={{ marginTop: space.md }}
        />
        <Field label="Notes" value={notes} onChange={setNotes} multiline placeholder="Parts, garage, cost" style={{ marginTop: space.md }} />
      </Group>
      {!date ? <Body small style={{ color: t.danger, marginBottom: space.sm }}>Type the date as day/month/year, for example 12/11/2026.</Body> : null}
      <View>
        <Button
          label="Save entry"
          icon="content-save-outline"
          disabled={!date}
          onPress={async () => {
            if (!date) return;
            await addDiary({
              vin: vehicle?.vin ?? null,
              vehicleName: vehicle ? vehicleTitle(vehicle) : 'My car',
              date,
              kind,
              mileage: mileage ? Number(mileage) : null,
              ...(mileage ? { unit } : {}),
              notes: notes.trim(),
            });
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}

