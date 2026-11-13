import { router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { faultText } from '../../obd/faultText';
import { bitsLabel, CodingItem, codingItemsFor, isOn, withItem } from '../../coding/items';
import { preflightCheck } from '../../coding/preflight';
import { groupLabels } from '../../data/groupLabels';
import { lookupDtc } from '../../data/dtcLibrary';
import { addDiary, today } from '../../diary';
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
import { Button, ConfirmSheet, Group, ListRow, NeedsConnection, Notice, Pill, Screen, success, tap } from '../../ui';
import { useGarage, vehicleTitle } from '../../vehicle/garage';
import { SECTIONS } from '../../help';
import { mergeModuleIds } from '../../vehicle/ids';

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

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
  const [confirm, setConfirm] = useState<{ kind: 'clear' | 'write' | 'restore'; warn?: string } | null>(null);
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

  if (!client || !v || !def) {
    return (
      <Screen>
        <NeedsConnection what="this module" />
      </Screen>
    );
  }

  const route = info?.route ?? client.routeOf(def);
  const kwp = route === 'tp20';
  const style = client.codingStyle(def);
  const original = v.codingOriginal?.[def.id];
  const changed = !!coding && !!draft && toHex(coding) !== toHex(draft);
  const knowledge = v.knowledge?.[def.id];
  const items: CodingItem[] = [...codingItemsFor(v.group, v.platform), ...(v.aiItems ?? [])].filter(
    (i) => i.module === def.id && !!draft && style !== 'short' && (i.length ? draft.length === i.length : draft.length > i.byte),
  );
  const bitName = (byte: number, bit: number) => items.find((i) => i.byte === byte && (i.bits.includes(bit) || (!!i.field && ((i.field.mask >> bit) & 1) === 1)))?.title;
  const imperial = { speed: settings.speed === 'mph', temp: settings.temp === '°F' };
  const modCode = def.code ?? (def.id === 'engine' ? '01' : def.id === 'gearbox' ? '02' : undefined);

  const readFaults = () => run('faults', async () => setFaults(await client.readModuleFaults(def)));
  const clearFaults = () =>
    run('clear', async () => {
      const before = faults?.faults.map((f) => f.code) ?? [];
      // Faults are cleared with the engine off, the same rule as the health check.
      const rpm = await client.readLive(pidInfo(0x0c)!).catch(() => null);
      if (rpm != null && rpm > 300) throw new Error('The engine is running. Switch it off, leave the ignition on, then clear.');
      await client.clearModuleFaults(def);
      const after = await client.readModuleFaults(def);
      if (!alive.current) return;
      setFaults(after);
      await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: 'Faults cleared', mileage: null, notes: `${def.name}: cleared ${before.join(', ') || 'fault memory'}` });
      await addHistory({ vin: v.vin, kind: 'clear', title: `${def.name} faults cleared`, detail: before.join(', ') || 'Fault memory' });
      setMessage({ tone: after.faults.length ? 'info' : 'ok', text: after.faults.length ? 'Some faults came straight back, so the cause is still there.' : 'Fault memory cleared. Saved to History and your Diary.' });
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
    setConfirm({ kind, warn: check.warn ?? undefined });
  };

  const writeCoding = (target: number[], what: string) =>
    run('write', async () => {
      if (!coding) return;
      const saved = garage.latest(v.vin)?.codingOriginal ?? {};
      if (!saved[def.id]) await garage.update(v.vin, { codingOriginal: { ...saved, [def.id]: toHex(coding) } });
      const res = await client.writeCoding(def, coding, target);
      if (!alive.current) return;
      if (res.coding) {
        setCoding(res.coding);
        setDraft(res.coding);
      }
      if (res.ok) {
        success();
        await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: 'Other', mileage: null, notes: `Workshop: ${def.name} ${what}. Coding ${toHex(coding)} to ${toHex(target)}.` });
        await addHistory({ vin: v.vin, kind: 'change', title: `${def.name} ${what}`, detail: 'Workshop', before: toHex(coding), after: toHex(target) });
        setMessage({ tone: 'ok', text: `${what.charAt(0).toUpperCase() + what.slice(1)}. Switch the ignition off and on to see it. Saved to History.` });
      } else {
        setMessage({ tone: 'danger', text: res.restored ? 'The module did not keep the change, so Caristini put the original coding back.' : 'The module did not keep the change and the original could not be confirmed. Use Restore original.' });
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
  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'faults', label: 'Faults', badge: faultCount },
    { key: 'values', label: 'Values' },
    { key: 'coding', label: 'Coding' },
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: knowledge?.plainName ?? def.name }} />

      <View style={[styles.hero, { backgroundColor: t.surface }]}>
        <View style={[styles.addr, { backgroundColor: t.accentSoft }]}>
          <Text style={[styles.addrText, { color: t.accentText }]} numberOfLines={1} adjustsFontSizeToFit>
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
        {busy === 'open' ? <ActivityIndicator color={t.muted} /> : info?.responded ? <Pill text={kwp ? 'Older system' : 'Responding'} /> : null}
      </View>

      {message ? <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : message.tone === 'info' ? 'information-outline' : 'alert-circle-outline'} text={message.text} /> : null}

      {info?.responded ? (
        <>
          <View style={[styles.segment, { backgroundColor: t.sunken }]} accessibilityRole="tablist">
            {tabs.map((x) => (
              <Pressable
                key={x.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === x.key }}
                onPress={() => {
                  tap();
                  setTab(x.key);
                }}
                style={[styles.segBtn, tab === x.key && { backgroundColor: t.surface }]}
              >
                <Text style={[type.sub, { color: t.text, fontWeight: tab === x.key ? '700' : '500' }]}>{x.label}</Text>
                {x.badge ? (
                  <View style={[styles.badge, { backgroundColor: t.danger }]}>
                    <Text style={[type.caption, { color: t.onDanger, fontWeight: '700' }]}>{x.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>

          {tab === 'faults' ? (
            <Group header="Fault memory" help={SECTIONS.moduleFaults} footer="Tap a fault for what it means and the likely causes; with AI, whether it is safe to drive.">
              {faults?.faults.map((f, i) => (
                <ListRow
                  key={`${f.code}-${i}`}
                  first={i === 0}
                  icon="alert-circle"
                  iconColour="red"
                  title={faultText(f.code) ?? (f.kwp ? `VW fault ${f.code}` : f.code)}
                  subtitle={`${f.code} · ${f.kwp ? 'stored' : f.state}`}
                  onPress={() => router.push({ pathname: '/code/[code]', params: { code: f.code, module: def.name, moduleId: def.id } })}
                />
              ))}
              {faults && !faults.faults.length ? (
                faults.state === 'ok' ? (
                  <ListRow first icon="check-circle" iconColour="green" title="No faults stored" noChevron />
                ) : (
                  <ListRow first icon="help-circle-outline" iconColour="orange" title="Could not read faults" subtitle={faults.error ?? 'The module did not answer. Try Read again with the ignition on.'} noChevron />
                )
              ) : null}
              <ListRow first={!faults} icon="refresh" iconColour="blue" title={busy === 'faults' ? 'Reading…' : 'Read again'} disabled={!!busy} onPress={readFaults} />
              {faultCount ? <ListRow icon="broom" iconColour="red" title="Clear these faults" disabled={!!busy} onPress={() => setConfirm({ kind: 'clear' })} /> : null}
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
                  footer={v.sensorScan ? 'Values this module answered in the sensor search.' : 'Values this kind of module usually has. Run All sensors > Find my car’s sensors to keep only the ones your car answers.'}
                >
                  {named.length ? (
                    <View style={[styles.pad, { flexDirection: 'row', gap: space.sm }]}>
                      <View style={{ flex: 1 }}>
                        <Button label="Read all" icon="refresh" variant="secondary" busy={busy === 'values'} disabled={!!busy || watching} onPress={readAll} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button label={watching ? 'Stop' : 'Live'} icon={watching ? 'stop' : 'play'} onPress={() => setWatching((w) => !w)} />
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
                          <Text style={[type.caption, { color: t.faint, fontFamily: MONO }]}>{r.d}</Text>
                        </View>
                        <Text style={[type.heading, type.number, { color: d ? t.text : t.faint }]} accessibilityLabel={d ? undefined : 'No reading'}>{d ? `${d.text}${d.unit ? ` ${d.unit}` : ''}` : '–'}</Text>
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
                        <TextInput
                          value={did}
                          onChangeText={setDid}
                          placeholder="F187"
                          placeholderTextColor={t.muted}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          maxLength={4}
                          selectionColor={t.accent}
                          style={[type.body, styles.input, { backgroundColor: t.sunken, color: t.text, fontFamily: MONO }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
                        />
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
                  <Group header="Settings in this coding" help={SECTIONS.moduleSettings} footer="Switches change nothing in the car until you tap Save to the car. 'Not tested on this car' ones come from a single source or the AI.">
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
                      {draft.reduce((n, b, k) => n + (b !== coding[k] ? 1 : 0), 0)} byte{draft.reduce((n, b, k) => n + (b !== coding[k] ? 1 : 0), 0) === 1 ? '' : 's'} changed, not saved yet
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
                              <Text style={[type.caption, { color: t.faint }]}>
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
                  {changed ? <Button label="Undo my changes" variant="ghost" onPress={() => setDraft(coding)} /> : null}
                  {original && original !== toHex(coding) ? <Button label="Restore original coding" variant="secondary" disabled={!!busy} onPress={() => askWrite('restore')} /> : null}
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
          <ListRow first icon="refresh" iconColour="blue" title="Try again" onPress={open} />
        </Group>
      ) : null}

      <ConfirmSheet
        visible={!!confirm}
        title={confirm?.kind === 'clear' ? `Clear ${def.name} faults?` : confirm?.kind === 'restore' ? 'Restore the original coding?' : `Save new ${def.name} coding?`}
        lines={[
          ...(confirm?.warn ? [confirm.warn] : []),
          ...(confirm?.kind === 'clear'
            ? ['Clears this module’s fault memory. Faults still present come back.']
            : confirm?.kind === 'restore'
              ? ['Puts back the coding this module had before Caristini first changed it.']
              : ['Caristini saves the current coding first, reads the new one back and puts the original back if the module does not keep it.', ...(items.length ? [] : ['These bits have no public names: only change bits you know from a trusted source.'])]),
        ]}
        confirmLabel={confirm?.kind === 'clear' ? 'Clear faults' : confirm?.kind === 'restore' ? 'Restore' : confirm?.warn ? 'Save anyway' : 'Save to the car'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (c?.kind === 'clear') clearFaults();
          else if (c?.kind === 'restore' && original) writeCoding(original.match(/../g)!.map((h) => parseInt(h, 16)), 'coding restored to the original');
          else if (c?.kind === 'write' && draft) writeCoding(draft, 'coding saved');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, marginBottom: space.lg },
  addr: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  addrText: { fontSize: 20, fontWeight: '800', fontFamily: MONO },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 2, marginBottom: space.lg },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  pad: { padding: space.lg },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
  value: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 11, gap: space.sm },
  setting: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 11 },
  didRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { flex: 1, borderRadius: radius.sm + 2, paddingHorizontal: space.md, paddingVertical: 10 },
  bytes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  byte: { width: 44, alignItems: 'center', paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1.5 },
  ready: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.md, paddingLeft: space.lg, marginBottom: space.lg },
});
