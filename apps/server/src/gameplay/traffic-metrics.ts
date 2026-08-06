/**
 * Small in-memory network budget sampler for one server process.
 *
 * It intentionally stores bounded event metadata, not payloads or user identifiers. Callers
 * record UTF-8 byte lengths at the transport boundary; snapshots expose rates over the requested
 * observation window and a bounded p95 of instance snapshot sizes.
 */
export type TrafficMetricsSnapshot = Readonly<{
  windowMs: number;
  inboundMessages: number;
  outboundMessages: number;
  inboundBytes: number;
  outboundBytes: number;
  inboundMessagesPerSecond: number;
  outboundMessagesPerSecond: number;
  inboundBytesPerSecond: number;
  outboundBytesPerSecond: number;
  instanceSnapshots: number;
  instanceSnapshotP95Bytes: number;
  snapshotsDropped: number;
}>;

const SAMPLE_CAPACITY = 512;
const EVENT_CAPACITY = 8_192;

type TrafficEvent = Readonly<{
  atMs: number;
  bytes: number;
  type?: string;
}>;

export type TrafficMetricsOptions = Readonly<{
  now?: () => number;
}>;

export class TrafficMetrics {
  private readonly now: () => number;
  private readonly inboundEvents: TrafficEvent[] = [];
  private readonly outboundEvents: TrafficEvent[] = [];

  public constructor(options: TrafficMetricsOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  public recordInbound(message: string | Uint8Array, atMs = this.now()): void {
    appendEvent(this.inboundEvents, { atMs: validTimestamp(atMs), bytes: byteLength(message) });
  }

  public recordOutbound(message: string | Uint8Array, type?: string, atMs = this.now()): void {
    appendEvent(this.outboundEvents, {
      atMs: validTimestamp(atMs),
      bytes: byteLength(message),
      ...(type === undefined ? {} : { type }),
    });
  }

  public snapshot(windowMs: number, atMs = this.now()): TrafficMetricsSnapshot {
    const window = positiveWindow(windowMs);
    const now = validTimestamp(atMs);
    const fromMs = now - window;
    pruneBefore(this.inboundEvents, fromMs);
    pruneBefore(this.outboundEvents, fromMs);
    const inboundMessages = this.inboundEvents.length;
    const outboundMessages = this.outboundEvents.length;
    const inboundBytes = sumBytes(this.inboundEvents);
    const outboundBytes = sumBytes(this.outboundEvents);
    const snapshotEvents = this.outboundEvents.filter(
      (event) => event.type === 'INSTANCE_SNAPSHOT',
    );
    const snapshotSample = snapshotEvents.slice(-SAMPLE_CAPACITY).map((event) => event.bytes);
    const perSecond = (value: number): number => (value * 1000) / window;
    return {
      windowMs: window,
      inboundMessages,
      outboundMessages,
      inboundBytes,
      outboundBytes,
      inboundMessagesPerSecond: perSecond(inboundMessages),
      outboundMessagesPerSecond: perSecond(outboundMessages),
      inboundBytesPerSecond: perSecond(inboundBytes),
      outboundBytesPerSecond: perSecond(outboundBytes),
      instanceSnapshots: snapshotEvents.length,
      instanceSnapshotP95Bytes: percentile95(snapshotSample),
      snapshotsDropped: Math.max(0, snapshotEvents.length - snapshotSample.length),
    };
  }

  public reset(): void {
    this.inboundEvents.length = 0;
    this.outboundEvents.length = 0;
  }
}

function appendEvent(events: TrafficEvent[], event: TrafficEvent): void {
  events.push(event);
  if (events.length > EVENT_CAPACITY) events.splice(0, events.length - EVENT_CAPACITY);
}

function pruneBefore(events: TrafficEvent[], fromMs: number): void {
  const firstCurrent = events.findIndex((event) => event.atMs >= fromMs);
  if (firstCurrent > 0) events.splice(0, firstCurrent);
  else if (firstCurrent === -1) events.length = 0;
}

function sumBytes(events: readonly TrafficEvent[]): number {
  return events.reduce((total, event) => total + event.bytes, 0);
}

function byteLength(value: string | Uint8Array): number {
  return typeof value === 'string' ? new TextEncoder().encode(value).byteLength : value.byteLength;
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
}

function positiveWindow(value: number): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error('Traffic metric window must be positive.');
  return value;
}

function validTimestamp(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Traffic metric timestamp must be finite.');
  return value;
}
