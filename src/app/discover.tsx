import { Stack } from 'expo-router';
import { allowSleep, stayAwake } from '../keepAwake';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { askClaude, hasClaude } from '../ai/claude';
import { addSample, DISCOVER_RANGES, DiscoverModule, Discovery, knownName, loadDiscovery, quickRanges, rangeSize, readings, saveDiscovery } from '../discover';
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

  const [defs, setDefs] = useState<ModuleDef[] | null>(null);
  const [disc, setDisc] = useState<Discovery | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; did: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger' | 'info'; text: string } | null>(null);
  const [ai, setAi] = useState(false);
  const stop = useRef(false);
  const alive = useRef(true);
  const discRef = useRef<Discovery | null>(null);
  discRef.current = disc;

  useEffect(() => {
    alive.current = true;
    hasClaude().then(setAi);
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

  const update = (fn: (d: Discovery) => Discovery) => {
    const next = fn(discRef.current ?? { vin: v.vin, started: Date.now(), updated: Date.now(), modules: {} });
    discRef.current = next;
    setDisc(next);
    return next;
  };
  const moduleOf = (def: ModuleDef): DiscoverModule => disc?.modules[def.id] ?? { id: def.id, name: def.name, tx: def.tx, rx: def.rx, found: {} };

  const sweep = async (list: ModuleDef[], mode: 'quick' | 'full' = 'quick') => {
    stop.current = false;
    setMessage(null);
    stayAwake('discover');
    try {
      for (const def of list) {
        if (stop.current || !alive.current) break;
        const m = moduleOf(def);
        if (m.finished || (mode === 'quick' && m.quickDone)) continue;
        setRunning(def.id);
        setOpen(def.id);
        startedAt.current = Date.now();
        setProgress(null);
        let lastSave = Date.now();
        const res = await client.discoverDids(def, mode === 'quick' ? quickRanges(known(def)) : ranges, {
          // The full explore resumes where it paused; both skip what was asked.
          startAt: mode === 'full' ? m.nextDid : undefined,
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
                ? { ...(d.modules[def.id] ?? m), quickDone: res.finished || silent, silent }
                : { ...(d.modules[def.id] ?? m), finished: res.finished, silent, nextDid: res.lastDid ?? m.nextDid },
          },
        }));
        await saveDiscovery(next);
        const count = Object.keys(next.modules[def.id]?.found ?? {}).length;
        if (res.finished) {
          await addHistory({ vin: v.vin, kind: 'discover', title: `${def.name}: ${count} values found`, detail: 'Discover sweep finished' });
          if (await canSendAutomatically()) {
            const r = await sendBack('discover', v.vin, { car: { title: vehicleTitle(v), brand: v.brand, model: v.model, year: v.year, platform: v.platform }, module: next.modules[def.id] });
            if (r.via === 'github') update((d) => ({ ...d, sentAt: Date.now() }));
          }
        }
      }
      success();
    } catch (e) {
      if (alive.current) setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      allowSleep('discover');
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
      setMessage({ tone: 'info', text: `${moving} values have changed so far. Rev the engine, switch something on or drive, then sample again.` });
    } finally {
      if (alive.current) setRunning(null);
    }
  };

  const guess = async (def: ModuleDef, did: string) => {
    const f = moduleOf(def).found[did];
    if (!f) return;
    setRunning(`ai-${did}`);
    try {
      const answer = await askClaude(
        `A ${vehicleTitle(v)} (${v.year ?? 'year unknown'}, ${v.platform ?? v.brand}) answered UDS ReadDataByIdentifier 22 ${did} on module "${def.name}" (request ID ${def.tx}). Samples, oldest first, hex: ${f.samples.join(', ')}. ${f.moves ? 'The value changes.' : 'The value did not change between samples.'} In one line, say what this most likely is and how to decode it (byte positions, scale, offset, unit). Say "Unknown" if there is no reasonable guess. Do not invent certainty.`,
        { maxTokens: 160 },
      );
      const next = update((d) => {
        const mod = d.modules[def.id];
        return { ...d, modules: { ...d.modules, [def.id]: { ...mod, found: { ...mod.found, [did]: { ...mod.found[did], guess: answer.trim() } } } } };
      });
      await saveDiscovery(next);
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
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
  const minutes = Math.round((perModule * 0.07) / 60);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Unknown values' }} />
      {message ? <Notice tone={message.tone} icon={message.tone === 'danger' ? 'alert-circle-outline' : 'information-outline'} text={message.text} /> : null}

      {running && !running.startsWith('sample') && !running.startsWith('ai') && running !== 'send' ? (
        <GlowCard tone="brand" style={{ alignItems: 'center' }}>
          <ScanPulse active size={120} />
          <Text style={[type.title3, { color: t.text, marginTop: space.md }]}>Exploring {defs?.find((d) => d.id === running)?.name ?? 'the module'}</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: 4, marginBottom: space.lg }]}>
            {Object.keys(disc?.modules[running]?.found ?? {}).length} values found. Ignition on; running the engine keeps the battery up.
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <ProgressBar
              value={progress ? progress.done / progress.total : 0}
              label={progress ? `Asking value ${progress.did.toString(16).toUpperCase().padStart(4, '0')}` : 'Saying hello'}
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
              <Text style={[type.title3, { color: t.text }]}>Explore a module's unknown values</Text>
              <Text style={[type.sub, { color: t.muted, marginTop: 2 }]}>
                Asks each module for all {perModule.toLocaleString('en-GB')} value numbers where makers keep sensors, about {minutes} minutes a module. Read-only. Pause any time and carry on later.
              </Text>
            </View>
          </View>
          <Button label="Quick explore every module" icon="lightning-bolt" disabled={!defs?.length} onPress={() => defs && sweep(defs, 'quick')} />
          <View style={{ marginTop: space.sm }}>
            <Button label={totalFound ? 'Full explore (carries on)' : 'Full explore every module'} icon="play" variant="secondary" disabled={!defs?.length} onPress={() => defs && sweep(defs, 'full')} />
          </View>
          {totalFound ? (
            <View style={{ marginTop: space.sm }}>
              <Button label={disc?.sentAt ? 'Send findings again' : 'Send findings to build in'} icon="share-variant" variant="secondary" busy={running === 'send'} onPress={send} />
            </View>
          ) : null}
        </GlowCard>
      )}

      <Group header="Modules" help={SECTIONS.discoverModules} footer={disc?.sentAt ? `Findings last sent ${new Date(disc.sentAt).toLocaleString('en-GB')}.` : 'Findings are kept on this phone until you send them.'}>
        {(defs ?? []).map((def, i) => {
          const m = disc?.modules[def.id];
          const n = Object.keys(m?.found ?? {}).length;
          const moving = Object.values(m?.found ?? {}).filter((f) => f.moves).length;
          const status = m?.finished ? `${n} values, ${moving} moving` : m?.silent ? 'Did not answer' : m?.nextDid != null ? `${n} found, paused` : 'Not explored yet';
          const shown = open === def.id;
          const mod = shown ? moduleOf(def) : null;
          const entries = mod ? Object.entries(mod.found).sort(([a], [b]) => a.localeCompare(b)) : [];
          return (
            <View key={def.id}>
              <ListRow
                first={i === 0}
                icon={m?.finished ? 'check-circle' : m?.silent ? 'close-circle' : 'chip'}
                iconColour={m?.finished ? 'green' : m?.silent ? 'grey' : 'indigo'}
                title={`${def.code && group === 'vag' ? `${def.code} · ` : ''}${def.name}`}
                subtitle={status}
                right={<Icon name={shown ? 'chevron-up' : 'chevron-down'} size={13} color={t.faint} />}
                noChevron
                onPress={() => setOpen(shown ? null : def.id)}
              />
              {/* Opens in place, under the module tapped. */}
              {mod ? (
                <View style={{ backgroundColor: t.sunken }}>
                  <View style={{ padding: space.lg, gap: space.sm }}>
                    {!mod.quickDone && !mod.finished ? <Button label="Quick explore this module" icon="lightning-bolt" disabled={!!running} onPress={() => sweep([def], 'quick')} /> : null}
                    {!mod.finished ? <Button label={mod.nextDid != null ? 'Carry on: full explore' : 'Full explore this module'} icon="play" variant="secondary" disabled={!!running} onPress={() => sweep([def], 'full')} /> : null}
                    {entries.length ? <Button label="Sample again" icon="refresh" variant="secondary" busy={running === `sample-${def.id}`} disabled={!!running} onPress={() => sampleAgain(def)} /> : null}
                    {!entries.length ? (
                      <Text style={[type.small, { color: t.muted }]}>{mod.silent ? 'This module did not answer.' : 'No values found here yet. Explore it to look for values.'}</Text>
                    ) : (
                      <Text style={[type.small, { color: t.muted }]}>Named values are already in Caristini's lists. Moving values change between samples and are most likely sensors. Tap one for its readings.</Text>
                    )}
                  </View>
                  {entries.map(([did, f]) => (
                    <FoundRow key={did} did={did} f={f} known={knownName(group, def.tx, did)} ai={ai} busy={running === `ai-${did}`} onAsk={() => guess(def, did)} onName={(l) => rename(def, did, l)} />
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

function FoundRow({ did, f, known, ai, busy, onAsk, onName }: { did: string; f: { samples: string[]; moves?: boolean; label?: string; guess?: string }; known: string | null; ai: boolean; busy: boolean; onAsk: () => void; onName: (l: string) => void }) {
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
      {f.guess ? <Text style={[type.small, { color: t.accentText, marginTop: 4 }]}>AI guess: {f.guess}</Text> : null}
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
          {ai ? <Button label="Ask AI what it is" icon="creation" variant="ghost" busy={busy} onPress={onAsk} /> : null}
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
