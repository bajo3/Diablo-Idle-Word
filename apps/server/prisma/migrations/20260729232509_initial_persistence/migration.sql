-- CreateEnum
CREATE TYPE "CharacterClass" AS ENUM ('GUARDIAN');

-- CreateEnum
CREATE TYPE "CharacterAvailability" AS ENUM ('AVAILABLE', 'IN_ACTIVE_RUN', 'AWAY_CALIBRATING', 'AWAY_FARMING', 'AWAY_REWARD_PENDING');

-- CreateEnum
CREATE TYPE "EquipmentSlot" AS ENUM ('HELMET', 'CHEST', 'GLOVES', 'BOOTS', 'MAIN_HAND', 'OFF_HAND', 'AMULET', 'RING_1', 'RING_2');

-- CreateEnum
CREATE TYPE "CalibrationState" AS ENUM ('NOT_STARTED', 'RUNNING', 'VALID', 'INVALID', 'ACTIVATED');

-- CreateEnum
CREATE TYPE "AwaySessionState" AS ENUM ('ACTIVE', 'COMPLETED', 'REWARD_PENDING', 'CLAIMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AwayResultState" AS ENUM ('PENDING', 'CLAIMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MissionResultState" AS ENUM ('PENDING', 'COMPLETED', 'CLAIMED', 'FAILED');

-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('ECONOMY', 'AWAY', 'MISSION');

-- CreateTable
CREATE TABLE "User" (
    "id" VARCHAR(128) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" VARCHAR(128) NOT NULL,
    "userId" VARCHAR(128) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "class" "CharacterClass" NOT NULL,
    "availability" "CharacterAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "gold" BIGINT NOT NULL DEFAULT 0,
    "saveVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" VARCHAR(128) NOT NULL,
    "inventoryId" VARCHAR(128) NOT NULL,
    "definitionId" VARCHAR(128) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemData" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "inventoryItemId" VARCHAR(128) NOT NULL,
    "slot" "EquipmentSlot" NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterSkill" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "abilityId" VARCHAR(128) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterProgress" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" BIGINT NOT NULL DEFAULT 0,
    "attributePoints" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwayCalibration" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "state" "CalibrationState" NOT NULL DEFAULT 'NOT_STARTED',
    "zoneId" VARCHAR(128) NOT NULL,
    "difficulty" VARCHAR(32) NOT NULL,
    "buildFingerprint" VARCHAR(256) NOT NULL,
    "calculationSeed" VARCHAR(256) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwayCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwaySession" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "calibrationId" VARCHAR(128) NOT NULL,
    "state" "AwaySessionState" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwayResult" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "sessionId" VARCHAR(128) NOT NULL,
    "operationId" VARCHAR(128) NOT NULL,
    "state" "AwayResultState" NOT NULL DEFAULT 'PENDING',
    "result" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwayResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionResult" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "missionId" VARCHAR(128) NOT NULL,
    "operationId" VARCHAR(128) NOT NULL,
    "state" "MissionResultState" NOT NULL DEFAULT 'PENDING',
    "result" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLog" (
    "id" VARCHAR(128) NOT NULL,
    "characterId" VARCHAR(128) NOT NULL,
    "operationId" VARCHAR(128) NOT NULL,
    "requestHash" VARCHAR(128) NOT NULL,
    "kind" "RewardKind" NOT NULL,
    "goldDelta" BIGINT NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Character_userId_updatedAt_idx" ON "Character"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Character_availability_idx" ON "Character"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "Character_userId_name_key" ON "Character"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_characterId_key" ON "Inventory"("characterId");

-- CreateIndex
CREATE INDEX "InventoryItem_inventoryId_idx" ON "InventoryItem"("inventoryId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_inventoryId_definitionId_key" ON "InventoryItem"("inventoryId", "definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_inventoryItemId_key" ON "Equipment"("inventoryItemId");

-- CreateIndex
CREATE INDEX "Equipment_characterId_idx" ON "Equipment"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_characterId_slot_key" ON "Equipment"("characterId", "slot");

-- CreateIndex
CREATE INDEX "CharacterSkill_characterId_idx" ON "CharacterSkill"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSkill_characterId_abilityId_key" ON "CharacterSkill"("characterId", "abilityId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterProgress_characterId_key" ON "CharacterProgress"("characterId");

-- CreateIndex
CREATE INDEX "AwayCalibration_characterId_state_idx" ON "AwayCalibration"("characterId", "state");

-- CreateIndex
CREATE INDEX "AwaySession_characterId_state_idx" ON "AwaySession"("characterId", "state");

-- CreateIndex
CREATE INDEX "AwaySession_calibrationId_idx" ON "AwaySession"("calibrationId");

-- CreateIndex
CREATE UNIQUE INDEX "AwayResult_sessionId_key" ON "AwayResult"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AwayResult_operationId_key" ON "AwayResult"("operationId");

-- CreateIndex
CREATE INDEX "AwayResult_characterId_state_idx" ON "AwayResult"("characterId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "MissionResult_operationId_key" ON "MissionResult"("operationId");

-- CreateIndex
CREATE INDEX "MissionResult_characterId_state_idx" ON "MissionResult"("characterId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "MissionResult_characterId_missionId_key" ON "MissionResult"("characterId", "missionId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardLog_operationId_key" ON "RewardLog"("operationId");

-- CreateIndex
CREATE INDEX "RewardLog_characterId_createdAt_idx" ON "RewardLog"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardLog_characterId_requestHash_idx" ON "RewardLog"("characterId", "requestHash");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSkill" ADD CONSTRAINT "CharacterSkill_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterProgress" ADD CONSTRAINT "CharacterProgress_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwayCalibration" ADD CONSTRAINT "AwayCalibration_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwaySession" ADD CONSTRAINT "AwaySession_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwaySession" ADD CONSTRAINT "AwaySession_calibrationId_fkey" FOREIGN KEY ("calibrationId") REFERENCES "AwayCalibration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwayResult" ADD CONSTRAINT "AwayResult_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwayResult" ADD CONSTRAINT "AwayResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AwaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionResult" ADD CONSTRAINT "MissionResult_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLog" ADD CONSTRAINT "RewardLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
