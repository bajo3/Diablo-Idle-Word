-- Paso 4: identity, revocable opaque sessions and durable character selection.
ALTER TABLE "User"
  ADD COLUMN "displayName" VARCHAR(64) NOT NULL DEFAULT 'Viajero',
  ADD COLUMN "passwordHash" VARCHAR(256);

ALTER TABLE "Character" ADD COLUMN "deletedAt" TIMESTAMP(3);
DROP INDEX "Character_userId_name_key";
CREATE UNIQUE INDEX "Character_userId_name_active_key"
  ON "Character"("userId", "name") WHERE "deletedAt" IS NULL;
DROP INDEX "Character_userId_updatedAt_idx";
CREATE INDEX "Character_userId_deletedAt_updatedAt_idx"
  ON "Character"("userId", "deletedAt", "updatedAt");

CREATE TABLE "Session" (
  "id" VARCHAR(128) NOT NULL,
  "userId" VARCHAR(128) NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CharacterSelection" (
  "userId" VARCHAR(128) NOT NULL,
  "characterId" VARCHAR(128) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CharacterSelection_pkey" PRIMARY KEY ("userId")
);
CREATE UNIQUE INDEX "CharacterSelection_characterId_userId_key"
  ON "CharacterSelection"("characterId", "userId");
ALTER TABLE "CharacterSelection" ADD CONSTRAINT "CharacterSelection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSelection" ADD CONSTRAINT "CharacterSelection_characterId_userId_fkey"
  FOREIGN KEY ("characterId", "userId") REFERENCES "Character"("id", "userId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_profile_values_valid" CHECK (
  length(trim("displayName")) BETWEEN 3 AND 64
);
ALTER TABLE "Session" ADD CONSTRAINT "Session_expiry_valid" CHECK ("expiresAt" > "createdAt");
