import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ModuleDef } from '../../obd/modules';
import { useConnection } from '../../state';
import { space, type, useTheme } from '../../theme';
import { Group, ListRow, NeedsConnection, Notice, Pill, Screen, SearchField } from '../../ui';
import { useLastScan } from '../../components/LastScan';
import { SECTIONS } from '../../help';

// Workshop: every control module by its address, one page per module, the way
// workshop tools lay it out.
export default function Workshop() {
  const t = useTheme();
  const conn = useConnection();
  const client = conn.client;
  const group = conn.vehicle?.group ?? 'other';
  const [defs, setDefs] = useState<ModuleDef[] | null>(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  // Modules that answered a health check come first, with their fault count.
  const seen = new Set(conn.vehicle?.modulesSeen ?? []);
  const last = useLastScan(conn.vehicle?.vin);
  const faultsOf = (d: ModuleDef) => (last?.faults ?? []).filter((f) => f.module === d.name).length;

  useEffect(() => {
    if (!client?.supportsModules || group === 'other') return;
    let alive = true;
    client.modulesForCar(group).then((d) => alive && setDefs(d));
    return () => {
      alive = false;
    };
  }, [client, group]);

  if (!client || !conn.vehicle) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to open the workshop" />
      </Screen>
    );
  }
  if (!client.supportsModules || group === 'other') {
    return (
      <Screen>
        <Notice icon="information-outline" text="Module access is set up for VW group, Ford and Mazda cars on CAN. Other cars get the standard engine tools." />
      </Screen>
    );
  }

  const q = query.trim().toLowerCase();
  const list = (defs ?? [])
    .filter((d) => !q || d.name.toLowerCase().includes(q) || (d.code ?? '').toLowerCase().includes(q) || d.tx.toLowerCase().includes(q))
    .sort((a, b) => (a.code ?? a.tx).localeCompare(b.code ?? b.tx));

  return (
    <Screen>
      <Text style={[type.sub, { color: t.muted, marginBottom: space.md }]}>
        Pick a control module to read its identity, fault codes, measuring values and coding. Modules that are not fitted do not answer.
      </Text>
      <View style={{ marginBottom: space.lg }}>
        <SearchField value={query} onChange={setQuery} placeholder="Address (17), name or CAN ID" />
      </View>
      {!defs ? (
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.lg }}>
          <ActivityIndicator color={t.muted} />
          <Text style={[type.sub, { color: t.muted }]}>Asking the car which modules it has…</Text>
        </View>
      ) : (
        <>
          {[
            { header: seen.size && !q ? 'On this car' : 'Select control module', rows: seen.size && !q ? list.filter((d) => seen.has(d.id)) : list },
            ...(seen.size && !q ? [{ header: 'Not found in the last health check', rows: showAll ? list.filter((d) => !seen.has(d.id)) : [] }] : []),
          ].map((g) =>
            g.header.startsWith('Not found') && !showAll ? (
              <Group key={g.header} help={SECTIONS.workshopNotFound} footer="Not fitted, asleep, or on the older VW protocol. Open one to try it.">
                <ListRow first icon="chevron-down" iconColour="grey" title={`Show ${list.filter((d) => !seen.has(d.id)).length} more modules`} onPress={() => setShowAll(true)} noChevron />
              </Group>
            ) : (
              <Group key={g.header} header={g.header} help={g.header.startsWith('Not found') ? SECTIONS.workshopNotFound : SECTIONS.workshopModules} footer={g.header === 'On this car' ? 'From your last health check. Addresses as workshop tools show them.' : undefined}>
                {g.rows.map((d, i) => {
                  const n = faultsOf(d);
                  return (
                    <ListRow
                      key={d.id}
                      first={i === 0}
                      title={`${d.code && group === 'vag' ? `${d.code} · ` : ''}${d.name}`}
                      subtitle={d.tx ? `CAN ${d.tx}` : 'Older VW protocol'}
                      right={n ? <Pill text={`${n} fault${n === 1 ? '' : 's'}`} tone="danger" /> : undefined}
                      onPress={() => router.push({ pathname: '/workshop/[id]', params: { id: d.id } })}
                    />
                  );
                })}
              </Group>
            ),
          )}
        </>
      )}
      {client.canListen ? (
        <Group header="Record another tool" help={SECTIONS.workshopListen} footer="With a Y-splitter, record what VCDS or another tool sends, to add its functions to Caristini.">
          <ListRow first icon="record-circle-outline" iconColour="red" title="Listen mode" onPress={() => router.push('/listen')} />
        </Group>
      ) : null}
    </Screen>
  );
}
