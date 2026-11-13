import { router, useFocusEffect } from 'expo-router';
import { chargeVerdict, restVerdict } from '../../../obd/battery';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hasClaude } from '../../../ai/claude';
import { codingItemsFor } from '../../../coding/items';
import { modsForVehicle } from '../../../mods/catalogue';
import { modulesFor } from '../../../obd/modules';
import { readKey, sensorsForCar } from '../../../obd/sensors';
import { methodsFor } from '../../../service/procedures';
import { describeDue, serviceDue } from '../../../service/reminder';
import { useSettings } from '../../../settings';
import { useConnection } from '../../../state';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, space, ToolColour, type, useTheme } from '../../../theme';
import { MakeBadge, makeLogoFor } from '../../../brand/MakeBadge';
import { Mascot } from '../../../brand/Mascot';
import { Arrive, Button, GlowCard, Group, HeaderButton, Icon, IconName, ListRow, Notice, Pill, Screen, tap } from '../../../ui';
import { GUIDES } from '../../../help';
import { WhichCar } from '../../../components/WhichCar';
import { YourCars } from '../../../components/YourCars';
import { useGarage, vehicleTitle } from '../../../vehicle/garage';
import { GROUP_LABEL } from '../../../vehicle/vin';

export default function Home() {
  const conn = useConnection();
  return conn.status === 'connected' && conn.vehicle && conn.info ? <Connected /> : <NotConnected />;
}

function NotConnected() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const last = garage.vehicles[0];
  return (
    <Screen title="Caristini" guide={GUIDES.home}>
      {conn.status === 'error' && conn.error ? <Notice tone="danger" icon="alert-circle-outline" text={conn.error} /> : null}

      <GlowCard tone="brand" style={styles.welcome}>
        <Mascot mood="asleep" size={150} />
        <Text style={[type.title, { color: t.text, marginTop: space.md, textAlign: 'center' }]}>Connect your car</Text>
        <Text style={[type.sub, { color: t.muted, marginTop: space.sm, textAlign: 'center' }]}>
          Plug the adapter into the OBD2 port under the dashboard and switch the ignition on. Caristini works out which car it is.
        </Text>
        <View style={{ gap: space.sm, marginTop: space.xl, alignSelf: 'stretch' }}>
          <Button label="Connect adapter" icon="bluetooth" busy={conn.status === 'connecting'} onPress={() => router.push('/connect')} />
        </View>
      </GlowCard>

      <YourCars />


      <Group header="No adapter needed">
        {last ? (
          <ListRow first icon="progress-clock" iconColour="blue" title="History" subtitle="Past health checks, faults, clears and changes" onPress={() => router.push({ pathname: '/history', params: { vin: last.vin } })} />
        ) : null}
        <ListRow first={!last} icon="magnify" iconColour="teal" title="Code lookup" subtitle="What a code means and how to fix it" onPress={() => router.push('/lookup')} />
        <ListRow icon="wrench-clock" iconColour="green" title="Service reset guides" subtitle="VW group, Ford, Mazda" onPress={() => router.push('/service')} />
        <ListRow icon="help-circle-outline" iconColour="blue" title="User guide" subtitle="What each screen does and how it works" onPress={() => router.push('/guide')} />
      </Group>
    </Screen>
  );
}

