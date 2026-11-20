// MOT check: the car's warning lamps and faults, a guided walk-round and a
// result of likely fails and advisories. Rules and sources: src/mot/rules.ts
// and replica/mot-rules-sources.md. Read-only on the car.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Mascot } from '../brand/Mascot';
import { useLastScan, when } from '../components/LastScan';
import { SECTIONS } from '../help';
import { addHistory } from '../history';
import { allowSleep, stayAwake } from '../keepAwake';
import { HistoryEntry } from '../history';
import { LeaveRunGuard } from '../leaveRun';
import { fromHealthCheck, newerHealthCheck, readAgeLine, readCarForMot, recentHealthCheck } from '../mot/read';
import {
  Answer,
  carFindings,
  carNotes,
  failIfFor,
  Finding,
  headline,
  historyDetail,
  historyTitle,
  ItemState,
  itemApplies,
  MOT_HISTORY_URL,
  MOT_MANUAL_READ,
  MOT_MANUAL_URL,
  MotCar,
  otherFaultCount,
  sectionFor,
  shareText,
  stillToDo,
  summarise,
  WALK,
  WalkItem,
} from '../mot/rules';
import { clearDraft, loadDraft, MotDraft, saveDraft } from '../mot/store';
import { useConnection } from '../state';
import { MONO, space, type, useTheme } from '../theme';
import { TOOLS, Button, ConfirmSheet, Field, GlowCard, GuideButton, Group, Icon, ListRow, Notice, Pill, Screen, Segmented, success, tap, Tone, tool } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';

const fresh = (vin: string): MotDraft => ({ vin, startedAt: Date.now(), answers: {}, read: null });

