import { router, Stack } from 'expo-router';
import { allowSleep, stayAwake } from '../keepAwake';
import { backgroundNote, keepRunning, letStop } from '../background';
import type { GpsStart } from '../logger/gps';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { estimateSeconds, FULL_READ_DAYS, LEARN_ORDER, learnEstimate, learnMode, LearnStep, learnSummaryHeader, LearnSummary, runLearn, StepOutcome } from '../learn/runLearn';
import { aboutRange, dateText, dateTimeText, leftText, shortDuration } from '../timeText';
import { modulesText, sensorCountText } from '../vehicle/counts';
import { sendBack } from '../share/sendBack';
import { sendLogNow, skipUnsentLog } from '../share/sendLog';
import { useConnection } from '../state';
import { space, type, useTheme } from '../theme';
import { Button, GlowCard, Group, Icon, IconName, ListRow, NeedsConnection, Notice, Pill, ProgressBar, ScanPulse, Screen, success, tool, TOOLS } from '../ui';
import { useGarage } from '../vehicle/garage';
import { SECTIONS, WHAT_IS_SENT } from '../help';
import { LeaveRunGuard } from '../leaveRun';

const STEPS: Record<LearnStep, { title: string; icon: IconName; detail: string }> = {
  modules: { title: 'Find every module', icon: 'chip', detail: 'Part number, software and a backup of the coding of each module. Works on any make.' },
  faults: { title: 'Health check', icon: 'heart-pulse', detail: 'Faults in every module, older VW modules too, and the engine’s codes and freeze frames. Saved as a health check.' },
  sensors: { title: 'Find my car’s sensors', icon: 'radar', detail: 'Tries the sensors the public lists know for this kind of car.' },
  values: { title: 'Explore unknown values', icon: 'telescope' as IconName, detail: 'Looks for values no list knows yet and reads them twice to see which move. 2.5 minutes a run, carrying on where the last run stopped.' },
  emissions: { title: 'Emissions self-tests', icon: 'clipboard-check-outline', detail: 'Which self-tests have run, with test results and calibration IDs where the engine keeps them.' },
  mot: { title: 'MOT check from the car', icon: 'clipboard-list-outline', detail: 'Engine light and the faults the MOT looks at. Only the walk-round is left.' },
  battery: { title: 'Battery and odometer', icon: 'car-battery', detail: 'Battery voltage and the distance on the odometer.' },
  send: { title: 'Save and send', icon: 'cloud-upload-outline' as IconName, detail: 'Keeps what was learned on this phone and sends it to your private findings store, unless you switch sending off above.' },
};

// Where each result is shown, for the summary at the end.
const RESULT_LINKS: { step: LearnStep; title: string; icon: IconName; colour: 'red' | 'green' | 'teal' | 'purple' | 'blue'; go: () => void }[] = [
  { step: 'faults', title: 'Faults', icon: 'heart-pulse', colour: 'red', go: () => router.push({ pathname: '/diagnostics', params: { view: 'last' } }) },
  { step: 'mot', title: 'MOT check', icon: 'clipboard-list-outline', colour: 'green', go: () => router.push('/mot') },
  { step: 'emissions', title: 'Emissions self-tests', icon: 'clipboard-check-outline', colour: 'teal', go: () => router.push('/emissions-tests') },
  { step: 'modules', title: 'Customise', icon: 'tune-variant', colour: 'purple', go: () => router.push('/customise') },
  { step: 'sensors', title: 'Live data', icon: 'chart-timeline-variant', colour: 'blue', go: () => router.push('/live') },
];

const LOOK: Record<StepOutcome['state'], { icon: IconName; colour: 'green' | 'orange' | 'grey' | 'red' }> = {
  done: { icon: 'check-circle', colour: 'green' },
  partial: { icon: 'progress-clock', colour: 'orange' },
  stopped: { icon: 'pause-circle-outline', colour: 'grey' },
  failed: { icon: 'alert-circle-outline', colour: 'red' },
  skipped: { icon: 'minus-circle-outline', colour: 'grey' },
};
const PILL: Partial<Record<StepOutcome['state'], string>> = { partial: 'Carries on next time', stopped: 'Stopped', failed: 'Failed', skipped: 'Not run' };

