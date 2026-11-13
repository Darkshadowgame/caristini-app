import { router, Stack, useLocalSearchParams } from 'expo-router';
import { askClaude, hasClaude } from '../../ai/claude';
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { codeAnatomy, genericAdvice, lookupDtc } from '../../data/dtcLibrary';
import { vagFaultText } from '../../data/vagFaults';
import { describeFailureType, isMakerNumbered } from '../../obd/uds';
import { useConnection } from '../../state';
import { MONO, radius, space, type, useTheme } from '../../theme';
import { SECTIONS } from '../../help';
import { Button, Card, Group, Icon, IconName, ListRow, Notice, Pill, Screen, Tone } from '../../ui';

// Severity is about urgency, so "minor" stays neutral rather than green.
const SEVERITY: Record<string, { text: string; tone: Tone }> = {
  high: { text: 'Serious', tone: 'danger' },
  medium: { text: 'Moderate', tone: 'accent' },
  low: { text: 'Minor', tone: 'neutral' },
};

export default function CodeDetail() {
  const t = useTheme();
  const conn = useConnection();
  const { code: raw, module, moduleId, state } = useLocalSearchParams<{ code: string; module?: string; moduleId?: string; state?: string }>();
  const code = String(raw ?? '').toUpperCase();
  // Module scans give 7 characters: the code plus a failure type byte (U111300).
  const base = /^[PCBU][0-9A-F]{4}[0-9A-F]{2}$/.test(code) ? code.slice(0, 5) : code;
  const failure = base !== code ? parseInt(code.slice(5), 16) : null;
  const failureText = failure ? describeFailureType(failure) : null;
  const entry = lookupDtc(base);
  const anatomy = codeAnatomy(base);
  const advice = entry ? { causes: entry.causes, fixes: entry.fixes } : genericAdvice(base);
  const group = conn.vehicle?.group;
  const makeNote = entry?.makes && group && group !== 'other' ? entry.makes[group] : undefined;
  const brand = conn.vehicle?.brand;
  const serious = entry?.severity === 'high';
  // Older VW modules (KWP2000) give a 5-digit decimal fault number.
  const vwNumber = /^\d{5}$/.test(code);
  const makerNumbered = isMakerNumbered(code) || vwNumber;
  const vag = group === 'vag';
  const wiki = () => Linking.openURL(`https://wiki.ross-tech.com/wiki/index.php?search=${encodeURIComponent(vwNumber ? code : isMakerNumbered(code) ? String(parseInt(code, 16)) : base)}`);
  const def = moduleId && conn.client ? conn.client.moduleById(String(moduleId)) : undefined;
  const [details, setDetails] = useState<{ extended: string | null; snapshot: string | null } | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const readDetails = async () => {
    if (!def || !conn.client) return;
    setDetailBusy(true);
    setDetailError(null);
    try {
      setDetails(await conn.client.readFaultDetails(def, code));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailBusy(false);
    }
  };
  const detailBlock = def ? (
    <Group header="Extra data for a workshop" help={SECTIONS.codeDetails} footer="Data the module saved with this fault. A workshop tool can read it.">
      {details ? (
        <>
          <ListRow first title="Extended data" subtitle={details.extended ? spaced(details.extended) : 'None stored'} noChevron />
          <ListRow title="Snapshot" subtitle={details.snapshot ? spaced(details.snapshot) : 'None stored'} noChevron />
        </>
      ) : null}
      {detailError ? <ListRow first={!details} title="Could not read" subtitle={detailError} noChevron /> : null}
      <ListRow first={!details && !detailError} icon="database-search-outline" iconColour="blue" title={detailBusy ? 'Reading…' : 'Read details'} disabled={detailBusy} onPress={readDetails} />
    </Group>
  ) : null;
  const aiBlock = <AiExplain code={code} module={module ? String(module) : undefined} title={entry?.title} />;
  const wikiButton = vag ? <Button label="Search the Ross-Tech wiki" icon="open-in-new" variant="ghost" onPress={wiki} /> : null;
  const model = conn.vehicle?.model;
  const search = () =>
    Linking.openURL(
      `https://www.google.com/search?q=${encodeURIComponent(
        (makerNumbered ? `${brand ?? ''} ${model ?? ''} ${module ?? ''} fault ${parseInt(code, 16)} ${code}` : `"${code}" ${brand ?? ''} ${model ?? ''} fault code`).replace(/\s+/g, ' ').trim(),
      )}`,
    );

  if (makerNumbered) {
    return (
      <Screen>
        <Stack.Screen options={{ title: code }} />
        <Card style={{ padding: space.xl }}>
          <Text style={[type.title, { color: t.text }]}>{vwNumber ? (vagFaultText(code) ?? `${brand ?? 'VW'} fault ${code}`) : `${brand ?? 'Maker'} fault number ${parseInt(code, 16)}`}</Text>
          {vwNumber && vagFaultText(code) ? <Text style={[type.sub, { color: t.muted, marginTop: 4 }]}>VW fault number {code}</Text> : null}
          <Text style={[type.sub, { color: t.muted, marginTop: space.sm }]}>
            {vwNumber && vagFaultText(code)
              ? "The meaning comes from public VW fault number lists; the module's own wording may differ slightly. Tap Explain this fault below for causes and whether it is safe to drive."
              : "This module reports faults in the maker's own numbering, not as a standard code, so Caristini has no description for it. A dealer or specialist tool shows the text. Tap Explain this fault for a best guess."}
          </Text>
        </Card>
        <Group header="Where it was found" help={SECTIONS.codeWhere}>
          {module ? <ListRow first title="Control module" value={String(module)} /> : null}
          {state ? <ListRow first={!module} title="Status" value={String(state)} /> : null}
          <ListRow first={!module && !state} title="Raw code" value={code} mono />
        </Group>
        {aiBlock}
      {detailBlock}
        <View style={{ gap: space.sm }}>
          <Button label="Search the web for this code" icon="open-in-new" variant="secondary" onPress={search} />
          {wikiButton}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: code }} />
      <Card style={{ padding: space.xl }}>
        <Text style={[type.title, { color: t.text }]}>
          {entry?.title ?? (anatomy ? `${anatomy.scope} ${anatomy.system.toLowerCase()} code` : 'Not a valid fault code')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
          {entry ? <Pill text={SEVERITY[entry.severity].text} tone={SEVERITY[entry.severity].tone} /> : null}
          {anatomy ? <Pill text={anatomy.scope} /> : null}
          {entry?.system ? <Pill text={entry.system} /> : null}
        </View>
        {entry ? (
          <View style={[styles.drive, { backgroundColor: serious ? t.dangerSoft : t.sunken }]}>
            <Icon name="steering" size={18} color={serious ? t.danger : t.muted} />
            <Text style={[type.sub, { flex: 1, color: serious ? t.danger : t.text }]}>{entry.drive}</Text>
          </View>
        ) : null}
      </Card>

      {!anatomy ? <Notice tone="danger" text="Codes look like a letter (P, C, B or U) followed by 4 characters, for example P0171." /> : null}

      {module || state || failureText ? (
        <Group header="Where it was found" help={SECTIONS.codeWhere}>
          {module ? <ListRow first title="Control module" value={String(module)} /> : null}
          {state ? <ListRow first={!module} title="Status" value={String(state)} /> : null}
          {failureText ? <ListRow first={!module && !state} title="Failure type" value={failureText} /> : null}
        </Group>
      ) : null}

      {entry ? (
        <Group header="What it means">
          <Text style={[type.body, styles.para, { color: t.text }]}>{entry.meaning}</Text>
        </Group>
      ) : anatomy ? (
        <Group header="What it means">
          <Text style={[type.body, styles.para, { color: t.text }]}>
            {anatomy.scope === 'Manufacturer-specific'
              ? `A code set by the car maker. The exact meaning depends on the make${brand ? ` (${brand})` : ''}.`
              : 'This generic code is not in the built-in library yet.'}{' '}
            It sits in the {anatomy.area.toLowerCase()} area of the {anatomy.system.toLowerCase()} system.
          </Text>
        </Group>
      ) : null}

      {makeNote ? <Notice tone="info" icon="car-info" text={`${brand ?? 'This make'}: ${makeNote}`} /> : null}

      {advice ? (
        <Group header="Most likely causes">
          {advice.causes.map((c, i) => (
            <NumberedRow key={c} n={i + 1} text={c} first={i === 0} />
          ))}
        </Group>
      ) : null}

      {advice ? (
        <Group header="How to fix it" footer="Work through these in order: cheapest and most likely first.">
          {advice.fixes.map((f, i) => (
            <NumberedRow key={f} n={i + 1} text={f} first={i === 0} />
          ))}
        </Group>
      ) : null}

      {aiBlock}

      <Group header="Next steps">
        <ListRow
          first
          icon={'creation' as IconName}
          iconColour="purple"
          title="Ask Caristini AI about this fault"
          onPress={() => router.push({ pathname: '/ask', params: { q: `Tell me about fault ${code}${module ? ` in the ${String(module)}` : ''} on my car: likely cause, whether it is safe to drive, and what to check first` } })}
        />
        {def ? <ListRow icon="wrench-outline" iconColour="orange" title={`Open ${def.name} in Workshop`} onPress={() => router.push({ pathname: '/workshop/[id]', params: { id: def.id } })} /> : null}
      </Group>

      {anatomy ? (
        <Group header="Reading the code" help={SECTIONS.codeReading}>
          <ListRow first title="Code" value={code} />
          <ListRow title="System" value={anatomy.system} />
          <ListRow title="Type" value={anatomy.scope} />
          <ListRow title="Area" value={anatomy.area} />
        </Group>
      ) : null}

      {detailBlock}

      {anatomy ? (
        <View style={{ gap: space.sm }}>
          <Button label="Search the web for this code" icon="open-in-new" variant="secondary" onPress={search} />
          {wikiButton}
        </View>
      ) : null}

      <Text style={[type.small, { color: t.muted, marginTop: space.lg, marginHorizontal: space.lg }]}>
        General guidance for owners, not a substitute for a garage diagnosis. If the light is flashing or the car runs badly, stop and get it checked.
      </Text>
    </Screen>
  );
}

