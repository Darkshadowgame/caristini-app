// Fuel trims and lambda (petrol cars): short and long term trims per bank side
// by side with warning bands, and the lambda and O2 sensors with them.
import { useIsFocused } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BankPids, bandWords, COMMANDED_LAMBDA, TRIM_OK, TRIM_WATCH, trimBand, TrimBand, trimDirection, trimPids, trimPosition, trimTotal } from '../live/trims';
import { LivePid, pidInfo } from '../obd/pids';
import { useConnection } from '../state';
import { radius, space, type, useTheme, Theme } from '../theme';
import { Body, Button, Group, Label, NeedsConnection, ListRow, Notice, Screen } from '../ui';

const SCALE = 25;

export default function FuelTrims() {
  const conn = useConnection();
  const focused = useIsFocused();
  const [banks, setBanks] = useState<BankPids[] | null>(null);
  const [list, setList] = useState<LivePid[]>([]);
  const [values, setValues] = useState<Record<number, number | null>>({});
  const [paused, setPaused] = useState(false);
  const diesel = conn.vehicle?.fuel === 'Diesel';

  // Which trims and sensors this car reports.
  useEffect(() => {
    const c = conn.client;
    setBanks(null);
    setValues({});
    if (!c) return;
    c.supportedPids().then(
      (s) => {
        const r = trimPids(s);
        setBanks(r.banks);
        setList(r.pids.map((p) => pidInfo(p)).filter((p): p is LivePid => !!p));
      },
      () => setBanks([]),
    );
  }, [conn.client]);

  useEffect(() => {
    const c = conn.client;
    if (!c || !focused || paused || !list.length) return;
    let on = true;
    (async () => {
      while (on) {
        if (c.moduleBusy) {
          await c.whenIdle();
          continue;
        }
        const got = await c.readLiveMany(list).catch(() => new Map<number, number | null>());
        if (!on) break;
        const n = [...got.values()].filter((v) => v != null).length;
        if (got.size) setValues((old) => ({ ...old, ...Object.fromEntries(got) }));
        if (!n) await new Promise((r) => setTimeout(r, 1500));
      }
    })();
    return () => {
      on = false;
    };
  }, [conn.client, focused, paused, list]);

  if (!conn.client) {
    return (
      <Screen>
        <NeedsConnection what="fuel trims" />
      </Screen>
    );
  }

  const lambda = values[COMMANDED_LAMBDA];
  const sensorRows: React.ReactElement[] = [];
  if (lambda !== undefined) sensorRows.push(<ListRow first={!sensorRows.length} key="cmd" title="Lambda the engine asks for" value={fmt(lambda, 3, 'λ')} />);
  for (const b of banks ?? []) {
    const lam = b.lambda.find((p) => values[p] !== undefined);
    if (lam != null) sensorRows.push(<ListRow first={!sensorRows.length} key={`l${b.bank}`} title={`Lambda measured, bank ${b.bank}`} value={fmt(values[lam], 3, 'λ')} />);
    if (values[b.o2Front] !== undefined) sensorRows.push(<ListRow first={!sensorRows.length} key={`f${b.bank}`} title={`Front O2 sensor, bank ${b.bank}`} value={fmt(values[b.o2Front], 2, 'V')} />);
    if (values[b.o2Rear] !== undefined) sensorRows.push(<ListRow first={!sensorRows.length} key={`r${b.bank}`} title={`Rear O2 sensor, bank ${b.bank}`} value={fmt(values[b.o2Rear], 2, 'V')} />);
  }
  return (
    <Screen>
      {diesel ? <Notice icon="information-outline" text="This car is saved as a diesel. Fuel trims are a petrol engine reading, so they may be missing or mean something else here." /> : null}
      {banks && !banks.length ? <Notice text="The car did not report any fuel trims." /> : null}
      {banks == null ? <Body muted>Asking the car which values it reports…</Body> : null}

      {banks?.length ? (
        <>
          <Label>Per bank</Label>
          <View style={styles.banks}>
            {banks.map((b) => (
              <BankCard key={b.bank} bank={b} values={values} />
            ))}
          </View>
          <Body muted small style={{ marginTop: space.sm, marginBottom: space.lg }}>
            {`Plus: the engine adds fuel. Minus: it takes fuel away. Green within ${TRIM_OK} %, amber to ${TRIM_WATCH} %, red beyond.`}
          </Body>

          {sensorRows.length ? (
            <Group
              header="Lambda and oxygen sensors"
              footer="Lambda 1.00 is the ideal mixture. A front narrow-band sensor swings between about 0.1 and 0.9 V when the engine is warm; the rear one stays steadier."
            >
              {sensorRows}
            </Group>
          ) : null}
          <Button label={paused ? 'Resume' : 'Pause'} icon={paused ? 'play' : 'pause'} variant="secondary" onPress={() => setPaused((p) => !p)} />
        </>
      ) : null}
    </Screen>
  );
}

