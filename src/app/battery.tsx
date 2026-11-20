import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ElmClient } from '../obd/elm';
import { pidInfo } from '../obd/pids';
import { useConnection } from '../state';
import { space, type, useTheme } from '../theme';
import { SECTIONS } from '../help';
import { Body, Button, GlowCard, Group, ListRow, NeedsConnection, Notice, Pill, Screen, success, Tone } from '../ui';
import { when } from '../components/LastScan';
import { useGarage } from '../vehicle/garage';
import { addHistory, updateHistory } from '../history';
import { dateTimeText } from '../timeText';

const RPM = pidInfo(0x0c)!;
const RUNNING_RPM = 400;
// The owner has 10 s to start the engine; sampling runs 2 s longer to catch a late start.
const CRANK_WINDOW_S = 10;
const CRANK_SAMPLE_MS = 12_000;

import { batteryResults, BatteryStep, batterySummary, BatteryTest, batteryTitle, chargeTooLow, chargeVerdict, crankVerdict, restTooHigh, restVerdict, resumableTest, savedResult, Verdict, withBatteryStep } from '../obd/battery';
export { chargeVerdict, crankVerdict, restVerdict };
export type { Verdict };

interface Crank {
  min: number;
  first: number;
  last: number;
  // Readings a second on this run; absent for a step carried on from a saved test.
  rate?: number;
}

