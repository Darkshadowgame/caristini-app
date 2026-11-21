import { useDisplay } from '../../../fonts';
import { router, useFocusEffect } from 'expo-router';
import { chargeVerdict, restVerdict } from '../../../obd/battery';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { codingItemsFor } from '../../../coding/items';
import { modsForVehicle } from '../../../mods/catalogue';
import { modulesFor } from '../../../obd/modules';
import { estimateSeconds, learnEstimate } from '../../../learn/runLearn';
import { learnAgainVerb, learnRunLabel } from '../../../learn/runLabel';
import { reconnectingText } from '../../../reconnect';
import { CarRecordRows } from '../../../components/CarRecords';
import { aboutRange, dateText, dateTimeText } from '../../../timeText';
import { modulesText, sensorCount, sensorCountShort, sensorCountText } from '../../../vehicle/counts';
import { driveTools, driveToolsSummary } from '../../../monitors/hub';
import { methodsFor } from '../../../service/procedures';
import { describeDue, vehicleServiceDue } from '../../../service/reminder';
import { useSettings } from '../../../settings';
import { useConnection } from '../../../state';
import { LinearGradient } from 'expo-linear-gradient';
import { onTool, radius, space, ToolColour, type, useTheme } from '../../../theme';
import { MakeBadge, makeLogoFor } from '../../../brand/MakeBadge';
import { PinMark } from '../../../brand/PinMark';
import { Arrive, Button, GlowCard, Group, HeaderButton, Icon, IconName, ListRow, Notice, Pill, Screen, tap, tool, TOOLS } from '../../../ui';
import { GUIDES } from '../../../help';
import { WhichCar } from '../../../components/WhichCar';
import { YourCars } from '../../../components/YourCars';
import { quickCheckDue, useGarage, Vehicle, vehicleTitle } from '../../../vehicle/garage';
import { useLastScan } from '../../../components/LastScan';
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
  const { settings: prefs } = useSettings();
  // The last car's service reminder, counted from the newer of the odometer
  // read from the car and the figure typed on the Service page.
  const due = last?.service ? vehicleServiceDue(last).due : null;
  return (
    <Screen title="Pin16" guide={GUIDES.home}>
      {/* A dropped link is tried again by itself; opening Connect or Stop trying ends it. */}
      {conn.reconnecting ? (
        <>
          <Notice icon="bluetooth" text={reconnectingText(conn.reconnecting, conn.lastAdapter?.name)} />
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => conn.disconnect()} style={{ alignSelf: 'center', marginBottom: space.md }}>
            <Text style={[type.sub, { color: t.accentText, fontWeight: '600' }]}>Stop trying</Text>
          </Pressable>
        </>
      ) : conn.status === 'error' && conn.error ? (
        <Notice tone="danger" icon="alert-circle-outline" text={conn.error} />
      ) : null}

      <GlowCard tone="plain" style={styles.welcome}>
        <PinMark lit={false} size={72} />
        <Text style={[type.title, { color: t.text, marginTop: space.md, textAlign: 'center' }]}>Connect your car</Text>
        <Text style={[type.sub, { color: t.muted, marginTop: space.sm, textAlign: 'center' }]}>
          Plug the adapter into the OBD port under the dashboard and switch the ignition on. Pin16 works out which car it is.
        </Text>
        <View style={{ gap: space.sm, marginTop: space.xl, alignSelf: 'stretch' }}>
          {/* Not busy while reconnecting, so Connect can be opened to choose an adapter by hand. */}
          <Button label="Connect adapter" icon="bluetooth" busy={conn.status === 'connecting' && !conn.reconnecting} onPress={() => router.push('/connect')} />
        </View>
      </GlowCard>

      <YourCars />


      <Group header="No adapter needed">
        {/* The last car's service reminder, said here when it is due or close, so it is seen without connecting. */}
        {last && due && (due.overdue || due.soon) ? (
          <ListRow
            first
            {...tool('service')}
            title="Service due"
            subtitle={`${vehicleTitle(last)}: ${describeDue(due, prefs.speed === 'mph').replace(/^./, (c) => c.toLowerCase())}`}
            right={due.overdue ? <Pill text="Overdue" tone="danger" /> : <Pill text="Soon" />}
            onPress={() => router.push('/service')}
          />
        ) : null}
        {last ? (
          <ListRow first={!(due && (due.overdue || due.soon))} {...tool('history')} title="History" subtitle="Past health checks, faults, clears and changes" onPress={() => router.push({ pathname: '/history', params: { vin: last.vin } })} />
        ) : null}
        {/* The last car's MOT check, saved logs, battery reading and emissions read. */}
        {last ? <CarRecordRows v={last} /> : null}
        <ListRow first={!last} {...tool('lookup')} title="Lookup" subtitle="What a code means and how to fix it" onPress={() => router.push('/lookup')} />
        <ListRow {...tool('service')} title="Service reset guides" subtitle="VW group, Ford, Mazda" onPress={() => router.push('/service')} />
        <ListRow {...tool('guide')} title="User guide" subtitle="What each screen does and how it works" onPress={() => router.push('/guide')} />
      </Group>
    </Screen>
  );
}

