import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ElmClient } from '../obd/elm';
import { pidInfo } from '../obd/pids';
import { useConnection } from '../state';
import { space, type, useTheme } from '../theme';
import { SECTIONS } from '../help';
import { Body, Button, GlowCard, Group, ListRow, NeedsConnection, Notice, Pill, Screen, success, Tone } from '../ui';

const RPM = pidInfo(0x0c)!;
const RUNNING_RPM = 400;
// The owner has 10 s to start the engine; sampling runs 2 s longer to catch a late start.
const CRANK_WINDOW_S = 10;
const CRANK_SAMPLE_MS = 12_000;

import { chargeVerdict, crankVerdict, restVerdict, Verdict } from '../obd/battery';
export { chargeVerdict, crankVerdict, restVerdict };
export type { Verdict };

interface Crank {
  min: number;
  first: number;
  last: number;
  count: number;
  rate: number;
}

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
  const client = conn.client;
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

  if (!client) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to test the battery" />
      </Screen>
    );
  }

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
      else {
        setRest(v);
        setLast(v);
        success();
      }
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
      if (first == null) {
        setMessage('The adapter did not report a voltage.');
        return;
      }
      setCrank({ min, first, last: latest, count, rate: count / ((Date.now() - started) / 1000) });
      success();
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
      else {
        (which === 'idle' ? setIdle : setLoad)(v);
        setLast(v);
        success();
      }
    } finally {
      if (alive()) setBusy(null);
    }
  };

  const reset = () => {
    setRest(null);
    setCrank(null);
    setIdle(null);
    setLoad(null);
    setLast(null);
    setMessage(null);
  };

  const fmt = (v: number) => `${v.toFixed(2)} V`;
  const results: { title: string; v: number; verdict: Verdict }[] = [];
  if (rest != null) results.push({ title: 'Rest, engine off', v: rest, verdict: restVerdict(rest) });
  if (crank) results.push({ title: 'Lowest while cranking', v: crank.min, verdict: crankVerdict(crank.min, crank.first, crank.last) });
  if (idle != null) results.push({ title: 'Idle, loads off', v: idle, verdict: chargeVerdict(idle) });
  if (load != null) results.push({ title: 'Idle, loads on', v: load, verdict: chargeVerdict(load) });
  const off = !!busy;

  return (
    <Screen>
      <GlowCard tone="brand" style={{ padding: space.xl }}>
        <Text style={[type.label, { color: t.muted }]}>{crankNow ? 'Cranking' : 'Last reading'}</Text>
        <Text style={[{ fontSize: 56, lineHeight: 62, fontWeight: '700', letterSpacing: -1, color: t.text }, type.number]} accessibilityLabel={last == null ? 'No reading' : undefined}>
          {last == null ? '–' : last.toFixed(2)}
          <Text style={[type.title3, { color: t.muted }]}> V</Text>
        </Text>
        {crankNow ? (
          <Text style={[type.title3, type.number, { color: t.text, marginTop: space.sm }]}>
            {crankNow.left > 0 ? `Start the engine now: ${crankNow.left} s left` : 'Reading…'}
            {`. Lowest ${crankNow.min.toFixed(2)} V`}
          </Text>
        ) : (
          <Text style={[type.sub, { color: t.muted, marginTop: space.sm }]}>Measured by the adapter at the OBD port.</Text>
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
        footer={`Above 9.6 V while cranking is generally fine; below suggests a weak battery or a poor connection. A short dip can fall between readings${crank ? `: this run took ${crank.rate.toFixed(1)} readings a second` : ''}.`}
      >
        <View style={{ padding: space.lg, gap: space.md }}>
          <Body small>{`Engine off. Tap Start, then start the engine within ${CRANK_WINDOW_S} s.`}</Body>
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

      <Group header="Results" footer="The adapter measures at the OBD port, which reads slightly lower than at the battery.">
        {results.length ? (
          results.map((r, i) => (
            <ListRow
              key={r.title}
              first={i === 0}
              title={r.title}
              subtitle={r.verdict.text}
              value={fmt(r.v)}
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
