// Boost requested against actual, with the gap between them.
// Leon Cupra and other older VW engines: measuring group 115 over TP2.0.
// Other cars: standard PID 70 where the engine reports it.
import { useIsFocused } from 'expo-router';
import { allowSleep, stayAwake } from '../keepAwake';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BOOST_PID, BOOST_TOLERANCE_MBAR, boostDeviation, BoostSample, boostSummary, kpaText, LEON_BOOST_GROUP, leonBoost, PID70_ACTUAL, PID70_REQUESTED, pushSample } from '../live/boost';
import { LineChart } from '../live/LiveTiles';
import type { ElmClient } from '../obd/elm';
import type { ModuleDef } from '../obd/modules';
import { pidInfo } from '../obd/pids';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { Body, Button, Group, Label, NeedsConnection, ListRow, Notice, Screen } from '../ui';

type Source = 'pid' | 'group' | 'none';

const RPM = pidInfo(0x0c)!;

export default function Boost() {
  // Screen stays on while this page is open (guarded: the web preview may refuse).
  useEffect(() => {
    stayAwake('boost');
    return () => allowSleep('boost');
  }, []);
  const t = useTheme();
  const conn = useConnection();
  const focused = useIsFocused();
  const client = conn.client;
  const [source, setSource] = useState<Source | null>(null);
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<BoostSample[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const keep = useRef(false);
  keep.current = running && focused;

  // Where this car's boost comes from.
  useEffect(() => {
    setSource(null);
    setSamples([]);
    setProblem(null);
    if (!client) return;
    client.supportedPids().then(
      (s) => setSource(s.has(BOOST_PID) ? 'pid' : conn.vehicle?.group === 'vag' && client.supportsModules ? 'group' : 'none'),
      () => setSource(conn.vehicle?.group === 'vag' && client.supportsModules ? 'group' : 'none'),
    );
  }, [client, conn.vehicle?.group]);

  useEffect(() => {
    if (!client || !running || !focused || !source || source === 'none') return;
    let alive = true;
    const add = (requested: number, actual: number, rpm: number | null) => {
      setSamples((old) => pushSample(old, { at: Date.now(), rpm, requested, actual }));
    };
    (async () => {
      try {
        if (source === 'pid') await readPid(client, () => alive && keep.current, add, setProblem);
        else await readGroup(client, () => alive && keep.current, add, setProblem);
      } catch (e) {
        if (alive) setProblem(`${e instanceof Error ? e.message : String(e)} Tap Start to try again.`);
      }
      if (alive) setRunning(false);
    })();
    return () => {
      alive = false;
    };
  }, [client, running, focused, source]);

  if (!client) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to watch turbo boost" />
      </Screen>
    );
  }

  const last = samples[samples.length - 1];
  const dev = last ? boostDeviation(last.requested, last.actual) : null;
  const sum = boostSummary(samples);
  const gapColour = dev?.state === 'ok' ? t.ok : dev ? t.danger : t.muted;
  const kpa = (v: number) => kpaText(v);
  const signed = (v: number) => kpaText(v, true);

  return (
    <Screen>
      {source == null ? <Body muted>Asking the car which values it reports…</Body> : null}
      {source === 'none' ? (
        <Notice text="This car does not report the boost it asks for, so there is nothing to compare. Intake pressure (MAP) on Live data shows the actual boost." />
      ) : null}
      {source && source !== 'none' ? (
        <>
          <Label>Requested and actual</Label>
          <View style={styles.figures}>
            <Figure label="Requested" value={last ? kpa(last.requested) : '–'} colour={t.text} />
            <Figure label="Actual" value={last ? kpa(last.actual) : '–'} colour={t.accentText} />
            <Figure label="Gap" value={dev ? signed(dev.diff) : '–'} colour={gapColour} />
          </View>

          <View style={[styles.chart, { backgroundColor: t.surface }]}>
            <View style={styles.legend}>
              {/* Line swatches as the chart draws them: dashed for requested, solid for actual. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ flexDirection: 'row', gap: 3 }} accessible={false}>
                  <View style={{ width: 5, height: 2, backgroundColor: t.muted }} />
                  <View style={{ width: 5, height: 2, backgroundColor: t.muted }} />
                </View>
                <Text style={[type.caption, { color: t.muted }]}>Requested</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 13, height: 2, backgroundColor: t.accentText }} accessible={false} />
                <Text style={[type.caption, { color: t.accentText }]}>Actual</Text>
              </View>
              {last?.rpm != null ? <Text style={[type.caption, type.number, { color: t.muted, marginLeft: 'auto' }]}>{Math.round(last.rpm)} rpm</Text> : null}
            </View>
            <View>
              <LineChart
                height={160}
                series={[
                  { values: samples.map((s) => s.requested), colour: t.muted, dashed: true },
                  { values: samples.map((s) => s.actual), colour: t.accent },
                ]}
              />
              {!samples.length ? (
                <View style={styles.empty} pointerEvents="none">
                  <Text style={[type.heading, { color: t.muted, textAlign: 'center' }]}>{running ? 'Accelerate to see boost' : 'Tap Start, then accelerate'}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[type.caption, { color: t.muted, marginTop: space.md }]}>Gap (actual minus requested), green band within {kpaText(BOOST_TOLERANCE_MBAR)}</Text>
            <LineChart height={80} band={[-BOOST_TOLERANCE_MBAR, BOOST_TOLERANCE_MBAR]} zero series={[{ values: samples.map((s) => s.actual - s.requested), colour: t.text }]} />
          </View>

          {problem ? <Notice tone="danger" icon="alert-circle-outline" text={problem} /> : null}
          <View style={styles.buttons}>
            <Button label={running ? 'Stop' : 'Start'} icon={running ? 'stop' : 'play'} variant={running ? 'secondary' : 'primary'} onPress={() => setRunning((r) => !r)} style={{ flex: 1 }} />
            <Button label="Reset" icon="restart" variant="secondary" onPress={() => setSamples([])} style={{ flex: 1 }} disabled={!samples.length} />
          </View>

          <Group
            header="This session"
            footer={`Pressures are absolute, in kPa as on Live data: about 100 kPa is no boost at sea level. ${source === 'group' ? `Read from engine group ${LEON_BOOST_GROUP}.` : 'Read from standard PID 70.'}`}
          >
            <ListRow first title="Peak actual" value={sum.peakActual == null ? 'No reading' : kpa(sum.peakActual)} />
            <ListRow title="Largest shortfall" value={samples.length ? signed(sum.worstUnder) : 'No reading'} />
            <ListRow title="Largest overshoot" value={samples.length ? signed(sum.worstOver) : 'No reading'} />
          </Group>
          {source === 'group' ? (
            <Body muted small>
              While this reads, the engine module is busy, so other pages that read the car pause.
            </Body>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Figure({ label, value, colour }: { label: string; value: string; colour: string }) {
  const t = useTheme();
  return (
    <View style={[styles.figure, { backgroundColor: t.surface }]} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[type.small, { color: t.muted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[type.heading, type.number, { color: colour }]}>
        {value}
      </Text>
    </View>
  );
}

// Standard PID 70: requested and actual from the same answer, read twice
// (one value each), plus engine speed.
async function readPid(c: ElmClient, keep: () => boolean, add: (r: number, a: number, rpm: number | null) => void, problem: (s: string | null) => void) {
  let misses = 0;
  while (keep()) {
    if (c.moduleBusy) {
      await c.whenIdle();
      continue;
    }
    const req = await c.readLive(PID70_REQUESTED);
    const act = await c.readLive(PID70_ACTUAL);
    const rpm = await c.readLive(RPM);
    if (req != null && act != null) {
      misses = 0;
      problem(null);
      add(req, act, rpm);
    } else if (++misses >= 5) {
      problem(act != null ? 'The engine reports actual boost but not the boost it asks for.' : 'The engine stopped answering for boost. Check the ignition is on.');
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

// Older VW engines: group 115 over TP2.0, read again and again on one channel.
async function readGroup(c: ElmClient, keep: () => boolean, add: (r: number, a: number, rpm: number | null) => void, problem: (s: string | null) => void) {
  let def: ModuleDef | undefined = c.moduleById('engine');
  let first = def ? await c.readMeasuringBlock(def, LEON_BOOST_GROUP) : null;
  if (!first) {
    // The engine's older-protocol address is not known yet this session.
    const found = await c.findTp20Modules();
    def = found.find((m) => m.id === 'engine');
    first = def ? await c.readMeasuringBlock(def, LEON_BOOST_GROUP) : null;
  }
  if (!def || !first) {
    problem('The engine did not answer group 115 on the older VW protocol. This view works on older VW engines such as the 2007 Leon Cupra.');
    return;
  }
  if (!leonBoost(first)) {
    problem('Group 115 on this engine does not hold boost pressure, so it cannot be compared here.');
    return;
  }
  problem(null);
  await c.watchMeasuringBlock(
    def,
    LEON_BOOST_GROUP,
    (cells) => {
      const b = leonBoost(cells);
      if (b) add(b.requested, b.actual, b.rpm);
    },
    keep,
  );
}

const styles = StyleSheet.create({
  figures: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  figure: { flex: 1, borderRadius: radius.lg, padding: space.md },
  chart: { borderRadius: radius.lg, padding: space.md, marginBottom: space.lg },
  legend: { flexDirection: 'row', gap: space.md, marginBottom: space.sm },
  empty: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  buttons: { flexDirection: 'row', gap: space.sm, marginBottom: space.xl },
});
