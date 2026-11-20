import { router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { bitsLabel, CodingItem, codingItemsFor, isOn, withItem } from '../../coding/items';
import { preflightCheck } from '../../coding/preflight';
import { groupLabels } from '../../data/groupLabels';
import { lookupDtc } from '../../data/dtcLibrary';
import { addDiary, SETTING_CHANGED, today } from '../../diary';
import { addHistory } from '../../history';
import { describeDtc } from '../../obd/dtc';
import { ModuleDetails, ModuleFaults } from '../../obd/elm';
import { displaySensor, readKey, sensorId, sensorsForCar, SensorValue } from '../../obd/sensors';
import { MeasuringCell } from '../../obd/tp20';
import { toHex } from '../../obd/uds';
import { pidInfo } from '../../obd/pids';
import { useSettings } from '../../settings';
import { useConnection } from '../../state';
import { MONO, radius, space, type, useTheme } from '../../theme';
import { TOOLS, Button, ConfirmSheet, Field, Group, ListRow, NeedsConnection, Notice, Pill, Screen, Segmented, success, tap } from '../../ui';
import { useGarage, vehicleTitle } from '../../vehicle/garage';
import { SECTIONS } from '../../help';
import { FaultRow } from '../../components/CodeRow';
import { allowSleep, stayAwake } from '../../keepAwake';
import { mergeModuleIds } from '../../vehicle/ids';
import { cacheAfterWrite } from '../../diag/timeline';

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
// Shown beside the spinner while a coding is written to the car.
const WRITING = 'Writing. Keep this page open.';

type Tab = 'faults' | 'values' | 'coding';

// One control module, laid out like a workshop tool but in plain words:
// what it is, its faults with their meaning, its values by name and its
// coding as named switches. Raw numbers stay one tap away for experts.
export default function ControlModule() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const { settings } = useSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = conn.client;
  const v = conn.vehicle;
  const def = client?.moduleById(String(id));

  const [tab, setTab] = useState<Tab>('faults');
  const [info, setInfo] = useState<ModuleDetails | null>(null);
  const [faults, setFaults] = useState<ModuleFaults | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger' | 'info'; text: string } | null>(null);
  // note: the low-battery line for the result, when a write does not save.
  const [confirm, setConfirm] = useState<{ kind: 'clear' | 'write' | 'restore'; note?: string } | null>(null);
  // Values
  const [values, setValues] = useState<Record<string, SensorValue>>({});
  const [watching, setWatching] = useState(false);
  const [did, setDid] = useState('');
  const [raw, setRaw] = useState<{ did: string; data?: number[]; error?: string } | null>(null);
  const [group, setGroup] = useState(1);
  const [cells, setCells] = useState<MeasuringCell[] | null>(null);
  const [expert, setExpert] = useState(false);
  // Coding
  const [coding, setCoding] = useState<number[] | null>(null);
  const [draft, setDraft] = useState<number[] | null>(null);
  const [openByte, setOpenByte] = useState<number | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      if (alive.current) setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const open = useCallback(async () => {
    if (!client || !def) return;
    await run('open', async () => {
      const d = await client.readModuleDetails(def);
      if (!alive.current) return;
      setInfo(d);
      if (!d.responded) return;
      // Kept for Parts and IDs, readable later without the car.
      const saved = v ? garage.latest(v.vin) : undefined;
      if (v) await garage.update(v.vin, { ids: { ...(saved?.ids ?? {}), modules: mergeModuleIds(saved?.ids?.modules, [d]) } });
      setFaults(await client.readModuleFaults(def).catch(() => null));
      const c = await client.readCoding(def).catch(() => null);
      if (alive.current && c && c.length) {
        setCoding(c);
        setDraft(c);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, def?.id]);

  useEffect(() => {
    open();
  }, [open]);

  // Named values this module has, from the sensor lists (found ones first).
  const named = useMemo(() => {
    if (!v || !def?.tx) return [];
    const found = new Set(v.sensorsFound ?? []);
    const mine = sensorsForCar(v).filter((r) => r.h === def.tx);
    return v.sensorScan ? mine.filter((r) => found.has(readKey(r))) : mine.slice(0, 60);
  }, [v, def?.tx]);

  // Live refresh of named values while the Values tab is watching.
  const focused = useIsFocused();
  useEffect(() => {
    if (!client || !watching || !named.length || tab !== 'values' || !focused) return;
    let on = true;
    (async () => {
      while (on) {
        const got = await client.readSensors(named.slice(0, 30)).catch(() => ({}) as Record<string, SensorValue>);
        if (!on) break;
        setValues((old) => ({ ...old, ...got }));
        await new Promise((r) => setTimeout(r, 500));
      }
    })();
    return () => {
      on = false;
    };
  }, [client, watching, named, tab, focused]);

  // The phone stays awake while values are watched live (src/keepAwake.ts).
  useEffect(() => {
    if (!watching) return undefined;
    stayAwake('workshop-live');
    return () => allowSleep('workshop-live');
  }, [watching]);

  if (!client || !v || !def) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to open this module" />
      </Screen>
    );
  }

  const route = info?.route ?? client.routeOf(def);
  const kwp = route === 'tp20';
  const style = client.codingStyle(def);
  const original = v.codingOriginal?.[def.id];
  const changed = !!coding && !!draft && toHex(coding) !== toHex(draft);
  const knowledge = v.knowledge?.[def.id];
  const items: CodingItem[] = [...codingItemsFor(v.group, v.platform)].filter(
    (i) => i.module === def.id && !!draft && style !== 'short' && (i.length ? draft.length === i.length : draft.length > i.byte),
  );
  const bitName = (byte: number, bit: number) => items.find((i) => i.byte === byte && (i.bits.includes(bit) || (!!i.field && ((i.field.mask >> bit) & 1) === 1)))?.title;
  const imperial = { speed: settings.speed === 'mph', temp: settings.temp === '°F' };
  const modCode = def.code ?? (def.id === 'engine' ? '01' : def.id === 'gearbox' ? '02' : undefined);

  const readFaults = () => run('faults', async () => setFaults(await client.readModuleFaults(def)));
  const clearFaults = () =>
    run('clear', async () => {
      const before = faults?.faults.map((f) => f.code) ?? [];
      // Clearing is allowed with the engine running, the same as the health check.
      await client.clearModuleFaults(def);
      // The clear has been sent, so History and the diary get their entry
      // whether or not this page is still open. Only the page's own state is
      // skipped once it has closed.
      const after = await client.readModuleFaults(def).catch(() => null);
      if (alive.current && after) setFaults(after);
      await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: 'Faults cleared', mileage: null, notes: `${def.name}: cleared ${before.join(', ') || 'fault memory'}` });
      await addHistory({ vin: v.vin, kind: 'clear', title: `${def.name} faults cleared`, detail: before.join(', ') || 'Fault memory' });
      if (!alive.current) return;
      if (!after) {
        setMessage({ tone: 'info', text: 'Faults cleared and saved to History and your diary, but the module did not answer the read after it. Tap Read again.' });
        return;
      }
      setMessage({ tone: after.faults.length ? 'info' : 'ok', text: after.faults.length ? 'Some faults came straight back, so the cause is still there.' : 'Faults cleared. Saved to History and your diary.' });
    });

  const readAll = () => run('values', async () => setValues(await client.readSensors(named)));
  const readDid = () =>
    run('did', async () => {
      const d = did.trim().toUpperCase();
      if (!/^[0-9A-F]{4}$/.test(d)) throw new Error('Type a 4-character value number, for example F187.');
      const r = await client.readRawDid(def, d);
      if (alive.current) setRaw({ did: d, ...r });
    });
  const readGroup = (g: number) =>
    run('group', async () => {
      setGroup(g);
      setCells(await client.readMeasuringBlock(def, g));
    });

  const askWrite = async (kind: 'write' | 'restore') => {
    const check = await preflightCheck(client);
    if (check.block) {
      setMessage({ tone: 'danger', text: check.block });
      return;
    }
    setConfirm({ kind, note: check.note ?? undefined });
  };

  const writeCoding = (target: number[], what: string, note?: string) =>
    run('write', async () => {
      if (!coding) return;
      const saved = garage.latest(v.vin)?.codingOriginal ?? {};
      if (!saved[def.id]) await garage.update(v.vin, { codingOriginal: { ...saved, [def.id]: toHex(coding) } });
      const res = await client.writeCoding(def, coding, target);
      // The write has returned, so the car may hold a new coding. Everything
      // kept about it (the values for this connection, the saved coding,
      // History and the diary) is written whether or not this page is still
      // open. Only the page's own state is skipped once it has closed.
      if (res.coding) {
        // Customise reuses these while connected, so it shows the new coding.
        client.sessionValues.set(def.id, res.coding);
        if (alive.current) {
          setCoding(res.coding);
          setDraft(res.coding);
        }
        // The saved coding follows the write, so Put back decides from what the module holds now.
        if (client.routeOf(def) !== 'tp20') await garage.update(v.vin, { codingCache: cacheAfterWrite(garage.latest(v.vin)?.codingCache, [{ key: def.id, hex: toHex(res.coding) }]) });
      }
      if (res.ok) {
        if (alive.current) success();
        await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: SETTING_CHANGED, mileage: null, notes: `Workshop: ${def.name} ${what}. Coding ${toHex(coding)} to ${toHex(target)}.` });
        await addHistory({ vin: v.vin, kind: 'change', title: `${def.name} ${what}`, detail: 'Workshop', before: toHex(coding), after: toHex(target), odometerKm: v.odometerKm, changes: [{ module: def.name, key: def.id, setting: what.charAt(0).toUpperCase() + what.slice(1), before: toHex(coding), after: toHex(target), backup: saved[def.id] ?? toHex(coding), source: 'Workshop' }] });
        if (alive.current) setMessage({ tone: 'ok', text: `${what.charAt(0).toUpperCase() + what.slice(1)}. Switch the ignition off and on to see it. Saved to History and your diary.` });
      } else {
        // Not kept, and the module now holds something other than before: that is a change too, so it is recorded.
        if (res.coding && toHex(res.coding) !== toHex(coding)) {
          await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: SETTING_CHANGED, mileage: null, notes: `Workshop: ${def.name} did not keep a change. Coding ${toHex(coding)} to ${toHex(res.coding)}. Check it in Workshop.` });
          await addHistory({ vin: v.vin, kind: 'change', title: `${def.name} ${what} (not kept)`, detail: 'Workshop', before: toHex(coding), after: toHex(res.coding), odometerKm: v.odometerKm, changes: [{ module: def.name, key: def.id, setting: 'Change not kept', before: toHex(coding), after: toHex(res.coding), backup: saved[def.id] ?? toHex(coding), source: 'Workshop' }] });
        }
        if (alive.current) setMessage({ tone: 'danger', text: `${res.restored ? 'The module did not keep the change, so Caristini put the original coding back.' : 'The module did not keep the change and the original could not be confirmed. Tap Put back original coding.'}${note ? ` ${note}` : ''}` });
      }
    });

  const toggleBit = (byte: number, bit: number, on: boolean) => {
    if (!draft) return;
    tap();
    const next = [...draft];
    next[byte] = on ? next[byte] | (1 << bit) : next[byte] & ~(1 << bit);
    setDraft(next);
  };

  const faultCount = faults?.faults.length ?? 0;
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'faults', label: 'Faults', badge: faultCount },
    { id: 'values', label: 'Values' },
    { id: 'coding', label: 'Coding' },
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: knowledge?.plainName ?? def.name }} />

      <View style={[styles.hero, { backgroundColor: t.surface }]}>
        {/* The address is a fact, not a control: a sunken well, as a code chip is. */}
        <View style={[styles.addr, { backgroundColor: t.sunken }]}>
          <Text style={[styles.addrText, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {v.group === 'vag' && def.code ? def.code : def.tx || '?'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.heading, { color: t.text }]}>{knowledge?.plainName ?? def.name}</Text>
          <Text style={[type.small, { color: t.muted, marginTop: 2 }]} numberOfLines={3}>
            {busy === 'open'
              ? 'Opening the module…'
              : info?.responded
                ? [info.partNumber, info.systemName, info.software ? `software ${info.software}` : null].filter(Boolean).join(' · ') || 'Answered'
                : info
                  ? 'No answer: not fitted, or not reachable from this port.'
                  : ''}
          </Text>
          {knowledge?.what ? <Text style={[type.small, { color: t.text, marginTop: 4 }]}>{knowledge.what}</Text> : null}
        </View>
        {busy === 'open' ? <ActivityIndicator color={t.muted} /> : info?.responded ? <Pill text={kwp ? 'Older VW module' : 'Responding'} /> : null}
      </View>

      {message ? <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : message.tone === 'info' ? 'information-outline' : 'alert-circle-outline'} text={message.text} /> : null}

      {info?.responded ? (
        <>
          <Segmented options={tabs} value={tab} onPick={setTab} style={{ marginBottom: space.lg }} />

          {tab === 'faults' ? (
            <Group header="Fault memory" help={SECTIONS.moduleFaults} footer="Tap a fault for what it means and, where Caristini knows them, the likely causes.">
              {faults?.faults.map((f, i) => (
                <FaultRow key={`${f.code}-${i}`} fault={f} module={def.name} moduleId={def.id} first={i === 0} />
              ))}
              {faults && !faults.faults.length ? (
                faults.state === 'ok' ? (
                  <ListRow first icon="check-circle" iconColour="green" title="No faults stored" noChevron />
                ) : (
                  <ListRow first icon="help-circle-outline" iconColour="orange" title="Could not read faults" subtitle={faults.error ?? 'The module did not answer. Try Read again with the ignition on.'} noChevron />
                )
              ) : null}
              <ListRow first={!faults} icon="refresh" iconColour={TOOLS.workshop.colour} title={busy === 'faults' ? 'Reading…' : 'Read again'} disabled={!!busy} onPress={readFaults} />
              {faultCount ? <ListRow icon="broom" iconColour="red" title={busy === 'clear' ? 'Clearing. Keep this page open.' : `Clear ${def.name} faults`} disabled={!!busy} onPress={() => setConfirm({ kind: 'clear' })} /> : null}
            </Group>
          ) : null}

          {tab === 'values' ? (
            <>
              {kwp ? (
                <Group header="Live values by group" help={SECTIONS.moduleGroups} footer="This module speaks the older VW protocol: values come in numbered groups of 4. Field names come from public sources for this car.">
                  <View style={styles.pad}>
                    <View style={styles.stepper}>
                      <Button label="−" variant="secondary" onPress={() => readGroup(Math.max(1, group - 1))} disabled={!!busy} />
                      <Text style={[type.title3, type.number, { color: t.text }]}>Group {group}</Text>
                      <Button label="+" variant="secondary" onPress={() => readGroup(Math.min(255, group + 1))} disabled={!!busy} />
                    </View>
                    <Button label="Read group" variant="secondary" busy={busy === 'group'} disabled={!!busy} onPress={() => readGroup(group)} />
                    {cells?.map((c, i) => (
                      <View key={i} style={[styles.row, { borderColor: t.border }]}>
                        <Text style={[type.body, { color: t.text, flex: 1 }]}>{groupLabels(modCode, group)?.[i] ?? `Field ${i + 1}`}</Text>
                        <Text style={[type.body, type.number, { color: t.text }]}>
                          {typeof c.value === 'number' ? (Number.isInteger(c.value) ? c.value : c.value.toFixed(1)) : c.value} {c.unit === 'raw' ? '' : c.unit}
                        </Text>
                      </View>
                    ))}
                    {cells && !cells.length ? <Text style={[type.sub, { color: t.muted, marginTop: space.sm }]}>This group is empty.</Text> : null}
                  </View>
                </Group>
              ) : (
                <Group
                  header={named.length ? `${named.length} named values` : 'Named values'}
                  help={SECTIONS.moduleNamedValues}
                  footer={v.sensorScan ? 'Values this module answered in Find my car’s sensors.' : 'Values this kind of module usually has. Run Find my car’s sensors to keep only the ones your car answers.'}
                >
                  {named.length ? (
                    <View style={[styles.pad, { flexDirection: 'row', gap: space.sm }]}>
                      <View style={{ flex: 1 }}>
                        <Button label="Read all" icon="refresh" variant="secondary" busy={busy === 'values'} disabled={!!busy || watching} onPress={readAll} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button label={watching ? 'Stop' : 'Live'} icon={watching ? 'stop' : 'play'} variant={watching ? 'secondary' : 'primary'} onPress={() => setWatching((w) => !w)} />
                      </View>
                    </View>
                  ) : null}
                  {named.map((r, i) => {
                    const val = values[sensorId(r)];
                    const d = val != null ? displaySensor(r, val, imperial) : null;
                    return (
                      <View key={sensorId(r)} style={[styles.value, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[type.body, { color: t.text }]}>{r.n}</Text>
                          <Text style={[type.caption, { color: t.muted, fontFamily: MONO }]}>{r.d}</Text>
                        </View>
                        <Text style={[type.heading, type.number, { color: d ? t.text : t.muted }]} accessibilityLabel={d ? undefined : 'No reading'}>{d ? `${d.text}${d.unit ? ` ${d.unit}` : ''}` : '–'}</Text>
                      </View>
                    );
                  })}
                  {!named.length ? <ListRow first title="No named values for this module yet" subtitle="Unknown values can find unnamed ones." onPress={() => router.push('/discover')} /> : null}
                </Group>
              )}

              {!kwp ? (
                <Group header="Expert" help={SECTIONS.moduleExpert} footer="Read any value by its 4-character number, as VCDS or ODIS show it. Read-only.">
                  {!expert ? (
                    <ListRow first icon="code-tags" iconColour="grey" title="Read a value by number" onPress={() => setExpert(true)} />
                  ) : (
                    <View style={styles.pad}>
                      <View style={styles.didRow}>
                        <Field value={did} onChange={setDid} placeholder="F187" caps="characters" mono maxLength={4} accessibilityLabel="Value number, 4 characters" style={{ flex: 1 }} />
                        <Button label="Read" variant="secondary" busy={busy === 'did'} disabled={!!busy} onPress={readDid} />
                      </View>
                      {raw ? (
                        raw.data ? (
                          <View style={{ marginTop: space.sm }}>
                            <Text style={[type.small, { color: t.muted }]}>
                              {raw.did}
                              {named.find((r) => r.d === raw.did) ? ` · ${named.find((r) => r.d === raw.did)!.n}` : ''}: {raw.data.length} bytes
                            </Text>
                            <Text selectable style={[type.body, { color: t.text, fontFamily: MONO }]}>{toHex(raw.data).match(/../g)?.join(' ') || '(empty)'}</Text>
                            <Text selectable style={[type.small, { color: t.muted, fontFamily: MONO }]}>{String.fromCharCode(...raw.data.map((b) => (b >= 0x20 && b < 0x7f ? b : 0x2e)))}</Text>
                          </View>
                        ) : (
                          <Text style={[type.sub, { color: t.danger, marginTop: space.sm }]}>
                            {raw.did}: {raw.error}
                          </Text>
                        )
                      ) : null}
                    </View>
                  )}
                </Group>
              ) : null}
            </>
          ) : null}

          {tab === 'coding' ? (
            coding && draft ? (
              <>
                {items.length ? (
                  <Group header="Settings in this coding" help={SECTIONS.moduleSettings} footer="Switches change nothing in the car until you tap Save to the car. 'Not tested on this car' ones come from a single source.">
                    {items.map((i, k) => {
                      const on = isOn(i, draft);
                      const was = isOn(i, coding);
                      return (
                        <View key={i.id} style={[styles.setting, { borderColor: t.border, borderTopWidth: k ? StyleSheet.hairlineWidth : 0 }]}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[type.body, { color: t.text, flexShrink: 1 }]}>{i.title}</Text>
                              {on !== was ? <Pill text="Changed" tone="accent" /> : null}
                            </View>
                            <Text style={[type.small, { color: t.muted }]}>
                              Byte {i.byte}, {bitsLabel(i)}
                              {i.confidence === 'low' ? ' · not tested on this car' : ''}
                            </Text>
                          </View>
                          <Switch
                            value={on}
                            onValueChange={(x) => {
                              tap();
                              setDraft(withItem(i, draft, x));
                            }}
                            trackColor={{ true: t.green, false: t.sunken }}
                            accessibilityLabel={i.title}
                          />
                        </View>
                      );
                    })}
                  </Group>
                ) : null}

                {changed ? (
                  <View style={[styles.ready, { backgroundColor: t.accentSoft }]}>
                    <Text style={[type.heading, { color: t.accentText, flex: 1 }]}>
                      {busy === 'write' ? WRITING : `${draft.reduce((n, b, k) => n + (b !== coding[k] ? 1 : 0), 0)} byte${draft.reduce((n, b, k) => n + (b !== coding[k] ? 1 : 0), 0) === 1 ? '' : 's'} changed, not saved yet`}
                    </Text>
                    <Button label="Save to the car" compact disabled={!!busy} busy={busy === 'write'} onPress={() => askWrite('write')} />
                  </View>
                ) : null}

                <Group
                  header="All bytes"
                  help={SECTIONS.moduleBytes}
                  footer={`Tap a byte to see its 8 bits; named bits say what they do, and bytes with a named bit have an amber outline.${style && style !== 'uds' ? ` This module codes over the older VW protocol (${style === 'did' ? 'the newer record' : 'the older record: changes are checked and put back if the module does not keep them'}).` : ''}`}
                >
                  <View style={styles.pad}>
                    <Text selectable style={[type.body, { color: changed ? t.accentText : t.text, fontFamily: MONO }]}>
                      {toHex(draft)}
                    </Text>
                    <View style={styles.bytes}>
                      {draft.map((b, i) => {
                        const hasName = [0, 1, 2, 3, 4, 5, 6, 7].some((bit) => bitName(i, bit));
                        return (
                          <Pressable
                            key={i}
                            accessibilityRole="button"
                            accessibilityLabel={`Byte ${i}, ${hex2(b)}`}
                            onPress={() => setOpenByte(openByte === i ? null : i)}
                            style={[styles.byte, { backgroundColor: openByte === i ? t.accentSoft : b !== coding[i] ? t.raised : t.sunken, borderColor: hasName ? t.accent : 'transparent' }]}
                          >
                            <Text style={[type.caption, { color: t.muted }]}>{i}</Text>
                            <Text style={[type.body, { color: b !== coding[i] ? t.accentText : t.text, fontFamily: MONO }]}>{hex2(b)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {openByte != null ? (
                      <View style={{ marginTop: space.md }}>
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((bit) => (
                          <View key={bit} style={[styles.row, { borderColor: t.border }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[type.body, { color: t.text }]}>{bitName(openByte, bit) ?? `Bit ${bit}`}</Text>
                              <Text style={[type.caption, { color: t.muted }]}>
                                Byte {openByte}, bit {bit}
                                {bitName(openByte, bit) ? '' : ' · no public name'}
                              </Text>
                            </View>
                            <Switch value={(draft[openByte] & (1 << bit)) !== 0} onValueChange={(on) => toggleBit(openByte, bit, on)} trackColor={{ true: t.green, false: t.sunken }} accessibilityLabel={`Byte ${openByte} bit ${bit}`} />
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </Group>

                <View style={{ gap: space.sm, marginBottom: space.xl }}>
                  <Button label="Save to the car" icon="content-save-outline" disabled={!changed || !!busy} busy={busy === 'write'} onPress={() => askWrite('write')} />
                  {busy === 'write' ? <Text style={[type.sub, { color: t.muted, textAlign: 'center' }]}>{WRITING}</Text> : null}
                  {changed ? <Button label="Undo my changes" variant="ghost" onPress={() => setDraft(coding)} /> : null}
                  {original && original !== toHex(coding) ? <Button label="Put back original coding" variant="secondary" disabled={!!busy} onPress={() => askWrite('restore')} /> : null}
                </View>
              </>
            ) : (
              <Group>
                <ListRow first icon="information-outline" iconColour="grey" title={busy ? 'Reading the coding…' : 'No coding to show'} subtitle={busy ? undefined : 'This module did not give a coding Caristini can read.'} noChevron />
              </Group>
            )
          ) : null}
        </>
      ) : info ? (
        <Group>
          <ListRow first icon="refresh" iconColour={TOOLS.workshop.colour} title="Try again" onPress={open} />
        </Group>
      ) : null}

      <ConfirmSheet
        visible={!!confirm}
        title={confirm?.kind === 'clear' ? `Clear ${def.name} faults?` : confirm?.kind === 'restore' ? 'Put back the original coding?' : `Save new ${def.name} coding?`}
        lines={[
          ...(confirm?.kind === 'clear'
            ? ['Works with the engine running. A few modules only clear with the engine off and the ignition on.', 'Clears this module’s faults. Faults that are still present come back.']
            : confirm?.kind === 'restore'
              ? ['Puts back the coding this module had before Caristini first changed it.']
              : ['Caristini saves the current coding first, reads the new one back and puts the original back if the module does not keep it.', ...(items.length ? [] : ['These bits have no public names: only change bits you know from a trusted source.'])]),
        ]}
        confirmLabel={confirm?.kind === 'clear' ? 'Clear faults' : confirm?.kind === 'restore' ? 'Put back' : 'Save to the car'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (c?.kind === 'clear') clearFaults();
          else if (c?.kind === 'restore' && original) writeCoding(original.match(/../g)!.map((h) => parseInt(h, 16)), 'original coding put back', c.note);
          else if (c?.kind === 'write' && draft) writeCoding(draft, 'coding saved', c.note);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, marginBottom: space.lg },
  addr: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  addrText: { fontSize: 20, fontWeight: '800', fontFamily: MONO },

  pad: { padding: space.lg },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
  value: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 11, gap: space.sm },
  setting: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 11 },
  didRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },

  bytes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  byte: { width: 44, alignItems: 'center', paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1.5 },
  ready: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.md, paddingLeft: space.lg, marginBottom: space.lg },
});
