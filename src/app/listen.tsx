import { router } from 'expo-router';
import { sendBack } from '../share/sendBack';
import React, { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { PinMark } from '../brand/PinMark';
import { resetFromRecording, resetTargets } from '../service/obdReset';
import { useConnection } from '../state';
import { useGarage } from '../vehicle/garage';
import { MONO, radius, space, type, useTheme } from '../theme';
import { SECTIONS } from '../help';
import { Button, Field, GlowCard, Group, ListRow, NeedsConnection, Notice, Screen, success } from '../ui';
import { useStayAwake } from '../keepAwake';

// Listen mode: with a Y-splitter on the OBD port, the adapter silently records
// what another tool (VCDS on a laptop, for example) sends to the car. The
// recording shows the exact commands for codings, adaptations and resets.
export default function Listen() {
  const t = useTheme();
  const conn = useConnection();
  const client = conn.client;
  const v = conn.vehicle;
  const [filter, setFilter] = useState<'all' | 'diag'>(v?.group === 'vag' ? 'all' : 'diag');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [note, setNote] = useState('');
  const [ended, setEnded] = useState<string | null>(null);
  const [used, setUsed] = useState<string | null>(null);
  const garage = useGarage();
  const log = useRef<string[]>([]);
  const started = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);
  // The phone stays awake while a recording runs, as in the data logger.
  useStayAwake('listen', running);

  if (!client || !v) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to listen" />
      </Screen>
    );
  }

  const stamp = () => ((Date.now() - started.current) / 1000).toFixed(3);

  const start = async () => {
    log.current = [`# Pin16 listen ${new Date().toISOString()} ${v.brand} ${v.model} ${v.vin} filter=${filter}`];
    setLines([]);
    setCount(0);
    setEnded(null);
    started.current = Date.now();
    setRunning(true);
    const until = new Promise<void>((resolve) => {
      stopRef.current = resolve;
    });
    let shown: string[] = [];
    let n = 0;
    try {
      const why = await client.listen(
        filter,
        (line) => {
          log.current.push(`${stamp()} ${line}`);
          n++;
          shown = [...shown.slice(-11), line];
          if (n % 5 === 0 || n < 5) {
            setCount(n);
            setLines(shown);
          }
        },
        until,
      );
      setCount(n);
      setLines(shown);
      if (why === 'ended') setEnded('The adapter stopped listening on its own, usually because too much traffic filled its memory. Try "Diagnostic IDs only".');
      else success();
    } catch (e) {
      setEnded(e instanceof Error ? e.message : String(e));
    } finally {
      stopRef.current = null;
      setRunning(false);
      // The recording goes to the private findings repo by itself.
      if (n) void sendBack('listen', v.vin, { car: { brand: v.brand, model: v.model, year: v.year, platform: v.platform }, filter, lines: n, text: log.current.join(String.fromCharCode(10)) });
    }
  };

  // A service reset done by another tool while recording becomes this car's
  // reset: only the steps the instrument cluster said yes to are kept.
  const useForService = async () => {
    setUsed(null);
    // The cluster, or on Ford and Mazda the engine computer: the first one the
    // other tool changed something in.
    const text = log.current.join(String.fromCharCode(10));
    let r: ReturnType<typeof resetFromRecording> = { error: 'This car has no module address on the newer protocol to take a reset from.' };
    for (const x of resetTargets(v.group)) {
      const def = client.moduleById(x.module);
      if (!def?.tx) continue;
      r = resetFromRecording(text, { id: def.id, tx: def.tx, rx: def.rx, name: def.name }, new Date(), v.odometerKm);
      if (!('error' in r)) break;
    }
    if ('error' in r) {
      setUsed(r.error);
      return;
    }
    await garage.update(v.vin, { serviceResets: [...(garage.latest(v.vin)?.serviceResets ?? []), r.reset] });
    success();
    router.push('/service-reset');
  };

  const mark = () => {
    const text = note.trim() || 'mark';
    log.current.push(`# ${stamp()} ${text}`);
    setNote('');
  };

  return (
    <Screen>
      <GlowCard tone={running ? 'brand' : 'plain'} style={styles.hero}>
        <PinMark size={56} decorative />
        <View style={{ flex: 1 }}>
          <Text style={[type.title3, { color: t.text }]}>Record another tool</Text>
          <Text style={[type.sub, { color: t.muted, marginTop: 4 }]}>
            Pin16 listens while VCDS or another tool works on the car, and saves exactly what it sends.
          </Text>
        </View>
      </GlowCard>

      <Group header="Set up" help={SECTIONS.listenSetup} footer="The adapter only listens: it sends nothing to the car while recording.">
        <ListRow first title="Plug an OBD Y-splitter into the car" noChevron />
        <ListRow title="This adapter in one plug, the other tool’s cable in the other" noChevron />
        <ListRow title="Ignition on, start recording here, then use the other tool" subtitle="Recording carries on while Pin16 is in the background" noChevron />
      </Group>

      <Group header="What to record" help={SECTIONS.listenWhat}>
        <ListRow first title="All traffic" subtitle="VW group cars: the gateway keeps most car traffic off the port" selected={filter === 'all'} disabled={running} onPress={() => setFilter('all')} />
        <ListRow title="Diagnostic IDs only (700 to 7FF)" subtitle="Ford and Mazda, or if the adapter stops with a full memory" selected={filter === 'diag'} disabled={running} onPress={() => setFilter('diag')} />
      </Group>

      {ended ? <Notice tone="danger" icon="alert-circle-outline" text={ended} /> : null}

      <Button label={running ? 'Stop recording' : 'Start recording'} icon={running ? 'stop' : 'record-circle-outline'} variant={running ? 'danger' : 'primary'} onPress={running ? () => stopRef.current?.() : start} />

      {running || count ? (
        <Group header={`${count.toLocaleString('en-GB')} frame${count === 1 ? '' : 's'}${running ? ', recording' : ''}`} style={{ marginTop: space.lg }}>
          <View style={styles.pad}>
            {lines.map((l, i) => (
              <Text key={i} style={[type.small, { color: t.text, fontFamily: MONO }]} numberOfLines={1}>
                {l}
              </Text>
            ))}
          </View>
        </Group>
      ) : null}

      {running ? (
        <Group header="Mark what you just did" help={SECTIONS.listenMark} footer="Markers go into the recording with the time, so each step can be matched to its commands.">
          <View style={[styles.pad, styles.markRow]}>
            <Field value={note} onChange={setNote} placeholder="For example: 17 coding, needle sweep on" accessibilityLabel="Marker note" style={{ flex: 1 }} />
            <Button label="Mark" variant="secondary" onPress={mark} />
          </View>
        </Group>
      ) : null}

      {!running && count ? (
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Button label="Share recording" icon="share-variant" onPress={() => Share.share({ message: log.current.join('\n'), title: 'Pin16 recording' })} />
          <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>The recording is sent to your private findings store by itself. You can also save it to Files.</Text>
          {resetTargets(v.group).length ? <Button label="Use as service reset" icon="wrench-clock" variant="secondary" onPress={useForService} /> : null}
          {used ? <Notice tone="danger" icon="alert-circle-outline" text={used} /> : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  pad: { padding: space.md },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },

});
