import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Mascot } from '../../brand/Mascot';
import { bitsLabel, CodingItem, codingItemsFor, isOn, stateText, withItem } from '../../coding/items';
import { LearnedSetting, learnedIsOn, learnedKeys, learnedModules, learnedReady, splitKey, withLearned } from '../../coding/learn';
import { settingKey, sharedFits, sharedLearned } from '../../coding/shared';
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
import { TOOLS, Chips, ConfirmSheet, GlowCard, Group, Icon, ListRow, NeedsConnection, Notice, Pill, Screen, success, tap, tool } from '../../ui';
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


// A switch writes at once (kinds item and learned go straight to run). Only
// Forget and Put back ask first, through the confirm sheet.
type Pending =
  | { kind: 'item'; item: CodingItem; on: boolean }
  | { kind: 'learned'; setting: LearnedSetting; on: boolean }
  | { kind: 'forget'; setting: LearnedSetting }
  | { kind: 'restore'; module: string; top?: boolean }
  | null;

// Shown beside the spinner while a change is written to the car.
const WRITING = 'Writing. Keep this page open.';
// Where the result of a put back from Backups shows: beside Backups.
const RESTORE_MSG = 'restore';

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
      // A value written during this read is newer than what was read: keep it.
      if (out[id] && !written.current.has(id)) client.sessionValues.set(id, out[id]!);
      done.add(id);
      if (!written.current.has(id)) setCodings((old) => ({ ...old, [id]: out[id] }));
      setChecked(new Set(done));
    }
    setReading(false);
    if (v) {
      const cache = Object.fromEntries(Object.entries(out).filter(([k, c]) => !!c && c.length > 0 && !written.current.has(k)).map(([k, c]) => [k, toHex(c!)]));
      // Built on the newest saved copy, not the one this read started with: a
      // switch flipped while other modules were still being read has saved its
      // new coding since, and the old copy would put the old bytes back.
      garage.update(v.vin, { codingCache: { ...(garage.latest(v.vin)?.codingCache ?? {}), ...cache } });
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
    else setPending({ kind: 'restore', module: wantRestore, top: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantRestore, reading, checked]);

  if (!v) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to change its settings" />
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
    // Offered whenever the coding holds the byte. A coding longer or shorter
    // than the source car's is noted under Technical, not hidden.
    return c.length > i.byte;
  };
  const available = items.filter(ready);
  const unreachable = items.filter((i) => !reading && checked.has(i.module) && !ready(i));
  const restorable = moduleIds.filter((id) => originals[id] && codings[id] && toHex(codings[id]!) !== originals[id]);

  // Checks every change must pass before Caristini writes anything.
  const preflight = () => preflightCheck(client);
  const tried = v.tried ?? {};
  const mark = (id: string, r: TryResult) => garage.update(v.vin, { tried: { ...(garage.latest(v.vin)?.tried ?? {}), [id]: r } });

  const run = async (p: Exclude<Pending, null>) => {
    setPending(null);
    if (!client) return;
    // The result shows under the switch that was used; a put back shows beside
    // Backups, or at the top when it was opened from the change timeline.
    let runId = p.kind === 'item' ? p.item.id : p.kind === 'restore' ? (p.top ? undefined : RESTORE_MSG) : p.setting.id;
    if (p.kind === 'forget') {
      await garage.update(v.vin, { learned: learned.filter((s) => s.id !== p.setting.id) });
      return;
    }
    const ids = p.kind === 'item' ? [p.item.module] : p.kind === 'learned' ? learnedKeys(p.setting) : [p.module];
    if (ids.some((id) => !codings[id])) return;
    setBusy(p.kind === 'item' ? p.item.id : p.kind === 'learned' ? p.setting.id : p.top ? `restore-top-${p.module}` : `restore-${p.module}`);
    setMessage(null);
    try {
      // Read for the result line only: nothing stops or delays the write.
      const check = await preflight();
      const lowBattery = check.note ? ` ${check.note}` : '';
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
            : `${defOf(p.module)?.name} original ${splitKey(p.module).did ? 'setting' : 'coding'} put back`;
      const notes: string[] = [];
      const done: { key: string; before: number[]; after: number[] }[] = [];
      const settingId = p.kind === 'item' ? p.item.id : p.kind === 'learned' ? p.setting.id : null;
      // Set when a module did not keep the change: the text to show.
      let failed: string | null = null;
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
        let res: Awaited<ReturnType<typeof client.writeCoding>>;
        try {
          res = did ? await client.writeDid(def, did, before, after, login) : await client.writeCoding(def, before, after, login);
        } catch (e) {
          // A write that broke off (the link dropped, say): what the modules
          // before it took is still recorded below.
          failed = `${def.name}: ${e instanceof Error ? e.message : String(e)}${notes.length ? ' Modules changed before it keep the new setting; switch it off again to undo them.' : ''} Tap Read settings again to see what the car holds now.`;
          break;
        }
        // The write has returned, so the car may hold a new value. Everything
        // kept about it (the values for this connection, the saved coding,
        // History and the diary) is written whether or not this page is still
        // open. Only the page's own state is skipped once it has closed.
        if (res.coding) {
          written.current.add(moduleId);
          client.sessionValues.set(moduleId, res.coding);
          if (alive.current) setCodings((old) => ({ ...old, [moduleId]: res.coding }));
          // The saved coding follows each write, so Put back decides from what the module holds now.
          await garage.update(v.vin, { codingCache: cacheAfterWrite(garage.latest(v.vin)?.codingCache, [{ key: moduleId, hex: toHex(res.coding) }]) });
        }
        if (!res.ok) {
          if (settingId && p.kind !== 'restore' && p.on) await mark(settingId, 'refused');
          // The module holds something other than before: that is a change too.
          if (res.coding && toHex(res.coding) !== toHex(before)) done.push({ key: moduleId, before, after: res.coding });
          failed = res.restored
            ? `${def.name} did not keep the change, so Caristini put its original coding back.${notes.length ? ' Modules changed before it keep the new setting; switch it off again to undo them.' : ' Nothing has changed.'}${lowBattery}`
            : `${def.name} did not keep the change, and Caristini could not confirm the original is back. With the ignition on, Tap Put back under Backups in Customise.${lowBattery}`;
          break;
        }
        notes.push(`${def.name} ${did ? `value ${did}` : 'coding'} ${toHex(before)} to ${toHex(after)}`);
        done.push({ key: moduleId, before, after });
      }
      // Nothing in the car changed: no record to keep.
      if (failed && !done.length) {
        if (alive.current) setMessage({ id: runId, tone: 'danger', text: failed });
        return;
      }
      if (!failed && alive.current) success();
      await addDiary({
        vin: v.vin,
        vehicleName: vehicleTitle(v),
        date: today(),
        kind: SETTING_CHANGED,
        mileage: null,
        notes: failed ? `Part changed: ${what}. ${notes.join('; ') || 'A module did not keep the change'}. Check it in Customise.` : p.kind === 'restore' ? `${what}.` : `Changed: ${what}. Put it back in Customise, then Backups.`,
      });
      // One line per module for the change timeline, with the backup each came from.
      const setting = p.kind === 'item' ? p.item.title : p.kind === 'learned' ? p.setting.title : 'Put back original';
      const value = p.kind === 'restore' ? undefined : { from: p.on ? 'Off' : 'On', to: p.on ? 'On' : 'Off' };
      await addHistory({
        vin: v.vin,
        kind: 'change',
        title: `${what.charAt(0).toUpperCase() + what.slice(1)}${failed ? ' (part done)' : ''}`,
        detail: done.map((d) => defOf(d.key)?.name).join(', '),
        before: done.map((d) => toHex(d.before)).join(' '),
        after: done.map((d) => toHex(d.after)).join(' '),
        odometerKm: v.odometerKm,
        changes: done.map((d) => ({ module: defOf(d.key)?.name ?? d.key, key: d.key, setting, ...value, before: toHex(d.before), after: toHex(d.after), backup: backups[d.key], source: 'Customise' })),
      });
      if (failed) {
        if (alive.current) setMessage({ id: runId, tone: 'danger', text: `${failed} Saved to History and your diary.` });
        return;
      }
      // A setting from another of your cars that this car's module kept joins
      // this car's own learned list (it then shows under Learned from your car).
      if (p.kind === 'learned' && p.on) {
        const from = borrowed.find((s) => s.id === p.setting.id);
        const now = garage.latest(v.vin)?.learned ?? [];
        if (from && !now.some((s) => settingKey(s) === settingKey(from))) {
          const own: LearnedSetting = { id: `learned-${Date.now()}`, title: from.title, learnedAt: new Date().toISOString(), parts: from.parts, ...(from.login ? { login: from.login } : {}) };
          await garage.update(v.vin, { learned: [...now, own] });
          runId = own.id;
        }
      }
      // No question after a change: the switch itself puts it back.
      if (alive.current) setMessage({ id: runId, tone: 'ok', text: `${what}. Switch the ignition off and on to see it. Saved to History and your diary.` });
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

  // Which cars have built-in switches, said plainly on a car that has none.
  const noSwitches =
    v.group !== 'vag'
      ? `Caristini has built-in switches for VW group cars only (VW, Audi, SEAT, Skoda and Cupra). Your ${v.brand || 'car'} has none yet.${client?.supportsModules ? ' You can still teach Caristini a setting: change it once in Carista and Caristini learns what changed.' : ''}${mods.length ? ' The guides below show what can be changed and how.' : ''}`
      : !v.platform
        ? `Caristini has built-in switches for VW group cars whose model it knows, and it does not know this car’s model yet. Set the model under Your cars, or run Learn my car.${client?.supportsModules ? ' You can still teach Caristini a setting from Carista.' : ''}`
        : `Caristini has no built-in switches for the ${v.model || v.brand} yet.${client?.supportsModules ? ' You can still teach Caristini a setting: change it once in Carista and Caristini learns what changed.' : ''}`;
  // Ways to add a setting. First on the page for a car with no built-in switches.
  const moreGroup = (
    <Group
      header="Get more settings"
      help={SECTIONS.customiseMore}
      footer="A switch appears only where a source, or your own car, shows which coding bit does what."
    >
      {client?.supportsModules ? (
        <ListRow first {...tool('learnSetting')} title="Learn from Carista" subtitle="Change a setting in Carista; Caristini learns what changed" onPress={() => router.push('/customise/learn')} />
      ) : null}
      <ListRow first={!client?.supportsModules} {...tool('learn')} title="Learn my car" subtitle="Finds every module and reads its part number and coding" onPress={() => router.push('/learn-car')} />
      <ListRow icon="refresh" iconColour={TOOLS.customise.colour} title="Read settings again" subtitle="Settings are kept while connected; this reads them fresh" disabled={reading} onPress={() => read(true)} />
    </Group>
  );

  return (
    <Screen>
      {items.length || learned.length ? (
        <GlowCard tone={reading || busy ? 'brand' : 'plain'} style={styles.hero}>
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

      {/* A put back opened from the change timeline: the user is at the top of the page. */}
      {busy?.startsWith('restore-top-') ? (
        <View style={styles.loading}>
          <ActivityIndicator color={t.muted} />
          <Text style={[type.sub, { color: t.muted, flex: 1 }]}>{WRITING}</Text>
        </View>
      ) : null}

      {/* No built-in switches for this car: say so, and put the way to add one first. */}
      {!items.length ? (
        <>
          <Notice icon="information-outline" tone="info" text={noSwitches} />
          {moreGroup}
        </>
      ) : null}

      {moduleIds.length && reading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={t.muted} />
          <Text style={[type.sub, { color: t.muted, flex: 1 }]}>
            Checking the current settings ({checkedModules} of {modulesWithSettings} module{modulesWithSettings === 1 ? '' : 's'} with settings). Each switch unlocks when its module has answered.
          </Text>
        </View>
      ) : null}

      {groups.length + (unconfirmed.length ? 1 : 0) + (learned.length ? 1 : 0) > 1 ? (
        // Counts show once every module has answered, so they do not jump.
        <Chips
          scroll
          options={[
            { id: '', label: 'All', n: available.length + learnedReadyList.length },
            ...groups.map((g) => ({ id: g, label: g, n: confirmed.filter((i) => i.category === g).length })),
            ...(unconfirmed.length ? [{ id: 'Try these (not confirmed)', label: 'Try these', n: unconfirmed.length }] : []),
            ...(learned.length ? [{ id: 'Learned', label: 'Learned', n: learnedReadyList.length }] : []),
          ].map((c) => ({ id: c.id, label: c.label, count: reading ? undefined : c.n }))}
          value={cat ?? ''}
          onPick={(id) => setCat(id || null)}
        />
      ) : null}

      {[...groups.map((g) => ({ g, list: confirmed.filter((i) => i.category === g) })), ...(unconfirmed.length ? [{ g: 'Try these (not confirmed)', list: unconfirmed }] : [])]
        .filter(({ g }) => !cat || cat === g)
        .map(({ g, list }, k) => (
        <Group
          key={g}
          header={g}
          help={g === 'Try these (not confirmed)' ? SECTIONS.customiseTry : k === 0 ? SECTIONS.customiseSettings : undefined}
          footer={g === 'Try these (not confirmed)' ? 'One vague source each. Caristini writes the change and checks the module kept it. Switch it back off if you see no effect.' : undefined}
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
                            <Text style={[type.small, { color: t.muted, marginTop: 4 }]}>
                              {defOf(i.module)?.name ?? i.module}, byte {i.byte}, {bitsLabel(i)}
                              {i.length && codings[i.module] && codings[i.module]!.length !== i.length ? `. The source car’s coding is ${i.length} bytes; yours is ${codings[i.module]!.length}, so check the result in the car.` : ''}
                            </Text>
                            <Pressable accessibilityRole="link" hitSlop={6} onPress={() => Linking.openURL(i.sources[0].url)} style={{ marginTop: 6 }}>
                              <Text style={[type.small, { color: t.accentText }]}>Source: {i.sources[0].label}</Text>
                            </Pressable>
                          </>
                        ) : null}
                      </>
                    ) : (
                      // The whole description shows; it is never cut short.
                      <Text style={[type.small, { color: t.muted, marginTop: 1 }]}>{stateText(i, on)}</Text>
                    )}
                    {message?.id === i.id ? <Text style={[type.small, { color: message.tone === 'ok' ? t.ok : t.danger, marginTop: 4 }]}>{message.text}</Text> : null}
                    {working ? <Text style={[type.small, { color: t.muted, marginTop: 4 }]}>{WRITING}</Text> : null}
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
                        run({ kind: 'item', item: i, on: next });
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
          header="Older VW modules on this car"
          footer="A switch shows only where a public source says which coding bit does what. For a module with none yet, open it to read and change its coding bit by bit, or run Learn my car below to look its settings up."
        >
          {v.deepFound.map((d, n) => {
            const count = available.filter((i) => i.module === d.moduleId).length;
            return (
              <ListRow
                key={d.address}
                first={n === 0}
                {...tool('module')}
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
          footer="Learned on another of your cars with the same module, and not yet tried on this one. Caristini backs up, writes the change and checks the module kept it. A setting the module keeps moves to Learned from your car. Switch it back off if you see no effect."
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
                  {working ? <Text style={[type.small, { color: t.muted, marginTop: 4 }]}>{WRITING}</Text> : null}
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
                      run({ kind: 'learned', setting: s, on: next });
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
                  {working ? <Text style={[type.small, { color: t.muted, marginTop: 4 }]}>{WRITING}</Text> : null}
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
                      run({ kind: 'learned', setting: s, on: next });
                    }}
                  />
                )}
              </View>
            );
          })}
        </Group>
      ) : null}

      {items.length ? moreGroup : null}

      {kbNotes.length ? (
        <Group header="From Research notes" footer="Not confirmed on a car, so Caristini does not offer these as switches.">
          {kbNotes.map((n, i) => (
            <ListRow key={n.id} first={i === 0} icon="note-text-outline" iconColour="grey" title={n.title} subtitle={n.summary} noChevron />
          ))}
        </Group>
      ) : null}

      {/* The result of a put back shows here, where it was tapped, and stays when the Backups list empties. */}
      {message?.id === RESTORE_MSG ? <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : 'alert-circle-outline'} text={message.text} /> : null}

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
                title={`Put back ${defOf(id)?.name ?? id} ${did ? 'setting' : 'coding'}`}
                subtitle={busy === `restore-${id}` ? WRITING : did ? `The original setting. Technical: ${did}` : 'The original coding'}
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
          {...tool('timeline')}
          title="Change timeline"
          subtitle={Object.keys(originals).length ? 'Every change made to this car, with old and new values. Put one back or share the list.' : 'No changes yet. Each setting you change is listed here.'}
          onPress={() => router.push({ pathname: '/customise/timeline', params: { vin: v.vin } })}
        />
      </Group>

      {unreachable.length ? (
        <Group
          header="Not reachable on this car yet"
          help={SECTIONS.customiseUnreachable}
          footer="These settings live in modules that did not give Caristini their coding on this car. Tap Read settings again with the ignition on."
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
        visible={!!pending}
        title={
          pending?.kind === 'forget'
            ? `Forget ${pending.setting.title}?`
            : pending?.kind === 'restore'
              ? 'Put back the original coding?'
              : ''
        }
        lines={pending?.kind === 'forget' ? ['Removes the switch from Caristini. The car keeps whatever is set now.'] : [`Puts back the coding ${(defOf(pending?.kind === 'restore' ? pending.module : '')?.name ?? 'this module')} had before Caristini first changed it.`]}
        confirmLabel={pending?.kind === 'forget' ? 'Forget' : 'Put back'}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && run(pending)}
      />
    </Screen>
  );
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

});