export default function MotCheck() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  // Opened from a car's page: that car. Otherwise the connected car, or with
  // no adapter the car used last.
  const { vin: asked } = useLocalSearchParams<{ vin?: string }>();
  const vin = (asked && garage.get(asked) ? asked : undefined) ?? conn.vehicle?.vin ?? garage.vehicles[0]?.vin;
  const v = garage.get(vin) ?? conn.vehicle ?? undefined;
  const car: MotCar = { fuel: v?.fuel ?? null, year: v?.year ?? null };
  const connected = !!conn.client && !!conn.info && !!vin && conn.vehicle?.vin === vin;
  const last = useLastScan(vin);
  const recent = recentHealthCheck(last);

  const [draft, setDraft] = useState<MotDraft | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const alive = useRef(true);
  const stop = useRef(false);
  // True while "Read the car" runs: going back then asks first.
  const [reading, setReading] = useState(false);
  // A health check is used by itself once: a recent one when the car has not
  // been read, or any complete one newer than the car read.
  const autoUsed = useRef<string | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);

  useEffect(() => {
    if (!vin) return;
    loadDraft(vin).then((d) => alive.current && setDraft(d ?? fresh(vin)));
  }, [vin]);

  const update = (patch: Partial<MotDraft>) =>
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      void saveDraft(next);
      return next;
    });

  const setAnswer = (id: string, a: Answer) => setDraft((d) => {
    if (!d) return d;
    const next = { ...d, answers: { ...d.answers, [id]: a } };
    void saveDraft(next);
    return next;
  });

  useEffect(() => {
    if (!v || !draft || step) return;
    const use = newerHealthCheck(draft.read, last);
    if (!use || autoUsed.current === use.id) return;
    autoUsed.current = use.id;
    void applyCheck(use, !!draft.read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, last?.id]);

  if (!vin || !v || !draft) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'MOT check', headerRight: () => <GuideButton id="mot" /> }} />
        {!vin ? (
          <>
            <Notice icon="information-outline" text="Connect to your car once so Caristini knows it. The walk-round then works without the adapter." />
            <Button label="Connect adapter" icon="bluetooth" onPress={() => router.push('/connect')} />
          </>
        ) : (
          <ActivityIndicator color={t.muted} />
        )}
      </Screen>
    );
  }

  const group = v.group;
  const read = draft.read;
  const s = summarise(read, draft.answers, car);
  const fromCar = read ? carFindings(read, car) : [];
  const others = read ? otherFaultCount(read, car) : 0;
  const carLabel = [vehicleTitle(v), v.year, v.fuel].filter(Boolean).join(', ');

  const readNow = async () => {
    if (!conn.client) return;
    stop.current = false;
    setError(null);
    setMessage(null);
    setStep('the engine light');
    setReading(true);
    // The phone stays awake for the read, as on every long read.
    stayAwake('mot');
    try {
      const r = await readCarForMot(conn.client, group, {
        seen: v.modulesSeen,
        onStep: (what, done, total) => alive.current && setStep(total > 1 ? `${what} (${done + 1} of ${total})` : what),
        cancelled: () => stop.current || !alive.current,
      });
      if (!alive.current) return;
      update({ read: r });
      success();
    } catch (e) {
      if (alive.current) setError(`Reading stopped: ${e instanceof Error ? e.message : String(e)}. Check the ignition is on, then tap Read the car again.`);
    } finally {
      allowSleep('mot');
      if (alive.current) {
        setStep(null);
        setReading(false);
      }
    }
  };

  // The health check's module faults, with the engine light and battery read again when connected.
  // replaced: it took the place of an older car read, so the page says so.
  const applyCheck = async (recent: HistoryEntry, replaced = false) => {
    setError(null);
    setStep('the engine light');
    try {
      const status = connected ? await conn.client!.readStatus().catch(() => null) : null;
      const volts = connected ? await conn.client!.batteryVoltage().catch(() => null) : null;
      const milOn = status ? status.milOn : connected ? (conn.info?.milOn ?? null) : v.lastMilOn;
      const monitors = status ? status.monitors : connected ? (conn.info?.monitors ?? []) : [];
      if (!alive.current) return;
      update({ read: fromHealthCheck(recent, group, { milOn, volts, monitorsIncomplete: monitors.length ? monitors.filter((m) => m.state === 'incomplete').length : null }, v.modulesSeen) });
      if (replaced) setMessage(`Now shows the health check of ${when(recent.at)}: it is newer than the car read this page had.`);
      success();
    } finally {
      if (alive.current) setStep(null);
    }
  };

  const share = () => Share.share({ title: 'MOT check', message: shareText(s, { car: carLabel, at: Date.now(), read }) });

  const save = async () => {
    const text = shareText(s, { car: carLabel, at: Date.now(), read });
    await addHistory({
      vin,
      kind: 'mot',
      title: historyTitle(s),
      detail: historyDetail(s),
      faults: [...s.fails, ...s.advisories].filter((f) => f.code).map((f) => ({ module: f.module ?? 'Car', code: f.code!, text: f.title })),
      motText: text,
      odometerKm: v.odometerKm,
    });
    update({ savedAt: Date.now() });
    success();
    setMessage('Saved to History.');
  };

  const restart = async () => {
    setConfirmReset(false);
    await clearDraft(vin);
    setDraft(fresh(vin));
    setMessage(null);
  };

  // Before the car is read or any item checked there is no result to show.
  const notYet = !read && !s.checked;
  const tone = s.verdict === 'fail' ? 'fault' : s.verdict === 'incomplete' ? 'brand' : 'ok';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'MOT check', headerRight: () => <GuideButton id="mot" /> }} />
      {/* Back while the car is being read asks first; leaving the app or locking the phone does not. */}
      <LeaveRunGuard active={reading} onStop={() => (stop.current = true)} />

      <GlowCard tone={tone} style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={[type.small, { color: t.muted }]}>{carLabel}</Text>
            {notYet ? (
              // No count until there is something to count.
              <Text style={[type.title, { color: t.text, marginVertical: space.sm }]}>Not checked yet</Text>
            ) : (
              <View style={styles.bigRow}>
                <Text style={[styles.big, type.number, { color: s.fails.length ? t.danger : s.verdict === 'incomplete' ? t.text : t.ok }]}>{s.fails.length}</Text>
                <Text style={[type.title3, { color: t.text, marginBottom: 8 }]}>likely {s.fails.length === 1 ? 'fail' : 'fails'}</Text>
              </View>
            )}
            <Text style={[type.sub, { color: t.text, fontWeight: '600' }]}>{notYet ? `To do: ${stillToDo(s)}.` : headline(s)}</Text>
            {notYet ? null : (
              <Text style={[type.sub, type.number, { color: t.muted }]}>
                {s.advisories.length} advisor{s.advisories.length === 1 ? 'y' : 'ies'} · {s.checked} of {s.applicable} walk-round items checked
              </Text>
            )}
            {/* How old the car's part of the result is. */}
            {read ? <Text style={[type.small, { color: t.muted, marginTop: 2 }]}>{readAgeLine(read)}</Text> : null}
          </View>
          <Mascot mood={s.verdict === 'fail' ? 'worried' : s.verdict === 'incomplete' ? 'scanning' : 'happy'} size={88} />
        </View>
      </GlowCard>

      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
      {message ? <Notice tone="ok" icon="check" text={message} /> : null}

      <Group
        header="From the car"
        help={SECTIONS.motCar}
        footer={
          read
            ? `${read.by === 'learn' ? `From Learn my car, ${when(read.at)}` : read.from === 'health-check' && read.healthCheckAt ? `Module faults from the health check of ${when(read.healthCheckAt)}` : `Read ${when(read.at)}`}${read.complete ? '' : ', stopped early'}. Nothing was cleared.`
            : 'Reads only: nothing is cleared or changed.'
        }
      >
        {step ? (
          <View>
            <View style={styles.loadingRow}>
              <ActivityIndicator color={t.muted} />
              <Text style={[type.sub, { color: t.muted, flex: 1 }]} numberOfLines={2}>
                Reading {step}…
              </Text>
            </View>
            <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
              <Button label="Stop and keep results" variant="secondary" compact onPress={() => (stop.current = true)} />
            </View>
          </View>
        ) : read ? (
          <>
            <ListRow
              first
              icon="engine-outline"
              iconColour={read.milOn ? 'red' : read.milOn === false ? 'green' : 'grey'}
              title="Engine light"
              right={<Pill text={read.milOn == null ? 'Not read' : read.milOn ? 'On' : 'Off'} tone={read.milOn ? 'danger' : read.milOn === false ? 'ok' : 'neutral'} />}
            />
            <ListRow
              icon="chip"
              iconColour="grey"
              title="Modules"
              value={`${read.modulesAnswered} answered`}
              subtitle={read.notRead.length ? `Could not read ${read.notRead.join(', ')}` : undefined}
            />
            {fromCar.map((f) => (
              <FindingRow key={f.key} f={f} />
            ))}
            {!fromCar.length ? <ListRow icon="check-circle-outline" iconColour="green" title="Nothing the MOT checks was found" noChevron /> : null}
            {others ? (
              <ListRow
                icon="information-outline"
                iconColour="grey"
                title={`${others} other fault${others === 1 ? '' : 's'}`}
                subtitle="Not MOT items as far as the manual shows. See them in the health check."
                onPress={() => router.push({ pathname: '/diagnostics', params: { view: 'last' } })}
              />
            ) : null}
            {carNotes(read).map((n) => (
              <ListRow key={n} icon="information-outline" iconColour="grey" title={n} />
            ))}
            {connected ? <ListRow icon="refresh" iconColour={TOOLS.mot.colour} title="Read the car again" onPress={readNow} /> : null}
          </>
        ) : (
          <>
            {recent ? (
              <ListRow
                first
                {...tool('health')}
                title={`Use the health check from ${when(recent.at)}`}
                subtitle={`${recent.faults?.length ?? 0} fault${recent.faults?.length === 1 ? '' : 's'}. Saves reading the modules again.${connected ? ' The engine light is read again.' : ''}`}
                onPress={() => applyCheck(recent)}
              />
            ) : null}
            {connected ? (
              <ListRow
                first={!recent}
                icon="car-search-outline"
                iconColour={TOOLS.mot.colour}
                title="Read the car now"
                subtitle="Engine light, engine codes and the modules whose warning lamps the MOT checks."
                onPress={readNow}
              />
            ) : (
              <ListRow
                first={!recent}
                icon="bluetooth"
                iconColour={TOOLS.mot.colour}
                title="Connect adapter"
                subtitle="To read the warning lamps and faults. The walk-round works without it."
                onPress={() => router.push('/connect')}
              />
            )}
          </>
        )}
      </Group>

      {WALK.map((g, gi) => (
        <Group key={g.id} header={g.title} help={gi === 0 ? SECTIONS.motWalk : undefined}>
          {g.items.map((item, i) => (
            <WalkRow key={`${item.id}-${draft.startedAt}`} item={item} car={car} first={i === 0} answer={draft.answers[item.id]} onChange={(a) => setAnswer(item.id, a)} />
          ))}
        </Group>
      ))}

      <Group header="Result" help={SECTIONS.motResult} footer={s.unchecked.length > 6 ? `${s.unchecked.length} walk-round items not checked yet.` : s.unchecked.length ? `Not checked yet: ${s.unchecked.map((i) => i.title).join('; ')}.` : undefined}>
        {s.fails.map((f, i) => (
          <FindingRow key={f.key} f={f} first={i === 0} />
        ))}
        {s.advisories.map((f, i) => (
          <FindingRow key={f.key} f={f} first={!s.fails.length && i === 0} />
        ))}
        {!s.fails.length && !s.advisories.length ? <ListRow first icon="check-circle-outline" iconColour="green" title={headline(s)} noChevron /> : null}
      </Group>

      {/* Not while the car is being read: the result would be the old read's. */}
      <Group footer={step ? 'Share and Save are ready when the car has been read.' : undefined}>
        <ListRow first icon="share-variant" iconColour={TOOLS.mot.colour} title="Share as text" disabled={!!step} onPress={share} />
        <ListRow icon="content-save-outline" iconColour={TOOLS.mot.colour} title="Save to History" value={draft.savedAt ? `Saved ${when(draft.savedAt)}` : undefined} disabled={!!step} onPress={save} />
        <ListRow icon="open-in-new" iconColour={TOOLS.mot.colour} title="Check MOT history on GOV.UK" subtitle="You type the registration there." onPress={() => Linking.openURL(MOT_HISTORY_URL)} />
        <ListRow icon="refresh" iconColour={TOOLS.mot.colour} title="Start again" onPress={() => setConfirmReset(true)} />
      </Group>

      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(MOT_MANUAL_URL)} style={{ paddingHorizontal: space.lg }}>
        <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>
          A guide from the DVSA MOT inspection manual for cars, read {MOT_MANUAL_READ}. The tester decides on the day. <Text style={{ color: t.accentText }}>Open the manual</Text>
        </Text>
      </Pressable>

      <ConfirmSheet
        visible={confirmReset}
        title="Start again?"
        lines={['Clears the walk-round answers and the car reading on this phone. Checks saved to History stay.']}
        confirmLabel="Start again"
        onConfirm={restart}
        onCancel={() => setConfirmReset(false)}
      />
    </Screen>
  );
}

