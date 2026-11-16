import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Mascot } from '../../brand/Mascot';
import { bitsLabel, CodingItem, codingItemsFor, isOn, stateText, withItem } from '../../coding/items';
import { LearnedSetting, learnedIsOn, learnedKeys, learnedModules, learnedReady, splitKey, withLearned } from '../../coding/learn';
import { sharedFits, sharedLearned } from '../../coding/shared';
import { addDiary, SETTING_CHANGED, today } from '../../diary';
import { addHistory } from '../../history';
import { kbForCar, kbSettings, loadKb } from '../../kb';
import { categoriesFor, modsForVehicle, STATUS_LABEL } from '../../mods/catalogue';
import { MODULES } from '../../obd/modules';
import { preflightCheck } from '../../coding/preflight';
import { toHex } from '../../obd/uds';
import { cacheAfterWrite } from '../../diag/timeline';
import { useConnection } from '../../state';
import { space, type, useTheme } from '../../theme';
import { ConfirmSheet, GlowCard, Group, Icon, ListRow, NeedsConnection, Notice, Pill, Screen, success, tap } from '../../ui';
import { TryResult, useGarage, vehicleTitle } from '../../vehicle/garage';
import { SECTIONS } from '../../help';

const CATEGORY_ICON: Record<string, React.ComponentProps<typeof Icon>['name']> = {
  'Most popular': 'star-outline',
  'Instrument cluster': 'gauge',
  Warnings: 'bell-alert-outline',
  Mirrors: 'mirror-rectangle',
  Locking: 'lock-outline',
  'Locking and alarm': 'lock-outline',
  'Windows and sunroof': 'car-door',
  Lights: 'car-light-high',
};


// warn: set after the battery and engine check asked first; the next confirm writes anyway.
type Pending =
  | { kind: 'item'; item: CodingItem; on: boolean; warn?: string }
  | { kind: 'learned'; setting: LearnedSetting; on: boolean; warn?: string }
  | { kind: 'forget'; setting: LearnedSetting; warn?: string }
  | { kind: 'restore'; module: string; warn?: string }
  | null;

