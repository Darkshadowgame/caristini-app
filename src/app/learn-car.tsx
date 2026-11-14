import { router, Stack } from 'expo-router';
import { allowSleep, stayAwake } from '../keepAwake';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { hasClaude } from '../ai/claude';
import { ModuleFacts, nameValues, researchModule } from '../ai/research';
import { addSample, knownName, loadDiscovery, saveDiscovery } from '../discover';
import { addHistory } from '../history';
import { ModuleDef } from '../obd/modules';
import { readKey, sameFamily, sensorsForCar, SensorRow } from '../obd/sensors';
import { quickRows, remainingRows, sharedSensorKeys } from '../obd/sharedSensors';
import { toHex } from '../obd/uds';
import { sendBack } from '../share/sendBack';
import { sendLogNow } from '../share/sendLog';
import { useConnection } from '../state';
import { space, type, useTheme } from '../theme';
import { Button, GlowCard, Group, Icon, IconName, ListRow, NeedsConnection, Notice, Pill, ProgressBar, ScanPulse, Screen, success } from '../ui';
import { inferredFromParts, useGarage, Vehicle, vehicleTitle } from '../vehicle/garage';
import { SECTIONS } from '../help';
import { mergeModuleIds } from '../vehicle/ids';

type Step = 'modules' | 'sensors' | 'values' | 'research' | 'send';
const STEPS: { key: Step; title: string; icon: IconName; detail: string }[] = [
  { key: 'modules', title: 'Find every module', icon: 'chip', detail: 'Reads each module’s part number, software and coding. Uses the modules your health check found; with none, it asks every address. Works on any make.' },
  { key: 'sensors', title: 'Find my car’s sensors', icon: 'radar' as IconName, detail: 'Tries every sensor the public lists know for this kind of car.' },
  { key: 'values', title: 'Explore unknown values', icon: 'telescope' as IconName, detail: 'Sweeps each module for values no list knows yet, and reads them twice to see which ones move.' },
  { key: 'research', title: 'Let the AI work it out', icon: 'creation' as IconName, detail: 'Claude looks up each part number on the web, names the unknown values from how they behave, and finds settings owners have published.' },
  { key: 'send', title: 'Save and share', icon: 'cloud-upload-outline' as IconName, detail: 'Keeps a knowledge base for this car and sends it back to be built in for everyone.' },
];

// Value numbers swept per module in Learn my car: where measured values live
// in public lists for every maker. Discover covers far wider ranges.
const QUICK_RANGES: [number, number][] = [
  [0x1000, 0x11ff],
  [0xf400, 0xf4ff],
];

