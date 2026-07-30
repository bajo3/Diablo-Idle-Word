import { z } from 'zod';

import { AssetIdSchema, IdSchema } from './ids.js';

export const Direction4Schema = z.enum(['up', 'down', 'left', 'right']);
export const CharacterAnimationStateSchema = z.enum([
  'idle',
  'moving',
  'attacking',
  'casting',
  'channeling',
  'interacting',
  'stunned',
  'knocked_back',
  'downed',
  'reviving',
  'dead',
]);
export const SpriteAnimationSchema = z
  .strictObject({
    id: IdSchema,
    atlasId: AssetIdSchema,
    state: CharacterAnimationStateSchema,
    direction: Direction4Schema,
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().nonnegative(),
    frameRate: z.number().positive(),
    repeat: z.number().int().min(-1),
    lockMovement: z.boolean(),
    interruptible: z.boolean(),
    hitFrame: z.number().int().nonnegative().optional(),
    eventFrames: z
      .array(z.strictObject({ frame: z.number().int().nonnegative(), event: IdSchema }))
      .default([]),
  })
  .superRefine((value, context) => {
    if (value.endFrame < value.startFrame)
      context.addIssue({
        code: 'custom',
        message: 'endFrame must not precede startFrame',
        path: ['endFrame'],
      });
    if (
      value.hitFrame !== undefined &&
      (value.hitFrame < value.startFrame || value.hitFrame > value.endFrame)
    )
      context.addIssue({
        code: 'custom',
        message: 'hitFrame must be within animation range',
        path: ['hitFrame'],
      });
    const eventKeys = new Set<string>();
    value.eventFrames.forEach(({ event, frame }, index) => {
      if (frame < value.startFrame || frame > value.endFrame)
        context.addIssue({
          code: 'custom',
          message: 'event frame must be within animation range',
          path: ['eventFrames', index, 'frame'],
        });
      const key = `${frame}:${event}`;
      if (eventKeys.has(key))
        context.addIssue({
          code: 'custom',
          message: 'duplicate animation event frame',
          path: ['eventFrames', index],
        });
      eventKeys.add(key);
    });
  });
export const SpriteSheetSchema = z.strictObject({
  id: AssetIdSchema,
  frameWidth: z.union([z.literal(64), z.literal(128)]),
  frameHeight: z.union([z.literal(64), z.literal(128)]),
  frameCount: z.number().int().positive(),
  origin: z.strictObject({ x: z.number(), y: z.number() }),
  offset: z.strictObject({ x: z.number(), y: z.number() }),
  directions: z
    .array(Direction4Schema)
    .length(4)
    .superRefine((directions, context) => {
      if (new Set(directions).size !== 4)
        context.addIssue({
          code: 'custom',
          message: 'directions must contain each Direction4 exactly once',
        });
    }),
  mirrorLeftFromRight: z.boolean(),
});
export const AssetManifestEntrySchema = z.strictObject({
  id: AssetIdSchema,
  type: z.enum(['spritesheet', 'map', 'audio', 'image']),
  path: z.string().startsWith('/assets/'),
  version: z.string().trim().min(1).max(64),
  preload: z.boolean(),
  source: z.string().trim().min(1).max(256),
  author: z.string().trim().min(1).max(256),
  license: z.string().trim().min(1).max(256),
  addedOn: z.string().date(),
  approximateBytes: z.number().int().nonnegative(),
  spriteSheet: SpriteSheetSchema.optional(),
  animationIds: z.array(IdSchema).default([]),
});
export const MapObjectPropertiesSchema = z.strictObject({
  entityType: z.enum([
    'spawn',
    'altar',
    'door',
    'portal',
    'boss_arena',
    'checkpoint',
    'interaction',
  ]),
  definitionId: IdSchema.optional(),
  spawnGroup: IdSchema.optional(),
  interactionId: IdSchema.optional(),
  objectiveId: IdSchema.optional(),
  collisionType: z.enum(['none', 'solid', 'trigger']).optional(),
  zIndex: z.number().int().optional(),
  serverRelevant: z.boolean(),
});

export type Direction4 = z.infer<typeof Direction4Schema>;
export type CharacterAnimationState = z.infer<typeof CharacterAnimationStateSchema>;
export type SpriteAnimation = z.infer<typeof SpriteAnimationSchema>;
export type SpriteSheet = z.infer<typeof SpriteSheetSchema>;
export type AssetManifestEntry = z.infer<typeof AssetManifestEntrySchema>;
export type MapObjectProperties = z.infer<typeof MapObjectPropertiesSchema>;
