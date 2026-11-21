// Data logger: choose values, record (by hand or auto-start), drop markers,
// and open saved logs for this car.
import { useDisplay } from '../fonts';
import { router, Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SECTIONS } from '../help';
import { allowSleep, stayAwake } from '../keepAwake';
import type { ElmClient } from '../obd/elm';
import { toUserUnits, useSettings } from '../settings';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { TOOLS, Body, Button, GlowCard, GuideButton, Group, Icon, ListRow, NeedsConnection, Notice, Screen, SearchField, Stepper, success, tap, tool } from '../ui';
import { useGarage, Vehicle, vehicleTitle } from '../vehicle/garage';
import { AutoRule, clampRule, DEFAULT_AUTO, LIMITS, stepStopDelay, stepThreshold, TRIGGER_LABEL, TRIGGER_PID, TriggerKind, withKind } from '../logger/auto';
import { formatDuration, formatWhen, LogChannel, LogSummary, obdKey } from '../logger/format';
import { gpsNote } from '../logger/gps';
import { ChannelOption, channelOptions, IDLE_STATUS, LoggerSession, LoggerStatus } from '../logger/recorder';
import { listLogs, loadPrefs, savePrefs } from '../logger/store';

// Chosen on a car's first log: engine speed, speed, throttle, coolant, load.
const FIRST_CHOICE = [0x0c, 0x0d, 0x11, 0x05, 0x04].map(obdKey);
const AWAKE = 'data-logger';

export default function Logger() {
  const conn = useConnection();
  const header = <Stack.Screen options={{ title: 'Data logger', headerRight: () => <GuideButton id="logger" /> }} />;
  if (!conn.client || !conn.vehicle) {
    return (
      <Screen>
        {header}
        <NeedsConnection title="Connect your car to record a log" />
        <OtherCarsLogs />
      </Screen>
    );
  }
  return (
    <Screen>
      {header}
      <Recorder key={`${conn.vehicle.vin}`} client={conn.client} vehicle={conn.vehicle} />
    </Screen>
  );
}

function logLine(s: LogSummary): string {
  const parts = [formatDuration(s.durationMs), `${s.labels.length} value${s.labels.length === 1 ? '' : 's'}`, `${s.rate.toFixed(1)} readings a second`];
  if (s.markers) parts.push(`${s.markers} marker${s.markers === 1 ? '' : 's'}`);
  if (s.start === 'auto') parts.push('auto-start');
  return parts.join(', ');
}

