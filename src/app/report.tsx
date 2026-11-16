import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Mascot } from '../brand/Mascot';
import { extrasFor, formatExtra } from '../obd/extras';
import { loadHistory } from '../history';
import { useSettings } from '../settings';
import { useConnection } from '../state';
import { space, type, useTheme } from '../theme';
import { Button, GlowCard, Group, ListRow, NeedsConnection, Notice, Screen, success } from '../ui';
import { useGarage, vehicleTitle } from '../vehicle/garage';
import { SECTIONS } from '../help';
import { faultLabel } from '../diag/faults';
import { useLastScan, when } from '../components/LastScan';

const odometer = (km: number, miles: boolean) => (miles ? `${Math.round(km / 1.609344).toLocaleString('en-GB')} miles` : `${Math.round(km).toLocaleString('en-GB')} km`);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A one-page health report as a PDF: for an MOT, a sale or a garage visit.
export default function Report() {
  const t = useTheme();
  const conn = useConnection();
  const garage = useGarage();
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = conn.vehicle;
  const client = conn.client;
  const info = conn.info;
  // The check History holds, the same one the Car tab counts.
  const last = useLastScan(v?.vin);

  if (!v || !client || !info) {
    return (
      <Screen>
        <NeedsConnection title="Connect your car to make a health report" />
      </Screen>
    );
  }

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const codes = await client.readFaultCodes();
      const volts = await client.batteryVoltage();
      const distance = extrasFor(v.group).filter((e) => e.category === 'Distance');
      const odo = await client.readExtras(distance).catch(() => ({}) as Record<string, number>);
      const odoRows = distance.filter((e) => odo[e.id] != null).map((e) => [e.label, formatExtra(e, odo[e.id], settings)]);
      const firstOdo = distance.find((e) => odo[e.id] != null);
      if (firstOdo) await garage.update(v.vin, { odometerKm: odo[firstOdo.id], odometerAt: Date.now() });
      // Each fault of the last scan with its module and meaning.
      const lastFaults = last?.faults ?? (await loadHistory(v.vin)).find((e) => e.kind === 'scan')?.faults ?? [];
      const checked = v.lastCheckedAt ? new Date(v.lastCheckedAt).toLocaleString('en-GB') : null;
      const obd = [...new Set([...codes.stored, ...codes.pending, ...codes.permanent])];
      const row = (k: string, val: string) => `<tr><th>${esc(k)}</th><td>${esc(val)}</td></tr>`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:32px;font-size:12px;line-height:1.4}
        h1{font-size:22px;margin:0 0 4px} h2{font-size:14px;margin:22px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}
        table{border-collapse:collapse;width:100%} th{text-align:left;width:40%;font-weight:600;padding:3px 6px 3px 0;vertical-align:top} td{padding:3px 0}
        .ok{font-weight:600} .bad{font-weight:600} .small{font-size:10px}
      </style></head><body>
        <h1>${esc(vehicleTitle(v))}</h1>
        <div>VIN ${esc(v.vin)} · Report made ${esc(new Date().toLocaleString('en-GB'))} with Caristini</div>
        <h2>Car</h2><table>
          ${row('Make and model', `${v.brand} ${v.model}`.trim())}
          ${v.year ? row('Model year', String(v.year)) : ''}
          ${v.fuel ? row('Fuel', v.fuel) : ''}
          ${odoRows.map(([k, val]) => row(k, val)).join('')}
          ${volts != null ? row('Voltage at the diagnostic port', `${volts.toFixed(1)} V`) : ''}
        </table>
        <h2>Engine light and emissions codes</h2><table>
          ${row('Engine warning light', info.milOn ? 'On' : 'Off')}
          ${row('Emissions codes', obd.length ? obd.join(', ') : 'None')}
        </table>
        <h2>All control modules</h2><table>
          ${checked ? row('Last full health check', checked) : row('Last full health check', 'Not run yet')}
          ${checked && !lastFaults.length ? row('Faults found then', v.lastCodes.length ? [...new Set(v.lastCodes)].join(', ') : 'None') : ''}
        </table>
        ${lastFaults.length ? `<table>${lastFaults.map((f) => row(`${f.module} · ${f.code}`, faultLabel(f) ?? 'Meaning not in the library')).join('')}</table>` : ''}
        <h2>Emissions self-tests</h2><table>
          ${info.monitors.map((m) => row(m.name, m.state === 'complete' ? 'Complete' : 'Not yet run')).join('') || row('Self-tests', 'Not reported')}
        </table>
        <p class="small">Read from the car's diagnostic port by the owner. This is not an MOT test or a garage inspection.</p>
      </body></html>`;
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Health report', UTI: 'com.adobe.pdf' });
      }
      success();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <GlowCard tone="brand" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}>
        <Mascot mood={busy ? 'scanning' : 'happy'} size={88} />
        <View style={{ flex: 1 }}>
          <Text style={[type.sub, { color: t.muted }]}>A one-page PDF of this car: odometer, engine warning light, faults, emissions self-tests and battery. Handy for an MOT, a sale or a garage.</Text>
        </View>
      </GlowCard>
      {error ? <Notice tone="danger" icon="alert-circle-outline" text={error} /> : null}
      <Group header="Included" help={SECTIONS.reportIncluded} footer={last ? undefined : "Run a health check first so the report lists every module's faults."}>
        {last ? (
          <ListRow first title="Faults" value={`${last.faults?.length ?? 0} (from ${when(last.at)} check)`} noChevron />
        ) : (
          <ListRow first title="Last health check" value="Not run yet" noChevron />
        )}
        <ListRow title="Odometer" value={v.odometerKm == null ? 'Read for the PDF' : odometer(v.odometerKm, settings.speed === 'mph')} noChevron />
        <ListRow title="Engine warning light" value={info.milOn ? 'On' : 'Off'} noChevron />
        <ListRow title="Emissions self-tests" value={`${info.monitors.filter((m) => m.state === 'complete').length} of ${info.monitors.length} complete`} noChevron />
        <ListRow title="Battery" value={v.battery ? `${v.battery.volts.toFixed(1)} V last time; read again for the PDF` : 'Read for the PDF'} noChevron />
      </Group>
      <Button label="Make PDF" icon="file-document-outline" busy={busy} disabled={busy} onPress={make} />
    </Screen>
  );
}
