import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { putBackState, timelineCsv, timelineRows, timelineText, TimelineRow } from '../../diag/timeline';
import { SECTIONS } from '../../help';
import { loadHistory, onHistory } from '../../history';
import { useSettings } from '../../settings';
import { useConnection } from '../../state';
import { MONO, space, type, useTheme } from '../../theme';
import { Button, Group, GuideButton, HelpButton, Icon, Notice, Pill, Screen, success } from '../../ui';
import { useGarage, vehicleTitle } from '../../vehicle/garage';
import { clockText, dateText, shareFileName } from '../../timeText';

// Every setting change Pin16 wrote to a car, newest first, one line per
// module, with the backup each came from. Shared as text or CSV. The bytes
// sit behind Technical; Put back opens Customise's own restore and its
// confirmation, so nothing is written from this page.
export default function ChangeTimeline() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ vin?: string }>();
  const vin = params.vin ?? conn.vehicle?.vin ?? garage.vehicles[0]?.vin;
  const v = garage.get(vin);
  const [rows, setRows] = useState<TimelineRow[] | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState<'text' | 'csv' | null>(null);
  // The entry whose Technical details are open.
  const [tech, setTech] = useState<string | null>(null);

  useEffect(() => {
    if (!vin) return;
    const load = () => loadHistory(vin).then((l) => setRows(timelineRows(l)));
    load();
    return onHistory(load);
  }, [vin]);

  const share = async (kind: 'text' | 'csv') => {
    if (!rows || !v) return;
    setBusy(kind);
    setMessage(null);
    // The odometer in the owner's unit, as on the screen.
    const units = { miles: settings.speed === 'mph' };
    const body = kind === 'csv' ? timelineCsv(rows, units) : timelineText(rows, `${vehicleTitle(v)}, VIN ${v.vin}`, units);
    try {
      if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
        await Clipboard.setStringAsync(body);
        setMessage({ tone: 'ok', text: 'Sharing is not available here, so the list was copied. Paste it where you need it.' });
        return;
      }
      const f = new File(Paths.cache, `${shareFileName('changes', v.vin)}.${kind === 'csv' ? 'csv' : 'txt'}`);
      if (f.exists) f.delete();
      f.create();
      await f.write(body);
      await Sharing.shareAsync(f.uri, {
        mimeType: kind === 'csv' ? 'text/csv' : 'text/plain',
        UTI: kind === 'csv' ? 'public.comma-separated-values-text' : 'public.plain-text',
        dialogTitle: 'Change timeline',
      });
      success();
    } catch (e) {
      setMessage({ tone: 'danger', text: `Could not share: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  };

  if (!vin || !v) {
    return (
      <Screen>
      <Stack.Screen options={{ title: 'Change timeline', headerRight: () => <GuideButton id="diagChanges" /> }} />
        <Notice icon="information-outline" text="No car yet. Connect once and every setting change is kept here." />
      </Screen>
    );
  }

  const connected = conn.vehicle?.vin === v.vin && !!conn.client;
  const putBack = (r: TimelineRow) => {
    if (!r.key) return;
    if (!connected) {
      setMessage({ tone: 'danger', text: 'Connect your car with the ignition on, then tap Put back again.' });
      return;
    }
    router.push({ pathname: '/customise', params: { restore: r.key } });
  };
  const km = (n?: number) => (n == null ? null : settings.speed === 'mph' ? `${Math.round(n / 1.609344).toLocaleString('en-GB')} mi` : `${Math.round(n).toLocaleString('en-GB')} km`);
  // Grouped by day, newest first.
  const days: { day: string; items: TimelineRow[] }[] = [];
  for (const r of rows ?? []) {
    const d = dateText(r.at);
    const last = days[days.length - 1];
    if (last?.day === d) last.items.push(r);
    else days.push({ day: d, items: [r] });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Change timeline', headerRight: () => <GuideButton id="diagChanges" /> }} />
      <View style={styles.top}>
        <Text style={[type.sub, { color: t.muted, flex: 1 }]}>{vehicleTitle(v)}</Text>
        <HelpButton help={SECTIONS.diagTimeline} />
      </View>
      {rows && rows.length ? (
        <View style={styles.buttons}>
          <Button label="Share as text" icon="text-box-outline" variant="secondary" compact busy={busy === 'text'} disabled={!!busy} onPress={() => share('text')} style={{ flex: 1 }} />
          <Button label="Share as CSV" icon="file-delimited-outline" variant="secondary" compact busy={busy === 'csv'} disabled={!!busy} onPress={() => share('csv')} style={{ flex: 1 }} />
        </View>
      ) : null}
      {message ? <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : 'alert-circle-outline'} text={message.text} /> : null}

      {rows && !rows.length ? (
        <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Icon name="timeline-text-outline" size={40} color={t.faint} />
          <Text style={[type.heading, { color: t.text, marginTop: space.md }]}>No changes yet</Text>
          <Text style={[type.sub, { color: t.muted, textAlign: 'center', marginTop: 4 }]}>Each setting you change in Customise or Workshop is listed here, with its old and new value.</Text>
        </View>
      ) : null}

      {days.map((d) => (
        <Group key={d.day} header={d.day}>
          {d.items.map((r, i) => (
            <View key={r.id} style={[styles.row, { borderColor: t.border, borderTopWidth: i ? StyleSheet.hairlineWidth : 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={[type.heading, { color: t.text, flex: 1 }]}>{r.setting}</Text>
                <Text style={[type.small, type.number, { color: t.muted }]}>{clockText(r.at)}</Text>
              </View>
              <Text style={[type.small, { color: t.muted, marginTop: 1 }]}>
                {[r.module, r.source, km(r.odometerKm)].filter(Boolean).join(' · ')}
              </Text>
              {r.from || r.to ? (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
                  <Pill text={r.from ?? '?'} />
                  <Icon name="arrow-right" size={14} color={t.muted} />
                  <Pill text={r.to ?? '?'} tone="accent" />
                </View>
              ) : null}
              {(() => {
                const state = putBackState(r, v.codingOriginal, v.codingCache, rows ?? []);
                const open = tech === r.id;
                return (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      accessibilityLabel={`Technical details for ${r.setting}`}
                      hitSlop={6}
                      onPress={() => setTech(open ? null : r.id)}
                      style={styles.action}
                    >
                      <Text style={[type.small, { color: t.accentText }]}>{open ? 'Hide technical' : 'Technical'}</Text>
                      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={13} color={t.accentText} />
                    </Pressable>
                    {state === 'offer' ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Put back the original ${r.module} coding`} hitSlop={6} onPress={() => putBack(r)} style={styles.action}>
                        <Icon name="restart" size={14} color={t.accentText} />
                        <Text style={[type.small, { color: t.accentText }]}>Put back</Text>
                      </Pressable>
                    ) : state === 'original' ? (
                      <Text style={[type.small, { color: t.muted }]}>Original coding in place</Text>
                    ) : null}
                  </View>
                );
              })()}
              {tech === r.id ? (
                <View style={{ marginTop: 2 }}>
                  {r.before || r.after ? (
                    <Text selectable style={[type.small, { color: t.muted, fontFamily: MONO }]}>
                      {r.before || '?'} → {r.after || '?'}
                    </Text>
                  ) : null}
                  <Text selectable style={[type.small, { color: t.muted, marginTop: 4 }]}>
                    Backup: <Text style={{ fontFamily: MONO }}>{r.backup ?? 'Not recorded'}</Text>
                    {r.older ? ' (saved before backups were logged)' : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </Group>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  buttons: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  row: { paddingHorizontal: space.lg, paddingVertical: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: 4, flexWrap: 'wrap' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
});
