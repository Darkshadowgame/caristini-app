import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_WATCH, LivePid, PID_GROUPS, pidInfo } from '../obd/pids';
import { Settings, tempIn, toUserUnits, useSettings } from '../settings';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { Button, Group, Icon, ListRow, NeedsConnection, Notice, Screen } from '../ui';

// Speed, engine speed, coolant and intake pressure.
const DEFAULT_SLOTS = [0x0d, 0x0c, 0x05, 0x0b];
const RPM = 0x0c;
const COOLANT = 0x05;
const VOLTS_EVERY_MS = 10_000;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Dashboard() {
  const t = useTheme();
  const conn = useConnection();
  const { settings } = useSettings();
  useKeepAwake();
  const [available, setAvailable] = useState<LivePid[] | null>(null);
  const [slots, setSlots] = useState<number[]>(DEFAULT_SLOTS);
  const [values, setValues] = useState<Record<number, number | null>>({});
  const [volts, setVolts] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [hud, setHud] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  // Which values this car reports; swap unsupported defaults for others.
  useEffect(() => {
    const client = conn.client;
    setAvailable(null);
    setValues({});
    setVolts(null);
    if (!client) return;
    client.livePidsForCar().then(
      (list) => {
        setAvailable(list);
        const ids = list.map((p) => p.pid);
        const spare = DEFAULT_WATCH.filter((p) => ids.includes(p) && !DEFAULT_SLOTS.includes(p));
        setSlots(DEFAULT_SLOTS.map((p) => (ids.includes(p) ? p : (spare.shift() ?? p))));
      },
      () => setAvailable([]),
    );
  }, [conn.client]);

  // Read the four gauges in turn as fast as the adapter answers. Every 10 s
  // also read the adapter voltage, and engine speed and coolant if they are
  // not on a gauge, for the alerts.
  useEffect(() => {
    const client = conn.client;
    if (!client || !available) return;
    const supported = new Set(available.map((p) => p.pid));
    let running = true;
    let lastVolts = 0;
    (async () => {
      while (running) {
        const ids = [...new Set(slotsRef.current)].filter((p) => supported.has(p));
        const started = Date.now();
        let any = false;
        for (const pid of ids) {
          if (!running) break;
          const v = await client.readLive(pidInfo(pid)!);
          if (!running) break;
          any = any || v != null;
          setValues((old) => ({ ...old, [pid]: v }));
        }
        if (!running) break;
        if (ids.length) setRate(1000 / Math.max(1, Date.now() - started));
        if (Date.now() - lastVolts >= VOLTS_EVERY_MS) {
          lastVolts = Date.now();
          for (const pid of [RPM, COOLANT]) {
            if (!running || ids.includes(pid) || !supported.has(pid)) continue;
            const v = await client.readLive(pidInfo(pid)!);
            if (running) setValues((old) => ({ ...old, [pid]: v }));
          }
          if (!running) break;
          const v = await client.batteryVoltage();
          if (!running) break;
          setVolts(v);
        }
        if (!any) await sleep(ids.length ? 1500 : 500);
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
    // A warning haptic each time a new alert appears.
    const fresh = alertKey.split(',').some((k) => k && !lastKey.current.split(',').includes(k));
    lastKey.current = alertKey;
    if (fresh && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, [alertKey]);

  if (!conn.client) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car for the dashboard" />
      </Screen>
    );
  }

  const supportedIds = new Set((available ?? []).map((p) => p.pid));
  const fg = hud ? '#FFFFFF' : t.text;
  const fgMuted = hud ? 'rgba(255,255,255,0.72)' : t.muted;
  const coolantLimit = `${Math.round(tempIn(COOLANT_MAX_C, settings.temp))} ${settings.temp}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: hud ? '#000000' : t.bg }}
      contentContainerStyle={styles.page}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.controls}>
        <Button
          label={hud ? 'Normal view' : 'Head-up'}
          icon="mirror-rectangle"
          variant="secondary"
          compact
          style={{ flex: 1 }}
          onPress={() => setHud((h) => !h)}
        />
      </View>

      <View style={[styles.gaugeArea, hud && styles.hud]}>
        {alerts.map((a) => (
          <View key={a.key} accessibilityRole="alert" style={[styles.banner, { backgroundColor: hud ? '#000000' : t.dangerSoft, borderColor: t.danger }]}>
            <Icon name="alert-outline" size={22} color={t.danger} />
            <Text style={[type.heading, { color: t.danger, flex: 1 }]}>{a.text}</Text>
          </View>
        ))}

        <View style={styles.grid}>
          {slots.map((pid, i) => {
            const p = pidInfo(pid);
            const raw = values[pid];
            const conv = p && raw != null ? toUserUnits(raw, p.unit, settings) : null;
            const unit = p ? toUserUnits(0, p.unit, settings).unit : '';
            const text = !p || !supportedIds.has(pid) ? 'No data' : conv ? conv.value.toFixed(p.decimals) : '–';
            const hot = pid === COOLANT && raw != null && raw > COOLANT_MAX_C;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${p?.label ?? 'Gauge'} ${text === '–' ? 'no reading' : `${text} ${unit}`}. Tap to change.`}
                onPress={() => setPicking(i)}
                style={({ pressed }) => [
                  styles.gauge,
                  { backgroundColor: hud ? '#000000' : pressed ? t.raised : t.surface },
                  hud && { borderColor: 'rgba(255,255,255,0.24)', borderWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <Text numberOfLines={1} style={[type.sub, { color: fgMuted, fontWeight: '600' }]}>
                  {p?.label ?? 'Choose a value'}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.figure, type.number, { color: hot ? t.danger : fg, fontWeight: hud ? '800' : '700' }]}
                >
                  {text}
                </Text>
                <Text style={[type.sub, { color: fgMuted }]}>{unit || ' '}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={[type.sub, type.number, { color: fgMuted, marginTop: space.md }]}>
        {`Battery ${volts == null ? 'not read yet' : `${volts.toFixed(1)} V`}`}
        {rate ? `. Gauges update about ${rate.toFixed(1)} times a second.` : '.'}
      </Text>
      <Text style={[type.small, { color: fgMuted, marginTop: space.xs }]}>
        {`Alerts: coolant above ${coolantLimit}; voltage below ${VOLTS_MIN_RUNNING.toFixed(1)} V with the engine running (above ${RUNNING_RPM} rpm) or below ${VOLTS_MIN_OFF.toFixed(1)} V with it off. Voltage is read every 10 s. Tap a gauge to change it.`}
      </Text>
      {available && !available.length ? <Notice text="The car did not report any standard live values." /> : null}

      <PidPicker
        visible={picking != null}
        available={available ?? []}
        current={picking != null ? slots[picking] : null}
        onClose={(pid) => {
          if (pid != null && picking != null) setSlots((old) => old.map((p, i) => (i === picking ? pid : p)));
          setPicking(null);
        }}
      />
    </ScrollView>
  );
}

function PidPicker({
  visible,
  available,
  current,
  onClose,
}: {
  visible: boolean;
  available: LivePid[];
  current: number | null;
  onClose: (pid: number | null) => void;
}) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
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
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
          {!available.length ? <Notice text="The car did not report any standard live values." /> : null}
          {PID_GROUPS.map((g) => {
            const items = available.filter((p) => p.group === g);
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
                    right={<Icon name="check" size={18} color={p.pid === current ? t.accentText : 'transparent'} />}
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
  controls: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  gaugeArea: { flexGrow: 1, borderRadius: radius.lg },
  hud: { backgroundColor: '#000000', transform: [{ scaleX: -1 }] },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, borderWidth: 2, padding: space.md, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, flexGrow: 1 },
  gauge: { flexBasis: '45%', flexGrow: 1, minHeight: 160, borderRadius: radius.lg, padding: space.lg, justifyContent: 'space-between' },
  figure: { fontSize: 56, lineHeight: 62, letterSpacing: -1 },
  sheetWeb: { marginTop: 60, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  sheetBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  barButton: { width: 80, minHeight: 44, justifyContent: 'center' },
});
