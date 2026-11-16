import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { addDiary, DIARY_KINDS, parseUkDate, shiftDate, today, ukDate } from '../diary';
import { useSettings } from '../settings';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { Body, Button, Card, Label, Screen } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';
import { Choices } from './vehicle';

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

  const input = [
    type.body,
    styles.input,
    { color: t.text, borderColor: t.border, backgroundColor: t.bg },
    Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
  ];

  return (
    <Screen>
      {garage.vehicles.length ? (
        <Card>
          <Label>Car</Label>
          <Choices options={garage.vehicles.map((v) => ({ id: v.vin, label: vehicleTitle(v) }))} value={vin} onPick={setVin} />
        </Card>
      ) : null}
      <Card>
        <Label>What was done</Label>
        <Choices options={DIARY_KINDS.map((k) => ({ id: k, label: k }))} value={kind} onPick={setKind} />
      </Card>
      <Card>
        <Label>Details</Label>
        <Text style={[type.small, { color: t.muted, marginBottom: 4 }]}>Date (day/month/year)</Text>
        <Choices options={quick} value={date ?? ''} onPick={(iso) => setDateText(ukDate(iso))} />
        <TextInput
          value={dateText}
          onChangeText={setDateText}
          accessibilityLabel="Date, day/month/year"
          placeholder="For example 12/11/2026"
          placeholderTextColor={t.faint}
          keyboardType="numbers-and-punctuation"
          style={[input, { marginTop: space.sm }]}
        />
        <Text style={[type.small, { color: t.muted, marginBottom: 4, marginTop: space.md }]}>Mileage in {unit === 'mi' ? 'miles' : 'km'} (optional)</Text>
        <TextInput
          value={mileage}
          onChangeText={(x) => setMileage(x.replace(/[^\d]/g, ''))}
          keyboardType="number-pad"
          accessibilityLabel={`Mileage in ${unit === 'mi' ? 'miles' : 'km'}`}
          placeholder="For example 48200"
          placeholderTextColor={t.faint}
          style={input}
        />
        <Text style={[type.small, { color: t.muted, marginBottom: 4, marginTop: space.md }]}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          accessibilityLabel="Notes"
          placeholder="Parts, garage, cost"
          placeholderTextColor={t.faint}
          style={[input, { minHeight: 90, textAlignVertical: 'top' }]}
        />
      </Card>
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

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10 },
});
