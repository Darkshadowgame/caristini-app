import { useStayAwake } from '../keepAwake';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pidInfo } from '../obd/pids';
import { KMH_PER_MPH, speedIn, useSettings } from '../settings';
import { useConnection } from '../state';
import { space, type, useTheme } from '../theme';
import { SECTIONS } from '../help';
import { addRun, clearRuns, CustomRange, loadRanges, loadRuns, saveRanges, SavedRun } from '../monitors/store';
import { Button, ConfirmSheet, Field, GlowCard, Group, Icon, ListRow, NeedsConnection, Notice, Screen, success, tap } from '../ui';
import { dateTimeText } from '../timeText';

// ---------------------------------------------------------------------------
// Timing logic (pure, tested in __tests__/perf.test.ts).
// Speeds are km/h as the car reports them (PID 0D); times are milliseconds.
// ---------------------------------------------------------------------------

export interface Sample {
  t: number;
  kmh: number;
}

export interface PerfTest {
  id: string;
  label: string;
  // The timer starts when speed rises past this (0 for a standing start).
  startKmh: number;
  // The timer stops at this speed, or at this distance.
  targetKmh?: number;
  targetM?: number;
}

export const QUARTER_MILE_M = 402.336;
// Longest run before the test gives up, and the longest gap between readings.
export const MAX_RUN_MS = 60_000;
export const MAX_GAP_MS = 2_000;

export const TESTS: PerfTest[] = [
  { id: '0-60mph', label: '0 to 60 mph', startKmh: 0, targetKmh: 60 * KMH_PER_MPH },
  { id: '30-70mph', label: '30 to 70 mph', startKmh: 30 * KMH_PER_MPH, targetKmh: 70 * KMH_PER_MPH },
  { id: '0-100kmh', label: '0 to 100 km/h', startKmh: 0, targetKmh: 100 },
  { id: 'quarter', label: 'Quarter mile (402 m)', startKmh: 0, targetM: QUARTER_MILE_M },
];

export interface PerfResult {
  testId: string;
  seconds: number;
  // Speed at the finish line (quarter mile).
  finishKmh?: number;
  // Readings per second achieved during the run.
  rate: number;
  samples: number;
  at: number;
  // Time between the two readings either side of the start and of the finish (ms).
  startGapMs: number;
  endGapMs: number;
  // Plus or minus this many seconds (see runUncertainty).
  plusMinus: number;
}

// prev: the last real reading (last can be the interpolated start point).
// startGapMs and startAcc: the readings either side of the start crossing.
export type Run =
  | { phase: 'waiting' }
  | { phase: 'ready'; last: Sample }
  | { phase: 'running'; start: number; last: Sample; prev: Sample; metres: number; firstT: number; count: number; startGapMs: number; startAcc: number | null }
  | { phase: 'done'; result: PerfResult }
  | { phase: 'aborted'; reason: string };

type Running = Extract<Run, { phase: 'running' }>;

// The time at which speed passed `kmh`, by straight-line interpolation
// between the samples either side.
export function crossingTime(a: Sample, b: Sample, kmh: number): number {
  if (b.kmh === a.kmh) return b.t;
  const f = Math.max(0, Math.min(1, (kmh - a.kmh) / (b.kmh - a.kmh)));
  return a.t + f * (b.t - a.t);
}

// Distance in metres between two samples (trapezoid rule).
export function segmentMetres(a: Sample, b: Sample): number {
  return ((a.kmh + b.kmh) / 2 / 3.6) * ((b.t - a.t) / 1000);
}

export function integrateDistance(samples: Sample[]): number {
  let m = 0;
  for (let i = 1; i < samples.length; i++) m += segmentMetres(samples[i - 1], samples[i]);
  return m;
}

// Where in the segment a to b the distance reaches `target`, given the
// distance already covered at a. Speed is taken as linear across the
// segment, which matches the trapezoid rule.
export function distanceCrossing(a: Sample, b: Sample, before: number, target: number): { t: number; kmh: number } {
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0) return { t: b.t, kmh: b.kmh };
  const v1 = a.kmh / 3.6;
  const acc = (b.kmh / 3.6 - v1) / dt;
  const need = target - before;
  let tau: number;
  if (Math.abs(acc) < 1e-9) tau = v1 > 0 ? need / v1 : dt;
  else {
    const disc = v1 * v1 + 2 * acc * need;
    tau = disc <= 0 ? dt : (-v1 + Math.sqrt(disc)) / acc;
  }
  tau = Math.max(0, Math.min(dt, tau));
  return { t: a.t + tau * 1000, kmh: (v1 + acc * tau) * 3.6 };
}

