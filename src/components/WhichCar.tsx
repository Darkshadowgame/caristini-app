// Shown on the Car tab when the connected car gave no VIN (some older cars do
// not answer the OBD VIN request, and their modules did not give it either).
// The owner picks one of their saved cars or types the VIN, and Caristini
// remembers that car for the next connect without a VIN.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MakeBadge, makeLogoFor } from '../brand/MakeBadge';
import { useConnection } from '../state';
import { space, useTheme } from '../theme';
import { Button, Field, Group, ListRow } from '../ui';
import { NO_VIN, useGarage, vehicleTitle } from '../vehicle/garage';
import { isValidVin } from '../vehicle/vin';

export function WhichCar() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const [open, setOpen] = useState(conn.vinSource === 'unknown');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  if (conn.vinSource !== 'unknown' && conn.vinSource !== 'remembered') return null;

  const current = conn.vehicle;
  const others = garage.vehicles.filter((x) => x.vin !== NO_VIN && x.vin !== current?.vin);
  const clean = typed.replace(/\s/g, '').toUpperCase();
  const valid = isValidVin(clean);
  const pick = async (vin: string) => {
    setBusy(true);
    try {
      await conn.assignVin(vin);
    } finally {
      setBusy(false);
    }
  };

  if (!open && current) {
    return (
      <Group header="Which car is this?" footer="This car does not send its VIN over OBD, so the VIN shown is the one saved for this car. Tap Change if this is a different car.">
        <ListRow first icon="car-side" iconColour="grey" title={vehicleTitle(current)} subtitle="Picked last time" value="Change" onPress={() => setOpen(true)} />
      </Group>
    );
  }

  return (
    <Group
      header="Which car is this?"
      footer="This car did not report its VIN. Pick it, or type the VIN from the V5C, the bottom of the windscreen or the data label in the boot. Caristini then knows the make and uses the right modules."
    >
      {others.map((v, i) => (
        <ListRow
          key={v.vin}
          first={i === 0}
          icon="car-side"
          iconColour="grey"
          leading={makeLogoFor(v.brand) ? <MakeBadge brand={v.brand} size={30} /> : undefined}
          title={vehicleTitle(v)}
          subtitle={v.vin}
          disabled={busy}
          onPress={() => pick(v.vin)}
        />
      ))}
      <View style={[styles.typeRow, others.length ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border } : null]}>
        <Field value={typed} onChange={setTyped} placeholder="Type the VIN (17 characters)" caps="characters" mono maxLength={20} accessibilityLabel="VIN" style={{ flex: 1 }} />
        <Button label="Use this VIN" compact disabled={!valid} busy={busy} onPress={() => pick(clean)} />
      </View>
    </Group>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },

});
