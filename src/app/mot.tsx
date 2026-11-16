// MOT check: the car's warning lamps and faults, a guided walk-round and a
// result of likely fails and advisories. Rules and sources: src/mot/rules.ts
// and replica/mot-rules-sources.md. Read-only on the car.
import { router, Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Mascot } from '../brand/Mascot';
import { useLastScan, when } from '../components/LastScan';
import { SECTIONS } from '../help';
import { addHistory } from '../history';
import { fromHealthCheck, readCarForMot, recentHealthCheck } from '../mot/read';
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
import { radius, space, type, useTheme } from '../theme';
import { Button, ConfirmSheet, GlowCard, GuideButton, Group, ListRow, Notice, Pill, Screen, success, tap, Tone } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';

const fresh = (vin: string): MotDraft => ({ vin, startedAt: Date.now(), answers: {}, read: null });

export default function MotCheck() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  // The connected car, or with no adapter the car used last.
  const vin = conn.vehicle?.vin ?? garage.vehicles[0]?.vin;
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
  // A recent complete health check is used by itself, once per visit.
  const autoUsed = useRef(false);

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
    if (autoUsed.current || !v || !draft || draft.read || !recent || step) return;
    autoUsed.current = true;
    void applyRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, recent?.id]);

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
      if (alive.current) setError(`Reading stopped: ${e instanceof Error ? e.message : String(e)}. Ignition on, then try again.`);
    } finally {
      if (alive.current) setStep(null);
    }
  };

  // The health check's module faults, with the engine light and battery read again when connected.
  const applyRecent = async () => {
    if (!recent) return;
    setError(null);
    setStep('the engine light');
    try {
      const status = connected ? await conn.client!.readStatus().catch(() => null) : null;
      const volts = connected ? await conn.client!.batteryVoltage().catch(() => null) : null;
      const milOn = status ? status.milOn : connected ? (conn.info?.milOn ?? null) : v.lastMilOn;
      const monitors = status ? status.monitors : connected ? (conn.info?.monitors ?? []) : [];
      if (!alive.current) return;
      update({ read: fromHealthCheck(recent, group, { milOn, volts, monitorsIncomplete: monitors.length ? monitors.filter((m) => m.state === 'incomplete').length : null }, v.modulesSeen) });
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
          <View style={styles.loadingRow}>
            <ActivityIndicator color={t.muted} />
            <Text style={[type.sub, { color: t.muted, flex: 1 }]} numberOfLines={2}>
              Reading {step}…
            </Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => (stop.current = true)}>
              <Text style={[type.sub, { color: t.accentText, fontWeight: '600' }]}>Stop</Text>
            </Pressable>
          </View>
        ) : read ? (
          <>
            <ListRow
              first
              icon="engine-outline"
              iconColour={read.milOn ? 'red' : read.milOn === false ? 'green' : 'grey'}
              title="Engine warning light"
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
            {connected ? <ListRow icon="refresh" iconColour="blue" title="Read the car again" onPress={readNow} /> : null}
          </>
        ) : (
          <>
            {recent ? (
              <ListRow
                first
                icon="heart-pulse"
                iconColour="blue"
                title={`Use the health check from ${when(recent.at)}`}
                subtitle={`${recent.faults?.length ?? 0} fault${recent.faults?.length === 1 ? '' : 's'}. Saves reading the modules again.${connected ? ' The engine light is read again.' : ''}`}
                onPress={applyRecent}
              />
            ) : null}
            {connected ? (
              <ListRow
                first={!recent}
                icon="car-search-outline"
                iconColour="green"
                title="Read the car now"
                subtitle="Engine light, engine codes and the modules whose warning lamps the MOT checks."
                onPress={readNow}
              />
            ) : (
              <ListRow
                first={!recent}
                icon="bluetooth"
                iconColour="blue"
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

      <Group>
        <ListRow first icon="share-variant" iconColour="blue" title="Share as text" onPress={share} />
        <ListRow icon="content-save-outline" iconColour="green" title="Save to History" value={draft.savedAt ? `Saved ${when(draft.savedAt)}` : undefined} onPress={save} />
        <ListRow icon="open-in-new" iconColour="indigo" title="Check MOT history on GOV.UK" subtitle="You type the registration there." onPress={() => Linking.openURL(MOT_HISTORY_URL)} />
        <ListRow icon="refresh" iconColour="red" title="Start again" onPress={() => setConfirmReset(true)} />
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

const OUTCOME: Record<Finding['outcome'], { label: string; tone: Tone; icon: 'alert-circle' | 'alert-outline' | 'information-outline'; colour: 'red' | 'orange' | 'grey' }> = {
  fail: { label: 'Likely fail', tone: 'danger', icon: 'alert-circle', colour: 'red' },
  advisory: { label: 'Advisory', tone: 'accent', icon: 'alert-outline', colour: 'orange' },
  info: { label: 'Not an MOT item', tone: 'neutral', icon: 'information-outline', colour: 'grey' },
};

// A finding: what, why and the fix. The manual section is one tap away, as
// on the walk-round items; a fault code opens from there too.
function FindingRow({ f, first }: { f: Finding; first?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const o = OUTCOME[f.outcome];
  const where = f.code ? `${f.code}${f.module ? ` · ${f.module}` : ''}
` : '';
  return (
    <View>
      <ListRow
        first={first}
        icon={o.icon}
        iconColour={o.colour}
        title={f.title}
        subtitle={`${where}${o.label}${f.outcome === 'fail' && f.category && f.category !== 'not known' ? ` (${f.category})` : ''}. ${f.why}
Fix: ${f.fix}${open ? `
MOT manual ${f.section}` : ''}`}
        right={<Text style={[type.small, { color: t.accentText }]}>{open ? 'Less' : 'More'}</Text>}
        onPress={() => setOpen((x) => !x)}
      />
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

const STATES: { state: ItemState; label: string; tone: Tone }[] = [
  { state: 'pass', label: 'Pass', tone: 'ok' },
  { state: 'advisory', label: 'Advisory', tone: 'accent' },
  { state: 'fail', label: 'Fail', tone: 'danger' },
  // Short enough for 4 buttons on an iPhone; the walk-round's own word for it.
  { state: 'unchecked', label: 'To do', tone: 'neutral' },
];

function WalkRow({ item, car, answer, first, onChange }: { item: WalkItem; car: MotCar; answer?: Answer; first: boolean; onChange: (a: Answer) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(answer?.note ?? '');
  const applies = itemApplies(item, car);
  const state = answer?.state ?? 'unchecked';
  const colour = (tone: Tone) => (tone === 'ok' ? { bg: t.okSoft, fg: t.ok } : tone === 'danger' ? { bg: t.dangerSoft, fg: t.danger } : tone === 'accent' ? { bg: t.accentSoft, fg: t.accentText } : { bg: t.sunken, fg: t.muted });
  return (
    <View style={[styles.item, { borderColor: t.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, opacity: applies === 'no' ? 0.5 : 1 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${open ? 'Hide details' : 'Show how to check and add a note'}`}
        onPress={() => {
          tap();
          setOpen((o) => !o);
        }}
      >
        <Text style={[type.body, { color: t.text }]}>{item.title}</Text>
        <Text style={[type.small, { color: t.muted, marginTop: 2 }]}>Fail if: {failIfFor(item, car)}</Text>
        {applies === 'maybe' && item.notApplicable ? <Text style={[type.caption, { color: t.faint, marginTop: 2 }]}>{item.notApplicable}</Text> : null}
        {open && item.how ? <Text style={[type.small, { color: t.text, marginTop: space.sm }]}>How: {item.how}</Text> : null}
        {/* The manual section, with the details: one tap away, not on every row. */}
        {open ? <Text style={[type.caption, { color: t.faint, marginTop: 2 }]}>MOT manual {sectionFor(item, car)}</Text> : null}
      </Pressable>
      {applies === 'no' ? (
        <Text style={[type.small, { color: t.muted, marginTop: space.sm }]}>Not checked on this car. {item.notApplicable}</Text>
      ) : (
        <View style={styles.segments} accessibilityRole="radiogroup">
          {STATES.map((o) => {
            const on = state === o.state;
            const c = colour(o.tone);
            return (
              <Pressable
                key={o.state}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${item.title}: ${o.label}`}
                onPress={() => {
                  tap();
                  onChange({ state: o.state, ...(note.trim() ? { note: note.trim() } : {}) });
                }}
                style={[styles.segment, { backgroundColor: on ? c.bg : 'transparent', borderColor: on ? c.fg : t.border }]}
              >
                <Text style={[type.small, { color: on ? c.fg : t.muted, fontWeight: on ? '700' : '500' }]} numberOfLines={1}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {open && applies !== 'no' ? (
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={() => onChange({ state, ...(note.trim() ? { note: note.trim() } : {}) })}
          placeholder="Note, for example front left, 1.8 mm"
          placeholderTextColor={t.faint}
          multiline
          accessibilityLabel={`Note for ${item.title}`}
          style={[type.sub, styles.note, { color: t.text, backgroundColor: t.sunken }]}
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
  segments: { flexDirection: 'row', gap: 6, marginTop: space.sm },
  segment: { flex: 1, minHeight: 36, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  note: { marginTop: space.sm, borderRadius: radius.sm, padding: space.sm, minHeight: 44 },
  codeLink: { borderTopWidth: StyleSheet.hairlineWidth, marginLeft: space.lg, minHeight: 44, justifyContent: 'center' },
});
