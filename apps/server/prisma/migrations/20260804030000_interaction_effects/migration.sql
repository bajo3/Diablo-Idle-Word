CREATE TABLE "CharacterInteractionEffect" (
  "id" VARCHAR(128) NOT NULL,
  "characterId" VARCHAR(128) NOT NULL,
  "operationId" VARCHAR(128) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "resultId" VARCHAR(128) NOT NULL,
  "effectType" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterInteractionEffect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CharacterInteractionEffect_operationId_key" UNIQUE ("operationId"),
  CONSTRAINT "CharacterInteractionEffect_characterId_operationId_key" UNIQUE ("characterId", "operationId"),
  CONSTRAINT "CharacterInteractionEffect_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CharacterInteractionEffect_characterId_createdAt_idx"
  ON "CharacterInteractionEffect"("characterId", "createdAt");

ALTER TABLE "CharacterInteractionEffect"
  ADD CONSTRAINT "CharacterInteractionEffect_values_valid"
  CHECK (char_length("resultId") > 0 AND char_length("effectType") > 0 AND char_length("status") > 0);
