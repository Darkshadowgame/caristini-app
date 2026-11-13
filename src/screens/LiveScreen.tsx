import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_COLOUR, CATEGORY_ICON, CATEGORY_ORDER, categoryOf, displaySensor, readKey, sensorId, sensorsForCar, SensorValue, unitOf } from '../obd/sensors';
import { extrasFor, formatExtra } from '../obd/extras';
import { DEFAULT_WATCH, LivePid, PID_GROUPS } from '../obd/pids';
import { suggestedSensors } from '../obd/sensorSearch';
import { toUserUnits, useSettings } from '../settings';
import { useConnection } from '../state';
import { useGarage } from '../vehicle/garage';
import { ModuleDef } from '../obd/modules';
import { MeasuringCell } from '../obd/tp20';
import { groupLabels } from '../data/groupLabels';
import { SECTIONS } from '../help';
import { radius, space, type, useTheme } from '../theme';
void Title;
import { Body, Button, Group, Icon, IconName, Label, ListRow, NeedsConnection, Notice, ProgressBar, Title } from '../ui';

const HISTORY = 60; // samples kept per value for the trend line

interface Series {
  last: number | null;
  min: number;
  max: number;
  points: number[];
}

export function LiveScreen({ active = true }: { active?: boolean }) {
  const t = useTheme();
  const conn = useConnection();
  const garageMain = useGarage();
  const [available, setAvailable] = useState<LivePid[] | null>(null);
  const [watch, setWatch] = useState<number[]>([]);
  const [series, setSeries] = useState<Record<number, Series>>({});
  const [paused, setPaused] = useState(false);
  const [picking, setPicking] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const { settings } = useSettings();
  // Recording: every reading with its time, for a CSV.
  const [recording, setRecording] = useState(false);
  const recRef = useRef<{ t: number; pid: number; v: number }[] | null>(null);
  const recStart = useRef(0);
  const [recCount, setRecCount] = useState(0);
  const [recorded, setRecorded] = useState<{ t: number; pid: number; v: number }[] | null>(null);
  // Alerts while watching: coolant over 110 °C.
  const [alert, setAlert] = useState<string | null>(null);
  const watchRef = useRef<number[]>([]);
  watchRef.current = watch;

  // Find out which values this car reports, once per connection.
  useEffect(() => {
    const client = conn.client;
    setAvailable(null);
    setSeries({});
    if (!client) return;
    client.livePidsForCar().then(
      (list) => {
        setAvailable(list);
        const ids = list.map((p) => p.pid);
        // The values chosen last time for this car, else the defaults.
        const own = (conn.vehicle?.liveWatch ?? []).filter((p) => ids.includes(p));
        const start = DEFAULT_WATCH.filter((p) => ids.includes(p));
        setWatch(own.length ? own : start.length ? start : ids.slice(0, 8));
      },
      () => setAvailable([]),
    );
  }, [conn.client]);

  // Poll the watched values in turn while the tab is open and not paused.
  useEffect(() => {
    const client = conn.client;
    if (!client || !active || paused || !available) return;
    let running = true;
    (async () => {
      while (running) {
        const list = available.filter((p) => watchRef.current.includes(p.pid));
        if (!list.length) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        // Another screen is talking to a module: wait for it, rather than draw gaps.
        if (client.moduleBusy) {
          await client.whenIdle();
          continue;
        }
        const started = Date.now();
        const got = await client.readLiveMany(list).catch(() => new Map<number, number | null>());
        if (!running) break;
        const busy = client.moduleBusy;
        let any = false;
        const now = Date.now();
        for (const p of list) {
          const v = got.get(p.pid) ?? null;
          any = any || v != null;
          if (v != null && recRef.current) recRef.current.push({ t: now - recStart.current, pid: p.pid, v });
          if (p.pid === 0x05 && v != null) {
            const shown = toUserUnits(v, '°C', settings);
            setAlert(v > 110 ? `Coolant at ${Math.round(shown.value)} ${shown.unit}. Stop when safe and let the engine cool.` : null);
          }
        }
        // One screen update per pass; values skipped for a busy adapter draw no gap.
        setSeries((old) => {
          const next = { ...old };
          for (const p of list) {
            const v = got.get(p.pid) ?? null;
            if (v == null && (busy || !got.has(p.pid))) continue;
            next[p.pid] = push(old[p.pid], v);
          }
          return next;
        });
        if (recRef.current) setRecCount(recRef.current.length);
        if (running && any) setRate((Date.now() - started) / 1000);
        if (!any && !busy) await new Promise((r) => setTimeout(r, 1500));
      }
    })();
    return () => {
      running = false;
    };
  }, [conn.client, active, paused, available]);

  const shown = useMemo(() => (available ?? []).filter((p) => watch.includes(p.pid)), [available, watch]);

  if (!conn.client) {
    return (
      <NeedsConnection what="live data" />
    );
  }

  return (
    <View>
      <SensorHub active={active} />
      <Label help={SECTIONS.liveStandard}>Standard readings (every car)</Label>
      <Body muted style={{ marginBottom: space.md }}>
        {available
          ? `Watching ${shown.length} of ${available.length} values${rate ? `, about ${Math.max(0.5, Math.round(rate * 2) / 2)} s per update` : ''}. Fewer values update faster.`
          : 'Asking the car which values it reports…'}
      </Body>

      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        <Button label="Choose values" icon="playlist-check" variant="secondary" compact onPress={() => setPicking(true)} style={{ flex: 1 }} disabled={!available} />
        <Button label={paused ? 'Resume' : 'Pause'} icon={paused ? 'play' : 'pause'} variant="secondary" compact onPress={() => setPaused((p) => !p)} style={{ flex: 1 }} />
        <Button label="Reset" icon="restart" variant="secondary" compact onPress={() => setSeries({})} style={{ flex: 1 }} />
      </View>

      {alert ? <Notice tone="danger" icon="alert-circle-outline" text={alert} /> : null}
      {available && available.length === 0 ? <Notice text="The car did not report any standard live values." /> : null}

      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        <Button
          label={recording ? `Stop (${recCount})` : 'Record'}
          icon={recording ? 'stop' : 'record-circle-outline'}
          variant={recording ? 'danger' : 'secondary'}
          compact
          style={{ flex: 1 }}
          disabled={!available?.length}
          onPress={() => {
            if (recording) {
              setRecorded(recRef.current);
              recRef.current = null;
              setRecording(false);
            } else {
              recRef.current = [];
              recStart.current = Date.now();
              setRecCount(0);
              setRecorded(null);
              setRecording(true);
            }
          }}
        />
        {recorded?.length ? (
          <Button
            label="Share CSV"
            icon="share-variant"
            variant="secondary"
            compact
            style={{ flex: 1 }}
            onPress={() => Share.share({ title: 'Caristini live data', message: toCsv(recorded, available ?? [], settings) })}
          />
        ) : null}
      </View>
      {recorded?.length ? <RecordingSummary rows={recorded} pids={available ?? []} /> : null}

      <View style={styles.grid}>
        {shown.map((p) => {
          const s = series[p.pid];
          return (
            <View key={p.pid} style={[styles.tile, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text numberOfLines={1} style={[styles.tileLabel, { color: t.muted }]}>{p.label}</Text>
              <Text style={[styles.tileValue, { color: t.text }]} accessibilityLabel={s?.last == null ? 'No reading' : undefined}>
                {s?.last == null ? '–' : toUserUnits(s.last, p.unit, settings).value.toFixed(p.decimals)}
                <Text style={[styles.unit, { color: t.muted }]}> {toUserUnits(0, p.unit, settings).unit}</Text>
              </Text>
              <Spark points={s?.points ?? []} />
              <Text style={[styles.minmax, { color: t.muted }]}>
                {s && s.points.length
                  ? `min ${toUserUnits(s.min, p.unit, settings).value.toFixed(p.decimals)} · max ${toUserUnits(s.max, p.unit, settings).value.toFixed(p.decimals)}`
                  : ' '}
              </Text>
            </View>
          );
        })}
      </View>

      <MakerData />
      <MeasuringBlocks />

      <Picker
        visible={picking}
        available={available ?? []}
        selected={watch}
        onClose={(next) => {
          setWatch(next);
          setPicking(false);
          if (conn.vehicle) garageMain.update(conn.vehicle.vin, { liveWatch: next });
        }}
      />
    </View>
  );
}

// Top of Live data: the car's own sensors by system (as Carista groups them),
// pinned values live, and the sensor search for cars not searched yet.
function SensorHub({ active: shown }: { active: boolean }) {
  const t = useTheme();
  // Stop polling while another screen is on top (it may need the adapter).
  const focused = useIsFocused();
  const active = shown && focused;
  const conn = useConnection();
  const { settings } = useSettings();
  const v = conn.vehicle;
  const all = useMemo(() => sensorsForCar(v), [v]);
  const found = useMemo(() => new Set(v?.sensorsFound ?? []), [v?.sensorsFound]);
  const mine = useMemo(() => all.filter((r) => found.has(readKey(r))), [all, found]);
  const chosen = useMemo(() => mine.filter((r) => (v?.pinnedSensors ?? []).includes(sensorId(r))).slice(0, 8), [mine, v?.pinnedSensors]);
  // Nothing pinned yet: show the most useful value from each main system, so
  // Live data opens on real numbers (gearbox oil temperature, DPF soot).
  const suggested = useMemo(() => (chosen.length ? [] : suggestedSensors(mine, unitOf, 4, conn.vehicle?.fuel)), [mine, chosen.length, conn.vehicle?.fuel]);
  const pinned = chosen.length ? chosen : suggested;
  const [values, setValues] = useState<Record<string, SensorValue>>({});
  useEffect(() => {
    const c = conn.client;
    if (!c || !active || !pinned.length) return;
    let on = true;
    (async () => {
      while (on) {
        const got = await c.readSensors(pinned, () => !on).catch(() => ({}) as Record<string, SensorValue>);
        if (!on) break;
        setValues((old) => ({ ...old, ...got }));
        await new Promise((r) => setTimeout(r, 800));
      }
    })();
    return () => {
      on = false;
    };
  }, [conn.client, active, pinned]);
  if (!v || !conn.client?.supportsModules || (v.group === 'other' && !v.aiSensors?.length)) return null;
  const imperial = { speed: settings.speed === 'mph', temp: settings.temp === '°F' };
  const counts = CATEGORY_ORDER.map((c) => ({ c, n: mine.filter((r) => categoryOf(r) === c).length })).filter((x) => x.n);

  if (!v.sensorScan) {
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push('/sensors')} style={({ pressed }) => [styles.hub, { backgroundColor: t.surface, opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient colors={[t.teal + '33', t.teal + '00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.hubIcon, { backgroundColor: t.teal }]}>
          <Icon name={'radar' as IconName} size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.heading, { color: t.text }]}>Find my car’s sensors</Text>
          <Text style={[type.small, { color: t.muted, marginTop: 2 }]}>Gearbox oil temperature, DPF soot, oil level, crash counts and up to {all.length.toLocaleString('en-GB')} more. Takes a few minutes, once.</Text>
        </View>
        <Icon name="chevron-right" size={13} color={t.faint} />
      </Pressable>
    );
  }

  return (
    <View style={{ marginBottom: space.lg }}>
      {pinned.length ? <Label>{chosen.length ? 'Pinned' : 'Suggested for this car'}</Label> : null}
      {pinned.length ? (
        <View style={[styles.grid, { marginBottom: space.md }]}>
          {pinned.map((r) => {
            const val = values[sensorId(r)];
            const d = val != null ? displaySensor(r, val, imperial) : null;
            return (
              <View key={sensorId(r)} style={[styles.tile, { backgroundColor: t.surface, borderColor: t.accent + '55' }]}>
                <Text numberOfLines={2} style={[styles.tileLabel, { color: t.muted }]}>
                  {r.n}
                </Text>
                <Text style={[styles.tileValue, { color: d && !d.check ? t.text : t.faint }]} accessibilityLabel={d ? undefined : 'No reading'}>
                  {d ? d.text : '–'}
                  <Text style={[styles.unit, { color: t.muted }]}> {d?.unit ?? ''}</Text>
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
      <Group header={`${mine.length} sensors on this car`} help={SECTIONS.liveHub} footer={chosen.length ? undefined : 'Open a system and tap the star on a value to pin your own here.'}>
        {counts.map(({ c, n }, i) => (
          <ListRow key={c} first={i === 0} icon={CATEGORY_ICON[c] as IconName} iconColour={CATEGORY_COLOUR[c]} title={c} value={String(n)} onPress={() => router.push({ pathname: '/sensors', params: { cat: c } })} />
        ))}
        <ListRow icon="magnify" iconColour="grey" title="Search all sensors" onPress={() => router.push('/sensors')} />
      </Group>
    </View>
  );
}

// Maker-specific values (odometer per module, DPF, crash counters), read once.
function MakerData() {
  const t = useTheme();
  const conn = useConnection();
  const { settings } = useSettings();
  const garage = useGarage();
  const [readError, setReadError] = useState<string | null>(null);
  const group = conn.vehicle?.group ?? 'other';
  const list = extrasFor(group);
  const [values, setValues] = useState<Record<string, number> | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  // DPF regeneration watch: checks every 20 s while this screen is open.
  const regen = list.find((e) => e.id.endsWith('-regen'));
  const [watching, setWatching] = useState(false);
  const [regenOn, setRegenOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!watching || !regen || !conn.client) return;
    let alive = true;
    let was: boolean | null = null;
    const tick = async () => {
      const got = await conn.client!.readExtras([regen]).catch(() => ({}) as Record<string, number>);
      if (!alive) return;
      const on = got[regen.id] != null ? got[regen.id] > 0 : null;
      if (on !== was && on != null) {
        if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
        was = on;
      }
      setRegenOn(on);
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [watching, regen, conn.client]);
  if (!list.length || !conn.client?.supportsModules) return null;

  const read = async () => {
    setProgress(0);
    setReadError(null);
    try {
      const got = await conn.client!.readExtras(list, (d, n) => setProgress(d / n));
      setValues(got);
      const odo = list.find((e) => e.category === 'Distance' && got[e.id] != null);
      if (odo && conn.vehicle) await garage.update(conn.vehicle.vin, { odometerKm: got[odo.id], odometerAt: Date.now() });
    } catch (e) {
      setReadError(`${e instanceof Error ? e.message : String(e)} Tap Read maker data to try again.`);
    } finally {
      setProgress(null);
    }
  };
  const found = values ? list.filter((e) => values[e.id] != null) : [];
  const categories = [...new Set(found.map((e) => e.category))];

  return (
    <View style={{ marginTop: space.xl }}>
      <Label help={SECTIONS.liveMaker}>Maker data</Label>
      {readError ? <Notice tone="danger" icon="alert-circle-outline" text={readError} /> : null}
      {regen ? (
        <View style={{ marginBottom: space.md }}>
          {watching && regenOn ? (
            <Notice tone="danger" icon="alert-circle-outline" text="The DPF is regenerating. Keep driving at a steady speed and do not switch off until it finishes." />
          ) : watching && regenOn === false ? (
            <Notice tone="ok" icon="check" text="No DPF regeneration running. Caristini checks every 20 seconds while this screen is open." />
          ) : null}
          <Button label={watching ? 'Stop watching for regeneration' : 'Watch for DPF regeneration'} icon="bell-alert-outline" variant="secondary" onPress={() => setWatching((w) => !w)} />
        </View>
      ) : null}
      <View style={[styles.maker, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Body muted small style={{ marginBottom: space.md }}>
          From owner sources, not the maker. Only values your car answers are shown.
        </Body>
        {progress != null ? (
          <ProgressBar value={progress} label="Reading maker data…" />
        ) : (
          <Button label={values ? 'Read again' : 'Read maker data'} icon="database-search-outline" variant="secondary" onPress={read} />
        )}
        {values && !found.length ? (
          <Body muted small style={{ marginTop: space.md }}>
            Your car did not answer any of the {list.length} known values.
          </Body>
        ) : null}
        {categories.map((c) => (
          <View key={c} style={{ marginTop: space.lg }}>
            <Text style={[styles.makerHead, { color: t.text }]}>{c}</Text>
            {found
              .filter((e) => e.category === c)
              .map((e) => (
                <View key={e.id} style={[styles.makerRow, { borderColor: t.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.makerLabel, { color: t.text }]}>{e.label}</Text>
                    <Text style={[styles.makerSource, { color: t.faint }]}>{e.source}</Text>
                  </View>
                  <Text style={[styles.makerValue, { color: t.text }]}>{formatExtra(e, values![e.id], settings)}</Text>
                </View>
              ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// Older VW modules (KWP2000 over TP2.0): measuring blocks by group number.
// Known groups come from replica/leon-sources.md 4.3 (2.0 TFSI engine).
const PRESETS: { module: string; group: number; label: string }[] = [
  { module: 'engine', group: 1, label: 'Engine basics (group 1)' },
  { module: 'engine', group: 115, label: 'Boost (group 115)' },
  { module: 'engine', group: 114, label: 'Boost control (group 114)' },
  { module: 'engine', group: 3, label: 'Air mass and timing (group 3)' },
];

function MeasuringBlocks() {
  const t = useTheme();
  const conn = useConnection();
  const client = conn.client;
  const [modules, setModules] = useState<ModuleDef[] | null>(null);
  const [module, setModule] = useState<ModuleDef | null>(null);
  const [group, setGroup] = useState(1);
  const [cells, setCells] = useState<MeasuringCell[] | null>(null);
  const [busy, setBusy] = useState<'find' | 'read' | 'scan' | null>(null);
  const [live, setLive] = useState(false);
  const [found, setFound] = useState<{ group: number; cells: MeasuringCell[] }[]>([]);
  const [pct, setPct] = useState(0);
  const liveRef = React.useRef(false);
  useEffect(
    () => () => {
      liveRef.current = false;
    },
    [],
  );
  if (conn.vehicle?.group !== 'vag' || !client?.supportsModules) return null;

  const find = async () => {
    setBusy('find');
    try {
      const list = await client.findTp20Modules();
      setModules(list);
      setModule(list.find((m) => m.id === 'engine') ?? list[0] ?? null);
    } finally {
      setBusy(null);
    }
  };
  const read = async (g = group, m = module) => {
    if (!m) return;
    setGroup(g);
    setBusy('read');
    try {
      setCells(await client.readMeasuringBlock(m, g));
    } finally {
      setBusy(null);
    }
  };
  const toggleLive = async () => {
    if (!module) return;
    if (liveRef.current) {
      liveRef.current = false;
      setLive(false);
      return;
    }
    liveRef.current = true;
    setLive(true);
    await client.watchMeasuringBlock(module, group, setCells, () => liveRef.current);
    liveRef.current = false;
    setLive(false);
  };
  const scanAll = async () => {
    if (!module) return;
    setBusy('scan');
    setFound([]);
    try {
      await client.scanMeasuringBlocks(module, (g, c) => setFound((old) => [...old, { group: g, cells: c }]), setPct);
    } finally {
      setBusy(null);
    }
  };
  const fmt = (c: MeasuringCell) => (typeof c.value === 'number' ? `${Number.isInteger(c.value) ? c.value : c.value.toFixed(1)} ${c.unit === 'raw' ? '(raw)' : c.unit}` : `${c.value} ${c.unit}`).trim();

  return (
    <View style={{ marginTop: space.xl }}>
      <Label>For experts</Label>
      <Label help={SECTIONS.liveOlder}>Older VW modules</Label>
      <View style={[styles.maker, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Body muted small style={{ marginBottom: space.md }}>
          Older VW modules give live values in numbered groups. Units come from each value itself; values with an unknown
          formula are shown raw.
        </Body>
        {!modules ? (
          <Button label={busy === 'find' ? 'Looking…' : 'Find older modules'} icon="database-search-outline" variant="secondary" busy={busy === 'find'} onPress={find} />
        ) : !modules.length ? (
          <Body muted small>No module on this car answered on the older protocol.</Body>
        ) : (
          <>
            <View style={styles.chips}>
              {modules.map((m) => (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  onPress={() => setModule(m)}
                  style={[styles.chip, { backgroundColor: module?.id === m.id ? t.accentSoft : t.sunken }]}
                >
                  <Text style={[type.small, { color: module?.id === m.id ? t.accentText : t.text }]}>{m.name}</Text>
                </Pressable>
              ))}
            </View>
            {module?.id === 'engine' ? (
              <View style={styles.chips}>
                {PRESETS.map((p) => (
                  <Pressable key={p.group} accessibilityRole="button" onPress={() => read(p.group)} style={[styles.chip, { backgroundColor: t.sunken }]}>
                    <Text style={[type.small, { color: t.text }]}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.stepper}>
              <Button label="−" variant="secondary" onPress={() => read(Math.max(1, group - 1))} disabled={!!busy || live} />
              <Text style={[type.title3, type.number, { color: t.text, minWidth: 90, textAlign: 'center' }]}>Group {group}</Text>
              <Button label="+" variant="secondary" onPress={() => read(Math.min(255, group + 1))} disabled={!!busy || live} />
            </View>
            <View style={{ gap: space.sm }}>
              <Button label={live ? 'Stop live' : 'Live'} icon="chart-timeline-variant" onPress={toggleLive} disabled={!!busy} />
              <Button label="Find values in every group" icon="magnify" variant="ghost" busy={busy === 'scan'} disabled={!!busy || live} onPress={scanAll} />
            </View>
            {cells ? (
              cells.length ? (
                cells.map((c, i) => (
                  <View key={i} style={[styles.makerRow, { borderColor: t.border }]}>
                    <Text style={[styles.makerLabel, { color: t.text, flex: 1 }]}>{groupLabels(module?.code, group)?.[i] ?? `Field ${i + 1}`}</Text>
                    <Text style={[styles.makerValue, { color: t.text }]}>{fmt(c)}</Text>
                  </View>
                ))
              ) : (
                <Body muted small style={{ marginTop: space.md }}>This group is empty on this module.</Body>
              )
            ) : null}
            {busy === 'scan' ? <ProgressBar value={pct} label="Reading groups 1 to 255" /> : null}
            {found.map((f) => (
              <Pressable key={f.group} accessibilityRole="button" onPress={() => read(f.group)} style={[styles.makerRow, { borderColor: t.border }]}>
                <Text style={[styles.makerLabel, { color: t.text, width: 80 }]}>Group {f.group}</Text>
                {groupLabels(module?.code, f.group) ? <Text style={[styles.makerSource, { color: t.accentText }]}>{groupLabels(module?.code, f.group)!.filter(Boolean).slice(0, 2).join(', ')}</Text> : null}
                <Text style={[styles.makerSource, { color: t.muted, flex: 1 }]} numberOfLines={2}>
                  {f.cells.map(fmt).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

// One row per reading time, one column per value, in the owner's units.
function toCsv(rows: { t: number; pid: number; v: number }[], pids: LivePid[], s: Parameters<typeof toUserUnits>[2]): string {
  const used = [...new Set(rows.map((r) => r.pid))];
  const label = (pid: number) => {
    const p = pids.find((x) => x.pid === pid);
    return p ? `${p.label} (${toUserUnits(0, p.unit, s).unit})` : `PID ${pid}`;
  };
  const lines = [['Time (s)', ...used.map(label)].join(',')];
  const last: Record<number, string> = {};
  for (const r of rows) {
    const p = pids.find((x) => x.pid === r.pid);
    last[r.pid] = p ? toUserUnits(r.v, p.unit, s).value.toFixed(p.decimals) : String(r.v);
    lines.push([(r.t / 1000).toFixed(2), ...used.map((u) => last[u] ?? '')].join(','));
  }
  return lines.join('\n');
}

function RecordingSummary({ rows, pids }: { rows: { t: number; pid: number; v: number }[]; pids: LivePid[] }) {
  const { settings } = useSettings();
  const used = [...new Set(rows.map((r) => r.pid))];
  const secs = (rows[rows.length - 1]?.t ?? 0) / 1000;
  return (
    <Group header={`Recording, ${secs.toFixed(0)} s, ${rows.length} readings`} help={SECTIONS.liveRecording} footer="Share CSV opens in Numbers or Excel.">
      {used.map((pid, i) => {
        const p = pids.find((x) => x.pid === pid);
        const vals = rows.filter((r) => r.pid === pid).map((r) => r.v);
        if (!p || !vals.length) return null;
        const f = (v: number) => toUserUnits(v, p.unit, settings).value.toFixed(p.decimals);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return (
          <ListRow key={pid} first={i === 0} title={p.label} value={`${f(Math.min(...vals))} to ${f(Math.max(...vals))}, avg ${f(avg)} ${toUserUnits(0, p.unit, settings).unit}`} noChevron />
        );
      })}
    </Group>
  );
}

function push(old: Series | undefined, v: number | null): Series {
  if (v == null) return old ?? { last: null, min: Infinity, max: -Infinity, points: [] };
  const points = [...(old?.points ?? []), v].slice(-HISTORY);
  return { last: v, min: Math.min(old?.min ?? Infinity, v), max: Math.max(old?.max ?? -Infinity, v), points };
}

// Trend of the last samples, drawn as thin bars so no chart library is needed.
function Spark({ points }: { points: number[] }) {
  const t = useTheme();
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = hi - lo || 1;
  return (
    <View style={styles.spark} accessible={false}>
      {points.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            marginLeft: 1,
            height: `${10 + ((v - lo) / span) * 90}%`,
            backgroundColor: i === points.length - 1 ? t.accent : t.border,
            borderRadius: 1,
          }}
        />
      ))}
    </View>
  );
}

function Picker({
  visible,
  available,
  selected,
  onClose,
}: {
  visible: boolean;
  available: LivePid[];
  selected: number[];
  onClose: (next: number[]) => void;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState<number[]>(selected);
  useEffect(() => {
    if (visible) setDraft(selected);
  }, [visible, selected]);

  const toggle = (pid: number) => setDraft((d) => (d.includes(pid) ? d.filter((x) => x !== pid) : [...d, pid]));
  const ios = Platform.OS === 'ios';

  // A native page sheet on iPhone: Cancel and Done in the bar, inset grouped
  // rows with a trailing checkmark in the tint.
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={ios ? 'pageSheet' : undefined}
      transparent={!ios}
      onRequestClose={() => onClose(selected)}
    >
      <View style={[styles.sheetPage, { backgroundColor: t.bg }, !ios && styles.sheetWeb]}>
        <View style={[styles.sheetBar, { borderColor: t.border }]}>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => onClose(selected)} style={styles.barButton}>
            <Text style={[styles.barText, { color: t.accentText }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.barTitle, { color: t.text }]}>Choose values</Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => onClose(draft)} style={[styles.barButton, { alignItems: 'flex-end' }]}>
            <Text style={[styles.barText, { color: t.accentText, fontWeight: '600' }]}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
          <Text style={[styles.sheetNote, { color: t.muted }]}>
            Watching {draft.length} of {available.length}. Fewer values update faster.
          </Text>
          {PID_GROUPS.map((g) => {
            const items = available.filter((p) => p.group === g);
            if (!items.length) return null;
            return (
              <Group key={g} header={g}>
                {items.map((p, i) => {
                  const on = draft.includes(p.pid);
                  return (
                    <ListRow
                      key={p.pid}
                      first={i === 0}
                      title={p.label}
                      value={p.unit}
                      right={<Icon name="check" size={18} color={on ? t.accentText : 'transparent'} />}
                      onPress={() => toggle(p.pid)}
                      noChevron
                      selected={on}
                    />
                  );
                })}
              </Group>
            );
          })}
          <Button label="Clear selection" variant="ghost" onPress={() => setDraft([])} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hub: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.lg, marginBottom: space.xl, overflow: 'hidden' },
  hubIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: { borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: radius.lg, padding: space.md },
  tileLabel: { fontSize: 13, fontWeight: '600', marginBottom: space.xs },
  tileValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 14, fontWeight: '500' },
  spark: { height: 28, flexDirection: 'row', alignItems: 'flex-end', marginTop: space.sm },
  minmax: { fontSize: 12, marginTop: space.xs, fontVariant: ['tabular-nums'] },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetPage: { flex: 1 },
  sheetWeb: { marginTop: 60, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  sheetBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  barButton: { width: 80, minHeight: 44, justifyContent: 'center' },
  barText: { fontSize: 17, letterSpacing: -0.41 },
  barTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
  sheetNote: { fontSize: 13, marginBottom: space.lg, marginLeft: space.lg },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  maker: { borderRadius: radius.lg, padding: space.lg },
  makerHead: { fontSize: 15, fontWeight: '700', marginBottom: space.xs },
  makerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  makerLabel: { fontSize: 15 },
  makerSource: { fontSize: 12, marginTop: 2 },
  makerValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'right' },
});
