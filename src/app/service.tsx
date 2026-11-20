import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDiary, parseUkDate, today, ukDate } from '../diary';
import { diaryMileage } from '../diaryCars';
import { addHistory } from '../history';
import { Make, MAKES, methodsFor, PROCEDURES } from '../service/procedures';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { TOOLS, Body, Button, Card, Field, Heading, Icon, Label, Notice, Pill, Screen, Segmented, Step, success, tool } from '../ui';
import { describeDue, fromKm, markDoneKm, odometerNow, odometerAgeDays, PLANS, planLabel, shouldStoreTypedOdometer, typedService, vehicleServiceDue } from '../service/reminder';
import { extrasFor } from '../obd/extras';
import { useSettings } from '../settings';
import { Group, ListRow } from '../ui';
import { useGarage, Vehicle, vehicleTitle } from '../vehicle/garage';
import { SECTIONS } from '../help';
import { dateText } from '../timeText';

export default function Service() {
  const t = useTheme();
  const conn = useConnection();
  const detected = conn.vehicle && conn.vehicle.group !== 'other' ? (conn.vehicle.group as Make) : null;
  const [picked, setPicked] = useState<Make>(detected ?? 'vag');
  const make = detected ?? picked;
  const guide = PROCEDURES[make];
  const methods = methodsFor(make, make === detected ? conn.vehicle?.platform : null);
  const [logged, setLogged] = useState<string | null>(null);
  const garage = useGarage();
  const { settings } = useSettings();
  // The reminder is for the connected car, or for the last car when no
  // adapter is connected.
  const v = conn.vehicle ?? garage.vehicles[0];
  const plan = v?.service;
  // The newer of the reading from the car and the figure typed below.
  const { due, odo: odoNow, distanceStale } = vehicleServiceDue(v);
  const odo = odoNow?.km;
  const miles = settings.speed === 'mph';
  const unitWord = miles ? 'miles' : 'km';
  // Typed fields: the last service and the odometer now, in the unit from
  // Settings. They follow what is saved for the car.
  const [lastDateText, setLastDateText] = useState('');
  const [lastText, setLastText] = useState('');
  const [odoText, setOdoText] = useState('');
  const [typedNote, setTypedNote] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  // Set when the owner changes the Odometer field, so a prefilled figure is not stored again.
  const [odoEdited, setOdoEdited] = useState(false);
  // The last service fields follow what is saved. A read of the odometer must not wipe them.
  useEffect(() => {
    setLastDateText(plan?.lastDate ? ukDate(plan.lastDate) : '');
    setLastText(plan?.lastKm != null ? String(fromKm(plan.lastKm, miles)) : '');
  }, [v?.vin, plan?.lastDate, plan?.lastKm, miles]);
  useEffect(() => {
    setOdoText(odo != null ? String(fromKm(odo, miles)) : '');
    setOdoEdited(false);
  }, [v?.vin, odo, miles]);
  const saveTyped = async () => {
    if (!v || !plan) return;
    const r = typedService({ dateText: lastDateText, dateIso: parseUkDate(lastDateText), lastText, odoText }, miles, today());
    if ('error' in r) {
      setTypedNote({ tone: 'danger', text: r.error });
      return;
    }
    const { lastDate, odoKm } = r.value;
    // A figure left as it was keeps its saved value, so converting to miles and back does not shift it.
    const lastKm = r.value.lastKm != null && plan.lastKm != null && fromKm(r.value.lastKm, miles) === fromKm(plan.lastKm, miles) ? plan.lastKm : r.value.lastKm;
    // Kept as typed only when the figure was changed, so a reading from the car keeps its own date.
    const odoChanged = shouldStoreTypedOdometer(odoKm, odoNow, miles, odoEdited);
    await garage.update(v.vin, {
      service: { everyKm: plan.everyKm, everyMonths: plan.everyMonths, ...(lastDate ? { lastDate } : {}), ...(lastKm != null ? { lastKm } : {}) },
      ...(odoChanged ? { odometerTypedKm: odoKm, odometerTypedAt: Date.now() } : {}),
    });
    setOdoEdited(false);
    success();
    setTypedNote({
      tone: 'ok',
      text: lastDate || lastKm != null ? 'Saved. The reminder counts from the last service.' : 'Saved. Type the last service date, its mileage, or both, to start the count.',
    });
  };

  // Reads the odometer here, the same read-only way the health check does.
  const [reading, setReading] = useState<string | null>(null);
  const readOdometer = async () => {
    if (!v || !conn.client) return;
    setReading('Reading');
    try {
      const distance = extrasFor(v.group).filter((e) => e.category === 'Distance');
      const got = await conn.client.readExtras(distance).catch(() => ({}) as Record<string, number>);
      const first = distance.find((e) => got[e.id] != null);
      if (first) {
        await garage.update(v.vin, { odometerKm: got[first.id], odometerAt: Date.now() });
        setReading(null);
      } else setReading('The car did not give its odometer. Run a health check, or read maker data in Live data.');
    } catch (e) {
      setReading(e instanceof Error ? e.message : String(e));
    }
  };

  // car: the car the entry is for. A guide's "I did this reset" is for the
  // connected car (none when not connected); the reminder passes its own car.
  const markDone = async (title: string, car: Vehicle | null | undefined = conn.vehicle) => {
    // A typed odometer older than a day is not stored as the mileage of a service done today.
    const km = markDoneKm(car);
    const skippedKm = km == null && odometerNow(car) != null;
    await addDiary({
      vin: car?.vin ?? null,
      vehicleName: car ? vehicleTitle(car) : MAKES.find((m) => m.id === make)!.label,
      date: today(),
      kind: 'Service reset',
      ...diaryMileage(km ?? car?.odometerKm, miles),
      notes: title,
    });
    setLogged(skippedKm ? `${title}. The mileage was not saved because the odometer was typed on ${dateText(odometerNow(car)!.at ?? 0)}. Type the odometer now and the mileage, then Save` : title);
    if (car) await addHistory({ vin: car.vin, kind: 'service', title, detail: 'Marked done', odometerKm: km });
    // The reminder restarts from today and the last odometer figure.
    if (car?.service) await garage.update(car.vin, { service: { ...car.service, lastDate: today(), lastKm: km } });
  };

  return (
    <Screen>
      <Body muted style={{ marginBottom: space.md }}>
        Reset the service or oil reminder after a service, with the car’s own buttons, or with the adapter for cars that need a tool.
      </Body>

      {detected ? (
        <Notice icon="car-info" tone="info" text={`Showing methods for your ${conn.vehicle!.brand}${conn.vehicle!.model ? ` ${conn.vehicle!.model}` : ''}.`} />
      ) : (
        <Segmented options={MAKES.map((m) => ({ id: m.id, label: m.label }))} value={make} onPick={setPicked} style={{ marginBottom: space.md }} />
      )}

      <Body muted style={{ marginBottom: space.lg }}>{guide.intro}</Body>
      {logged ? <Notice tone="ok" icon="notebook-check-outline" text={`Saved to your diary: ${logged}.`} /> : null}

      {methods.map((m, i) => (
        <View key={m.title}>
        <Label>Method {i + 1}</Label>
        <Card>
          <Heading>{m.title}</Heading>
          {/* Blue for where the method comes from; green is kept for a healthy result. */}
          <View style={{ marginTop: space.xs }}>
            <Pill text={m.source.official ? 'Maker source' : 'Third-party source'} tone={m.source.official ? 'info' : 'neutral'} />
          </View>
          <Body muted small style={{ marginTop: space.sm, marginBottom: space.md }}>{m.applies}</Body>
          {m.steps.map((s, n) => (
            <Step key={s} n={n + 1}>
              {s}
            </Step>
          ))}
          {m.note ? (
            <View style={[styles.note, { backgroundColor: t.sunken }]}>
              <Icon name="information-outline" size={16} color={t.muted} />
              <Body small style={{ flex: 1 }}>{m.note}</Body>
            </View>
          ) : null}
          <View style={[styles.footer, { borderColor: t.border }]}>
            {/* The source opens in the browser: a row with the open glyph, 44 pt. */}
            <Pressable accessibilityRole="link" accessibilityLabel={`Source: ${m.source.label}`} onPress={() => Linking.openURL(m.source.url)} style={({ pressed }) => [styles.source, { opacity: pressed ? 0.6 : 1 }]}>
              <Icon name="open-in-new" size={16} color={t.accentText} />
              <Text style={[type.sub, { color: t.accentText, flex: 1 }]}>{m.source.label}</Text>
            </Pressable>
            <Button label="I did this reset" icon="check" variant="secondary" onPress={() => markDone(`${m.title} (${MAKES.find((x) => x.id === make)!.label})`)} />
          </View>
        </Card>
        </View>
      ))}

      {v ? (
        <>
          <Group
            header="Common service intervals"
            help={SECTIONS.serviceReminder}
            footer={`Generic intervals, not a plan from your car’s maker: Caristini has no maker service plans. ${plan ? 'Tap another to change it.' : 'Tap the one that matches your service book or handbook, and Caristini counts down to the next service.'}`}
          >
            {PLANS.map((p, i) => (
              <ListRow
                key={p.label}
                first={i === 0}
                title={planLabel(p, miles)}
                selected={plan?.everyKm === p.everyKm && plan?.everyMonths === p.everyMonths}
                noChevron
                onPress={() => garage.update(v.vin, { service: { ...(plan ?? {}), everyKm: p.everyKm, everyMonths: p.everyMonths } })}
              />
            ))}
          </Group>
          <Group
            header={conn.vehicle ? 'Reminder' : `Reminder for ${vehicleTitle(v)}`}
            footer={
              odoNow
                ? `Odometer ${fromKm(odoNow.km, miles).toLocaleString('en-GB')} ${miles ? 'mi' : 'km'}, ${odoNow.typed ? 'typed' : 'read from the car'}${odoNow.at ? ` on ${dateText(odoNow.at)}` : ''}. ${distanceStale ? `The distance left is not counted: the odometer was typed ${odoNow.at ? `${odometerAgeDays(odoNow)} days ago` : 'some time ago'} and the car has been driven since. Type it again to count distance.` : 'The distance left is counted from this figure, so read or type it again now and then.'}`
                : 'Caristini does not know the odometer yet, so the reminder counts time only. Type it above, or read it from the car, to count distance too.'
            }
          >
            {due ? (
              <ListRow first title={describeDue(due, miles, distanceStale)} right={due.overdue ? <Pill text="Overdue" tone="danger" /> : due.soon ? <Pill text="Soon" /> : undefined} noChevron />
            ) : (
              <ListRow first title="Pick an interval above to start" noChevron />
            )}
            {plan ? (
              <View style={[styles.fields, { borderColor: t.border }]}>
                <Field
                  label="Last service date (day/month/year)"
                  value={lastDateText}
                  onChange={(x) => {
                    setLastDateText(x);
                    setTypedNote(null);
                  }}
                  accessibilityLabel="Last service date, day/month/year"
                  placeholder="For example 12/11/2026"
                  keyboard="numbers-and-punctuation"
                  number
                />
                <Field
                  label={`Mileage at the last service, in ${unitWord}`}
                  value={lastText}
                  onChange={(x) => {
                    setLastText(x.replace(/[^\d]/g, ''));
                    setTypedNote(null);
                  }}
                  placeholder="For example 48200"
                  keyboard="number-pad"
                  number
                  style={{ marginTop: space.md }}
                />
                <Field
                  label={`Odometer now, in ${unitWord}`}
                  value={odoText}
                  onChange={(x) => {
                    setOdoText(x.replace(/[^\d]/g, ''));
                    setOdoEdited(true);
                    setTypedNote(null);
                  }}
                  placeholder="For example 52300"
                  keyboard="number-pad"
                  number
                  style={{ marginTop: space.md }}
                />
                {typedNote ? <Text style={[type.small, { color: typedNote.tone === 'ok' ? t.ok : t.danger, marginTop: space.sm }]}>{typedNote.text}</Text> : null}
                <Button label="Save" icon="content-save-outline" variant="secondary" style={{ marginTop: space.md }} onPress={saveTyped} />
              </View>
            ) : null}
            <ListRow
              icon="counter"
              iconColour={TOOLS.service.colour}
              title={reading === 'Reading' ? 'Reading the odometer…' : odo != null ? 'Read the odometer again' : 'Read the odometer'}
              subtitle={!conn.client ? 'Connect your car first' : reading && reading !== 'Reading' ? reading : 'Read-only: nothing is changed in the car'}
              disabled={!conn.client || reading === 'Reading'}
              onPress={readOdometer}
            />
            {plan ? (
              <ListRow
                icon="check"
                iconColour="green"
                title="Mark service done today"
                subtitle="Saves it to History and your diary, and starts the reminder again"
                onPress={() => {
                  success();
                  markDone('Service done', v);
                }}
              />
            ) : null}
          </Group>
        </>
      ) : null}

      <Group header="Reset with the adapter" help={SECTIONS.serviceObd} footer="For cars that need a tool to reset the reminder. Caristini learns the reset once, then does it in one tap.">
        <ListRow
          first
          {...tool('service')}
          title="Reset with the adapter"
          subtitle={v?.serviceResets?.length ? `${v.serviceResets.length} learned on this car` : 'Learn it once, then reset with one tap'}
          onPress={() => router.push('/service-reset')}
        />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', gap: space.sm, borderRadius: radius.md, padding: space.md, marginTop: space.xs },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.md, paddingTop: space.xs, gap: space.xs },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  fields: { padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
