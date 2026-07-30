-- Strengthen the initial persistence model without rewriting the applied first migration.
ALTER TABLE "Equipment" DROP CONSTRAINT "Equipment_inventoryItemId_fkey";
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_inventoryId_fkey";
DROP INDEX "InventoryItem_inventoryId_definitionId_key";
DROP INDEX "MissionResult_characterId_missionId_key";

ALTER TABLE "AwayCalibration"
  ADD COLUMN "balanceVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "buildSnapshot" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "buildVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "dataVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "formulaVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "invalidReason" VARCHAR(160),
  ADD COLUMN "normalizedRates" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "validDurationSeconds" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AwayResult"
  ADD COLUMN "balanceVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "computedSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dataVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "discardedSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "efficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "formulaVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "rewards" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "AwaySession"
  ADD COLUMN "activationOperationId" VARCHAR(128) NOT NULL,
  ADD COLUMN "activeMarker" VARCHAR(16),
  ADD COLUMN "calculationSeed" VARCHAR(256) NOT NULL DEFAULT 'pending',
  ADD COLUMN "difficulty" VARCHAR(32) NOT NULL DEFAULT 'normal',
  ADD COLUMN "maxDurationSeconds" INTEGER NOT NULL DEFAULT 28800,
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "snapshot" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "zoneId" VARCHAR(128) NOT NULL DEFAULT 'unknown';

ALTER TABLE "Character"
  ADD COLUMN "dexterity" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "intelligence" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "materials" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "strength" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "vitality" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "CharacterProgress" ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharacterSkill"
  ADD COLUMN "barSlot" INTEGER,
  ADD COLUMN "equipped" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "unlocked" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Inventory"
  ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 40,
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "InventoryItem"
  ADD COLUMN "affixes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "characterId" VARCHAR(128) NOT NULL,
  ADD COLUMN "favorite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "generationData" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "itemPower" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rarity" VARCHAR(32) NOT NULL DEFAULT 'common';
ALTER TABLE "MissionResult"
  ADD COLUMN "balanceVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "dataVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "difficulty" VARCHAR(32) NOT NULL DEFAULT 'normal',
  ADD COLUMN "outcome" VARCHAR(32) NOT NULL DEFAULT 'pending',
  ADD COLUMN "progress" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "rewardsClaimed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RewardLog"
  ADD COLUMN "balanceVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "dataVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "experienceBalanceAfter" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "experienceDelta" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "formulaVersion" VARCHAR(64) NOT NULL DEFAULT '1',
  ADD COLUMN "goldBalanceAfter" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "materialsBalanceAfter" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "materialsDelta" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "source" VARCHAR(64) NOT NULL DEFAULT 'unknown',
  ADD COLUMN "sourceId" VARCHAR(128) NOT NULL DEFAULT 'unknown';

CREATE UNIQUE INDEX "AwaySession_activationOperationId_key" ON "AwaySession"("activationOperationId");
CREATE UNIQUE INDEX "AwaySession_characterId_activeMarker_key" ON "AwaySession"("characterId", "activeMarker");
CREATE UNIQUE INDEX "Character_id_userId_key" ON "Character"("id", "userId");
CREATE UNIQUE INDEX "Equipment_inventoryItemId_characterId_key" ON "Equipment"("inventoryItemId", "characterId");
CREATE UNIQUE INDEX "Inventory_id_characterId_key" ON "Inventory"("id", "characterId");
CREATE INDEX "InventoryItem_characterId_inventoryId_idx" ON "InventoryItem"("characterId", "inventoryId");
CREATE UNIQUE INDEX "InventoryItem_id_characterId_key" ON "InventoryItem"("id", "characterId");

ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_inventoryId_characterId_fkey"
  FOREIGN KEY ("inventoryId", "characterId") REFERENCES "Inventory"("id", "characterId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_inventoryItemId_characterId_fkey"
  FOREIGN KEY ("inventoryItemId", "characterId") REFERENCES "InventoryItem"("id", "characterId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "Character" ADD CONSTRAINT "Character_values_valid" CHECK (
  "gold" >= 0 AND "materials" >= 0 AND "strength" >= 0 AND "dexterity" >= 0
  AND "intelligence" >= 0 AND "vitality" >= 0 AND "saveVersion" > 0 AND "revision" > 0
);
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_values_valid" CHECK ("capacity" > 0 AND "schemaVersion" > 0 AND "revision" > 0);
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_values_valid" CHECK ("quantity" > 0 AND "itemPower" >= 0 AND "revision" > 0);
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "CharacterSkill" ADD CONSTRAINT "CharacterSkill_values_valid" CHECK (
  "level" > 0 AND "revision" > 0 AND ("barSlot" IS NULL OR "barSlot" BETWEEN 0 AND 3)
  AND (NOT "equipped" OR "unlocked") AND ("equipped" = ("barSlot" IS NOT NULL))
);
ALTER TABLE "CharacterProgress" ADD CONSTRAINT "CharacterProgress_values_valid" CHECK (
  "level" BETWEEN 1 AND 10 AND "experience" >= 0 AND "attributePoints" >= 0
  AND "schemaVersion" > 0 AND "revision" > 0
);
ALTER TABLE "AwayCalibration" ADD CONSTRAINT "AwayCalibration_values_valid" CHECK (
  "validDurationSeconds" >= 0 AND "schemaVersion" > 0 AND "revision" > 0
  AND ("completedAt" IS NULL OR "startedAt" IS NULL OR "completedAt" >= "startedAt")
);
ALTER TABLE "AwaySession" ADD CONSTRAINT "AwaySession_values_valid" CHECK (
  "maxDurationSeconds" > 0 AND "schemaVersion" > 0 AND "revision" > 0
  AND ("endedAt" IS NULL OR "endedAt" >= "startedAt")
  AND (("state" = 'ACTIVE' AND "activeMarker" = 'active') OR ("state" <> 'ACTIVE' AND "activeMarker" IS NULL))
);
ALTER TABLE "AwayResult" ADD CONSTRAINT "AwayResult_values_valid" CHECK (
  "elapsedSeconds" >= 0 AND "computedSeconds" >= 0 AND "discardedSeconds" >= 0
  AND "computedSeconds" <= "elapsedSeconds" AND "discardedSeconds" = "elapsedSeconds" - "computedSeconds"
  AND "efficiency" >= 0 AND "efficiency" <= 1 AND "schemaVersion" > 0 AND "revision" > 0
  AND "endedAt" >= "startedAt"
);
ALTER TABLE "MissionResult" ADD CONSTRAINT "MissionResult_values_valid" CHECK ("schemaVersion" > 0 AND "revision" > 0);
ALTER TABLE "RewardLog" ADD CONSTRAINT "RewardLog_values_valid" CHECK (
  "goldBalanceAfter" >= 0 AND "materialsBalanceAfter" >= 0 AND "experienceBalanceAfter" >= 0
  AND "schemaVersion" > 0 AND "revision" > 0
);