// Red for a likely fail only; an advisory and a fault the MOT does not check
// are not urgent, so they stay grey (the Meaning Rule).
const OUTCOME: Record<Finding['outcome'], { label: string; tone: Tone; icon: 'alert-circle' | 'alert-outline' | 'information-outline'; colour: 'red' | 'grey' }> = {
  fail: { label: 'Likely fail', tone: 'danger', icon: 'alert-circle', colour: 'red' },
  advisory: { label: 'Advisory', tone: 'neutral', icon: 'alert-outline', colour: 'grey' },
  info: { label: 'Not an MOT item', tone: 'neutral', icon: 'information-outline', colour: 'grey' },
};

// A finding: the verdict as a pill beside the title, then one line of why.
// Tapping opens the rest: where it was found, the whole reason, the fix and
// the manual section; a fault code opens from there too.
function FindingRow({ f, first }: { f: Finding; first?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const o = OUTCOME[f.outcome];
  const verdict = `${o.label}${f.outcome === 'fail' && f.category && f.category !== 'not known' ? ` (${f.category})` : ''}`;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${f.title}. ${verdict}. ${f.why}. ${open ? 'Hide details' : 'Show the fix'}`}
        onPress={() => {
          tap();
          setOpen((x) => !x);
        }}
        style={({ pressed }) => [styles.finding, pressed && { backgroundColor: t.raised }]}
      >
        <View style={[styles.findingIcon, { backgroundColor: t[o.colour] }]}>
          <Icon name={o.icon} size={17} color="#FFFFFF" />
        </View>
        <View style={[styles.findingMain, { borderColor: t.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
          <View style={styles.findingTitle}>
            <Text style={[type.body, { color: t.text, flex: 1 }]}>{f.title}</Text>
            <Pill text={verdict} tone={o.tone} />
          </View>
          {open && f.code ? (
            <Text style={[type.small, { color: t.muted, marginTop: 2 }]}>
              <Text style={{ fontFamily: MONO, fontWeight: '700', color: t.text }}>{f.code}</Text>
              {f.module ? ` · ${f.module}` : ''}
            </Text>
          ) : null}
          <Text style={[type.sub, { color: t.muted, marginTop: 2 }]} numberOfLines={open ? undefined : 2}>
            {f.why}
          </Text>
          {open ? (
            <>
              <Text style={[type.sub, { color: t.text, marginTop: space.sm }]}>Fix: {f.fix}</Text>
              <Text style={[type.small, { color: t.muted, marginTop: space.xs }]}>MOT manual {f.section}</Text>
            </>
          ) : null}
          <Text style={[type.small, { color: t.accentText, fontWeight: '600', marginTop: space.xs }]}>{open ? 'Less' : 'Fix and details'}</Text>
        </View>
      </Pressable>
      {open && f.code ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/code/[code]', params: { code: f.code!, ...(f.module ? { module: f.module } : {}) } })}
          style={({ pressed }) => [styles.codeLink, { borderColor: t.border, backgroundColor: pressed ? t.raised : 'transparent' }]}
        >
          <Text style={[type.sub, { color: t.accentText }]}>What {f.code} means</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Green for a pass and red for a fail; an advisory and "to do" are not urgent, so they stay grey.
const STATES: { id: ItemState; label: string; tone?: 'ok' | 'danger' }[] = [
  { id: 'pass', label: 'Pass', tone: 'ok' },
  { id: 'advisory', label: 'Advisory' },
  { id: 'fail', label: 'Fail', tone: 'danger' },
  // Short enough for 4 segments on an iPhone; the walk-round's own word for it.
  { id: 'unchecked', label: 'To do' },
];

function WalkRow({ item, car, answer, first, onChange }: { item: WalkItem; car: MotCar; answer?: Answer; first: boolean; onChange: (a: Answer) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(answer?.note ?? '');
  const applies = itemApplies(item, car);
  const state = answer?.state ?? 'unchecked';
  return (
    <View style={[styles.item, { borderColor: t.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${open ? 'Hide details' : 'Show how to check and add a note'}`}
        onPress={() => {
          tap();
          setOpen((o) => !o);
        }}
      >
        {/* An item that does not apply to this car has a grey title; its explanation keeps full contrast. */}
        <Text style={[type.body, { color: applies === 'no' ? t.muted : t.text }]}>{item.title}</Text>
        <Text style={[type.small, { color: t.muted, marginTop: 2 }]}>Fail if: {failIfFor(item, car)}</Text>
        {applies === 'maybe' && item.notApplicable ? <Text style={[type.small, { color: t.muted, marginTop: 2 }]}>{item.notApplicable}</Text> : null}
        {open && item.how ? <Text style={[type.small, { color: t.text, marginTop: space.sm }]}>How: {item.how}</Text> : null}
        {/* The manual section, with the details: one tap away, not on every row. */}
        {open ? <Text style={[type.small, { color: t.muted, marginTop: 2 }]}>MOT manual {sectionFor(item, car)}</Text> : null}
      </Pressable>
      {applies === 'no' ? (
        <Text style={[type.small, { color: t.muted, marginTop: space.sm }]}>Not checked on this car. {item.notApplicable}</Text>
      ) : (
        // 44 pt tall: this screen is used standing by the car.
        <Segmented role="radio" label={item.title} options={STATES} value={state} onPick={(s) => onChange({ state: s, ...(note.trim() ? { note: note.trim() } : {}) })} style={{ marginTop: space.sm }} />
      )}
      {open && applies !== 'no' ? (
        <Field
          value={note}
          onChange={setNote}
          onBlur={() => onChange({ state, ...(note.trim() ? { note: note.trim() } : {}) })}
          placeholder="Note, for example front left, 1.8 mm"
          multiline
          minHeight={44}
          accessibilityLabel={`Note for ${item.title}`}
          style={{ marginTop: space.sm }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingVertical: space.xl, paddingHorizontal: space.xl, marginBottom: space.xl },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  big: { fontSize: 56, lineHeight: 62, fontWeight: '700', letterSpacing: -1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  item: { paddingHorizontal: space.lg, paddingVertical: space.md },
  finding: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: space.lg },
  findingIcon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: space.md, marginTop: 10 },
  findingMain: { flex: 1, paddingVertical: 10, paddingRight: space.lg, minHeight: 50 },
  findingTitle: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  codeLink: { borderTopWidth: StyleSheet.hairlineWidth, marginLeft: space.lg, minHeight: 44, justifyContent: 'center' },
});