// The Service tile: the same reminder as the Service page, from one helper.
function serviceTileValue(v: Vehicle, miles: boolean): string {
  const { due, distanceStale } = vehicleServiceDue(v);
  if (!due) return 'Reminder and reset';
  if (due.overdue) return 'Overdue';
  return due.kmLeft == null && due.daysLeft == null && distanceStale ? 'Update odometer' : describeDue(due, miles, distanceStale).split(' or ')[0];
}

function Connected() {
  const displayFont = useDisplay();
  const t = useTheme();
  const conn = useConnection();
  const v = conn.vehicle!;
  const garage = useGarage();
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
  const settings = conn.client?.supportsModules ? codingItemsFor(v.group, v.platform).length : 0;
  const customCount = settings + mods.length;
  const methods = v.group !== 'other' ? methodsFor(v.group, v.platform).length : 0;
  // The health check asks only the car's known modules once two full checks
  // found them; before that the number depends on the car, so none is given.
  const withModules = !!conn.client?.supportsModules && v.group !== 'other';
  const knownModules = withModules && quickCheckDue(v) ? (v.modulesSeen?.filter((id) => modulesFor(v.group).some((m) => m.id === id)).length ?? 0) : 0;
  const incomplete = info.monitors.filter((m) => m.state === 'incomplete').length;
  // The last check is the one History holds, the same one "See faults" opens.
  const last = useLastScan(v.vin);
  const checkedAt = last?.at ?? v.lastCheckedAt;
  const checked = checkedAt != null;
  const faults = last ? (last.faults?.length ?? 0) : v.lastCodes.length;
  const alert = (checked && faults > 0) || info.milOn || !!last?.noAnswer;
  const demo = conn.client?.transport.kind === 'simulated';
  // Above 13.3 V the alternator is charging (engine running): judge the
  // charging voltage; below, judge the resting battery (Battery test bands).
  const battery = volts == null ? null : volts >= 13.3 ? chargeVerdict(volts) : restVerdict(volts);
  // One sensor count (vehicle/counts.ts), the same on every screen.
  const sensors = sensorCount(v);
  const sensorsFound = sensors.maker + sensors.groupValues;
  const learned = v.learnRun;
  // Learn my car stays on the Car tab: before a run, its time on this car;
  // after one, what the last run found.
  const [lo, hi] = estimateSeconds(learnEstimate(v, garage.vehicles, { pace: conn.client?.pace.snapshot() ?? null }));
  const learnLine = learned
    ? `${learnRunLabel(v)} ${dateText(learned.at)}: ${[
        learned.faults != null ? `${learned.faults} fault${learned.faults === 1 ? '' : 's'}` : null,
        modulesText(learned.modules),
        sensorsFound ? sensorCountText(sensors).replace(/^./, (c) => c.toLowerCase()) : null,
      ]
        .filter(Boolean)
        .join(', ')}. Run it again to ${learnAgainVerb(learnRunLabel(v))}: ${aboutRange(lo, hi, { lower: true })}.`
    : `One button reads everything: faults, modules, sensors, emissions, MOT and battery. ${aboutRange(lo, hi)}.`;

  return (
    <Screen
      title={v.nickname || v.model || v.brand}
      guide={GUIDES.home}
    >
      {/* The badge names the make; the line beneath gives year, fuel and platform, as a Your cars row does. */}
      <View style={styles.metaRow}>
        <MakeBadge brand={v.brand} size={24} />
        <Pill text={demo ? 'Demo car' : 'Connected'} tone="ok" icon="checkbox-blank-circle" />
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Disconnect from the car" hitSlop={12} onPress={() => conn.disconnect()}>
          <Text style={[type.sub, { color: t.accentText, fontWeight: '600' }]}>Disconnect</Text>
        </Pressable>
      </View>
      <Text style={[type.sub, type.number, { color: t.muted, marginBottom: space.lg }]}>
        {[v.year, v.nickname ? [v.brand, v.model].filter(Boolean).join(' ') : makeLogoFor(v.brand) ? null : v.brand, v.fuel, v.platform ?? (v.group !== 'other' ? GROUP_LABEL[v.group] : null)].filter(Boolean).join(' · ')}
      </Text>

      <WhichCar />

      <Arrive>
        <GlowCard tone={!checked && !info.milOn ? 'plain' : alert ? 'fault' : 'ok'} style={{ padding: space.xl }}>
          <View style={styles.healthTop}>
            <View style={{ flex: 1 }}>
              <Text style={[type.small, { color: t.muted }]}>{checked ? `Last health check, ${when(checkedAt!)}${last?.complete === false ? ' (stopped early)' : ''}` : 'Health check'}</Text>
              {checked ? (
                <View style={styles.bigRow}>
                  <Text style={[styles.big, type.number, displayFont, { color: faults ? t.danger : t.ok }]}>{faults}</Text>
                  <Text style={[type.title3, { color: t.text, marginBottom: 8 }]}>{faults === 1 ? 'fault' : 'faults'}</Text>
                </View>
              ) : (
                <Text style={[type.title, { color: t.text, marginVertical: space.sm }]}>Not checked yet</Text>
              )}
              {last?.noAnswer ? <Text style={[type.small, { color: t.danger, fontWeight: '600' }]}>No control module answered</Text> : null}
            </View>
            <PinMark lit={!alert} size={64} decorative />
          </View>
          <View style={styles.stats}>
            <Stat icon="engine-outline" label="Engine light" value={info.milOn ? 'On' : 'Off'} tone={info.milOn ? 'danger' : 'ok'} />
            {/* The count is the figure and the words sit beneath, as the battery's verdict does, so nothing is cut short. */}
            <Stat
              icon="leaf"
              label="Self-tests"
              value={info.monitors.length === 0 ? '–' : incomplete ? String(incomplete) : 'All'}
              note={info.monitors.length === 0 ? 'Not reported' : incomplete ? 'not yet run' : 'complete'}
              tone={incomplete || !info.monitors.length ? 'neutral' : 'ok'}
              onPress={() => router.push('/emissions-tests')}
            />
            <Stat
              icon="car-battery"
              label="Battery"
              value={volts == null ? '…' : `${volts.toFixed(1)} V`}
              note={battery?.word}
              tone={battery?.tone === 'danger' ? 'danger' : battery?.tone === 'neutral' || !battery ? 'neutral' : 'ok'}
              onPress={() => router.push('/battery')}
            />
          </View>
          <View style={{ marginTop: space.lg, gap: space.sm }}>
            {checked && faults ? <Button label={`See ${faults} fault${faults === 1 ? '' : 's'}`} icon="format-list-bulleted" onPress={() => router.push({ pathname: '/diagnostics', params: { view: 'last' } })} /> : null}
            <Button label={checked ? 'Check again' : 'Run health check'} icon={TOOLS.health.icon} variant={checked && faults ? 'secondary' : 'primary'} onPress={() => router.push('/diagnostics')} />
          </View>
          <Text style={[type.small, { color: t.muted, textAlign: 'center', marginTop: space.sm }]}>
            {knownModules ? `Checks this car’s ${knownModules} control modules and the engine light` : withModules ? 'Checks the control modules and the engine light' : 'Reads the engine computer and its light'}
          </Text>
        </GlowCard>
      </Arrive>

      {/* The order an owner works in: faults (above), settings, values, service. */}
      <View style={styles.tiles}>
        <Tile
          icon={TOOLS.customise.icon}
          colour={TOOLS.customise.colour}
          title="Customise"
          value={settings ? 'Change settings' : mods.length ? `${mods.length} guide${mods.length === 1 ? '' : 's'}` : 'Learn my car first'}
          onPress={() => router.push(customCount ? '/customise' : '/learn-car')}
        />
        <Tile icon={TOOLS.live.icon} colour={TOOLS.live.colour} title="Live data" value={sensorsFound ? sensorCountShort(sensors) : liveCount == null ? '…' : `${liveCount} value${liveCount === 1 ? '' : 's'}`} onPress={() => router.push('/live')} />
        <Tile icon={TOOLS.service.icon} colour={TOOLS.service.colour} title="Service" value={serviceTileValue(v, prefs.speed === 'mph')} onPress={() => router.push('/service')} />
        <Tile icon={TOOLS.history.icon} colour={TOOLS.history.colour} title="History" value="Checks and changes" onPress={() => router.push({ pathname: '/history', params: { vin: v.vin } })} />
      </View>

      {v.learnSnapshot ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/customise/learn')} style={({ pressed }) => [styles.learn, { backgroundColor: t.surface, opacity: pressed ? 0.85 : 1, marginBottom: space.lg }]}>
          <View style={[styles.learnIcon, { backgroundColor: t[TOOLS.learnSetting.colour] }]}>
            <Icon name={TOOLS.learnSetting.icon} size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: t.text }]}>Carry on learning a setting</Text>
            <Text style={[type.small, { color: t.muted, marginTop: 1 }]}>Starting point saved. Tap to compare what changed.</Text>
          </View>
          <Icon name="chevron-right" size={13} color={t.faint} />
        </Pressable>
      ) : null}


      <Pressable accessibilityRole="button" onPress={() => router.push('/learn-car')} style={({ pressed }) => [styles.learn, { backgroundColor: t.surface, opacity: pressed ? 0.85 : 1 }]}>
        <View style={[styles.learnIcon, { backgroundColor: t[TOOLS.learn.colour] }]}>
          <Icon name={TOOLS.learn.icon} size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.heading, { color: t.text }]}>Learn my car</Text>
          <Text style={[type.small, { color: t.muted, marginTop: 1 }]}>{learnLine}</Text>
        </View>
        <Icon name="chevron-right" size={13} color={t.faint} />
      </Pressable>

      <Group header="This car" footer={`${info.adapter} on ${info.protocol}`}>
        <ListRow first icon="car-info" iconColour="grey" title="VIN" value={v.vin} mono />
        {/* Trailing values are 1 or 2 words, so no title is squeezed onto 2 lines. */}
        <ListRow {...tool('ids')} title="Parts and IDs" value="Buying parts" onPress={() => router.push({ pathname: '/car-ids', params: { vin: v.vin } })} />
        <ListRow {...tool('fuses')} title="Fuses and manuals" onPress={() => router.push('/fuses')} />
        <ListRow {...tool('battery')} title="Battery test" onPress={() => router.push('/battery')} />
        <ListRow {...tool('mot')} title="MOT check" value="Before the test" onPress={() => router.push('/mot')} />
        <ListRow {...tool('report')} title="Health report" value="PDF" onPress={() => router.push('/report')} />
        <ListRow {...tool('notes')} title="Research notes" onPress={() => router.push('/knowledge')} />
        <ListRow {...tool('details')} title={v.model ? 'Edit details' : 'Add model details'} onPress={() => router.push(`/vehicle?vin=${encodeURIComponent(v.vin)}`)} />
      </Group>

      <Group header="Driving">
        <ListRow first {...tool('dashboard')} title="Dashboard" value="Gauges" onPress={() => router.push('/dashboard')} />
        <ListRow {...tool('performance')} title="Performance" value="0 to 60" onPress={() => router.push('/performance')} />
        <ListRow {...tool('monitors')} title="Drive monitors" value={driveToolsSummary(driveTools(v, !!(info.diesel || v.fuel === 'Diesel')))} onPress={() => router.push('/monitors')} />
        <ListRow {...tool('logger')} title="Data logger" value="Record" onPress={() => router.push('/logger')} />
      </Group>

      <Group header="Expert" footer="Optional. Workshop opens one module at a time; Learn my car, above, reads everything and fills in these screens.">
        <ListRow first {...tool('workshop')} title="Workshop" value="Every module" onPress={() => router.push('/workshop')} />
        <ListRow {...tool('sensors')} title="Find my car’s sensors" value={sensors.maker ? `${sensors.maker.toLocaleString('en-GB')} found` : undefined} onPress={() => router.push('/sensors')} />
        <ListRow {...tool('discover')} title="Unknown values" value="Explore" onPress={() => router.push('/discover')} />
        <ListRow {...tool('listen')} title="Listen mode" value="Other tools" onPress={() => router.push('/listen')} />
      </Group>

      <YourCars />
    </Screen>
  );
}

