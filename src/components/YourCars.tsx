// Every car connected to before, saved on this phone by its VIN. Shown at the
// bottom of the Car tab (it was the Garage tab).
import { router } from 'expo-router';
import React from 'react';
import { MakeBadge, makeLogoFor } from '../brand/MakeBadge';
import { GUIDES } from '../help';
import { useConnection } from '../state';
import { Group, ListRow, Pill } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';
import { GROUP_LABEL } from '../vehicle/vin';

export function YourCars() {
  const garage = useGarage();
  const conn = useConnection();
  if (!garage.vehicles.length) return null;
  return (
    <Group header="Your cars" help={GUIDES.garage} footer="Saved on this phone.">
      {garage.vehicles.map((v, i) => {
        const current = conn.vehicle?.vin === v.vin;
        const faults = v.lastCodes.length;
        return (
          <ListRow
            key={v.vin}
            first={i === 0}
            icon="car-side"
            iconColour="grey"
            leading={makeLogoFor(v.brand) ? <MakeBadge brand={v.brand} size={30} /> : undefined}
            title={vehicleTitle(v)}
            subtitle={[v.year, v.fuel, v.platform ?? GROUP_LABEL[v.group]].filter(Boolean).join(' · ')}
            right={
              current ? (
                <Pill text="Connected" tone="ok" />
              ) : v.lastCheckedAt == null ? undefined : faults ? (
                <Pill text={`${faults} fault${faults === 1 ? '' : 's'}`} tone="danger" />
              ) : (
                <Pill text="No faults" tone="ok" />
              )
            }
            onPress={() => router.push(`/vehicle?vin=${encodeURIComponent(v.vin)}`)}
          />
        );
      })}
    </Group>
  );
}
