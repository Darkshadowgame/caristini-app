import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { codeAnatomy, DTC_LIBRARY, searchDtc } from '../../../data/dtcLibrary';
import { useConnection } from '../../../state';
import { MONO, radius, space, type, useTheme } from '../../../theme';
import { GUIDES } from '../../../help';
import { Body, Group, Icon, Label, ListRow, Screen, SearchField, tap } from '../../../ui';

const POPULAR = ['P0420', 'P0171', 'P0300', 'P0401', 'P2002', 'P0299', 'P0128', 'P0455'];

export default function Lookup() {
  const t = useTheme();
  const conn = useConnection();
  const [q, setQ] = useState('');
  const query = q.trim();
  const results = useMemo(() => (query ? searchDtc(query, 40) : []), [query]);
  const looksLikeCode = /^[PCBU][0-9A-F]{4}$/i.test(query);
  const exactMissing = looksLikeCode && !results.some((r) => r.code === query.toUpperCase());
  // The same code can sit in several modules; list it once.
  const recent = [...new Set(conn.vehicle?.lastCodes ?? [])];

  const open = (code: string) => {
    tap();
    router.push(`/code/${code.toUpperCase()}`);
  };

  return (
    <Screen title="Lookup" guide={GUIDES.lookup}>
      <SearchField value={q} onChange={setQ} placeholder="Code or keyword, like P0171 or DPF" />
      <Text style={[type.small, { color: t.muted, marginTop: space.sm, marginLeft: space.xs }]}>
        {DTC_LIBRARY.length} codes with likely causes and fixes, offline.
      </Text>

      {!query ? (
        <View style={{ marginTop: space.xl }}>
          {recent.length ? (
            <>
              <Label>On your car now</Label>
              <View style={styles.chips}>
                {recent.map((c) => (
                  <Chip key={c} code={c} onPress={() => open(c)} strong />
                ))}
              </View>
            </>
          ) : null}
          <Label style={{ marginTop: recent.length ? space.lg : 0 }}>Common codes</Label>
          <View style={styles.chips}>
            {POPULAR.map((c) => (
              <Chip key={c} code={c} onPress={() => open(c)} />
            ))}
          </View>
          <Group
            header="Reading a code"
            style={{ marginTop: space.xl }}
            footer="A 0 or 2 after the letter means a generic code, the same on every car. A 1 means the maker defines it."
          >
            <ListRow first icon="engine-outline" iconColour="red" title="P" value="Engine and gearbox" />
            <ListRow icon="steering" iconColour="blue" title="C" value="Chassis" />
            <ListRow icon="car-door" iconColour="green" title="B" value="Body" />
            <ListRow icon="chip" iconColour="indigo" title="U" value="Network" />
          </Group>
          <Group header="Fuses and manuals">
            <ListRow
              first
              icon="flash-outline"
              iconColour="orange"
              title={conn.vehicle ? 'Fuses for this car' : 'Fuse boxes'}
              onPress={() => router.push('/fuses')}
            />
          </Group>
        </View>
      ) : (
        <Group style={{ marginTop: space.lg }}>
          {exactMissing ? (
            <ListRow
              first
              icon="code-tags"
              iconColour="blue"
              title={query.toUpperCase()}
              subtitle={codeAnatomy(query) ? `${codeAnatomy(query)!.scope} · ${codeAnatomy(query)!.area}` : 'Not in the library: tap for what the letters mean'}
              onPress={() => open(query)}
            />
          ) : null}
          {results.map((r, i) => (
            <ListRow
              key={r.code}
              first={i === 0 && !exactMissing}
              icon={r.severity === 'high' ? 'alert-octagon-outline' : 'alert-circle-outline'}
              iconColour={r.severity === 'high' ? 'red' : r.severity === 'medium' ? 'orange' : 'grey'}
              title={r.code}
              subtitle={r.title}
              onPress={() => open(r.code)}
            />
          ))}
          {!results.length && !exactMissing ? (
            <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
              <Icon name="magnify-close" size={28} color={t.faint} />
              <Body muted style={{ marginTop: space.sm }}>
                No matches for "{query}".
              </Body>
            </View>
          ) : null}
        </Group>
      )}
    </Screen>
  );
}

function Chip({ code, onPress, strong }: { code: string; onPress: () => void; strong?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: strong ? t.dangerSoft : t.surface, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[type.sub, type.number, { color: strong ? t.danger : t.text, fontWeight: '600', fontFamily: MONO }]}>{code}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderRadius: radius.md, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
});
