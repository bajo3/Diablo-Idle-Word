-- An ACTIVE session needs its uniqueness marker by default; completed states must clear it.
ALTER TABLE "AwaySession" ALTER COLUMN "activeMarker" SET DEFAULT 'active';
