import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDiary, today } from '../diary';
import { addHistory } from '../history';
import { Make, MAKES, methodsFor, PROCEDURES } from '../service/procedures';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { Body, Button, Card, Heading, Icon, Label, Notice, Pill, Screen, tap, success } from '../ui';
import { describeDue, PLANS, planLabel, serviceDue } from '../service/reminder';
import { extrasFor } from '../obd/extras';
import { useSettings } from '../settings';
import { Group, ListRow } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';
import { SECTIONS } from '../help';

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
  const v = conn.vehicle;
  const plan = v?.service;
  const due = plan ? serviceDue(plan, v?.odometerKm) : null;
  const odo = v?.odometerKm;
  const miles = settings.speed === 'mph';
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

  const markDone = async (title: string) => {
    await addDiary({
      vin: conn.vehicle?.vin ?? null,
      vehicleName: conn.vehicle ? vehicleTitle(conn.vehicle) : MAKES.find((m) => m.id === make)!.label,
      date: today(),
      kind: 'Service reset',
      mileage: null,
      notes: title,
    });
    setLogged(title);
    if (v) await addHistory({ vin: v.vin, kind: 'service', title, detail: 'Marked done', odometerKm: odo });
    // The reminder restarts from today and the last odometer reading.
    if (v?.service) await garage.update(v.vin, { service: { ...v.service, lastDate: new Date().toISOString().slice(0, 10), lastKm: odo } });
  };

  return (
    <Screen>
      <Body muted style={{ marginBottom: space.md }}>
        Reset the service or oil reminder after a service, with the car's own buttons, or with the adapter for cars that need a tool.
      </Body>

      {detected ? (
        <Notice icon="car-info" tone="info" text={`Showing methods for your ${conn.vehicle!.brand}${conn.vehicle!.model ? ` ${conn.vehicle!.model}` : ''}.`} />
      ) : (
        <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: t.sunken }]}>
          {MAKES.map((m) => {
            const on = m.id === make;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  tap();
                  setPicked(m.id);
                }}
                style={[styles.segItem, on && { backgroundColor: t.surface, borderColor: t.border }]}
              >
                <Text style={[type.small, { fontWeight: '700', color: on ? t.text : t.muted }]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Body muted style={{ marginBottom: space.lg }}>{guide.intro}</Body>
      {logged ? <Notice tone="ok" icon="notebook-check-outline" text={`Saved to your Diary: ${logged}.`} /> : null}

      {methods.map((m, i) => (
        <Card key={m.title}>
          <View style={styles.titleRow}>
            <Label style={{ marginBottom: 0 }}>Method {i + 1}</Label>
            <Pill text={m.source.official ? 'Maker source' : 'Third-party source'} tone={m.source.official ? 'ok' : 'neutral'} />
          </View>
          <Heading style={{ marginTop: space.sm }}>{m.title}</Heading>
          <Body muted small style={{ marginBottom: space.md }}>{m.applies}</Body>
          {m.steps.map((s, n) => (
            <View key={s} style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: t.accent }]}>
                <Text style={{ color: t.onAccent, fontSize: 12.5, fontWeight: '800' }}>{n + 1}</Text>
              </View>
              <Body style={{ flex: 1 }}>{s}</Body>
            </View>
          ))}
          {m.note ? (
            <View style={[styles.note, { backgroundColor: t.sunken }]}>
              <Icon name="information-outline" size={16} color={t.muted} />
              <Body small style={{ flex: 1 }}>{m.note}</Body>
            </View>
          ) : null}
          <View style={[styles.footer, { borderColor: t.border }]}>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(m.source.url)} style={{ flex: 1 }}>
              <Text style={[type.small, { color: t.accentText, fontWeight: '700', textDecorationLine: 'underline' }]}>{m.source.label}</Text>
            </Pressable>
            <Button label="I did this reset" icon="check" variant="secondary" style={{ minHeight: 44 }} onPress={() => markDone(`${m.title} (${MAKES.find((x) => x.id === make)!.label})`)} />
          </View>
        </Card>
      ))}

      {v ? (
        <>
          <Group
            header="Common service intervals"
            help={SECTIONS.serviceReminder}
            footer={`Generic intervals, not a plan from your car's maker: Caristini has no maker service plans. ${plan ? 'Tap another to change it.' : 'Tap the one that matches your service book or handbook, and Caristini counts down to the next service.'}`}
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
            header="Reminder"
            footer={
              odo != null
                ? `Odometer ${Math.round(miles ? odo / 1.609344 : odo).toLocaleString('en-GB')} ${miles ? 'mi' : 'km'}, read from the car${v.odometerAt ? ` on ${new Date(v.odometerAt).toLocaleDateString('en-GB')}` : ''}.`
                : 'Caristini does not know the odometer yet, so the reminder counts time only. Read it to count distance too.'
            }
          >
            {due ? (
              <ListRow first title={describeDue(due, miles)} right={due.overdue ? <Pill text="Overdue" tone="danger" /> : due.soon ? <Pill text="Soon" /> : undefined} noChevron />
            ) : (
              <ListRow first title="Pick an interval above to start" noChevron />
            )}
            <ListRow
              icon="counter"
              iconColour="blue"
              title={reading === 'Reading' ? 'Reading the odometer…' : odo != null ? 'Read the odometer again' : 'Read the odometer'}
              subtitle={!conn.client ? 'Connect the adapter first' : reading && reading !== 'Reading' ? reading : 'Read-only: nothing is changed in the car'}
              disabled={!conn.client || reading === 'Reading'}
              onPress={readOdometer}
            />
            {plan ? (
              <ListRow
                icon="check"
                iconColour="green"
                title="Mark service done today"
                subtitle="Saves it to the diary and starts the reminder again"
                onPress={() => {
                  success();
                  markDone('Service done');
                }}
              />
            ) : null}
          </Group>
        </>
      ) : null}

      <Group header="Reset with the adapter" help={SECTIONS.serviceObd} footer="For cars that need a tool to reset the reminder. Caristini learns the reset once, then does it in one tap.">
        <ListRow
          first
          icon="wrench-clock"
          iconColour="orange"
          title="Reset with the adapter"
          subtitle={v?.serviceResets?.length ? `${v.serviceResets.length} learned on this car` : 'Learn it once, then reset with one tap'}
          onPress={() => router.push('/service-reset')}
        />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 3, marginBottom: space.md },
  segItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  step: { flexDirection: 'row', gap: space.md, marginBottom: space.sm, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  note: { flexDirection: 'row', gap: space.sm, borderRadius: radius.md, padding: space.md, marginTop: space.xs },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.md, paddingTop: space.md },
});
