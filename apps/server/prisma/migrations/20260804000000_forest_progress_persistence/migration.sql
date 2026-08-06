CREATE TABLE "CharacterForestProgress" (
  "id" VARCHAR(128) NOT NULL,
  "characterId" VARCHAR(128) NOT NULL,
  "formatVersion" INTEGER NOT NULL DEFAULT 1,
  "stateSchemaVersion" INTEGER NOT NULL DEFAULT 1,
  "dataVersion" VARCHAR(64) NOT NULL DEFAULT '2026.07.30.4',
  "balanceVersion" VARCHAR(64) NOT NULL DEFAULT '2026.07.30.4',
  "state" JSONB NOT NULL DEFAULT '{"level":1,"xpInLevel":0,"bestLevel":1,"totalXp":0,"totalGold":0,"totalMaterials":0,"countedDefeats":[]}',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterForestProgress_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CharacterForestProgress" (
  "id", "characterId", "formatVersion", "stateSchemaVersion", "dataVersion", "balanceVersion", "state"
)
SELECT
  'forest-progress:' || "id",
  "id",
  1,
  1,
  '2026.07.30.4',
  '2026.07.30.4',
  '{"level":1,"xpInLevel":0,"bestLevel":1,"totalXp":0,"totalGold":0,"totalMaterials":0,"countedDefeats":[]}'::jsonb
FROM "Character";

CREATE UNIQUE INDEX "CharacterForestProgress_characterId_key"
  ON "CharacterForestProgress"("characterId");
CREATE INDEX "CharacterForestProgress_characterId_revision_idx"
  ON "CharacterForestProgress"("characterId", "revision");

ALTER TABLE "CharacterForestProgress"
  ADD CONSTRAINT "CharacterForestProgress_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CharacterForestProgress"
  ADD CONSTRAINT "CharacterForestProgress_values_valid"
  CHECK ("formatVersion" > 0 AND "stateSchemaVersion" > 0 AND "revision" > 0);
