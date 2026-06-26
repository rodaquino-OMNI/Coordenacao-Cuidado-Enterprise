-- Migration: Rename HIPAA columns to LGPD/ANS/ANVISA compliance columns
-- Date: 2026-06-26
-- Context: HIPAA is U.S. regulation and does NOT apply to Brazilian healthcare platforms.
--          This migration renames columns to reflect Brazilian regulatory framework (LGPD/ANS/ANVISA).

-- ==========================================
-- 1. Rename organization compliance flag
-- ==========================================
-- Rename hipaaCompliant → lgpdCompliant on organizations table
ALTER TABLE "organizations" 
  RENAME COLUMN "hipaaCompliant" TO "lgpdCompliant";

-- Update comment on the renamed column
COMMENT ON COLUMN "organizations"."lgpdCompliant" IS 
  'LGPD compliance status flag. Indicates whether the organization meets Brazilian data protection requirements (Lei 13.709/2018).';

-- ==========================================
-- 2. Remove hipaaRelevant column from audit_logs
--    (lgpdRelevant already exists and now serves as the primary compliance flag)
-- ==========================================
ALTER TABLE "audit_logs" 
  DROP COLUMN IF EXISTS "hipaaRelevant";

-- Update comment on lgpdRelevant column
COMMENT ON COLUMN "audit_logs"."lgpdRelevant" IS 
  'LGPD/ANVISA/ANS compliance-relevant activity flag. Indicates whether the audit log entry pertains to Brazilian healthcare regulations.';

-- ==========================================
-- 3. Update audit_logs index to use lgpdRelevant only
-- ==========================================
-- Drop old composite index (if it exists)
DROP INDEX IF EXISTS "audit_logs_hipaaRelevant_lgpdRelevant_idx";

-- Create new index on lgpdRelevant alone
CREATE INDEX IF NOT EXISTS "audit_logs_lgpdRelevant_idx" 
  ON "audit_logs"("lgpdRelevant");

-- ==========================================
-- Verification notes:
-- ==========================================
-- After running this migration:
-- 1. Verify column renames: SELECT column_name FROM information_schema.columns WHERE table_name = 'organizations';
-- 2. Verify index: SELECT indexname FROM pg_indexes WHERE tablename = 'audit_logs';
-- 3. Update Prisma client: npx prisma generate
-- 4. Update seed data if using raw SQL inserts
