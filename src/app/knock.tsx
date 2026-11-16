// Knock and timing monitor. Logic and sources: src/monitors/knock.ts.
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { groupLabels } from '../data/groupLabels';
import { SECTIONS } from '../help';
import { addKnockSample, assessKnock, cellDegrees, KNOCK_GROUP, KNOCK_GUIDE_DEG, KNOCK_GUIDE_SOURCE, KNOCK_RELATED, KnockLevel, KnockSession, knockSupport, newKnockSession, retardsFrom, sessionVerdict } from '../monitors/knock';
import { pidInfo } from '../obd/pids';
import { MeasuringCell } from '../obd/tp20';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { Button, GlowCard, Group, ListRow, NeedsConnection, Notice, Screen } from '../ui';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Knock() {
  const conn = useConnection();
  const client = conn.client;
  if (!client) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to watch knock" />
      </Screen>
    );
  }
  const support = knockSupport(conn.vehicle, conn.info?.diesel ?? false);
  return (
    <Screen>
      {support.kind === 'diesel' ? (
        <>
          <Notice icon="information-outline" text="This is a diesel. Knock retard is a petrol engine value, so there is nothing to show here." />
          <View style={{ marginTop: space.lg }}>
            <Button label="Open the DPF monitor" icon="filter-outline" variant="secondary" onPress={() => router.push('/dpf')} />
          </View>
        </>
      ) : support.kind === 'groups' && client.supportsModules ? (
        <GroupsMonitor />
      ) : (
        <TimingOnly why={support.kind === 'groups' ? 'Knock values for this car are not known.' : support.why} />
      )}
    </Screen>
  );
}

