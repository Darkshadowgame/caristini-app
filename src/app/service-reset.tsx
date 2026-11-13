import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { preflightCheck } from '../coding/preflight';
import { addDiary, today } from '../diary';
import { SECTIONS } from '../help';
import { addHistory } from '../history';
import { allowSleep, stayAwake } from '../keepAwake';
import { ModuleDef } from '../obd/modules';
import { Change, changedValues, describeStep, publicResets, resetFromCompare, ResetTarget, resetTargets, ServiceReset } from '../service/obdReset';
import { useConnection } from '../state';
import { MONO, radius, space, type, useTheme } from '../theme';
import { Button, ConfirmSheet, GlowCard, Group, ListRow, NeedsConnection, Notice, Pill, ProgressBar, Screen, success } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';

const spaced = (hex: string) => hex.match(/../g)?.join(' ') ?? '';

// Service reset over the OBD port: run a reset learned on this car, or learn
// one by comparing the instrument cluster before and after another tool's
// reset, or by recording another tool with Listen mode.
export default function ServiceResetScreen() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const client = conn.client;
  const v = conn.vehicle;
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger' | 'info'; text: string } | null>(null);
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [login, setLogin] = useState('');
  const [asking, setAsking] = useState<{ reset: ServiceReset; warn?: string } | null>(null);
  const [pick, setPick] = useState(0);
  // A reset being sent cannot be stopped half-way.
  const [sending, setSending] = useState(false);
  const stop = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);

  if (!client || !v) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to reset the service with the adapter" />
      </Screen>
    );
  }

  // Where the service data lives: the cluster, or on Ford and Mazda also the
  // engine computer. A saved snapshot keeps the one it was read from.
  const targets = resetTargets(v.group).filter((x) => client.moduleById(x.module));
  const target: ResetTarget | undefined = targets.find((x) => x.module === v.serviceSnapshot?.module) ?? targets[pick] ?? targets[0];
  const cluster: ModuleDef | undefined = target ? client.moduleById(target.module) : undefined;
  const olderCluster = !!cluster && client.routeOf(cluster) === 'tp20';
  const saved = v.serviceResets ?? [];
  const tries = publicResets(v);
  const busy = progress != null;

  // Every value in the service ranges of the cluster, read in the extended session.
  const readCluster = async (label: string): Promise<Record<string, string>> => {
    if (!cluster || !target) return {};
    const out: Record<string, string> = {};
    const total = target.ranges.reduce((n, [a, b]) => n + b - a + 1, 0);
    let done = 0;
    for (const [a, b] of target.ranges) {
      if (stop.current) break;
      const got = await client.sweepDids(cluster, a, b, {
        extended: true,
        cancelled: () => stop.current,
        onProgress: (p) => alive.current && setProgress({ value: (done + p * (b - a + 1)) / total, label }),
      });
      Object.assign(out, got);
      done += b - a + 1;
    }
    return out;
  };

  const save = async () => {
    if (!cluster) return;
    stop.current = false;
    setMessage(null);
    setChanges(null);
    stayAwake('service-reset');
    try {
      const values = await readCluster(`Saving the ${target!.label.toLowerCase()} values`);
      if (stop.current) return;
      if (!Object.keys(values).length) {
        setMessage({ tone: 'danger', text: `The ${target!.label.toLowerCase()} did not answer any value. Ignition on, then try again.` });
        return;
      }
      await garage.update(v.vin, { serviceSnapshot: { date: new Date().toISOString(), module: cluster.id, values } });
      success();
      setMessage({ tone: 'ok', text: `${Object.keys(values).length} values saved. Now reset the service with the other tool.` });
    } catch (e) {
      if (alive.current) setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      allowSleep('service-reset');
      if (alive.current) setProgress(null);
    }
  };

  const compare = async () => {
    const snap = v.serviceSnapshot;
    if (!cluster || !snap) return;
    // Counters move with driving and time: compare only soon after saving.
    if (Date.now() - Date.parse(snap.date) > 2 * 3600 * 1000) {
      setMessage({ tone: 'danger', text: 'The saved values are more than 2 hours old, so other values may have moved too. Save them again just before the reset.' });
      return;
    }
    stop.current = false;
    setMessage(null);
    stayAwake('service-reset');
    try {
      const now = await readCluster(`Reading the ${target!.label.toLowerCase()} again`);
      if (stop.current) return;
      const differ = Object.keys(snap.values).filter((d) => now[d] != null && now[d] !== snap.values[d]);
      // Values that change by themselves are live readings, not the reset.
      const moving = new Set<string>();
      for (let k = 0; k < 3 && differ.length; k++) {
        if (alive.current) setProgress({ value: 0.9 + k * 0.03, label: 'Checking which values move on their own' });
        await new Promise((r) => setTimeout(r, 1500));
        const s = await client.sampleDids(cluster, differ, true);
        for (const d of differ) if (s[d] && s[d].map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join('') !== now[d]) moving.add(d);
      }
      const found = changedValues(snap.values, now, { date: new Date(), since: new Date(snap.date), odometerKm: v.odometerKm }, moving);
      if (alive.current) setChanges(found);
      if (!found.length) setMessage({ tone: 'info', text: 'Nothing changed in the values Caristini can read. The reset may be a command with no stored value: record it with Listen mode.' });
    } catch (e) {
      if (alive.current) setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      allowSleep('service-reset');
      if (alive.current) setProgress(null);
    }
  };

  const keep = async () => {
    if (!cluster || !changes) return;
    const code = login ? parseInt(login, 10) : null;
    const r = resetFromCompare(changes, cluster, code);
    if (!r) {
      setMessage({ tone: 'danger', text: 'Every changed value is held back, so there is nothing safe to write. Record the reset with Listen mode.' });
      return;
    }
    await garage.update(v.vin, { serviceResets: [...saved, r], serviceSnapshot: undefined });
    setChanges(null);
    success();
    setMessage({ tone: 'ok', text: 'Saved. It shows under Resets for this car.' });
  };

  const ask = async (reset: ServiceReset) => {
    const check = await preflightCheck(client);
    if (check.block) {
      setMessage({ tone: 'danger', text: check.block });
      return;
    }
    setAsking({ reset, warn: check.warn ?? undefined });
  };

  const run = async (reset: ServiceReset) => {
    setAsking(null);
    setMessage(null);
    setSending(true);
    stayAwake('service-reset');
    try {
      setProgress({ value: 0, label: 'Resetting the service' });
      const res = await client.runServiceReset(reset, (i) => alive.current && setProgress({ value: (i + 1) / (reset.steps.length + 1), label: describeStep(reset.steps[i]) }));
      if (res.ok) {
        success();
        const title = `Service reset with the adapter (${reset.source === 'public' ? 'public method' : 'learned on this car'})`;
        await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: 'Service reset', mileage: null, notes: `${title}. ${res.log.join('; ')}` });
        await addHistory({ vin: v.vin, kind: 'service', title, detail: res.log.join('; '), odometerKm: v.odometerKm });
        if (v.service) await garage.update(v.vin, { service: { ...v.service, lastDate: new Date().toISOString().slice(0, 10), lastKm: v.odometerKm } });
        if (reset.source === 'public' && !saved.some((s) => s.id === reset.id)) await garage.update(v.vin, { serviceResets: [...saved, { ...reset, source: 'recorded', note: `${reset.note ?? ''} Worked on this car ${new Date().toLocaleDateString('en-GB')}.`.trim() }] });
        if (alive.current) setMessage({ tone: 'ok', text: 'The module accepted the reset. Switch the ignition off and on, then check the service display. Saved to History and your Diary.' });
      } else {
        const why = res.log[res.log.length - 1] ?? 'The module refused a step.';
        const notes = [
          !res.changed ? 'Nothing was changed.' : res.restored ? 'The values written were put back.' : null,
          res.routineRan ? 'A routine had already been sent; it cannot be undone.' : null,
          res.unkept.length ? `${res.unkept.join(', ')} could not be read first, so it could not be put back.` : null,
          res.changed && !res.restored ? 'Check the service display, and reset it with the other tool if it looks wrong.' : null,
        ].filter(Boolean);
        const after = notes.join(' ');
        if (alive.current) setMessage({ tone: 'danger', text: `${why} ${after}` });
      }
    } catch (e) {
      if (alive.current) setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      allowSleep('service-reset');
      if (alive.current) {
        setProgress(null);
        setSending(false);
      }
    }
  };

  const remove = (id: string) => garage.update(v.vin, { serviceResets: saved.filter((s) => s.id !== id) });

  return (
    <Screen>
      <GlowCard tone="brand" style={{ padding: space.lg }}>
        <Text style={[type.title3, { color: t.text }]}>Reset with the adapter</Text>
        <Text style={[type.sub, { color: t.muted, marginTop: 4 }]}>
          For cars whose service reminder only resets with a diagnostic tool. Caristini sends only what was learned on this car or published for it, keeps every value it changes, and puts them back if a step is refused.
        </Text>
      </GlowCard>

      {message ? <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : message.tone === 'info' ? 'information-outline' : 'alert-circle-outline'} text={message.text} /> : null}
      {progress ? (
        <View style={{ marginBottom: space.lg }}>
          <ProgressBar value={progress.value} label={progress.label} />
          {sending ? null : <Button label="Stop" variant="secondary" style={{ marginTop: space.sm }} onPress={() => (stop.current = true)} />}
        </View>
      ) : null}

      <Group header="Resets for this car" help={SECTIONS.serviceResets} footer={saved.length || tries.length ? 'Tap one to see its steps before anything is sent.' : 'None yet. Learn one below, the next time the service is reset with another tool.'}>
        {saved.map((r, i) => (
          <ListRow
            key={r.id}
            first={i === 0}
            icon="wrench-clock"
            iconColour="green"
            title={r.title}
            subtitle={`${r.steps.length} step${r.steps.length === 1 ? '' : 's'} · ${r.source === 'compared' ? 'learned by compare' : 'recorded or confirmed on this car'}`}
            disabled={busy}
            onPress={() => ask(r)}
          />
        ))}
        {tries.map((r, i) => (
          <ListRow
            key={r.id}
            first={!saved.length && i === 0}
            icon="wrench-clock"
            iconColour="orange"
            title={r.title}
            subtitle={r.note ?? 'From a public source, not yet confirmed on this car'}
            right={<Pill text="Try" />}
            disabled={busy}
            onPress={() => ask(r)}
          />
        ))}
        {!saved.length && !tries.length ? <ListRow first title="No reset learned yet" noChevron /> : null}
      </Group>

      {olderCluster ? (
        <Notice icon="information-outline" text="This car's instrument cluster uses the older VW protocol. Learning by compare reads newer-protocol values only; record the reset with Listen mode, or use a public method above if one is listed." />
      ) : null}

      {cluster && !olderCluster ? (
        <>
          {targets.length > 1 ? (
            <Group header="Where to look" help={SECTIONS.serviceWhere} footer={v.group === 'mazda' ? 'On the Skyactiv-D the oil data reset after every oil change is in the engine computer.' : 'Oil life is read from the engine computer; the service display is in the cluster.'}>
              {targets.map((x, i) => (
                <ListRow key={x.module} first={i === 0} title={x.label} selected={target?.module === x.module} noChevron disabled={busy || !!v.serviceSnapshot} onPress={() => setPick(i)} />
              ))}
            </Group>
          ) : null}
          <Group header="Learn it by compare" help={SECTIONS.serviceLearnCompare} footer={v.serviceSnapshot ? `Values saved ${new Date(v.serviceSnapshot.date).toLocaleString('en-GB')}.` : `Each read takes about ${Math.max(1, Math.round((target?.ranges.reduce((n, [a, b]) => n + b - a + 1, 0) ?? 0) * 0.07 / 60))} minutes. Ignition on, engine off.`}>
            <ListRow first icon="content-save-outline" iconColour="blue" title={`1. Save the ${target?.label.toLowerCase()} values${v.serviceSnapshot ? ' again' : ''}`} disabled={busy} onPress={save} />
            <ListRow title="2. Reset the service with Carista or another tool" subtitle="Disconnect Caristini first: one app at a time on the adapter" noChevron />
            <ListRow icon="compare-horizontal" iconColour="purple" title="3. Read again and compare" disabled={busy || !v.serviceSnapshot} onPress={compare} />
          </Group>

          {changes?.length ? (
            <>
              <Group header="What the reset changed" help={SECTIONS.serviceChanges} footer="Values held back are not written when Caristini does the reset: they hold today's date, the odometer, or change on their own.">
                {changes.map((c, i) => (
                  <View key={c.did} style={[styles.change, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <Text style={[type.body, { color: t.text, fontFamily: MONO, flex: 1 }]}>{c.did}</Text>
                      {c.hold ? <Pill text="Held back" /> : <Pill text="Written" tone="ok" />}
                    </View>
                    <Text selectable style={[type.small, { color: t.muted, fontFamily: MONO }]}>
                      {spaced(c.before)} → {spaced(c.after)}
                    </Text>
                    {c.hold ? <Text style={[type.small, { color: t.muted }]}>{c.hold}</Text> : null}
                  </View>
                ))}
              </Group>
              <Text style={[type.label, { color: t.muted, marginBottom: 6, marginLeft: space.lg }]}>LOGIN CODE (ONLY IF THE OTHER TOOL NEEDED ONE)</Text>
              <TextInput
                value={login}
                onChangeText={(x) => setLogin(x.replace(/[^0-9]/g, '').slice(0, 5))}
                placeholder="Leave empty if none"
                placeholderTextColor={t.muted}
                keyboardType="number-pad"
                selectionColor={t.accent}
                style={[type.body, styles.input, { backgroundColor: t.sunken, color: t.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
              />
              <Button label="Keep as this car's service reset" icon="check" onPress={keep} />
              <View style={{ height: space.xl }} />
            </>
          ) : null}
        </>
      ) : null}

      <Group header="Learn it by recording" help={SECTIONS.serviceLearnRecord} footer="Needs an OBD Y-splitter. Gives the exact commands, including resets that leave no stored value to compare.">
        <ListRow first icon="record-circle-outline" iconColour="red" title="Open Listen mode" subtitle="Record while Carista or VCDS resets the service, then tap Use as service reset" disabled={busy || !client.canListen} onPress={() => router.push({ pathname: '/listen', params: { purpose: 'service' } })} />
      </Group>

      {saved.length ? (
        <Group header="Remove a learned reset">
          {saved.map((r, i) => (
            <ListRow key={r.id} first={i === 0} icon="trash-can-outline" iconColour="red" title={r.title} disabled={busy} onPress={() => remove(r.id)} />
          ))}
        </Group>
      ) : null}

      <ConfirmSheet
        visible={!!asking}
        title={asking?.reset.source === 'public' ? 'Try this service reset?' : 'Reset the service?'}
        lines={[
          ...(asking?.reset.steps.map((s, i) => `${i + 1}. ${describeStep(s)}`) ?? []),
          ...(asking?.reset.note ? [asking.reset.note] : []),
          ...(asking?.reset.source === 'public' ? ['Not yet confirmed on this car. Every value changed is kept and put back if a step is refused.'] : ['Every value changed is kept and put back if a step is refused.']),
          ...(asking?.warn ? [asking.warn] : []),
        ]}
        confirmLabel={asking?.reset.source === 'public' ? 'Try it' : 'Reset'}
        neutral
        onConfirm={() => asking && run(asking.reset)}
        onCancel={() => setAsking(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  change: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2 },
  input: { borderRadius: radius.sm + 2, paddingHorizontal: space.md, paddingVertical: 10, marginBottom: space.lg },
});
