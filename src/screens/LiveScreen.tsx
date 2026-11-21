import { alertBuzz } from '../sound';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { allowSleep, stayAwake } from '../keepAwake';
import { shareCsv } from '../logger/store';
import { shareFileName } from '../timeText';
import { CATEGORY_ICON, CATEGORY_ORDER, categoryOf, displaySensor, isPlausible, readKey, sensorId, sensorsForCar, SensorValue, unitOf } from '../obd/sensors';
import { groupValuesText, sensorCount, sensorCountText } from '../vehicle/counts';
import { extrasFor, formatExtra } from '../obd/extras';
import { DEFAULT_WATCH, LivePid, PID_GROUPS } from '../obd/pids';
import { suggestedSensors } from '../obd/sensorSearch';
import { toUserUnits, useSettings } from '../settings';
import { useConnection } from '../state';
import { useGarage } from '../vehicle/garage';
import { ModuleDef } from '../obd/modules';
import { MeasuringCell } from '../obd/tp20';
import { groupLabels, groupName, GROUP_NAMES } from '../data/groupLabels';
import { SECTIONS } from '../help';
import { radius, space, type, useTheme } from '../theme';
void Title;
import { Body, Button, Chip, ConfirmSheet, Field, Group, Icon, IconName, Label, ListRow, NeedsConnection, Notice, ProgressBar, SearchField, Title, tool, TOOLS } from '../ui';
import { AlertLevel, alertLevel, AlertRule, AlertTracker, holdPeak, needsRpm, Peak, setRule } from '../live/alerts';
import { RateMeter, rateText } from '../live/rate';
import { filterPids, loadSet, removeSet, saveSet, ValueSet } from '../live/sets';
import { BOOST_PID } from '../live/boost';
import { TileSheet } from '../live/LiveTiles';

const HISTORY = 60; // samples kept per value for the trend line
const RPM = 0x0c;

interface Series {
  last: number | null;
  min: number;
  max: number;
  points: number[];
  peak?: Peak;
}

// A recording not yet shared is kept while Pin16 is open, so leaving Live
// data does not lose it. One at a time; a new recording replaces it.
type Reading = { t: number; pid: number; v: number };
let keptRecording: { vin: string | null; rows: Reading[] } | null = null;

