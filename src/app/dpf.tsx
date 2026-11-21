// DPF monitor for diesels. Logic and sources: src/monitors/dpf.ts.
import { alertBuzz } from '../sound';
import { useStayAwake } from '../keepAwake';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { SECTIONS } from '../help';
import { DpfPlan, dpfPlan, RegenEvent, regenMinutes, trackRegen } from '../monitors/dpf';
import { loadRegens, mergeRegens, ownerSource, saveRegens } from '../monitors/dpfStore';
import { clockText, dateText, dateTimeText } from '../timeText';
import { formatExtra } from '../obd/extras';
import { displaySensor, readKey, sensorId, sensorsForCar, SensorValue } from '../obd/sensors';
import { toUserUnits, useSettings } from '../settings';
import { useConnection } from '../state';
import { space, type, useTheme } from '../theme';
import { Button, GlowCard, Group, IconName, ListRow, NeedsConnection, Notice, Screen } from '../ui';

// How often the monitor reads while open. Each pass is a few requests to the
// engine computer, so a slow pace leaves the adapter free for other screens.
const EVERY_MS = 15000;

export default function Dpf() {
  const t = useTheme();
  const conn = useConnection();
  const client = conn.client;
  const { settings } = useSettings();
  const [plan, setPlan] = useState<DpfPlan | null>(null);
  const [watching, setWatching] = useState(false);
  const [maker, setMaker] = useState<Record<string, number>>({});
  const [standard, setStandard] = useState<Record<number, number | null>>({});
  // The car's own DPF sensors (found by Find my car's sensors or Learn my car).
  const [own, setOwn] = useState<Record<string, SensorValue>>({});
  const [events, setEvents] = useState<RegenEvent[]>([]);
  const [readAt, setReadAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const diesel = conn.info?.diesel || conn.vehicle?.fuel === 'Diesel';
  const group = conn.vehicle?.group ?? 'other';
  const v = conn.vehicle;
  const foundKey = (v?.sensorsFound ?? []).join();
  // Regenerations seen on earlier visits, kept on the phone for this car.
  const [past, setPast] = useState<RegenEvent[]>([]);
  const carVin = v?.vin ?? null;
  useEffect(() => {
    let on = true;
    setPast([]);
    if (carVin) loadRegens(carVin).then((l) => on && setPast(l), () => undefined);
    return () => {
      on = false;
    };
  }, [carVin]);
  // Saved as each one starts and ends, so leaving the page keeps them.
  useEffect(() => {
    if (carVin && events.length) void saveRegens(carVin, events);
  }, [carVin, events]);

  useEffect(() => {
    setPlan(null);
    if (!client) return;
    const found = new Set(v?.sensorsFound ?? []);
    const mine = sensorsForCar(v).filter((r) => found.has(readKey(r)));
    client.supportedPids().then(
      (s) => setPlan(dpfPlan(group, s, mine)),
      () => setPlan(dpfPlan(group, new Set(), mine)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, group, foundKey]);

  useEffect(() => {
    if (!watching || !client || !plan) return;
    let alive = true;
    let was: boolean | null = null;
    const tick = async () => {
      const got = client.supportsModules && plan.maker.length ? await client.readExtras(plan.maker).catch(() => ({}) as Record<string, number>) : {};
      const std: Record<number, number | null> = {};
      for (const p of plan.standard) std[p.pid] = await client.readLive(p).catch(() => null);
      const mineNow = client.supportsModules && plan.found.length ? await client.readSensors(plan.found, () => !alive).catch(() => ({}) as Record<string, SensorValue>) : {};
      if (!alive) return;
      setOwn(mineNow);
      setMaker(got);
      setStandard(std);
      setReadAt(Date.now());
      if (plan.regen) {
        const on = got[plan.regen.id] != null ? got[plan.regen.id] > 0 : null;
        if (on && was === false) alertBuzz('warn');
        if (on != null) was = on;
        setEvents((e) => trackRegen(e, on, Date.now()));
      }
    };
    tick();
    const id = setInterval(tick, EVERY_MS);
    const clock = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(clock);
    };
  }, [watching, client, plan]);

  if (!client) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to watch the DPF" />
      </Screen>
    );
  }
  if (!diesel) {
    return (
      <Screen>
        <Notice icon="information-outline" text="This car is not a diesel, so it has no diesel particulate filter to watch." />
      </Screen>
    );
  }

  // No regeneration value known (Audi A6) and none of the car's own DPF
  // sensors found yet: point to the sensor search first.
  const unknown = !!plan && !plan.regen && !plan.found.length;
  const canRead = !!plan && (plan.standard.length > 0 || plan.maker.length > 0 || plan.found.length > 0);
  const imperial = { speed: settings.speed === 'mph', temp: settings.temp === '°F' };
  const regenOn = plan?.regen && maker[plan.regen.id] != null ? maker[plan.regen.id] > 0 : null;
  const open = events.length && events[events.length - 1].end == null ? events[events.length - 1] : null;
  const shown = plan ? plan.maker.filter((e) => maker[e.id] != null && e.id !== plan.regen?.id) : [];
  const dist = (km: number) => {
    const u = toUserUnits(km, 'km', settings);
    return `${u.value.toFixed(u.value < 100 ? 1 : 0)} ${u.unit}`;
  };
  const value = (id: string) => {
    const e = plan?.maker.find((x) => x.id === id);
    const v = maker[id];
    if (!e || v == null) return '';
    return e.unit === 'km' ? dist(v) : formatExtra(e, v, { temp: settings.temp });
  };

  return (
    <Screen>
      <WakeWhile on={watching} />
      <GlowCard tone={regenOn ? 'fault' : regenOn === false ? 'ok' : 'plain'} style={{ padding: space.xl, marginBottom: space.xl }}>
        <Text style={[type.label, { color: t.muted }]}>Regeneration</Text>
        <Text style={[type.title, { color: t.text, marginTop: space.xs }]}>
          {!plan?.regen && plan?.found.length ? (watching ? 'Your car’s DPF values' : 'Not read yet') : !plan?.regen ? 'Not known for this car' : !watching && regenOn == null ? 'Not read yet' : regenOn == null ? 'No answer' : regenOn ? 'Running now' : 'Not running'}
        </Text>
        <Text style={[type.sub, { color: t.muted, marginTop: space.sm }]}>
          {regenOn
            ? `Keep driving at a steady speed and do not switch off until it ends.${open ? ` Running for ${Math.max(1, Math.round(regenMinutes(open, now)))} min.` : ''}`
            : watching
              ? `Reads every ${EVERY_MS / 1000} seconds while this page is open.${readAt ? ` Last read ${clockText(readAt)}.` : ''}`
              : unknown
                ? 'Pin16 does not know where this car keeps it. Find my car’s sensors can look for its own DPF values, such as soot mass and distance since the last regeneration.'
                : plan?.found.length
                  ? `Reads the ${plan.found.length} DPF value${plan.found.length === 1 ? '' : 's'} found on your car (Live data, Diesel filter and exhaust). Tap Start watching.`
                  : `Tap Start watching to read the filter now and every ${EVERY_MS / 1000} seconds.`}
        </Text>
      </GlowCard>

      <View style={{ marginBottom: space.xl, gap: space.sm }}>
        {unknown ? <Button label="Find my car’s sensors" icon={'radar' as IconName} onPress={() => router.push('/sensors')} /> : null}
        {!unknown || canRead ? (
          <Button
            label={watching ? 'Stop' : unknown ? 'Read the values Pin16 knows' : 'Start watching'}
            icon={watching ? 'stop' : 'bell-alert-outline'}
            variant={watching || unknown ? 'secondary' : 'primary'}
            disabled={!plan}
            onPress={() => setWatching((w) => !w)}
          />
        ) : null}
      </View>

      {plan?.notKnown.length ? (
        <Group header="Not known for this car">
          {plan.notKnown.map((line, i) => (
            <ListRow key={line} first={i === 0} title={line} />
          ))}
        </Group>
      ) : null}

      {plan && (plan.standard.length || shown.length || plan.found.length) ? (
        <Group header="Values" help={SECTIONS.monDpfValues} footer={readAt ? undefined : 'Values appear after the first read.'}>
          {plan.standard.map((p, i) => (
            <ListRow
              key={p.pid}
              first={i === 0}
              title={p.label}
              subtitle={`Standard value ${p.pid.toString(16).toUpperCase()}`}
              value={standard[p.pid] == null ? (readAt ? 'No answer' : '–') : `${standard[p.pid]!.toFixed(2)} kPa`}
            />
          ))}
          {shown.map((e, i) => (
            <ListRow key={e.id} first={!plan.standard.length && i === 0} title={e.label} subtitle={ownerSource(e.source)} value={value(e.id)} />
          ))}
          {plan.found.map((r, i) => {
            const val = own[sensorId(r)];
            const d = val != null ? displaySensor(r, val, imperial) : null;
            return (
              <ListRow
                key={sensorId(r)}
                first={!plan.standard.length && !shown.length && i === 0}
                title={r.n}
                subtitle="Found on your car"
                value={d ? `${d.text}${d.unit ? ` ${d.unit}` : ''}${d.check ? ' (check)' : ''}` : readAt ? 'No answer' : '–'}
              />
            );
          })}
        </Group>
      ) : plan && readAt && !shown.length && !plan.standard.length && !plan.found.length ? (
        <Notice icon="information-outline" text={`Your car did not answer any of the ${plan.maker.length} known DPF values.`} />
      ) : null}

      {events.length || past.length ? (
        <Group header="Regenerations seen while watching" footer="Kept on this phone for this car. Only regenerations that ran while this page was watching are listed.">
          {[...mergeRegens(past, events)].reverse().map((e, i) => (
            <ListRow
              key={e.start}
              first={i === 0}
              title={`Started ${dateTimeText(e.start)}`}
              value={e.end ? `${Math.max(1, Math.round(regenMinutes(e, now)))} min` : events.some((x) => x.start === e.start) ? 'Running' : 'End not seen'}
            />
          ))}
        </Group>
      ) : null}
    </Screen>
  );
}

// Keeps the phone awake only while watching.
function WakeWhile({ on }: { on: boolean }) {
  return on ? <Awake /> : null;
}
function Awake() {
  useStayAwake('dpf');
  return null;
}