function fmt(v: number | null | undefined, decimals: number, unit: string): string {
  return v == null ? 'No reading' : `${v.toFixed(decimals)} ${unit}`;
}

function bandColour(t: Theme, b: TrimBand | null): string {
  return b === 'ok' ? t.ok : b === 'watch' ? t.accentText : b === 'high' ? t.danger : t.faint;
}

function BankCard({ bank, values }: { bank: BankPids; values: Record<number, number | null> }) {
  const t = useTheme();
  const short = values[bank.short];
  const long = values[bank.long];
  const total = trimTotal(short, long);
  const band = trimBand(total);
  const dir = trimDirection(total);
  return (
    <View style={[styles.bank, { backgroundColor: t.surface }]}>
      <Text style={[type.heading, { color: t.text }]}>Bank {bank.bank}</Text>
      <TrimLine label="Short term" value={short} />
      <TrimLine label="Long term" value={long} />
      <View style={[styles.total, { borderColor: t.border }]}>
        <Text style={[type.small, { color: t.muted }]}>Total</Text>
        <Text style={[type.title3, type.number, { color: bandColour(t, band) }]}>{total == null ? '–' : `${total > 0 ? '+' : ''}${total.toFixed(1)} %`}</Text>
        <Text style={[type.small, { color: bandColour(t, band) }]}>{bandWords(band)}</Text>
        {dir && dir !== 'none' ? <Text style={[type.caption, { color: t.muted, marginTop: 2 }]}>{dir === 'adding' ? 'Adding fuel (lean)' : 'Taking fuel away (rich)'}</Text> : null}
      </View>
    </View>
  );
}

// One trim with its value and a bar from -25 % to +25 %: green, amber and red zones.
function TrimLine({ label, value }: { label: string; value: number | null | undefined }) {
  const t = useTheme();
  const band = trimBand(value);
  const ok = TRIM_OK / SCALE / 2;
  const watch = TRIM_WATCH / SCALE / 2;
  const zone = (from: number, to: number, colour: string) => <View style={[styles.zone, { left: `${from * 100}%`, width: `${(to - from) * 100}%`, backgroundColor: colour }]} />;
  return (
    <View style={{ marginTop: space.md }} accessible accessibilityLabel={`${label} ${value == null ? 'no reading' : `${value.toFixed(1)} percent, ${bandWords(band)}`}`}>
      <View style={styles.lineHead}>
        <Text style={[type.small, { color: t.muted }]}>{label}</Text>
        <Text style={[type.sub, type.number, { color: bandColour(t, band), fontWeight: '600' }]}>{value == null ? '–' : `${value > 0 ? '+' : ''}${value.toFixed(1)} %`}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: t.dangerSoft }]}>
        {zone(0.5 - watch, 0.5 + watch, t.accentSoft)}
        {zone(0.5 - ok, 0.5 + ok, t.okSoft)}
        <View style={[styles.mid, { backgroundColor: t.border }]} />
        {value != null ? <View style={[styles.marker, { left: `${trimPosition(value, SCALE) * 100}%`, backgroundColor: bandColour(t, band) }]} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banks: { flexDirection: 'row', gap: space.md },
  bank: { flex: 1, borderRadius: radius.lg, padding: space.md },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 4 },
  zone: { position: 'absolute', top: 0, bottom: 0 },
  mid: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 4, marginLeft: -2, borderRadius: 2 },
  total: { marginTop: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