// Plain-words explanation from Claude, for this car: meaning, causes, whether
// it is safe to drive, urgency, next steps and a rough UK cost.
const cache = new Map<string, string>();
function AiExplain({ code, module, title }: { code: string; module?: string; title?: string }) {
  const t = useTheme();
  const conn = useConnection();
  const v = conn.vehicle;
  const key = `${v?.vin ?? ''}|${module ?? ''}|${code}`;
  const [ready, setReady] = useState<boolean | null>(null);
  const [text, setText] = useState<string | null>(cache.get(key) ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    hasClaude().then(setReady);
  }, []);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const car = v ? `${v.brand} ${v.model}${v.year ? ` ${v.year}` : ''}${v.fuel ? ` ${v.fuel}` : ''}${v.platform ? ` (${v.platform})` : ''}` : 'a car';
      const answer = await askClaude(
        `Fault ${code}${title ? ` (${title})` : ''}${module ? ` from the ${module} module` : ''} on ${car}. Explain for the owner in these short sections, each a heading line then 1 to 3 sentences: What it means; Most likely causes (most likely first); Can I keep driving?; How urgent; What to check first; Rough UK cost (a range, say it is an estimate). If the code is a maker-specific number you cannot identify, say so plainly.`,
        { effort: 'low', maxTokens: 1200 },
      );
      cache.set(key, answer);
      setText(answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  if (ready === null) return null;
  return (
    <Group header="Explained by AI" help={SECTIONS.codeAi} footer={text ? 'Written by AI for your car. A guide, not a diagnosis.' : undefined}>
      {text ? (
        <View style={{ padding: space.lg }}>
          <Text selectable style={[type.body, { color: t.text }]}>
            {text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '')}
          </Text>
        </View>
      ) : null}
      {error ? <ListRow first={!text} title="Could not explain" subtitle={error} noChevron /> : null}
      {!text ? (
        ready ? (
          <ListRow first={!error} icon="creation" iconColour="purple" title={busy ? 'Thinking…' : 'Explain this fault'} subtitle="Meaning, causes, safe to drive, cost" disabled={busy} onPress={run} />
        ) : (
          <ListRow first={!error} icon="creation" iconColour="grey" title="Explain this fault" subtitle="Needs a Claude key in Settings" onPress={() => router.push('/settings')} />
        )
      ) : null}
    </Group>
  );
}

const spaced = (hex: string) => (hex.match(/../g) ?? []).join(' ');

function NumberedRow({ n, text, first }: { n: number; text: string; first: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.numbered, { borderColor: t.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={[styles.num, { backgroundColor: t.sunken }]}>
        <Text style={[type.small, type.number, { color: t.text, fontWeight: '600' }]}>{n}</Text>
      </View>
      <Text style={[type.body, { color: t.text, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  drive: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', borderRadius: radius.md, padding: space.md, marginTop: space.lg },
  para: { paddingHorizontal: space.lg, paddingVertical: space.md },
  numbered: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingVertical: space.md, paddingRight: space.lg, marginLeft: space.lg },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  code: { fontFamily: MONO },
});
