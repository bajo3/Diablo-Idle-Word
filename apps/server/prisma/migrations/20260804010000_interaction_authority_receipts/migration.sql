CREATE TABLE "CharacterInteractionState" (
  "id" VARCHAR(128) NOT NULL,
  "characterId" VARCHAR(128) NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "state" JSONB NOT NULL DEFAULT '{"consumedTargetIds":[]}',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterInteractionState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CharacterInteractionReceipt" (
  "id" VARCHAR(128) NOT NULL,
  "characterId" VARCHAR(128) NOT NULL,
  "operationId" VARCHAR(128) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "receipt" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterInteractionReceipt_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CharacterInteractionState" ("id", "characterId", "schemaVersion", "state")
SELECT
  'interaction-state:' || "id",
  "id",
  1,
  '{"consumedTargetIds":[]}'::jsonb
FROM "Character";

CREATE UNIQUE INDEX "CharacterInteractionState_characterId_key"
  ON "CharacterInteractionState"("characterId");
CREATE INDEX "CharacterInteractionState_characterId_revision_idx"
  ON "CharacterInteractionState"("characterId", "revision");
CREATE UNIQUE INDEX "CharacterInteractionReceipt_operationId_key"
  ON "CharacterInteractionReceipt"("operationId");
CREATE UNIQUE INDEX "CharacterInteractionReceipt_characterId_operationId_key"
  ON "CharacterInteractionReceipt"("characterId", "operationId");
CREATE INDEX "CharacterInteractionReceipt_characterId_createdAt_idx"
  ON "CharacterInteractionReceipt"("characterId", "createdAt");

ALTER TABLE "CharacterInteractionState"
  ADD CONSTRAINT "CharacterInteractionState_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterInteractionReceipt"
  ADD CONSTRAINT "CharacterInteractionReceipt_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterInteractionState"
  ADD CONSTRAINT "CharacterInteractionState_values_valid"
  CHECK ("schemaVersion" > 0 AND "revision" > 0);