// Speed resolution of the car's report: PID 0D is one byte of whole km/h
// (SAE J1979; Wikipedia OBD-II PIDs, market-research source [53]).
export const SPEED_STEP_KMH = 1;

// Acceleration between two readings in km/h per second (null if not rising).
export function accelKmhS(a: Sample, b: Sample): number | null {
  const dt = (b.t - a.t) / 1000;
  return dt > 0 && b.kmh > a.kmh ? (b.kmh - a.kmh) / dt : null;
}

// How far a timed run can be off, in seconds, from how often the car was read.
// Each crossing is placed between the two readings either side of it, so it
// can be off by up to half the time between them (VCDS ties its tolerance to
// the sample rate the same way: market-research source [15]). The car also
// reports whole km/h, so the moment a speed is passed is unclear by half a
// km/h divided by the acceleration there. Both ends are added. A distance
// finish (quarter mile) has no speed term at the end. A guide, not a bound.
export function runUncertainty(p: { startGapMs: number; endGapMs: number; startAcc: number | null; endAcc: number | null }): number {
  const res = (acc: number | null) => (acc != null && acc > 0 ? SPEED_STEP_KMH / 2 / acc : 0);
  return (p.startGapMs + p.endGapMs) / 2 / 1000 + res(p.startAcc) + res(p.endAcc);
}

// A timer for a range the owner chose. Speeds in km/h; the car reports at
// most 255 km/h (PID 0D is one byte), so higher targets are refused.
export const MAX_TARGET_KMH = 255;
export function customTest(fromKmh: number, toKmh: number, label: string): PerfTest | null {
  if (!Number.isFinite(fromKmh) || !Number.isFinite(toKmh) || fromKmh < 0 || toKmh <= fromKmh || toKmh > MAX_TARGET_KMH) return null;
  return { id: `custom-${Math.round(fromKmh * 10)}-${Math.round(toKmh * 10)}`, label, startKmh: fromKmh, targetKmh: toKmh };
}

// At or below the start speed: standstill for a standing start.
export function isReady(test: PerfTest, kmh: number): boolean {
  return test.startKmh <= 0 ? kmh <= 0 : kmh < test.startKmh;
}

// Feeds one speed sample to an armed test and returns the next state.
export function stepRun(test: PerfTest, run: Run, s: Sample): Run {
  switch (run.phase) {
    case 'waiting':
      return isReady(test, s.kmh) ? { phase: 'ready', last: s } : run;
    case 'ready': {
      if (isReady(test, s.kmh)) return { phase: 'ready', last: s };
      const start = crossingTime(run.last, s, test.startKmh);
      const r: Running = {
        phase: 'running',
        start,
        last: { t: start, kmh: test.startKmh },
        prev: run.last,
        metres: 0,
        firstT: run.last.t,
        count: 2,
        startGapMs: s.t - run.last.t,
        startAcc: accelKmhS(run.last, s),
      };
      return advance(test, r, s);
    }
    case 'running':
      if (isReady(test, s.kmh)) return { phase: 'ready', last: s };
      if (s.t - run.last.t > MAX_GAP_MS) return { phase: 'aborted', reason: 'Speed readings stopped for more than 2 seconds. Try again.' };
      if (s.t - run.start > MAX_RUN_MS) return { phase: 'aborted', reason: 'The run took longer than 60 seconds. Try again.' };
      return advance(test, { ...run, count: run.count + 1 }, s);
    default:
      return run;
  }
}

function advance(test: PerfTest, r: Running, s: Sample): Run {
  const a = r.last;
  if (test.targetKmh != null && s.kmh >= test.targetKmh) return finish(test, r, s, crossingTime(a, s, test.targetKmh));
  const seg = segmentMetres(a, s);
  if (test.targetM != null && r.metres + seg >= test.targetM) {
    const c = distanceCrossing(a, s, r.metres, test.targetM);
    return finish(test, r, s, c.t, c.kmh);
  }
  return { ...r, last: s, prev: s, metres: r.metres + seg };
}

