import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { preflightCheck } from '../coding/preflight';
import { addDiary, today } from '../diary';
import { diaryMileage } from '../diaryCars';
import { useSettings } from '../settings';
import { SECTIONS } from '../help';
import { addHistory } from '../history';
import { allowSleep, stayAwake } from '../keepAwake';
import { ModuleDef } from '../obd/modules';
import { Change, changedValues, describeStep, publicResets, resetFromCompare, ResetTarget, resetTargets, ServiceReset } from '../service/obdReset';
import { DISTANCE_RESTARTS_NOTICE, markDoneKm, markDoneSkipsKm } from '../service/reminder';
import { useConnection } from '../state';
import { MONO, radius, space, type, useTheme } from '../theme';
import { TOOLS, Button, ConfirmSheet, Field, GlowCard, Group, Label, ListRow, NeedsConnection, Notice, Pill, ProgressBar, Screen, success, tool } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';
import { dateText, dateTimeText } from '../timeText';

const spaced = (hex: string) => hex.match(/../g)?.join(' ') ?? '';

// Service reset over the OBD port: run a reset learned on this car, or learn
// one by comparing the instrument cluster before and after another tool's
// reset, or by recording another tool with Listen mode.
export default function ServiceResetScreen() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const { settings } = useSettings();
  const client = conn.client;
  const v = conn.vehicle;
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger' | 'info'; text: string } | null>(null);
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [login, setLogin] = useState('');
  // note: the low-battery line for the result, when the reset does not save.
  const [asking, setAsking] = useState<{ reset: ServiceReset; note?: string } | null>(null);
  // The learned reset the owner asked to delete; deleted only after the confirm.
  const [removing, setRemoving] = useState<ServiceReset | null>(null);
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
      setMessage({ tone: 'ok', text: `${Object.keys(values).length} value${Object.keys(values).length === 1 ? '' : 's'} saved. Now reset the service with the other tool.` });
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
    setAsking({ reset, note: check.note ?? undefined });
  };

  const run = async (reset: ServiceReset, note?: string) => {
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
        await addDiary({ vin: v.vin, vehicleName: vehicleTitle(v), date: today(), kind: 'Service reset', ...diaryMileage(markDoneKm(v) ?? v.odometerKm, settings.speed === 'mph'), notes: `${title}. ${res.log.join('; ')}` });
        await addHistory({ vin: v.vin, kind: 'service', title, detail: res.log.join('; '), odometerKm: markDoneKm(v) ?? v.odometerKm });
        // The reminder restarts from today and the newest odometer figure (read from the car or typed).
        if (v.service) await garage.update(v.vin, { service: { ...v.service, lastDate: today(), lastKm: markDoneKm(v) } });
        if (reset.source === 'public' && !saved.some((s) => s.id === reset.id)) await garage.update(v.vin, { serviceResets: [...saved, { ...reset, source: 'recorded', note: `${reset.note ?? ''} Worked on this car ${dateText(Date.now())}.`.trim() }] });
        if (alive.current) setMessage({ tone: 'ok', text: `The module accepted the reset. Switch the ignition off and on, then check the service display. Saved to History and your diary.${v.service && markDoneSkipsKm(v) ? ` ${DISTANCE_RESTARTS_NOTICE}` : ''}` });
      } else {
        const why = res.log[res.log.length - 1] ?? 'The module refused a step.';
        const notes = [
          !res.changed ? 'Nothing was changed.' : res.restored ? 'The values written were put back.' : null,
          res.routineRan ? 'A routine had already been sent; it cannot be undone.' : null,
          res.unkept.length ? `${res.unkept.join(', ')} could not be read first, so it could not be put back.` : null,
          res.changed && !res.restored ? 'Check the service display, and reset it with the other tool if it looks wrong.' : null,
        ].filter(Boolean);
        const after = notes.join(' ');
        if (alive.current) setMessage({ tone: 'danger', text: `${why} ${after}${note ? ` ${note}` : ''}` });
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
      <GlowCard tone="plain" style={{ padding: space.lg }}>
        <Text style={[type.title3, { color: t.text }]}>Reset with the adapter</Text>
        <Text style={[type.sub, { color: t.muted, marginTop: 4 }]}>
          For cars whose service reminder only resets with a diagnostic tool. Caristini sends only what it learned on this car, keeps every value it changes, and puts them back if a step is refused.
        </Text>
      </GlowCard>

      {message ? <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : message.tone === 'info' ? 'information-outline' : 'alert-circle-outline'} text={message.text} /> : null}
      {progress ? (
        <View style={{ marginBottom: space.lg }}>
          <ProgressBar value={progress.value} label={progress.label} />
          {sending ? null : <Button label="Stop" variant="secondary" style={{ marginTop: space.sm }} onPress={() => (stop.current = true)} />}
        </View>
      ) : null}

      {/* The limit, said plainly: nothing is built in, and what learning a reset needs. */}
      {!saved.length && !tries.length ? (
        <Notice
          icon="information-outline"
          tone="info"
          text={`No reset is built in for this car yet: Caristini has no built-in service reset for any car. It can reset the service only after it has learned the reset on this car, and that needs another tool (Carista, VCDS or a garage tool) to do the reset once. ${
            !cluster
              ? 'Caristini does not know where this car keeps its service data, so the way to learn it is to record that tool with Listen mode, which needs an OBD Y-splitter.'
              : olderCluster
                ? 'On this car the only way to learn it is to record that tool with Listen mode, which needs an OBD Y-splitter.'
                : 'Learn it by compare (no extra parts), or record that tool with Listen mode, which needs an OBD Y-splitter.'
          } Until then, use the car’s own buttons where the Service page gives a method.`}
        />
      ) : null}

      <Group header="Resets for this car" help={SECTIONS.serviceResets} footer={saved.length || tries.length ? 'Tap one to see its steps before anything is sent.' : 'No resets yet. Learn one below, the next time the service is reset with another tool.'}>
        {saved.map((r, i) => (
          <ListRow
            key={r.id}
            first={i === 0}
            icon="wrench-clock"
            iconColour={TOOLS.service.colour}
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
            iconColour={TOOLS.service.colour}
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
        <Notice icon="information-outline" text="This car’s instrument cluster uses the older VW protocol. Learning by compare reads newer-protocol values only, so it is switched off for this car. Record the reset with Listen mode below." />
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
          <Group header="Learn it by compare" help={SECTIONS.serviceLearnCompare} footer={v.serviceSnapshot ? `Values saved ${dateTimeText(v.serviceSnapshot.date)}.` : `Each read takes about ${Math.max(1, Math.round((target?.ranges.reduce((n, [a, b]) => n + b - a + 1, 0) ?? 0) * 0.07 / 60))} minutes. Ignition on, engine off.`}>
            <ListRow first icon="content-save-outline" iconColour={TOOLS.service.colour} title={`1. Save the ${target?.label.toLowerCase()} values${v.serviceSnapshot ? ' again' : ''}`} disabled={busy} onPress={save} />
            <ListRow title="2. Reset the service with Carista or another tool" subtitle="Disconnect Caristini first: one app at a time on the adapter" noChevron />
            <ListRow icon="compare-horizontal" iconColour={TOOLS.service.colour} title="3. Read again and compare" disabled={busy || !v.serviceSnapshot} onPress={compare} />
          </Group>

          {changes?.length ? (
            <>
              <Group header="What the reset changed" help={SECTIONS.serviceChanges} footer="Values held back are not written when Caristini does the reset: they hold today’s date, the odometer, or change on their own.">
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
              <Label>Login code (only if the other tool needed one)</Label>
              <Field value={login} onChange={(x) => setLogin(x.replace(/[^0-9]/g, '').slice(0, 5))} placeholder="Leave empty if none" keyboard="number-pad" number accessibilityLabel="Login code" style={{ marginBottom: space.lg }} />
              <Button label="Keep as this car’s service reset" icon="check" onPress={keep} />
              <View style={{ height: space.xl }} />
            </>
          ) : null}
        </>
      ) : null}

      <Group header="Learn it by recording" help={SECTIONS.serviceLearnRecord} footer="Needs an OBD Y-splitter. Gives the exact commands, including resets that leave no stored value to compare.">
        <ListRow first icon="record-circle-outline" iconColour={TOOLS.listen.colour} title="Open Listen mode" subtitle="Record while Carista or VCDS resets the service, then tap Use as service reset" disabled={busy || !client.canListen} onPress={() => router.push({ pathname: '/listen', params: { purpose: 'service' } })} />
      </Group>

      {saved.length ? (
        <Group header="Delete a learned reset">
          {saved.map((r, i) => (
            <ListRow key={r.id} first={i === 0} icon="trash-can-outline" iconColour={TOOLS.service.colour} title={r.title} disabled={busy} onPress={() => setRemoving(r)} />
          ))}
        </Group>
      ) : null}

      <ConfirmSheet
        visible={!!removing}
        title="Delete this learned reset?"
        lines={removing ? [`${removing.title}. The car is not changed. To get the reset back you would have to learn it again.`] : []}
        confirmLabel="Delete"
        onConfirm={() => {
          const r = removing;
          setRemoving(null);
          if (r) void remove(r.id);
        }}
        onCancel={() => setRemoving(null)}
      />

      <ConfirmSheet
        visible={!!asking}
        title={asking?.reset.source === 'public' ? 'Try this service reset?' : 'Reset the service?'}
        lines={[
          ...(asking?.reset.steps.map((s, i) => `${i + 1}. ${describeStep(s)}`) ?? []),
          ...(asking?.reset.note ? [asking.reset.note] : []),
          ...(asking?.reset.source === 'public' ? ['Not yet confirmed on this car. Every value changed is kept and put back if a step is refused.'] : ['Every value changed is kept and put back if a step is refused.']),
        ]}
        confirmLabel={asking?.reset.source === 'public' ? 'Try it' : 'Reset'}
        neutral
        onConfirm={() => asking && run(asking.reset, asking.note)}
        onCancel={() => setAsking(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  change: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2 },

});
