import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Updates from 'expo-updates';
import { getOwnSecret, isBuiltIn, SecretName, setSecret } from '../share/secrets';
import { canSendAutomatically, flushOutbox, outbox, sendBack, shareOutbox } from '../share/sendBack';
import { useGarage } from '../vehicle/garage';
import { sendLogNow } from '../share/sendLog';
import { loadDiscovery } from '../discover';
import { AdapterReport } from '../obd/elm';
import { trafficLog } from '../obd/trafficLog';
import { releaseUrl, versionLine } from '../version';
import { phoneRegion, regionUnits, useSettings } from '../settings';
import { useConnection } from '../state';
import { radius, space, type, useTheme } from '../theme';
import { Help, SECTIONS } from '../help';
import { Button, Group, ListRow, Notice, Screen, ConfirmSheet } from '../ui';

export default function SettingsScreen({ title, guide }: { title?: string; guide?: Help } = {}) {
  const t = useTheme();
  const { settings, set } = useSettings();
  const region = phoneRegion();
  const auto = regionUnits(region);
  const conn = useConnection();
  const [report, setReport] = useState<AdapterReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logCount, setLogCount] = useState(trafficLog.count());

  const check = async () => {
    if (!conn.client) return;
    setChecking(true);
    setError(null);
    try {
      setReport(await conn.client.checkAdapter());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
      setLogCount(trafficLog.count());
    }
  };

  const [logNote, setLogNote] = useState<string | null>(null);
  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void, sub?: string, first?: boolean) => (
    <View style={[styles.row, { borderColor: t.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: t.text }]}>{label}</Text>
        {sub ? <Text style={[type.sub, { color: t.muted, marginTop: 2 }]}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.green, false: t.sunken }} accessibilityLabel={label} />
    </View>
  );

  const rt = report?.roundTrip;
  // The older VW protocol needs Caristini's reply within about 100 ms of the module's frame.
  const slow = rt ? rt.avg > 80 : false;

  return (
    <Screen title={title} guide={guide}>
      <Group header="Speed and distance" footer={settings.speedAuto ? `Automatic: ${auto.speed === 'mph' ? 'miles' : 'kilometres'}${region ? ` for your phone's region (${region})` : ''}.` : undefined}>
        <ListRow first title="Automatic" subtitle="From your phone's region" selected={settings.speedAuto} noChevron onPress={() => set({ speedAuto: true, speed: auto.speed })} />
        <ListRow title="Miles (mph)" selected={!settings.speedAuto && settings.speed === 'mph'} noChevron onPress={() => set({ speedAuto: false, speed: 'mph' })} />
        <ListRow title="Kilometres (km/h)" selected={!settings.speedAuto && settings.speed === 'km/h'} noChevron onPress={() => set({ speedAuto: false, speed: 'km/h' })} />
      </Group>
      <Group header="Temperature" footer={settings.tempAuto ? `Automatic: ${auto.temp === '°C' ? 'Celsius' : 'Fahrenheit'}${region ? ` for your phone's region (${region})` : ''}.` : undefined}>
        <ListRow first title="Automatic" subtitle="From your phone's region" selected={settings.tempAuto} noChevron onPress={() => set({ tempAuto: true, temp: auto.temp })} />
        <ListRow title="Celsius (°C)" selected={!settings.tempAuto && settings.temp === '°C'} noChevron onPress={() => set({ tempAuto: false, temp: '°C' })} />
        <ListRow title="Fahrenheit (°F)" selected={!settings.tempAuto && settings.temp === '°F'} noChevron onPress={() => set({ tempAuto: false, temp: '°F' })} />
      </Group>

      <Group header="Connecting" help={SECTIONS.settingsConnecting}>
        {toggle(
          'Connect when the app opens',
          settings.autoConnect,
          (v) => set({ autoConnect: v }),
          conn.lastAdapter ? `To ${conn.lastAdapter.name}` : 'Connect to an adapter once first',
          true,
        )}
        {toggle('Health check after connecting', settings.autoCheck, (v) => set({ autoCheck: v }), 'Runs a health check straight away')}
      </Group>

      <Group header="Adapter" help={SECTIONS.settingsAdapter} footer="Reads what the adapter is and how fast it answers. Changes nothing in the car.">
        {report ? (
          <>
            <ListRow first title="Adapter" value={report.id || 'Unknown'} noChevron />
            {report.device ? <ListRow title="Device" value={report.device} noChevron /> : null}
            <ListRow title="Protocol" value={report.protocol} noChevron />
            <ListRow title="Reply speed" value={`${rt!.avg} ms (${rt!.min} to ${rt!.max})`} noChevron />
            <ListRow title="Older VW modules" value={report.rawCan ? (slow ? 'Supported, slow link' : 'Supported') : 'Not supported'} noChevron />
            <ListRow title="Ford and Mazda extra modules" value={report.secondBus ? 'Supported' : 'Not supported'} noChevron />
            {report.volts != null ? <ListRow title="Battery" value={`${report.volts.toFixed(1)} V`} noChevron /> : null}
          </>
        ) : null}
        <View style={styles.pad}>
          <Button label={report ? 'Check again' : 'Check adapter'} icon="car-connected" variant="secondary" busy={checking} disabled={!conn.client || checking} onPress={check} />
          {!conn.client ? <Text style={[type.small, { color: t.muted, marginTop: space.sm }]}>Connect to the adapter first.</Text> : null}
        </View>
      </Group>
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
      {report && slow && report.rawCan ? (
        <Notice icon="information-outline" text="The adapter answers slowly for older VW modules, which expect a reply within about 100 ms. They may answer only some of the time." />
      ) : null}

      <UpdatesGroup />

      <Group
        header="AI"
        help={SECTIONS.settingsAi}
        footer="Explains faults and answers questions. Your key stays in this phone's keychain and goes only to Anthropic."
      >
        <SecretRow name="claudeKey" label="Claude API key" placeholder="sk-ant-..." first />
        <ListRow icon="open-in-new" iconColour="purple" title="Get a key" onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')} />
      </Group>

      <Group header="Troubleshooting" help={SECTIONS.settingsTroubleshooting} footer="The log holds the last 4,000 adapter commands and replies. With automatic sending on, new lines are sent after each health check or search, so a problem can be looked at without sharing anything.">
        {toggle('Keep an adapter log', settings.debugLog, (v) => set({ debugLog: v }), undefined, true)}
        {toggle('Send the log automatically', settings.autoSendLog !== false, (v) => set({ autoSendLog: v }), 'After each health check, sensor search, Learn my car or failed connect')}
        <ListRow
          icon="cloud-upload-outline"
          iconColour="green"
          title="Send the log now"
          value={logNote ?? undefined}
          disabled={!logCount}
          onPress={async () => {
            setLogNote('Sending');
            const r = await sendLogNow('sent from Settings', conn.vehicle, true);
            setLogNote(r ? (r.startsWith('Sent') ? 'Sent' : 'Saved to send later') : 'Nothing new');
          }}
        />
        <ListRow
          icon="share-variant"
          iconColour="blue"
          title="Share adapter log"
          value={`${logCount} lines`}
          disabled={!logCount}
          onPress={() =>
            Share.share({
              title: 'Caristini adapter log',
              message: trafficLog.text(`# Caristini adapter log ${new Date().toISOString()} ${conn.vehicle ? `${conn.vehicle.brand} ${conn.vehicle.model} ${conn.vehicle.vin}` : ''}`),
            })
          }
        />
        <ListRow
          icon="trash-can-outline"
          iconColour="grey"
          title="Clear log"
          disabled={!logCount}
          onPress={() => {
            trafficLog.clear();
            setLogCount(0);
          }}
        />
      </Group>

      <Group
        header="Sharing findings"
        help={SECTIONS.settingsSending}
        footer="What your car teaches Caristini goes to your private findings store, so it can be built in for every car."
      >
        <AutoSendRow />
        <OutboxRows />
        <SecretRow name="githubToken" label="GitHub token (optional)" placeholder="github_pat_..." />
        <View style={[styles.row, { borderColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[type.body, { color: t.text }]}>Email to</Text>
          <TextInput
            value={settings.sendTo}
            onChangeText={(v) => set({ sendTo: v.trim() })}
            placeholder="you@example.com"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[type.body, styles.inline, { color: t.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          />
        </View>
      </Group>

      <Group header="Help">
        <ListRow first icon="help-circle-outline" iconColour="blue" title="User guide" subtitle="What each screen does and how it works" onPress={() => router.push('/guide')} />
      </Group>
    </Screen>
  );
}

// New versions arrive over the air: checked when the app opens and here on demand.
function UpdatesGroup() {
  const [state, setState] = useState<'idle' | 'checking' | 'none' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const enabled = Updates.isEnabled;
  const when = Updates.createdAt ? Updates.createdAt.toLocaleString('en-GB') : null;
  const check = async () => {
    setState('checking');
    setError(null);
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) {
        setState('none');
        return;
      }
      await Updates.fetchUpdateAsync();
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  };
  return (
    <Group
      header="App updates"
      help={SECTIONS.settingsUpdates}
      footer={
        enabled
          ? 'New versions download by themselves when the app opens and apply the next time it starts. A free Apple ID install still needs signing again every 7 days.'
          : 'Updates work in the installed app, not in this preview.'
      }
    >
      <ListRow
        first
        icon="information-outline"
        iconColour="grey"
        title={versionLine()}
        subtitle={when ? `Running the update from ${when}` : 'Running the built-in version'}
        onPress={releaseUrl() ? () => Linking.openURL(releaseUrl()!) : undefined}
        noChevron={!releaseUrl()}
      />
      {state === 'ready' ? (
        <ListRow icon="restart" iconColour="green" title="Restart to update" onPress={() => Updates.reloadAsync()} />
      ) : (
        <ListRow
          icon="refresh"
          iconColour="blue"
          title={state === 'checking' ? 'Checking…' : 'Check for updates'}
          value={state === 'none' ? 'Up to date' : state === 'error' ? 'Could not check' : undefined}
          disabled={!enabled || state === 'checking'}
          onPress={check}
        />
      )}
      {error ? <ListRow title="Reason" subtitle={error} noChevron /> : null}
    </Group>
  );
}

// Findings waiting to be sent (a refused token or no signal), and a way to
// send again what each car already saved (Learn my car, sensors, deep scan).
function OutboxRows() {
  const garage = useGarage();
  const [waiting, setWaiting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const refresh = () =>
    outbox().then((l) => {
      setWaiting(l.length);
      setError(l.length ? l[l.length - 1].error : null);
    });
  useEffect(() => {
    refresh();
  }, []);
  const run = async (job: () => Promise<string>) => {
    setBusy(true);
    setNote(null);
    try {
      setNote(await job());
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      await refresh();
      setBusy(false);
    }
  };
  const cars = garage.vehicles.filter((v) => v.learnRun || v.sensorsFound?.length || v.deepFound?.length || v.knowledge);
  return (
    <>
      <ListRow
        icon={waiting ? 'tray-arrow-up' : 'check-circle'}
        iconColour={waiting ? 'orange' : 'green'}
        title={waiting ? `${waiting} waiting to send` : 'Nothing waiting to send'}
        subtitle={waiting ? (error ?? undefined) : undefined}
        value={waiting ? (busy ? 'Sending' : 'Send now') : undefined}
        noChevron={!waiting}
        disabled={busy}
        onPress={
          waiting
            ? () =>
                run(async () => {
                  const r = await flushOutbox();
                  return r.left ? `${r.sent} sent, ${r.left} still waiting: ${r.error}` : `${r.sent} sent.`;
                })
            : undefined
        }
      />
      {waiting ? (
        <ListRow icon="export-variant" iconColour="blue" title="Share the waiting files" subtitle="By email, Files or AirDrop" disabled={busy} onPress={() => run(async () => `${await shareOutbox()} shared.`)} />
      ) : null}
      {cars.length ? (
        <ListRow
          icon="car-search"
          iconColour="indigo"
          title="Send each car's saved findings"
          subtitle={`What ${cars.length === 1 ? 'your car has' : `your ${cars.length} cars have`} saved: modules, sensors, settings`}
          disabled={busy}
          onPress={() =>
            run(async () => {
              const out: string[] = [];
              for (const v of cars) {
                const r = await sendBack('saved', v.vin, {
                  car: { brand: v.brand, model: v.model, year: v.year, platform: v.platform, group: v.group },
                  learnRun: v.learnRun,
                  knowledge: v.knowledge,
                  aiItems: v.aiItems,
                  aiSensors: v.aiSensors,
                  sensorsFound: v.sensorsFound,
                  sensorScan: v.sensorScan,
                  modulesSeen: v.modulesSeen,
                  deepFound: v.deepFound,
                  codingBackup: v.codingBackup,
                  ids: v.ids,
                  // Values found by Discover and Learn my car, kept in their own store.
                  discovery: await loadDiscovery(v.vin).catch(() => null),
                });
                out.push(`${v.nickname || v.model || v.brand}: ${r.via === 'github' ? 'sent' : 'saved to send later'}`);
              }
              return out.join('. ') + '.';
            })
          }
        />
      ) : null}
      {note ? <Notice text={note} /> : null}
    </>
  );
}

function AutoSendRow() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    canSendAutomatically().then(setOn);
  }, []);
  return <ListRow first icon={on ? 'check-circle' : 'information-outline'} iconColour={on ? 'green' : 'grey'} title="Automatic sending" value={on == null ? '' : on ? 'On' : 'Not set up'} noChevron />;
}

// A key typed by the owner: shown masked once saved, kept in the keychain.
function SecretRow({ name, label, placeholder, first }: { name: SecretName; label: string; placeholder: string; first?: boolean }) {
  const t = useTheme();
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    getOwnSecret(name).then((v) => setSaved(!!v));
  }, [name]);
  if (!saved && isBuiltIn(name) && !draft) {
    return <ListRow first={first} icon="lock-outline" iconColour="green" title={label} subtitle="Built into this app. Paste one here to use your own." noChevron />;
  }
  if (saved) {
    return (
      <>
      <ListRow
        first={first}
        icon="lock-outline"
        iconColour="green"
        title={label}
        subtitle="Saved on this phone"
        value="Remove"
        onPress={() => setConfirmRemove(true)}
      />
      <ConfirmSheet
        visible={confirmRemove}
        title={`Remove your ${label}?`}
        lines={['Features that need it stop working until you paste one again.']}
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={async () => {
          setConfirmRemove(false);
          await setSecret(name, null);
          setSaved(false);
        }}
      />
      </>
    );
  }
  return (
    <View style={[styles.row, { borderColor: t.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
      <Text style={[type.body, { color: t.text }]}>{label}</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={async () => {
          if (!draft.trim()) return;
          await setSecret(name, draft.trim());
          setDraft('');
          setSaved(true);
        }}
        onBlur={async () => {
          if (!draft.trim()) return;
          await setSecret(name, draft.trim());
          setDraft('');
          setSaved(true);
        }}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        style={[type.body, styles.inline, { color: t.text, backgroundColor: t.sunken }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flex: 1, textAlign: 'right', borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  pad: { padding: space.lg },
});
