import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Mascot } from '../../brand/Mascot';
import { diffSnapshots, LearnedPart, partKey, Snapshot, splitKey } from '../../coding/learn';
import { modulePart } from '../../coding/shared';
import { ModuleDef, MODULES, modulesFor } from '../../obd/modules';
import { toHex } from '../../obd/uds';
import { sendBack } from '../../share/sendBack';
import { sendLogNow } from '../../share/sendLog';
import { useConnection } from '../../state';
import { radius, space, type, useTheme } from '../../theme';
import { Button, GlowCard, Group, ListRow, NeedsConnection, Notice, ProgressBar, Screen, success } from '../../ui';
import { useGarage } from '../../vehicle/garage';
import { SECTIONS } from '../../help';

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

// Learn from Carista, fast:
// - one setting per module per round: changes in different modules are told
//   apart by their module, so several settings are learned in one Carista visit;
// - rounds chain: after a compare the new values are the next round's "before";
// - only modules that answered are read again, and a deep compare re-reads only
//   the values that answered the first time.
export default function Learn() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const v = conn.vehicle;
  const client = conn.client;
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const started = useRef(0);
  const [found, setFound] = useState<{ parts: LearnedPart[]; skipped: string[]; now: Snapshot } | null>(null);
  // Name per module key (module or module:DID) for this round.
  const [names, setNames] = useState<Record<string, string>>({});
  const [login, setLogin] = useState('');
  const [deep, setDeep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  if (!v || !client) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to learn settings" />
      </Screen>
    );
  }

  const saved = v.learnSnapshot;
  const defOf = (id: string): ModuleDef | undefined => MODULES.find((m) => m.id === id) ?? client.moduleById(id);
  const moduleName = (key: string) => {
    const { module, did } = splitKey(key);
    const n = defOf(module)?.name ?? module;
    return did ? `${n}, value ${did}` : n;
  };
  const step = (done: number, total: number, label: string) => alive.current && setProgress({ done, total, label });

  // Modules worth reading: those the car answered on before (health check,
  // deep scan, earlier saves); every module for the make the first time.
  const candidates = (): string[] => {
    const known = new Set([...(v.modulesSeen ?? []), ...(v.deepFound ?? []).map((d) => d.moduleId), ...Object.keys(v.codingCache ?? {}).filter((k) => !k.includes(':'))]);
    const all = modulesFor(v.group).map((m) => m.id);
    const list = known.size ? [...known].filter((id) => defOf(id)) : all;
    return list.filter((id) => id !== 'engine' && id !== 'gearbox' || known.has(id));
  };

  // Coding of each module in ids; those that do not answer are left out.
  const readCodings = async (ids: string[], offset = 0, total = ids.length): Promise<Snapshot> => {
    const out: Snapshot = {};
    for (let i = 0; i < ids.length; i++) {
      step(offset + i, total, `Reading ${moduleName(ids[i]).toLowerCase()}`);
      const def = defOf(ids[i]);
      const c = def ? await client.readCoding(def).catch(() => null) : null;
      if (c && c.length) {
        out[ids[i]] = toHex(c);
        client.sessionValues.set(ids[i], c);
      }
    }
    return out;
  };

  // Deep compare: the first time every value 0000 to 0FFF of one module, after
  // that only the values that answered.
  const readDeep = async (id: string, only?: string[]): Promise<Snapshot> => {
    const def = defOf(id);
    if (!def) return {};
    const out: Snapshot = {};
    if (only?.length) {
      const got = await client.sampleDids(def, only);
      for (const [did, data] of Object.entries(got)) out[`${id}:${did}`] = toHex(data);
      return out;
    }
    const all = await client.sweepDids(def, 0x0000, 0x0fff, { onProgress: (p) => step(Math.round(p * 4096), 4096, `Every value of ${moduleName(id).toLowerCase()}`) });
    for (const [did, hex] of Object.entries(all)) if (did !== '0600') out[`${id}:${did}`] = hex;
    return out;
  };

  const save = async () => {
    setError(null);
    setFound(null);
    setNote(null);
    started.current = Date.now();
    try {
      const snap = { ...(await readCodings(candidates())), ...(deep ? await readDeep(deep) : {}) };
      if (!Object.keys(snap).length) {
        setError('No module sent its coding. Run a health check first so Caristini knows which modules your car has, then try again.');
        return;
      }
      await garage.update(v.vin, { learnSnapshot: { date: new Date().toISOString(), codings: snap, deep: deep ?? undefined } });
      success();
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setProgress(null);
      void sendLogNow('Learn from Carista: save', v);
    }
  };

  const compare = async () => {
    if (!saved) return;
    setError(null);
    setNote(null);
    started.current = Date.now();
    try {
      const codingKeys = Object.keys(saved.codings).filter((k) => !k.includes(':'));
      const deepDids = Object.keys(saved.codings).filter((k) => k.includes(':')).map((k) => splitKey(k).did!);
      const now = { ...(await readCodings(codingKeys)), ...(saved.deep ? await readDeep(saved.deep, deepDids) : {}) };
      const diff = diffSnapshots(saved.codings, now);
      if (alive.current) {
        setFound({ ...diff, now });
        setNames({});
      }
      // What changed goes to the private findings repo, named or not.
      void sendBack('learn-compare', v.vin, { car: { brand: v.brand, model: v.model, year: v.year, platform: v.platform }, before: saved.codings, after: now, changed: diff.parts });
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setProgress(null);
      void sendLogNow('Learn from Carista: compare', v);
    }
  };

  // Changes grouped by module (or module value): one setting each.
  const groups = found ? [...new Set(found.parts.map(partKey))].map((key) => ({ key, parts: found.parts.filter((p) => partKey(p) === key) })) : [];

  // Keeps every named group as a switch, and makes the new values the next
  // round's starting point, so the next round needs no save.
  const keep = async () => {
    if (!found || !saved) return;
    const code = parseInt(login, 10);
    const now = new Date().toISOString();
    const kept = groups
      .filter((g) => names[g.key]?.trim())
      .map((g, i) => ({
        id: `learned-${Date.now()}-${i}`,
        title: names[g.key].trim(),
        learnedAt: now,
        // The module's part number goes with it, for the owner's other cars.
        parts: g.parts.map((p) => (modulePart(v, p.module) ? { ...p, part: modulePart(v, p.module) } : p)),
        ...(code ? { login: code } : {}),
      }));
    const originals = { ...(v.codingOriginal ?? {}) };
    for (const s of kept) for (const p of s.parts) if (!originals[partKey(p)]) originals[partKey(p)] = saved.codings[partKey(p)];
    const next = { ...saved.codings, ...found.now };
    await garage.update(v.vin, { learned: [...(v.learned ?? []), ...kept], learnSnapshot: { date: now, codings: next, deep: saved.deep }, codingOriginal: originals });
    void sendBack('learned', v.vin, { car: { brand: v.brand, model: v.model, year: v.year, platform: v.platform }, settings: kept });
    success();
    setFound(null);
    setNames({});
    setLogin('');
    setNote(kept.length ? `${kept.length} setting${kept.length === 1 ? '' : 's'} kept. Ready for the next round: change more settings in Carista, then compare again.` : 'Nothing named, nothing kept. Ready for the next round.');
  };

  const reading = progress != null;
  const named = groups.filter((g) => names[g.key]?.trim()).length;

  return (
    <Screen>
      <GlowCard tone="brand" style={styles.hero}>
        <Mascot mood={reading ? 'scanning' : 'happy'} size={88} />
        <View style={{ flex: 1 }}>
          <Text style={[type.title3, { color: t.text }]}>Learn settings from Carista</Text>
          <Text style={[type.sub, { color: t.muted, marginTop: 4 }]}>
            Change one setting per module in Carista each round, for example one in the cluster and one in the doors. Caristini sees what changed in each module and learns them all at once.
          </Text>
        </View>
      </GlowCard>

      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
      {note ? <Notice tone="ok" icon="check" text={note} /> : null}

      {reading ? <ProgressBar value={progress.done / Math.max(1, progress.total)} label={progress.label} done={progress.done} total={progress.total} startedAt={started.current} /> : null}

      <Group
        header={saved ? 'Starting point saved' : '1. Save the current settings'}
        help={SECTIONS.learnSave}
        footer={
          saved
            ? `${Object.keys(saved.codings).length} values from ${new Date(saved.date).toLocaleString('en-GB')}. Each compare moves this on, so there is no need to save again between rounds.`
            : 'Reads the modules your car answered on before. Ignition on.'
        }
      >
        <ListRow first icon="content-save-outline" iconColour="blue" title={saved ? 'Start again from now' : 'Save settings now'} disabled={reading} onPress={save} />
      </Group>

      {!saved ? (
        <Group
          header="Wider compare (optional)"
          help={SECTIONS.learnDeep}
          footer={
            deep
              ? `Also saves every value 0000 to 0FFF of ${moduleName(deep)} once (about 5 minutes); each compare then re-reads only the values that answered, in seconds.`
              : 'Pick a module to also compare its values outside the coding, such as adaptations.'
          }
        >
          {candidates()
            .map((id) => defOf(id))
            .filter((m): m is ModuleDef => !!m && !!m.tx && m.id !== 'gearbox')
            .slice(0, 14)
            .map((m, i) => (
              <ListRow key={m.id} first={i === 0} title={`${m.code ? `${m.code} · ` : ''}${m.name}`} selected={deep === m.id} disabled={reading} onPress={() => setDeep(deep === m.id ? null : m.id)} />
            ))}
        </Group>
      ) : null}

      <Group header="2. Change settings in Carista" help={SECTIONS.learnChange} footer="One app can use the adapter at a time. Two settings in the same module cannot be told apart, so change only one per module each round.">
        <ListRow first icon="link-variant-off" iconColour="grey" title="Disconnect Caristini now" subtitle="Then open Carista" disabled={reading} onPress={() => conn.disconnect()} />
        <ListRow title="In Carista, change one setting in each module you like" subtitle="Note what you changed, for example cluster: needle sweep on" noChevron />
        <ListRow title="Close Carista, then connect Caristini again" subtitle="The Car tab then shows Carry on learning from Carista" noChevron />
      </Group>

      <Group header="3. Compare" help={SECTIONS.learnCompare}>
        <ListRow first icon="compare-horizontal" iconColour="purple" title="Read again and compare" disabled={!saved || reading} onPress={compare} />
      </Group>

      {found ? (
        groups.length ? (
          <>
            <Group header={`What changed: ${groups.length} module${groups.length === 1 ? '' : 's'}`} footer={found.skipped.length ? `Not compared (length changed): ${found.skipped.map(moduleName).join(', ')}.` : 'Name each change after the setting you changed in that module. Leave a name empty to skip it.'}>
              {groups.map((g, i) => (
                <View key={g.key} style={[styles.change, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
                  <Text style={[type.body, { color: t.text }]}>{moduleName(g.key)}</Text>
                  <Text style={[type.small, { color: t.muted, fontVariant: ['tabular-nums'] }]}>
                    {g.parts.map((p) => `byte ${p.byte}: ${hex2(p.off)} → ${hex2(p.on)} (bits ${hex2(p.mask)})`).join(', ')}
                  </Text>
                  <TextInput
                    value={names[g.key] ?? ''}
                    onChangeText={(x) => setNames((o) => ({ ...o, [g.key]: x }))}
                    placeholder="Setting name, for example Needle sweep"
                    placeholderTextColor={t.muted}
                    selectionColor={t.accent}
                    accessibilityLabel={`Name for the change in ${moduleName(g.key)}`}
                    style={[type.body, styles.input, { backgroundColor: t.sunken, color: t.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
                  />
                </View>
              ))}
            </Group>
            <Text style={[type.label, { color: t.muted, marginBottom: 6, marginLeft: space.lg }]}>Login code (only if a module needs one)</Text>
            <TextInput
              value={login}
              onChangeText={(x) => setLogin(x.replace(/[^0-9]/g, '').slice(0, 5))}
              placeholder="For example 20103"
              placeholderTextColor={t.muted}
              keyboardType="number-pad"
              selectionColor={t.accent}
              style={[type.body, styles.input, { backgroundColor: t.sunken, color: t.text, marginHorizontal: 0 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
            />
            <Button label={named ? `Keep ${named} as switch${named === 1 ? '' : 'es'} and start the next round` : 'Skip and start the next round'} icon="check" onPress={keep} />
            <View style={{ height: space.sm }} />
            <Button label="Done learning" variant="secondary" onPress={() => router.back()} />
          </>
        ) : (
          <Notice icon="information-outline" text="Nothing changed in the modules Caristini read. The setting may live in a module it cannot read yet, or Carista did not save it. Try a wider compare on that module." />
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  change: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 6 },
  input: { borderRadius: radius.sm + 2, paddingHorizontal: space.md, paddingVertical: 10, marginBottom: space.sm },
});
