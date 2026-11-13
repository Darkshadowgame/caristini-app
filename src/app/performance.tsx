import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { pidInfo } from '../obd/pids';
import { KMH_PER_MPH, speedIn, useSettings } from '../settings';
import { useConnection } from '../state';
import { space, type, useTheme } from '../theme';
import { SECTIONS } from '../help';
import { Button, GlowCard, Group, Icon, ListRow, NeedsConnection, Notice, Screen, success, tap } from '../ui';

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
}

export type Run =
  | { phase: 'waiting' }
  | { phase: 'ready'; last: Sample }
  | { phase: 'running'; start: number; last: Sample; metres: number; firstT: number; count: number }
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
      const r: Running = { phase: 'running', start, last: { t: start, kmh: test.startKmh }, metres: 0, firstT: run.last.t, count: 2 };
      return advance(test, r, s);
    }
    case 'running':
      if (isReady(test, s.kmh)) return { phase: 'ready', last: s };
      if (s.t - run.last.t > MAX_GAP_MS) return { phase: 'aborted', reason: 'Speed readings stopped for more than 2 s. Try again.' };
      if (s.t - run.start > MAX_RUN_MS) return { phase: 'aborted', reason: 'The run took longer than 60 s. Try again.' };
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
  return { ...r, last: s, metres: r.metres + seg };
}

function finish(test: PerfTest, r: Running, s: Sample, end: number, finishKmh?: number): Run {
  const span = (s.t - r.firstT) / 1000;
  return {
    phase: 'done',
    result: {
      testId: test.id,
      seconds: (end - r.start) / 1000,
      finishKmh,
      rate: span > 0 ? (r.count - 1) / span : 0,
      samples: r.count,
      at: s.t,
    },
  };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const SPEED = pidInfo(0x0d)!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Performance() {
  const t = useTheme();
  const conn = useConnection();
  const { settings } = useSettings();
  useKeepAwake();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [kmh, setKmh] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [testId, setTestId] = useState(TESTS[0].id);
  const [run, setRun] = useState<Run | null>(null);
  const [results, setResults] = useState<PerfResult[]>([]);
  const runRef = useRef<Run | null>(null);
  const test = TESTS.find((x) => x.id === testId) ?? TESTS[0];
  const testRef = useRef(test);
  testRef.current = test;

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
            setResults((old) => [next.result, ...old]);
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
  const startWord = test.startKmh > 0 ? `${Math.round(speedIn(test.startKmh, 'mph'))} mph` : '';
  const shown = kmh == null ? '–' : Math.round(speedIn(kmh, settings.speed)).toString();

  let status = 'Choose a test and tap Get ready.';
  if (run?.phase === 'waiting') status = test.startKmh > 0 ? `Slow down below ${startWord} to begin.` : 'Stop the car to begin.';
  else if (run?.phase === 'ready') status = test.startKmh > 0 ? `Ready. The timer starts as you pass ${startWord}.` : 'Ready. The timer starts when the car moves.';
  else if (run?.phase === 'running') {
    const secs = Math.max(0, (run.last.t - run.start) / 1000);
    status = test.targetM ? `Timing: ${secs.toFixed(1)} s, ${Math.round(run.metres)} m` : `Timing: ${secs.toFixed(1)} s`;
  } else if (run?.phase === 'done') status = `${test.label}: ${run.result.seconds.toFixed(2)} s`;
  else if (run?.phase === 'aborted') status = run.reason;

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
            : rate
              ? `${rate.toFixed(1)} speed readings a second`
              : 'Waiting for speed readings…'}
        </Text>
      </GlowCard>

      <Group header="Test" help={SECTIONS.perfTest}>
        {TESTS.map((x, i) => (
          <ListRow
            key={x.id}
            first={i === 0}
            title={x.label}
            noChevron
            selected={x.id === testId}
            disabled={armed}
            right={<Icon name="check" size={18} color={x.id === testId ? t.accentText : 'transparent'} />}
            onPress={() => {
              setTestId(x.id);
              setRun(null);
              runRef.current = null;
            }}
          />
        ))}
      </Group>

      <View style={{ marginBottom: space.xl }}>
        {armed ? (
          <Button label="Cancel" icon="stop" variant="secondary" onPress={cancel} />
        ) : (
          <Button label={run?.phase === 'done' ? 'Ready again' : 'Get ready'} icon="play" onPress={arm} disabled={!supported} />
        )}
      </View>

      <Group
        header="This session"
        help={SECTIONS.perfSession}
        footer="Accuracy is limited by how fast the adapter answers, typically 5 to 10 readings a second, and the car reports speed in whole km/h. The start and finish are estimated between the readings either side, so treat results as a guide."
      >
        {results.length ? (
          results.map((r, i) => {
            const x = TESTS.find((y) => y.id === r.testId);
            const parts = [`${r.rate.toFixed(1)} readings a second`, new Date(r.at).toTimeString().slice(0, 5)];
            if (r.finishKmh != null) parts.unshift(`${Math.round(speedIn(r.finishKmh, settings.speed))} ${settings.speed} at the line`);
            return <ListRow key={`${r.at}-${i}`} first={i === 0} title={x?.label ?? r.testId} subtitle={parts.join(', ')} value={`${r.seconds.toFixed(2)} s`} />;
          })
        ) : (
          <ListRow first title="No runs yet" />
        )}
      </Group>
    </Screen>
  );
}
