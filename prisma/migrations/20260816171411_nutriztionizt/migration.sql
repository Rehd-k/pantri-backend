-- Historical no-op.
-- This folder originally ran:
--   ALTER TABLE "Employee" ALTER COLUMN "verificationStatus" SET DEFAULT 'REGISTERED';
-- before 20260816180000_verification_portals_meals created that column (and the
-- EmployeeVerificationStatus enum). Fresh shadow-database replays therefore
-- failed with: column "verificationStatus" of relation "Employee" does not exist.
-- The default is set after the column is added in that later migration.
SELECT 1;
