// Shared pieces for Live data, the dashboard and the trim and boost views:
// dial, bar and line drawings, the tile settings sheet (alert limits and
// lowest/highest) and the shift light.
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Line, Path, Polyline, Rect } from 'react-native-svg';
import type { LivePid } from '../obd/pids';
import { Settings, toUserUnits } from '../settings';
import { radius, space, type, useTheme } from '../theme';
import { Button, Group, ListRow, Notice, useReduceMotion } from '../ui';
import { AlertRule, MinMax, Peak, ruleFromInput } from './alerts';

// ---------------------------------------------------------------------------
// Drawings
// ---------------------------------------------------------------------------

const SWEEP = 240;
const START = 150;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(from: number, to: number): string {
  const [x1, y1] = polar(50, 50, 40, from);
  const [x2, y2] = polar(50, 50, 40, to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A 40 40 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// A 240 degree dial. frac 0 to 1 (null: no reading); peak marks the held peak.
export function Dial({ frac, peak, colour, height = 86 }: { frac: number | null; peak?: number | null; colour: string; height?: number }) {
  const t = useTheme();
  const end = START + SWEEP * Math.max(0.001, frac ?? 0);
  const tick = peak != null ? polar(50, 50, 40, START + SWEEP * peak) : null;
  const tickIn = peak != null ? polar(50, 50, 31, START + SWEEP * peak) : null;
  return (
    <Svg width="100%" height={height} viewBox="0 0 100 74">
      <Path d={arc(START, START + SWEEP)} stroke={t.sunken} strokeWidth={7} strokeLinecap="round" fill="none" />
      {frac != null ? <Path d={arc(START, end)} stroke={colour} strokeWidth={7} strokeLinecap="round" fill="none" /> : null}
      {tick && tickIn ? <Line x1={tickIn[0]} y1={tickIn[1]} x2={tick[0]} y2={tick[1]} stroke={t.text} strokeWidth={1.5} /> : null}
    </Svg>
  );
}

// A horizontal bar filled to frac, with the held peak as a thin mark.
export function Bar({ frac, peak, colour }: { frac: number | null; peak?: number | null; colour: string }) {
  const t = useTheme();
  return (
    <View style={[styles.barTrack, { backgroundColor: t.sunken }]} accessible={false}>
      <View style={{ width: `${Math.round((frac ?? 0) * 100)}%`, backgroundColor: colour, borderRadius: 6 }} />
      {peak != null ? <View style={[styles.barPeak, { left: `${Math.round(peak * 100)}%`, backgroundColor: t.text }]} /> : null}
    </View>
  );
}

// One or more lines over the same scale. band: a shaded range (same units).
export function LineChart({
  series,
  height = 120,
  band,
  zero,
}: {
  series: { values: (number | null)[]; colour: string; dashed?: boolean }[];
  height?: number;
  band?: [number, number];
  zero?: boolean;
}) {
  const t = useTheme();
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (band) all.push(...band);
  if (zero) all.push(0);
  if (!all.length) return <View style={{ height }} />;
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const n = Math.max(2, ...series.map((s) => s.values.length));
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  return (
    <Svg width="100%" height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
      {band ? <Rect x={0} y={y(band[1])} width={100} height={Math.max(0, y(band[0]) - y(band[1]))} fill={t.okSoft} /> : null}
      {zero ? <Line x1={0} x2={100} y1={y(0)} y2={y(0)} stroke={t.border} strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
      {series.map((s, k) => {
        // Gaps (null) split the line.
        const runs: string[][] = [[]];
        s.values.forEach((v, i) => {
          if (v == null) runs.push([]);
          else runs[runs.length - 1].push(`${x(i).toFixed(2)},${y(v).toFixed(2)}`);
        });
        return runs
          .filter((r) => r.length > 1)
          .map((r, j) => (
            <Polyline
              key={`${k}-${j}`}
              points={r.join(' ')}
              fill="none"
              stroke={s.colour}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5,4' : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ));
      })}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Tile settings: alert limits, lowest and highest, held peak
// ---------------------------------------------------------------------------

export function TileSheet({
  pid: open,
  rule: ruleIn,
  minMax: minMaxIn,
  peak: peakIn,
  settings,
  onSave,
  onResetMinMax,
  onClose,
  extra,
}: {
  pid: LivePid | null;
  rule: AlertRule | undefined;
  minMax: MinMax | null | undefined;
  peak: Peak | null | undefined;
  settings: Pick<Settings, 'speed' | 'temp'>;
  onSave: (rule: AlertRule | null) => void;
  onResetMinMax: () => void;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
  // Keep showing the last value while the sheet slides away.
  const last = useRef({ pid: open, rule: ruleIn, minMax: minMaxIn, peak: peakIn });
  if (open) last.current = { pid: open, rule: ruleIn, minMax: minMaxIn, peak: peakIn };
  const { pid, rule, minMax, peak } = last.current;
  const [above, setAbove] = useState('');
  const [below, setBelow] = useState('');
  const [minRpm, setMinRpm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const shown = (v: number | null | undefined) => (v == null || !pid ? '' : String(+toUserUnits(v, pid.unit, settings).value.toFixed(Math.max(pid.decimals, 1))));
  useEffect(() => {
    if (!open || !pid) return;
    setAbove(shown(rule?.above));
    setBelow(shown(rule?.below));
    setMinRpm(rule?.minRpm ? String(rule.minRpm) : '');
    setError(null);
    // Fill the fields each time the sheet opens for a value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.pid, ruleIn]);
  const unit = pid ? toUserUnits(0, pid.unit, settings).unit : '';
  const fmt = (v: number) => (pid ? `${toUserUnits(v, pid.unit, settings).value.toFixed(pid.decimals)} ${unit}`.trim() : '');
  const save = () => {
    if (!pid) return;
    const r = ruleFromInput(pid.pid, pid.unit, { above, below, minRpm }, settings);
    if (r.error) {
      setError(r.error);
      return;
    }
    onSave(r.rule);
  };

  return (
    <Modal visible={!!open} animationType="slide" presentationStyle={ios ? 'pageSheet' : undefined} transparent={!ios} onRequestClose={onClose}>
      <View style={[{ flex: 1, backgroundColor: t.bg }, !ios && styles.sheetWeb]}>
        <View style={[styles.sheetBar, { borderColor: t.border }]}>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.barButton}>
            <Text style={[type.body, { color: t.accentText }]}>Cancel</Text>
          </Pressable>
          <Text numberOfLines={1} style={[type.heading, { color: t.text, flex: 1, textAlign: 'center' }]}>
            {pid?.label ?? ''}
          </Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={save} style={[styles.barButton, { alignItems: 'flex-end' }]}>
            <Text style={[type.body, { color: t.accentText, fontWeight: '600' }]}>Save</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {extra}
          <Group header="Since you opened the page" footer="The peak holds the highest reading for 3 seconds, then follows the value down.">
            <ListRow first title="Lowest" value={minMax ? fmt(minMax.min) : 'None yet'} />
            <ListRow title="Highest" value={minMax ? fmt(minMax.max) : 'None yet'} />
            <ListRow title="Peak (held)" value={peak ? fmt(peak.value) : 'None yet'} />
          </Group>
          <Button label="Reset lowest and highest" icon="restart" variant="secondary" onPress={onResetMinMax} style={{ marginBottom: space.xl }} />

          <Group
            header="Alert"
            footer="The tile turns red and the phone buzzes once when the value goes past a limit. Leave both limits empty for no alert."
          >
            <View style={{ padding: space.lg, paddingTop: space.sm }}>
              <NumberField label={`Warn above${unit ? ` (${unit})` : ''}`} value={above} onChange={setAbove} />
              <NumberField label={`Warn below${unit ? ` (${unit})` : ''}`} value={below} onChange={setBelow} />
              <NumberField label="Only when engine speed is above (rpm, optional)" value={minRpm} onChange={setMinRpm} integer />
            </View>
          </Group>
          {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
          {rule ? <Button label="Remove alert" icon="bell-off-outline" variant="danger" onPress={() => onSave(null)} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function NumberField({ label, value, onChange, integer }: { label: string; value: string; onChange: (v: string) => void; integer?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: space.sm }}>
      <Text style={[type.small, { color: t.muted, marginBottom: 4 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={integer ? 'number-pad' : 'numbers-and-punctuation'}
        accessibilityLabel={label}
        placeholder="None"
        placeholderTextColor={t.faint}
        selectionColor={t.accent}
        style={[type.body, type.number, styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
      />
    </View>
  );
}

// Choice chips in a row (tile style, page).
export function Chips<T extends string>({ options, value, onPick }: { options: { id: T; label: string }[]; value: T; onPick: (id: T) => void }) {
  const t = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(o.id)}
            style={[styles.chip, { backgroundColor: on ? t.accentSoft : t.sunken }]}
          >
            <Text style={[type.small, { color: on ? t.accentText : t.text, fontWeight: on ? '600' : '400' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shift light: the whole screen flashes at the set engine speed. With Reduce
// Motion on it shows steady instead. Flashes about 2.5 times a second.
// ---------------------------------------------------------------------------

export function ShiftLight({ on }: { on: boolean }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const [lit, setLit] = useState(true);
  // One buzz per 3 seconds at most.
  const lastBuzz = useRef(0);
  useEffect(() => {
    if (!on) return;
    setLit(true);
    if (Platform.OS !== 'web' && Date.now() - lastBuzz.current > 3000) {
      lastBuzz.current = Date.now();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    }
    if (reduce) return;
    const id = setInterval(() => setLit((l) => !l), 200);
    return () => clearInterval(id);
  }, [on, reduce]);
  if (!on) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel="Shift up"
      style={[StyleSheet.absoluteFill, styles.shift, { backgroundColor: lit || reduce ? t.danger : 'transparent' }]}
    >
      {lit || reduce ? <Text style={styles.shiftText}>Shift</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barTrack: { height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', marginTop: space.sm },
  barPeak: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1 },
  sheetWeb: { marginTop: 60, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  sheetBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  barButton: { width: 80, minHeight: 44, justifyContent: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: { borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  shift: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  shiftText: { color: '#FFFFFF', fontSize: 72, fontWeight: '800', letterSpacing: -1 },
});
