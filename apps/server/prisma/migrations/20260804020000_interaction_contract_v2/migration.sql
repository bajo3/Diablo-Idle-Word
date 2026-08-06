ALTER TABLE "CharacterInteractionState"
  ALTER COLUMN "schemaVersion" SET DEFAULT 2,
  ALTER COLUMN "state" SET DEFAULT '{"consumedTargetIds":[],"cooldowns":[]}'::jsonb;

UPDATE "CharacterInteractionState"
SET
  "schemaVersion" = 2,
  "state" = "state" || '{"cooldowns":[]}'::jsonb
WHERE "schemaVersion" < 2 OR NOT ("state" ? 'cooldowns');
