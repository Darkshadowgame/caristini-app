import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { ModuleDetails } from '../obd/elm';
import { modulesFor, ROUTE_LABEL } from '../obd/modules';
import { useConnection } from '../state';
import { MONO, space, type, useTheme } from '../theme';
import { Arrive, Button, Card, Group, Icon, ListRow, NeedsConnection, Notice, ScanPulse, Screen } from '../ui';
import { useGarage } from '../vehicle/garage';
import { SECTIONS } from '../help';
import { mergeModuleIds } from '../vehicle/ids';

export default function Modules() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);
  const [result, setResult] = useState<ModuleDetails[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  if (!conn.client || !conn.vehicle) {
    return (
      <Screen>
        <NeedsConnection what="part numbers" />
      </Screen>
    );
  }
  const vehicle = conn.vehicle;
  const defs = modulesFor(vehicle.group);

  const scan = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      setResult([]);
      const list = await conn.client!.scanModules(
        vehicle.group,
        (d, n) => {
          setProgress(n ? d / n : 0);
          setCurrent(defs[d]?.name ?? null);
        },
        (m) => setResult((old) => [...(old ?? []), m]),
      );
      setResult(list);
      const backup = list.filter((m) => m.coding).map((m) => ({ module: m.def.name, part: m.partNumber, coding: m.coding }));
      const ids = { ...(garage.latest(vehicle.vin)?.ids ?? {}), modules: mergeModuleIds(garage.latest(vehicle.vin)?.ids?.modules, list) };
      await garage.update(vehicle.vin, { ids, ...(backup.length ? { codingBackup: { date: new Date().toISOString(), modules: backup } } : {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const report = () =>
    [
      `${vehicle.brand} ${vehicle.model} · VIN ${vehicle.vin}`,
      `Read ${new Date().toLocaleString()}`,
      '',
      ...(result ?? [])
        .filter((m) => m.responded)
        .flatMap((m) => [
          `${m.def.code ? `${m.def.code} ` : ''}${m.def.name}`,
          m.systemName ? `  System: ${m.systemName}` : null,
          m.partNumber ? `  Part number: ${m.partNumber}` : null,
          m.software ? `  Software: ${m.software}` : null,
          m.hardware ? `  Hardware: ${m.hardware}` : null,
          m.coding ? `  Coding: ${m.coding}` : null,
          '',
        ])
        .filter((l): l is string => l != null),
    ].join('\n');

  const found = result?.filter((r) => r.responded) ?? [];
  const missing = result?.filter((r) => !r.responded) ?? [];

  return (
    <Screen>
      {conn.info && !conn.client.supportsModules ? (
        <Notice icon="information-outline" text="This car uses an older connection, so part numbers cannot be read." />
      ) : null}
      {error ? <Notice tone="danger" text={error} /> : null}

      <Card style={styles.hero}>
        {busy ? (
          <View style={{ alignItems: 'center' }}>
            <ScanPulse active size={120} />
            <Text style={[styles.pct, type.number, { color: t.text }]}>{Math.round(progress * 100)}%</Text>
            <Text style={[type.sub, { color: t.muted, textAlign: 'center' }]} numberOfLines={1}>
              {current ? `Reading ${current}…` : 'Finishing…'}
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.heroIcon, { backgroundColor: t.indigo }]}>
              <Icon name="chip" size={30} color="#FFFFFF" />
            </View>
            <Text style={[type.title3, { color: t.text, marginTop: space.md, textAlign: 'center' }]}>
              {result ? `${found.length} of ${result.length} modules answered` : `${defs.length} modules to read`}
            </Text>
            <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: space.xs }]}>
              Part number, software, hardware and coding. Read-only, and the coding is kept on this phone as a backup.
            </Text>
            <View style={{ alignSelf: 'stretch', marginTop: space.lg }}>
              <Button label={result ? 'Read again' : 'Read part numbers'} icon="chip" variant={result ? 'secondary' : 'primary'} onPress={scan} />
            </View>
          </View>
        )}
      </Card>

      {busy && found.length ? found.map((m) => (
        <Arrive key={m.def.id}>
          <ModuleGroup m={m} />
        </Arrive>
      )) : null}

      {!busy && result ? (
        <>
          {found.map((m, i) => (
            <Arrive key={m.def.id}>
              <ModuleGroup m={m} first={i === 0} />
            </Arrive>
          ))}
          {missing.length ? (
            <Group help={SECTIONS.diagNotFound} footer={showMissing ? 'Not fitted, or not reachable from this port.' : undefined}>
              {showMissing ? missing.map((m, i) => <ListRow key={m.def.id} first={i === 0} title={m.def.name} value="No answer" />) : null}
              <ListRow
                first={!showMissing}
                title={showMissing ? 'Hide' : `${missing.length} module${missing.length === 1 ? '' : 's'} not found`}
                onPress={() => setShowMissing((v) => !v)}
              />
            </Group>
          ) : null}
          {found.length ? (
            <View style={{ gap: space.sm }}>
              <Button
                label={copied ? 'Copied' : 'Copy all'}
                icon={copied ? 'check' : 'content-copy'}
                variant="secondary"
                onPress={async () => {
                  await Clipboard.setStringAsync(report());
                  setCopied(true);
                }}
              />
              <Button label="Share" icon="share-variant" variant="ghost" onPress={() => Share.share({ message: report() })} />
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function ModuleGroup({ m, first }: { m: ModuleDetails; first?: boolean }) {
  const [open, setOpen] = useState(false);
  const rows: [string, string | null][] = [
    ['System', m.systemName],
    ['Part number', m.partNumber],
    ['Software', m.software],
    ['Hardware', m.hardware],
    ['Serial', m.serial],
    ['Protocol', m.route ? ROUTE_LABEL[m.route] : null],
  ];
  return (
    <Group
      header={`${m.def.code ? `${m.def.code} · ` : ''}${m.def.name}`}
      help={first ? SECTIONS.partNumbersModule : undefined}
      footer={open ? `${m.route === 'tp20' ? 'VW TP2.0' : `CAN ${m.def.tx} / ${m.def.rx}`}. Source: ${m.def.source}.` : undefined}
    >
      {rows
        .filter(([, v]) => v)
        .map(([k, v], i) => (
          <ListRow key={k} first={i === 0} title={k} value={v!} />
        ))}
      {m.coding ? <CodingRow coding={m.coding} /> : null}
      <ListRow title={open ? 'Hide technical details' : 'Technical details'} onPress={() => setOpen((v) => !v)} />
    </Group>
  );
}

function CodingRow({ coding }: { coding: string }) {
  const t = useTheme();
  return (
    <View style={[styles.coding, { borderColor: t.border }]}>
      <Text style={[type.body, { color: t.text }]}>Coding</Text>
      <Text selectable style={[styles.codingValue, { color: t.muted }]}>
        {coding}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingVertical: space.xl, paddingHorizontal: space.xl, marginBottom: space.xl },
  heroIcon: { width: 60, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pct: { fontSize: 34, lineHeight: 41, fontWeight: '700', marginTop: space.sm },
  coding: { borderTopWidth: StyleSheet.hairlineWidth, marginLeft: space.lg, paddingRight: space.lg, paddingVertical: space.md },
  codingValue: { fontFamily: MONO, fontSize: 14, lineHeight: 20, letterSpacing: 0.5, marginTop: 2, fontVariant: ['tabular-nums'] },
});
