import { Stack, router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { allowSleep, stayAwake } from '../keepAwake';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addHistory } from '../history';
import { CATEGORY_COLOUR, CATEGORY_ICON, CATEGORY_ORDER, categoryOf, displaySensor, isPlausible, HEADER_NAMES, readKey, SensorCategory, sensorId, SensorRow, sensorsForCar, SensorValue } from '../obd/sensors';
import { byUsefulness, searchSensors } from '../obd/sensorSearch';
import { useSettings } from '../settings';
import { sendBack } from '../share/sendBack';
import { sendLogNow } from '../share/sendLog';
import { useConnection } from '../state';
import { MONO, radius, space, type, useTheme } from '../theme';
import { Button, GlowCard, Group, Icon, IconName, ListRow, NeedsConnection, Notice, Pill, ProgressBar, ScanPulse, Screen, SearchField, success, tap } from '../ui';
import { useGarage } from '../vehicle/garage';
import { quickRows, remainingRows, sharedSensorKeys } from '../obd/sharedSensors';
import { Switch } from 'react-native';
import { SECTIONS } from '../help';


// Every maker sensor the car answers: a one-time search, then live values by
// category. The candidates come from the OBDb project's signal sets for this
// car and its closest relatives.
export default function Sensors() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ cat?: string }>();
  const cat = (params.cat as SensorCategory | undefined) ?? null;
  const client = conn.client;
  const v = conn.vehicle;
  const all = useMemo(() => sensorsForCar(v, garage.vehicles), [v, garage.vehicles]);
  // Already asked on this car (answered or not), and sensors the owner's other
  // cars of the same family answered (asked first in a quick scan).
  const asked = useMemo(() => new Set([...(v?.sensorsAsked ?? []), ...(v?.sensorsFound ?? [])]), [v?.sensorsAsked, v?.sensorsFound]);
  const shared = useMemo(() => (v ? sharedSensorKeys(v, garage.vehicles) : new Set<string>()), [v, garage.vehicles]);
  // Modules to search, by request ID; all on until the owner switches some off.
  const modules = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of all) if (!r.ai) m.set(r.h, (m.get(r.h) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [showModules, setShowModules] = useState(false);
  const found = useMemo(() => new Set(v?.sensorsFound ?? []), [v?.sensorsFound]);
  const mine = useMemo(() => all.filter((r) => found.has(readKey(r))), [all, found]);
  const pinned = useMemo(() => new Set(v?.pinnedSensors ?? []), [v?.pinnedSensors]);

  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; module: string } | null>(null);
  const [liveFound, setLiveFound] = useState(0);
  const [values, setValues] = useState<Record<string, SensorValue>>({});
  const [typed, setQuery] = useState('');
  // Search after a short pause in typing, so reads do not queue up per letter.
  const [query, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(typed), typed ? 250 : 0);
    return () => clearTimeout(id);
  }, [typed]);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger' | 'info'; text: string } | null>(null);
  const stop = useRef(false);
  const scanStarted = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);

  // Search in owner words (synonyms, any order) across every system; a
  // category lists the values people check most first.
  const shown = useMemo(() => {
    const q = query.trim();
    if (q) return searchSensors(mine, q, (r) => HEADER_NAMES[r.h] ?? '');
    return cat ? byUsefulness(mine.filter((r) => categoryOf(r) === cat)) : mine;
  }, [mine, cat, query]);
  // Only the rows on screen are read live, so values refresh quickly.
  const PAGE = 25;
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [cat, query]);
  const visible = useMemo(() => shown.slice(0, limit), [shown, limit]);

  // Live values for what is on screen (a category, a search or the pinned set).
  const watching = useMemo(() => (cat || query.trim() ? visible : mine.filter((r) => pinned.has(sensorId(r)))), [cat, query, visible, mine, pinned]);
  const focused = useIsFocused();
  useEffect(() => {
    if (!client || searching || !watching.length || !focused) return;
    let running = true;
    (async () => {
      while (running) {
        const got = await client.readSensors(watching, () => !running).catch(() => ({}) as Record<string, SensorValue>);
        if (!running) break;
        setValues((old) => ({ ...old, ...got }));
        await new Promise((r) => setTimeout(r, 400));
      }
    })();
    return () => {
      running = false;
    };
  }, [client, searching, watching, focused]);

  if (!client || !v) {
    return (
      <Screen>
        <NeedsConnection what="your car's sensors" />
      </Screen>
    );
  }

  // quick: the sensors other cars taught Caristini first, then everything not
  // yet asked on this car. full: every sensor again, to confirm or correct.
  // Either way only the modules switched on are asked.
  const picked = (rows: SensorRow[]) => rows.filter((r) => !off.has(r.h));
  const quickList = picked([...quickRows(all, shared, asked), ...remainingRows(all, asked).filter((r) => !shared.has(readKey(r)))]);
  const fullList = picked(all.filter((r) => !r.ai));
  const mins = (n: number) => Math.max(1, Math.round((n * 0.12) / 60));

  const search = async (mode: 'quick' | 'full') => {
    if (!client || !v) return;
    stop.current = false;
    setSearching(true);
    setMessage(null);
    setLiveFound(0);
    stayAwake('sensors');
    scanStarted.current = Date.now();
    const rows = mode === 'quick' ? quickList : fullList;
    const scope = new Set(rows.map(readKey));
    // A full scan re-checks the chosen modules: their old answers are dropped
    // and only what answers now is kept. Other modules keep what they had.
    const keys = new Set((v.sensorsFound ?? []).filter((k) => mode === 'quick' || !scope.has(k)));
    const tried = new Set((v.sensorsAsked ?? []).filter((k) => mode === 'quick' || !scope.has(k)));
    const before = new Set(v.sensorsFound ?? []);
    const samples: Record<string, string> = {};
    let saved = Date.now();
    try {
      await client.probeSensors(rows, {
        cancelled: () => stop.current || !alive.current,
        onProgress: (done, total, module) => alive.current && setProgress({ done, total, module }),
        onAsked: (key) => tried.add(key),
        onFound: (key, data) => {
          keys.add(key);
          samples[key] = data.map((b) => b.toString(16).padStart(2, '0')).join('');
          if (alive.current) setLiveFound((n) => n + 1);
          // Save as it goes, so a stop or a lost link keeps what was found.
          if (Date.now() - saved > 5000) {
            saved = Date.now();
            garage.update(v.vin, { sensorsFound: [...keys], sensorsAsked: [...tried] });
          }
        },
      });
      const stopped = stop.current;
      const left = remainingRows(all, new Set([...tried, ...keys])).length;
      const complete = !stopped && left === 0;
      await garage.update(v.vin, { sensorsFound: [...keys], sensorsAsked: [...tried], sensorScan: { at: Date.now(), asked: tried.size, complete } });
      const count = all.filter((r) => keys.has(readKey(r))).length;
      const gone = mode === 'full' ? [...before].filter((k) => scope.has(k) && tried.has(k) && !keys.has(k)).length : 0;
      const what = mode === 'quick' ? 'Quick search' : 'Full search';
      await addHistory({ vin: v.vin, kind: 'sensors', title: `${count} sensors found`, detail: stopped ? `${what} stopped early` : what, complete });
      success();
      const note = `${count} sensors found on this car.${gone ? ` ${gone} that answered before did not answer this time and were taken off.` : ''}${!complete && !stopped && left ? ` ${left} not asked yet (modules switched off).` : ''}`;
      if (alive.current) setMessage({ tone: 'ok', text: note });
      // Send what was found back, so other cars and the next version know it.
      // Always tried: a failed send is kept on the phone and sent again later.
      const r = await sendBack('sensors', v.vin, { car: { brand: v.brand, model: v.model, year: v.year, platform: v.platform, group: v.group }, found: [...keys], samples }).catch(
        (e) => ({ via: 'none' as const, detail: e instanceof Error ? e.message : String(e) }),
      );
      if (alive.current) setMessage({ tone: 'ok', text: `${note} ${r.via === 'github' ? 'Sent back so other cars learn from it.' : r.detail}` });
    } catch (e) {
      if (alive.current) setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      allowSleep('sensors');
      void sendLogNow(`sensor ${mode} search`, v);
      if (alive.current) {
        setSearching(false);
        setProgress(null);
      }
    }
  };

  // The two scans and the module switches, shown before and after a search.
  const scanControls = (
    <>
      <Group
        header="Find sensors"
        help={SECTIONS.sensorsScan}
        footer="Quick asks what other cars found first, then only what this car has not been asked. Full asks everything again."
      >
        <ListRow
          first
          icon="lightning-bolt"
          iconColour="green"
          title="Quick search"
          subtitle={quickList.length ? `${quickList.length.toLocaleString('en-GB')} to ask, about ${mins(quickList.length)} min` : 'Nothing left to ask on the chosen modules'}
          disabled={!quickList.length}
          onPress={() => search('quick')}
        />
        <ListRow
          icon="radar"
          iconColour="blue"
          title="Full search"
          subtitle={`${fullList.length.toLocaleString('en-GB')} to ask, about ${mins(fullList.length)} min`}
          disabled={!fullList.length}
          onPress={() => search('full')}
        />
        <ListRow
          icon="tune-variant"
          iconColour="grey"
          title="Modules to search"
          value={off.size ? `${modules.length - off.size} of ${modules.length}` : 'All'}
          onPress={() => setShowModules((x) => !x)}
        />
      </Group>
      {showModules ? (
        <Group header="Modules to search" footer="Switch off modules you do not want asked, for example the engine, which holds most values.">
          {modules.map(([h, n], i) => (
            <View key={h} style={[styles.moduleRow, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: t.text }]}>{HEADER_NAMES[h] ?? `Module ${h}`}</Text>
                <Text style={[type.small, { color: t.muted }]}>{`${n.toLocaleString('en-GB')} sensors · ${h}`}</Text>
              </View>
              <Switch
                accessibilityLabel={`Search ${HEADER_NAMES[h] ?? h}`}
                value={!off.has(h)}
                onValueChange={(on) =>
                  setOff((old) => {
                    const next = new Set(old);
                    if (on) next.delete(h);
                    else next.add(h);
                    return next;
                  })
                }
              />
            </View>
          ))}
        </Group>
      ) : null}
    </>
  );

  const togglePin = (r: SensorRow) => {
    tap();
    const id = sensorId(r);
    const next = new Set(pinned);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    garage.update(v.vin, { pinnedSensors: [...next] });
  };

  const imperial = { speed: settings.speed === 'mph', temp: settings.temp === '°F' };
  // Values from this car's own model list are the most reliable; others come from close relatives.
  const ownList = (src: string) => !!v.model && src.toLowerCase().replace(/-/g, ' ').includes(v.model.toLowerCase().split(' ')[0]);
  const minutes = Math.max(1, Math.round((new Set(all.map(readKey)).size * 0.12) / 60));
  const counts = CATEGORY_ORDER.map((c) => ({ c, n: mine.filter((r) => categoryOf(r) === c).length })).filter((x) => x.n);

  const row = (r: SensorRow, i: number) => {
    const val = values[sensorId(r)];
    const d = val != null ? displaySensor(r, val, imperial) : null;
    const odd = val != null && !isPlausible(r, val);
    const on = pinned.has(sensorId(r));
    return (
      <View key={sensorId(r)} style={[styles.sensor, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { color: t.text }]}>{r.n}</Text>
          <Text style={[type.small, { color: t.muted }]}>
            {HEADER_NAMES[r.h] ?? `Module ${r.h}`} · <Text style={{ fontFamily: MONO }}>{r.d}</Text>
            {r.ai ? <Text style={{ color: t.accentText }}> · named by AI</Text> : !ownList(r.src) ? <Text> · {r.src.replace(/-/g, ' ')} list</Text> : null}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.title3, type.number, { color: d && !odd ? t.text : t.faint }]} accessibilityLabel={d ? undefined : 'No reading'}>
            {d ? d.text : '–'}
            {d?.unit ? <Text style={[type.sub, { color: t.muted }]}> {d.unit}</Text> : null}
          </Text>
          {odd ? <Text style={[type.caption, { color: t.accentText }]}>check: may not apply</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={on ? `Unpin ${r.n}` : `Pin ${r.n} to the top`} hitSlop={10} onPress={() => togglePin(r)} style={{ marginLeft: space.md }}>
          <Icon name={on ? ('star' as IconName) : 'star-outline'} size={20} color={on ? t.accent : t.faint} />
        </Pressable>
      </View>
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: cat ?? 'Sensors' }} />
      {message ? <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : message.tone === 'info' ? 'information-outline' : 'alert-circle-outline'} text={message.text} /> : null}

      {searching ? (
        <GlowCard tone="brand" style={{ alignItems: 'center' }}>
          <ScanPulse active size={132} />
          <Text style={[type.title3, { color: t.text, marginTop: space.md }]}>Searching your car</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: 4, marginBottom: space.lg }]}>
            {liveFound} found so far. Keep the ignition on; the engine can run.
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <ProgressBar value={progress ? progress.done / Math.max(1, progress.total) : 0} label={progress?.module ? `Asking the ${progress.module.toLowerCase()}` : 'Starting'} done={progress?.done} total={progress?.total} startedAt={scanStarted.current} />
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: space.lg }}>
            <Button label="Stop and keep what was found" variant="secondary" onPress={() => (stop.current = true)} />
          </View>
        </GlowCard>
      ) : !v.sensorScan ? (
        <GlowCard tone="brand">
          <View style={styles.heroRow}>
            <View style={[styles.heroIcon, { backgroundColor: t.accentSoft }]}>
              <Icon name="radar" size={30} color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.title3, { color: t.text }]}>Find my car’s sensors</Text>
              <Text style={[type.sub, { color: t.muted, marginTop: 2 }]}>
                Caristini asks each module about known maker sensors and keeps the ones your car answers.{shared.size ? ' Sensors your other cars and other owners found are asked first.' : ''}
              </Text>
            </View>
          </View>
        </GlowCard>
      ) : null}
      {!searching && !v.sensorScan ? (
        scanControls
      ) : searching ? null : (
        <>
          {!cat && !query ? (
            <GlowCard tone="ok">
              <View style={styles.heroRow}>
                <Text style={[styles.big, type.number, { color: t.text }]}>{mine.length}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[type.heading, { color: t.text }]}>sensors on this car</Text>
                  <Text style={[type.small, { color: t.muted }]}>
                    Searched {new Date(v.sensorScan!.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {v.sensorScan!.complete ? '' : ', more left to ask'}
                  </Text>
                </View>
                <Pill text="Live" tone="ok" icon="checkbox-blank-circle" />
              </View>
            </GlowCard>
          ) : null}
          <SearchField value={typed} onChange={setQuery} placeholder="Search sensors, for example oil or boost" />
          <View style={{ height: space.lg }} />
        </>
      )}

      {v.sensorScan && !searching && !cat && !query ? (
        <>
          {pinned.size ? (
            <Group header="Pinned" help={SECTIONS.sensorsPinned} footer="Pinned values refresh live here and show at the top of Live data.">
              {mine.filter((r) => pinned.has(sensorId(r))).map(row)}
            </Group>
          ) : null}
          <Group header="By system" help={SECTIONS.sensorsBySystem}>
            {counts.map(({ c, n }, i) => (
              <ListRow key={c} first={i === 0} icon={CATEGORY_ICON[c] as IconName} iconColour={CATEGORY_COLOUR[c]} title={c} value={String(n)} onPress={() => router.push({ pathname: '/sensors', params: { cat: c } })} />
            ))}
          </Group>
          {scanControls}
        </>
      ) : null}

      {(cat || query.trim()) && !searching ? (
        <Group header={query.trim() ? `${shown.length} matches in every system` : `${shown.length} sensors, most useful first`} help={SECTIONS.sensorsResults} footer="Values refresh while this page is open. Tap the star to pin a value to the top of Live data.">
          {shown.length ? visible.map(row) : <ListRow first title={query.trim() ? 'No sensor matches' : 'Nothing here yet'} subtitle={query.trim() ? 'Try another word, for example temp, pressure or gearbox.' : 'Run the search again to look for more.'} noChevron />}
          {shown.length > visible.length ? <ListRow icon="chevron-down" iconColour="blue" title={`Show ${Math.min(PAGE, shown.length - visible.length)} more`} subtitle={`${shown.length - visible.length} not shown`} onPress={() => setLimit((n) => n + PAGE)} noChevron /> : null}
        </Group>
      ) : null}

      <Text style={[type.caption, { color: t.faint, textAlign: 'center', marginTop: space.md }]}>Sensor definitions: OBDb project, CC BY-SA 4.0.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  heroIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1 },
  sensor: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: space.lg, gap: space.sm },
  moduleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: space.lg, gap: space.sm },
});
