CREATE TABLE "CharacterCheckpointReceipt" (
  "id" VARCHAR(128) NOT NULL,
  "characterId" VARCHAR(128) NOT NULL,
  "operationId" VARCHAR(128) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "sceneId" VARCHAR(64) NOT NULL,
  "checkpointId" VARCHAR(128) NOT NULL,
  "serverState" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterCheckpointReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CharacterCheckpointReceipt_operationId_key" UNIQUE ("operationId"),
  CONSTRAINT "CharacterCheckpointReceipt_characterId_operationId_key" UNIQUE ("characterId", "operationId"),
  CONSTRAINT "CharacterCheckpointReceipt_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CharacterCheckpointReceipt_characterId_createdAt_idx" ON "CharacterCheckpointReceipt"("characterId", "createdAt");
