import { Stack } from 'expo-router';
import { allowSleep, stayAwake } from '../keepAwake';
import { keepRunning, letStop } from '../background';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { aboutTime, addSample, afterQuick, DISCOVER_RANGES, DiscoverModule, Discovery, exploreStatus, fullSeconds, knownName, loadDiscovery, modulesToExplore, quickDone, quickExploreRanges, quickResume, rangeSize, readings, saveDiscovery } from '../discover';
import { routeFor, scanValueGroups } from '../learn/valueGroups';
import { groupName } from '../data/groupLabels';
import { sharedSensorKeys } from '../obd/sharedSensors';
import { sendLogNow } from '../share/sendLog';
import { sensorsForCar } from '../obd/sensors';
import { addHistory } from '../history';
import { ModuleDef } from '../obd/modules';
import { toHex } from '../obd/uds';
import { useSettings } from '../settings';
import { canSendAutomatically, sendBack } from '../share/sendBack';
import { useConnection } from '../state';
import { MONO, radius, space, type, useTheme } from '../theme';
import { Button, GlowCard, Group, Icon, ListRow, NeedsConnection, Notice, Pill, ProgressBar, ScanPulse, Screen, success, tap } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';
import { SECTIONS } from '../help';

// Discover: asks each module for every value number in the usual ranges and
// keeps whatever answers, named or not. Nothing is written to the car. The
// findings go back to be built into Caristini for every car of this kind.
export default function Discover() {
  const t = useTheme();
  const conn = useConnection();
  const { settings } = useSettings();
  const client = conn.client;
  const v = conn.vehicle;
  const group = v?.group ?? 'other';
  const ranges = DISCOVER_RANGES[group];
  const perModule = rangeSize(ranges);
  const garage = useGarage();
  // Values known for a module: public lists, the owner's other cars of the
  // same family, findings sent back. They decide the quick explore's blocks.
  const shared = useMemo(() => (v ? sharedSensorKeys(v, garage.vehicles) : new Set<string>()), [v, garage.vehicles]);
  const known = (def: ModuleDef) => [
    ...sensorsForCar(v, garage.vehicles).filter((r) => r.h === def.tx).map((r) => r.d),
    ...[...shared].filter((k) => k.startsWith(`${def.tx}-`)).map((k) => k.slice(def.tx.length + 1)),
  ];
  // Value numbers already asked on this module by the sensor search, or found.
  const skipFor = (def: ModuleDef, m: DiscoverModule) =>
    new Set([
      ...[...(v?.sensorsAsked ?? []), ...(v?.sensorsFound ?? [])].filter((k) => k.startsWith(`${def.tx}-`)).map((k) => k.slice(def.tx.length + 1)),
      ...Object.keys(m.found),
    ]);
  const startedAt = useRef(0);

  // Every module this make can have; only those that answered are offered (shown below).
  const [allDefs, setDefs] = useState<ModuleDef[] | null>(null);
  const [disc, setDisc] = useState<Discovery | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; did: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger' | 'info'; text: string } | null>(null);
  const stop = useRef(false);
  const alive = useRef(true);
  const discRef = useRef<Discovery | null>(null);
  discRef.current = disc;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);

  useEffect(() => {
    if (!client || !v) return;
    loadDiscovery(v.vin).then((d) => alive.current && setDisc(d));
    client.modulesForCar(group).then((list) => alive.current && setDefs(list.filter((d) => d.tx)));
  }, [client, v?.vin, group]);

  if (!client || !v) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to discover its values" />
      </Screen>
    );
  }

  // The car as saved now: Learn my car and the value group reads update it.
  const car = garage.get(v.vin) ?? v;
  const update = (fn: (d: Discovery) => Discovery) => {
    const next = fn(discRef.current ?? { vin: v.vin, started: Date.now(), updated: Date.now(), modules: {} });
    discRef.current = next;
    setDisc(next);
    return next;
  };
  const moduleOf = (def: ModuleDef): DiscoverModule => disc?.modules[def.id] ?? { id: def.id, name: def.name, tx: def.tx, rx: def.rx, found: {} };

  // Learn my car's quick explore and this one are the same, in the same
  // store: either carries on where the other stopped.
  const quickKey = (def: ModuleDef) => JSON.stringify(quickExploreRanges(def.tx, known(def)));
  const older = (def: ModuleDef) => routeFor(client, car, def) === 'tp20';
  const sweep = async (list: ModuleDef[], mode: 'quick' | 'full' = 'quick') => {
    stop.current = false;
    setMessage(null);
    stayAwake('discover');
    void keepRunning('discover');
    let finished = false;
    try {
      for (const def of list) {
        if (stop.current || !alive.current) break;
        const m = moduleOf(def);
        // Older VW modules: their values come in numbered value groups, read
        // and kept the way Learn my car reads them.
        if (older(def)) {
          if ((garage.latest(v.vin)?.groupsScanned ?? []).includes(def.id)) continue;
          setRunning(def.id);
          setOpen(def.id);
          startedAt.current = Date.now();
          setProgress(null);
          await client.holdOlder(() =>
            scanValueGroups(client, garage, v.vin, def, {
              cancelled: () => stop.current || !alive.current,
              onProgress: (p) => alive.current && setProgress({ did: -1, done: Math.round(p * 1000), total: 1000 }),
            }),
          );
          continue;
        }
        const key = quickKey(def);
        if (m.finished || (mode === 'quick' && quickDone(m, key))) continue;
        setRunning(def.id);
        setOpen(def.id);
        startedAt.current = Date.now();
        setProgress(null);
        let lastSave = Date.now();
        const res = await client.discoverDids(def, mode === 'quick' ? quickExploreRanges(def.tx, known(def)) : ranges, {
          // Both resume where they paused (the quick one where Learn my car
          // stopped too); both skip what was asked.
          startAt: mode === 'full' ? m.nextDid : quickResume(m, key),
          skip: skipFor(def, m),
          cancelled: () => stop.current || !alive.current,
          onProgress: (did, done, total) => {
            if (alive.current) setProgress({ did, done, total });
            if (mode === 'full') update((d) => ({ ...d, modules: { ...d.modules, [def.id]: { ...(d.modules[def.id] ?? m), nextDid: did } } }));
            if (Date.now() - lastSave > 8000) {
              lastSave = Date.now();
              if (discRef.current) saveDiscovery(discRef.current);
            }
          },
          onFound: (did, data) =>
            update((d) => {
              const mod = d.modules[def.id] ?? m;
              return { ...d, modules: { ...d.modules, [def.id]: { ...mod, found: { ...mod.found, [did]: addSample(mod.found[did], toHex(data)) } } } };
            }),
        });
        const silent = !res.finished && res.lastDid == null;
        const next = update((d) => ({
          ...d,
          modules: {
            ...d.modules,
            [def.id]:
              mode === 'quick'
                ? afterQuick(d.modules[def.id] ?? m, key, res)
                : { ...(d.modules[def.id] ?? m), finished: res.finished, silent, nextDid: res.lastDid ?? m.nextDid },
          },
        }));
        await saveDiscovery(next);
        const count = Object.keys(next.modules[def.id]?.found ?? {}).length;
        if (res.finished) {
          await addHistory({ vin: v.vin, kind: 'discover', title: `${def.name}: ${count} value${count === 1 ? '' : 's'} found`, detail: 'Discover sweep finished' });
          if (await canSendAutomatically()) {
            const r = await sendBack('discover', v.vin, { car: { title: vehicleTitle(v), brand: v.brand, model: v.model, year: v.year, platform: v.platform }, module: next.modules[def.id] });
            if (r.via === 'github') update((d) => ({ ...d, sentAt: Date.now() }));
          }
        }
      }
      success();
      finished = true;
    } catch (e) {
      if (alive.current) setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      allowSleep('discover');
      letStop('discover', finished);
      void sendLogNow(`Discover ${mode} explore`, v);
      if (discRef.current) await saveDiscovery(discRef.current);
      if (alive.current) {
        setRunning(null);
        setProgress(null);
      }
    }
  };

  // Reads every value found on one module again, to see which ones move.
  const sampleAgain = async (def: ModuleDef) => {
    const m = moduleOf(def);
    setRunning(`sample-${def.id}`);
    try {
      const got = await client.sampleDids(def, Object.keys(m.found));
      const next = update((d) => {
        const mod = d.modules[def.id] ?? m;
        const found = { ...mod.found };
        for (const [did, data] of Object.entries(got)) found[did] = addSample(found[did], toHex(data));
        return { ...d, modules: { ...d.modules, [def.id]: { ...mod, found } } };
      });
      await saveDiscovery(next);
      const moving = Object.values(next.modules[def.id]?.found ?? {}).filter((f) => f.moves).length;
      setMessage({ tone: 'info', text: `${moving} ${moving === 1 ? 'value has' : 'values have'} changed so far. Rev the engine, switch something on or drive, then sample again.` });
    } finally {
      if (alive.current) setRunning(null);
    }
  };

  const rename = (def: ModuleDef, did: string, label: string) => {
    const next = update((d) => {
      const mod = d.modules[def.id];
      return { ...d, modules: { ...d.modules, [def.id]: { ...mod, found: { ...mod.found, [did]: { ...mod.found[did], label } } } } };
    });
    saveDiscovery(next);
  };

  const send = async () => {
    if (!disc) return;
    setRunning('send');
    try {
      const r = await sendBack('discover', v.vin, { car: { title: vehicleTitle(v), brand: v.brand, model: v.model, year: v.year, platform: v.platform }, discovery: disc }, { allowManual: true, email: settings.sendTo || undefined });
      if (r.via !== 'none') update((d) => ({ ...d, sentAt: Date.now() }));
      setMessage({ tone: r.via === 'none' ? 'danger' : 'ok', text: r.detail });
      if (discRef.current) saveDiscovery(discRef.current);
    } finally {
      if (alive.current) setRunning(null);
    }
  };

  const totalFound = Object.values(disc?.modules ?? {}).reduce((n, m) => n + Object.keys(m.found).length, 0);
  const statusOf = (def: ModuleDef) =>
    exploreStatus(disc?.modules[def.id], {
      key: quickKey(def),
      older: older(def),
      groups: car.groupsFound?.[def.id],
      groupsDone: (car.groupsScanned ?? []).includes(def.id),
      groupsStarted: car.groupsResume?.[def.id] != null,
    });
  // Only the modules that answered the last health check (all of them before one has run).
  const checked = !!v.modulesSeen?.length;
  // Modules that answered the last health check, older VW modules it found,
  // and modules with value groups or values found before.
  const seen = [...new Set([...(car.modulesSeen ?? []), ...(car.deepFound ?? []).map((d) => d.moduleId), ...Object.keys(car.groupsFound ?? {})])];
  const defs = allDefs ? modulesToExplore(allDefs, seen.length ? seen : undefined, disc) : null;
  // Every module here speaks the older VW protocol: value groups only.
  const allOlder = !!defs?.length && defs.every(older);
  const perModuleTime = aboutTime(fullSeconds(perModule));
  // Full explore of every module listed that has not finished yet (older
  // VW modules have value groups instead).
  const left = (defs ?? []).filter((d) => !older(d) && !disc?.modules[d.id]?.finished).length;
  const fullTime = left ? aboutTime(fullSeconds(perModule) * left) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Unknown values' }} />
      {message ? <Notice tone={message.tone} icon={message.tone === 'danger' ? 'alert-circle-outline' : 'information-outline'} text={message.text} /> : null}

      {running && !running.startsWith('sample') && running !== 'send' ? (
        <GlowCard tone="brand" style={{ alignItems: 'center' }}>
          <ScanPulse active size={120} />
          <Text style={[type.title3, { color: t.text, marginTop: space.md }]}>Exploring {defs?.find((d) => d.id === running)?.name ?? 'the module'}</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: 4, marginBottom: space.lg }]}>
            {(() => {
              const def = defs?.find((d) => d.id === running);
              return def && older(def) ? statusOf(def).text.replace(/, carries on$/, '') : `${Object.keys(disc?.modules[running]?.found ?? {}).length} values found`;
            })()}
            . Ignition on; running the engine keeps the battery up.
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <ProgressBar
              value={progress ? progress.done / progress.total : 0}
              label={progress ? (progress.did < 0 ? 'Reading value groups' : `Asking value ${progress.did.toString(16).toUpperCase().padStart(4, '0')}`) : 'Saying hello'}
              done={progress?.done}
              total={progress?.total}
              startedAt={startedAt.current}
            />
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: space.lg }}>
            <Button label="Pause" variant="secondary" icon="pause" onPress={() => (stop.current = true)} />
          </View>
        </GlowCard>
      ) : (
        <GlowCard tone="brand">
          <View style={styles.heroRow}>
            <View style={[styles.heroIcon, { backgroundColor: t.accentSoft }]}>
              <Icon name="telescope" size={30} color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.title3, { color: t.text }]}>{allOlder ? 'Read every value group' : "Explore a module's unknown values"}</Text>
              <Text style={[type.sub, { color: t.muted, marginTop: 2 }]}>
                {allOlder
                  ? 'This car’s modules give their values in numbered value groups. Learn my car reads them too, and both keep the same list and carry on from the same place. Read-only.'
                  : `Quick explore asks the values near ones already known: a few minutes a module. Full explore asks all ${perModule.toLocaleString('en-GB')} value numbers, ${perModuleTime} a module. Learn my car runs the quick explore too, and both carry on from the same place. Read-only.`}
              </Text>
            </View>
          </View>
          <Button label={allOlder ? 'Read value groups in every module' : 'Quick explore every module'} icon="lightning-bolt" disabled={!defs?.length} onPress={() => defs && sweep(defs, 'quick')} />
          {allOlder ? null : <View style={{ marginTop: space.sm }}>
            <Button label={totalFound ? 'Full explore (carries on)' : 'Full explore every module'} icon="play" variant="secondary" disabled={!defs?.length} onPress={() => defs && sweep(defs, 'full')} />
            {fullTime ? (
              <Text style={[type.small, { color: t.muted, marginTop: 4, textAlign: 'center' }]}>
                {left} module{left === 1 ? '' : 's'}: {fullTime} in all
              </Text>
            ) : null}
          </View>}
          {totalFound ? (
            <View style={{ marginTop: space.sm }}>
              <Button label={disc?.sentAt ? 'Send findings again' : 'Send findings to build in'} icon="share-variant" variant="secondary" busy={running === 'send'} onPress={send} />
            </View>
          ) : null}
        </GlowCard>
      )}

      <Group
        header="Modules"
        help={SECTIONS.discoverModules}
        footer={`${checked ? 'The modules that answered your last health check.' : 'Every module this make can have. Run a health check to list only the ones on your car.'}${(defs ?? []).some(older) ? ' Older VW modules give their values in numbered value groups; Live data shows them.' : ''} ${disc?.sentAt ? `Findings last sent ${new Date(disc.sentAt).toLocaleString('en-GB')}.` : 'Findings are kept on this phone until you send them.'}`}
      >
        {(defs ?? []).map((def, i) => {
          const st = statusOf(def);
          const isOlder = older(def);
          const shown = open === def.id;
          const mod = shown ? moduleOf(def) : null;
          const entries = mod ? Object.entries(mod.found).sort(([a], [b]) => a.localeCompare(b)) : [];
          return (
            <View key={def.id}>
              <ListRow
                first={i === 0}
                icon={st.state === 'done' ? 'check-circle' : st.state === 'silent' ? 'close-circle' : 'chip'}
                iconColour={st.state === 'done' ? 'green' : st.state === 'silent' ? 'grey' : st.state === 'partial' ? 'orange' : 'indigo'}
                title={`${def.code && group === 'vag' ? `${def.code} · ` : ''}${def.name}`}
                subtitle={st.text}
                right={<Icon name={shown ? 'chevron-up' : 'chevron-down'} size={13} color={t.faint} />}
                noChevron
                onPress={() => setOpen(shown ? null : def.id)}
              />
              {/* Opens in place, under the module tapped. */}
              {mod && isOlder ? (
                <View style={{ backgroundColor: t.sunken, padding: space.lg, gap: space.sm }}>
                  {!(car.groupsScanned ?? []).includes(def.id) ? (
                    <Button label={car.groupsResume?.[def.id] != null ? 'Carry on reading value groups' : 'Read value groups'} icon="play" disabled={!!running} onPress={() => sweep([def])} />
                  ) : null}
                  {Object.entries(car.groupsFound?.[def.id] ?? {})
                    .filter(([, units]) => units.length)
                    .map(([g, units]) => (
                      <Text key={g} style={[type.small, { color: t.text }]}>
                        {groupName(def.code, Number(g))}: {units.length} value{units.length === 1 ? '' : 's'}
                      </Text>
                    ))}
                  <Text style={[type.small, { color: t.muted }]}>This module speaks the older VW protocol, so its values come in numbered value groups. Watch them live in Live data, under Older VW modules.</Text>
                </View>
              ) : mod ? (
                <View style={{ backgroundColor: t.sunken }}>
                  <View style={{ padding: space.lg, gap: space.sm }}>
                    {!quickDone(mod, quickKey(def)) ? <Button label="Quick explore this module" icon="lightning-bolt" disabled={!!running} onPress={() => sweep([def], 'quick')} /> : null}
                    {!mod.finished ? <Button label={mod.nextDid != null ? 'Carry on: full explore' : 'Full explore this module'} icon="play" variant="secondary" disabled={!!running} onPress={() => sweep([def], 'full')} /> : null}
                    {entries.length ? <Button label="Sample again" icon="refresh" variant="secondary" busy={running === `sample-${def.id}`} disabled={!!running} onPress={() => sampleAgain(def)} /> : null}
                    {!entries.length ? (
                      <Text style={[type.small, { color: t.muted }]}>{mod.silent ? 'This module did not answer.' : 'No values found here yet. Explore it to look for values.'}</Text>
                    ) : (
                      <Text style={[type.small, { color: t.muted }]}>Named values are already in Caristini's lists. Moving values change between samples and are most likely sensors. Tap one for its readings.</Text>
                    )}
                  </View>
                  {entries.map(([did, f]) => (
                    <FoundRow key={did} did={did} f={f} known={knownName(group, def.tx, did)} onName={(l) => rename(def, did, l)} />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
        {defs && !defs.length ? <ListRow first title="No modules to explore" subtitle="Module access needs a CAN car." noChevron /> : null}
      </Group>

    </Screen>
  );
}

function FoundRow({ did, f, known, onName }: { did: string; f: { samples: string[]; moves?: boolean; label?: string; guess?: string }; known: string | null; onName: (l: string) => void }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(f.label ?? '');
  const last = f.samples[f.samples.length - 1] ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        setExpanded(!expanded);
      }}
      style={[styles.found, { borderColor: t.border }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={[type.heading, { color: t.text, fontFamily: MONO }]}>{did}</Text>
        <Text style={[type.sub, { color: known || f.label ? t.text : t.muted, flex: 1 }]} numberOfLines={1}>
          {f.label || known || 'Unknown value'}
        </Text>
        {f.moves ? <Pill text="Moves" tone="ok" /> : null}
      </View>
      <Text selectable style={[type.small, { color: t.muted, fontFamily: MONO, marginTop: 2 }]} numberOfLines={expanded ? undefined : 1}>
        {(last.match(/../g) ?? []).join(' ') || '(empty)'}
      </Text>
      {expanded ? (
        <View style={{ marginTop: space.sm, gap: 4 }}>
          {f.samples.length > 1 ? <Text style={[type.small, { color: t.muted }]}>Samples: {f.samples.join(' · ')}</Text> : null}
          {readings(last).map((r) => (
            <Text key={r} style={[type.small, { color: t.text }]}>• {r}</Text>
          ))}
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => onName(name.trim())}
            onBlur={() => onName(name.trim())}
            placeholder="Name it if you know what it is"
            placeholderTextColor={t.muted}
            style={[type.body, styles.input, { backgroundColor: t.sunken, color: t.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  heroIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  found: { paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  input: { borderRadius: radius.sm + 2, paddingHorizontal: space.md, paddingVertical: 10, marginTop: space.sm },
});