export default function Customise() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const v = conn.vehicle;
  const client = conn.client;
  // Put back from the change timeline: the module to restore, when it has a backup.
  const params = useLocalSearchParams<{ restore?: string }>();
  const wantRestore = params.restore && v?.codingOriginal?.[params.restore] ? params.restore : null;
  // Settings saved in the shared knowledge base, loaded once. They are not
  // confirmed on a car, so they show as read-only notes, never as switches.
  const [kbItems, setKbItems] = useState<CodingItem[]>([]);
  useEffect(() => {
    if (!v) return;
    // Only settings saved for this make and this exact platform.
    const plat = (v.platform ?? '').toLowerCase();
    loadKb().then((l) => setKbItems(kbSettings(kbForCar(l, v)).filter((i) => !!plat && i.platforms.some((x) => x.toLowerCase() === plat))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.vin, v?.platform]);
  // Sourced settings for this platform.
  const items = v
    ? codingItemsFor(v.group, v.platform).filter(
        (i, k, all) => all.findIndex((x) => x.module === i.module && x.byte === i.byte && x.bits.join() === i.bits.join()) === k,
      )
    : [];
  // Knowledge base notes not already a sourced setting.
  const kbNotes = kbItems.filter((n) => !items.some((i) => i.module === n.module && i.byte === n.byte && i.bits.join() === n.bits.join()));
  const learned = v?.learned ?? [];
  // Settings learned on the owner's other cars that have the same module.
  const borrowed = v ? sharedLearned(v, garage.vehicles) : [];
  // Keys are module ids (long coding) or "moduleId:DID" (learned adaptation values).
  const moduleIds = [...new Set([...items.map((i) => i.module), ...learned.flatMap(learnedKeys), ...borrowed.flatMap(learnedKeys), ...(wantRestore ? [wantRestore] : [])])];
  const defOf = (key: string) => {
    const id = splitKey(key).module;
    return MODULES.find((m) => m.id === id) ?? client?.moduleById(id);
  };
  // Opens on the last coding read (instant); each module's switches unlock
  // once that module has been read again, so nothing is written from old data.
  const [codings, setCodings] = useState<Record<string, number[] | null>>(() =>
    Object.fromEntries(
      Object.entries(v?.codingCache ?? {})
        .filter(([, hex]) => /^([0-9A-F]{2})+$/i.test(hex))
        .map(([k, hex]) => [k, hex.match(/../g)!.map((h) => parseInt(h, 16))]),
    ),
  );
  // Modules written during this visit: a background read must not put their old bytes back.
  const written = useRef(new Set<string>());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  // Category chip in view (null: all) and the setting whose details are open.
  const [cat, setCat] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // The setting whose Technical details (source notes, byte, bits) are open.
  const [techId, setTechId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger'; text: string; id?: string } | null>(null);
  // Try mode: after a change to an untested setting, ask whether it worked.
  const [ask, setAsk] = useState<{ id: string; title: string; done: { key: string; before: number[]; after: number[] }[]; login?: number } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // force: read every module again (Read again). Otherwise a module read
  // earlier on this connection is used as it is.
  const read = useCallback(async (force = false) => {
    if (!client || !client.supportsModules) return;
    setReading(true);
    setChecked(new Set());
    written.current.clear();
    const out: Record<string, number[] | null> = {};
    const done = new Set<string>();
    for (const id of moduleIds) {
      const def = defOf(id);
      const { did } = splitKey(id);
      const kept = force ? undefined : client.sessionValues.get(id);
      if (kept) out[id] = kept;
      else if (!def) out[id] = null;
      else if (did) {
        const r = await client.readRawDid(def, did);
        out[id] = 'data' in r ? r.data : null;
      } else out[id] = await client.readCoding(def);
      if (!alive.current) return;
      if (out[id]) client.sessionValues.set(id, out[id]!);
      done.add(id);
      if (!written.current.has(id)) setCodings((old) => ({ ...old, [id]: out[id] }));
      setChecked(new Set(done));
    }
    setReading(false);
    if (v) {
      const cache = Object.fromEntries(Object.entries(out).filter(([k, c]) => !!c && c.length > 0 && !written.current.has(k)).map(([k, c]) => [k, toHex(c!)]));
      garage.update(v.vin, { codingCache: { ...(v.codingCache ?? {}), ...cache } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, moduleIds.join()]);

  useEffect(() => {
    if (moduleIds.length) read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read]);

  // Put back from the change timeline: once the module has been read, the
  // usual restore confirmation opens (or a note when it is original already).
  const restoreAsked = useRef<string | null>(null);
  useEffect(() => {
    if (!wantRestore || reading || !checked.has(wantRestore) || restoreAsked.current === wantRestore) return;
    restoreAsked.current = wantRestore;
    const now = codings[wantRestore];
    const name = defOf(wantRestore)?.name ?? wantRestore;
    if (!now) setMessage({ tone: 'danger', text: `${name} did not answer, so its coding could not be read. Check the ignition is on, then tap Read settings again.` });
    else if (toHex(now) === v?.codingOriginal?.[wantRestore]) setMessage({ tone: 'ok', text: `${name} already has its original coding. Nothing to put back.` });
    else setPending({ kind: 'restore', module: wantRestore });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantRestore, reading, checked]);

  if (!v) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to change settings" />
      </Screen>
    );
  }

  const originals = v.codingOriginal ?? {};
  const ready = (i: CodingItem) => {
    const c = codings[i.module];
    if (reading && !checked.has(i.module) && !c) return false;
    if (!c) return false;
    // Old 3-digit short coding is not a byte layout: no catalogue bit fits it.
    const def = defOf(i.module);
    if (def && client?.codingStyle(def) === 'short') return false;
    return i.length ? c.length === i.length : c.length > i.byte;
  };
  const available = items.filter(ready);
  const unreachable = items.filter((i) => !reading && checked.has(i.module) && !ready(i));
  const restorable = moduleIds.filter((id) => originals[id] && codings[id] && toHex(codings[id]!) !== originals[id]);

  // Checks every change must pass before Caristini writes anything.
  const preflight = () => preflightCheck(client);
  const tried = v.tried ?? {};
  const mark = (id: string, r: TryResult) => garage.update(v.vin, { tried: { ...(v.tried ?? {}), [id]: r } });

  // "No, put it back": writes the previous values again, newest first.
  const undoTry = async () => {
    const a = ask;
    setAsk(null);
    if (!a || !client) return;
    setBusy(a.id);
    try {
      for (const d of [...a.done].reverse()) {
        const def = defOf(d.key)!;
        const { did } = splitKey(d.key);
        const res = did ? await client.writeDid(def, did, d.after, d.before, a.login) : await client.writeCoding(def, d.after, d.before, a.login);
        if (res.coding) written.current.add(d.key);
        if (res.coding) client.sessionValues.set(d.key, res.coding);
        if (res.coding && alive.current) setCodings((old) => ({ ...old, [d.key]: res.coding }));
        // The saved coding follows each write, so Put back decides from what the module holds now.
        if (res.coding) await garage.update(v.vin, { codingCache: cacheAfterWrite(garage.latest(v.vin)?.codingCache, [{ key: d.key, hex: toHex(res.coding) }]) });
      }
      await mark(a.id, 'no-effect');
      await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: SETTING_CHANGED, mileage: null, notes: `Tried ${a.title}: no effect seen, put back.` });
      const backups = garage.latest(v.vin)?.codingOriginal ?? {};
      await addHistory({
        vin: v.vin,
        kind: 'change',
        title: `${a.title} put back`,
        detail: 'No effect seen in Try mode',
        odometerKm: v.odometerKm,
        changes: [...a.done].reverse().map((d) => ({ module: defOf(d.key)?.name ?? d.key, key: d.key, setting: a.title, from: 'On', to: 'Off', before: toHex(d.after), after: toHex(d.before), backup: backups[d.key], source: 'Try mode' })),
      });
      if (alive.current) setMessage({ tone: 'ok', text: `${a.title} put back. Marked as no effect on this car.` });
    } catch (e) {
      if (alive.current) setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const run = async (p: Exclude<Pending, null>) => {
    setPending(null);
    if (!client) return;
    // The result shows under the switch that was used.
    const runId = p.kind === 'item' ? p.item.id : p.kind === 'restore' ? undefined : p.setting.id;
    if (p.kind === 'forget') {
      await garage.update(v.vin, { learned: learned.filter((s) => s.id !== p.setting.id) });
      return;
    }
    const ids = p.kind === 'item' ? [p.item.module] : p.kind === 'learned' ? learnedKeys(p.setting) : [p.module];
    if (ids.some((id) => !codings[id])) return;
    setBusy(p.kind === 'item' ? p.item.id : p.kind === 'learned' ? p.setting.id : `restore-${p.module}`);
    setMessage(null);
    try {
      const check = await preflight();
      if (check.block) {
        setMessage({ id: runId, tone: 'danger', text: check.block });
        return;
      }
      if (check.warn && !p.warn) {
        // Ask once more with the reason; the next confirm goes ahead.
        if (alive.current) setPending({ ...p, warn: check.warn } as Exclude<Pending, null>);
        return;
      }
      // The first coding ever seen for each module is kept as the original.
      const saved = garage.latest(v.vin)?.codingOriginal ?? {};
      const fresh = ids.filter((id) => !saved[id]);
      const backups = { ...saved, ...Object.fromEntries(fresh.map((id) => [id, toHex(codings[id]!)])) };
      if (fresh.length) await garage.update(v.vin, { codingOriginal: backups });
      const what =
        p.kind === 'item'
          ? `${p.item.title} ${p.on ? 'on' : 'off'}`
          : p.kind === 'learned'
            ? `${p.setting.title} ${p.on ? 'on' : 'off'}`
            : `${defOf(p.module)?.name} ${splitKey(p.module).did ? 'setting' : 'coding'} restored to the original`;
      const notes: string[] = [];
      const done: { key: string; before: number[]; after: number[] }[] = [];
      const settingId = p.kind === 'item' ? p.item.id : p.kind === 'learned' ? p.setting.id : null;
      for (const moduleId of ids) {
        const def = defOf(moduleId)!;
        const { did } = splitKey(moduleId);
        const before = codings[moduleId]!;
        const after =
          p.kind === 'item'
            ? withItem(p.item, before, p.on)
            : p.kind === 'learned'
              ? withLearned(p.setting, moduleId, before, p.on)
              : (originals[moduleId] ?? toHex(before)).match(/../g)!.map((h) => parseInt(h, 16));
        const login = p.kind === 'learned' ? p.setting.login : p.kind === 'item' ? p.item.login : undefined;
        const res = did ? await client.writeDid(def, did, before, after, login) : await client.writeCoding(def, before, after, login);
        if (!alive.current) return;
        if (res.coding) {
          written.current.add(moduleId);
          client.sessionValues.set(moduleId, res.coding);
          setCodings((old) => ({ ...old, [moduleId]: res.coding }));
          // The saved coding follows each write, so Put back decides from what the module holds now.
          await garage.update(v.vin, { codingCache: cacheAfterWrite(garage.latest(v.vin)?.codingCache, [{ key: moduleId, hex: toHex(res.coding) }]) });
        }
        if (!res.ok) {
          if (settingId && p.kind !== 'restore' && p.on) await mark(settingId, 'refused');
          setMessage({
            id: runId,
            tone: 'danger',
            text: res.restored
              ? `${def.name} did not keep the change, so Caristini put its original coding back.${notes.length ? ' Modules changed before it keep the new setting; switch it off again to undo them.' : ' Nothing has changed.'}`
              : `${def.name} did not keep the change, and Caristini could not confirm the original is back. With the ignition on, tap Restore under Backups below.`,
          });
          return;
        }
        notes.push(`${def.name} ${did ? `value ${did}` : 'coding'} ${toHex(before)} to ${toHex(after)}`);
        done.push({ key: moduleId, before, after });
      }
      success();
      await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: SETTING_CHANGED, mileage: null, notes: p.kind === 'restore' ? `${what}.` : `Changed: ${what}. Undo it in Customise > Backups.` });
      // One line per module for the change timeline, with the backup each came from.
      const setting = p.kind === 'item' ? p.item.title : p.kind === 'learned' ? p.setting.title : 'Restore original';
      const value = p.kind === 'restore' ? undefined : { from: p.on ? 'Off' : 'On', to: p.on ? 'On' : 'Off' };
      await addHistory({
        vin: v.vin,
        kind: 'change',
        title: what.charAt(0).toUpperCase() + what.slice(1),
        detail: done.map((d) => defOf(d.key)?.name).join(', '),
        before: done.map((d) => toHex(d.before)).join(' '),
        after: done.map((d) => toHex(d.after)).join(' '),
        odometerKm: v.odometerKm,
        changes: done.map((d) => ({ module: defOf(d.key)?.name ?? d.key, key: d.key, setting, ...value, before: toHex(d.before), after: toHex(d.after), backup: backups[d.key], source: 'Customise' })),
      });
      setMessage({ id: runId, tone: 'ok', text: `${what}. Switch the ignition off and on to see it. Saved to your Diary.` });
      // Try mode: a setting not yet confirmed on this car asks whether it worked.
      if (settingId && p.kind !== 'restore' && p.on && tried[settingId] !== 'works') {
        setAsk({ id: settingId, title: p.kind === 'item' ? p.item.title : p.setting.title, done, login: p.kind === 'learned' ? p.setting.login : undefined });
      }
    } catch (e) {
      if (alive.current) setMessage({ id: runId, tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const mods = modsForVehicle(v.group, v.platform);
  const cats = categoriesFor(mods);
  // Modules with settings (a module with adaptation values counts once).
  const modulesWithSettings = new Set(moduleIds.map((k) => splitKey(k).module)).size;
  const checkedModules = new Set([...checked].map((k) => splitKey(k).module).filter((m) => moduleIds.every((k) => splitKey(k).module !== m || checked.has(k)))).size;
  const confirmed = available.filter((i) => i.confidence !== 'low');
  const unconfirmed = available.filter((i) => i.confidence === 'low');
  const groups = [...new Set(confirmed.map((i) => i.category))];
  const learnedReadyList = learned.filter((s) => learnedReady(s, codings));
  const borrowedFit = borrowed.filter((s) => tried[s.id] !== 'no-effect' && tried[s.id] !== 'refused' && sharedFits(s, codings));
  const learnedWaiting = learned.filter((s) => !reading && !learnedReady(s, codings));

  return (
    <Screen>
      {items.length || learned.length ? (
        <GlowCard tone="brand" style={styles.hero}>
          <Mascot mood={reading || busy ? 'scanning' : 'happy'} size={96} />
          <View style={{ flex: 1 }}>
            <Text style={[type.title3, { color: t.text }]}>Settings on your {v.model || v.brand}</Text>
            <Text style={[type.sub, { color: t.muted, marginTop: 4 }]}>
              Caristini backs up before every change, checks the car kept it, and puts the original back if anything fails.
            </Text>
          </View>
        </GlowCard>
      ) : null}

      {message && !message.id ? <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : 'alert-circle-outline'} text={message.text} /> : null}

      {moduleIds.length && reading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={t.muted} />
          <Text style={[type.sub, { color: t.muted, flex: 1 }]}>
            Checking the current settings ({checkedModules} of {modulesWithSettings} module{modulesWithSettings === 1 ? '' : 's'} with settings). Each switch unlocks when its module has answered.
          </Text>
        </View>
      ) : null}

      {groups.length + (unconfirmed.length ? 1 : 0) + (learned.length ? 1 : 0) > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[
            { key: null, label: 'All', n: available.length + learnedReadyList.length },
            ...groups.map((g) => ({ key: g, label: g, n: confirmed.filter((i) => i.category === g).length })),
            ...(unconfirmed.length ? [{ key: 'Try these (not confirmed)', label: 'Try these', n: unconfirmed.length }] : []),
            ...(learned.length ? [{ key: 'Learned', label: 'Learned', n: learnedReadyList.length }] : []),
          ].map((c) => {
            const on = cat === c.key;
            return (
              <Pressable
                key={c.label}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  tap();
                  setCat(c.key);
                }}
                style={[styles.chip, { backgroundColor: on ? t.accent : t.surface }]}
              >
                <Text style={[type.sub, { color: on ? t.onAccent : t.text, fontWeight: '600' }]}>{c.label}</Text>
                {/* Counts show once every module has answered, so they do not jump. */}
                {!reading ? <Text style={[type.small, type.number, { color: on ? t.onAccent : t.muted }]}>{c.n}</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {[...groups.map((g) => ({ g, list: confirmed.filter((i) => i.category === g) })), ...(unconfirmed.length ? [{ g: 'Try these (not confirmed)', list: unconfirmed }] : [])]
        .filter(({ g }) => !cat || cat === g)
        .map(({ g, list }, k) => (
        <Group
          key={g}
          header={g}
          help={g === 'Try these (not confirmed)' ? SECTIONS.customiseTry : k === 0 ? SECTIONS.customiseSettings : undefined}
          footer={g === 'Try these (not confirmed)' ? 'One vague source each. Caristini writes the change, checks the module kept it, then asks whether you saw it, and puts it back if not.' : undefined}
        >
          {list
            .map((i, n) => {
              const on = isOn(i, codings[i.module]!);
              const working = busy === i.id;
              return (
                <View key={i.id} style={[styles.item, { borderColor: t.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${i.title}, ${openId === i.id ? 'hide' : 'show'} details`}
                    onPress={() => setOpenId(openId === i.id ? null : i.id)}
                    style={{ flex: 1 }}
                  >
                    <Text style={[type.body, { color: t.text }]}>{i.title}</Text>
                    {tried[i.id] || i.confidence === 'medium' ? (
                      <View style={styles.badge}>{tried[i.id] ? <TriedPill r={tried[i.id]} /> : <Pill text="Reported by owners" />}</View>
                    ) : null}
                    {openId === i.id ? (
                      <>
                        <Text style={[type.sub, { color: t.muted, marginTop: 2 }]}>{stateText(i, on)}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: techId === i.id }}
                          hitSlop={6}
                          onPress={() => setTechId(techId === i.id ? null : i.id)}
                          style={{ marginTop: 4, minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' }}
                        >
                          <Text style={[type.small, { color: t.accentText }]}>{techId === i.id ? 'Hide technical' : 'Technical'}</Text>
                        </Pressable>
                        {techId === i.id ? (
                          <>
                            {i.note ? <Text style={[type.small, { color: t.muted }]}>{i.note}</Text> : null}
                            <Text style={[type.small, { color: t.faint, marginTop: 4 }]}>
                              {defOf(i.module)?.name ?? i.module}, byte {i.byte}, {bitsLabel(i)}
                            </Text>
                            <Pressable accessibilityRole="link" hitSlop={6} onPress={() => Linking.openURL(i.sources[0].url)} style={{ marginTop: 6 }}>
                              <Text style={[type.small, { color: t.accentText }]}>Source: {i.sources[0].label}</Text>
                            </Pressable>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <Text style={[type.small, { color: t.muted, marginTop: 1 }]} numberOfLines={2}>
                        {stateText(i, on)}
                      </Text>
                    )}
                    {message?.id === i.id ? <Text style={[type.small, { color: message.tone === 'ok' ? t.ok : t.danger, marginTop: 4 }]}>{message.text}</Text> : null}
                  </Pressable>
                  {working ? (
                    <ActivityIndicator color={t.accentText} />
                  ) : (
                    <Switch
                      value={on}
                      disabled={!!busy || !checked.has(i.module)}
                      trackColor={{ true: t.green, false: t.sunken }}
                      accessibilityLabel={i.title}
                      onValueChange={(next) => {
                        tap();
                        setPending({ kind: 'item', item: i, on: next });
                      }}
                    />
                  )}
                </View>
              );
            })}
        </Group>
      ))}

      {v.deepFound?.length && !cat ? (
        <Group
          header="Older modules on this car"
          footer="A switch shows only where a public source says which coding bit does what. For a module with none yet, open it to read and change its coding bit by bit, or run Learn my car below to look its settings up."
        >
          {v.deepFound.map((d, n) => {
            const count = available.filter((i) => i.module === d.moduleId).length;
            return (
              <ListRow
                key={d.address}
                first={n === 0}
                icon="chip"
                iconColour="indigo"
                title={defOf(d.moduleId)?.name ?? d.moduleId}
                subtitle={[d.component, d.part].filter(Boolean).join(' · ') || undefined}
                value={count ? `${count} setting${count === 1 ? '' : 's'}` : 'Open coding'}
                onPress={() => router.push({ pathname: '/workshop/[id]', params: { id: d.moduleId } })}
              />
            );
          })}
        </Group>
      ) : null}

      {borrowedFit.length && !cat ? (
        <Group
          header="From your other cars"
          footer="Learned on another of your cars with the same module. Not confirmed on this car: Caristini backs up, makes the change, asks whether you saw it, and puts the old value back if not."
        >
          {borrowedFit.map((s, n) => {
            const on = learnedIsOn(s, codings);
            const working = busy === s.id;
            return (
              <View key={s.id} style={[styles.item, { borderColor: t.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: t.text }]}>{s.title}</Text>
                  <View style={styles.badge}>{tried[s.id] ? <TriedPill r={tried[s.id]} /> : <Pill text="Try it" tone="accent" />}</View>
                  <Text style={[type.sub, { color: t.muted, marginTop: 2 }]}>
                    {learnedModules(s)
                      .map((id) => defOf(id)?.name ?? id)
                      .join(', ')}
                    {` · from your ${s.from}${s.tier === 2 ? ' (same part, another revision)' : ''}`}
                  </Text>
                  {message?.id === s.id ? <Text style={[type.small, { color: message.tone === 'ok' ? t.ok : t.danger, marginTop: 4 }]}>{message.text}</Text> : null}
                </View>
                {working ? (
                  <ActivityIndicator color={t.accentText} />
                ) : (
                  <Switch
                    value={on}
                    disabled={!!busy || learnedKeys(s).some((k) => !checked.has(k))}
                    trackColor={{ true: t.green, false: t.sunken }}
                    accessibilityLabel={s.title}
                    onValueChange={(next) => {
                      tap();
                      setPending({ kind: 'learned', setting: s, on: next });
                    }}
                  />
                )}
              </View>
            );
          })}
        </Group>
      ) : null}

      {learned.length && (!cat || cat === 'Learned') ? (
        <Group header="Learned from your car" help={SECTIONS.customiseLearned} footer={learnedWaiting.length ? `Waiting for ${learnedWaiting.map((s) => s.title).join(', ')}: the module did not answer with the coding it had when learned.` : undefined}>
          {learnedReadyList.map((s, n) => {
            const on = learnedIsOn(s, codings);
            const working = busy === s.id;
            return (
              <View key={s.id} style={[styles.item, { borderColor: t.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: t.text }]}>{s.title}</Text>
                  {tried[s.id] ? <View style={styles.badge}><TriedPill r={tried[s.id]} /></View> : null}
                  <Text style={[type.sub, { color: t.muted, marginTop: 2 }]}>
                    {learnedModules(s)
                      .map((id) => defOf(id)?.name ?? id)
                      .join(', ')}
                  </Text>
                  <Pressable accessibilityRole="button" hitSlop={6} disabled={!!busy} onPress={() => setPending({ kind: 'forget', setting: s })} style={{ marginTop: 2, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
                    <Text style={[type.small, { color: t.accentText }]}>Forget</Text>
                  </Pressable>
                  {message?.id === s.id ? <Text style={[type.small, { color: message.tone === 'ok' ? t.ok : t.danger, marginTop: 4 }]}>{message.text}</Text> : null}
                </View>
                {working ? (
                  <ActivityIndicator color={t.accentText} />
                ) : (
                  <Switch
                    value={on}
                    disabled={!!busy || learnedKeys(s).some((k) => !checked.has(k))}
                    trackColor={{ true: t.green, false: t.sunken }}
                    accessibilityLabel={s.title}
                    onValueChange={(next) => {
                      tap();
                      setPending({ kind: 'learned', setting: s, on: next });
                    }}
                  />
                )}
              </View>
            );
          })}
        </Group>
      ) : null}

      <Group
        header="Get more settings"
        help={SECTIONS.customiseMore}
        footer="A switch appears only where a source, or your own car, shows which coding bit does what."
      >
        {client?.supportsModules ? (
          <ListRow first icon="compare-horizontal" iconColour="purple" title="Learn from Carista" subtitle="Change settings in Carista; Caristini learns what changed" onPress={() => router.push('/customise/learn')} />
        ) : null}
        <ListRow first={!client?.supportsModules} icon="school-outline" iconColour="teal" title="Learn my car" subtitle="Finds every module and reads its part number and coding" onPress={() => router.push('/learn-car')} />
        <ListRow icon="refresh" iconColour="blue" title="Read settings again" subtitle="Settings are kept while connected; this reads them fresh" disabled={reading} onPress={() => read(true)} />
      </Group>

      {kbNotes.length ? (
        <Group header="Notes from the knowledge base" footer="Not confirmed on a car, so Caristini does not offer these as switches.">
          {kbNotes.map((n, i) => (
            <ListRow key={n.id} first={i === 0} icon="note-text-outline" iconColour="grey" title={n.title} subtitle={n.summary} noChevron />
          ))}
        </Group>
      ) : null}

      {restorable.length ? (
        <Group header="Backups" help={SECTIONS.customiseBackups} footer="The coding each module had before Caristini first changed it.">
          {restorable.map((id, i) => {
            const did = splitKey(id).did;
            return (
              <ListRow
                key={id}
                first={i === 0}
                icon="restart"
                iconColour="grey"
                title={`Restore ${defOf(id)?.name ?? id} ${did ? 'setting' : 'coding'}`}
                subtitle={did ? `Puts back the original setting. Technical: ${did}` : 'Puts back the original coding'}
                disabled={!!busy || !checked.has(id)}
                onPress={() => setPending({ kind: 'restore', module: id })}
              />
            );
          })}
        </Group>
      ) : null}

      <Group>
        <ListRow
          first
          icon="timeline-text-outline"
          iconColour="purple"
          title="Change timeline"
          subtitle={Object.keys(originals).length ? 'Every change made to this car, with old and new values. Put one back or share the list.' : 'No changes yet. Each setting you change is listed here.'}
          onPress={() => router.push({ pathname: '/customise/timeline', params: { vin: v.vin } })}
        />
      </Group>

      {unreachable.length ? (
        <Group
          header="Not reachable on this car yet"
          help={SECTIONS.customiseUnreachable}
          footer="These settings live in modules that did not answer Caristini on this car, or whose coding is not the length the sources describe, so they are not offered."
        >
          {unreachable.map((i, n) => (
            <ListRow key={i.id} first={n === 0} title={i.title} subtitle={MODULES.find((m) => m.id === i.module)?.name} />
          ))}
        </Group>
      ) : null}

      {cats.length ? (
        cats.map((c, k) => (
          <Group key={c.name} header={`${c.name} · guides`} help={k === 0 ? SECTIONS.customiseGuides : undefined}>
            {c.items.map((m, i) => (
              <ListRow
                key={m.id}
                first={i === 0}
                icon={CATEGORY_ICON[m.category] ?? 'tune-variant'}
                iconColour={m.status === 'owner' ? 'green' : 'grey'}
                title={m.title}
                subtitle={`${m.options[0]} · ${STATUS_LABEL[m.status]}`}
                onPress={() => router.push(`/customise/${m.id}`)}
              />
            ))}
          </Group>
        ))
      ) : !items.length && !learned.length ? (
        <View style={{ alignItems: 'center', paddingVertical: space.xxl * 2, paddingHorizontal: space.xl }}>
          <Mascot mood="worried" size={120} />
          <Text style={[type.title3, { color: t.text, marginTop: space.lg, textAlign: 'center' }]}>Nothing for this car yet</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: space.sm }]}>
            No public source documents settings Caristini can change on this car.
          </Text>
        </View>
      ) : null}

      <ConfirmSheet
        visible={!!ask && !pending}
        title={`Did you see ${ask?.title.toLowerCase() ?? 'the change'}?`}
        lines={['The module kept the change. Switch the ignition off and on, then check the car.', 'If nothing changed, Caristini puts the old value back and remembers it for this car.']}
        confirmLabel="Yes, it works"
        cancelLabel="No, put it back"
        neutral
        onConfirm={() => {
          const a = ask;
          setAsk(null);
          if (!a) return;
          const from = borrowed.find((s) => s.id === a.id);
          if (from) {
            // Confirmed on this car: it becomes one of this car's own switches.
            const own = { id: `learned-${Date.now()}`, title: from.title, learnedAt: new Date().toISOString(), parts: from.parts, ...(from.login ? { login: from.login } : {}) };
            garage.update(v.vin, { learned: [...(garage.latest(v.vin)?.learned ?? []), own], tried: { ...(garage.latest(v.vin)?.tried ?? {}), [own.id]: 'works' } });
          } else mark(a.id, 'works');
        }}
        onCancel={undoTry}
      />

      <ConfirmSheet
        visible={!!pending}
        title={
          pending?.kind === 'item'
            ? `Switch ${pending.on ? 'on' : 'off'}: ${pending.item.title}?`
            : pending?.kind === 'learned'
              ? `Switch ${pending.on ? 'on' : 'off'}: ${pending.setting.title}?`
              : pending?.kind === 'forget'
                ? `Forget ${pending.setting.title}?`
                : pending?.kind === 'restore'
              ? `Restore the original ${(defOf(pending.module)?.name ?? 'module').toLowerCase()} coding?`
              : ''
        }
        lines={
          pending?.warn
            ? [pending.warn, 'Caristini still saves the current coding first and puts it back if the module does not keep the change.']
            : pending?.kind === 'item'
            ? [
                'Ignition on and engine off is best.',
                `Changes the ${MODULES.find((m) => m.id === pending.item.module)?.name.toLowerCase()} coding. The current coding is saved first, and put back automatically if the module does not keep the change.`,
                ...(pending.item.confidence === 'medium' ? ['This setting comes from one community source. Check the result in the car.'] : []),
                ...(pending.item.confidence === 'low' ? ['Unconfirmed: the sources are vague. Caristini will ask whether it worked and put it back if not.'] : []),
                ...byteChange(pending.item, codings[pending.item.module], pending.on),
              ]
            : pending?.kind === 'learned'
              ? [
                  'Ignition on and engine off is best.',
                  'Writes the bytes learned from your car. The current coding is saved first, and put back automatically if a module does not keep the change.',
                ]
              : pending?.kind === 'forget'
                ? ['Removes the switch from Caristini. The car keeps whatever is set now.']
                : ['Ignition on, engine off. Puts back the coding this module had before Caristini first changed it.']
        }
        confirmLabel={pending?.warn ? 'Change anyway' : pending?.kind === 'restore' ? 'Restore' : pending?.kind === 'forget' ? 'Forget' : 'Change setting'}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && run(pending)}
      />
    </Screen>
  );
}

// The exact change, for the confirmation: "Byte 2: 0A to 0B (bit 0)".
function byteChange(item: CodingItem, coding: number[] | null | undefined, on: boolean): string[] {
  if (!coding || coding.length <= item.byte) return [];
  const before = coding[item.byte];
  const after = withItem(item, coding, on)[item.byte];
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
  return [`Technical: byte ${item.byte} changes from ${hex(before)} to ${hex(after)} (${bitsLabel(item)}).`];
}

const TRIED_TEXT: Record<TryResult, string> = { works: 'Works on your car', refused: 'Did not take', 'no-effect': 'No effect seen' };

function TriedPill({ r }: { r: TryResult }) {
  return <Pill text={TRIED_TEXT[r]} tone={r === 'works' ? 'ok' : undefined} />;
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  loading: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  // A badge always sits on its own line under the setting's name.
  badge: { flexDirection: 'row', marginTop: 4 },
  chips: { gap: space.sm, paddingBottom: space.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md + 2, paddingVertical: 7, borderRadius: 999 },
});