function Connected() {
  const t = useTheme();
  const conn = useConnection();
  const v = conn.vehicle!;
  const { settings: prefs } = useSettings();
  const info = conn.info!;
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [volts, setVolts] = useState<number | null>(null);

  useEffect(() => {
    conn.client?.livePidsForCar().then((l) => setLiveCount(l.length), () => setLiveCount(0));
  }, [conn.client]);

  // Battery voltage at the OBD port, every 10 s while this tab is on screen.
  useFocusEffect(
    useCallback(() => {
      const c = conn.client;
      if (!c) return undefined;
      let on = true;
      const read = () => c.batteryVoltage().then((x) => on && setVolts(x));
      read();
      const id = setInterval(read, 10000);
      return () => {
        on = false;
        clearInterval(id);
      };
    }, [conn.client]),
  );

  const mods = modsForVehicle(v.group, v.platform);
  const settings = conn.client?.supportsModules ? codingItemsFor(v.group, v.platform).length + (v.aiItems?.length ?? 0) : 0;
  const customCount = settings + mods.length;
  const methods = v.group !== 'other' ? methodsFor(v.group, v.platform).length : 0;
  const moduleCount = conn.client?.supportsModules && v.group !== 'other' ? modulesFor(v.group).length : 0;
  const incomplete = info.monitors.filter((m) => m.state === 'incomplete').length;
  const checked = v.lastCheckedAt != null;
  const faults = v.lastCodes.length;
  const alert = (checked && faults > 0) || info.milOn;
  const demo = conn.client?.transport.kind === 'simulated';
  // Above 13.3 V the alternator is charging (engine running): judge the
  // charging voltage; below, judge the resting battery (Battery test bands).
  const battery = volts == null ? null : volts >= 13.3 ? chargeVerdict(volts) : restVerdict(volts);
  const found = new Set(v.sensorsFound ?? []);
  const sensorCount = v.sensorScan ? sensorsForCar(v).filter((r) => found.has(readKey(r))).length : 0;
  const sensorTotal = sensorCount + (liveCount ?? 0);
  const learned = v.learnRun;

  return (
    <Screen
      title={v.nickname || v.model || v.brand}
      guide={GUIDES.home}
    >
      <View style={styles.metaRow}>
        <MakeBadge brand={v.brand} size={24} />
        <Pill text={demo ? 'Demo car' : 'Connected'} tone="ok" icon="checkbox-blank-circle" />
        <Text style={[type.sub, { color: t.muted, flex: 1 }]} numberOfLines={1}>
          {[v.nickname && v.model ? v.model : null, v.brand, v.year, v.fuel].filter(Boolean).join(' · ')}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Disconnect from the car" hitSlop={10} onPress={() => conn.disconnect()}>
          <Text style={[type.sub, { color: t.accentText, fontWeight: '600' }]}>Disconnect</Text>
        </Pressable>
      </View>

      <WhichCar />

      <Arrive>
        <GlowCard tone={!checked && !info.milOn ? 'brand' : alert ? 'fault' : 'ok'} style={{ padding: space.xl }}>
          <View style={styles.healthTop}>
            <View style={{ flex: 1 }}>
              <Text style={[type.small, { color: t.muted }]}>{checked ? `Last health check, ${when(v.lastCheckedAt!)}` : 'Health check'}</Text>
              {checked ? (
                <View style={styles.bigRow}>
                  <Text style={[styles.big, type.number, { color: faults ? t.danger : t.ok }]}>{faults}</Text>
                  <Text style={[type.title3, { color: t.text, marginBottom: 8 }]}>{faults === 1 ? 'fault' : 'faults'}</Text>
                </View>
              ) : (
                <Text style={[type.title, { color: t.text, marginVertical: space.sm }]}>Not checked yet</Text>
              )}
            </View>
            <Mascot mood={alert ? 'worried' : checked ? 'happy' : 'scanning'} size={92} />
          </View>
          <View style={styles.stats}>
            <Stat icon="engine-outline" label="Engine light" value={info.milOn ? 'On' : 'Off'} tone={info.milOn ? 'danger' : 'ok'} />
            <Stat icon="leaf" label="Emissions self-tests" value={info.monitors.length === 0 ? 'Not reported' : incomplete ? `${incomplete} pending` : 'All done'} tone={incomplete ? 'accent' : 'ok'} />
            <Stat
              icon="car-battery"
              label="Battery"
              value={volts == null ? '…' : `${volts.toFixed(1)} V`}
              note={battery?.word}
              tone={battery?.tone === 'danger' ? 'danger' : battery?.tone === 'neutral' ? 'accent' : 'ok'}
              onPress={() => router.push('/battery')}
            />
          </View>
          <View style={{ marginTop: space.lg, gap: space.sm }}>
            {checked && faults ? <Button label={`See ${faults} fault${faults === 1 ? '' : 's'}`} icon="format-list-bulleted" onPress={() => router.push({ pathname: '/diagnostics', params: { view: 'last' } })} /> : null}
            <Button label={checked ? 'Check again' : 'Run health check'} icon="heart-pulse" variant={checked && faults ? 'secondary' : 'primary'} onPress={() => router.push('/diagnostics')} />
          </View>
          <Text style={[type.small, { color: t.muted, textAlign: 'center', marginTop: space.sm }]}>
            {moduleCount ? `Checks up to ${moduleCount} control modules and the engine light` : 'Reads the engine computer and its light'}
          </Text>
        </GlowCard>
      </Arrive>

      {/* The order an owner works in: faults (above), settings, values, service. */}
      <View style={styles.tiles}>
        <Tile
          icon="tune-variant"
          colour="purple"
          title="Customise"
          value={settings ? 'Change settings' : mods.length ? `${mods.length} guides` : 'Learn my car first'}
          onPress={() => router.push(customCount ? '/customise' : '/learn-car')}
        />
        <Tile icon="chart-timeline-variant" colour="blue" title="Live data" value={liveCount == null ? '…' : sensorCount ? `${sensorCount} sensors` : `${sensorTotal} values`} onPress={() => router.push('/live')} />
        <Tile icon="wrench-clock" colour="green" title="Service" value={v.service ? (serviceDue(v.service, v.odometerKm).overdue ? 'Overdue' : describeDue(serviceDue(v.service, v.odometerKm), prefs.speed === 'mph').split(' or ')[0]) : 'Reminder and reset'} onPress={() => router.push('/service')} />
        <Tile icon="progress-clock" colour="red" title="History" value="Checks and changes" onPress={() => router.push({ pathname: '/history', params: { vin: v.vin } })} />
      </View>

      {v.learnSnapshot ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/customise/learn')} style={({ pressed }) => [styles.learn, { backgroundColor: t.surface, opacity: pressed ? 0.85 : 1, marginBottom: space.lg }]}>
          <View style={[styles.learnIcon, { backgroundColor: t.purple }]}>
            <Icon name="compare-horizontal" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: t.text }]}>Carry on learning from Carista</Text>
            <Text style={[type.small, { color: t.muted, marginTop: 1 }]}>Starting point saved. Tap to compare what changed.</Text>
          </View>
          <Icon name="chevron-right" size={13} color={t.faint} />
        </Pressable>
      ) : null}

      <AiCard name={v.model || v.brand} />

      {!learned ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/learn-car')} style={({ pressed }) => [styles.learn, { backgroundColor: t.surface, opacity: pressed ? 0.85 : 1 }]}>
          <View style={[styles.learnIcon, { backgroundColor: t.indigo }]}>
            <Icon name={'brain' as IconName} size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: t.text }]}>Learn my car</Text>
            <Text style={[type.small, { color: t.muted, marginTop: 1 }]}>Once per car: finds its modules, sensors and settings.</Text>
          </View>
          <Icon name="chevron-right" size={13} color={t.faint} />
        </Pressable>
      ) : null}

      <Group header="This car" footer={`${info.adapter} on ${info.protocol}`}>
        <ListRow first icon="car-info" iconColour="grey" title="VIN" value={v.vin} mono />
        <ListRow icon={'barcode' as IconName} iconColour="indigo" title="Parts and IDs" value="For buying parts" onPress={() => router.push({ pathname: '/car-ids', params: { vin: v.vin } })} />
        <ListRow icon="flash-outline" iconColour="teal" title="Fuses and manuals" onPress={() => router.push('/fuses')} />
        <ListRow icon="car-battery" iconColour="green" title="Battery test" onPress={() => router.push('/battery')} />
        <ListRow icon="file-document-outline" iconColour="indigo" title="Health report" value="PDF" onPress={() => router.push('/report')} />
        <ListRow icon={'book-open-variant' as IconName} iconColour="purple" title="Research notes" value="From the AI" onPress={() => router.push('/knowledge')} />
        <ListRow icon="pencil-outline" iconColour="grey" title={v.model ? 'Edit details' : 'Add model details'} onPress={() => router.push(`/vehicle?vin=${encodeURIComponent(v.vin)}`)} />
      </Group>

      <Group header="Driving">
        <ListRow first icon="speedometer" iconColour="blue" title="Dashboard" value="Gauges" onPress={() => router.push('/dashboard')} />
        <ListRow icon="timer-outline" iconColour="red" title="Performance" value="0 to 60" onPress={() => router.push('/performance')} />
      </Group>

      <Group header="Expert" footer="Optional. Health check finds faults, Live data watches values, and Learn my car finds a car's modules, sensors and settings.">
        <ListRow first icon="wrench-outline" iconColour="orange" title="Workshop" value="Every module" onPress={() => router.push('/workshop')} />
        <ListRow icon="radar" iconColour="blue" title="Sensor search" value={sensorCount ? `${sensorCount} found` : undefined} onPress={() => router.push('/sensors')} />
        {learned ? (
          <ListRow icon={'brain' as IconName} iconColour="indigo" title="Learn my car" value={`${learned.modules} modules, ${learned.sensors} sensors`} onPress={() => router.push('/learn-car')} />
        ) : null}
        <ListRow icon={'telescope' as IconName} iconColour="indigo" title="Unknown values" value="Explore a module" onPress={() => router.push('/discover')} />
        <ListRow icon="ear-hearing" iconColour="grey" title="Listen mode" value="Record another tool" onPress={() => router.push('/listen')} />
      </Group>

      <YourCars />
    </Screen>
  );
}

