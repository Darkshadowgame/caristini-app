// Line charts for the log viewer, drawn with react-native-svg. Drag across a
// chart to move the cursor; the screen shows every value at that moment.
import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { SANS, Theme, useTheme } from '../theme';
import { decimate, LogMarker, Series } from './format';

// One colour per value, from the app's tool colours.
export function chartColours(t: Theme): string[] {
  return [t.blue, t.orange, t.green, t.purple, t.teal, t.red, t.indigo, t.grey];
}

export interface ChartLine {
  series: Series;
  colour: string;
  // The value range drawn from bottom to top.
  lo: number;
  hi: number;
}

const PAD_Y = 8;

export function LogChart({
  lines,
  durationMs,
  height = 120,
  markers,
  cursor,
  onScrub,
  topLabel,
  bottomLabel,
  accessibilityLabel,
}: {
  lines: ChartLine[];
  durationMs: number;
  height?: number;
  markers: LogMarker[];
  cursor: number | null;
  onScrub: (t: number) => void;
  topLabel?: string;
  bottomLabel?: string;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const span = Math.max(1, durationMs);
  const widthRef = useRef(0);
  widthRef.current = width;
  const scrubRef = useRef(onScrub);
  scrubRef.current = onScrub;
  const startX = useRef(0);

  const toTime = (x: number) => (Math.max(0, Math.min(widthRef.current, x)) / Math.max(1, widthRef.current)) * span;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: (e) => {
          startX.current = e.nativeEvent.locationX;
          scrubRef.current(toTime(startX.current));
        },
        onPanResponderMove: (_, g) => scrubRef.current(toTime(startX.current + g.dx)),
        // A vertical swipe scrolls the page instead.
        onPanResponderTerminationRequest: () => true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [span],
  );

  const plot = useMemo(() => {
    if (!width) return [];
    const h = height - PAD_Y * 2;
    return lines.map((l) => {
      const s = decimate(l.series, Math.max(40, Math.floor(width)));
      const range = l.hi - l.lo || 1;
      const xy: { x: number; y: number }[] = [];
      for (let i = 0; i < s.t.length; i++) xy.push({ x: (s.t[i] / span) * width, y: PAD_Y + (1 - (s.v[i] - l.lo) / range) * h });
      return { colour: l.colour, points: xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), dot: xy.length === 1 ? xy[0] : null };
    });
  }, [lines, width, height, span]);

  const cx = cursor != null && width ? (cursor / span) * width : null;
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Drag across the chart to read the values at a moment"
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={[styles.box, { height, backgroundColor: t.sunken + '66' }]}
      {...pan.panHandlers}
    >
      {width ? (
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke={t.border} strokeWidth={StyleSheet.hairlineWidth} />
          {markers.map((m) => {
            const x = (m.t / span) * width;
            return (
              <React.Fragment key={m.n}>
                <Line x1={x} x2={x} y1={0} y2={height} stroke={t.accent} strokeWidth={1} strokeDasharray="3,3" />
                <Rect x={x + 2} y={2} width={m.n > 9 ? 18 : 12} height={14} rx={4} fill={t.accent} />
                <SvgText x={x + (m.n > 9 ? 11 : 8)} y={13} fontFamily={SANS} fontSize={10} fontWeight="700" fill={t.onAccent} textAnchor="middle">
                  {String(m.n)}
                </SvgText>
              </React.Fragment>
            );
          })}
          {plot.map((p, i) =>
            p.dot ? (
              <Rect key={i} x={p.dot.x - 2} y={p.dot.y - 2} width={4} height={4} fill={p.colour} />
            ) : (
              <Polyline key={i} points={p.points} fill="none" stroke={p.colour} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
            ),
          )}
          {cx != null ? <Line x1={cx} x2={cx} y1={0} y2={height} stroke={t.text} strokeWidth={1.25} /> : null}
          {topLabel ? (
            <SvgText x={width - 4} y={12} fontFamily={SANS} fontSize={10} fill={t.muted} textAnchor="end">
              {topLabel}
            </SvgText>
          ) : null}
          {bottomLabel ? (
            <SvgText x={width - 4} y={height - 4} fontFamily={SANS} fontSize={10} fill={t.muted} textAnchor="end">
              {bottomLabel}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 10, overflow: 'hidden' },
});
