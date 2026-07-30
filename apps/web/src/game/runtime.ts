import Phaser from 'phaser';

import {
  constrainKnockbackSweep,
  LocalCombatController,
  type CombatEvent,
} from './combat-controller';
import {
  combatAnimationKey,
  guardianCombatPresentation,
  validateGuardianCombatPresentation,
} from './combat-presentation';
import {
  localAssetManifest,
  validateAssetManifest,
  validateLoadedFrameCount,
  type AssetManifestEntry,
} from './assets';
import { motionFromInput, type Direction4, type LocalCharacterState } from './domain';
import { arcadeDebugEnabled, layerAnimationKey } from './presentation';

const TEST_WORLD = Object.freeze({ width: 1280, height: 720, margin: 24 });
const TEST_OBSTACLES = [
  [480, 220, 320, 32],
  [820, 450, 32, 280],
  [240, 560, 280, 32],
] as const;

export type RuntimeConnection = 'online' | 'offline' | 'degraded' | 'maintenance';
export type GameHudSnapshot = Readonly<{
  facing: Direction4;
  paused: boolean;
  connection: RuntimeConnection;
  health: number;
  maxHealth: number;
  fury: number;
  maxFury: number;
  cooldownRemainingMs: Readonly<Record<'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin', number>>;
  ironSkinActive: boolean;
}>;
export type GameRuntime = Readonly<{
  pause(): void;
  resume(): void;
  destroy(): void;
  setConnection(connection: RuntimeConnection): void;
  setDamageNumbers?(enabled: boolean): void;
}>;

class BootScene extends Phaser.Scene {
  public constructor() {
    super('boot');
  }
  public preload(): void {
    validateAssetManifest(localAssetManifest);
    validateGuardianCombatPresentation();
    for (const asset of localAssetManifest)
      this.load.spritesheet(asset.id, asset.path, { frameWidth: 64, frameHeight: 64 });
  }
  public create(): void {
    for (const asset of localAssetManifest)
      validateLoadedFrameCount(asset, this.textures.get(asset.id).frameTotal);
    this.scene.start('test');
  }
}

