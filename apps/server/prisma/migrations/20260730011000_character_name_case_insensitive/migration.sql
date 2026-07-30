-- Active Guardian names are unique per owner regardless of case; soft-deleted names may be reused.
DROP INDEX "Character_userId_name_active_key";
CREATE UNIQUE INDEX "Character_userId_name_active_ci_key"
  ON "Character"("userId", lower("name")) WHERE "deletedAt" IS NULL;
