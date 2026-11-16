// Data logger: what can be recorded on this car, and the recording loop.
//
// Reads use the same paths Live data uses: standard OBD values through
// readLiveMany, maker values through readSensors, older VW measuring groups
// through readMeasuringBlock. All of them only read; nothing is written to the
// car. The loop reads as fast as the adapter answers and lets the scheduler
// share adapter time between the sources (see scheduler.ts).
import type { ElmClient } from '../obd/elm';
import { groupLabels } from '../data/groupLabels';
import type { ModuleDef } from '../obd/modules';
import { LivePid, PidGroup } from '../obd/pids';
import { categoryOf, sensorId, SensorRow, sensorsForCar, unitOf } from '../obd/sensors';
import { LinkLost } from '../obd/transport';
import type { Vehicle } from '../vehicle/garage';
import { ARMED, AutoRule, AutoState, stepAuto, TRIGGER_PID } from './auto';
import { gpsFields, gpsSource, GpsSource } from './gps';
import { formatDuration, groupKey, LogBuilder, LogChannel, logId, LogStart, LogSummary, makerKey, obdKey, sourceOf, sourcesFor, summarise } from './format';
import { RateMeter, SampleScheduler } from './scheduler';
import { saveLog } from './store';

// ---------------------------------------------------------------------------
// What this car can record
// ---------------------------------------------------------------------------

export interface ChannelOption {
  channel: LogChannel;
  // Section in the value picker.
  section: string;
  pid?: LivePid;
  sensor?: SensorRow;
  block?: { def: ModuleDef; group: number; field: number };
}

const PID_SECTION: Record<PidGroup, string> = {
  Engine: 'Standard: engine',
  Fuel: 'Standard: fuel',
  'Air and exhaust': 'Standard: air and exhaust',
  Temperatures: 'Standard: temperatures',
  Electrical: 'Standard: electrical',
  'Since codes cleared': 'Standard: since codes cleared',
};

function sensorDecimals(r: SensorRow): number {
  const step = (r.m ?? 1) / (r.v ?? 1);
  if (Number.isInteger(step)) return 0;
  return step >= 0.1 ? 1 : 2;
}

const UNIT_DECIMALS: Record<string, number> = { rpm: 0, '°C': 0, 'km/h': 0, mbar: 0, km: 0, count: 0, raw: 0, V: 2, ms: 2 };

