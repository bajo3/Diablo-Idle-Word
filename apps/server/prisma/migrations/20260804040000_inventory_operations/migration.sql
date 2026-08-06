CREATE TABLE "InventoryOperation" (
  "id" VARCHAR(128) NOT NULL,
  "characterId" VARCHAR(128) NOT NULL,
  "operationId" VARCHAR(128) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "result" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryOperation_operationId_key" UNIQUE ("operationId"),
  CONSTRAINT "InventoryOperation_characterId_operationId_key" UNIQUE ("characterId", "operationId"),
  CONSTRAINT "InventoryOperation_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InventoryOperation_characterId_createdAt_idx"
  ON "InventoryOperation"("characterId", "createdAt");

ALTER TABLE "InventoryOperation"
  ADD CONSTRAINT "InventoryOperation_values_valid"
  CHECK (char_length("operationId") > 0 AND char_length("kind") > 0);
