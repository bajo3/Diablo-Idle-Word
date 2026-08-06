-- Paso 17: pueblo, comerciante, cofre persistente y tutorial idempotente.
CREATE TABLE "CharacterChest" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 80,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "items" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CharacterChest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterChest_characterId_key" ON "CharacterChest"("characterId");
CREATE INDEX "CharacterChest_characterId_revision_idx" ON "CharacterChest"("characterId", "revision");
ALTER TABLE "CharacterChest"
  ADD CONSTRAINT "CharacterChest_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterChest"
  ADD CONSTRAINT "CharacterChest_values_valid"
  CHECK ("capacity" > 0 AND "schemaVersion" = 1 AND "revision" > 0);

INSERT INTO "CharacterChest" ("id", "characterId")
SELECT 'chest:' || "id", "id" FROM "Character"
ON CONFLICT ("characterId") DO NOTHING;

CREATE TABLE "CharacterTownOperation" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "operationId" VARCHAR(128) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "result" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CharacterTownOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterTownOperation_operationId_key"
  ON "CharacterTownOperation"("operationId");
CREATE UNIQUE INDEX "CharacterTownOperation_characterId_operationId_key"
  ON "CharacterTownOperation"("characterId", "operationId");
CREATE INDEX "CharacterTownOperation_characterId_createdAt_idx"
  ON "CharacterTownOperation"("characterId", "createdAt");
ALTER TABLE "CharacterTownOperation"
  ADD CONSTRAINT "CharacterTownOperation_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterTownOperation"
  ADD CONSTRAINT "CharacterTownOperation_values_valid"
  CHECK (char_length("operationId") > 0 AND char_length("kind") > 0);