export async function channelOptions(client: ElmClient, v: Vehicle | null): Promise<ChannelOption[]> {
  const out: ChannelOption[] = [];
  const pids = await client.livePidsForCar().catch(() => [] as LivePid[]);
  for (const p of pids) {
    out.push({ channel: { key: obdKey(p.pid), source: 'obd', label: p.label, unit: p.unit, decimals: p.decimals }, section: PID_SECTION[p.group], pid: p });
  }
  if (!v || !client.supportsModules) return out;

  // Maker values Sensor search found on this car, numbers only.
  const found = new Set(v.sensorsFound ?? []);
  for (const r of sensorsForCar(v)) {
    if (!found.has(`${r.h}-${r.d}`) || r.map || r.u === 'yesno') continue;
    out.push({
      channel: { key: makerKey(sensorId(r)), source: 'maker', label: r.n, unit: unitOf(r), decimals: sensorDecimals(r) },
      section: `Maker: ${categoryOf(r).toLowerCase()}`,
      sensor: r,
    });
  }

  // Older VW measuring groups Learn my car found, numbers only.
  for (const [moduleId, groups] of Object.entries(v.groupsFound ?? {})) {
    const def = client.moduleById(moduleId);
    if (!def) continue;
    for (const [g, units] of Object.entries(groups)) {
      const group = Number(g);
      const names = groupLabels(def.code, group);
      units.forEach((unit, field) => {
        if (unit === 'bits' || unit === '') return;
        const name = names?.[field];
        out.push({
          channel: {
            key: groupKey(moduleId, group, field),
            source: 'group',
            label: name ? `${name} (group ${group})` : `${def.name} group ${group} field ${field + 1}`,
            unit,
            decimals: UNIT_DECIMALS[unit] ?? 1,
          },
          section: `Older VW: ${def.name}, group ${group}`,
          block: { def, group, field },
        });
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

export type Phase = 'idle' | 'armed' | 'recording';

export interface SourceRate {
  id: string;
  label: string;
  rate: number | null;
  resting: boolean;
}

export interface LoggerStatus {
  phase: Phase;
  start: LogStart | null;
  elapsedMs: number;
  rows: number;
  // Reads a second, all sources together.
  rate: number | null;
  sources: SourceRate[];
  // Newest reading of each channel, by key.
  last: Record<string, number>;
  markers: number;
  // Newest trigger reading while waiting to start.
  trigger: number | null;
  saved: LogSummary | null;
  message: string | null;
}

const IDLE: LoggerStatus = { phase: 'idle', start: null, elapsedMs: 0, rows: 0, rate: null, sources: [], last: {}, markers: 0, trigger: null, saved: null, message: null };

export function sourceLabel(id: string, options: ChannelOption[]): string {
  if (id === 'obd') return 'Standard values';
  if (id === 'maker') return 'Maker values';
  const o = options.find((x) => x.block && sourceOf(x.channel.key) === id);
  return o?.block ? `${o.block.def.name}, group ${o.block.group}` : 'Older VW group';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class LoggerSession {
  private status: LoggerStatus = IDLE;
  private options: ChannelOption[] = [];
  private keys: string[] = [];
  private rule: AutoRule | null = null;
  private looping = false;
  private disposed = false;
  private builder: LogBuilder | null = null;
  private plan: ChannelOption[] = [];
  private startedAt = 0;
  // When the log in progress was last saved, so a crash or iOS closing the
  // app loses at most about 45 seconds.
  private checkpointAt = 0;
  // Saves run one after another, so a checkpoint never lands after the final save.
  private saving: Promise<void> = Promise.resolve();
  private start: LogStart = 'manual';
  private auto: AutoState = ARMED;
  // After a manual stop the trigger must drop below its value once before it can start again.
  private needBelow = false;
  private scheduler: SampleScheduler | null = null;
  private meters = new Map<string, RateMeter>();
  private total = new RateMeter();
  private last: Record<string, number> = {};
  private emitted = 0;
  private triedTp20 = false;
  private gps: GpsSource | null = null;

  constructor(
    private client: ElmClient,
    private car: { vin: string; title: string },
    private onStatus: (s: LoggerStatus) => void,
  ) {}

  configure(options: ChannelOption[], keys: string[], rule: AutoRule): void {
    this.options = options;
    this.keys = keys;
    const wasOn = !!this.rule?.on;
    this.rule = rule;
    if (this.status.phase === 'recording') return;
    if (rule.on && !wasOn) this.arm();
    else if (!rule.on && this.status.phase === 'armed') this.set({ phase: 'idle', trigger: null }, true);
  }

  get phase(): Phase {
    return this.status.phase;
  }

  private triggerOption(): ChannelOption | undefined {
    if (!this.rule) return undefined;
    const pid = TRIGGER_PID[this.rule.kind];
    return this.options.find((o) => o.pid?.pid === pid);
  }

  // True when auto-start can work on this car (it reports the trigger value).
  canAuto(): boolean {
    return !!this.triggerOption();
  }

  private set(patch: Partial<LoggerStatus>, now = false): void {
    this.status = { ...this.status, ...patch };
    const t = Date.now();
    if (now || t - this.emitted > 200) {
      this.emitted = t;
      this.onStatus(this.status);
    }
  }

  private arm(): void {
    this.auto = ARMED;
    this.set({ phase: 'armed', start: null, trigger: null, message: null }, true);
    this.loop();
  }

  record(): void {
    if (this.status.phase === 'recording') return;
    this.begin('manual');
    this.loop();
  }

  private begin(start: LogStart, firstValues?: Map<string, number | null>): void {
    const chosen = this.options.filter((o) => this.keys.includes(o.channel.key));
    const trig = this.rule?.on ? this.triggerOption() : undefined;
    if (trig && !chosen.includes(trig)) chosen.unshift(trig);
    this.plan = chosen;
    this.builder = new LogBuilder(chosen.map((o) => o.channel));
    this.startedAt = Date.now();
    this.start = start;
    this.scheduler = new SampleScheduler(sourcesFor(chosen.map((o) => o.channel.key)));
    this.meters = new Map(this.scheduler.ids.map((id) => [id, new RateMeter()]));
    this.total = new RateMeter();
    this.last = {};
    this.auto = start === 'auto' ? { phase: 'recording', belowSince: null } : ARMED;
    this.gps = gpsSource();
    this.gps?.start().catch(() => false);
    if (firstValues) this.builder.add(0, firstValues);
    this.set({ phase: 'recording', start, elapsedMs: 0, rows: this.builder.rows.length, rate: null, sources: [], last: {}, markers: 0, saved: null, message: null }, true);
  }

  mark(): number | null {
    if (!this.builder || this.status.phase !== 'recording') return null;
    const m = this.builder.mark(Date.now() - this.startedAt);
    this.set({ markers: this.builder.markers.length }, true);
    return m.n;
  }

  // Stop button: save the log. With auto-start on, wait for the next trigger.
  async stop(): Promise<void> {
    if (this.status.phase !== 'recording') return;
    this.needBelow = !!this.rule?.on;
    await this.finish(null);
  }

  private async finish(message: string | null): Promise<void> {
    const b = this.builder;
    this.builder = null;
    this.gps?.stop();
    const gpsName = this.gps?.name;
    this.gps = null;
    const next: Phase = this.rule?.on && !this.disposed ? 'armed' : 'idle';
    this.auto = ARMED;
    if (!b || !b.rows.length) {
      this.set({ phase: next, start: null, trigger: null, message: message ?? 'Nothing was recorded: the car gave no values.' }, true);
      return;
    }
    const log = b.finish({
      id: logId(this.startedAt),
      vin: this.car.vin,
      car: this.car.title,
      startedAt: this.startedAt,
      durationMs: Math.max(b.rows[b.rows.length - 1].t, Date.now() - this.startedAt),
      start: this.start,
      gps: gpsName && b.rows.some((r) => r.lat != null) ? { source: gpsName } : undefined,
    });
    // The screen shows the new state at once; the file is written after.
    this.set({ phase: next, start: null, trigger: null }, true);
    try {
      await this.saving;
      await saveLog(log);
      this.set({ saved: summarise(log), message: message ?? `Saved ${formatDuration(log.durationMs)} log.` }, true);
    } catch (e) {
      this.set({ message: `The log could not be saved: ${e instanceof Error ? e.message : String(e)}` }, true);
    }
  }

  // The screen is closing or the car disconnected: save what was recorded.
  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.status.phase === 'recording') await this.finish(null);
    this.status = { ...this.status, phase: 'idle' };
  }

  private async loop(): Promise<void> {
    if (this.looping) return;
    this.looping = true;
    try {
      while (!this.disposed && this.status.phase !== 'idle') {
        if (this.client.moduleBusy) {
          // Another screen is talking to a module: wait, rather than draw gaps.
          await this.client.whenIdle();
          continue;
        }
        if (this.status.phase === 'armed') await this.watchTrigger();
        else await this.readNext();
      }
    } catch (e) {
      const lost = e instanceof LinkLost;
      if (this.status.phase === 'recording') await this.finish(lost ? 'The adapter connection dropped. The log was saved up to that point.' : null);
      this.set({ phase: 'idle', message: lost ? 'The adapter connection dropped.' : this.status.message }, true);
    } finally {
      this.looping = false;
    }
  }

  // Waiting for auto-start: read only the trigger value, as fast as it comes.
  private async watchTrigger(): Promise<void> {
    const trig = this.triggerOption();
    if (!trig?.pid || !this.rule) {
      this.set({ phase: 'idle', message: 'This car does not report the value auto-start watches.' }, true);
      return;
    }
    const got = await this.client.readLiveMany([trig.pid]);
    const v = got.get(trig.pid.pid) ?? null;
    if (this.status.phase !== 'armed' || this.disposed) return;
    this.set({ trigger: v });
    if (v == null) {
      await sleep(500);
      return;
    }
    if (this.needBelow) {
      if (v <= this.rule.above) this.needBelow = false;
      return;
    }
    const step = stepAuto(this.rule, this.auto, v, Date.now());
    this.auto = step.state;
    if (step.action === 'start') this.begin('auto', new Map([[trig.channel.key, v]]));
  }

  private async readNext(): Promise<void> {
    const s = this.scheduler;
    const b = this.builder;
    if (!s || !b) return;
    const id = s.next(Date.now());
    if (!id) {
      await sleep(100);
      return;
    }
    const t0 = Date.now();
    const values = await this.read(id);
    const t1 = Date.now();
    if (this.builder !== b || this.disposed) return;
    const any = [...values.values()].some((x) => x != null);
    s.record(id, t0, t1, any);
    const at = (t0 + t1) / 2;
    if (b.add(at - this.startedAt, values, gpsFields(this.gps?.latest() ?? null, at))) {
      this.total.tick(t1);
      this.meters.get(id)?.tick(t1);
    }
    for (const [k, x] of values) if (x != null) this.last[k] = x;

    // Auto-stop, for a log auto-start began.
    if (this.start === 'auto' && this.rule?.on) {
      const trig = this.triggerOption();
      if (trig && values.has(trig.channel.key)) {
        const step = stepAuto(this.rule, this.auto, values.get(trig.channel.key) ?? null, t1);
        this.auto = step.state;
        if (step.action === 'stop') {
          await this.finish(null);
          return;
        }
      }
    }
    if (b.full) {
      await this.finish('The log reached its length limit and was saved.');
      return;
    }
    if (t1 - Math.max(this.checkpointAt, this.startedAt) >= 45000 && b.rows.length) {
      this.checkpointAt = t1;
      // Same id as the final save, which replaces it.
      const snap = b.finish({ id: logId(this.startedAt), vin: this.car.vin, car: this.car.title, startedAt: this.startedAt, durationMs: t1 - this.startedAt, start: this.start });
      const copy = { ...snap, rows: [...snap.rows], markers: [...snap.markers] };
      this.saving = this.saving.then(() => saveLog(copy)).catch(() => undefined);
    }
    this.set({
      elapsedMs: t1 - this.startedAt,
      rows: b.rows.length,
      rate: this.total.rate(),
      sources: s.ids.map((x) => ({ id: x, label: sourceLabel(x, this.options), rate: this.meters.get(x)?.rate() ?? null, resting: !!s.stats(x)?.resting })),
      last: { ...this.last },
    });
  }

  // One read of one source. Missing answers come back as no value.
  private async read(id: string): Promise<Map<string, number | null>> {
    const out = new Map<string, number | null>();
    const plan = this.plan.filter((o) => sourceOf(o.channel.key) === id);
    if (id === 'obd') {
      const pids = plan.map((o) => o.pid!).filter(Boolean);
      const got = await this.client.readLiveMany(pids);
      for (const o of plan) out.set(o.channel.key, got.get(o.pid!.pid) ?? null);
      return out;
    }
    if (id === 'maker') {
      const rows = plan.map((o) => o.sensor!).filter(Boolean);
      const got = await this.client.readSensors(rows, () => this.disposed || this.status.phase !== 'recording').catch((e) => {
        if (e instanceof LinkLost) throw e;
        return {} as Record<string, number | string>;
      });
      for (const o of plan) {
        const x = got[sensorId(o.sensor!)];
        out.set(o.channel.key, typeof x === 'number' && Number.isFinite(x) ? x : null);
      }
      return out;
    }
    const first = plan[0]?.block;
    if (!first) return out;
    let cells = await this.client.readMeasuringBlock(first.def, first.group).catch((e) => {
      if (e instanceof LinkLost) throw e;
      return null;
    });
    if (cells == null && !this.triedTp20) {
      // This connection has not reached the older modules yet: find them once.
      this.triedTp20 = true;
      await this.client.findTp20Modules().catch(() => []);
      cells = await this.client.readMeasuringBlock(first.def, first.group).catch(() => null);
    }
    for (const o of plan) {
      const c = cells?.[o.block!.field];
      out.set(o.channel.key, c && typeof c.value === 'number' && Number.isFinite(c.value) ? c.value : null);
    }
    return out;
  }
}

export const IDLE_STATUS = IDLE;