export function LiveScreen({ active = true }: { active?: boolean }) {
  // Off screen (Fuel trims or Boost opened on top): stop reading, so the page
  // on screen gets the adapter to itself.
  const onScreen = useIsFocused();
  const t = useTheme();
  const conn = useConnection();
  const garageMain = useGarage();
  const [available, setAvailable] = useState<LivePid[] | null>(null);
  const [has70, setHas70] = useState(false);
  const [watch, setWatch] = useState<number[]>([]);
  const [series, setSeries] = useState<Record<number, Series>>({});
  const [paused, setPaused] = useState(false);
  const [picking, setPicking] = useState(false);
  const [rate, setRate] = useState<{ readings: number; updates: number } | null>(null);
  const meter = useRef(new RateMeter());
  const { settings } = useSettings();
  // Recording: every reading with its time, for a CSV.
  const [recording, setRecording] = useState(false);
  const recRef = useRef<{ t: number; pid: number; v: number }[] | null>(null);
  const recStart = useRef(0);
  const [recCount, setRecCount] = useState(0);
  const carVin = conn.vehicle?.vin ?? null;
  const [recorded, setRecorded] = useState<Reading[] | null>(() => (keptRecording && keptRecording.vin === carVin && keptRecording.rows.length ? keptRecording.rows : null));
  // Leaving the page while recording keeps the readings so far.
  const carVinRef = useRef(carVin);
  carVinRef.current = carVin;
  useEffect(
    () => () => {
      if (recRef.current?.length) keptRecording = { vin: carVinRef.current, rows: recRef.current };
    },
    [],
  );
  // Alerts while watching: coolant over 110 °C, and the owner's own limits.
  const [alert, setAlert] = useState<string | null>(null);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const rulesRef = useRef<AlertRule[]>([]);
  rulesRef.current = rules;
  const tracker = useRef(new AlertTracker());
  const [editing, setEditing] = useState<LivePid | null>(null);
  const watchRef = useRef<number[]>([]);
  watchRef.current = watch;

  // Find out which values this car reports, once per connection.
  useEffect(() => {
    const client = conn.client;
    setAvailable(null);
    setSeries({});
    setRules(conn.vehicle?.liveAlerts ?? []);
    tracker.current.reset();
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
    client.supportedPids().then(
      (s) => setHas70(s.has(BOOST_PID)),
      () => setHas70(false),
    );
  }, [conn.client]);

  // Poll the watched values in turn while the tab is open and not paused.
  useEffect(() => {
    const client = conn.client;
    if (!client || !active || !onScreen || paused || !available) return;
    let running = true;
    meter.current.reset();
    setRate(null);
    (async () => {
      let lastRpm: number | null = null;
      while (running) {
        const list = available.filter((p) => watchRef.current.includes(p.pid));
        if (!list.length) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        // An alert that only counts above an engine speed needs engine speed too.
        const rpmPid = available.find((p) => p.pid === RPM);
        const read = rpmPid && needsRpm(rulesRef.current) && !list.includes(rpmPid) ? [...list, rpmPid] : list;
        // Another screen is talking to a module: wait for it, so the trend shows no gaps.
        if (client.moduleBusy) {
          await client.whenIdle();
          continue;
        }
        const got = await client.readLiveMany(read).catch(() => new Map<number, number | null>());
        if (!running) break;
        const busy = client.moduleBusy;
        let any = false;
        let answered = 0;
        const now = Date.now();
        const rpmRead = got.get(RPM);
        if (rpmRead != null) lastRpm = rpmRead;
        const levels = new Map<number, AlertLevel>();
        for (const p of list) {
          const v = got.get(p.pid) ?? null;
          any = any || v != null;
          if (v != null) answered++;
          if (v != null && recRef.current) recRef.current.push({ t: now - recStart.current, pid: p.pid, v });
          if (p.pid === 0x05 && v != null) {
            const shown = toUserUnits(v, '°C', settings);
            setAlert(v > 110 ? `Coolant at ${Math.round(shown.value)} ${shown.unit}. Slow down, stop when it is safe and let the engine cool.` : null);
          }
          const rule = rulesRef.current.find((r) => r.pid === p.pid);
          if (rule && got.has(p.pid)) levels.set(p.pid, alertLevel(rule, v, lastRpm));
        }
        // One buzz as a value crosses into its alert.
        if (tracker.current.update(levels, now).length) alertBuzz('alert');
        // One screen update per pass; values skipped for a busy adapter draw no gap.
        setSeries((old) => {
          const next = { ...old };
          for (const p of read) {
            const v = got.get(p.pid) ?? null;
            if (v == null && (busy || !got.has(p.pid))) continue;
            next[p.pid] = push(old[p.pid], v, now);
          }
          return next;
        });
        if (recRef.current) setRecCount(recRef.current.length);
        if (any) {
          meter.current.add(answered, Date.now());
          if (running) setRate(meter.current.rate());
        }
        if (!any && !busy) await new Promise((r) => setTimeout(r, 1500));
      }
    })();
    return () => {
      running = false;
    };
  }, [conn.client, active, onScreen, paused, available]);

  // The phone stays awake while live values are on screen, as on Dashboard
  // and the other live pages (src/keepAwake.ts).
  const connected = !!conn.client;
  useEffect(() => {
    if (!connected || !active || !onScreen) return undefined;
    stayAwake('live');
    return () => allowSleep('live');
  }, [connected, active, onScreen]);
  const [shareError, setShareError] = useState<string | null>(null);

  const shown = useMemo(() => (available ?? []).filter((p) => watch.includes(p.pid)), [available, watch]);
  const rpmNow = series[RPM]?.last ?? null;
  const saveRules = (next: AlertRule[]) => {
    setRules(next);
    if (conn.vehicle) garageMain.update(conn.vehicle.vin, { liveAlerts: next });
  };
  const petrol = conn.vehicle?.fuel !== 'Diesel';
  const hasTrims = petrol && !!available?.some((p) => p.pid >= 0x06 && p.pid <= 0x09);
  // Boost: from PID 70, or on older VW engines (TP2.0) from group 115.
  const hasBoost = has70 || (conn.vehicle?.group === 'vag' && conn.vehicle?.platform === 'PQ35' && !!conn.client?.supportsModules);

  if (!conn.client) {
    return (
      <NeedsConnection title="Connect your car to see live data" />
    );
  }

  return (
    <View>
      <SensorHub active={active} />
      <Label help={SECTIONS.liveStandard}>Standard readings (every car)</Label>
      <Body muted small style={styles.intro}>
        {available
          ? `Watching ${shown.length} of ${available.length} values${
              rate && settings.developer ? `: ${rateText(rate.readings)} readings a second, ${rateText(rate.updates)} updates a second` : ''
            }. Fewer values update faster.`
          : 'Asking the car which values it reports…'}
      </Body>

      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        <Button label="Choose" icon="playlist-check" variant="secondary" compact onPress={() => setPicking(true)} style={{ flex: 1 }} disabled={!available} />
        <Button label={paused ? 'Resume' : 'Pause'} icon={paused ? 'play' : 'pause'} variant="secondary" compact onPress={() => setPaused((p) => !p)} style={{ flex: 1 }} />
        <Button label="Reset" icon="restart" variant="secondary" compact onPress={() => setSeries({})} style={{ flex: 1 }} />
      </View>

      {alert ? <Notice tone="danger" icon="alert-circle-outline" text={alert} /> : null}
      {available && available.length === 0 ? <Notice text="The car did not report any standard live values." /> : null}

      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        <Button
          label={recording ? 'Stop recording' : 'Record'}
          icon={recording ? 'stop' : 'record-circle-outline'}
          // The page's one filled button: recording is its main action.
          variant={recording ? 'danger' : 'primary'}
          compact
          style={{ flex: 1 }}
          disabled={!available?.length}
          onPress={() => {
            if (recording) {
              setRecorded(recRef.current);
              keptRecording = recRef.current?.length ? { vin: carVin, rows: recRef.current } : null;
              recRef.current = null;
              setRecording(false);
            } else {
              keptRecording = null;
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
            onPress={() => {
              // A real .csv file, shared the way the data logger shares its logs.
              setShareError(null);
              shareCsv(shareFileName('live data', conn.vehicle?.vin), toCsv(recorded, available ?? [], settings)).catch((e) => setShareError(`Could not share: ${e instanceof Error ? e.message : String(e)}`));
            }}
          />
        ) : null}
      </View>
      {recording ? (
        <Body muted small style={{ marginTop: -space.sm, marginBottom: space.lg, marginHorizontal: space.lg }}>
          Recording: {recCount.toLocaleString('en-GB')} reading{recCount === 1 ? '' : 's'} so far.
        </Body>
      ) : null}
      {shareError ? <Notice tone="danger" icon="alert-circle-outline" text={shareError} /> : null}
      {recorded?.length ? <RecordingSummary rows={recorded} pids={available ?? []} /> : null}

      <View style={styles.grid}>
        {shown.map((p) => {
          const s = series[p.pid];
          const rule = rules.find((r) => r.pid === p.pid);
          const level = alertLevel(rule, s?.last, rpmNow);
          const f = (v: number) => toUserUnits(v, p.unit, settings).value.toFixed(p.decimals);
          const valueText = s?.last == null ? 'No reading' : `${f(s.last)} ${toUserUnits(0, p.unit, settings).unit}`;
          return (
            <Pressable
              key={p.pid}
              accessibilityRole="button"
              accessibilityLabel={`${p.label}, ${valueText}${level ? ', past the alert limit' : ''}. Opens alerts and lowest and highest.`}
              onPress={() => setEditing(p)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: level ? t.dangerSoft : pressed ? t.raised : t.surface, borderColor: level ? t.danger : t.border },
                level ? styles.tileAlert : null,
              ]}
            >
              <View style={styles.tileHead}>
                <Text numberOfLines={1} style={[styles.tileLabel, { color: level ? t.danger : t.muted, flex: 1 }]}>
                  {p.label}
                </Text>
                {rule ? <Icon name={level ? 'bell-ring' : 'bell-outline'} size={13} color={level ? t.danger : t.faint} /> : null}
              </View>
              {s && s.last == null ? (
                // Read, but the car sent no value (an O2 sensor's 1.275 V means none).
                <Text style={[styles.tileValue, styles.noReading, { color: t.muted }]}>No reading</Text>
              ) : (
                <Text style={[styles.tileValue, { color: level ? t.danger : t.text }]} accessibilityLabel={s?.last == null ? 'No reading' : undefined}>
                  {s?.last == null ? '–' : f(s.last)}
                  <Text style={[styles.unit, { color: t.muted }]}> {toUserUnits(0, p.unit, settings).unit}</Text>
                </Text>
              )}
              <Spark points={s?.points ?? []} />
              <Text style={[styles.minmax, { color: t.muted }]}>
                {/* Lowest and highest only, on one line; the held peak is in the tile's sheet. */}
                {s && s.points.length ? `min ${f(s.min)} · max ${f(s.max)}` : ' '}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {shown.length ? (
        <Body muted small style={{ marginTop: space.sm, marginHorizontal: space.lg }}>
          Tap a tile for alert limits and its lowest and highest.
        </Body>
      ) : null}

      {hasTrims || hasBoost ? (
        <Group header="Views" help={SECTIONS.liveViews} style={{ marginTop: space.xl, marginBottom: 0 }}>
          {hasTrims ? (
            <ListRow first icon={'gas-station' as IconName} iconColour="green" title="Fuel trims" subtitle="Per bank, with lambda and oxygen sensors" onPress={() => router.push('/fuel-trims')} />
          ) : null}
          {hasBoost ? (
            <ListRow first={!hasTrims} icon={'turbine' as IconName} iconColour="indigo" title="Turbo boost" subtitle="Requested and actual" onPress={() => router.push('/boost')} />
          ) : null}
        </Group>
      ) : null}

      <MakerData />
      <MeasuringBlocks />

      <Picker
        visible={picking}
        available={available ?? []}
        selected={watch}
        sets={conn.vehicle?.liveSets ?? []}
        onSets={(next) => {
          if (conn.vehicle) garageMain.update(conn.vehicle.vin, { liveSets: next });
        }}
        onClose={(next) => {
          setWatch(next);
          setPicking(false);
          if (conn.vehicle) garageMain.update(conn.vehicle.vin, { liveWatch: next });
        }}
      />
      <TileSheet
        pid={editing}
        rule={editing ? rules.find((r) => r.pid === editing.pid) : undefined}
        minMax={editing && series[editing.pid]?.points.length ? series[editing.pid] : null}
        peak={editing ? series[editing.pid]?.peak : null}
        settings={settings}
        onClose={() => setEditing(null)}
        onResetMinMax={() => {
          if (!editing) return;
          setSeries((old) => {
            const next = { ...old };
            delete next[editing.pid];
            return next;
          });
        }}
        onSave={(rule) => {
          if (editing) saveRules(setRule(rules, editing.pid, rule));
          setEditing(null);
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
  // Suggested values that read outside a sane range for their unit (a value
  // from a relative's list that decodes differently on this car): replaced.
  const [odd, setOdd] = useState<string[]>([]);
  // Nothing pinned yet: show the most useful value from each main system, so
  // Live data opens on real numbers (gearbox oil temperature, DPF soot).
  const suggested = useMemo(
    () => (chosen.length ? [] : suggestedSensors(mine.filter((r) => !odd.includes(sensorId(r))), unitOf, 4, conn.vehicle?.fuel)),
    [mine, chosen.length, conn.vehicle?.fuel, odd],
  );
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
        if (!chosen.length) {
          const bad = pinned.filter((r) => got[sensorId(r)] != null && !isPlausible(r, got[sensorId(r)])).map(sensorId);
          if (bad.length) {
            setOdd((old) => [...new Set([...old, ...bad])]);
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    })();
    return () => {
      on = false;
    };
  }, [conn.client, active, pinned]);
  if (!v || !conn.client?.supportsModules || v.group === 'other' || !all.length) return null;
  const imperial = { speed: settings.speed === 'mph', temp: settings.temp === '°F' };
  const counts = CATEGORY_ORDER.map((c) => ({ c, n: mine.filter((r) => categoryOf(r) === c).length })).filter((x) => x.n);

  if (!v.sensorScan) {
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push('/sensors')} style={({ pressed }) => [styles.hub, { backgroundColor: t.surface, opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient colors={[t[TOOLS.sensors.colour] + '33', t[TOOLS.sensors.colour] + '00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.hubIcon, { backgroundColor: t[TOOLS.sensors.colour] }]}>
          <Icon name={TOOLS.sensors.icon} size={22} color="#FFFFFF" />
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
                <Text style={[styles.tileValue, { color: d && !d.check ? t.text : t.muted }]} accessibilityLabel={d ? undefined : 'No reading'}>
                  {d ? d.text : '–'}
                  <Text style={[styles.unit, { color: t.muted }]}> {d?.unit ?? ''}</Text>
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
      <Group header={`${sensorCountText({ ...sensorCount(v), groupValues: 0, groups: 0 })} on this car`} help={SECTIONS.liveHub} footer={chosen.length ? undefined : 'Open a system and tap the star on a value to pin your own here.'}>
        {counts.map(({ c, n }, i) => (
          // Grey squares: a system of the car is a fact about it, not a tool or a state.
          <ListRow key={c} first={i === 0} icon={CATEGORY_ICON[c] as IconName} iconColour="grey" title={c} value={n.toLocaleString('en-GB')} onPress={() => router.push({ pathname: '/sensors', params: { cat: c } })} />
        ))}
        <ListRow {...tool('sensors')} title="Find my car’s sensors" subtitle="Search by name, or search the car again" onPress={() => router.push('/sensors')} />
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
        if (on) alertBuzz('warn');
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
            <Notice tone="ok" icon="check" text="No DPF regeneration running. Pin16 checks every 20 seconds while this page is open." />
          ) : null}
          <Button label={watching ? 'Stop' : 'Watch for DPF regeneration'} icon={watching ? 'stop' : 'bell-alert-outline'} variant="secondary" onPress={() => setWatching((w) => !w)} />
        </View>
      ) : null}
      <View style={[styles.maker, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Body muted small style={{ marginBottom: space.md }}>
          A short list of extra values from owner sources (the odometer in each module, DPF soot, crash counts).
          {sensorsForCar(conn.vehicle).length ? ' Find my car’s sensors, at the top, looks for every sensor; Learn my car runs that search for you.' : ''}
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
                    <Text style={[styles.makerSource, { color: t.muted }]}>{e.source}</Text>
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
const PRESETS: { module: string; group: number; label: string }[] = [1, 115, 114, 3]
  .filter((g) => GROUP_NAMES['01'][g])
  .map((g) => ({ module: 'engine', group: g, label: groupName('01', g) }));

function MeasuringBlocks() {
  const focused = useIsFocused();
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
  // Groups Learn my car found on this car: the modules show without a search.
  const saved = conn.vehicle?.groupsFound;
  useEffect(() => {
    if (modules || !saved || !client) return;
    const list = Object.keys(saved)
      .filter((id) => Object.keys(saved[id]).length)
      .map((id) => client.moduleById(id))
      .filter((d): d is ModuleDef => !!d);
    if (!list.length) return;
    setModules(list);
    setModule(list.find((m) => m.id === 'engine') ?? list[0]);
  }, [saved, client, modules]);
  if (conn.vehicle?.group !== 'vag' || !client?.supportsModules) return null;
  const savedGroups = module && saved?.[module.id] ? Object.entries(saved[module.id]).map(([g, units]) => ({ group: Number(g), units })) : [];

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
  // Another screen opened on top (Boost reads the same engine): stop watching,
  // or that screen would wait behind this one.
  useEffect(() => {
    if (!focused && liveRef.current) liveRef.current = false;
  }, [focused]);
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
      await client.scanMeasuringBlocks(module, (g, c) => setFound((old) => [...old, { group: g, cells: c }].sort((x, y) => x.group - y.group)), setPct);
    } finally {
      setBusy(null);
    }
  };
  const fmt = (c: MeasuringCell) => (typeof c.value === 'number' ? `${Number.isInteger(c.value) ? c.value : c.value.toFixed(1)} ${c.unit === 'raw' ? '(raw)' : c.unit}` : `${c.value} ${c.unit}`).trim();

  return (
    <View style={{ marginTop: space.xl }}>
      <Label help={SECTIONS.liveOlder}>Older VW modules, for experts</Label>
      <View style={[styles.maker, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Body muted small style={{ marginBottom: space.md }}>
          Older VW modules give live values in numbered value groups. Units come from each value itself; values with an unknown
          formula are shown raw. Learn my car finds these modules and their groups for you.
        </Body>
        {!modules ? (
          <>
            <Button label={busy === 'find' ? 'Looking…' : 'Look for older VW modules'} icon="database-search-outline" variant="secondary" busy={busy === 'find'} onPress={find} />
            <Body muted small style={{ marginTop: space.sm }}>Lists the older VW modules on this car, without running Learn my car.</Body>
          </>
        ) : !modules.length ? (
          <Body muted small>No module on this car answered on the older protocol.</Body>
        ) : (
          <>
            <View style={styles.chips}>
              {modules.map((m) => (
                <Chip key={m.id} onCard label={m.name} selected={module?.id === m.id} onPress={() => setModule(m)} />
              ))}
            </View>
            {module?.id === 'engine' ? (
              <View style={styles.chips}>
                {PRESETS.map((p) => (
                  <Chip key={p.group} onCard label={p.label} onPress={() => read(p.group)} />
                ))}
              </View>
            ) : null}
            <View style={styles.stepper}>
              <Button label="−" variant="secondary" onPress={() => read(Math.max(1, group - 1))} disabled={!!busy || live} />
              <Text style={[type.title3, type.number, { color: t.text, minWidth: 90, textAlign: 'center' }]}>Group {group}</Text>
              <Button label="+" variant="secondary" onPress={() => read(Math.min(255, group + 1))} disabled={!!busy || live} />
            </View>
            <View style={{ gap: space.sm }}>
              <Button label={live ? 'Stop' : 'Live'} icon={live ? 'stop' : 'chart-timeline-variant'} variant={live ? 'secondary' : 'primary'} onPress={toggleLive} disabled={!!busy} />
              <Button label="Read every group of this module" icon="magnify" variant="ghost" busy={busy === 'scan'} disabled={!!busy || live} onPress={scanAll} />
              <Body muted small>Reads groups 1 to 255 now and shows what each holds. Learn my car reads them too and keeps the list below.</Body>
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
            {!found.length && savedGroups.length ? (
              <Body muted small style={{ marginTop: space.md }}>
                {groupValuesText({ groupValues: savedGroups.reduce((n, g) => n + g.units.length, 0), groups: savedGroups.length })} in the {module?.name.toLowerCase()}, found by Learn my car. Tap one to read it.
              </Body>
            ) : null}
            {found.length
              ? null
              : savedGroups.map((f) => (
                  <Pressable key={f.group} accessibilityRole="button" onPress={() => read(f.group)} style={[styles.makerRow, { borderColor: t.border }]}>
                    <Text style={[styles.makerLabel, { color: t.text, flex: 1 }]} numberOfLines={2}>{groupName(module?.code, f.group)}</Text>
                    <Text style={[styles.makerSource, { color: t.muted }]}>
                      {f.units.length} value{f.units.length === 1 ? '' : 's'}
                    </Text>
                  </Pressable>
                ))}
            {found.map((f) => (
              <Pressable key={f.group} accessibilityRole="button" onPress={() => read(f.group)} style={[styles.makerRow, { borderColor: t.border }]}>
                <Text style={[styles.makerLabel, { color: t.text, width: 120 }]} numberOfLines={2}>{groupName(module?.code, f.group)}</Text>
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
    <Group header={`Recording, ${secs.toFixed(0)} s, ${rows.length.toLocaleString('en-GB')} reading${rows.length === 1 ? '' : 's'}`} help={SECTIONS.liveRecording} footer="Share CSV opens in Numbers or Excel. The recording is kept until you record again or close Pin16. For recordings saved on the phone with charts, use the Data logger.">
      {used.map((pid, i) => {
        const p = pids.find((x) => x.pid === pid);
        const vals = rows.filter((r) => r.pid === pid).map((r) => r.v);
        if (!p || !vals.length) return null;
        const f = (v: number) => toUserUnits(v, p.unit, settings).value.toFixed(p.decimals);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return (
          <ListRow key={pid} first={i === 0} title={p.label} value={`${f(Math.min(...vals))} to ${f(Math.max(...vals))}, average ${f(avg)} ${toUserUnits(0, p.unit, settings).unit}`} noChevron />
        );
      })}
    </Group>
  );
}

function push(old: Series | undefined, v: number | null, now = Date.now()): Series {
  // Only answers reach here: a null is the car saying it has no value now.
  if (v == null) return { ...(old ?? { min: Infinity, max: -Infinity, points: [] }), last: null };
  const points = [...(old?.points ?? []), v].slice(-HISTORY);
  return { last: v, min: Math.min(old?.min ?? Infinity, v), max: Math.max(old?.max ?? -Infinity, v), points, peak: holdPeak(old?.peak, v, now) };
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
            width: 3,
            marginRight: 1,
            height: `${10 + ((v - lo) / span) * 90}%`,
            backgroundColor: i === points.length - 1 ? t.muted : t.border,
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
  sets,
  onSets,
  onClose,
}: {
  visible: boolean;
  available: LivePid[];
  selected: number[];
  // Named sets saved on this car.
  sets: ValueSet[];
  onSets: (next: ValueSet[]) => void;
  onClose: (next: number[]) => void;
}) {
  const t = useTheme();
  const { settings } = useSettings();
  const [draft, setDraft] = useState<number[]>(selected);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [mySets, setMySets] = useState<ValueSet[]>(sets);
  // The saved set the owner asked to delete; deleted only after the confirm.
  const [removing, setRemoving] = useState<ValueSet | null>(null);
  useEffect(() => {
    if (!visible) return;
    setDraft(selected);
    setQuery('');
    setName('');
    setMySets(sets);
    // Start fresh each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = (pid: number) => setDraft((d) => (d.includes(pid) ? d.filter((x) => x !== pid) : [...d, pid]));
  const ios = Platform.OS === 'ios';
  const matches = filterPids(available, query);
  const changeSets = (next: ValueSet[]) => {
    setMySets(next);
    onSets(next);
  };
  const ids = available.map((p) => p.pid);

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
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: space.md }}>
            <SearchField value={query} onChange={setQuery} placeholder="Search values, for example trim or temp" caps={false} />
          </View>
          <Text style={[styles.sheetNote, { color: t.muted }]}>
            Watching {draft.length} of {available.length}. Fewer values update faster.
          </Text>

          {!query.trim() ? (
            <Group header="Saved sets" help={SECTIONS.liveSets} footer={mySets.length ? 'Tap a set to load it. Values this car does not report are left out.' : undefined}>
              {mySets.map((s, i) => (
                <ListRow
                  key={s.name}
                  first={i === 0}
                  title={s.name}
                  value={`${s.pids.length} value${s.pids.length === 1 ? '' : 's'}`}
                  noChevron
                  onPress={() => setDraft(loadSet(s, ids))}
                  right={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete the set ${s.name}`}
                      hitSlop={10}
                      onPress={() => setRemoving(s)}
                      style={styles.trash}
                    >
                      <Icon name="trash-can-outline" size={18} color={t.danger} />
                    </Pressable>
                  }
                />
              ))}
              <View style={[styles.saveRow, { borderColor: t.border, borderTopWidth: mySets.length ? StyleSheet.hairlineWidth : 0 }]}>
                <Field value={name} onChange={setName} placeholder="Name for these values" returnKey="done" style={{ flex: 1 }} />
                <Button
                  label="Save set"
                  compact
                  variant="secondary"
                  disabled={!name.trim() || !draft.length}
                  onPress={() => {
                    changeSets(saveSet(mySets, name, draft));
                    setName('');
                  }}
                />
              </View>
            </Group>
          ) : null}

          {query.trim() && !matches.length ? <Notice text="No value matches. Try another word, for example speed, fuel or temp." /> : null}
          {PID_GROUPS.map((g) => {
            const items = matches.filter((p) => p.group === g);
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
                      value={toUserUnits(0, p.unit, settings).unit}
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
        <ConfirmSheet
          visible={!!removing}
          title="Delete this set?"
          lines={removing ? [`${removing.name}, ${removing.pids.length} value${removing.pids.length === 1 ? '' : 's'}. This cannot be undone.`] : []}
          confirmLabel="Delete"
          onConfirm={() => {
            const s = removing;
            setRemoving(null);
            if (s) changeSets(removeSet(mySets, s.name));
          }}
          onCancel={() => setRemoving(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hub: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.lg, marginBottom: space.xl, overflow: 'hidden' },
  hubIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  intro: { marginHorizontal: space.lg, marginBottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: radius.lg, padding: space.md },
  tileLabel: { fontSize: 13, fontWeight: '600', marginBottom: space.xs },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tileAlert: { borderWidth: 2, padding: space.md - 2 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  trash: { paddingHorizontal: space.md, minHeight: 44, justifyContent: 'center' },
  tileValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 14, fontWeight: '500' },
  noReading: { fontSize: 17, lineHeight: 31 },
  spark: { height: 28, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: space.sm },
  minmax: { fontSize: 12, marginTop: space.xs, fontVariant: ['tabular-nums'] },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetPage: { flex: 1 },
  sheetWeb: { marginTop: 60, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  sheetBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  barButton: { width: 80, minHeight: 44, justifyContent: 'center' },
  barText: { fontSize: 17, letterSpacing: -0.41 },
  barTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
  sheetNote: { fontSize: 13, lineHeight: 18, marginBottom: space.lg, marginLeft: space.lg },
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
