import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { addDiary, DIARY_KINDS, today } from '../diary';
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
  const [date, setDate] = useState(today());
  const [mileage, setMileage] = useState('');
  const [notes, setNotes] = useState('');
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const vehicle = garage.get(vin);

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
        <Text style={[type.small, { color: t.muted, marginBottom: 4 }]}>Date, for example 2026-11-12</Text>
        <TextInput value={date} onChangeText={setDate} accessibilityLabel="Date" style={input} />
        <Text style={[type.small, { color: t.muted, marginBottom: 4, marginTop: space.md }]}>Mileage (optional)</Text>
        <TextInput
          value={mileage}
          onChangeText={(x) => setMileage(x.replace(/[^\d]/g, ''))}
          keyboardType="number-pad"
          accessibilityLabel="Mileage"
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
      {!validDate ? <Body small style={{ color: t.danger, marginBottom: space.sm }}>Type the date as year-month-day, for example 2026-11-12.</Body> : null}
      <View style={{ gap: space.sm }}>
        <Button
          label="Save entry"
          icon="content-save-outline"
          disabled={!validDate}
          onPress={async () => {
            await addDiary({
              vin: vehicle?.vin ?? null,
              vehicleName: vehicle ? vehicleTitle(vehicle) : 'My car',
              date,
              kind,
              mileage: mileage ? Number(mileage) : null,
              notes: notes.trim(),
            });
            router.back();
          }}
        />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10 },
});
