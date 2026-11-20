// Which saved records of a car can be opened from its page and from the Car
// tab with no adapter, and what Save on Vehicle details writes. Pure.
import type { Vehicle } from './garage';

export type RecordRow = 'mot' | 'logs' | 'battery' | 'emissions';

// The MOT check opens for any saved car. Saved logs, Battery and Emissions
// self-tests open for the connected car, or with no adapter for the car used
// last (the logs page then lists every car's logs); a row shows only when its
// page has something to show.
export function recordRows(o: {
  carVin: string;
  // The car connected now, if any, and the car used last.
  connectedVin: string | null;
  lastVin: string | null;
  hasBattery: boolean;
  logs: number;
  hasEmissions: boolean;
}): RecordRow[] {
  const current = o.connectedVin === o.carVin;
  const shown = (o.connectedVin ?? o.lastVin) === o.carVin;
  const rows: RecordRow[] = ['mot'];
  if (current || (o.connectedVin == null && o.logs > 0)) rows.push('logs');
  if (shown && (current || o.hasBattery)) rows.push('battery');
  if (shown && (current || o.hasEmissions)) rows.push('emissions');
  return rows;
}

// Save on Vehicle details: only the fields that page edits, so anything saved
// on the car since the page opened (Parts and IDs, a health check) is kept.
export function detailsPatch(draft: Pick<Vehicle, 'nickname' | 'brand' | 'model' | 'group' | 'platform' | 'fuel'>, yearText: string): Partial<Vehicle> {
  return {
    nickname: draft.nickname,
    brand: draft.brand,
    model: draft.model,
    year: /^\d{4}$/.test(yearText) ? Number(yearText) : null,
    group: draft.group,
    platform: draft.platform,
    fuel: draft.fuel,
    edited: true,
  };
}