function finish(test: PerfTest, r: Running, s: Sample, end: number, finishKmh?: number): Run {
  const span = (s.t - r.firstT) / 1000;
  const endGapMs = s.t - r.prev.t;
  return {
    phase: 'done',
    result: {
      testId: test.id,
      seconds: (end - r.start) / 1000,
      finishKmh,
      rate: span > 0 ? (r.count - 1) / span : 0,
      samples: r.count,
      at: s.t,
      startGapMs: r.startGapMs,
      endGapMs,
      plusMinus: runUncertainty({ startGapMs: r.startGapMs, endGapMs, startAcc: r.startAcc, endAcc: test.targetKmh != null ? accelKmhS(r.prev, s) : null }),
    },
  };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const SPEED = pidInfo(0x0d)!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rangeLabel(r: CustomRange): string {
  const f = r.unit === 'mph' ? r.fromKmh / KMH_PER_MPH : r.fromKmh;
  const to = r.unit === 'mph' ? r.toKmh / KMH_PER_MPH : r.toKmh;
  return `${Math.round(f)} to ${Math.round(to)} ${r.unit}`;
}

export default function Performance() {
  const t = useTheme();
  const conn = useConnection();
  const { settings } = useSettings();
  useStayAwake('performance');
  const [supported, setSupported] = useState<boolean | null>(null);
  const [kmh, setKmh] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [testId, setTestId] = useState(TESTS[0].id);
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<SavedRun[]>([]);
  const [ranges, setRanges] = useState<CustomRange[]>([]);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  // The speed range the owner asked to delete; deleted only after the confirm.
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const runRef = useRef<Run | null>(null);
  const vin = conn.vehicle?.vin ?? null;

  const custom = ranges.map((r) => customTest(r.fromKmh, r.toKmh, rangeLabel(r))).filter((x): x is PerfTest => !!x);
  const all = [...TESTS, ...custom];
  const test = all.find((x) => x.id === testId) ?? TESTS[0];
  const testRef = useRef(test);
  testRef.current = test;
  const vinRef = useRef(vin);
  vinRef.current = vin;

  useEffect(() => {
    loadRanges().then(setRanges, () => undefined);
  }, []);
  useEffect(() => {
    setHistory([]);
    if (vin) loadRuns(vin).then(setHistory, () => undefined);
  }, [vin]);

  useEffect(() => {
    const client = conn.client;
    setSupported(null);
    if (!client) return;
    client.supportedPids().then(
      (s) => setSupported(s.has(0x0d)),
      () => setSupported(false),
    );
  }, [conn.client]);

  // Read speed as fast as the adapter answers while the screen is open.
  useEffect(() => {
    const client = conn.client;
    if (!client || !supported) return;
    let running = true;
    const times: number[] = [];
    (async () => {
      while (running) {
        const before = Date.now();
        const v = await client.readLive(SPEED);
        const after = Date.now();
        if (!running) break;
        if (v == null) {
          setKmh(null);
          await sleep(500);
          continue;
        }
        // The car sampled somewhere between request and answer.
        const s: Sample = { t: (before + after) / 2, kmh: v };
        times.push(s.t);
        if (times.length > 20) times.shift();
        if (times.length >= 2) setRate((times.length - 1) / ((times[times.length - 1] - times[0]) / 1000));
        setKmh(v);
        const r = runRef.current;
        if (r && (r.phase === 'waiting' || r.phase === 'ready' || r.phase === 'running')) {
          const next = stepRun(testRef.current, r, s);
          runRef.current = next;
          setRun(next);
          if (next.phase === 'running' && r.phase === 'ready') tap();
          if (next.phase === 'done') {
            const res = next.result;
            const saved: SavedRun = {
              vin: vinRef.current ?? '',
              testId: res.testId,
              label: testRef.current.label,
              seconds: res.seconds,
              plusMinus: res.plusMinus,
              rate: res.rate,
              samples: res.samples,
              finishKmh: res.finishKmh,
              at: Date.now(),
            };
            setHistory((old) => [saved, ...old]);
            if (vinRef.current) void addRun(saved);
            success();
          }
        }
      }
    })();
    return () => {
      running = false;
    };
  }, [conn.client, supported]);

  if (!conn.client) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to time a run" />
      </Screen>
    );
  }

  const armed = run != null && (run.phase === 'waiting' || run.phase === 'ready' || run.phase === 'running');
  const arm = () => {
    const next: Run = { phase: 'waiting' };
    runRef.current = next;
    setRun(next);
  };
  const cancel = () => {
    runRef.current = null;
    setRun(null);
  };
  const pick = (id: string) => {
    setTestId(id);
    setRun(null);
    runRef.current = null;
  };
  const addRange = async () => {
    const unit = settings.speed;
    const f = Number(fromText.replace(',', '.'));
    const to = Number(toText.replace(',', '.'));
    const k = unit === 'mph' ? KMH_PER_MPH : 1;
    const made = customTest(f * k, to * k, '');
    if (!fromText.trim() || !toText.trim() || !made) {
      const max = Math.floor(unit === 'mph' ? MAX_TARGET_KMH / KMH_PER_MPH : MAX_TARGET_KMH);
      setRangeError(`Enter a start speed and a higher target, up to ${max} ${unit}.`);
      return;
    }
    if (custom.some((c) => c.id === made.id)) {
      setRangeError('You already have this range.');
      return;
    }
    const r: CustomRange = { id: made.id, fromKmh: f * k, toKmh: to * k, unit };
    const next = [...ranges, r];
    setRanges(next);
    await saveRanges(next);
    setFromText('');
    setToText('');
    setRangeError(null);
    pick(made.id);
  };
  const removeRange = async (id: string) => {
    const next = ranges.filter((r) => r.id !== id);
    setRanges(next);
    await saveRanges(next);
    if (testId === id) pick(TESTS[0].id);
  };

  const speedWord = (k: number) => `${Math.round(speedIn(k, settings.speed))} ${settings.speed}`;
  const startWord = test.startKmh > 0 ? speedWord(test.startKmh) : '';
  const shown = kmh == null ? '–' : Math.round(speedIn(kmh, settings.speed)).toString();
  // Typical uncertainty at the current reading rate: half a gap at each end.
  const typical = rate ? 1 / rate : null;

  let status = 'Choose a test and tap Get ready.';
  if (run?.phase === 'waiting') status = test.startKmh > 0 ? `Slow down below ${startWord} to begin.` : 'Stop the car to begin.';
  else if (run?.phase === 'ready') status = test.startKmh > 0 ? `Ready. The timer starts as you pass ${startWord}.` : 'Ready. The timer starts when the car moves.';
  else if (run?.phase === 'running') {
    const secs = Math.max(0, (run.last.t - run.start) / 1000);
    status = test.targetM ? `Timing: ${secs.toFixed(1)} s, ${Math.round(run.metres)} m` : `Timing: ${secs.toFixed(1)} s`;
  } else if (run?.phase === 'done') status = `${test.label}: ${run.result.seconds.toFixed(2)} s ± ${run.result.plusMinus.toFixed(2)} s`;
  else if (run?.phase === 'aborted') status = run.reason;

  // Best time per test on this car.
  const best = new Map<string, SavedRun>();
  for (const h of history) {
    const b = best.get(h.testId);
    if (!b || h.seconds < b.seconds) best.set(h.testId, h);
  }
  const listed = showAll ? history : history.slice(0, 10);


  return (
    <Screen>
      <Notice
        tone="info"
        icon="alert-outline"
        text="Only use these timers on a closed road or track, never on public roads. Keep your eyes on the road, not the phone."
      />

      <GlowCard tone={run?.phase === 'done' ? 'ok' : 'brand'} style={{ padding: space.xl }}>
        <Text style={[type.label, { color: t.muted }]}>Speed</Text>
        <Text
          accessibilityLabel={kmh == null ? 'Speed: no reading' : `Speed ${shown} ${settings.speed}`}
          style={[{ fontSize: 56, lineHeight: 62, fontWeight: '700', letterSpacing: -1, color: t.text }, type.number]}
        >
          {shown}
          <Text style={[type.title3, { color: t.muted }]}> {settings.speed}</Text>
        </Text>
        <Text style={[type.title3, type.number, { color: t.text, marginTop: space.sm }]}>{status}</Text>
        <Text style={[type.small, type.number, { color: t.muted, marginTop: space.xs }]}>
          {supported === false
            ? 'This car does not report speed over OBD, so the timers cannot run.'
            : rate && typical
              ? `${rate.toFixed(1)} speed readings a second, so about ± ${typical.toFixed(2)} s per run`
              : 'Waiting for speed readings…'}
        </Text>
      </GlowCard>

      <Group header="Test" help={SECTIONS.perfTest}>
        {all.map((x, i) => (
          <ListRow
            key={x.id}
            first={i === 0}
            title={x.label}
            subtitle={best.get(x.id) ? `Best on this car ${best.get(x.id)!.seconds.toFixed(2)} s` : undefined}
            noChevron
            selected={x.id === testId}
            disabled={armed}
            onPress={() => pick(x.id)}
          />
        ))}
      </Group>

      <View style={{ marginBottom: space.xl }}>
        {armed ? (
          <Button label="Stop" icon="stop" variant="secondary" onPress={cancel} />
        ) : (
          <Button label={run?.phase === 'done' ? 'Ready again' : 'Get ready'} icon="play" onPress={arm} disabled={!supported} />
        )}
      </View>

      <Group header="Your speed ranges" help={SECTIONS.monPerfRanges} footer={rangeError ?? `Speeds in ${settings.speed}. Change units in Settings.`}>
        {ranges.map((r, i) => (
          <ListRow
            key={r.id}
            first={i === 0}
            title={rangeLabel(r)}
            right={
              <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${rangeLabel(r)}`} hitSlop={10} disabled={armed} onPress={() => setRemoving({ id: r.id, label: rangeLabel(r) })}>
                <Icon name="trash-can-outline" size={18} color={armed ? t.faint : t.danger} />
              </Pressable>
            }
          />
        ))}
        <View style={[styles.addRow, ranges.length ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border } : null]}>
          <Field value={fromText} onChange={setFromText} placeholder="From" keyboard="decimal-pad" number accessibilityLabel={`Start speed in ${settings.speed}`} style={styles.input} />
          <Text style={[type.body, { color: t.muted }]}>to</Text>
          <Field value={toText} onChange={setToText} placeholder="To" keyboard="decimal-pad" number accessibilityLabel={`Target speed in ${settings.speed}`} style={styles.input} />
          <Button label="Add" icon="plus" compact variant="secondary" onPress={addRange} disabled={armed} />
        </View>
      </Group>

      <Group
        header={vin ? 'Runs on this car' : 'This session'}
        help={SECTIONS.perfSession}
        footer="Each time shows plus or minus how far it could be off, from the gap between speed readings at the start and finish and the car’s whole-km/h speed. A faster adapter gives a smaller figure."
      >
        {listed.length ? (
          listed.map((r, i) => {
            const parts = [`± ${r.plusMinus != null ? r.plusMinus.toFixed(2) : '?'} s`, `${r.rate.toFixed(1)} readings a second`];
            if (r.finishKmh != null) parts.push(`${speedWord(r.finishKmh)} at the line`);
            parts.push(dateTimeText(r.at));
            return <ListRow key={`${r.at}-${i}`} first={i === 0} title={r.label} subtitle={parts.join(', ')} value={`${r.seconds.toFixed(2)} s`} />;
          })
        ) : (
          <ListRow first title="No runs yet" />
        )}
        {history.length > 10 ? <ListRow title={showAll ? 'Show fewer' : `Show all ${history.length}`} onPress={() => setShowAll((v) => !v)} /> : null}
        {history.length > 0 && vin ?<ListRow title="Clear runs for this car" onPress={() => setConfirmClear(true)} /> : null}
      </Group>

      <ConfirmSheet
        visible={!!removing}
        title="Delete this speed range?"
        lines={removing ? [`${removing.label}. Runs already saved for it stay.`] : []}
        confirmLabel="Delete"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const r = removing;
          setRemoving(null);
          if (r) void removeRange(r.id);
        }}
      />

      <ConfirmSheet
        visible={confirmClear}
        title="Clear runs?"
        lines={['Removes every saved run for this car from this phone. Your speed ranges stay.']}
        confirmLabel="Clear runs"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          setConfirmClear(false);
          if (vin) await clearRuns(vin);
          setHistory([]);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  input: { flex: 1, minWidth: 0 },
});