// Learn my car: one button that finds every module and value on any car and
// (with a Claude key) has the AI work out what they are.
export default function LearnCar() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const client = conn.client;
  const v = conn.vehicle;
  const [running, setRunning] = useState<Step | null>(null);
  const [done, setDone] = useState<Step[]>([]);
  const [progress, setProgress] = useState<{ value: number; label: string }>({ value: 0, label: '' });
  const [ai, setAi] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger' | 'info'; text: string } | null>(null);
  const stop = useRef(false);
  const [stopping, setStopping] = useState(false);
  const learnStarted = useRef(0);
  // When the step on screen began, for the time left on its progress bar.
  const stepStarted = useRef(0);
  // Ask every diagnostic address too, even when the car's modules are known.
  const [probeAll, setProbeAll] = useState(false);
  const alive = useRef(true);
  const vRef = useRef<Vehicle | undefined>(v ?? undefined);
  vRef.current = v ?? undefined;

  useEffect(() => {
    alive.current = true;
    hasClaude().then(setAi);
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);

  if (!client || !v) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to learn it" />
      </Screen>
    );
  }

  const halted = () => stop.current || !alive.current;

  const run = async () => {
    stop.current = false;
    setStopping(false);
    learnStarted.current = Date.now();
    setMessage(null);
    setDone([]);
    stayAwake('learn');
    const knowledge = { ...(v.knowledge ?? {}) };
    const facts: (ModuleFacts & { tx: string; rx: string })[] = [];
    let sensorsCount = 0;
    let researched = 0;
    let aiItems = [...(v.aiItems ?? [])];
    let aiSensors: SensorRow[] = [...(v.aiSensors ?? [])];
    const found = new Set(v.sensorsFound ?? []);
    // Everything already asked on this car, by the sensor search or Learn my car.
    const asked = new Set([...(v.sensorsAsked ?? []), ...found]);
    const all = sensorsForCar(v, garage.vehicles);
    let reused = 0;
    try {
      // 1. Modules: the known list for this make, plus every address that answers.
      stepStarted.current = Date.now();
      setRunning('modules');
      // The car must be answering before anything is learned: with the ignition
      // off, modules behind the gateway stay silent and would be saved as missing.
      if (!(await client.carAwake())) throw new Error('The car is not answering. Switch the ignition on (engine running is best) and run Learn my car again. Nothing was changed.');
      const listed = v.group === 'other' ? [] : await client.modulesForCar(v.group);
      client.rememberModules(v.modulesSeen);
      // Every address is asked only when the car's modules are not known yet
      // (no health check has run), or when asked for: it takes about 2 minutes.
      const known = new Set(v.modulesSeen ?? []);
      const askAll = probeAll || known.size < 3;
      let probed: ModuleDef[] = [];
      if (askAll) {
        setProgress({ value: 0, label: 'Asking every address who is there' });
        probed = await client.findAnyModules({ cancelled: halted, onProgress: (d, n) => alive.current && setProgress({ value: (d / n) * 0.5, label: `Checking address ${d + 1} of ${n}` }) });
      }
      // Modules that answered before go first; ones never seen are asked last.
      const everyDef: ModuleDef[] = [...listed, ...probed.filter((p) => !listed.some((l) => l.id === p.id))];
      const defs = [...everyDef.filter((d) => known.has(d.id)), ...everyDef.filter((d) => !known.has(d.id))];
      const read: Awaited<ReturnType<NonNullable<typeof client>['readModuleDetails']>>[] = [];
      for (const [i, def] of defs.entries()) {
        if (halted()) break;
        setProgress({ value: (askAll ? 0.5 : 0) + (i / defs.length) * (askAll ? 0.5 : 1), label: `Asking ${def.name.toLowerCase()}` });
        let d = await client.readModuleDetails(def).catch(() => null);
        // A module that answered before gets a second ask after a short wait:
        // one missed reply must not write it off.
        if (!d?.responded && known.has(def.id) && !halted()) {
          await new Promise((r) => setTimeout(r, 1200));
          d = await client.readModuleDetails(def).catch(() => null);
        }
        if (!d?.responded) continue;
        read.push(d);
        const coding = d.coding ?? (await client.readCoding(def).then((c) => (c ? toHex(c) : null)).catch(() => null));
        facts.push({ id: def.id, name: def.name, code: def.code, part: d.partNumber, software: d.software, system: d.systemName, coding, route: d.route ?? null, tx: def.tx, rx: def.rx });
        knowledge[def.id] = { plainName: knowledge[def.id]?.plainName ?? def.name, what: knowledge[def.id]?.what ?? '', notes: knowledge[def.id]?.notes, part: d.partNumber, at: Date.now() };
      }
      // Fewer than half the modules a health check found answered: the car went
      // quiet (ignition off, low battery). Stop here and keep the earlier results.
      const answeredKnown = facts.filter((f) => known.has(f.id)).length;
      if (!halted() && known.size >= 4 && answeredKnown < known.size / 2) {
        void sendLogNow('Learn my car: modules silent', v);
        throw new Error(`Only ${answeredKnown} of the ${known.size} modules your health check found answered this time, so nothing was saved over your earlier results. Check the ignition is on (engine running is best), then run Learn my car again.`);
      }
      const savedIds = garage.latest(v.vin)?.ids;
      await garage.update(v.vin, { knowledge, ids: { ...(savedIds ?? {}), modules: mergeModuleIds(savedIds?.modules, read) } });
      // A car that gave no VIN: model and platform from its part numbers.
      const now = garage.latest(v.vin);
      const fill = now ? inferredFromParts(now) : null;
      if (fill) await garage.update(v.vin, fill);
      setDone((x) => [...x, 'modules']);
      // The log goes after each step: one run writes more lines than the log holds.
      void sendLogNow('Learn my car: modules', v);

      // 2. Known sensors (skipped when a full search already ran).
      if (!halted()) {
        stepStarted.current = Date.now();
        setRunning('sensors');
        if (all.length && !vRef.current?.sensorScan?.complete) {
          // A family other cars already taught Caristini gets the quick check
          // of those sensors only; the full search stays on All sensors and
          // skips whatever was asked here.
          const shared = sharedSensorKeys(v, garage.vehicles);
          const rows = shared.size ? quickRows(all, shared, asked) : remainingRows(all, asked);
          if (rows.length) {
            await client.probeSensors(rows, {
              cancelled: halted,
              onProgress: (d, n, m) => alive.current && setProgress({ value: n ? d / n : 1, label: m ? `Asking the ${m.toLowerCase()}` : '' }),
              onFound: (k) => found.add(k),
              onAsked: (k) => asked.add(k),
            });
          }
          const complete = !halted() && remainingRows(all, asked).length === 0;
          await garage.update(v.vin, { sensorsFound: [...found], sensorsAsked: [...asked], sensorScan: { at: Date.now(), asked: asked.size, complete, quick: !complete && shared.size > 0 } });
        }
        sensorsCount = all.filter((r) => found.has(readKey(r))).length;
        setDone((x) => [...x, 'sensors']);
        void sendLogNow('Learn my car: sensors', v);
      }

      // 3. Unknown values: a quick sweep of every UDS module, then a second read.
      const disc = await loadDiscovery(v.vin);
      if (!halted()) {
        stepStarted.current = Date.now();
        setRunning('values');
        const uds = facts.filter((f) => f.tx && f.route !== 'tp20');
        for (const [i, f] of uds.entries()) {
          if (halted()) break;
          const def = client.moduleById(f.id) ?? { id: f.id, name: f.name, tx: f.tx, rx: f.rx, groups: [], source: 'Found by probing' };
          const mod = disc.modules[f.id] ?? { id: f.id, name: f.name, tx: f.tx, rx: f.rx, found: {} };
          // Not asked again: values the sensor search already asked on this
          // module, and values an earlier sweep found (read again below).
          const skip = new Set([...[...asked].filter((k) => k.startsWith(`${f.tx}-`)).map((k) => k.slice(f.tx.length + 1)), ...Object.keys(mod.found)]);
          await client.discoverDids(def, QUICK_RANGES, {
            skip,
            cancelled: halted,
            onProgress: (_d, n, total) => alive.current && setProgress({ value: (i + n / total) / uds.length, label: `Exploring ${f.name.toLowerCase()}` }),
            onFound: (did, data) => {
              mod.found[did] = addSample(mod.found[did], toHex(data));
            },
          });
          // A second read a moment later shows which values are live.
          const again = await client.sampleDids(def, Object.keys(mod.found));
          for (const [did, data] of Object.entries(again)) mod.found[did] = addSample(mod.found[did], toHex(data));
          disc.modules[f.id] = mod;
          await saveDiscovery(disc);
        }
        setDone((x) => [...x, 'values']);
        void sendLogNow('Learn my car: values', v);
      }

      // 4. AI: what each module is, names for unknown values, published settings.
      if (!halted() && ai) {
        stepStarted.current = Date.now();
        setRunning('research');
        const car = { title: vehicleTitle(v), year: v.year, platform: v.platform, vin: v.vin };
        for (const [i, f] of facts.entries()) {
          if (halted()) break;
          setProgress({ value: i / facts.length, label: `Working out ${f.name.toLowerCase()}` });
          try {
            // The same part on another of the owner's cars was already worked
            // out: reuse it, and its settings when the platform matches.
            const same = f.part
              ? garage.vehicles
                  .filter((o) => o.vin !== v.vin && sameFamily(o, v))
                  .flatMap((o) => Object.entries(o.knowledge ?? {}).filter(([, k]) => k.part === f.part && k.what).map(([id, k]) => ({ o, id, k })))[0]
              : undefined;
            if (same) {
              knowledge[f.id] = { ...same.k, at: Date.now() };
              if (v.group === 'vag' && same.o.platform === v.platform) aiItems = [...aiItems.filter((x) => x.module !== f.id), ...(same.o.aiItems ?? []).filter((x) => x.module === same.id).map((x) => ({ ...x, module: f.id }))];
              reused++;
            } else {
              const r = await researchModule(car, f, v.platform ?? v.group);
              knowledge[f.id] = { plainName: r.plainName, what: r.what, notes: r.notes, part: f.part, at: r.at };
              if (v.group === 'vag') aiItems = [...aiItems.filter((x) => x.module !== f.id), ...r.items];
            }
            // Values named already (lists, or the AI on any of the owner's cars) are not asked about again.
            const unknown = Object.entries(disc.modules[f.id]?.found ?? {})
              .filter(([did]) => !knownName(v.group, f.tx, did) && !all.some((r) => r.h === f.tx && r.d === did))
              .map(([did, x]) => ({ did, samples: x.samples, moves: x.moves }));
            if (unknown.length) {
              const named = await nameValues(car, f, unknown);
              aiSensors = [...aiSensors.filter((s) => s.h !== f.tx || !named.some((n) => n.d === s.d)), ...named];
              for (const n of named) found.add(readKey(n));
            }
            researched++;
            await garage.update(v.vin, { knowledge, aiItems, aiSensors, sensorsFound: [...found] });
          } catch (e) {
            if (i === 0) throw e;
          }
        }
        setDone((x) => [...x, 'research']);
      }

      // 5. Save and send.
      stepStarted.current = Date.now();
      setRunning('send');
      await garage.update(v.vin, { knowledge, aiItems, aiSensors, sensorsFound: [...found], learnRun: { at: Date.now(), modules: facts.length, sensors: sensorsCount + aiSensors.length, researched } });
      await addHistory({ vin: v.vin, kind: 'discover', title: 'Learned this car', detail: `${facts.length} modules, ${sensorsCount + aiSensors.length} sensors${researched ? `, ${researched} researched by AI` : ''}` });
      // Always tried: a failed send is kept on the phone and sent again later.
      const sent = await sendBack('learn', v.vin, { car: { title: vehicleTitle(v), brand: v.brand, model: v.model, year: v.year, platform: v.platform, group: v.group }, modules: facts, knowledge, aiItems, aiSensors, discovery: disc, sensorsFound: [...found] }).catch(
        (e) => ({ via: 'none' as const, detail: e instanceof Error ? e.message : String(e) }),
      );
      setDone((x) => [...x, 'send']);
      success();
      setMessage({
        tone: 'ok',
        text: `Learned ${facts.length} modules and ${sensorsCount + aiSensors.length} sensors${aiSensors.length ? ` (${aiSensors.length} named by AI)` : ''}.${aiItems.length ? ` ${aiItems.length} settings to try in Customise.` : ''} ${sent.via === 'github' ? 'Sent back, so the next version knows this car.' : sent.detail}`,
      });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      allowSleep('learn');
      void sendLogNow('Learn my car', v);
      if (alive.current) setRunning(null);
    }
  };

  const k = Object.entries(v.knowledge ?? {});
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Learn my car' }} />
      {message ? <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : 'alert-circle-outline'} text={message.text} /> : null}

      <GlowCard tone="brand" style={{ alignItems: 'center' }}>
        <ScanPulse active={!!running} size={128}>
          <View style={[styles.core, { backgroundColor: t.accentSoft }]}>
            <Icon name={'brain' as IconName} size={40} color={t.accent} />
          </View>
        </ScanPulse>
        <Text style={[type.title3, { color: t.text, marginTop: space.md, textAlign: 'center' }]}>{running ? STEPS.find((s) => s.key === running)!.title : 'Learn my car'}</Text>
        {running ? (
          <Text style={[type.small, type.number, { color: t.muted, marginTop: 2 }]}>
            Step {STEPS.findIndex((s) => s.key === running) + 1} of {STEPS.length} · {Math.max(1, Math.round((Date.now() - learnStarted.current) / 60000))} min so far
          </Text>
        ) : null}
        <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: 4, marginBottom: space.lg }]}>
          {running
            ? 'Keep the ignition on. Running the engine keeps the battery up. Nothing is changed in the car.'
            : 'Works on any car. Takes 10 to 30 minutes and is read-only: nothing is changed. Stop any time and keep what was learned.'}
        </Text>
        {running ? (
          <View style={{ alignSelf: 'stretch' }}>
            <ProgressBar value={progress.value} label={progress.label} startedAt={stepStarted.current} />
            <View style={{ marginTop: space.lg }}>
              <Button
                label={stopping ? 'Stopping…' : 'Stop and keep what was learned'}
                variant="secondary"
                disabled={stopping}
                onPress={() => {
                  stop.current = true;
                  setStopping(true);
                }}
              />
            </View>
          </View>
        ) : (
          <View style={{ alignSelf: 'stretch' }}>
            <Button label={v.learnRun ? 'Learn again' : 'Start learning'} icon={'brain' as IconName} onPress={run} />
          </View>
        )}
      </GlowCard>

      {!running && (v.modulesSeen?.length ?? 0) >= 3 ? (
        <Group footer="Caristini already knows this car's modules from your health check, so it asks those. Switch this on to also ask every address, about 2 minutes more, for example after fitting a new module.">
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 10, gap: space.sm }}>
            <Text style={[type.body, { color: t.text, flex: 1 }]}>Also search every address</Text>
            <Switch accessibilityLabel="Also search every address" value={probeAll} onValueChange={setProbeAll} />
          </View>
        </Group>
      ) : null}

      <Group header="What happens" help={SECTIONS.learnCarSteps} footer={ai ? undefined : 'The AI step needs a Claude API key (Settings > AI). The other steps run without it.'}>
        {STEPS.map((s, i) => {
          const isDone = done.includes(s.key);
          const now = running === s.key;
          const skipped = s.key === 'research' && !ai;
          return (
            <ListRow
              key={s.key}
              first={i === 0}
              icon={isDone ? 'check-circle' : s.icon}
              iconColour={isDone ? 'green' : now ? 'orange' : skipped ? 'grey' : 'indigo'}
              title={s.title}
              subtitle={s.detail}
              right={now ? <Pill text="Now" tone="accent" /> : skipped ? <Pill text="Needs key" /> : undefined}
              noChevron
            />
          );
        })}
      </Group>

      {k.length ? (
        <Group header="What Caristini knows about this car" help={SECTIONS.learnCarKnows} footer={v.learnRun ? `Last learned ${new Date(v.learnRun.at).toLocaleString('en-GB')}.` : undefined}>
          {k.map(([id, info], i) => (
            <ListRow key={id} first={i === 0} icon="chip" iconColour="indigo" title={info.plainName} subtitle={[info.part, info.what].filter(Boolean).join(' · ') || undefined} onPress={() => router.push(`/workshop/${id}`)} />
          ))}
        </Group>
      ) : null}

      <Group footer="For experts: explore one module for values no list names yet.">
        <ListRow first icon={'telescope' as IconName} iconColour="indigo" title="Unknown values" onPress={() => router.push('/discover')} />
        {v.aiSensors?.length ? <ListRow icon={'radar' as IconName} iconColour="teal" title="Values named by AI" value={String(v.aiSensors.length)} onPress={() => router.push('/sensors')} /> : null}
        {v.aiItems?.length ? <ListRow icon="tune-variant" iconColour="purple" title="Settings the AI found" value={String(v.aiItems.length)} onPress={() => router.push('/customise')} /> : null}
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  core: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
