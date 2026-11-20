// Rows to a car's saved records that work with no adapter: the MOT check,
// saved logs, the last battery reading and the last emissions self-test read.
// Used on the car's page (Records) and on the Car tab when not connected.
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { loadEmissions } from '../diag/emissionsStore';
import { listLogs } from '../logger/store';
import { useConnection } from '../state';
import { TOOLS, ListRow } from '../ui';
import { useGarage, Vehicle } from '../vehicle/garage';
import { recordRows } from '../vehicle/records';
import { when } from './LastScan';

export function CarRecordRows({ v, first = false }: { v: Vehicle; first?: boolean }) {
  const conn = useConnection();
  const garage = useGarage();
  const [logs, setLogs] = useState(0);
  const [emissionsAt, setEmissionsAt] = useState<number | null>(null);
  // Read again each time the page comes back on screen.
  useFocusEffect(
    useCallback(() => {
      let on = true;
      listLogs(v.vin).then((l) => on && setLogs(l.length), () => undefined);
      loadEmissions(v.vin).then((e) => on && setEmissionsAt(e?.at ?? null), () => undefined);
      return () => {
        on = false;
      };
    }, [v.vin]),
  );
  const rows = recordRows({
    carVin: v.vin,
    connectedVin: conn.vehicle?.vin ?? null,
    lastVin: garage.vehicles[0]?.vin ?? null,
    hasBattery: !!v.battery,
    logs,
    hasEmissions: emissionsAt != null,
  });
  return (
    <>
      {rows.map((row, i) => {
        const isFirst = first && i === 0;
        if (row === 'mot') return <ListRow key={row} first={isFirst} icon="clipboard-list-outline" iconColour={TOOLS.mot.colour} title="MOT check" subtitle="The walk-round and the last read of the car" onPress={() => router.push({ pathname: '/mot', params: { vin: v.vin } })} />;
        if (row === 'logs') return <ListRow key={row} first={isFirst} icon="chart-line" iconColour={TOOLS.logger.colour} title="Saved logs" subtitle={logs ? `${logs} recording${logs === 1 ? '' : 's'} from the data logger, with charts` : 'Recordings from the data logger, with charts'} onPress={() => router.push('/logger')} />;
        if (row === 'battery') return <ListRow key={row} first={isFirst} icon="car-battery" iconColour={TOOLS.battery.colour} title="Battery" subtitle={v.battery ? `Last reading ${v.battery.volts.toFixed(2)} V, ${when(v.battery.at)}` : 'Battery test'} onPress={() => router.push('/battery')} />;
        return <ListRow key={row} first={isFirst} icon="clipboard-check-outline" iconColour={TOOLS.emissions.colour} title="Emissions self-tests" subtitle={emissionsAt != null ? `Last read ${when(emissionsAt)}` : 'Which self-tests have run'} onPress={() => router.push('/emissions-tests')} />;
      })}
    </>
  );
}
