import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Mode06Read, TestResult } from '../diag/service06';
import { Mode09Read } from '../diag/service09';
import { loadEmissions, readEmissions, saveEmissions, SavedEmissions } from '../diag/emissionsStore';
import { when } from '../components/LastScan';
import { useGarage } from '../vehicle/garage';
import { monitorMeaning, MONITOR_STATE_LABEL, readinessSummary } from '../diag/readiness';
import { SECTIONS } from '../help';
import { useConnection } from '../state';
import { MONO, space, type, useTheme } from '../theme';
import { Button, Group, GuideButton, ListRow, NeedsConnection, Notice, Pill, Screen, success } from '../ui';

// Service 06 (on-board test results) and service 09 (calibration IDs, CVN,
// in-use performance counters) from the engine. Reads only. A read made by
// Learn my car is shown as saved, without asking the car again.
export default function EmissionsTests() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const client = conn.client;
  const info = conn.info;
  const vin = conn.vehicle?.vin ?? garage.vehicles[0]?.vin;
  const [tests, setTests] = useState<Mode06Read | null>(null);
  const [cal, setCal] = useState<Mode09Read | null>(null);
  // The saved read on screen (from Learn my car, or with no adapter).
  const [saved, setSaved] = useState<SavedEmissions | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const read = useCallback(async () => {
    if (!client || !info) return;
    setError(null);
    setTests(null);
    setCal(null);
    setSaved(null);
    try {
      // The self-test states as they are now.
      setBusy('Reading the self-tests…');
      const status = await conn.refreshStatus().catch(() => null);
      if (!alive.current) return;
      const r = await readEmissions(client, {
        isCan: info.isCan,
        diesel: info.diesel,
        onStep: (what) => alive.current && setBusy(what),
        onTests: (r06) => alive.current && setTests(r06),
      });
      if (!alive.current) return;
      setCal(r.cal);
      if (conn.vehicle) {
        await saveEmissions({ vin: conn.vehicle.vin, at: Date.now(), from: 'screen', milOn: status?.milOn ?? info.milOn, diesel: status?.diesel ?? info.diesel, monitors: status?.monitors ?? info.monitors, tests: r.tests, cal: r.cal });
      }
      success();
    } catch (e) {
      if (alive.current) setError(`Reading stopped: ${e instanceof Error ? e.message : String(e)}. Check the ignition is on, then tap Read again.`);
    } finally {
      if (alive.current) setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, info]);

  // A Learn my car read is shown as it is; otherwise the car is read now.
  // With no adapter, the last read saved on this phone.
  useEffect(() => {
    let on = true;
    setLoaded(false);
    (vin ? loadEmissions(vin) : Promise.resolve(null)).then((e) => {
      if (!on || !alive.current) return;
      setLoaded(true);
      // Connected: a Learn my car read is used only while it is under an hour
      // old; anything older is read again from the car.
      const freshLearn = !!e && e.from === 'learn' && Date.now() - e.at < 60 * 60000;
      if (e && (freshLearn || !client || !info)) {
        setSaved(e);
        setTests(e.tests);
        setCal(e.cal);
      } else void read();
    });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, vin]);

  if ((!client || !info) && !(loaded && saved)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Emissions self-tests', headerRight: () => <GuideButton id="diagTests" /> }} />
        <NeedsConnection what="test results" />
      </Screen>
    );
  }

  const monitors = saved ? saved.monitors : (info?.monitors ?? []);
  const diesel = saved ? saved.diesel : !!info?.diesel;
  // Results grouped by monitor, in the order read.
  const byMonitor: { name: string; items: TestResult[] }[] = [];
  for (const r of tests?.results ?? []) {
    const last = byMonitor.find((g) => g.name === r.monitor);
    if (last) last.items.push(r);
    else byMonitor.push({ name: r.monitor, items: [r] });
  }
  const failed = (tests?.results ?? []).filter((r) => r.pass === false).length;
  const units = cal?.units ?? [];
  const incomplete = monitors.filter((m) => m.state === 'incomplete').length;
  // Nothing to show from either read: one line, no empty blocks.
  const nothing = !!tests && !!cal && tests.decoded && !tests.results.length && !tests.raw.length && !units.length;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Emissions self-tests', headerRight: () => <GuideButton id="diagTests" /> }} />
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
      {saved ? (
        <Notice
          icon="information-outline"
          text={`${saved.from === 'learn' ? 'From Learn my car' : 'Last read'}, ${when(saved.at)}.${client ? '' : ' Not connected: connect to read the car again.'}`}
        />
      ) : null}
      {busy ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={t.muted} />
          <Text style={[type.sub, type.number, { color: t.muted }]}>{busy}</Text>
        </View>
      ) : client && info ? (
        <Button label="Read again" icon="refresh" variant="secondary" onPress={() => void read()} style={{ marginBottom: space.lg }} />
      ) : null}

      {monitors.length ? (
        <Group
          header={`Emissions self-tests${diesel ? ' (diesel)' : ''}`}
          help={SECTIONS.diagMonitors}
          footer="Complete: the test has run since faults were last cleared; a failed test stores a fault. Not yet run: drive normally and it runs. Clearing faults resets them all."
        >
          <ListRow
            first
            icon={incomplete ? 'progress-clock' : 'check-circle-outline'}
            iconColour={incomplete ? 'orange' : 'green'}
            title={readinessSummary(monitors).text}
            noChevron
          />
          {monitors.map((m) => (
            <ListRow key={m.name} title={m.name} subtitle={monitorMeaning(m.name)} right={<Pill text={MONITOR_STATE_LABEL[m.state]} tone={m.state === 'complete' ? 'ok' : 'accent'} />} />
          ))}
        </Group>
      ) : null}

      {/* Nothing in either read: no empty block (the self-tests above say enough). */}
      {tests && !nothing ? (
        tests.decoded ? (
          <>
            {tests.results.length ? (
              <Notice
                tone={failed ? 'danger' : 'ok'}
                icon={failed ? 'alert-circle-outline' : 'check'}
                text={
                  failed
                    ? `${failed} test${failed === 1 ? ' is' : 's are'} outside the car's own limits, so the car counts ${failed === 1 ? 'it' : 'them'} as failed.`
                    : `${tests.results.length} test result${tests.results.length === 1 ? '' : 's'}, all inside the car's own limits where they could be checked.`
                }
              />
            ) : (
              <Notice icon="information-outline" text="The engine listed no test results. Some cars only keep them after the tests have run on a drive." />
            )}
            {byMonitor.map((g, k) => (
              <Group
                key={g.name}
                header={g.name}
                help={k === 0 ? SECTIONS.diagTestResults : undefined}
                footer={g.items.some((r) => !r.value) ? 'Raw: the unit code is not in the standard table Caristini uses, so the bytes are shown as sent.' : undefined}
              >
                {g.items.map((r, i) => (
                  <ListRow
                    key={`${r.mid}-${r.tid}-${i}`}
                    first={i === 0}
                    title={r.test}
                    subtitle={
                      r.value && r.min && r.max
                        ? `${r.value.text} · limits ${r.min.text} to ${r.max.text}`
                        : `Raw ${r.raw}`
                    }
                    right={<Pill text={r.pass == null ? 'Raw' : r.pass ? 'Pass' : 'Fail'} tone={r.pass == null ? 'neutral' : r.pass ? 'ok' : 'danger'} />}
                  />
                ))}
              </Group>
            ))}
            {tests.raw.length ? (
              <Group header="Other answers, raw" footer="Answers that did not fit the standard layout.">
                {tests.raw.map((l, i) => (
                  <Text key={i} selectable style={[type.small, styles.raw, { color: t.muted, borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
                    {l}
                  </Text>
                ))}
              </Group>
            ) : null}
          </>
        ) : (
          <Group header="Test results" help={SECTIONS.diagTestResults} footer="This car does not use CAN, so its test results use an older layout set by the maker. Caristini shows them raw.">
            {tests.raw.length ? (
              tests.raw.map((l, i) => (
                <Text key={i} selectable style={[type.small, styles.raw, { color: t.muted, borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
                  {l}
                </Text>
              ))
            ) : (
              <ListRow first title="No test results answered" />
            )}
          </Group>
        )
      ) : null}

      {cal && units.length
        ? units.map((u, k) => (
            <View key={k}>
              <Group header={u.name ? `Calibration · ${u.name}` : units.length > 1 ? `Calibration · unit ${k + 1}` : 'Calibration'} help={k === 0 ? SECTIONS.diagCalibration : undefined}>
                {u.calIds.map((c, i) => (
                  <ListRow key={`c${i}`} first={i === 0} title={u.calIds.length > 1 ? `Calibration ID ${i + 1}` : 'Calibration ID'} value={c} mono />
                ))}
                {u.cvns.map((c, i) => (
                  <ListRow key={`v${i}`} first={!u.calIds.length && i === 0} title={u.cvns.length > 1 ? `CVN ${i + 1}` : 'CVN'} value={c} mono />
                ))}
                {!u.calIds.length && !u.cvns.length ? <ListRow first title="No calibration ID or CVN answered" /> : null}
              </Group>
              {u.inUse ? (
                <Group
                  header={`How often each self-test runs${units.length > 1 ? ` · ${u.name ?? `unit ${k + 1}`}` : ''}`}
                  help={SECTIONS.diagInUse}
                  footer="Completed: times the test finished. Chances: drives where it could run."
                >
                  {u.inUse.obdConditions != null ? <ListRow first title="Drives that met the general conditions" value={String(u.inUse.obdConditions)} /> : null}
                  {u.inUse.ignitions != null ? <ListRow title="Engine starts" value={String(u.inUse.ignitions)} /> : null}
                  {u.inUse.ratios.map((r) => (
                    <ListRow
                      key={r.monitor}
                      title={r.monitor}
                      subtitle={r.conditions ? `Completed ${r.completed} of ${r.conditions} chances` : 'Not counted on this car'}
                      value={r.ratio == null ? 'None' : r.ratio.toFixed(2)}
                    />
                  ))}
                </Group>
              ) : null}
            </View>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  raw: { fontFamily: MONO, paddingHorizontal: space.lg, paddingVertical: space.sm },
});
