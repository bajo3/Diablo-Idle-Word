import { describe, expect, it } from 'vitest';

import { TrafficMetrics } from './traffic-metrics.js';

describe('traffic metrics', () => {
  it('counts UTF-8 messages and derives per-second rates', () => {
    const metrics = new TrafficMetrics();
    metrics.recordInbound('{"type":"MOVE_INTENT"}');
    metrics.recordOutbound('{"type":"INSTANCE_SNAPSHOT","text":"á"}', 'INSTANCE_SNAPSHOT');
    const snapshot = metrics.snapshot(2_000);
    expect(snapshot).toMatchObject({
      inboundMessages: 1,
      outboundMessages: 1,
      inboundMessagesPerSecond: 0.5,
      outboundMessagesPerSecond: 0.5,
      instanceSnapshots: 1,
    });
    expect(snapshot.inboundBytes).toBeGreaterThan(0);
    expect(snapshot.instanceSnapshotP95Bytes).toBe(snapshot.outboundBytes);
  });

  it('reports zero p95 for an empty window and resets counters', () => {
    const metrics = new TrafficMetrics();
    expect(metrics.snapshot(1_000)).toMatchObject({
      inboundMessages: 0,
      outboundMessages: 0,
      instanceSnapshotP95Bytes: 0,
      snapshotsDropped: 0,
    });
    metrics.recordOutbound('snapshot', 'INSTANCE_SNAPSHOT');
    metrics.reset();
    expect(metrics.snapshot(1_000).outboundMessages).toBe(0);
  });

  it('only reports events inside the requested observation window', () => {
    let now = 10_000;
    const metrics = new TrafficMetrics({ now: () => now });
    metrics.recordInbound('old', 8_000);
    metrics.recordInbound('new', 9_500);
    expect(metrics.snapshot(1_000)).toMatchObject({ inboundMessages: 1 });
    now = 11_000;
    expect(metrics.snapshot(1_000)).toMatchObject({ inboundMessages: 0 });
  });

  it('rejects a non-positive observation window', () => {
    expect(() => new TrafficMetrics().snapshot(0)).toThrow(/window must be positive/);
  });
});