function Recorder({ client, vehicle }: { client: ElmClient; vehicle: Vehicle }) {
  const displayFont = useDisplay();
  const t = useTheme();
  const { settings } = useSettings();
  const vin = vehicle.vin;
  const [options, setOptions] = useState<ChannelOption[] | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [rule, setRule] = useState<AutoRule>(DEFAULT_AUTO);
  const [gps, setGps] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<LoggerStatus>(IDLE_STATUS);
  const [logs, setLogs] = useState<LogSummary[] | null>(null);
  const [picking, setPicking] = useState(false);
  const session = useRef<LoggerSession | null>(null);

  // What this car can record, and the choice saved last time.
  useEffect(() => {
    let on = true;
    (async () => {
      const [opts, prefs] = await Promise.all([channelOptions(client, vehicle), loadPrefs(vin)]);
      if (!on) return;
      const have = new Set(opts.map((o) => o.channel.key));
      const saved = prefs?.keys.filter((k) => have.has(k)) ?? [];
      setOptions(opts);
      setKeys(saved.length ? saved : FIRST_CHOICE.filter((k) => have.has(k)));
      // Auto-start always begins off when the screen opens.
      setRule(clampRule({ ...(prefs?.auto ?? DEFAULT_AUTO), on: false }));
      setGps(prefs?.gps !== false);
      setLoaded(true);
    })().catch(() => setOptions([]));
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, vin]);

  // One recording session while this screen is open; closing it saves the log.
  useEffect(() => {
    const s = new LoggerSession(client, { vin, title: vehicleTitle(vehicle) }, setStatus);
    session.current = s;
    return () => {
      session.current = null;
      s.dispose().catch(() => undefined);
      allowSleep(AWAKE);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, vin]);

  useEffect(() => {
    if (!options || !loaded) return;
    session.current?.configure(options, keys, rule, gps);
    savePrefs(vin, { keys, auto: rule, gps });
  }, [options, keys, rule, gps, loaded, vin]);

  // The phone stays awake while recording or waiting to start.
  useEffect(() => {
    if (status.phase === 'idle') allowSleep(AWAKE);
    else stayAwake(AWAKE);
  }, [status.phase]);

  const refresh = useCallback(() => {
    listLogs(vin).then(setLogs, () => setLogs([]));
  }, [vin]);
  useFocusEffect(refresh);
  useEffect(() => {
    if (status.saved) {
      success();
      refresh();
    }
  }, [status.saved, refresh]);

  const byKey = useMemo(() => new Map((options ?? []).map((o) => [o.channel.key, o.channel])), [options]);
  const fmt = (c: LogChannel, v: number) => {
    const u = toUserUnits(v, c.unit, settings);
    return `${u.value.toFixed(c.decimals)}${u.unit ? ` ${u.unit}` : ''}`;
  };
  const recording = status.phase === 'recording';
  const armed = status.phase === 'armed';
  const kinds = (Object.keys(TRIGGER_PID) as TriggerKind[]).filter((k) => options?.some((o) => o.pid?.pid === TRIGGER_PID[k]));
  const canAuto = kinds.length > 0;
  const lim = LIMITS[rule.kind];

  let headline = 'Ready';
  if (recording) headline = status.start === 'auto' ? 'Recording (auto-start)' : 'Recording';
  else if (armed) headline = 'Waiting for auto-start';
  let line = options == null ? 'Asking the car which values it reports…' : `${keys.length} value${keys.length === 1 ? '' : 's'} chosen.`;
  if (recording) line = `${status.rows.toLocaleString('en-GB')} readings${status.rate != null ? `, ${status.rate.toFixed(1)} readings a second` : ''}`;
  else if (armed) {
    const now = status.trigger == null ? 'no reading yet' : `now ${Math.round(status.trigger)} ${lim.unit}`;
    line = `${TRIGGER_LABEL[rule.kind]} ${now}. Starts above ${rule.above} ${lim.unit}.`;
  }

  return (
    <View>
      {/* The orange wash only while the car is being read (recording, or watching for the auto-start). Red is kept for faults. */}
      <GlowCard tone={recording || armed ? 'brand' : 'plain'} style={{ padding: space.xl }}>
        <Text style={[type.label, { color: t.muted }]}>{headline}</Text>
        <Text accessibilityLabel={`Log length ${formatDuration(status.elapsedMs)}`} style={[styles.big, type.number, displayFont, { color: t.text }]}>
          {recording ? formatDuration(status.elapsedMs) : '0 s'}
        </Text>
        <Text style={[type.sub, type.number, { color: t.muted }]}>{line}</Text>
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {recording ? (
            <Button label="Stop recording" icon="stop" variant="danger" onPress={() => session.current?.stop()} />
          ) : (
            <Button label="Record" icon="record-circle-outline" disabled={!options || !keys.length} onPress={() => session.current?.record()} />
          )}
        </View>
        {recording ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Drop marker ${status.markers + 1}`}
            onPress={() => {
              tap();
              session.current?.mark();
            }}
            style={({ pressed }) => [styles.marker, { backgroundColor: t.accent, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Icon name="map-marker-outline" size={28} color={t.onAccent} />
            <Text style={[type.title3, { color: t.onAccent }]}>Marker {status.markers + 1}</Text>
          </Pressable>
        ) : null}
      </GlowCard>

      {status.phase !== 'idle' && gpsNote(status.gps) ? <Notice icon="map-marker-off-outline" text={gpsNote(status.gps)!} /> : null}
      {status.message ? <Notice tone={status.saved ? 'ok' : 'neutral'} icon={status.saved ? 'check' : 'information-outline'} text={status.message} /> : null}

      {recording && status.sources.length ? (
        <Group header="Readings a second" help={SECTIONS.logRate}>
          {status.sources.map((s, i) => (
            <ListRow key={s.id} first={i === 0} title={s.label} value={s.resting ? 'Not answering' : s.rate != null ? s.rate.toFixed(1) : '…'} />
          ))}
        </Group>
      ) : null}

      {recording ? (
        <Group header="Now">
          {keys.slice(0, 8).map((k, i) => {
            const c = byKey.get(k);
            const v = status.last[k];
            return c ? <ListRow key={k} first={i === 0} title={c.label} value={v != null ? fmt(c, v) : '–'} /> : null;
          })}
        </Group>
      ) : null}

      <Group header="Route and screen off" help={SECTIONS.logGps} footer={Platform.OS === 'web' ? 'Not available in the web preview.' : 'Uses the phone’s GPS while recording or waiting to start. A blue mark at the top of the screen shows it is on.'}>
        <ListRow
          first
          icon="map-marker-path"
          iconColour={TOOLS.logger.colour}
          title="Record route, keep going with the screen off"
          subtitle={recording && gps ? (status.gps === 'on' ? 'GPS on' : status.gps ? 'GPS not available' : 'Starting GPS…') : undefined}
          right={
            <Switch
              value={gps}
              disabled={recording || armed}
              trackColor={{ true: t.green, false: t.sunken }}
              accessibilityLabel="Record route and keep going with the screen off"
              onValueChange={(on) => {
                tap();
                setGps(on);
              }}
            />
          }
        />
      </Group>

      <Group header="Values to record" help={SECTIONS.logValues} footer="Fewer values record faster.">
        <ListRow
          first
          icon="playlist-check"
          iconColour={TOOLS.logger.colour}
          title="Choose values"
          value={options ? `${keys.length} of ${options.length}` : '…'}
          disabled={!options || recording}
          onPress={() => setPicking(true)}
        />
      </Group>

      <Group
        header="Auto-start"
        help={SECTIONS.logAuto}
        footer={options && !kinds.length ? 'This car does not report engine speed, pedal or throttle, so auto-start cannot work.' : undefined}
      >
        <ListRow
          first
          icon="play-circle-outline"
          iconColour={TOOLS.logger.colour}
          title="Auto-start"
          subtitle={rule.on ? `Above ${rule.above} ${lim.unit}, stops ${rule.stopAfterS} s after` : 'Start and stop by itself'}
          right={
            <Switch
              value={rule.on}
              disabled={!canAuto || recording}
              trackColor={{ true: t.green, false: t.sunken }}
              accessibilityLabel="Auto-start"
              onValueChange={(on) => {
                tap();
                setRule((r) => ({ ...(kinds.includes(r.kind) ? r : withKind(r, kinds[0])), on }));
              }}
            />
          }
        />
        {rule.on
          ? kinds.map((k) => (
              <ListRow key={k} title={TRIGGER_LABEL[k]} noChevron selected={rule.kind === k} disabled={recording} onPress={() => setRule((r) => withKind(r, k))} />
            ))
          : null}
        {rule.on && kinds.length ? (
          <>
            <ListRow title="Start above" right={<Stepper value={`${rule.above} ${lim.unit}`} disabled={recording} onStep={(d) => setRule((r) => stepThreshold(r, d))} />} />
            <ListRow title="Stop after" right={<Stepper value={`${rule.stopAfterS} s`} disabled={recording} onStep={(d) => setRule((r) => stepStopDelay(r, d))} />} />
          </>
        ) : null}
      </Group>

      <Group header="Saved logs" help={SECTIONS.logSaved}>
        {logs == null ? (
          <ListRow first title="Loading…" />
        ) : logs.length ? (
          logs.map((s, i) => (
            <ListRow
              key={s.id}
              first={i === 0}
              {...tool('logger')}
              title={formatWhen(s.startedAt)}
              subtitle={logLine(s)}
              onPress={() => router.push({ pathname: '/log-view', params: { vin, id: s.id } })}
            />
          ))
        ) : (
          <ListRow first title="No logs yet for this car" subtitle="Choose values and tap Record." />
        )}
      </Group>

      <ValuePicker
        visible={picking}
        options={options ?? []}
        selected={keys}
        onClose={(next) => {
          setPicking(false);
          if (next) setKeys(next);
        }}
      />
    </View>
  );
}


// Page sheet with every value this car can record, by kind, with a search.
function ValuePicker({ visible, options, selected, onClose }: { visible: boolean; options: ChannelOption[]; selected: string[]; onClose: (next: string[] | null) => void }) {
  const t = useTheme();
  const [draft, setDraft] = useState<string[]>(selected);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (visible) {
      setDraft(selected);
      setQ('');
    }
  }, [visible, selected]);
  const ios = Platform.OS === 'ios';
  const shown = q ? options.filter((o) => `${o.channel.label} ${o.section}`.toLowerCase().includes(q.toLowerCase())) : options;
  const sections = [...new Set(shown.map((o) => o.section))];
  const toggle = (k: string) => setDraft((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle={ios ? 'pageSheet' : undefined} transparent={!ios} onRequestClose={() => onClose(null)}>
      <View style={[styles.sheetPage, { backgroundColor: t.bg }, !ios && styles.sheetWeb]}>
        <View style={[styles.sheetBar, { borderColor: t.border }]}>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => onClose(null)} style={styles.barButton}>
            <Text style={[styles.barText, { color: t.accentText }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.barTitle, { color: t.text }]}>Values to record</Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => onClose(draft)} style={[styles.barButton, { alignItems: 'flex-end' }]}>
            <Text style={[styles.barText, { color: t.accentText, fontWeight: '600' }]}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <SearchField value={q} onChange={setQ} placeholder="Search values" />
          <Text style={[styles.sheetNote, { color: t.muted }]}>
            {draft.length} of {options.length} chosen. Fewer values record faster.
          </Text>
          {!options.length ? <Body muted>The car did not report any values to record.</Body> : null}
          {sections.map((s) => (
            <Group key={s} header={s}>
              {shown
                .filter((o) => o.section === s)
                .map((o, i) => {
                  const unit = o.channel.unit;
                  return (
                    <ListRow key={o.channel.key} first={i === 0} title={o.channel.label} value={unit} noChevron selected={draft.includes(o.channel.key)} onPress={() => toggle(o.channel.key)} />
                  );
                })}
            </Group>
          ))}
          <Button label="Clear selection" variant="ghost" onPress={() => setDraft([])} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// Not connected: logs already saved for each car in the garage.
function OtherCarsLogs() {
  const garage = useGarage();
  const [all, setAll] = useState<{ v: Vehicle; logs: LogSummary[] }[]>([]);
  useFocusEffect(
    useCallback(() => {
      let on = true;
      Promise.all(garage.vehicles.map(async (v) => ({ v, logs: await listLogs(v.vin).catch(() => [] as LogSummary[]) }))).then((x) => on && setAll(x.filter((c) => c.logs.length)));
      return () => {
        on = false;
      };
    }, [garage.vehicles]),
  );
  return (
    <>
      {all.map(({ v, logs }) => (
        <Group key={v.vin} header={`Saved logs: ${vehicleTitle(v)}`} help={SECTIONS.logSaved}>
          {logs.map((s, i) => (
            <ListRow
              key={s.id}
              first={i === 0}
              {...tool('logger')}
              title={formatWhen(s.startedAt)}
              subtitle={logLine(s)}
              onPress={() => router.push({ pathname: '/log-view', params: { vin: v.vin, id: s.id } })}
            />
          ))}
        </Group>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 48, lineHeight: 56, fontWeight: '700', letterSpacing: -1, marginVertical: space.xs },
  // A capsule like every button, 96 pt tall so it can be hit without looking.
  marker: { marginTop: space.md, minHeight: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm },
  sheetPage: { flex: 1 },
  sheetWeb: { marginTop: 60, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  sheetBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  barButton: { width: 80, minHeight: 44, justifyContent: 'center' },
  barText: { fontSize: 17, letterSpacing: -0.41 },
  barTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
  sheetNote: { fontSize: 13, marginVertical: space.lg, marginLeft: space.lg },
});