// A read that failed, in plain words.
const failedRead = (e: unknown) => `The reading failed: ${e instanceof Error ? e.message : String(e)} Check the adapter is still connected, then try again.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Average of a few readings, so one noisy value does not decide the result.
async function steadyVolts(client: ElmClient, alive: () => boolean, n = 5): Promise<number | null> {
  const got: number[] = [];
  for (let i = 0; i < n && alive(); i++) {
    const v = await client.batteryVoltage();
    if (v != null) got.push(v);
    await sleep(300);
  }
  return got.length ? got.reduce((a, b) => a + b, 0) / got.length : null;
}

export default function Battery() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const client = conn.client;
  // The last reading saved on this phone (Learn my car, Health check), shown
  // until the adapter gives a new one, and with no adapter connected.
  const car = garage.get(conn.vehicle?.vin ?? garage.vehicles[0]?.vin);
  const saved = car?.battery;
  // The last test saved on this car, shown with its date when the page opens.
  const savedTest = car?.batteryTest;
  const [busy, setBusy] = useState<'rest' | 'crank' | 'idle' | 'load' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [rest, setRest] = useState<number | null>(null);
  const [crank, setCrank] = useState<Crank | null>(null);
  const [crankNow, setCrankNow] = useState<{ v: number; min: number; left: number } | null>(null);
  const [idle, setIdle] = useState<number | null>(null);
  const [load, setLoad] = useState<number | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const alive = () => aliveRef.current;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  // The test in hand. A saved test under 30 minutes old is carried on (the
  // page was left part-way); an older one stays as the last test and the next
  // reading starts a new one.
  const test = useRef<BatteryTest | null>(null);
  const resumed = useRef(false);
  const testVin = conn.vehicle?.vin;
  useEffect(() => {
    if (resumed.current || !garage.loaded || !testVin) return;
    resumed.current = true;
    const t0 = resumableTest(garage.latest(testVin)?.batteryTest, Date.now());
    if (!t0) return;
    test.current = t0;
    if (t0.rest != null) setRest(t0.rest);
    if (t0.crank) setCrank(t0.crank);
    if (t0.idle != null) setIdle(t0.idle);
    if (t0.load != null) setLoad(t0.load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garage.loaded, testVin]);

  // Each completed step is saved on the car at once, and the test keeps one
  // History entry with its verdicts, so leaving the page loses nothing.
  const saveStep = async (step: BatteryStep) => {
    if (!testVin) return;
    let next = withBatteryStep(test.current, step, Date.now());
    test.current = next;
    await garage.update(testVin, { batteryTest: next });
    const entry = { title: batteryTitle(next), detail: batterySummary(next) };
    if (next.historyId) await updateHistory(next.historyId, entry);
    else {
      const historyId = await addHistory({ vin: testVin, kind: 'battery', ...entry, odometerKm: garage.latest(testVin)?.odometerKm });
      // A later step may have been saved meanwhile: add the id to the newest copy.
      next = { ...(test.current ?? next), historyId };
      test.current = next;
      await garage.update(testVin, { batteryTest: next });
    }
  };

  // Last reading: read when the page opens and every 10 s between steps, as
  // the Car tab does, so the figure matches it. Paused while a step reads.
  useEffect(() => {
    if (!client) return undefined;
    let on = true;
    const read = () => {
      if (busyRef.current) return;
      client.batteryVoltage().then(
        (v) => {
          if (on && v != null && !busyRef.current) setLast(v);
        },
        () => undefined,
      );
    };
    read();
    const id = setInterval(read, 10000);
    return () => {
      on = false;
      clearInterval(id);
    };
  }, [client]);

  const fmt = (v: number) => `${v.toFixed(2)} V`;
  if (!client) {
    const lastRows = batteryResults(savedTest);
    return (
      <Screen>
        {saved ? <Notice icon="car-battery" text={`Last reading ${saved.volts.toFixed(2)} V, from ${saved.from}, ${when(saved.at)}.`} /> : null}
        {savedTest && lastRows.length ? (
          <Group header={`Last test, ${dateTimeText(savedTest.at)}`} footer="The adapter measures at the OBD port, which reads slightly lower than at the battery.">
            {lastRows.map((r, i) => (
              <ListRow key={r.key} first={i === 0} title={r.title} subtitle={`${fmt(r.v)}. ${r.verdict.text}`} right={<Pill text={r.verdict.word} tone={r.verdict.tone} />} />
            ))}
          </Group>
        ) : null}
        <NeedsConnection title="Connect your car to test the battery" />
      </Screen>
    );
  }
  const shown = last ?? saved?.volts ?? null;

  // Engine speed, or null when the car does not report it.
  const rpm = () => client.readLive(RPM);

  const readRest = async () => {
    setBusy('rest');
    setMessage(null);
    try {
      const r = await rpm();
      if (r != null && r > RUNNING_RPM) {
        setMessage('The engine is running. Switch it off, leave the ignition on, then read again.');
        return;
      }
      const v = await steadyVolts(client, alive);
      if (!alive()) return;
      if (v == null) setMessage('The adapter did not report a voltage.');
      else if (restTooHigh(v)) {
        // Not a rest reading (the car may not report engine speed): shown, not judged or saved.
        setLast(v);
        setMessage(restTooHigh(v));
      } else {
        setRest(v);
        setLast(v);
        success();
        await saveStep({ rest: v });
      }
    } catch (e) {
      if (alive()) setMessage(failedRead(e));
    } finally {
      if (alive()) setBusy(null);
    }
  };

  const runCrank = async () => {
    setBusy('crank');
    setMessage(null);
    setCrank(null);
    try {
      const r = await rpm();
      if (r != null && r > RUNNING_RPM) {
        setMessage('The engine is already running. Switch it off, wait a minute, then tap Start.');
        return;
      }
      const started = Date.now();
      let min = Infinity;
      let first: number | null = null;
      let latest = 0;
      let count = 0;
      while (alive() && Date.now() - started < CRANK_SAMPLE_MS) {
        const v = await client.batteryVoltage();
        if (!alive()) return;
        if (v == null) {
          await sleep(50);
          continue;
        }
        count++;
        first ??= v;
        latest = v;
        min = Math.min(min, v);
        setLast(v);
        setCrankNow({ v, min, left: Math.max(0, CRANK_WINDOW_S - Math.floor((Date.now() - started) / 1000)) });
      }
      // The page was left part-way: a part-run is not a result.
      if (!alive()) return;
      if (first == null) {
        setMessage('The adapter did not report a voltage.');
        return;
      }
      setCrank({ min, first, last: latest, rate: count / ((Date.now() - started) / 1000) });
      success();
      await saveStep({ crank: { min, first, last: latest } });
    } catch (e) {
      if (alive()) setMessage(failedRead(e));
    } finally {
      if (alive()) {
        setBusy(null);
        setCrankNow(null);
      }
    }
  };

  const readCharge = async (which: 'idle' | 'load') => {
    setBusy(which);
    setMessage(null);
    try {
      const r = await rpm();
      if (r != null && r <= RUNNING_RPM) {
        setMessage('The engine is not running. Start it, let it idle, then read again.');
        return;
      }
      const v = await steadyVolts(client, alive);
      if (!alive()) return;
      if (v == null) setMessage('The adapter did not report a voltage.');
      else if (r == null && chargeTooLow(v)) {
        // No engine speed to confirm the engine is running: shown, not judged or saved.
        setLast(v);
        setMessage(chargeTooLow(v));
      } else {
        (which === 'idle' ? setIdle : setLoad)(v);
        setLast(v);
        success();
        await saveStep(which === 'idle' ? { idle: v } : { load: v });
      }
    } catch (e) {
      if (alive()) setMessage(failedRead(e));
    } finally {
      if (alive()) setBusy(null);
    }
  };

  // Start again: the test just done stays saved on the car as the last test.
  const reset = () => {
    test.current = null;
    setRest(null);
    setCrank(null);
    setIdle(null);
    setLoad(null);
    setLast(null);
    setMessage(null);
  };

  const results: { title: string; v: number; verdict: Verdict }[] = batteryResults({ rest: rest ?? undefined, crank: crank ?? undefined, idle: idle ?? undefined, load: load ?? undefined });
  // With no reading on this visit yet, the last test saved on the car shows with its date.
  const lastRows = results.length ? [] : batteryResults(savedTest);
  // The reading Learn my car or the health check saved, with when it was read.
  const fromSaved = savedResult(saved);
  const savedRow = fromSaved ? { ...fromSaved, title: `${fromSaved.title}, ${when(saved!.at)}` } : null;
  const off = !!busy;

  return (
    <Screen>
      <GlowCard tone="brand" style={{ padding: space.xl }}>
        <Text style={[type.label, { color: t.muted }]}>{crankNow ? 'Cranking' : 'Last reading'}</Text>
        <Text style={[{ fontSize: 56, lineHeight: 62, fontWeight: '700', letterSpacing: -1, color: t.text }, type.number]} accessibilityLabel={shown == null ? 'No reading' : undefined}>
          {shown == null ? '–' : shown.toFixed(2)}
          <Text style={[type.title3, { color: t.muted }]}> V</Text>
        </Text>
        {crankNow ? (
          <Text style={[type.title3, type.number, { color: t.text, marginTop: space.sm }]}>
            {crankNow.left > 0 ? `Start the engine now: ${crankNow.left} s left` : 'Reading…'}
            {`. Lowest ${crankNow.min.toFixed(2)} V`}
          </Text>
        ) : (
          <Text style={[type.sub, { color: t.muted, marginTop: space.sm }]}>
            {last == null && saved ? `From ${saved.from}, ${when(saved.at)}. Reading now…` : 'Measured by the adapter at the OBD port.'}
          </Text>
        )}
      </GlowCard>

      {message ? <Notice tone="info" icon="information-outline" text={message} /> : null}

      <Group
        header="Step 1: Rest voltage"
        help={SECTIONS.batteryRest}
        footer="Engine off, ideally after the car has stood for a few hours. About 12.6 V is full, 12.2 V about half, below 12.0 V flat. These are general lead-acid figures."
      >
        <View style={{ padding: space.lg, gap: space.md }}>
          <Body small>Switch the engine off and leave the ignition on, with lights and fan off.</Body>
          <Button label={rest != null ? 'Read again' : 'Read rest voltage'} icon="car-battery" variant="secondary" busy={busy === 'rest'} disabled={off} onPress={readRest} />
        </View>
      </Group>

      <Group
        header="Step 2: Cranking"
        help={SECTIONS.batteryCrank}
        footer={`Above 9.6 V while cranking is generally fine; below suggests a weak battery or a poor connection. A short dip can fall between readings${crank?.rate ? `: this run took ${crank.rate.toFixed(1)} readings a second` : ''}.`}
      >
        <View style={{ padding: space.lg, gap: space.md }}>
          <Body small>{`Engine off. Tap Start, then start the engine within ${CRANK_WINDOW_S} seconds.`}</Body>
          <Button label="Start" icon="play" busy={busy === 'crank'} disabled={off} onPress={runCrank} />
        </View>
      </Group>

      <Group
        header="Step 3: Charging"
        help={SECTIONS.batteryCharge}
        footer="Typically 13.7 to 14.7 V. Smart charging systems on newer cars can run lower, down to about 12.5 V, so a low reading is not always a fault."
      >
        <View style={{ padding: space.lg, gap: space.md }}>
          <Body small>Engine idling with lights and fan off.</Body>
          <Button label="Read at idle" icon="engine-outline" variant="secondary" busy={busy === 'idle'} disabled={off} onPress={() => readCharge('idle')} />
          <Body small>Now switch on the headlights, heated rear screen and fan.</Body>
          <Button label="Read with loads on" icon="car-light-high" variant="secondary" busy={busy === 'load'} disabled={off} onPress={() => readCharge('load')} />
        </View>
      </Group>

      <Group
        header={lastRows.length && savedTest ? `Last test, ${dateTimeText(savedTest.at)}` : 'Results'}
        footer={`${results.length ? 'Each reading is saved on this phone as it is taken, and the test is listed in History. ' : lastRows.length ? 'Saved on this phone. A new reading starts a new test. ' : ''}The adapter measures at the OBD port, which reads slightly lower than at the battery.`}
      >
        {results.length || lastRows.length || savedRow ? (
          [...results, ...lastRows, ...(savedRow ? [savedRow] : [])].map((r, i) => (
            <ListRow
              key={r.title}
              first={i === 0}
              // The reading leads the line beneath, so the title keeps the row's width.
              title={r.title}
              subtitle={`${fmt(r.v)}. ${r.verdict.text}`}
              right={<Pill text={r.verdict.word} tone={r.verdict.tone} />}
            />
          ))
        ) : (
          <ListRow first title="No readings yet" />
        )}
      </Group>

      {results.length ? <Button label="Start again" icon="restart" variant="ghost" disabled={off} onPress={reset} /> : null}
    </Screen>
  );
}