// Learn my car: one button that reads everything once (src/learn/runLearn.ts)
// and sends what it found back, to be built into the next update.
// The app has no AI features (owner's choice, 15 Nov 2026).
export default function LearnCar() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const client = conn.client;
  const v = conn.vehicle;
  const [running, setRunning] = useState<LearnStep | null>(null);
  const [outcomes, setOutcomes] = useState<Partial<Record<LearnStep, StepOutcome>>>({});
  const [progress, setProgress] = useState<{ value: number; label: string }>({ value: 0, label: '' });
  const [summary, setSummary] = useState<LearnSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  const [stopping, setStopping] = useState(false);
  // Whether this run can carry on with Caristini in the background.
  const [bg, setBg] = useState<GpsStart | null>(null);
  const learnStarted = useRef(0);
  // When the step on screen began, for the time left.
  const stepStarted = useRef(0);
  // Read everything again: identities, codings, sensors, every address, values.
  const [everything, setEverything] = useState(false);
  // Send what this run finds (and its adapter log). Off keeps the run on this phone.
  const [sendRun, setSendRun] = useState(true);
  const alive = useRef(true);
  // Redraws the minutes now and then during a slow step.
  const [, setTick] = useState(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, [running]);

  if (!client || !v || !conn.info) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to learn it" />
      </Screen>
    );
  }

  // The adapter's pace measured on this connection (pace.ts), else the last run's.
  const pace = client.pace.snapshot();
  const mode = learnMode(v, { everything });
  const est = learnEstimate(v, garage.vehicles, { everything, pace });
  const [lo, hi] = estimateSeconds(est);
  const about = `${aboutRange(lo, hi)} on this car${pace ? ' at your adapter’s pace' : ''}, engine running.`;
  const intro =
    mode.why === 'repeat'
      ? `Repeat run: refreshes the faults of every module, emissions, the MOT read, battery and odometer, and carries on exploring values. ${about} Modules and sensors were read on ${dateText(v.learnFullAt!)}.`
      : mode.why === 'first'
        ? `First run: everything is read once (modules, faults, sensors, values, emissions, MOT and battery). ${about} Later runs are quicker.`
        : `Full read${mode.why === 'old' ? `, due every ${FULL_READ_DAYS} days` : ''}: reads modules, sensors and every address again. ${about}`;

  const run = async () => {
    // Read once: switching it during a run does not change that run.
    const send = sendRun;
    // Off: lines from before this run still go as Settings says; this run's do not.
    if (!send) void sendLogNow('before Learn my car', v);
    stop.current = false;
    setStopping(false);
    learnStarted.current = Date.now();
    setError(null);
    setSummary(null);
    setOutcomes({});
    stayAwake('learn');
    setBg(null);
    let finished = false;
    void keepRunning('learn').then((b) => alive.current && setBg(b));
    try {
      const r = await runLearn({
        client,
        vin: v.vin,
        garage,
        isCan: conn.info?.isCan ?? true,
        everything,
        send,
        readStatus: () => conn.refreshStatus(),
        cancelled: () => stop.current || !alive.current,
        onStep: (s, o) => {
          if (!alive.current) return;
          if (o === 'running') {
            stepStarted.current = Date.now();
            setRunning(s);
            setProgress({ value: 0, label: '' });
          } else setOutcomes((x) => ({ ...x, [s]: o }));
        },
        onProgress: (value, label) => alive.current && setProgress({ value, label }),
        log: (reason) => {
          if (send) void sendLogNow(reason, v);
        },
        sendBack: (kind, vin, data) => sendBack(kind, vin, data),
      });
      if (!alive.current) return;
      finished = true;
      if (r.aborted) setError(r.aborted);
      else success();
      // The final notes: step 1's count takes in modules the health check added.
      setOutcomes({ ...r.steps });
      setSummary(r);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      allowSleep('learn');
      letStop('learn', finished);
      if (alive.current) setBg(null);
      if (send) void sendLogNow('Learn my car', v);
      else skipUnsentLog();
      if (alive.current) setRunning(null);
    }
  };

  // Time left: what the steps still to come usually take, plus what is left
  // of the one running now.
  const left = (() => {
    if (!running) return 0;
    const at = LEARN_ORDER.indexOf(running);
    const mid = (s: LearnStep) => (est[s][0] + est[s][1]) / 2;
    const rest = LEARN_ORDER.slice(at + 1).reduce((n, s) => n + mid(s), 0);
    const now = Math.max(0, mid(running) - (Date.now() - stepStarted.current) / 1000);
    return rest + now;
  })();
  const finished = (s: LearnStep) => outcomes[s]?.state === 'done';
  const failedSteps = LEARN_ORDER.filter((s) => outcomes[s]?.state === 'failed');
  const k = Object.entries(v.knowledge ?? {});
  const sent = summary?.sent;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Learn my car' }} />
      {/* Back while a run is active asks first; leaving the app or locking the phone does not. */}
      <LeaveRunGuard
        active={!!running}
        onStop={() => {
          stop.current = true;
          setStopping(true);
        }}
      />
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}

      {/* Amber only while the run is reading the car; waiting to start, the card is plain and the icon wears the tool's own square. */}
      <GlowCard tone={running ? 'brand' : 'plain'} style={{ alignItems: 'center' }}>
        <ScanPulse active={!!running} size={128}>
          <View style={[styles.core, { backgroundColor: running ? t.accentSoft : t[TOOLS.learn.colour] }]}>
            <Icon name={TOOLS.learn.icon} size={40} color={running ? t.accent : '#FFFFFF'} />
          </View>
        </ScanPulse>
        <Text style={[type.title3, { color: t.text, marginTop: space.md, textAlign: 'center' }]}>{running ? STEPS[running].title : 'Learn my car'}</Text>
        {running ? (
          <Text style={[type.small, type.number, { color: t.muted, marginTop: 2, textAlign: 'center' }]}>
            Step {LEARN_ORDER.indexOf(running) + 1} of {LEARN_ORDER.length} · {shortDuration(Date.now() - learnStarted.current)} so far{left >= 5 ? ` · ${leftText(left)}` : ''}
          </Text>
        ) : null}
        <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: 4, marginBottom: space.lg }]}>
          {running
            ? 'Keep the engine running and the phone near the car. Nothing is changed in the car.'
            : `${intro} Read-only. Stop any time and keep what was found.`}
        </Text>
        {running ? (
          <View style={{ alignSelf: 'stretch' }}>
            <ProgressBar value={progress.value} label={progress.label} />
            <View style={{ marginTop: space.lg }}>
              <Button
                label={stopping ? 'Stopping…' : 'Stop and keep results'}
                variant="secondary"
                disabled={stopping}
                onPress={() => {
                  stop.current = true;
                  setStopping(true);
                }}
              />
            </View>
          </View>
        ) : (
          <View style={{ alignSelf: 'stretch' }}>
            <Button label={v.learnRun ? 'Learn again' : 'Start learning'} icon="school-outline" onPress={run} />
          </View>
        )}
      </GlowCard>

      {running && backgroundNote(bg) ? <Notice icon={bg === 'on' ? 'cellphone-arrow-down' : 'cellphone-lock'} text={backgroundNote(bg)!} /> : null}

      {summary && !summary.aborted && !running ? (
        <Group
          header={learnSummaryHeader(summary)}
          help={SECTIONS.learnCarResults}
          footer={
            [
              failedSteps.length ? `${failedSteps.map((s) => STEPS[s].title).join(', ')} failed; the rest carried on. Run Learn my car again to try ${failedSteps.length === 1 ? 'it' : 'them'} again.` : null,
              sent ? (sent.via === 'github' ? 'Sent to your private findings store.' : sent.detail) : null,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
        >
          {RESULT_LINKS.map((l, i) => (
            <ListRow
              key={l.title}
              first={i === 0}
              icon={l.icon}
              iconColour={l.colour}
              title={l.title}
              subtitle={
                l.step === 'modules' && finished('modules')
                  ? `${modulesText(summary.modules)}, ${summary.codings} coding${summary.codings === 1 ? '' : 's'} backed up`
                  : l.step === 'sensors' && (summary.sensors || summary.groupValues)
                    ? sensorCountText({ maker: summary.sensors, groupValues: summary.groupValues, groups: summary.groups })
                    : outcomes[l.step]?.note
              }
              right={finished(l.step) ? undefined : <Pill text={PILL[outcomes[l.step]?.state ?? 'skipped'] ?? 'Not run'} />}
              onPress={l.go}
            />
          ))}
        </Group>
      ) : null}

      {!running && v.learnFullAt ? (
        <Group
          footer={`Repeat runs keep what does not change. Switch this on to read module identities and codings, sensors, every address and values again, for example after fitting or replacing a module. Done by itself every ${FULL_READ_DAYS} days.`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 10, gap: space.sm }}>
            <Text style={[type.body, { color: t.text, flex: 1 }]}>Read everything again</Text>
            <Switch accessibilityLabel="Read everything again" value={everything} onValueChange={setEverything} />
          </View>
        </Group>
      ) : null}

      {!running ? (
        <Group footer={WHAT_IS_SENT}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 10, gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: t.text }]}>Send what this run finds</Text>
              <Text style={[type.sub, { color: t.muted, marginTop: 2 }]}>{sendRun ? 'On: sent when the run ends' : 'Off: this run and its adapter log stay on this phone'}</Text>
            </View>
            <Switch accessibilityLabel="Send what this run finds" value={sendRun} onValueChange={setSendRun} />
          </View>
        </Group>
      ) : null}

      <Group header="What happens" help={SECTIONS.learnCarSteps}>
        {LEARN_ORDER.map((key, i) => {
          const s = STEPS[key];
          const o = outcomes[key];
          const now = running === key;
          // Saved but not sent is not a green tick: the step ended, and its line says nothing was sent.
          const notSent = key === 'send' && o?.state === 'done' && (/not sent/i.test(o.note ?? '') || (!!sent && sent.via !== 'github'));
          const look = notSent ? { icon: s.icon, colour: 'grey' as const } : o ? LOOK[o.state] : null;
          return (
            <ListRow
              key={key}
              first={i === 0}
              icon={look?.icon ?? s.icon}
              iconColour={look?.colour ?? (now ? 'orange' : 'indigo')}
              title={`${i + 1}. ${s.title}`}
              subtitle={o?.note ?? s.detail}
              right={now ? <Pill text="Now" tone="accent" /> : o && PILL[o.state] ? <Pill text={PILL[o.state]!} tone={o.state === 'failed' ? 'danger' : 'neutral'} /> : undefined}
              noChevron
            />
          );
        })}
      </Group>

      {k.length ? (
        <Group
          header="What Caristini knows about this car"
          help={SECTIONS.learnCarKnows}
          footer={running ? 'These open when the run ends, so nothing else talks to the car while it is being read.' : v.learnRun ? `Last learned ${dateTimeText(v.learnRun.at)}.` : undefined}
        >
          {k.map(([id, info], i) => (
            // Not tappable during a run: Workshop would talk to the car at the same time.
            <ListRow key={id} first={i === 0} {...tool('module')} title={info.plainName} subtitle={[info.part, info.what].filter(Boolean).join(' · ') || undefined} disabled={!!running} onPress={() => router.push(`/workshop/${id}`)} />
          ))}
        </Group>
      ) : null}

      <Group footer="For experts: explore one module for values no list names yet. What Learn my car explored is shown there too, and either carries on where the other stopped.">
        <ListRow first {...tool('discover')} title="Unknown values" disabled={!!running} onPress={() => router.push('/discover')} />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  core: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
