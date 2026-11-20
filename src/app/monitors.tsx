// Drive monitors hub: one entry point (Car tab) for the monitor tools. Only
// the tools that work on the connected car are listed (src/monitors/hub.ts).
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { SECTIONS } from '../help';
import { DriveTool, driveTools } from '../monitors/hub';
import { knockSupport } from '../monitors/knock';
import { SECOND_BUS_NOTICE } from '../obd/msCan';
import { useConnection } from '../state';
import { Group, IconName, ListRow, Notice, Screen } from '../ui';

export default function Monitors() {
  const conn = useConnection();
  const v = conn.vehicle;
  const diesel = !!(conn.info?.diesel || v?.fuel === 'Diesel');
  const knock = knockSupport(v, diesel);
  // Without a car every tool is listed, so the page still says what it offers.
  const tools: readonly DriveTool[] = v ? driveTools(v, diesel) : ['knock', 'dpf', 'trip'];
  const showKnock = tools.includes('knock') || tools.includes('timing');
  const [stn, setStn] = useState<boolean | null>(null);
  const secondBusCar = v?.group === 'ford' || v?.group === 'mazda';
  useEffect(() => {
    setStn(null);
    if (conn.client && secondBusCar) conn.client.canReachSecondBus().then(setStn, () => setStn(false));
  }, [conn.client, secondBusCar]);

  return (
    <Screen>
      {!conn.client ? <Notice icon="bluetooth-off" text="Not connected. Connect your car to use these tools." /> : null}
      <Group header="While you drive" footer="Only the tools that work on this car are listed. The performance timer is on the Car tab, under Driving.">
        {showKnock ? (
          <ListRow
            first
            icon={'piston' as IconName}
            iconColour="red"
            title="Knock and timing"
            value={!v ? undefined : knock.kind === 'groups' ? 'Per cylinder' : 'Timing only'}
            onPress={() => router.push('/knock')}
          />
        ) : null}
        {tools.includes('dpf') ? (
          <ListRow first={!showKnock} icon={'filter-outline' as IconName} iconColour="grey" title="DPF monitor" value={!v ? 'Diesels only' : undefined} onPress={() => router.push('/dpf')} />
        ) : null}
        <ListRow icon={'map-marker-distance' as IconName} iconColour="green" title="Trip computer" value="Distance and fuel" onPress={() => router.push('/trip')} />
      </Group>
      {secondBusCar && conn.client ? (
        <Group header="Second CAN bus" help={SECTIONS.monSecondBus}>
          <ListRow
            first
            icon={'lan' as IconName}
            iconColour="indigo"
            title={stn ? 'This adapter reaches it' : stn === false ? 'This adapter cannot reach it' : 'Checking the adapter…'}
            subtitle={stn ? 'The health check and part numbers include the modules on it.' : stn === false ? SECOND_BUS_NOTICE : undefined}
            onPress={() => router.push('/diagnostics')}
          />
        </Group>
      ) : null}
    </Screen>
  );
}