// tone: green healthy, red a fault, grey for anything waiting or not known
// (the Meaning Rule: orange is not a status colour; status uses green, yellow and red).
function Stat({ icon, label, value, tone, onPress, note }: { icon: IconName; label: string; value: string; tone: 'ok' | 'danger' | 'neutral'; onPress?: () => void; note?: string }) {
  const t = useTheme();
  const c = tone === 'ok' ? t.ok : tone === 'danger' ? t.danger : t.muted;
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${label}: ${value}${note ? ` ${note}` : ''}`} disabled={!onPress} onPress={onPress} style={[styles.stat, { backgroundColor: t.bg + '66' }]}>
      <Icon name={icon} size={16} color={c} />
      {/* One line each, so the 3 figures sit on one baseline. */}
      <Text style={[type.caption, { color: t.muted, marginTop: 4 }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[type.sub, type.number, { color: t.text, fontWeight: '700' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {value}
      </Text>
      {note ? (
        <Text style={[type.caption, { color: c, fontWeight: '600' }]}>{note}</Text>
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
        <Icon name={icon} size={20} color={onTool(colour)} />
      </View>
      <Text style={[type.heading, { color: t.text, marginTop: space.md }]}>{title}</Text>
      {/* The status wraps to a second line if it must; it is never cut short. */}
      <Text style={[type.small, { color: t.muted, marginTop: 1 }]} numberOfLines={2}>
        {value}
      </Text>
    </Pressable>
  );
}

// "9 Nov 2026, 17:02": the same words as the Health check page (src/timeText.ts).
const when = (ms: number): string => dateTimeText(ms);

const styles = StyleSheet.create({
  welcome: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl },
  welcomeIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -space.sm, marginBottom: space.sm },
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
  learn: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.lg, marginBottom: space.xl },
  learnIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
