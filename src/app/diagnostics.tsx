import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDiary, today } from '../diary';
import { addHistory, loadHistory, updateHistory } from '../history';
import { FaultCodes, ModuleFaults } from '../obd/elm';
import { ModuleDef, modulesFor } from '../obd/modules';
import { SECOND_BUS_ADAPTER_TEXT, SECOND_BUS_NOTICE } from '../obd/msCan';
import { pidInfo } from '../obd/pids';
import { Tp20Module, tp20Name } from '../obd/tp20';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { Mascot } from '../brand/Mascot';
import { TOOLS, Arrive, Button, ConfirmSheet, GlowCard, Group, Icon, ListRow, ModuleRing, NeedsConnection, Notice, Pill, ScanPulse, Screen, success, tap, tool } from '../ui';
import { CodeRow, FaultRow } from '../components/CodeRow';
import { allowSleep, stayAwake } from '../keepAwake';
import { leftText } from '../timeText';
import { quickCheckDue, useGarage, vehicleTitle } from '../vehicle/garage';
import { sendLogNow } from '../share/sendLog';
import { LastScan, useLastScan } from '../components/LastScan';
import { chargeVerdict, restVerdict } from '../obd/battery';
import { SECTIONS } from '../help';
import { FreezeFrameRead, freezeText } from '../diag/freeze';
import { toUserUnits, useSettings } from '../settings';
import { ScanDiff } from '../diag/scanDiff';
import { addOlderToCheck, HealthCheckResult, runHealthCheck, saveOlderModules } from '../diag/healthCheck';
import { monitorMeaning, MONITOR_STATE_LABEL, readinessSummary } from '../diag/readiness';
import { ScanChanges, useScanDiff } from '../components/ScanChanges';
import { extraObdCodes, faultKey, faultMeaning, obdStates } from '../diag/faults';
import { mergeRetried, recheckMessage, retriedHistoryPatch, uniqueFaultCodes } from '../diag/recheck';
import { LeaveRunGuard } from '../leaveRun';
import { diaryMileage } from '../diaryCars';
import { recentHealthCheck } from '../mot/read';


type Confirm = { kind: 'all' } | { kind: 'module'; def: ModuleDef } | { kind: 'tp20'; address: number } | null;

// The one line about the engine on every clear-faults sheet (Workshop uses the
// same words).
const CLEAR_ENGINE_LINE = 'Works with the engine running. A few modules only clear with the engine off and the ignition on.';

// Engine speed, read before a clear, so a refusal can say the engine was running.
const RPM = pidInfo(0x0c)!;

