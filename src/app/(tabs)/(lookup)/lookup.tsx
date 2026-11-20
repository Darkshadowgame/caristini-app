import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { codeAnatomy, DTC_LIBRARY, searchDtc } from '../../../data/dtcLibrary';
import { vagFaultText } from '../../../data/vagFaults';
import { faultMeaning, sentenceCase } from '../../../diag/faults';
import { useConnection } from '../../../state';
import { space, type, useTheme } from '../../../theme';
import { GUIDES } from '../../../help';
import { Body, Chip, Group, Icon, Label, ListRow, Screen, SearchField, tap, tool } from '../../../ui';

const POPULAR = ['P0420', 'P0171', 'P0300', 'P0401', 'P2002', 'P0299', 'P0128', 'P0455'];

export default function Lookup() {
  const t = useTheme();
  const conn = useConnection();
  const [q, setQ] = useState('');
  const query = q.trim();
  const results = useMemo(() => (query ? searchDtc(query, 40) : []), [query]);
  const looksLikeCode = /^[PCBU][0-9A-F]{4}$/i.test(query);
  const exactMissing = looksLikeCode && !results.some((r) => r.code === query.toUpperCase());
  // VW group 5-digit fault numbers (16684, 00532), as older modules report them.
  const vwNumber = /^\d{3,5}$/.test(query) && vagFaultText(query) ? query.padStart(5, '0') : null;
  // The same code can sit in several modules; list it once.
  const recent = [...new Set(conn.vehicle?.lastCodes ?? [])];

  const open = (code: string) => {
    tap();
    router.push(`/code/${code.toUpperCase()}`);
  };

  return (
    <Screen title="Lookup" guide={GUIDES.lookup}>
      <SearchField value={q} onChange={setQ} placeholder="Code or keyword, like P0171 or DPF" />
      {/* At the 16 pt inset of the section headers below. */}
      <Text style={[type.small, type.number, { color: t.muted, marginTop: space.sm, marginHorizontal: space.lg }]}>
        {DTC_LIBRARY.length.toLocaleString('en-GB')} codes with likely causes and fixes, offline.
      </Text>

      {!query ? (
        <View style={{ marginTop: space.xl }}>
          {recent.length ? (
            <>
              <Label>On your car now</Label>
              <View style={styles.chips}>
                {/* Red only for a serious code, as in the health check's fault list. */}
                {recent.map((c) => (
                  <Chip key={c} label={c} mono tone={faultMeaning(c, { brand: conn.vehicle?.brand }).entry?.severity === 'high' ? 'danger' : undefined} onPress={() => open(c)} />
                ))}
              </View>
            </>
          ) : null}
          <Label style={{ marginTop: recent.length ? space.lg : 0 }}>Common codes</Label>
          <View style={styles.chips}>
            {POPULAR.map((c) => (
              <Chip key={c} label={c} mono onPress={() => open(c)} />
            ))}
          </View>
          <Group
            header="Reading a code"
            style={{ marginTop: space.xl }}
            footer="A 0 or 2 after the letter means a generic code, the same on every car. A 1 means the maker defines it."
          >
            {/* Grey squares: these are facts about a code, not tools or states. */}
            <ListRow first icon="engine-outline" iconColour="grey" title="P" monoTitle value="Engine, gearbox" />
            <ListRow icon="steering" iconColour="grey" title="C" monoTitle value="Chassis" />
            <ListRow icon="car-door" iconColour="grey" title="B" monoTitle value="Body" />
            <ListRow icon="chip" iconColour="grey" title="U" monoTitle value="Network" />
          </Group>
          <Group>
            <ListRow
              first
              {...tool('fuses')}
              title="Fuses and manuals"
              subtitle={conn.vehicle ? 'For this car' : undefined}
              onPress={() => router.push('/fuses')}
            />
          </Group>
        </View>
      ) : (
        <Group style={{ marginTop: space.lg }}>
          {vwNumber ? (
            <ListRow
              first
              icon="alert-circle-outline"
              iconColour="grey"
              title={vwNumber}
              monoTitle
              subtitle={`VW fault number · ${sentenceCase(vagFaultText(vwNumber) ?? '')}`}
              onPress={() => open(vwNumber)}
            />
          ) : null}
          {exactMissing ? (
            <ListRow
              first={!vwNumber}
              icon="code-tags"
              iconColour="blue"
              title={query.toUpperCase()}
              monoTitle
              subtitle={codeAnatomy(query) ? `${codeAnatomy(query)!.scope} · ${codeAnatomy(query)!.area}` : 'Not in the library: tap for what the letters mean'}
              onPress={() => open(query)}
            />
          ) : null}
          {results.map((r, i) => (
            <ListRow
              key={r.code}
              first={i === 0 && !exactMissing && !vwNumber}
              icon={r.severity === 'high' ? 'alert-octagon-outline' : 'alert-circle-outline'}
              iconColour={r.severity === 'high' ? 'red' : 'grey'}
              title={r.code}
              monoTitle
              subtitle={sentenceCase(r.title)}
              onPress={() => open(r.code)}
            />
          ))}
          {!results.length && !exactMissing && !vwNumber ? (
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

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