function Stat({ icon, label, value, tone, onPress, note }: { icon: IconName; label: string; value: string; tone: 'ok' | 'danger' | 'accent'; onPress?: () => void; note?: string }) {
  const t = useTheme();
  const c = tone === 'ok' ? t.ok : tone === 'danger' ? t.danger : t.accentText;
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`} disabled={!onPress} onPress={onPress} style={[styles.stat, { backgroundColor: t.bg + '66' }]}>
      <Icon name={icon} size={16} color={c} />
      <Text style={[type.caption, { color: t.muted, marginTop: 4 }]}>{label}</Text>
      <Text style={[type.sub, type.number, { color: t.text, fontWeight: '700' }]} numberOfLines={1}>
        {value}
      </Text>
      {note ? (
        <Text style={[type.caption, { color: c, fontWeight: '600' }]} numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
}

// One of the four main tools: a big tappable tile with a tinted glow.
function Tile({ icon, colour, title, value, onPress }: { icon: IconName; colour: ToolColour; title: string; value: string; onPress: () => void }) {
  const t = useTheme();
  const c = t[colour];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${value}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.tile, { backgroundColor: t.surface, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <LinearGradient colors={[c + '33', c + '00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.tileIcon, { backgroundColor: c }]}>
        <Icon name={icon} size={20} color="#FFFFFF" />
      </View>
      <Text style={[type.heading, { color: t.text, marginTop: space.md }]}>{title}</Text>
      <Text style={[type.small, { color: t.muted, marginTop: 1 }]} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

// Caristini AI on Home: ask anything, or tap a suggestion.
function AiCard({ name }: { name: string }) {
  const t = useTheme();
  const [ready, setReady] = useState<boolean | null>(null);
  // Checked each time Home comes back into view, so a key added in Settings shows at once.
  useFocusEffect(
    useCallback(() => {
      hasClaude()
        .then(setReady)
        .catch(() => setReady(false));
    }, []),
  );
  if (ready === false) {
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => [styles.ai, { borderColor: t.purple + '66', opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient colors={[t.purple + '40', t.accent + '1A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon name={'creation' as IconName} size={20} color={t.purple} />
          <Text style={[type.heading, { color: t.text, flex: 1 }]}>Set up Caristini AI</Text>
          <Icon name="chevron-right" size={13} color={t.faint} />
        </View>
        <Text style={[type.sub, { color: t.muted, marginTop: space.sm }]}>
          Explains faults and changes settings when you ask. Needs a Claude API key: add it in Settings.
        </Text>
      </Pressable>
    );
  }
  const ask = (q?: string) => {
    tap();
    router.push(q ? { pathname: '/ask', params: { q } } : '/ask');
  };
  return (
    <View style={[styles.ai, { borderColor: t.purple + '66' }]}>
      <LinearGradient colors={[t.purple + '40', t.accent + '1A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name={'creation' as IconName} size={20} color={t.purple} />
        <Text style={[type.heading, { color: t.text }]}>Caristini AI</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => ask()} style={[styles.aiInput, { backgroundColor: t.bg + 'CC' }]}>
        <Text style={[type.body, { color: t.muted, flex: 1 }]} numberOfLines={1}>
          Ask anything about your {name}
        </Text>
        <View style={[styles.aiSend, { backgroundColor: t.accent }]}>
          <Icon name={'arrow-up' as IconName} size={16} color={t.onAccent} />
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm }}>
        {['How is my car running?', 'What can I customise?', 'Explain my faults'].map((q) => (
          <Pressable key={q} accessibilityRole="button" onPress={() => ask(q)} style={({ pressed }) => [styles.aiChip, { backgroundColor: pressed ? t.raised : t.surface }]}>
            <Text style={[type.small, { color: t.text }]}>{q}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// "Today, 21:40" / "Yesterday, 08:15" / "9 Nov, 17:02"
function when(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days === 0) return `today ${time}`;
  if (days === 1) return `yesterday ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}

const styles = StyleSheet.create({
  welcome: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl },
  welcomeIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -space.sm, marginBottom: space.lg },
  circleButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  healthTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: 2 },
  big: { fontSize: 56, lineHeight: 62, fontWeight: '700', letterSpacing: -1 },
  healthIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  stat: { flex: 1, borderRadius: radius.md, padding: space.sm + 2 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.lg },
  tile: { flexBasis: '47%', flexGrow: 1, borderRadius: radius.lg, padding: space.lg, overflow: 'hidden', minHeight: 116 },
  tileIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ai: { borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg, overflow: 'hidden', borderWidth: 1 },
  aiInput: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: 22, paddingLeft: space.lg, paddingRight: 5, paddingVertical: 5, marginTop: space.md },
  aiSend: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  aiChip: { borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 6 },
  learn: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.lg, marginBottom: space.xl },
  learnIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
