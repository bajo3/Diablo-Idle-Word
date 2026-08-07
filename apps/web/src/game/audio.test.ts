import { describe, expect, it } from 'vitest';

import { AUDIO_BUS_NAMES, GameAudioMixer, toneForCombatSound } from './audio';

describe('game audio contract', () => {
  it('exposes the five independent buses', () => {
    expect(AUDIO_BUS_NAMES).toEqual(['master', 'music', 'ambience', 'sfx', 'ui']);
  });

  it('keeps combat tones deterministic and on the effects bus', () => {
    expect(toneForCombatSound('critical')).toEqual({
      frequency: 540,
      durationMs: 120,
      bus: 'sfx',
    });
    expect(toneForCombatSound('heal').frequency).toBeGreaterThan(
      toneForCombatSound('death').frequency,
    );
  });

  it('exposes bounded diagnostics without constructing audio before user gesture', () => {
    const mixer = new GameAudioMixer({
      sound: true,
      music: true,
      reducedMotion: false,
      masterVolume: 1,
      musicVolume: 1,
      ambienceVolume: 1,
      sfxVolume: 1,
      uiVolume: 1,
    });
    expect(mixer.diagnostics()).toEqual({
      activeTones: 0,
      peakTones: 0,
      dedupeKeys: 0,
      contextState: 'uninitialized',
    });
    mixer.destroy();
  });

  it('makes teardown idempotent so route changes cannot leak a music loop', () => {
    const mixer = new GameAudioMixer({
      sound: true,
      music: true,
      reducedMotion: false,
      masterVolume: 1,
      musicVolume: 1,
      ambienceVolume: 1,
      sfxVolume: 1,
      uiVolume: 1,
    });
    mixer.destroy();
    mixer.destroy();
    expect(mixer.diagnostics()).toMatchObject({
      activeTones: 0,
      contextState: 'uninitialized',
    });
  });
});