export default function Diagnostics() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  // Freeze frame speed and temperature in the owner's units.
  const { settings } = useSettings();
  const client = conn.client;
  const vehicle = conn.vehicle;
  const group = vehicle?.group ?? 'other';
  const withModules = !!client?.supportsModules && group !== 'other';
  // Quick: only the modules this car has answered on. Full: every address.
  const [mode, setMode] = useState<'quick' | 'full'>('full');
  const baseDefs = withModules ? modulesFor(group).filter((d) => mode === 'full' || vehicle?.modulesSeen?.includes(d.id)) : [];

  const [obd, setObd] = useState<FaultCodes | null>(null);
  const [freeze, setFreeze] = useState<FreezeFrameRead[]>([]);
  // Changes since the previous full check of this car.
  const [diff, setDiff] = useState<ScanDiff | null>(null);
  const [results, setResults] = useState<Record<string, ModuleFaults>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState<'scan' | 'clear' | 'deep' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [volts, setVolts] = useState<number | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  // Modules the car's gateway listed beyond the fixed list arrive with their results.
  const defs = [...baseDefs, ...Object.values(results).map((r) => r.def).filter((d) => !baseDefs.some((b) => b.id === d.id))];
  const [deep, setDeep] = useState<Tp20Module[] | null>(null);
  const [deepPct, setDeepPct] = useState(0);
  const alive = useRef(true);
  // The phone stays awake while a check, a clear or the older-module search
  // runs, the same as every other long read (src/keepAwake.ts).
  useEffect(() => {
    if (!busy) return undefined;
    stayAwake('health-check');
    return () => allowSleep('health-check');
  }, [busy]);
  // Stop: ends the scan after the module being read; leaving the screen stops it too.
  const stop = useRef(false);
  const [stopping, setStopping] = useState(false);
  const started = useRef(0);
  const [eta, setEta] = useState<number | null>(null);
  const offlineVin = garage.vehicles[0]?.vin;
  const saved = useLastScan(vehicle?.vin ?? offlineVin);
  const savedDiff = useScanDiff(saved);
  // Opened from the Car tab's fault count: show the saved result, no new check.
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [showSaved, setShowSaved] = useState(view === 'last');
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);

  // The History entry this visit's check saved, so older modules found later are added to it.
  const lastCheck = useRef<HealthCheckResult | null>(null);

  // Returns the check, or null when it did not run (so a clear can say what came back).
  const scan = useCallback(async (everyAddress = false): Promise<HealthCheckResult | null> => {
    if (!client || !vehicle) return null;
    let out: HealthCheckResult | null = null;
    // After 2 complete full checks the car's modules are known: ask only those,
    // and every address again after 30 days or when asked.
    const fresh = garage.latest(vehicle.vin);
    const quick = !everyAddress && quickCheckDue(fresh);
    setMode(quick ? 'quick' : 'full');
    setBusy('scan');
    setError(null);
    setResults({});
    setDiff(null);
    stop.current = false;
    setStopping(false);
    setEta(null);
    started.current = Date.now();
    lastCheck.current = null;
    try {
      // The shared check (src/diag/healthCheck.ts): Learn my car saves the same way.
      const r = await runHealthCheck({
        client,
        vin: vehicle.vin,
        garage,
        isCan: conn.info?.isCan ?? true,
        quick,
        olderSearch: true,
        readStatus: () => conn.refreshStatus(),
        cancelled: () => stop.current || !alive.current,
        onStep: (what) => alive.current && what !== 'the control modules' && setCurrent(what),
        onObd: (codes, ff, err) => {
          if (!alive.current) return;
          if (err) setMessage(`The engine’s standard codes could not be read (${err}). The modules were still checked.`);
          setObd(codes);
          setFreeze(ff);
          // The first module to be asked, while the module list starts.
          const list = modulesFor(group);
          setCurrent(list.find((m) => vehicle.modulesSeen?.includes(m.id))?.name ?? list[0]?.name ?? null);
        },
        onModule: (r, done, totalMods, next) => {
          if (!alive.current) return;
          // Time left from the pace so far (after a few modules, so it is steady).
          if (done >= 3) setEta(Math.round(((Date.now() - started.current) / done) * (totalMods - done) / 1000));
          setResults((old) => ({ ...old, [r.def.id]: r }));
          setCurrent(next?.name ?? null);
        },
        onSaved: (r) => {
          lastCheck.current = r;
          if (alive.current) setDiff(r.diff);
          success();
        },
        // First health check on a VW group car: the older-module search runs
        // after the result is shown, and its modules are added to the check.
        onOlderStart: () => {
          if (!alive.current) return;
          setBusy('deep');
          setCurrent(null);
          setDeep([]);
          setDeepPct(0);
        },
        onOlderProgress: (d, n) => alive.current && setDeepPct(n ? d / n : 1),
        onOlderModule: (m) => alive.current && setDeep((old) => [...(old ?? []), m]),
      });
      out = r;
      if (r.older) void sendLogNow('older modules', vehicle);
      if (alive.current && r.older) setDeep(r.older);
      if (alive.current && r.olderError) setError(`The search for older VW modules stopped: ${r.olderError}. Check the ignition is on, then tap Look for older VW modules.`);
    } catch (e) {
      if (alive.current) setError(`The check stopped: ${e instanceof Error ? e.message : String(e)}. Check the ignition is on, then tap Check again.`);
    } finally {
      // Kept even when the check stopped early: what answered, and how.
      if (withModules && client.modulesSeen.length) void garage.update(vehicle.vin, { modulesSeen: client.modulesSeen, routes: client.exportRoutes() });
      void sendLogNow('health check', vehicle);
      if (alive.current) {
        setBusy(null);
        setCurrent(null);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, group, withModules, vehicle?.vin]);

  useEffect(() => {
    if (!showSaved) scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan]);

  // "Clear all faults" on the saved result: the car is checked first, and the
  // usual clear question follows when that check ends with something to clear.
  const clearAfterCheck = useRef(false);
  useEffect(() => {
    if (busy || !clearAfterCheck.current) return;
    clearAfterCheck.current = false;
    // A check that failed or was stopped early is not a basis for clearing.
    if (error || stop.current) return;
    const any = Object.values(results).some((r) => r.faults.length) || (deep ?? []).some((m) => m.faults.length) || !!obd?.stored.length || !!obd?.pending.length || !!conn.info?.milOn;
    if (any) setConfirm({ kind: 'all' });
    else setMessage('Nothing to clear: this check found no faults and the engine light is off.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  // Re-read modules that answered but would not send their fault list.
  const retry = async (list: ModuleDef[]) => {
    if (!client) return;
    setBusy('scan');
    setError(null);
    stop.current = false;
    setStopping(false);
    const got: ModuleFaults[] = [];
    try {
      for (const def of list) {
        if (stop.current || !alive.current) break;
        setCurrent(def.name);
        const r = await client.readModuleFaults(def);
        got.push(r);
        if (alive.current) setResults((old) => ({ ...old, [def.id]: r }));
      }
    } catch (e) {
      if (alive.current) setError(`The check stopped: ${e instanceof Error ? e.message : String(e)}. Switch the engine off, leave the ignition on, then tap Try these again.`);
    } finally {
      // What answered this time joins the saved check: its History entry and,
      // for a check that ran to the end, the car's saved fault list.
      const check = lastCheck.current;
      if (check && vehicle && got.length) {
        const { changed, ...totals } = mergeRetried(check, got.map((r) => ({ name: r.def.name, state: r.state, faults: r.faults })), vehicle.brand);
        if (changed) {
          Object.assign(check, totals, { noAnswer: check.noAnswer && totals.answered === 0 });
          try {
            if (check.historyId) {
              const id = check.historyId;
              const before = (await loadHistory(vehicle.vin)).find((e) => e.id === id)?.detail;
              await updateHistory(id, retriedHistoryPatch(totals, before));
            }
            if (!check.stopped) await garage.update(vehicle.vin, { lastCodes: totals.codesCounted, lastCheckedAt: Date.now() });
          } catch {
            // Storage unavailable: the screen still shows what was read.
          }
        }
      }
      if (alive.current) {
        setBusy(null);
        setCurrent(null);
      }
    }
  };

  // Older VW group modules that only speak TP2.0 / KWP2000.
  const deepScan = async () => {
    if (!client) return;
    setBusy('deep');
    setError(null);
    setDeep([]);
    setDeepPct(0);
    try {
      const found = await client.deepScan(undefined, (d, n) => alive.current && setDeepPct(n ? d / n : 1), (m) => alive.current && setDeep((old) => [...(old ?? []), m]));
      if (alive.current) setDeep(found);
      void sendLogNow('older modules', vehicle);
      // Saved on the car, so Customise and Workshop know these modules and the
      // next connect goes straight to them; added to this visit's check too.
      if (vehicle) {
        await saveOlderModules(garage, vehicle.vin, found);
        if (lastCheck.current) Object.assign(lastCheck.current, await addOlderToCheck({ client, garage, vin: vehicle.vin, brand: vehicle.brand }, lastCheck.current, found));
      }
      success();
    } catch (e) {
      if (alive.current) setError(`The search for older VW modules stopped: ${e instanceof Error ? e.message : String(e)}. Check the ignition is on, then tap Look for older VW modules again.`);
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  // module: the one module cleared, for the History title ("Engine faults cleared").
  const log = async (notes: string, module?: string) => {
    if (!vehicle) return;
    await addHistory({ vin: vehicle.vin, kind: 'clear', title: module ? `${module} faults cleared` : 'Faults cleared', detail: notes, odometerKm: vehicle.odometerKm });
    // The odometer the car last gave, in the unit from Settings.
    await addDiary({ vin: vehicle.vin, vehicleName: vehicleTitle(vehicle), date: today(), kind: 'Faults cleared', ...diaryMileage(garage.latest(vehicle.vin)?.odometerKm ?? vehicle.odometerKm, settings.speed === 'mph'), notes });
  };

  const clear = async (c: Exclude<Confirm, null>) => {
    setConfirm(null);
    if (!client) return;
    setBusy('clear');
    setError(null);
    setMessage(null);
    try {
      // Clearing is allowed with the engine running; a module that wants it
      // off refuses by itself, and the result names it.
      const rpm = await client.readLive(RPM).catch(() => null);
      const running = rpm != null && rpm > 300;
      if (c.kind === 'tp20') {
        const name = tp20Name(c.address);
        const before = deep?.find((m) => m.address === c.address)?.faults.map((f) => f.code) ?? [];
        await client.clearTp20(c.address);
        // known: this address already belongs to a named module, and must still be read again.
        const [after] = await client.deepScan([c.address], undefined, undefined, undefined, { known: true });
        if (alive.current && after) setDeep((old) => (old ?? []).map((m) => (m.address === c.address ? after : m)));
        await log(`${name}: cleared ${before.join(', ') || 'fault memory'}`, name);
        setMessage(after?.faults.length ? `${name}: faults came straight back, so the cause is still there.` : `${name}: faults cleared. Saved to History and your diary.`);
      } else if (c.kind === 'module') {
        const before = results[c.def.id]?.faults.map((f) => f.code) ?? [];
        try {
          await client.clearModuleFaults(c.def);
        } catch (e) {
          // The engine always accepts the standard OBD2 clear (mode 04).
          if (c.def.id !== 'engine') throw e;
          await client.clearFaultCodes();
        }
        const after = await client.readModuleFaults(c.def);
        if (alive.current) setResults((old) => ({ ...old, [c.def.id]: after }));
        await log(`${c.def.name}: cleared ${before.join(', ') || 'fault memory'}`, c.def.name);
        setMessage(after.faults.length ? `${c.def.name}: ${after.faults.length} fault${after.faults.length === 1 ? '' : 's'} came straight back, so the cause is still there.` : `${c.def.name}: faults cleared. Saved to History and your diary.`);
      } else {
        // Each module's answer is kept: only codes really cleared are logged,
        // and modules that refused are named.
        const cleared: string[] = [];
        const refused: string[] = [];
        const ok = await client.clearFaultCodes().then(
          () => true,
          () => false,
        );
        if (ok) cleared.push(...(obd?.stored ?? []), ...(obd?.pending ?? []));
        else if (obdFaults || info.milOn) refused.push('Engine (OBD2)');
        const withFaults = Object.values(results).filter((r) => r.faults.length);
        for (const r of withFaults) {
          try {
            await client.clearModuleFaults(r.def);
            cleared.push(...r.faults.map((f) => f.code));
          } catch {
            // The engine module is cleared by the standard OBD2 clear when that worked.
            if (r.def.id === 'engine' && ok) cleared.push(...r.faults.map((f) => f.code));
            else refused.push(r.def.name);
          }
        }
        for (const m of deep ?? []) {
          if (!m.faults.length) continue;
          try {
            await client.clearTp20(m.address);
            cleared.push(...m.faults.map((f) => f.code));
          } catch {
            refused.push(tp20Name(m.address));
          }
        }
        // Each fault once: P0300 and VW 16684 are one fault read two ways.
        const unique = uniqueFaultCodes(cleared);
        await log(unique.length ? `Cleared ${unique.join(', ')}${refused.length ? `; refused by ${refused.join(', ')}` : ''}` : `Clear refused by ${refused.join(', ') || 'the car'}`);
        const asked = withFaults.length + (deep ?? []).filter((m) => m.faults.length).length + (obdFaults || info.milOn ? 1 : 0);
        const refusal = refused.length ? `Cleared ${asked - refused.length} of ${asked}. ${refused.join(', ')} refused${running ? ': the engine is running, and some modules only clear with it off and the ignition on.' : ': try again with the ignition on.'}` : null;
        if (alive.current && !refusal) setMessage('Faults cleared. Saved to History and your diary. Checking again to see what comes back.');
        setBusy(null);
        const again = await scan();
        // After the new scan (which clears old notices), so it stays on screen.
        if (alive.current && refusal) setError(refusal);
        // What came back, in place of "Checking again" once the check has ended.
        else if (alive.current) setMessage(recheckMessage(again ? { stopped: again.stopped, faults: again.logged.length, milOn: again.status?.milOn ?? null } : null));
        return;
      }
    } catch (e) {
      if (alive.current) setError(`Clearing stopped: ${e instanceof Error ? e.message : String(e)}. If a module refuses, switch the engine off, leave the ignition on and try again.`);
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  if (!client || !conn.info || !vehicle) {
    return (
      <Screen>
        {saved && offlineVin ? (
          <>
            <Notice icon="bluetooth-off" text="Not connected. This is the last health check saved on this phone. Connect your car to check again." />
            <LastScan vin={offlineVin} entry={saved} limit={40} />
            {savedDiff ? <ScanChanges diff={savedDiff} /> : null}
            <Button label="Connect adapter" icon="bluetooth" onPress={() => router.push('/connect')} />
          </>
        ) : (
          <NeedsConnection title="Connect your car to check for faults" />
        )}
      </Screen>
    );
  }

  if (showSaved && !busy) {
    return (
      <Screen>
        {saved ? <LastScan vin={vehicle.vin} entry={saved} limit={60} /> : <Notice icon="information-outline" text="No health check is saved for this car yet." />}
        {savedDiff ? <ScanChanges diff={savedDiff} /> : null}
        {/* What to do next with the saved result, as under a new check. */}
        {saved ? (
          <Group>
            {saved.faults?.length || conn.info.milOn ? (
              <ListRow
                first
                icon="broom"
                iconColour={TOOLS.clear.colour}
                title="Clear all faults"
                subtitle="Checks the car again first, then asks before clearing"
                onPress={() => {
                  clearAfterCheck.current = true;
                  setShowSaved(false);
                  void scan();
                }}
              />
            ) : null}
            <ListRow first={!(saved.faults?.length || conn.info.milOn)} icon="file-document-outline" iconColour={TOOLS.report.colour} title="Make health report" onPress={() => router.push('/report')} />
            <ListRow icon="clipboard-list-outline" iconColour={TOOLS.mot.colour} title="MOT check" subtitle={recentHealthCheck(saved) ? 'Can use this health check' : undefined} onPress={() => router.push('/mot')} />
          </Group>
        ) : null}
        <Button
          label={saved ? 'Check again' : 'Run health check'}
          icon="refresh"
          onPress={() => {
            setShowSaved(false);
            void scan();
          }}
        />
      </Screen>
    );
  }

  const info = conn.info;
  const done = Object.keys(results).length;
  const steps = defs.length + 1;
  const progress = (obd ? 1 : 0) + done;
  const moduleCodes = Object.values(results).flatMap((r) => r.faults.map((f) => f.code));
  const obdFaults = obd ? obd.stored.length + obd.pending.length : 0;
  // Every module fault, plus the engine's standard codes no module reported
  // (P0300 and VW 16684 are one fault), plus faults in older modules the
  // check had not read. The same count is saved to History.
  const olderFaults = (deep ?? []).filter((m) => !m.error && !(m.moduleId && (results[m.moduleId]?.state === 'ok' || results[m.moduleId]?.state === 'faults'))).reduce((n, m) => n + m.faults.length, 0);
  const total = moduleCodes.length + (obd ? extraObdCodes(moduleCodes, [...obd.stored, ...obd.pending]).length : 0) + olderFaults;
  // Where an engine code also shows as a module fault, for its row.
  const sameAs = new Map<string, string>();
  for (const r of Object.values(results)) for (const f of r.faults) if (!sameAs.has(faultKey(f.code))) sameAs.set(faultKey(f.code), `same fault as ${faultMeaning(f.code).label} under ${r.def.name}`);
  // Modules found on the older VW protocol answered too: this check's search
  // and the ones saved on the car.
  const olderIds = new Set([...(deep ?? []).filter((m) => m.moduleId && !m.error).map((m) => m.moduleId!), ...(vehicle.deepFound ?? []).map((d) => d.moduleId)]);
  const answeredIds = new Set(Object.values(results).filter((r) => r.state === 'ok' || r.state === 'faults').map((r) => r.def.id));
  const olderOnly = [...olderIds].filter((id) => !answeredIds.has(id) && (deep ?? []).some((m) => m.moduleId === id));
  const answered = answeredIds.size + olderOnly.length;
  const moduleTotal = defs.length + olderOnly.filter((id) => !defs.some((d) => d.id === id)).length;
  const scanning = busy === 'scan';
  const incomplete = info.monitors.filter((m) => m.state === 'incomplete').length;
  const anyToClear = total > 0 || obdFaults > 0 || info.milOn;
  // Faults first, then healthy modules, then the one being read; modules that
  // did not answer (not fitted) are folded away.
  const rank = (id: string) => {
    const r = results[id];
    return !r ? 2 : r.state === 'faults' ? 0 : r.state === 'ok' || r.state === 'error' ? 1 : 3;
  };
  const shownDefs = defs
    .filter((d) => (results[d.id] ? results[d.id].state !== 'no-answer' : scanning && current === d.name))
    // Reorder only once the scan ends, so cards do not jump while it runs.
    .sort((a, b) => (scanning ? 0 : rank(a.id) - rank(b.id)));
  const missing = defs.filter((d) => results[d.id]?.state === 'no-answer' && !olderIds.has(d.id));
  const faulty = defs.filter((d) => results[d.id]?.state === 'faults');
  const healthy = defs.filter((d) => results[d.id]?.state === 'ok');
  const unread = defs.filter((d) => results[d.id]?.state === 'error');

  const pct = steps ? progress / steps : 0;
  const alert = total > 0 || info.milOn;

  return (
    <Screen>
      {/* Back while the check runs asks first; leaving the app or locking the phone does not. */}
      <LeaveRunGuard
        active={scanning}
        onStop={() => {
          stop.current = true;
          setStopping(true);
        }}
      />
      <GlowCard tone={scanning ? 'brand' : alert ? 'fault' : 'ok'} style={styles.hero}>
        {scanning ? (
          <View style={{ alignItems: 'center' }}>
            {withModules ? (
              <ModuleRing
                size={176}
                states={defs.map((d) => {
                  const r = results[d.id];
                  if (!r) return current === d.name ? 'current' : 'pending';
                  return r.state === 'ok' ? 'ok' : r.state === 'faults' ? 'faults' : r.state === 'error' ? 'error' : 'none';
                })}
              >
                <Mascot mood="scanning" size={96} />
              </ModuleRing>
            ) : (
              <ScanPulse active size={150}>
                <Mascot mood="scanning" size={96} />
              </ScanPulse>
            )}
            <Text style={[styles.pct, type.number, { color: t.text }]}>{Math.round(pct * 100)}%</Text>
            <Text style={[type.sub, { color: t.muted, textAlign: 'center' }]} numberOfLines={1}>
              {current ? `Reading ${current}…` : 'Finishing…'}
            </Text>
            {withModules ? (
              <Text style={[type.small, type.number, { color: t.muted, marginTop: 2 }]}>
                {answered} module{answered === 1 ? '' : 's'} answered · {total} fault{total === 1 ? '' : 's'} so far{eta != null && eta > 2 ? ` · ${leftText(eta)}` : ''}
              </Text>
            ) : null}
            {withModules ? (
              <Button
                label={stopping ? 'Stopping…' : 'Stop and keep results'}
                variant="secondary"
                compact
                disabled={stopping}
                onPress={() => {
                  stop.current = true;
                  setStopping(true);
                }}
                style={{ marginTop: space.md, alignSelf: 'stretch' }}
              />
            ) : null}
          </View>
        ) : (
          <Arrive>
            <View style={styles.summaryRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.bigRow}>
                  <Text style={[styles.big, type.number, { color: total ? t.danger : t.ok }]}>{total}</Text>
                  <Text style={[type.title3, { color: t.text, marginBottom: 8 }]}>{total === 1 ? 'fault' : 'faults'}</Text>
                </View>
                <Text style={[type.sub, { color: info.milOn ? t.danger : t.ok, fontWeight: '600' }]}>Engine light {info.milOn ? 'on' : 'off'}</Text>
                <Text style={[type.sub, { color: t.muted }]}>
                  {withModules ? (answered ? `${answered} of ${moduleTotal} module${moduleTotal === 1 ? '' : 's'} answered` : 'No control module answered') : 'Engine computer only'}
                </Text>
                {volts != null ? (
                  <Text style={[type.sub, type.number, { color: volts < 12.2 ? t.danger : t.muted }]}>
                    Battery {volts.toFixed(1)} V, {(volts >= 13.3 ? chargeVerdict(volts) : restVerdict(volts)).word.toLowerCase()}
                    {volts < 12.2 ? ': charge it before clearing faults' : ''}
                  </Text>
                ) : null}
              </View>
              <Mascot mood={alert ? 'worried' : 'happy'} size={96} />
            </View>
          </Arrive>
        )}
      </GlowCard>

      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
      {message ? <Notice tone="ok" icon="check" text={message} /> : null}
      {!scanning && obd && withModules && answered === 0 ? (
        <Notice
          tone="danger"
          icon="alert-circle-outline"
          text="No control module answered, so this is not a clean result: only the engine’s standard codes were read. Check the ignition is on, then tap Check again."
        />
      ) : null}

      {/* What to do next, straight under the result. */}
      {!scanning ? (
        <Group footer={busy === 'deep' ? 'Available when the check finishes.' : undefined}>
          {anyToClear ? <ListRow first icon="broom" iconColour={TOOLS.clear.colour} title="Clear all faults" disabled={!!busy} onPress={() => setConfirm({ kind: 'all' })} /> : null}
          <ListRow first={!anyToClear} icon="file-document-outline" iconColour={TOOLS.report.colour} title="Make health report" onPress={() => router.push('/report')} />
          <ListRow icon="clipboard-list-outline" iconColour={TOOLS.mot.colour} title="MOT check" subtitle="Can use this health check" onPress={() => router.push('/mot')} />
          <ListRow icon="refresh" iconColour={TOOLS.health.colour} title="Check again" disabled={!!busy} onPress={() => scan()} />
          <ListRow
            icon="clipboard-check-outline"
            iconColour={TOOLS.emissions.colour}
            title="Emissions self-tests"
            subtitle="Which self-tests have run, with test results and calibration IDs where the engine keeps them"
            disabled={!!busy}
            onPress={() => router.push('/emissions-tests')}
          />
          {withModules && mode === 'quick' ? (
            <ListRow icon="radar" iconColour={TOOLS.sensors.colour} title="Check every address" subtitle="This was a quick check of the modules your car has. A full check runs by itself every 30 days." disabled={!!busy} onPress={() => scan(true)} />
          ) : null}
        </Group>
      ) : null}

      {!scanning && diff ? <ScanChanges diff={diff} /> : null}

      {withModules ? (
        <>
          {scanning && shownDefs.length ? (
            <Group header="Control modules" help={SECTIONS.diagModules}>
              {shownDefs.map((def, i) => (
                <Arrive key={def.id}>
                  <ModuleBlock def={def} first={i === 0} result={results[def.id]} active={current === def.name} disabled onClear={() => undefined} />
                </Arrive>
              ))}
            </Group>
          ) : null}
          {!scanning
            ? faulty.map((def, k) => (
                <Arrive key={def.id}>
                  <Group header={`${def.name}${def.code && group === 'vag' ? ` · ${def.code}` : ''}`} help={k === 0 ? SECTIONS.diagFaults : undefined}>
                    {results[def.id].faults.map((f, i) => (
                      <FaultRow key={f.code} fault={f} module={def.name} moduleId={f.kwp ? undefined : def.id} first={i === 0} />
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      disabled={!!busy}
                      onPress={() => {
                        tap();
                        setConfirm({ kind: 'module', def });
                      }}
                      style={({ pressed }) => [styles.clearRow, { borderColor: t.border, backgroundColor: pressed ? t.raised : 'transparent', opacity: busy ? 0.4 : 1 }]}
                    >
                      <Text style={[type.body, { color: t.danger }]}>Clear {def.name} faults</Text>
                    </Pressable>
                  </Group>
                </Arrive>
              ))
            : null}
          {!scanning && unread.length ? (
            <Arrive>
              <Group header="Could not read" help={SECTIONS.diagCouldNotRead} footer="Switch the engine off, leave the ignition on, then tap Try these again.">
                {unread.map((def, i) => (
                  <ListRow
                    key={def.id}
                    first={i === 0}
                    icon="help-circle-outline"
                    iconColour="orange"
                    title={def.name}
                    subtitle={results[def.id]?.error}
                  />
                ))}
                <Pressable
                  accessibilityRole="button"
                  disabled={!!busy}
                  onPress={() => {
                    tap();
                    retry(unread);
                  }}
                  style={({ pressed }) => [styles.clearRow, { borderColor: t.border, backgroundColor: pressed ? t.raised : 'transparent', opacity: busy ? 0.4 : 1 }]}
                >
                  <Text style={[type.body, { color: t.accentText }]}>Try these again</Text>
                </Pressable>
              </Group>
            </Arrive>
          ) : null}
          {!scanning && healthy.length ? (
            <Arrive>
              <Group header="No faults" help={SECTIONS.diagModules}>
                {healthy.map((def, i) => (
                  <ModuleBlock key={def.id} def={def} first={i === 0} result={results[def.id]} active={false} disabled onClear={() => undefined} />
                ))}
              </Group>
            </Arrive>
          ) : null}
          {!scanning && missing.some((d) => results[d.id]?.error === SECOND_BUS_ADAPTER_TEXT) ? <Notice icon="information-outline" text={SECOND_BUS_NOTICE} /> : null}
          {missing.length && !scanning ? (
            <Group
              header={showMissing ? 'Not found on this car' : undefined}
              help={showMissing ? SECTIONS.diagNotFound : undefined}
              footer={showMissing ? 'Not fitted, or not reachable from this port.' : undefined}
            >
              {showMissing
                ? missing.map((def, i) => <ListRow key={def.id} first={i === 0} title={def.name} subtitle={results[def.id]?.error} value="No answer" />)
                : null}
              <ListRow
                first={!showMissing}
                title={showMissing ? 'Hide' : `${missing.length} module${missing.length === 1 ? '' : 's'} not found`}
                // Opens and closes in place: an up or down chevron, not the one that goes to another page.
                noChevron
                right={<Icon name={showMissing ? 'chevron-up' : 'chevron-down'} size={13} color={t.faint} />}
                onPress={() => setShowMissing((v) => !v)}
              />
            </Group>
          ) : null}
          {group === 'vag' && !scanning ? (
            <Group
              header="Older VW modules"
              help={SECTIONS.diagOlder}
              footer={
                deep && busy !== 'deep'
                  ? deep.length
                    ? 'Tap a module to read its coding in Workshop. Customise now includes these modules.'
                    : 'No more modules answered at the addresses tried.'
                  : 'Some VW group modules, such as comfort and doors, speak an older protocol. Caristini looks for them once per car and reads them with the rest after that.'
              }
            >
              {(deep ?? []).map((m, i) => (
                <View key={m.address}>
                  <ListRow
                    first={i === 0}
                    icon={m.error ? 'help-circle-outline' : m.faults.length ? 'alert-circle-outline' : 'check-circle-outline'}
                    iconColour={m.error ? 'orange' : m.faults.length ? 'red' : 'green'}
                    title={(m.moduleId && client?.moduleById(m.moduleId)?.name) || tp20Name(m.address)}
                    subtitle={m.error ?? ([m.component, m.part].filter(Boolean).join(' · ') || undefined)}
                    value={m.error ? 'Could not read' : m.faults.length ? `${m.faults.length} fault${m.faults.length === 1 ? '' : 's'}` : 'No faults'}
                    onPress={m.moduleId && !m.error ? () => router.push({ pathname: '/workshop/[id]', params: { id: m.moduleId! } }) : undefined}
                  />
                  {m.faults.map((f) => (
                    <CodeRow key={f.code} code={f.code} sub="Stored" module={(m.moduleId && client?.moduleById(m.moduleId)?.name) || tp20Name(m.address)} />
                  ))}
                  {m.faults.length ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={!!busy}
                      onPress={() => {
                        tap();
                        setConfirm({ kind: 'tp20', address: m.address });
                      }}
                      style={({ pressed }) => [styles.clearRow, { borderColor: t.border, backgroundColor: pressed ? t.raised : 'transparent', opacity: busy ? 0.4 : 1 }]}
                    >
                      <Text style={[type.body, { color: t.danger }]}>Clear {tp20Name(m.address)} faults</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {deep?.some((m) => m.moduleId && !m.error) && busy !== 'deep' ? (
                <ListRow icon="tune-variant" iconColour={TOOLS.customise.colour} title="Settings for these modules" onPress={() => router.push('/customise')} />
              ) : null}
              {busy === 'deep' ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={t.muted} />
                  <Text style={[type.sub, type.number, { color: t.muted }]}>Looking for older VW modules… {Math.round(deepPct * 100)}%</Text>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={!!busy}
                  onPress={() => {
                    tap();
                    deepScan();
                  }}
                  style={({ pressed }) => [styles.clearRow, { borderColor: t.border, backgroundColor: pressed ? t.raised : 'transparent', opacity: busy ? 0.4 : 1 }]}
                >
                  <Text style={[type.body, { color: t.accentText }]}>{deep || vehicle.deepFound ? 'Look for older VW modules again' : 'Look for older VW modules'}</Text>
                </Pressable>
              )}
            </Group>
          ) : null}
        </>
      ) : (
        <Notice
          icon="information-outline"
          text={
            group === 'other'
              ? 'Module checks are set up for VW group, Ford and Mazda. Other makes get the standard engine check below.'
              : 'Your car uses an older protocol, so only the standard engine check is available.'
          }
        />
      )}

      <Group
        header="Engine emissions (OBD2)"
        help={SECTIONS.diagEmissions}
        footer={obd?.permanent.length ? 'Permanent: the code stays until the car sees the fault fixed during normal driving; clearing does not remove it.' : 'The standard emissions codes every car reports.'}
      >
        {obd ? (
          <>
            <ListRow first title="Engine light" value={info.milOn ? 'On' : 'Off'} />
            {[...new Set([...obd.stored, ...obd.pending, ...obd.permanent])].map((code) => (
              <CodeRow
                key={code}
                code={code}
                sub={[obdStates(code, obd), sameAs.get(faultKey(code))].filter(Boolean).join(' · ')}
              />
            ))}
          </>
        ) : (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={t.muted} />
            <Text style={[type.sub, { color: t.muted }]}>Reading the engine computer…</Text>
          </View>
        )}
      </Group>

      {freeze.map((f) => (
        <Group
          key={f.frame}
          header={`Freeze frame${freeze.length > 1 ? ` ${f.frame + 1}` : ''} for ${f.code}`}
          help={SECTIONS.diagFreeze}
          footer={
            f.values.some((v) => !v.decoded)
              ? 'What the engine was doing when the fault was stored. Values with no standard formula are shown raw, as the bytes the car sent.'
              : 'What the engine was doing when the fault was stored.'
          }
        >
          <ListRow first title="Stored with" value={f.code} mono onPress={() => router.push({ pathname: '/code/[code]', params: { code: f.code, module: 'Engine (OBD2)' } })} />
          {f.values.map((v) => (
            <ListRow key={v.pid} title={v.label} subtitle={v.decoded ? undefined : 'Raw bytes'} value={freezeText(v, (x, u) => toUserUnits(x, u, settings))} mono={!v.decoded} />
          ))}
          {!f.values.length ? <ListRow title="No values stored with this frame" /> : null}
        </Group>
      ))}

      {info.monitors.length ? (
        <Group
          header={`Emissions self-tests${info.diesel ? ' (diesel)' : ''}`}
          help={SECTIONS.diagMonitors}
          footer="Complete: the test has run since faults were last cleared; a failed test stores a fault. Not yet run: drive normally and it runs. Clearing faults resets them all."
        >
          <ListRow
            first
            icon={incomplete ? 'progress-clock' : 'check-circle-outline'}
            iconColour={incomplete ? 'grey' : 'green'}
            title={readinessSummary(info.monitors).text}
            noChevron
          />
          {info.monitors.map((m) => (
            <ListRow
              key={m.name}
              title={m.name}
              subtitle={monitorMeaning(m.name)}
              right={<Pill text={MONITOR_STATE_LABEL[m.state]} tone={m.state === 'complete' ? 'ok' : 'neutral'} />}
            />
          ))}
        </Group>
      ) : null}

      {busy === 'clear' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={t.muted} />
          <Text style={[type.sub, { color: t.muted }]}>Clearing faults…</Text>
        </View>
      ) : null}

      <ConfirmSheet
        visible={!!confirm}
        title={confirm?.kind === 'module' ? `Clear ${confirm.def.name} faults?` : confirm?.kind === 'tp20' ? `Clear ${tp20Name(confirm.address)} faults?` : 'Clear all faults?'}
        lines={
          confirm?.kind === 'tp20'
            ? [CLEAR_ENGINE_LINE, `Clears the faults of the module at ${tp20Name(confirm.address).toLowerCase()}. Faults that are still present come back.`]
            : confirm?.kind === 'module'
            ? [CLEAR_ENGINE_LINE, `Clears ${results[confirm.def.id]?.faults.length ?? 0} fault${results[confirm.def.id]?.faults.length === 1 ? '' : 's'} in the ${confirm.def.name} module. Faults that are still present come back.`]
            : [
                CLEAR_ENGINE_LINE,
                `Clears ${total} fault${total === 1 ? '' : 's'}${faulty.length ? ` in ${faulty.map((d) => d.name).join(', ')}` : ''}${info.milOn ? ' and the engine light' : ''}.`,
                'This also resets the emissions self-tests, so an MOT can fail until you have driven enough for them to complete.',
              ]
        }
        confirmLabel={confirm?.kind === 'all' ? 'Clear all faults' : 'Clear faults'}
        onConfirm={() => confirm && clear(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}

function ModuleBlock({
  def,
  result,
  active,
  disabled,
  first,
  onClear,
}: {
  def: ModuleDef;
  result?: ModuleFaults;
  active: boolean;
  disabled: boolean;
  first: boolean;
  onClear: () => void;
}) {
  const t = useTheme();
  // Workshop address numbers are a VW group convention.
  const vag = useConnection().vehicle?.group === 'vag';
  const state = result?.state;
  const n = result?.faults.length ?? 0;
  const right = !result ? (
    active ? <ActivityIndicator size="small" color={t.muted} /> : null
  ) : state === 'faults' ? (
    <Pill text={`${n} fault${n === 1 ? '' : 's'}`} tone="danger" />
  ) : state === 'ok' ? (
    <Pill text="No faults" tone="ok" />
  ) : (
    <Pill text="Could not read" />
  );
  return (
    <View>
      <ListRow
        first={first}
        icon={state === 'faults' ? 'alert-circle' : state === 'ok' ? 'check-circle' : 'chip'}
        iconColour={state === 'faults' ? 'red' : state === 'ok' ? 'green' : 'grey'}
        title={def.name}
        subtitle={state === 'error' && result?.error ? result.error : def.code && vag ? `Address ${def.code}` : undefined}
        right={right}
      />
      {result?.faults.map((f) => <FaultRow key={f.code} fault={f} module={def.name} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingVertical: space.xl, paddingHorizontal: space.xl, marginBottom: space.xl },
  pct: { fontSize: 34, lineHeight: 41, fontWeight: '700', marginTop: space.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  big: { fontSize: 56, lineHeight: 62, fontWeight: '700', letterSpacing: -1 },
  stateIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  clearRow: { borderTopWidth: StyleSheet.hairlineWidth, marginLeft: space.lg, minHeight: 48, justifyContent: 'center' },
});
