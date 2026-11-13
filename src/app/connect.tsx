import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { bluetoothUnavailableReason, FoundAdapter, looksLikeObd, scanForAdapters } from '../obd/bleTransport';
import { DEMO_CARS } from '../obd/simTransport';
import { useSettings } from '../settings';
import { useConnection } from '../state';
import { space, type, useTheme } from '../theme';
import { Mascot } from '../brand/Mascot';
import { Button, GlowCard, Group, ListRow, Notice, Pill, ScanPulse, Screen } from '../ui';

// Demo cars are a development aid for the web preview only; the phone app
// always connects to a real adapter.
const SHOW_DEMO = Platform.OS === 'web';

export default function Connect() {
  const t = useTheme();
  const conn = useConnection();
  const bleBlocked = bluetoothUnavailableReason();
  const [scanning, setScanning] = useState(false);
  // True once a scan has run, so an empty result can say what to check.
  const [searched, setSearched] = useState(false);
  const [found, setFound] = useState<FoundAdapter[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  // Set once a connection succeeds, so the list does not flash back while the sheet closes.
  const [leaving, setLeaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const uiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopScan = () => {
    stopRef.current?.();
    stopRef.current = null;
    if (uiTimer.current) clearTimeout(uiTimer.current);
    uiTimer.current = null;
  };

  useEffect(() => stopScan, []);

  const scan = async () => {
    stopScan();
    setScanError(null);
    setFound([]);
    setScanning(true);
    setSearched(true);
    try {
      stopRef.current = await scanForAdapters(
        (a) => setFound((l) => (l.some((x) => x.id === a.id) ? l : [...l, a])),
        10000,
        (msg) => {
          stopScan();
          setScanning(false);
          setScanError(`Bluetooth search stopped: ${msg}. Check Bluetooth is on and Caristini may use it in iPhone Settings, then tap Search again.`);
        },
      );
      uiTimer.current = setTimeout(() => setScanning(false), 10000);
    } catch (e) {
      setScanning(false);
      setScanError(e instanceof Error ? e.message : String(e));
    }
  };

  // Start looking straight away on a phone.
  useEffect(() => {
    if (!bleBlocked) scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { settings } = useSettings();
  const done = (ok: boolean) => {
    if (!ok) return;
    setLeaving(true);
    router.dismissTo('/');
    // Optional: straight into a health check.
    if (settings.autoCheck) setTimeout(() => router.push('/diagnostics'), 300);
  };

  const sorted = [...found].sort((a, b) => Number(looksLikeObd(b.name)) - Number(looksLikeObd(a.name)) || (b.rssi ?? -999) - (a.rssi ?? -999));
  const likely = sorted.filter((a) => looksLikeObd(a.name));
  const others = sorted.filter((a) => !looksLikeObd(a.name));
  const shown = showAll || likely.length === 0 ? sorted : likely;

  if (conn.status === 'connecting' || leaving) {
    return (
      <Screen>
        <View style={styles.connecting}>
          <ScanPulse active={!leaving} size={170}>
            <Mascot mood={leaving ? 'happy' : 'scanning'} size={110} />
          </ScanPulse>
          <Text style={[type.title, { color: t.text, marginTop: space.lg, textAlign: 'center' }]}>{leaving ? 'Connected' : `${conn.step}…`}</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: space.sm }]}>
            The first connection can take up to 30 seconds while the adapter finds the car's protocol.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {conn.status === 'error' && conn.error ? <Notice tone="danger" icon="alert-circle-outline" text={conn.error} /> : null}

      <GlowCard tone="brand" style={styles.intro}>
        <ScanPulse active={scanning} size={150}>
          <Mascot mood={scanning ? 'scanning' : 'happy'} size={96} />
        </ScanPulse>
        <Text style={[type.title3, { color: t.text, marginTop: space.md, textAlign: 'center' }]}>
          {scanning ? 'Looking for your adapter' : found.length ? 'Pick your adapter' : 'Find your adapter'}
        </Text>
        <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: space.xs }]}>
          Adapter plugged in, ignition on. On iPhone use a Bluetooth LE OBD2 adapter (your Carista adapter is one).
        </Text>
        {bleBlocked ? (
          <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>
            <Notice icon="information-outline" text={bleBlocked} />
          </View>
        ) : (
          <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>
            <Button label={scanning ? 'Searching…' : found.length ? 'Search again' : 'Search for adapter'} icon="bluetooth" variant={found.length ? 'secondary' : 'primary'} disabled={scanning} onPress={scan} />
          </View>
        )}
      </GlowCard>

      {scanError ? <Notice tone="danger" icon="alert-circle-outline" text={scanError} /> : null}

      {shown.length ? (
        <Group header="Nearby" footer={likely.length && others.length ? undefined : 'Tap your adapter to connect.'}>
          {shown.map((a, i) => (
            <ListRow
              key={a.id}
              first={i === 0}
              icon="bluetooth"
              iconColour={looksLikeObd(a.name) ? 'blue' : 'grey'}
              title={a.name}
              subtitle={a.rssi != null ? (a.rssi >= -70 ? 'Strong signal' : 'Weak signal') : undefined}
              right={looksLikeObd(a.name) ? <Pill text="OBD adapter" tone="ok" /> : undefined}
              onPress={async () => {
                stopScan();
                setScanning(false);
                done(await conn.connectBluetooth(a.id, a.name));
              }}
            />
          ))}
          {likely.length && others.length ? (
            <ListRow
              title={showAll ? 'Hide other devices' : `Show ${others.length} other device${others.length === 1 ? '' : 's'}`}
              onPress={() => setShowAll((v) => !v)}
            />
          ) : null}
        </Group>
      ) : scanning ? (
        <View style={styles.searching}>
          <ActivityIndicator color={t.muted} />
          <Text style={[type.sub, { color: t.muted }]}>Searching…</Text>
        </View>
      ) : searched && Platform.OS !== 'web' ? (
        <Notice
          icon="bluetooth-off"
          text="No adapter found. Check it is plugged in under the dashboard, the ignition is on and Bluetooth is on. A Carista adapter shows as Carista. Then tap Search again."
        />
      ) : null}

      {SHOW_DEMO ? (
        <Group header="Demo cars (preview only)">
          {DEMO_CARS.map((c, i) => (
            <ListRow
              key={c.id}
              first={i === 0}
              icon="car-side"
              iconColour="grey"
              title={c.label}
              subtitle={`VIN ${c.vin}`}
              onPress={async () => done(await conn.connectDemo(c.id))}
            />
          ))}
        </Group>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  connecting: { alignItems: 'center', paddingTop: space.xxl * 2, paddingHorizontal: space.xl },
  intro: { alignItems: 'center', paddingVertical: space.xl },
  searching: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.lg },
});