class FeedbackPool {
  private readonly impacts: Phaser.GameObjects.Arc[];
  private readonly numbers: Phaser.GameObjects.Text[];
  private impactIndex = 0;
  private numberIndex = 0;
  public constructor(private readonly scene: Phaser.Scene) {
    this.impacts = Array.from({ length: 32 }, () =>
      scene.add.circle(0, 0, 12, 0xf5d486, 0).setDepth(100),
    );
    this.numbers = Array.from({ length: 24 }, () =>
      scene.add
        .text(0, 0, '', {
          color: '#f5d486',
          fontSize: '15px',
          stroke: '#131713',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(101)
        .setVisible(false),
    );
  }
  public impact(
    x: number,
    y: number,
    amount: number,
    critical: boolean,
    showNumber: boolean,
  ): void {
    const circle = this.impacts[this.impactIndex++ % this.impacts.length]!;
    this.scene.tweens.killTweensOf(circle);
    circle
      .setPosition(x, y)
      .setFillStyle(critical ? 0xffd14a : 0xd5f1dc, 0.9)
      .setScale(0.45)
      .setAlpha(0.9)
      .setActive(true)
      .setVisible(true);
    const text = this.numbers[this.numberIndex++ % this.numbers.length]!;
    this.scene.tweens.killTweensOf(text);
    if (!showNumber) {
      text.setText('').setActive(false).setVisible(false);
    } else
      text
        .setPosition(x, y - 30)
        .setText(`${critical ? '¡' : ''}${amount}`)
        .setColor(critical ? '#ffd14a' : '#eaf6ed')
        .setActive(true)
        .setVisible(true)
        .setAlpha(1);
    this.scene.tweens.add({
      targets: circle,
      scale: 1.6,
      alpha: 0,
      duration: 180,
      onComplete: () => circle.setActive(false).setVisible(false),
    });
    if (showNumber)
      this.scene.tweens.add({
        targets: text,
        y: y - 56,
        alpha: 0,
        duration: 500,
        onComplete: () => text.setActive(false).setVisible(false),
      });
  }
  public destroy(): void {
    [...this.impacts, ...this.numbers].forEach((object) => object.destroy());
  }
}

class CombatAudio {
  private context: AudioContext | undefined;
  private readonly seen = new Set<string>();
  public unlock(): void {
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
    } catch {
      /* optional */
    }
  }
  public play(kind: 'activation' | 'hit' | 'critical', executionId: string): void {
    const key = `${executionId}:${kind}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    try {
      this.unlock();
      if (this.context === undefined) return;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.frequency.value = kind === 'critical' ? 540 : kind === 'hit' ? 320 : 220;
      gain.gain.setValueAtTime(0.035, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 0.08);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + 0.08);
    } catch {
      /* Audio is optional feedback and must never affect local combat. */
    }
  }
  public destroy(): void {
    void this.context?.close();
    this.context = undefined;
    this.seen.clear();
  }
}

class TestScene extends Phaser.Scene {
  private facing: Direction4 = 'down';
  private paused = false;
  private connection: RuntimeConnection = 'online';
  private player!: Phaser.Physics.Arcade.Sprite;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private shadow!: Phaser.GameObjects.Image;
  private layers: Phaser.GameObjects.Sprite[] = [];
  private state: LocalCharacterState = 'idle';
  private actionEndsAt = 0;
  private activeAbility: 'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin' | undefined;
  private pausedAt: number | undefined;
  private pausedDuration = 0;
  private readonly controller = new LocalCombatController(
    { now: () => this.combatNow() },
    {
      nextInt: (minimum, maximum) => Phaser.Math.Between(minimum, maximum),
      next: () => Math.random(),
    },
    constrainDummyKnockback,
  );
  private readonly dummyVisuals = new Map<string, Phaser.GameObjects.Arc>();
  private feedback!: FeedbackPool;
  private audio = new CombatAudio();
  private showDamageNumbers = true;
  private lastHudAt = -Infinity;
  private readonly suppressContextMenu = (event: Event) => event.preventDefault();
  public constructor(private readonly onHud: (snapshot: GameHudSnapshot) => void) {
    super('test');
  }
  public create(): void {
    for (const asset of localAssetManifest) createLayerAnimations(this, asset);
    this.physics.world.setBounds(0, 0, TEST_WORLD.width, TEST_WORLD.height);
    const walls = this.physics.add.staticGroup();
    TEST_OBSTACLES.forEach(([x, y, width, height]) => {
      walls.add(this.add.rectangle(x, y, width, height, 0x34433a).setDepth(y));
    });
    this.player = this.physics.add.sprite(160, 160, 'guardian_placeholder_body').setOrigin(0.5, 1);
    this.player
      .setCollideWorldBounds(true)
      .setBodySize(22, 18)
      .setOffset(21, 46)
      .setDepth(this.player.y);
    this.shadow = this.add
      .image(this.player.x, this.player.y, 'guardian_placeholder_shadow', 0)
      .setOrigin(0.5, 1)
      .setDepth(this.player.y - 1);
    this.layers = ['armor', 'weapon'].map((layer, index) =>
      this.add
        .sprite(this.player.x, this.player.y, `guardian_placeholder_${layer}`)
        .setOrigin(0.5, 1)
        .setDepth(this.player.y + index + 1),
    );
    this.physics.add.collider(this.player, walls);
    this.addDummy('dummy:one', 360, 180, 0);
    this.addDummy('dummy:two', 400, 260, 25);
    this.addDummy('dummy:three', 300, 330, 60);
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
      'W' | 'A' | 'S' | 'D',
      Phaser.Input.Keyboard.Key
    >;
    this.cameras.main
      .startFollow(this.player, true, 0.12, 0.12)
      .setBounds(0, 0, TEST_WORLD.width, TEST_WORLD.height);
    this.feedback = new FeedbackPool(this);
    this.game.canvas.addEventListener('contextmenu', this.suppressContextMenu);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.keyboard!.on('keydown-Q', this.onWhirlwind, this);
    this.input.keyboard!.on('keydown-E', this.onIronSkin, this);
    this.input.keyboard!.on('keydown-ESC', this.togglePause, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseInput, this);
    this.publishHud(true);
  }
  public override update(): void {
    if (this.paused) return;
    const now = this.combatNow();
    const motion = motionFromInput(
      (this.wasd.D.isDown ? 1 : 0) - (this.wasd.A.isDown ? 1 : 0),
      (this.wasd.S.isDown ? 1 : 0) - (this.wasd.W.isDown ? 1 : 0),
      this.facing,
    );
    this.facing = motion.direction;
    const snapshot = this.controller.snapshot();
    const locked =
      now < this.actionEndsAt && (this.state === 'attacking' || this.state === 'casting');
    this.state = now < this.actionEndsAt ? this.state : motion.state;
    this.player
      .setVelocity(
        locked ? 0 : motion.x * 220 * snapshot.movementMultiplier,
        locked ? 0 : motion.y * 220 * snapshot.movementMultiplier,
      )
      .setDepth(this.player.y);
    this.syncLayers();
    this.playSynchronizedAnimations();
    this.handleEvents(this.controller.update({ x: this.player.x, y: this.player.y }));
    this.publishHud(false);
  }
  public pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.pausedAt = this.time.now;
    this.player.setVelocity(0, 0);
    this.publishHud(true);
  }
  public resume(): void {
    if (!this.paused) return;
    if (this.pausedAt !== undefined) this.pausedDuration += this.time.now - this.pausedAt;
    this.pausedAt = undefined;
    this.paused = false;
    this.publishHud(true);
  }
  public setConnection(connection: RuntimeConnection): void {
    this.connection = connection;
    this.publishHud(true);
  }
  public setDamageNumbers(enabled: boolean): void {
    this.showDamageNumbers = enabled;
  }
  private addDummy(id: string, x: number, y: number, armor: number): void {
    this.controller.addDummy({ id, position: { x, y }, armor, health: 220, maxHealth: 220 });
    this.dummyVisuals.set(
      id,
      this.add.circle(x, y, 20, 0x9c7a55).setStrokeStyle(3, 0xe7cda5).setDepth(y),
    );
  }
  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.facing =
      Math.abs(world.x - this.player.x) > Math.abs(world.y - this.player.y)
        ? world.x >= this.player.x
          ? 'right'
          : 'left'
        : world.y >= this.player.y
          ? 'down'
          : 'up';
  }
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.audio.unlock();
    pointer.event.preventDefault();
    this.activate(pointer.rightButtonDown() ? 'powerStrike' : 'slash');
  }
  private onWhirlwind(): void {
    this.activate('whirlwind');
  }
  private onIronSkin(): void {
    this.activate('ironSkin');
  }
  private activate(ability: 'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin'): void {
    if (this.paused) return;
    const facing = directionVector(this.facing);
    const events = this.controller.activate(
      ability,
      crypto.randomUUID(),
      { x: this.player.x, y: this.player.y },
      facing,
    );
    if (events.some((event) => event.type === 'abilityAccepted')) {
      const presentation = guardianCombatPresentation.find((entry) => entry.ability === ability)!;
      this.activeAbility = ability;
      this.state = presentation.state;
      this.actionEndsAt = this.combatNow() + presentation.durationMs;
      this.audio.play(
        'activation',
        events.find((event) => event.type === 'abilityAccepted')!.executionId,
      );
    }
    this.handleEvents(events);
    this.publishHud(true);
  }
  private handleEvents(events: readonly CombatEvent[]): void {
    for (const event of events) {
      if (event.type === 'damageApplied') {
        this.feedback.impact(
          event.position.x,
          event.position.y,
          event.amount,
          event.critical,
          this.showDamageNumbers,
        );
        this.audio.play(event.critical ? 'critical' : 'hit', event.executionId);
      }
      if (event.type === 'targetDefeated')
        this.dummyVisuals.get(event.targetId)?.setFillStyle(0x3b3b3b).setAlpha(0.45);
    }
    for (const target of this.controller.getTargets()) {
      const visual = this.dummyVisuals.get(target.id);
      visual?.setPosition(target.position.x, target.position.y).setDepth(target.position.y);
    }
  }
  private syncLayers(): void {
    this.shadow.setPosition(this.player.x, this.player.y).setDepth(this.player.y - 1);
    this.layers.forEach((layer, index) =>
      layer.setPosition(this.player.x, this.player.y).setDepth(this.player.y + index + 1),
    );
  }
  private playSynchronizedAnimations(): void {
    if (this.combatNow() >= this.actionEndsAt) this.activeAbility = undefined;
    const key =
      this.activeAbility === undefined
        ? layerAnimationKey('body', this.state, this.facing)
        : combatAnimationKey('body', this.activeAbility, this.facing);
    this.player.anims.play(key, true);
    this.layers.forEach((layer, index) =>
      layer.play(
        this.activeAbility === undefined
          ? layerAnimationKey(index === 0 ? 'armor' : 'weapon', this.state, this.facing)
          : combatAnimationKey(index === 0 ? 'armor' : 'weapon', this.activeAbility, this.facing),
        true,
      ),
    );
  }
  private publishHud(force: boolean): void {
    const now = this.combatNow();
    if (!force && now - this.lastHudAt < 100) return;
    this.lastHudAt = now;
    const combat = this.controller.snapshot();
    this.onHud({
      facing: this.facing,
      paused: this.paused,
      connection: this.connection,
      ...combat,
    });
  }
  private togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }
  private combatNow(): number {
    const currentPause = this.pausedAt === undefined ? 0 : this.time.now - this.pausedAt;
    return this.time.now - this.pausedDuration - currentPause;
  }
  private releaseInput(): void {
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.keyboard?.off('keydown-Q', this.onWhirlwind, this);
    this.input.keyboard?.off('keydown-E', this.onIronSkin, this);
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.game.canvas.removeEventListener('contextmenu', this.suppressContextMenu);
    this.feedback.destroy();
    this.audio.destroy();
    this.dummyVisuals.forEach((visual) => visual.destroy());
    this.dummyVisuals.clear();
  }
}

function directionVector(direction: Direction4): Readonly<{ x: number; y: number }> {
  return {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[direction];
}
function constrainDummyKnockback(
  from: Readonly<{ x: number; y: number }>,
  proposed: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  return constrainKnockbackSweep(
    from,
    proposed,
    TEST_OBSTACLES.map(([x, y, width, height]) => ({ x, y, width, height })),
    {
      minimumX: TEST_WORLD.margin,
      minimumY: TEST_WORLD.margin,
      maximumX: TEST_WORLD.width - TEST_WORLD.margin,
      maximumY: TEST_WORLD.height - TEST_WORLD.margin,
    },
  );
}
function createLayerAnimations(scene: Phaser.Scene, asset: AssetManifestEntry): void {
  for (const animation of asset.animations)
    scene.anims.create({
      key: `${asset.id}:${animation.id}`,
      frames: scene.anims.generateFrameNumbers(asset.id, {
        start: animation.start,
        end: animation.end,
      }),
      frameRate: animation.state === 'moving' ? 8 : animation.state === 'idle' ? 1 : 10,
      repeat: animation.state === 'moving' || animation.state === 'idle' ? -1 : 0,
    });
  if (asset.layer !== 'shadow')
    for (const presentation of guardianCombatPresentation)
      for (const direction of ['up', 'down', 'left', 'right'] as const) {
        const offset = ['up', 'down', 'left', 'right'].indexOf(direction) * 4;
        scene.anims.create({
          key: combatAnimationKey(asset.layer, presentation.ability, direction),
          frames: presentation.frames.map((frame) => ({ key: asset.id, frame: offset + frame })),
          frameRate: presentation.frameRate,
          repeat: presentation.ability === 'whirlwind' ? 3 : 0,
        });
      }
}
const runtimes = new WeakMap<HTMLElement, GameRuntime>();
export function mountGameRuntime(
  host: HTMLElement,
  onHud: (snapshot: GameHudSnapshot) => void,
): GameRuntime {
  runtimes.get(host)?.destroy();
  const scene = new TestScene(onHud);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: 960,
    height: 540,
    pixelArt: true,
    fps: { target: 60 },
    physics: {
      default: 'arcade',
      arcade: { debug: arcadeDebugEnabled(import.meta.env.DEV), fps: 60 },
    },
    scene: [BootScene, scene],
  });
  let destroyed = false;
  const runtime: GameRuntime = {
    pause: () => scene.pause(),
    resume: () => scene.resume(),
    setConnection: (connection) => scene.setConnection(connection),
    setDamageNumbers: (enabled) => scene.setDamageNumbers(enabled),
    destroy: () => {
      if (!destroyed) {
        destroyed = true;
        game.destroy(true);
        runtimes.delete(host);
      }
    },
  };
  runtimes.set(host, runtime);
  return runtime;
}
