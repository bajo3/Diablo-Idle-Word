import type { GameSettings } from '../settings';

export type AudioBus = 'master' | 'music' | 'ambience' | 'sfx' | 'ui';
export type CombatSound = 'activation' | 'hit' | 'critical' | 'heal' | 'death';

export const AUDIO_BUS_NAMES: readonly AudioBus[] = ['master', 'music', 'ambience', 'sfx', 'ui'];

export type AudioDiagnostics = Readonly<{
  activeTones: number;
  peakTones: number;
  dedupeKeys: number;
  contextState: AudioContextState | 'uninitialized';
}>;

/** Pure mapping keeps audio balance inspectable without constructing an AudioContext. */
export function toneForCombatSound(sound: CombatSound): Readonly<{
  frequency: number;
  durationMs: number;
  bus: AudioBus;
}> {
  switch (sound) {
    case 'activation':
      return { frequency: 220, durationMs: 90, bus: 'sfx' };
    case 'hit':
      return { frequency: 320, durationMs: 80, bus: 'sfx' };
    case 'critical':
      return { frequency: 540, durationMs: 120, bus: 'sfx' };
    case 'heal':
      return { frequency: 660, durationMs: 160, bus: 'sfx' };
    case 'death':
      return { frequency: 120, durationMs: 240, bus: 'sfx' };
  }
}

type AudioContextLike = AudioContext;
type AudioContextConstructor = new () => AudioContextLike;

/**
 * Small Web Audio adapter for the prototype. It deliberately owns no gameplay state: callers send
 * event IDs and the mixer deduplicates presentation retries. All nodes are short-lived except the
 * bus graph and the music timer, which are released by destroy().
 */
export class GameAudioMixer {
  private context: AudioContextLike | undefined;
  private readonly buses = new Map<AudioBus, GainNode>();
  private readonly seen = new Set<string>();
  private musicTimer: ReturnType<typeof setInterval> | undefined;
  private musicStep = 0;
  private settings: GameSettings;
  private activeTones = 0;
  private peakTones = 0;

  public constructor(settings: GameSettings) {
    this.settings = settings;
  }

  public unlock(): void {
    try {
      if (this.context === undefined) {
        const browserGlobal = globalThis as typeof globalThis & {
          webkitAudioContext?: AudioContextConstructor;
        };
        const Context = browserGlobal.AudioContext ?? browserGlobal.webkitAudioContext;
        if (Context === undefined) return;
        this.context = new Context();
        this.createBusGraph(this.context);
      }
      void this.context.resume();
      this.syncMusicLoop();
    } catch {
      // Browsers may reject AudioContext construction until a user gesture. Gameplay continues.
    }
  }

  public setSettings(settings: GameSettings): void {
    this.settings = settings;
    this.applyBusVolumes();
    this.syncMusicLoop();
  }

  public playCombat(sound: CombatSound, eventId: string): void {
    const key = `combat:${eventId}:${sound}`;
    if (!this.markOnce(key) || !this.settings.sound || this.settings.sfxVolume <= 0) return;
    this.unlock();
    const tone = toneForCombatSound(sound);
    this.playTone(
      tone.frequency,
      tone.durationMs,
      tone.bus,
      sound === 'critical' ? 'square' : 'triangle',
    );
    if (sound === 'critical') this.playTone(810, 70, 'sfx', 'sine');
  }

  public playUi(eventId: string): void {
    if (!this.markOnce(`ui:${eventId}`) || !this.settings.sound || this.settings.uiVolume <= 0)
      return;
    this.unlock();
    this.playTone(420, 55, 'ui', 'sine');
  }

  public destroy(): void {
    if (this.musicTimer !== undefined) {
      globalThis.clearInterval(this.musicTimer);
      this.musicTimer = undefined;
    }
    void this.context?.close().catch(() => {
      // Firefox may reject a context close when the document is already navigating away.
    });
    this.context = undefined;
    this.activeTones = 0;
    this.buses.clear();
    this.seen.clear();
  }

  /** Bounded presentation counters for smoke/performance probes; never gameplay authority. */
  public diagnostics(): AudioDiagnostics {
    return {
      activeTones: this.activeTones,
      peakTones: this.peakTones,
      dedupeKeys: this.seen.size,
      contextState: this.context?.state ?? 'uninitialized',
    };
  }

  private createBusGraph(context: AudioContextLike): void {
    const destination = context.destination;
    const master = context.createGain();
    master.connect(destination);
    this.buses.set('master', master);
    for (const bus of ['music', 'ambience', 'sfx', 'ui'] as const) {
      const gain = context.createGain();
      gain.connect(master);
      this.buses.set(bus, gain);
    }
    this.applyBusVolumes();
  }

  private applyBusVolumes(): void {
    const now = this.context?.currentTime ?? 0;
    this.buses.get('master')?.gain.setTargetAtTime(this.settings.masterVolume, now, 0.015);
    this.buses
      .get('music')
      ?.gain.setTargetAtTime(this.settings.music ? this.settings.musicVolume : 0, now, 0.015);
    this.buses
      .get('ambience')
      ?.gain.setTargetAtTime(this.settings.sound ? this.settings.ambienceVolume : 0, now, 0.015);
    this.buses
      .get('sfx')
      ?.gain.setTargetAtTime(this.settings.sound ? this.settings.sfxVolume : 0, now, 0.015);
    this.buses
      .get('ui')
      ?.gain.setTargetAtTime(this.settings.sound ? this.settings.uiVolume : 0, now, 0.015);
  }

  private syncMusicLoop(): void {
    const shouldPlay =
      this.context !== undefined && this.settings.music && this.settings.musicVolume > 0;
    if (!shouldPlay) {
      if (this.musicTimer !== undefined) {
        globalThis.clearInterval(this.musicTimer);
        this.musicTimer = undefined;
      }
      return;
    }
    if (this.musicTimer !== undefined) return;
    this.musicTimer = globalThis.setInterval(() => this.playMusicStep(), 620);
    this.playMusicStep();
  }

  private playMusicStep(): void {
    if (this.context === undefined || !this.settings.music) return;
    const notes = [110, 130.81, 146.83, 164.81, 146.83, 130.81, 98, 123.47];
    const note = notes[this.musicStep++ % notes.length]!;
    this.playTone(note, 260, 'music', 'sine', 0.12);
  }

  private playTone(
    frequency: number,
    durationMs: number,
    bus: AudioBus,
    type: OscillatorType,
    peak = 0.08,
  ): void {
    const context = this.context;
    const output = this.buses.get(bus);
    if (context === undefined || output === undefined) return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const end = now + durationMs / 1000;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(Math.max(0.0001, peak), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(output);
      let released = false;
      const release = (): void => {
        if (released) return;
        released = true;
        this.activeTones = Math.max(0, this.activeTones - 1);
      };
      this.activeTones += 1;
      this.peakTones = Math.max(this.peakTones, this.activeTones);
      oscillator.addEventListener('ended', release, { once: true });
      oscillator.start(now);
      oscillator.stop(end);
    } catch {
      this.activeTones = Math.max(0, this.activeTones - 1);
      // A failed presentation node must not interrupt combat or input.
    }
  }

  private markOnce(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > 500) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return true;
  }
}
