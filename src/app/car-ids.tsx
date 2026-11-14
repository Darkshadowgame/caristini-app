import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { researchParts } from '../ai/parts';
import { hasClaude } from '../ai/claude';
import { packFor } from '../data/cars';
import { SECTIONS } from '../help';
import { MONO, radius, space, type, useTheme } from '../theme';
import { Button, GlowCard, Group, Icon, IconName, ListRow, Notice, Pill, Screen, success, tap } from '../ui';
import { partsOf, useGarage, vehicleTitle } from '../vehicle/garage';
import { catalogueLinks, CODE_FIELDS, CodeKey, idsText, labelHint, ModuleId, PartItem } from '../vehicle/ids';
import { decodeVin, vagModelFromParts } from '../vehicle/vin';

// Parts and IDs: one car's identity numbers and codes, every module's part
// number, software and coding, and a parts list, all kept on the phone so
// parts can be bought without connecting to the car.
export default function CarIds() {
  const t = useTheme();
  const garage = useGarage();
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const v = garage.get(vin);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger' | 'info'; text: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [ai, setAi] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<CodeKey | 'notes', string>>>({});
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    hasClaude().then((x) => alive.current && setAi(x));
    return () => {
      alive.current = false;
    };
  }, []);

  if (!v) {
    return (
      <Screen>
        <Notice text="This car is not in Your cars. Connect to it once and it is saved." />
      </Screen>
    );
  }

  const decoded = decodeVin(v.vin);
  const ids = v.ids ?? {};
  // Earlier versions kept part numbers only in the coding backup.
  const modules: ModuleId[] =
    ids.modules ??
    (v.codingBackup?.modules ?? []).map((m) => ({ id: m.module, name: m.module, part: m.part, coding: m.coding, at: Date.parse(v.codingBackup!.date) }));
  const latest = modules.reduce((n, m) => Math.max(n, m.at), 0);
  const parts = v.partsList;
  const groups = [...new Set((parts?.items ?? []).map((p) => p.group))];
  const match = packFor(v.vin, v.year ?? decoded.year, ids.codes?.engineCode?.value, vagModelFromParts(partsOf(v))?.modelCode);
  const packParts = match?.sure ? match.pack.parts : [];
  const packGroups = [...new Set(packParts.map((p) => p.group))];

  const copy = async (text: string, what: string) => {
    tap();
    await Clipboard.setStringAsync(text);
    setMessage({ tone: 'ok', text: `${what} copied.` });
  };

  const saveCode = (key: CodeKey, value: string) => {
    const now = garage.latest(v.vin)?.ids ?? {};
    const codes = { ...(now.codes ?? {}) };
    if ((codes[key]?.value ?? '') === value.trim().toUpperCase()) return;
    if (value.trim()) codes[key] = { value: value.trim().toUpperCase().replace(/\s+/g, ' '), from: 'owner' };
    else delete codes[key];
    garage.update(v.vin, { ids: { ...now, codes } });
  };

  const findParts = async () => {
    setSearching(true);
    setMessage(null);
    try {
      const res = await researchParts(
        { title: vehicleTitle(v), year: v.year, fuel: v.fuel, vin: v.vin, platform: v.platform },
        { engineCode: ids.codes?.engineCode?.value, gearboxCode: ids.codes?.gearboxCode?.value, modules },
      );
      const latestIds = garage.latest(v.vin)?.ids ?? {};
      const codes = { ...(latestIds.codes ?? {}) };
      // AI codes fill gaps only; the owner's own entries always win.
      for (const [k, val] of Object.entries(res.codes) as [CodeKey, NonNullable<(typeof res.codes)[CodeKey]>][]) if (!codes[k]) codes[k] = val;
      await garage.update(v.vin, { partsList: { at: Date.now(), items: res.items, basis: res.basis }, ids: { ...latestIds, codes } });
      success();
      if (alive.current) setMessage({ tone: res.items.length ? 'ok' : 'info', text: res.items.length ? `${res.items.length} part numbers found, each with its source.` : 'No part numbers with a source were found. Try again after adding the engine code.' });
    } catch (e) {
      if (alive.current) setMessage({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (alive.current) setSearching(false);
    }
  };

  const moduleRow = (m: ModuleId, i: number) => {
    const shown = open === m.id;
    const lines = [
      m.part ? ['Part number', m.part] : null,
      m.hardware && m.hardware !== m.part ? ['Hardware', m.hardware] : null,
      m.software ? ['Software', m.software] : null,
      m.systemName ? ['System', m.systemName] : null,
      m.serial ? ['Serial', m.serial] : null,
      m.coding ? ['Coding', m.coding] : null,
    ].filter((x): x is string[] => !!x);
    return (
      <View key={m.id} style={{ borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: t.border }}>
        <ListRow
          first
          title={`${m.code ? `${m.code} · ` : ''}${m.name}`}
          subtitle={m.part ?? 'No part number read'}
          right={<Icon name={shown ? 'chevron-up' : 'chevron-down'} size={13} color={t.faint} />}
          noChevron
          onPress={() => setOpen(shown ? null : m.id)}
        />
        {shown ? (
          <View style={styles.detail}>
            {lines.map(([k, val]) => (
              <Pressable key={k} accessibilityRole="button" accessibilityLabel={`Copy ${k}`} onLongPress={() => copy(val, k)} style={styles.kv}>
                <Text style={[type.small, { color: t.muted, width: 92 }]}>{k}</Text>
                <Text selectable style={[type.small, { color: t.text, flex: 1, fontFamily: MONO }]}>
                  {val}
                </Text>
              </Pressable>
            ))}
            <Button label="Copy this module" icon="content-copy" variant="secondary" compact onPress={() => copy(lines.map(([k, val]) => `${k}: ${val}`).join('\n'), `${m.name} details`)} />
          </View>
        ) : null}
      </View>
    );
  };

  const partRow = (p: PartItem & { confidence?: 'High' | 'Medium' }, i: number) => (
    <View key={`${p.name}-${i}`} style={[styles.part, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
        <Text style={[type.body, { color: t.text, flex: 1 }]}>{p.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Copy ${p.name} part number`} onPress={() => copy(p.oem, `${p.name} part number`)} hitSlop={8}>
          <Text selectable style={[type.body, { color: t.accentText, fontFamily: MONO }]}>
            {p.oem}
          </Text>
        </Pressable>
      </View>
      {p.notes ? <Text style={[type.small, { color: t.muted }]}>{p.notes}</Text> : null}
      {p.confidence === 'Medium' ? <Pill text="One source" /> : null}
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(p.source.url)}>
        <Text style={[type.caption, { color: t.faint, textDecorationLine: 'underline' }]}>{p.source.label}</Text>
      </Pressable>
    </View>
  );

  return (
    <Screen>
      <GlowCard tone="brand" style={{ padding: space.lg, gap: space.sm }}>
        <Text style={[type.title3, { color: t.text }]}>{vehicleTitle(v)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Copy the VIN" onPress={() => copy(v.vin, 'VIN')}>
          <Text selectable style={[type.heading, { color: t.text, fontFamily: MONO, letterSpacing: 1 }]}>
            {v.vin}
          </Text>
          <Text style={[type.caption, { color: t.muted }]}>Tap to copy the VIN</Text>
        </Pressable>
        <Button label="Share all IDs" icon="share-variant" variant="secondary" onPress={() => Share.share({ message: idsText({ title: vehicleTitle(v), vin: v.vin }, { ...ids, modules }) })} />
      </GlowCard>

      {message ? <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : message.tone === 'info' ? 'information-outline' : 'alert-circle-outline'} text={message.text} /> : null}

      <Group header="From the VIN" help={SECTIONS.idsVin}>
        <ListRow first title="Make" value={decoded.brand ?? v.brand} noChevron />
        <ListRow title="Model" value={v.model || decoded.model || 'Unknown'} noChevron />
        {v.platform || decoded.platform ? <ListRow title="Platform" value={v.platform ?? decoded.platform ?? ''} noChevron /> : null}
        <ListRow title="Model year" value={v.year ? String(v.year) : decoded.year ? `${decoded.year}${decoded.yearReliable ? '' : ' (check)'}` : 'Not encoded'} noChevron />
        {v.fuel ? <ListRow title="Fuel" value={v.fuel} noChevron /> : null}
      </Group>

      <Group header="Codes from the data label" help={SECTIONS.idsCodes} footer={labelHint(v.group)}>
        {CODE_FIELDS.map((f, i) => {
          const val = ids.codes?.[f.key];
          return (
            <View key={f.key} style={[styles.field, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={[type.small, { color: t.muted, flex: 1 }]}>{f.label}</Text>
                {val?.from === 'ai' ? <Pill text="Found by AI, check" /> : null}
              </View>
              <TextInput
                value={drafts[f.key] ?? val?.value ?? ''}
                onChangeText={(x) => setDrafts((d) => ({ ...d, [f.key]: x }))}
                onEndEditing={(e) => saveCode(f.key, e.nativeEvent.text)}
                onBlur={() => drafts[f.key] != null && saveCode(f.key, drafts[f.key]!)}
                placeholder={f.hint}
                placeholderTextColor={t.faint}
                autoCapitalize={f.key === 'tyreSize' || f.key === 'batteryType' ? 'none' : 'characters'}
                autoCorrect={false}
                accessibilityLabel={f.label}
                style={[type.body, styles.input, { color: t.text, fontFamily: MONO }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
              />
              {val?.from === 'ai' && val.source ? (
                <Pressable accessibilityRole="link" onPress={() => Linking.openURL(val.source!.url)}>
                  <Text style={[type.caption, { color: t.faint, textDecorationLine: 'underline' }]}>{val.source.label}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </Group>

      {match ? (
        <Group
          header="Built-in for this car"
          help={SECTIONS.idsPack}
          footer={
            match.sure
              ? `Researched ${match.pack.researched} for: ${match.pack.basis}. Each number links to its page. Check it against a catalogue by VIN before ordering.`
              : `This VIN looks like a ${match.pack.title}. Type the engine code from the data label above to show the researched part numbers.`
          }
        >
          <ListRow
            first
            icon={'book-open-variant' as IconName}
            iconColour="teal"
            title="Car reference"
            subtitle="Known faults, fluids, service schedule, specs, recalls"
            onPress={() => router.push({ pathname: '/car-reference', params: { vin: v.vin } })}
          />
          {packGroups.map((g) => (
            <View key={g}>
              <Text style={[type.label, { color: t.muted, paddingHorizontal: space.lg, paddingTop: space.md }]}>{g.toUpperCase()}</Text>
              {packParts.filter((p) => p.group === g).map(partRow)}
            </View>
          ))}
        </Group>
      ) : null}

      <Group
        header={`Control modules${modules.length ? ` (${modules.length})` : ''}`}
        help={SECTIONS.idsModules}
        footer={modules.length ? `From your last reads, ${new Date(latest).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Tap a module for its part number, software and coding; press and hold a line to copy it.` : 'Connect, then open Read part numbers once: every module’s part number, software and coding is kept here.'}
      >
        {modules.length ? modules.map(moduleRow) : <ListRow first title="Nothing read yet" noChevron />}
        <ListRow icon="chip" iconColour="indigo" title="Read part numbers from the car" subtitle="Needs the adapter connected" onPress={() => router.push('/modules')} />
      </Group>

      <Group
        header="Service parts"
        help={SECTIONS.idsParts}
        footer={
          parts
            ? `Found by AI on ${new Date(parts.at).toLocaleDateString('en-GB')} for: ${parts.basis}. Each number links to its source. Check it against a catalogue by VIN before ordering.`
            : 'Caristini AI searches the web for the maker part numbers for this car, each with its source, and keeps them here.'
        }
      >
        {groups.map((g, gi) => (
          <View key={g}>
            <Text style={[type.label, { color: t.muted, paddingHorizontal: space.lg, paddingTop: gi ? space.md : space.sm }]}>{g.toUpperCase()}</Text>
            {parts!.items.filter((p) => p.group === g).map(partRow)}
          </View>
        ))}
        <ListRow
          first={!groups.length}
          icon="magnify"
          iconColour="purple"
          title={searching ? 'Searching the web…' : parts ? 'Search again' : 'Find service part numbers'}
          subtitle={ai ? 'About 1 to 2 minutes, needs the internet, not the car' : 'Needs a Claude API key (Settings > AI)'}
          disabled={searching || !ai}
          onPress={findParts}
        />
      </Group>

      <Group header="Parts diagrams by VIN" help={SECTIONS.idsCatalogues} footer="Opening a catalogue sends the VIN to that site. The VIN is copied first, ready to paste.">
        {catalogueLinks(v.vin).map((c, i) => (
          <ListRow
            key={c.label}
            first={i === 0}
            icon="open-in-new"
            iconColour="blue"
            title={c.label}
            subtitle={c.note}
            onPress={async () => {
              await Clipboard.setStringAsync(v.vin);
              Linking.openURL(c.url);
            }}
          />
        ))}
      </Group>

      <Group header="Notes" footer="Anything else you want to keep with this car: tyre pressures, key numbers, parts you have fitted.">
        <TextInput
          value={drafts.notes ?? ids.notes ?? ''}
          onChangeText={(x) => setDrafts((d) => ({ ...d, notes: x }))}
          onBlur={() => drafts.notes != null && garage.update(v.vin, { ids: { ...(garage.latest(v.vin)?.ids ?? {}), notes: drafts.notes } })}
          placeholder="Notes"
          placeholderTextColor={t.faint}
          multiline
          style={[type.body, styles.notes, { color: t.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
        />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  detail: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: 6 },
  kv: { flexDirection: 'row', gap: space.sm },
  part: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, gap: 2 },
  field: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: 2 },
  input: { paddingVertical: 6, borderRadius: radius.sm },
  notes: { minHeight: 90, padding: space.lg, textAlignVertical: 'top' },
});