// Older VW petrol engines: measuring groups 020, 003 and 115 over TP2.0.
function GroupsMonitor() {
  const t = useTheme();
  const conn = useConnection();
  const client = conn.client!;
  useKeepAwake();
  const [phase, setPhase] = useState<'idle' | 'finding' | 'live' | 'no-engine'>('idle');
  const [related, setRelated] = useState(true);
  const [cells, setCells] = useState<Record<number, MeasuringCell[] | null>>({});
  const [session, setSession] = useState<KnockSession>(newKnockSession());
  const [rate, setRate] = useState<number | null>(null);
  const liveRef = useRef(false);
  const levelRef = useRef<KnockLevel>('none');
  useEffect(
    () => () => {
      liveRef.current = false;
    },
    [],
  );

  const engine = client.moduleById('engine');
  const stop = () => {
    liveRef.current = false;
  };
  const start = async () => {
    if (!engine) return;
    if (client.routeOf(engine) !== 'tp20') {
      setPhase('finding');
      await client.findTp20Modules().catch(() => []);
      if (client.routeOf(engine) !== 'tp20') {
        setPhase('no-engine');
        return;
      }
    }
    setSession(newKnockSession());
    setCells({});
    setRate(null);
    levelRef.current = 'none';
    liveRef.current = true;
    setPhase('live');
    const times: number[] = [];
    const ok = await client
      .watchMeasuringGroups(
        engine,
        related ? [KNOCK_GROUP, ...KNOCK_RELATED] : [KNOCK_GROUP],
        (g, c) => {
          if (!liveRef.current) return;
          setCells((old) => ({ ...old, [g]: c }));
          if (g !== KNOCK_GROUP) return;
          const now = Date.now();
          times.push(now);
          if (times.length > 10) times.shift();
          if (times.length >= 2) setRate((times.length - 1) / ((times[times.length - 1] - times[0]) / 1000));
          const r = retardsFrom(c);
          const level = assessKnock(r).level;
          if (level === 'warn' && levelRef.current !== 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          levelRef.current = level;
          setSession((s) => addKnockSample(s, r));
        },
        () => liveRef.current,
      )
      .catch(() => false);
    liveRef.current = false;
    setPhase(ok ? 'idle' : 'no-engine');
  };

  const g20 = cells[KNOCK_GROUP];
  const retards = retardsFrom(g20 ?? null);
  const now = assessKnock(retards);
  const verdict = sessionVerdict(session);
  const notDegrees = !!g20?.length && retards.every((r) => r == null);
  const scale = Math.max(KNOCK_GUIDE_DEG * 2, ...session.peak, ...retards.map((r) => r ?? 0));
  const colour = (l: KnockLevel) => (l === 'warn' ? t.danger : l === 'watch' ? t.accentText : l === 'ok' ? t.ok : t.muted);
  const fmt = (c: MeasuringCell) => {
    const d = cellDegrees(c);
    if (d != null) return `${d.toFixed(1)}°`;
    if (typeof c.value === 'number') return `${Number.isInteger(c.value) ? c.value : c.value.toFixed(1)} ${c.unit === 'raw' ? '(raw)' : c.unit}`.trim();
    return `${c.value} ${c.unit}`.trim();
  };

  return (
    <>
      <GlowCard tone={verdict.level === 'warn' ? 'fault' : verdict.level === 'ok' ? 'ok' : 'brand'} style={{ padding: space.xl, marginBottom: space.xl }}>
        <Text style={[type.label, { color: t.muted }]}>Knock retard now</Text>
        <Text style={[styles.big, type.number, { color: colour(now.level) }]}>
          {now.worst == null ? '–' : `${now.worst.toFixed(1)}°`}
          {now.worstCylinder != null && now.worst ? <Text style={[type.title3, { color: t.muted }]}> cylinder {now.worstCylinder}</Text> : null}
        </Text>
        <Text style={[type.sub, { color: t.text, marginTop: space.sm }]}>{phase === 'live' || session.samples ? verdict.text : 'Tap Start, then drive under load on a closed road.'}</Text>
        <Text style={[type.small, type.number, { color: t.muted, marginTop: space.xs }]}>
          {rate ? `${rate.toFixed(1)} readings a second of group 020` : phase === 'live' ? 'Waiting for the engine…' : `Guide: ${KNOCK_GUIDE_DEG}°. ${KNOCK_GUIDE_SOURCE}.`}
        </Text>
      </GlowCard>

      {phase === 'no-engine' ? (
        <Notice tone="danger" icon="alert-circle-outline" text="The engine did not answer on the older VW protocol, so knock values cannot be read on this car. Switch the ignition on and try again." />
      ) : null}
      {g20 === null ? <Notice icon="information-outline" text="The engine did not answer value group 020, so knock retard is not available on this engine." /> : null}
      {notDegrees ?<Notice icon="information-outline" text="Group 020 on this engine does not give degrees, so Caristini cannot judge knock. The raw values are shown below." /> : null}

      <View style={{ marginVertical: space.lg, gap: space.sm }}>
        {phase === 'live' ? (
          <Button label="Stop" icon="stop" variant="secondary" onPress={stop} />
        ) : (
          <Button label={phase === 'finding' ? 'Finding the engine…' : session.samples ? 'Start again' : 'Start'} icon="play" busy={phase === 'finding'} onPress={start} />
        )}
        <Button
          label={related ? 'Read knock only (faster)' : 'Also read rpm, timing and boost'}
          icon="tune-variant"
          variant="ghost"
          disabled={phase === 'live' || phase === 'finding'}
          onPress={() => setRelated((v) => !v)}
        />
      </View>

      <Group header="Per cylinder" help={SECTIONS.monKnockCylinders} footer={`Bars run to ${scale.toFixed(0)}°. The line marks the ${KNOCK_GUIDE_DEG}° guide.`}>
        {[0, 1, 2, 3].map((i) => {
          const r = retards[i];
          const peak = session.peak[i];
          const level: KnockLevel = r == null ? 'none' : now.over.includes(i + 1) || now.outlier === i + 1 ? 'warn' : r > 0 ? 'watch' : 'ok';
          return (
            <View key={i} style={[styles.cyl, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
              <View style={styles.cylHead}>
                <Text style={[type.body, { color: t.text, flex: 1 }]}>{groupLabels('01', KNOCK_GROUP)?.[i] ?? `Cylinder ${i + 1}`}</Text>
                <Text style={[type.body, type.number, { color: colour(level) }]}>{r == null ? '–' : `${r.toFixed(1)}°`}</Text>
                <Text style={[type.small, type.number, { color: t.muted, width: 92, textAlign: 'right' }]}>peak {peak.toFixed(1)}°</Text>
              </View>
              <View style={[styles.track, { backgroundColor: t.sunken }]}>
                <View style={[styles.fill, { width: `${Math.min(100, ((r ?? 0) / scale) * 100)}%`, backgroundColor: colour(level) }]} />
                <View style={[styles.peak, { left: `${Math.min(100, (peak / scale) * 100)}%`, backgroundColor: t.muted }]} />
                <View style={[styles.guide, { left: `${(KNOCK_GUIDE_DEG / scale) * 100}%`, backgroundColor: t.danger }]} />
              </View>
            </View>
          );
        })}
      </Group>

      {related
        ? KNOCK_RELATED.map((g) =>
            cells[g]?.length ? (
              <Group key={g} header={`Group ${String(g).padStart(3, '0')}`}>
                {cells[g]!.map((c, i) => (
                  <ListRow key={i} first={i === 0} title={groupLabels('01', g)?.[i] ?? `Field ${i + 1}`} value={fmt(c)} />
                ))}
              </Group>
            ) : null,
          )
        : null}
    </>
  );
}

// Cars without known knock values: the standard timing advance, if reported.
function TimingOnly({ why }: { why: string }) {
  const t = useTheme();
  const conn = useConnection();
  const client = conn.client!;
  const [supported, setSupported] = useState<boolean | null>(null);
  const [live, setLive] = useState(false);
  const [now, setNow] = useState<{ adv: number | null; rpm: number | null }>({ adv: null, rpm: null });
  const [range, setRange] = useState<{ min: number; max: number } | null>(null);
  const liveRef = useRef(false);
  const genRef = useRef(0);
  useEffect(() => {
    client.supportedPids().then(
      (s) => setSupported(s.has(0x0e)),
      () => setSupported(false),
    );
    return () => {
      liveRef.current = false;
    };
  }, [client]);

  const toggle = async () => {
    if (liveRef.current) {
      liveRef.current = false;
      genRef.current++;
      return;
    }
    const adv = pidInfo(0x0e)!;
    const rpm = pidInfo(0x0c)!;
    liveRef.current = true;
    const run = ++genRef.current;
    const mine = () => liveRef.current && genRef.current === run;
    setLive(true);
    setRange(null);
    while (mine()) {
      if (client.moduleBusy) {
        await client.whenIdle();
        continue;
      }
      const got = await client.readLiveMany([adv, rpm]).catch(() => new Map<number, number | null>());
      if (!mine()) break;
      const a = got.get(0x0e) ?? null;
      setNow({ adv: a, rpm: got.get(0x0c) ?? null });
      if (a != null) setRange((r) => (r ? { min: Math.min(r.min, a), max: Math.max(r.max, a) } : { min: a, max: a }));
      if (a == null) await sleep(1000);
    }
    setLive(false);
  };

  return (
    <>
      <Notice icon="information-outline" text={why} />
      {supported === false ? (
        <Body text="This car does not report the standard timing advance either." />
      ) : supported ? (
        <>
          <Group header="Standard values" footer="Timing advance is the spark timing the engine computer uses now. It does not say which cylinder, if any, pulled timing for knock." style={{ marginTop: space.lg }}>
            <ListRow first title="Timing advance" value={now.adv == null ? '–' : `${now.adv.toFixed(1)}°`} />
            <ListRow title="Engine speed" value={now.rpm == null ? '–' : `${Math.round(now.rpm)} rpm`} />
            <ListRow title="Lowest and highest" value={range ? `${range.min.toFixed(1)}° to ${range.max.toFixed(1)}°` : '–'} />
          </Group>
          <Button label={live ? 'Stop' : 'Start'} icon={live ? 'stop' : 'play'} variant={live ? 'secondary' : 'primary'} onPress={toggle} />
        </>
      ) : null}
      <Text style={[type.small, { color: t.muted, marginTop: space.lg }]}>Only values with a known source for this car are shown.</Text>
    </>
  );
}

function Body({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={[type.sub, { color: t.muted, marginTop: space.lg }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  big: { fontSize: 48, lineHeight: 56, fontWeight: '700', letterSpacing: -1 },
  cyl: { paddingHorizontal: space.lg, paddingVertical: space.md },
  cylHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  track: { height: 8, borderRadius: radius.sm, marginTop: space.sm, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.sm },
  peak: { position: 'absolute', top: 0, width: 2, height: 8 },
  guide: { position: 'absolute', top: 0, width: 2, height: 8, opacity: 0.7 },
});
