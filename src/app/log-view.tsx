// Log viewer: one chart per value or all on one chart, a cursor that shows
// every value at a moment, lowest, highest and average, markers, and CSV share.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SECTIONS } from '../help';
import { toUserUnits, useSettings } from '../settings';
import { radius, space, type, useTheme } from '../theme';
import { Body, Button, Card, ConfirmSheet, GuideButton, Group, ListRow, Notice, Screen } from '../ui';
import { chartColours, ChartLine, LogChart } from '../logger/Charts';
import { DataLog, formatDuration, formatWhen, LogChannel, logRate, seriesOf, statsOf, toCsv, valueAt } from '../logger/format';
import { deleteLog, loadLog, shareCsv } from '../logger/store';

type View_ = 'each' | 'all';

const chartRange = (lo: number, hi: number) => (lo === hi ? { lo: lo - 1, hi: hi + 1 } : { lo, hi });

export default function LogView() {
  const t = useTheme();
  const { vin, id } = useLocalSearchParams<{ vin: string; id: string }>();
  const { settings } = useSettings();
  const [log, setLog] = useState<DataLog | null | undefined>(undefined);
  const [cursor, setCursor] = useState<number | null>(null);
  const [view, setView] = useState<View_>('each');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vin || !id) {
      setLog(null);
      return;
    }
    loadLog(String(vin), String(id)).then(setLog, () => setLog(null));
  }, [vin, id]);

  const colours = chartColours(t);
  const data = useMemo(() => {
    if (!log) return [];
    return log.channels.map((c, i) => {
      const series = seriesOf(log, i);
      const stats = statsOf(series, log.durationMs);
      const colour = colours[i % colours.length];
      // Built once per log, so dragging the cursor does not rebuild the charts.
      const line: ChartLine[] = stats ? [{ series, colour, ...chartRange(stats.min, stats.max) }] : [];
      return { c, series, stats, colour, line };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, t]);
  const combined = useMemo<ChartLine[]>(() => data.flatMap((d) => d.line), [data]);

  const header = <Stack.Screen options={{ title: log ? formatWhen(log.startedAt) : 'Log', headerRight: () => <GuideButton id="logger" /> }} />;
  if (log === undefined) {
    return (
      <Screen>
        {header}
        <Body muted>Opening the log…</Body>
      </Screen>
    );
  }
  if (log === null) {
    return (
      <Screen>
        {header}
        <Notice tone="danger" icon="alert-circle-outline" text="This log could not be opened. It may have been deleted." />
      </Screen>
    );
  }

  const fmt = (c: LogChannel, v: number | null) => {
    if (v == null) return '–';
    const u = toUserUnits(v, c.unit, settings);
    return `${u.value.toFixed(c.decimals)}${u.unit ? ` ${u.unit}` : ''}`;
  };
  const rate = logRate(log);
  const near = cursor != null ? log.markers.find((m) => Math.abs(m.t - cursor) < Math.max(250, log.durationMs / 200)) : undefined;

  return (
    <Screen>
      {header}
      <Card>
        <Text style={[type.heading, { color: t.text }]}>{log.car}</Text>
        <Text style={[type.sub, type.number, { color: t.muted, marginTop: 2 }]}>
          {[formatDuration(log.durationMs), `${log.rows.length.toLocaleString('en-GB')} reads`, `${rate.toFixed(1)} a second`, log.start === 'auto' ? 'auto-start' : null].filter(Boolean).join(', ')}
        </Text>
        {log.markers.length ? (
          <Text style={[type.small, { color: t.muted, marginTop: 2 }]}>
            {log.markers.length} marker{log.markers.length === 1 ? '' : 's'}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <Button
            label="Share CSV"
            icon="share-variant"
            variant="secondary"
            compact
            style={{ flex: 1 }}
            onPress={() => {
              setError(null);
              shareCsv(`Caristini log ${log.id}`, toCsv(log, (v, u) => toUserUnits(v, u, settings))).catch((e) => setError(`Could not share: ${e instanceof Error ? e.message : String(e)}`));
            }}
          />
          <Button label="Delete" icon="trash-can-outline" variant="danger" compact style={{ flex: 1 }} onPress={() => setConfirm(true)} />
        </View>
      </Card>
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}

      <View style={[styles.segment, { backgroundColor: t.sunken }]}>
        {(['each', 'all'] as View_[]).map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityState={{ selected: view === v }}
            onPress={() => setView(v)}
            style={[styles.segmentItem, view === v && { backgroundColor: t.surface }]}
          >
            <Text style={[type.sub, { color: t.text, fontWeight: view === v ? '600' : '400' }]}>{v === 'each' ? 'Each value' : 'All together'}</Text>
          </Pressable>
        ))}
      </View>

      <Group header={cursor == null ? 'Drag across a chart to read values' : `At ${(cursor / 1000).toFixed(2)} s${near ? `, marker ${near.n}` : ''}`} help={SECTIONS.logViewer}>
        {data.map((d, i) => (
          <ListRow
            key={d.c.key}
            first={i === 0}
            leading={<View style={[styles.dot, { backgroundColor: d.colour }]} />}
            title={d.c.label}
            value={cursor == null ? (d.stats ? fmt(d.c, d.series.v[d.series.v.length - 1]) : 'No reading') : fmt(d.c, valueAt(d.series, cursor))}
          />
        ))}
      </Group>

      {view === 'all' ? (
        <View style={{ marginBottom: space.xl }}>
          <LogChart
            lines={combined}
            durationMs={log.durationMs}
            height={220}
            markers={log.markers}
            cursor={cursor}
            onScrub={setCursor}
            accessibilityLabel={`Chart of ${combined.length} values together`}
          />
          <TimeAxis ms={log.durationMs} />
        </View>
      ) : (
        data.map((d) => (
          <View key={d.c.key} style={{ marginBottom: space.lg }}>
            <View style={styles.chartHead}>
              <View style={[styles.dot, { backgroundColor: d.colour }]} />
              <Text numberOfLines={1} style={[type.small, { color: t.text, fontWeight: '600', flex: 1 }]}>
                {d.c.label}
              </Text>
              {cursor != null ? <Text style={[type.small, type.number, { color: t.text }]}>{fmt(d.c, valueAt(d.series, cursor))}</Text> : null}
            </View>
            {d.stats ? (
              <LogChart
                lines={d.line}
                durationMs={log.durationMs}
                markers={log.markers}
                cursor={cursor}
                onScrub={setCursor}
                topLabel={fmt(d.c, d.stats.max)}
                bottomLabel={fmt(d.c, d.stats.min)}
                accessibilityLabel={`${d.c.label} chart, from ${fmt(d.c, d.stats.min)} to ${fmt(d.c, d.stats.max)}`}
              />
            ) : (
              <Body muted small>
                The car gave no reading for this value.
              </Body>
            )}
          </View>
        ))
      )}
      {view === 'each' && data.length ? <TimeAxis ms={log.durationMs} /> : null}

      <Group header="Lowest, highest and average" help={SECTIONS.logViewer} style={{ marginTop: space.lg }}>
        {data.map((d, i) => (
          <ListRow
            key={d.c.key}
            first={i === 0}
            title={d.c.label}
            subtitle={d.stats ? `${fmt(d.c, d.stats.min)} to ${fmt(d.c, d.stats.max)}, average ${fmt(d.c, d.stats.avg)}` : 'No reading'}
            value={d.stats ? `${d.stats.rate.toFixed(1)}/s` : undefined}
          />
        ))}
      </Group>

      {log.markers.length ? (
        <Group header="Markers" help={SECTIONS.logMarkers}>
          {log.markers.map((m, i) => (
            <ListRow key={m.n} first={i === 0} title={`Marker ${m.n}`} value={`${(m.t / 1000).toFixed(1)} s`} onPress={() => setCursor(m.t)} />
          ))}
        </Group>
      ) : null}

      <ConfirmSheet
        visible={confirm}
        title="Delete this log?"
        lines={[`${formatWhen(log.startedAt)}, ${formatDuration(log.durationMs)}. This cannot be undone.`]}
        confirmLabel="Delete log"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await deleteLog(log.vin, log.id).catch(() => undefined);
          router.back();
        }}
      />
    </Screen>
  );
}

function TimeAxis({ ms }: { ms: number }) {
  const t = useTheme();
  return (
    <View style={styles.axis}>
      <Text style={[type.caption, type.number, { color: t.muted }]}>0 s</Text>
      <Text style={[type.caption, type.number, { color: t.muted }]}>{formatDuration(ms)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: radius.sm + 1, padding: 2, marginBottom: space.lg },
  segmentItem: { flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm - 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: space.sm },
  chartHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xs, gap: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
});
