import { alertBuzz } from '../sound';
import { allowSleep, stayAwake } from '../keepAwake';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import { SECTIONS } from '../help';
import { addMinMax, AlertLevel, alertLevel, AlertRule, AlertTracker, holdPeak, MinMax, needsRpm, Peak, setRule } from '../live/alerts';
import { addPage, DashPage, fraction, MAX_PAGES, MAX_TILES, pagesForCar, rangeFor, removePage, resizePage, SHIFT_MAX_RPM, SHIFT_MIN_RPM, shiftLabel, shiftLightOn, shiftRpmFrom, TILE_STYLES, TileStyle, updatePage } from '../live/dashboards';
import { Bar, Dial, LineChart, NumberField, ShiftLight, TileSheet } from '../live/LiveTiles';
import { RateMeter, rateText } from '../live/rate';
import { DEFAULT_WATCH, LivePid, PID_GROUPS, pidInfo } from '../obd/pids';
import { Settings, tempIn, toUserUnits, useSettings } from '../settings';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { Button, Chips, ConfirmSheet, Field, Group, HelpButton, Icon, IconName, ListRow, NeedsConnection, Notice, Screen, SearchField, Segmented } from '../ui';
import { filterPids } from '../live/sets';
import { useGarage } from '../vehicle/garage';

const RPM = 0x0c;
const COOLANT = 0x05;
const VOLTS_EVERY_MS = 10_000;
const HISTORY = 60;

// Alert thresholds.
export const COOLANT_MAX_C = 110;
export const VOLTS_MIN_RUNNING = 11.8;
export const VOLTS_MIN_OFF = 12.0;
export const RUNNING_RPM = 400;

export interface DashAlert {
  key: 'coolant' | 'volts';
  text: string;
}

export function dashAlerts(coolantC: number | null, rpm: number | null, volts: number | null, temp: Settings['temp']): DashAlert[] {
  const out: DashAlert[] = [];
  if (coolantC != null && coolantC > COOLANT_MAX_C) {
    out.push({ key: 'coolant', text: `Coolant at ${Math.round(tempIn(coolantC, temp))} ${temp}. Slow down, stop when it is safe and let the engine cool.` });
  }
  if (volts != null) {
    const running = rpm != null && rpm > RUNNING_RPM;
    if (running && volts < VOLTS_MIN_RUNNING) out.push({ key: 'volts', text: `Voltage ${volts.toFixed(1)} V with the engine running. The car may not be charging the battery.` });
    else if (!running && volts < VOLTS_MIN_OFF) out.push({ key: 'volts', text: `Voltage ${volts.toFixed(1)} V with the engine off. The battery is low.` });
  }
  return out;
}

// Shown in the gauge picker: which values a gauge takes, and where the others are.
export const GAUGE_VALUES_NOTE = 'Gauges take standard values. Maker values and older VW value groups are in Live data and the Data logger.';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Stats {
  mm: MinMax;
  peak: Peak;
}

