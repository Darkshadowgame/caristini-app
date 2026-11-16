// Trip computer. Maths and sources: src/monitors/trip.ts.
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SECTIONS } from '../help';
import { addTrip, loadTrips, removeTrip } from '../monitors/store';
import { addTripSample, FUEL_METHOD_TEXT, FuelMethod, fuelMethod, KM_PER_MILE, lPer100ToMpgUk, newTrip, SavedTrip, summarise, Trip, TripSample } from '../monitors/trip';
import { LivePid, pidInfo } from '../obd/pids';
import { useSettings } from '../settings';
import { useConnection } from '../state';
import { space, type, useTheme } from '../theme';
import { Button, ConfirmSheet, GlowCard, Group, ListRow, NeedsConnection, Notice, Screen, success } from '../ui';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function TripScreen() {
  const conn = useConnection();
  if (!conn.client) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to start a trip" />
      </Screen>
    );
  }
  return (
    <Screen>
      <TripBody />
    </Screen>
  );
}

function TripBody() {
  const t = useTheme();
  const conn = useConnection();
  const client = conn.client!;
  const { settings } = useSettings();
  const mph = settings.speed === 'mph';
  const vin = conn.vehicle?.vin ?? null;
  const diesel = !!(conn.info?.diesel || conn.vehicle?.fuel === 'Diesel');
  const [supported, setSupported] = useState<Set<number> | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [kmh, setKmh] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedTrip[]>([]);
  const [remove, setRemove] = useState<SavedTrip | null>(null);
  const runRef = useRef(false);
  // Each run has its own number, so a loop from a finished trip ends even if
  // a new trip starts before it wakes up.
  const genRef = useRef(0);
  const tripRef = useRef<Trip | null>(null);

  const vinRef = useRef(vin);
  vinRef.current = vin;
  useEffect(() => {
    client.supportedPids().then(setSupported, () => setSupported(new Set()));
  }, [client]);
  // Leaving the page ends the trip; what was driven so far is kept.
  useEffect(
    () => () => {
      if (!runRef.current) return;
      runRef.current = false;
      const tr = tripRef.current;
      const v = vinRef.current;
      if (!tr || !v) return;
      const sum = summarise(tr);
      if (sum.km > 0) void addTrip({ id: `${tr.startedAt}`, vin: v, startedAt: tr.startedAt, endedAt: Date.now(), km: sum.km, hours: sum.hours, litres: sum.litres, method: tr.method });
    },
    [],
  );
  useEffect(() => {
    if (vin) loadTrips(vin).then(setSaved, () => undefined);
  }, [vin]);

  const method: FuelMethod = supported ? fuelMethod(diesel, supported) : 'none';
  const canRun = !!supported?.has(0x0d);

  const start = async () => {
    if (!supported || runRef.current) return;
    const list: LivePid[] = [pidInfo(0x0d)!];
    if (method === 'maf') {
      list.push(pidInfo(0x10)!);
      if (supported.has(0x44)) list.push(pidInfo(0x44)!);
    }
    if (method === 'rate') list.push(pidInfo(0x5e)!);
    let tr = newTrip(method, Date.now());
    tripRef.current = tr;
    setTrip(tr);
    runRef.current = true;
    const run = ++genRef.current;
    const mine = () => runRef.current && genRef.current === run;
    while (mine()) {
      if (client.moduleBusy) {
        await client.whenIdle();
        continue;
      }
      const before = Date.now();
      const got = await client.readLiveMany(list).catch(() => new Map<number, number | null>());
      if (!mine()) break;
      const s: TripSample = { t: (before + Date.now()) / 2, kmh: got.get(0x0d) ?? null, mafGs: got.get(0x10), lambda: got.get(0x44), rateLh: got.get(0x5e) };
      tr = addTripSample(tr, s);
      tripRef.current = tr;
      setTrip(tr);
      setKmh(s.kmh);
      // Room for other screens and a steady pace of about 2 readings a second.
      await sleep(Math.max(0, 500 - (Date.now() - before)));
    }
  };

  const finish = async () => {
    runRef.current = false;
    genRef.current++;
    const tr = tripRef.current;
    if (!tr) return;
    const sum = summarise(tr);
    if (vin && sum.km > 0) {
      const entry: SavedTrip = { id: `${tr.startedAt}`, vin, startedAt: tr.startedAt, endedAt: Date.now(), km: sum.km, hours: sum.hours, litres: sum.litres, method: tr.method };
      await addTrip(entry);
      setSaved((old) => [entry, ...old]);
      success();
    }
    tripRef.current = null;
    setTrip(null);
  };

  const distance = (km: number) => (mph ? `${(km / KM_PER_MILE).toFixed(1)} mi` : `${km.toFixed(1)} km`);
  const speed = (k: number | null) => (k == null ? '–' : mph ? `${Math.round(k / KM_PER_MILE)} mph` : `${Math.round(k)} km/h`);
  const economy = (l100: number | null) => (l100 == null ? '–' : mph ? `${lPer100ToMpgUk(l100).toFixed(1)} mpg` : `${l100.toFixed(1)} l/100 km`);
  const duration = (hours: number) => {
    const m = Math.round(hours * 60);
    return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
  };
  const sum = trip ? summarise(trip) : null;
  const running = !!trip;

  return (
    <>
      {running ? <Awake /> : null}
      <GlowCard tone="brand" style={{ padding: space.xl, marginBottom: space.xl }}>
        <Text style={[type.label, { color: t.muted }]}>{running ? 'This trip' : 'Trip'}</Text>
        <Text style={[styles.big, type.number, { color: t.text }]}>{sum ? distance(sum.km) : distance(0)}</Text>
        <View style={styles.stats}>
          <Stat label="Time" value={sum ? duration(sum.hours) : '–'} />
          <Stat label="Average" value={speed(sum?.avgKmh ?? null)} />
          <Stat label="Fuel used" value={method === 'none' ? 'Not available' : sum?.litres != null ? `${sum.litres.toFixed(2)} l` : '–'} />
          <Stat label="Economy" value={method === 'none' ? 'Not available' : economy(sum?.lPer100 ?? null)} />
        </View>
        <Text style={[type.small, type.number, { color: t.muted, marginTop: space.md }]}>
          {running ? `Now ${speed(kmh)}${trip!.gaps ? `. ${trip!.gaps} gap${trip!.gaps === 1 ? '' : 's'} in the readings skipped` : ''}` : 'Tap Start trip as you set off.'}
        </Text>
      </GlowCard>

      {supported && !canRun ? <Notice tone="danger" icon="alert-circle-outline" text="This car does not report speed over OBD, so the trip computer cannot run." /> : null}

      <View style={{ marginBottom: space.xl }}>
        {running ? (
          <Button label="Finish trip" icon="flag-checkered" onPress={finish} />
        ) : (
          <Button label="Start trip" icon="play" onPress={start} disabled={!canRun} busy={!supported} />
        )}
      </View>

      <Group header="Fuel" help={SECTIONS.monTripFuel}>
        <ListRow first title={method === 'maf' ? 'Estimated from air flow' : method === 'rate' ? 'Fuel rate from the engine' : 'Not available'} subtitle={FUEL_METHOD_TEXT[method]} />
      </Group>

      <Group header={vin ? 'Trips on this car' : 'Trips'} footer={saved.length ? 'Tap a trip to remove it.' : undefined}>
        {saved.length ? (
          saved.map((s, i) => {
            const l100 = s.litres != null && s.km >= 0.1 ? (s.litres / s.km) * 100 : null;
            const parts = [duration(s.hours), `average ${speed(s.hours > 0 ? s.km / s.hours : null)}`];
            if (s.litres != null) parts.push(`${s.litres.toFixed(1)} l, ${economy(l100)}`);
            return (
              <ListRow
                key={s.id}
                first={i === 0}
                title={new Date(s.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                subtitle={parts.join(', ')}
                value={distance(s.km)}
                onPress={() => setRemove(s)}
              />
            );
          })
        ) : (
          <ListRow first title="No trips yet" />
        )}
      </Group>

      <ConfirmSheet
        visible={!!remove}
        title="Remove this trip?"
        lines={['Removes it from this phone.']}
        confirmLabel="Remove trip"
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const r = remove;
          setRemove(null);
          if (!r) return;
          await removeTrip(r.id);
          setSaved((old) => old.filter((x) => x.id !== r.id));
        }}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[type.caption, { color: t.muted }]}>{label}</Text>
      <Text style={[type.heading, type.number, { color: t.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Awake() {
  useKeepAwake();
  return null;
}

const styles = StyleSheet.create({
  big: { fontSize: 48, lineHeight: 56, fontWeight: '700', letterSpacing: -1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md, rowGap: space.md },
  stat: { width: '50%' },
});