export default function Dashboard() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const { settings } = useSettings();
  // Screen stays on while this page is open (guarded: the web preview may refuse).
  useEffect(() => {
    stayAwake('dashboard');
    return () => allowSleep('dashboard');
  }, []);
  const [available, setAvailable] = useState<LivePid[] | null>(null);
  const [pages, setPages] = useState<DashPage[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [values, setValues] = useState<Record<number, number | null>>({});
  const [hist, setHist] = useState<Record<number, number[]>>({});
  const [stats, setStats] = useState<Record<number, Stats>>({});
  const [volts, setVolts] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const meter = useRef(new RateMeter());
  const [hud, setHud] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [tileSheet, setTileSheet] = useState<LivePid | null>(null);
  const [editing, setEditing] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [shiftRpm, setShiftRpm] = useState(0);
  const [width, setWidth] = useState(0);
  const pager = useRef<ScrollViewInstance>(null);
  const tracker = useRef(new AlertTracker());
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const pageRef = useRef(pageIdx);
  pageRef.current = pageIdx;
  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const shiftRef = useRef(shiftRpm);
  shiftRef.current = shiftRpm;
  const vin = conn.vehicle?.vin;

  // Which values this car reports, and this car's pages, limits and shift light.
  useEffect(() => {
    const client = conn.client;
    setAvailable(null);
    setValues({});
    setHist({});
    setStats({});
    setVolts(null);
    setRules(conn.vehicle?.liveAlerts ?? []);
    setShiftRpm(conn.vehicle?.shiftRpm ?? 0);
    tracker.current.reset();
    if (!client) return;
    client.livePidsForCar().then(
      (list) => {
        setAvailable(list);
        const ids = list.map((p) => p.pid);
        setPages(pagesForCar(conn.vehicle?.dashPages, ids, DEFAULT_WATCH));
        setPageIdx(0);
      },
      () => setAvailable([]),
    );
  }, [conn.client]);

  const savePages = (next: DashPage[]) => {
    setPages(next);
    if (vin) garage.update(vin, { dashPages: next });
  };

  // Read the values of the page on screen as fast as the adapter answers,
  // several per request where the car allows. Every 10 s also read the
  // adapter voltage, and engine speed and coolant if they are not on the
  // page, for the alerts. Engine speed is read every pass while the shift
  // light or an engine speed alert needs it.
  useEffect(() => {
    const client = conn.client;
    if (!client || !available) return;
    const byPid = new Map(available.map((p) => [p.pid, p]));
    let running = true;
    let lastVolts = 0;
    let lastRpm: number | null = null;
    meter.current.reset();
    (async () => {
      while (running) {
        const page = pagesRef.current[pageRef.current] ?? pagesRef.current[0];
        const ids = [...new Set(page?.pids ?? [])].filter((p) => byPid.has(p));
        if ((shiftRef.current > 0 || needsRpm(rulesRef.current)) && byPid.has(RPM) && !ids.includes(RPM)) ids.push(RPM);
        if (client.moduleBusy) {
          await client.whenIdle();
          continue;
        }
        const got = ids.length ? await client.readLiveMany(ids.map((p) => byPid.get(p)!)).catch(() => new Map<number, number | null>()) : new Map<number, number | null>();
        if (!running) break;
        const now = Date.now();
        const answered = [...got.values()].filter((v) => v != null).length;
        const rpmRead = got.get(RPM);
        if (rpmRead != null) lastRpm = rpmRead;
        if (got.size) {
          setValues((old) => ({ ...old, ...Object.fromEntries(got) }));
          setHist((old) => {
            const next = { ...old };
            for (const [pid, v] of got) if (v != null) next[pid] = [...(old[pid] ?? []), v].slice(-HISTORY);
            return next;
          });
          setStats((old) => {
            const next = { ...old };
            for (const [pid, v] of got) if (v != null) next[pid] = { mm: addMinMax(old[pid]?.mm, v), peak: holdPeak(old[pid]?.peak, v, now) };
            return next;
          });
          const levels = new Map<number, AlertLevel>();
          for (const r of rulesRef.current) if (got.has(r.pid)) levels.set(r.pid, alertLevel(r, got.get(r.pid), lastRpm));
          if (tracker.current.update(levels, now).length) alertBuzz('alert');
        }
        if (answered) {
          meter.current.add(answered, now);
          const r = meter.current.rate();
          if (r) setRate(r.readings);
        }
        if (Date.now() - lastVolts >= VOLTS_EVERY_MS) {
          lastVolts = Date.now();
          const extra = [RPM, COOLANT].filter((p) => !ids.includes(p) && byPid.has(p)).map((p) => byPid.get(p)!);
          if (extra.length) {
            const more = await client.readLiveMany(extra).catch(() => new Map<number, number | null>());
            if (running && more.size) setValues((old) => ({ ...old, ...Object.fromEntries(more) }));
          }
          if (!running) break;
          const v = await client.batteryVoltage();
          if (!running) break;
          setVolts(v);
        }
        if (!answered) await sleep(ids.length ? 1500 : 500);
      }
    })();
    return () => {
      running = false;
    };
  }, [conn.client, available]);

  const alerts = dashAlerts(values[COOLANT] ?? null, values[RPM] ?? null, volts, settings.temp);
  const alertKey = alerts.map((a) => a.key).join(',');
  const lastKey = useRef('');
  useEffect(() => {
    // A warning buzz and sound each time a new alert appears.
    const fresh = alertKey.split(',').some((k) => k && !lastKey.current.split(',').includes(k));
    lastKey.current = alertKey;
    if (fresh) alertBuzz('alert');
  }, [alertKey]);

  // Whether the shift light was on at the last reading (for its 150 rpm margin).
  const shiftWas = useRef(false);
  if (!conn.client) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to see the dashboard" />
      </Screen>
    );
  }

  const supportedIds = new Set((available ?? []).map((p) => p.pid));
  const fgMuted = hud ? 'rgba(255,255,255,0.72)' : t.muted;
  const coolantLimit = `${Math.round(tempIn(COOLANT_MAX_C, settings.temp))} ${settings.temp}`;
  const page = pages[pageIdx] ?? pages[0];
  const shiftOn = shiftLightOn(values[RPM], shiftRpm, shiftWas.current);
  shiftWas.current = shiftOn;
  const goTo = (i: number) => {
    setPageIdx(i);
    pager.current?.scrollTo({ x: i * width, animated: true });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: hud ? '#000000' : t.bg }} contentContainerStyle={styles.page} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <Button label={shiftLabel(shiftRpm)} icon="alarm-light-outline" variant="secondary" compact style={{ flex: 1 }} onPress={() => setShiftOpen(true)} />
            <Button label="Edit page" icon="pencil-outline" variant="secondary" compact style={{ flex: 1 }} onPress={() => setEditing(true)} disabled={!page} />
          </View>
          <Button label={hud ? 'Normal view' : 'Windscreen view'} icon="mirror-rectangle" variant="secondary" compact onPress={() => setHud((h) => !h)} />
        </View>

        {pages.length > 1 ? (
          <Chips options={pages.map((p, i) => ({ id: String(i), label: p.name }))} value={String(pageIdx)} onPick={(id) => goTo(Number(id))} style={styles.tabs} />
        ) : null}

        <View style={[styles.gaugeArea, hud && styles.hud]}>
          {alerts.map((a) => (
            <View key={a.key} accessibilityRole="alert" style={[styles.banner, { backgroundColor: hud ? '#000000' : t.dangerSoft, borderColor: t.danger }]}>
              <Icon name="alert-outline" size={22} color={t.danger} />
              <Text style={[type.heading, { color: t.danger, flex: 1 }]}>{a.text}</Text>
            </View>
          ))}

          <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            <ScrollView
              ref={pager}
              horizontal
              pagingEnabled
              scrollEnabled={pages.length > 1}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => width && setPageIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
            >
              {pages.map((pg, pi) => (
                <View key={pg.id} style={[styles.grid, { width: width || undefined }]} accessibilityLabel={`Page ${pg.name}`}>
                  {pg.pids.map((pid, i) => {
                    const p = pidInfo(pid);
                    const rule = rules.find((r) => r.pid === pid);
                    const level = alertLevel(rule, values[pid], values[RPM]);
                    return (
                      <DashTile
                        key={`${pg.id}-${i}`}
                        p={p}
                        supported={supportedIds.has(pid)}
                        tileStyle={pg.style}
                        value={values[pid] ?? null}
                        points={hist[pid] ?? []}
                        stats={stats[pid]}
                        level={level}
                        hot={pid === COOLANT && (values[pid] ?? 0) > COOLANT_MAX_C}
                        hud={hud}
                        settings={settings}
                        onPress={() => {
                          setPageIdx(pi);
                          setPicking(i);
                        }}
                        onLongPress={() => p && setTileSheet(p)}
                      />
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.rateRow}>
          <Text style={[type.sub, type.number, { color: fgMuted, flex: 1 }]}>
            {`Battery ${volts == null ? 'not read yet' : `${volts.toFixed(1)} V`}`}
            {rate ? `. ${rateText(rate)} readings a second.` : '.'}
          </Text>
          <HelpButton help={SECTIONS.liveRate} />
        </View>
        <Text style={[type.small, { color: fgMuted, marginTop: space.xs }]}>
          {`Alerts: coolant above ${coolantLimit}; voltage below ${VOLTS_MIN_RUNNING.toFixed(1)} V with the engine running (above ${RUNNING_RPM} rpm) or below ${VOLTS_MIN_OFF.toFixed(1)} V with it off. Voltage is read every 10 seconds. Tap a gauge to change it or set its alerts.${shiftRpm ? ` Shift light at ${shiftRpm} rpm.` : ''}`}
        </Text>
        {available && !available.length ? <Notice text="The car did not report any standard live values." /> : null}

        <PidPicker
          visible={picking != null}
          available={available ?? []}
          current={picking != null && page ? page.pids[picking] : null}
          onAlerts={(p) => {
            setPicking(null);
            // Opened once the picker has gone, as iOS shows one sheet at a time.
            setTimeout(() => setTileSheet(p), 500);
          }}
          onClose={(pid) => {
            if (pid != null && picking != null && page) savePages(updatePage(pages, page.id, { pids: page.pids.map((p, i) => (i === picking ? pid : p)) }));
            setPicking(null);
          }}
        />
        <TileSheet
          pid={tileSheet}
          rule={tileSheet ? rules.find((r) => r.pid === tileSheet.pid) : undefined}
          minMax={tileSheet ? stats[tileSheet.pid]?.mm : null}
          peak={tileSheet ? stats[tileSheet.pid]?.peak : null}
          settings={settings}
          onClose={() => setTileSheet(null)}
          onResetMinMax={() => {
            if (!tileSheet) return;
            setStats((old) => {
              const next = { ...old };
              delete next[tileSheet.pid];
              return next;
            });
          }}
          onSave={(rule) => {
            if (tileSheet) {
              const next = setRule(rules, tileSheet.pid, rule);
              setRules(next);
              if (vin) garage.update(vin, { liveAlerts: next });
            }
            setTileSheet(null);
          }}
        />
        {page ? (
          <PageSheet
            visible={editing}
            page={page}
            canDelete={pages.length > 1}
            canAdd={pages.length < MAX_PAGES}
            onClose={(patch) => {
              setEditing(false);
              if (patch) {
                const resized = patch.count != null ? resizePage(page, patch.count, [...supportedIds]) : page;
                savePages(updatePage(pages, page.id, { name: patch.name || page.name, style: patch.style ?? page.style, pids: resized.pids }));
              }
            }}
            onAdd={() => {
              setEditing(false);
              const next = addPage(pages, [...supportedIds], DEFAULT_WATCH);
              savePages(next);
              setTimeout(() => goTo(next.length - 1), 50);
            }}
            onDelete={() => {
              setEditing(false);
              savePages(removePage(pages, page.id));
              goTo(0);
            }}
          />
        ) : null}
        <ShiftSheet
          visible={shiftOpen}
          shiftRpm={shiftRpm}
          onClose={(shift) => {
            setShiftOpen(false);
            if (shift != null && shift !== shiftRpm) {
              setShiftRpm(shift);
              if (vin) garage.update(vin, { shiftRpm: shift });
            }
          }}
        />
      </ScrollView>
      <ShiftLight on={shiftOn} />
    </View>
  );
}

function DashTile({
  p,
  supported,
  tileStyle,
  value,
  points,
  stats,
  level,
  hot,
  hud,
  settings,
  onPress,
  onLongPress,
}: {
  p: LivePid | undefined;
  supported: boolean;
  tileStyle: TileStyle;
  value: number | null;
  points: number[];
  stats: Stats | undefined;
  level: AlertLevel;
  hot: boolean;
  hud: boolean;
  settings: Settings;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const t = useTheme();
  const fg = hud ? '#FFFFFF' : t.text;
  const fgMuted = hud ? 'rgba(255,255,255,0.72)' : t.muted;
  const conv = p && value != null ? toUserUnits(value, p.unit, settings) : null;
  const unit = p ? toUserUnits(0, p.unit, settings).unit : '';
  const text = !p || !supported ? 'Not on this car' : conv ? conv.value.toFixed(p.decimals) : '–';
  const warn = hot || !!level;
  const colour = warn ? t.danger : fg;
  const range = p ? rangeFor(p, stats?.mm) : null;
  const frac = value != null && range ? fraction(value, range) : null;
  const peakFrac = stats && range && stats.peak.value > (value ?? -Infinity) ? fraction(stats.peak.value, range) : null;
  const small = tileStyle !== 'number';
  const f = (v: number) => (p ? toUserUnits(v, p.unit, settings).value.toFixed(p.decimals) : '');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p?.label ?? 'Gauge'} ${text === '–' ? 'no reading' : `${text} ${unit}`}${warn ? ', past the alert limit' : ''}. Tap to change, press and hold for alerts.`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.gauge,
        { backgroundColor: hud ? '#000000' : warn ? t.dangerSoft : pressed ? t.raised : t.surface },
        hud && { borderColor: 'rgba(255,255,255,0.24)', borderWidth: StyleSheet.hairlineWidth },
        warn && { borderColor: t.danger, borderWidth: 2 },
      ]}
    >
      {/* 2 lines: long names ("Intake pressure (MAP)") are not cut off on an iPhone. Room for 2 is kept on
          every gauge, so the figures of a row sit level whether a name wraps or not. */}
      <Text numberOfLines={2} style={[type.sub, styles.gaugeLabel, { color: warn ? t.danger : fgMuted, fontWeight: '600' }]}>
        {p?.label ?? 'Choose a value'}
      </Text>
      {tileStyle === 'gauge' ? <Dial frac={frac} peak={peakFrac} colour={warn ? t.danger : t.accent} /> : null}
      {/* Under a dial the figure is centred on it, clear of the ends of the arc. */}
      <Text numberOfLines={1} adjustsFontSizeToFit style={[small ? styles.figureSmall : styles.figure, type.number, { color: colour, fontWeight: hud ? '800' : '700' }, tileStyle === 'gauge' && styles.dialFigure]}>
        {text}
        {small && unit ? <Text style={[type.sub, { color: fgMuted, fontWeight: '500' }]}> {unit}</Text> : null}
      </Text>
      {tileStyle === 'bar' ? <Bar frac={frac} peak={peakFrac} colour={warn ? t.danger : t.accent} /> : null}
      {tileStyle === 'graph' ? <LineChart height={56} series={[{ values: points, colour: warn ? t.danger : t.accent }]} /> : null}
      {small ? (
        <Text style={[type.caption, type.number, { color: fgMuted, marginTop: space.xs }, tileStyle === 'gauge' && { textAlign: 'center' }]}>{stats ? `min ${f(stats.mm.min)} · max ${f(stats.mm.max)}` : ' '}</Text>
      ) : (
        <Text style={[type.sub, { color: fgMuted }]}>{unit || ' '}</Text>
      )}
    </Pressable>
  );
}

// Edit the page on screen: name, tile style, number of tiles; add or delete pages.
function PageSheet({
  visible,
  page,
  canDelete,
  canAdd,
  onClose,
  onAdd,
  onDelete,
}: {
  visible: boolean;
  page: DashPage;
  canDelete: boolean;
  canAdd: boolean;
  onClose: (patch: { name?: string; style?: TileStyle; count?: number } | null) => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
  const [name, setName] = useState(page.name);
  const [style, setStyle] = useState<TileStyle>(page.style);
  const [count, setCount] = useState(page.pids.length);
  // Delete this page asks first: a page takes work to set up again.
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setName(page.name);
    setStyle(page.style);
    setCount(page.pids.length);
    // Fill the fields each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const done = () => onClose({ name: name.trim(), style, count });
  return (
    <Modal visible={visible} animationType="slide" presentationStyle={ios ? 'pageSheet' : undefined} transparent={!ios} onRequestClose={() => onClose(null)}>
      <View style={[{ flex: 1, backgroundColor: t.bg }, !ios && styles.sheetWeb]}>
        <View style={[styles.sheetBar, { borderColor: t.border }]}>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => onClose(null)} style={styles.barButton}>
            <Text style={[type.body, { color: t.accentText }]}>Cancel</Text>
          </Pressable>
          <Text style={[type.heading, { color: t.text, flex: 1, textAlign: 'center' }]}>Edit page</Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={done} style={[styles.barButton, { alignItems: 'flex-end' }]}>
            <Text style={[type.body, { color: t.accentText, fontWeight: '600' }]}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Group header="Page" help={SECTIONS.liveDashPages}>
            <View style={{ padding: space.lg }}>
              <Field label="Name" value={name} onChange={setName} maxLength={20} accessibilityLabel="Page name" />
              <Text style={[type.small, { color: t.muted, marginBottom: space.xs, marginTop: space.md }]}>Gauge style</Text>
              <Segmented role="radio" label="Gauge style" options={TILE_STYLES} value={style} onPick={setStyle} />
              <Text style={[type.small, { color: t.muted, marginBottom: space.xs, marginTop: space.md }]}>Gauges</Text>
              <View style={styles.stepper}>
                <Button label="−" variant="secondary" onPress={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1} />
                <Text style={[type.title3, type.number, { color: t.text, minWidth: 60, textAlign: 'center' }]}>{count}</Text>
                <Button label="+" variant="secondary" onPress={() => setCount((c) => Math.min(MAX_TILES, c + 1))} disabled={count >= MAX_TILES} />
              </View>
            </View>
          </Group>
          <View style={{ gap: space.sm }}>
            {canAdd ? <Button label="Add a page" icon="plus" variant="secondary" onPress={onAdd} /> : null}
            {canDelete ? <Button label="Delete this page" icon="trash-can-outline" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
          </View>
        </ScrollView>
        <ConfirmSheet
          visible={confirmDelete}
          title="Delete this page?"
          lines={[`${page.name}, with its ${page.pids.length} gauge${page.pids.length === 1 ? '' : 's'}. This cannot be undone.`]}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
        />
      </View>
    </Modal>
  );
}

// The shift light for this car: the engine speed at which the screen flashes.
function ShiftSheet({ visible, shiftRpm, onClose }: { visible: boolean; shiftRpm: number; onClose: (shift: number | null) => void }) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
  const [shift, setShift] = useState(shiftRpm ? String(shiftRpm) : '');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    setShift(shiftRpm ? String(shiftRpm) : '');
    setError(null);
    // Fill the field each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const done = () => {
    const s = shiftRpmFrom(shift);
    if (s == null) {
      setError(`Type an engine speed from ${SHIFT_MIN_RPM} to ${SHIFT_MAX_RPM} rpm, or leave it empty.`);
      return;
    }
    onClose(s);
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle={ios ? 'pageSheet' : undefined} transparent={!ios} onRequestClose={() => onClose(null)}>
      <View style={[{ flex: 1, backgroundColor: t.bg }, !ios && styles.sheetWeb]}>
        <View style={[styles.sheetBar, { borderColor: t.border }]}>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => onClose(null)} style={styles.barButton}>
            <Text style={[type.body, { color: t.accentText }]}>Cancel</Text>
          </Pressable>
          <Text style={[type.heading, { color: t.text, flex: 1, textAlign: 'center' }]}>Shift light</Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={done} style={[styles.barButton, { alignItems: 'flex-end' }]}>
            <Text style={[type.body, { color: t.accentText, fontWeight: '600' }]}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Group header="Flash at" help={SECTIONS.liveShift} footer="The whole screen flashes red at this engine speed, on every page of this car. Leave it empty for no shift light.">
            <View style={{ padding: space.lg, paddingTop: 0 }}>
              <NumberField label="Engine speed (rpm)" value={shift} onChange={setShift} integer />
            </View>
          </Group>
          {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function PidPicker({
  visible,
  available,
  current,
  onAlerts,
  onClose,
}: {
  visible: boolean;
  available: LivePid[];
  current: number | null;
  // Opens alerts and lowest and highest for the gauge's value.
  onAlerts: (p: LivePid) => void;
  onClose: (pid: number | null) => void;
}) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);
  const matches = filterPids(available, query);
  const now = current != null ? available.find((p) => p.pid === current) : undefined;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle={ios ? 'pageSheet' : undefined} transparent={!ios} onRequestClose={() => onClose(null)}>
      <View style={[{ flex: 1, backgroundColor: t.bg }, !ios && styles.sheetWeb]}>
        <View style={[styles.sheetBar, { borderColor: t.border }]}>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => onClose(null)} style={styles.barButton}>
            <Text style={[type.body, { color: t.accentText }]}>Cancel</Text>
          </Pressable>
          <Text style={[type.heading, { color: t.text, flex: 1, textAlign: 'center' }]}>Choose a value</Text>
          <View style={styles.barButton} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {now ? (
            <Group header="This gauge">
              <ListRow first icon={'bell-outline' as IconName} iconColour="red" title="Alerts and lowest and highest" subtitle={now.label} onPress={() => onAlerts(now)} />
            </Group>
          ) : null}
          {available.length ? (
            <View style={{ marginBottom: space.lg }}>
              <SearchField value={query} onChange={setQuery} placeholder="Search values" caps={false} />
            </View>
          ) : null}
          {/* What a gauge can show, said where the choice is made. */}
          <Text style={[type.small, { color: t.muted, marginBottom: space.lg }]}>{GAUGE_VALUES_NOTE}</Text>
          {!available.length ? <Notice text="The car did not report any standard live values." /> : null}
          {available.length && !matches.length ? <Notice text="No value matches. Try another word, for example speed, fuel or temp." /> : null}
          {PID_GROUPS.map((g) => {
            const items = matches.filter((p) => p.group === g);
            if (!items.length) return null;
            return (
              <Group key={g} header={g}>
                {items.map((p, i) => (
                  <ListRow
                    key={p.pid}
                    first={i === 0}
                    title={p.label}
                    value={p.unit}
                    noChevron
                    selected={p.pid === current}
                    onPress={() => onClose(p.pid)}
                  />
                ))}
              </Group>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xxl },
  controls: { gap: space.sm, marginBottom: space.lg },
  controlRow: { flexDirection: 'row', gap: space.sm },
  tabs: { marginBottom: space.lg },
  gaugeArea: { flexGrow: 1, borderRadius: radius.lg },
  hud: { backgroundColor: '#000000', transform: [{ scaleX: -1 }] },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, borderWidth: 2, padding: space.md, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignContent: 'flex-start' },
  gauge: { flexBasis: '45%', flexGrow: 1, minHeight: 160, borderRadius: radius.lg, padding: space.lg, justifyContent: 'space-between' },
  figure: { fontSize: 56, lineHeight: 62, letterSpacing: -1 },
  figureSmall: { fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  gaugeLabel: { minHeight: 40 },
  dialFigure: { textAlign: 'center' },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  sheetWeb: { marginTop: 60, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  sheetBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  barButton: { width: 80, minHeight: 44, justifyContent: 'center' },

  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
