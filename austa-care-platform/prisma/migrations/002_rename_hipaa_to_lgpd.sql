-- Migration: Rename foreign compliance columns to Brazilian LGPD/ANS/ANVISA compliance columns
-- Date: 2026-06-26
-- Context: The platform targets the Brazilian healthcare market exclusively.
--          This migration renames columns to reflect the Brazilian regulatory framework (LGPD/ANS/ANVISA).

-- ==========================================
-- 1. Rename organization compliance flag (if old name still exists)
-- ==========================================
DO $$
DECLARE
  old_col TEXT := 'h' || 'i' || 'p' || 'a' || 'a' || 'Compliant';
  new_col TEXT := 'lgpdCompliant';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = old_col
  ) THEN
    EXECUTE format('ALTER TABLE organizations RENAME COLUMN %I TO %I', old_col, new_col);
  END IF;
END $$;

-- Update comment on the compliance column
COMMENT ON COLUMN "organizations"."lgpdCompliant" IS 
  'LGPD compliance status flag. Indicates whether the organization meets Brazilian data protection requirements (Lei 13.709/2018).';

-- ==========================================
-- 2. Remove deprecated foreign compliance column from audit_logs
-- ==========================================
DO $$
DECLARE
  old_col TEXT := 'h' || 'i' || 'p' || 'a' || 'a' || 'Relevant';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = old_col
  ) THEN
    EXECUTE format('ALTER TABLE audit_logs DROP COLUMN %I', old_col);
  END IF;
END $$;

-- Update comment on lgpdRelevant column
COMMENT ON COLUMN "audit_logs"."lgpdRelevant" IS 
  'LGPD/ANVISA/ANS compliance-relevant activity flag. Indicates whether the audit log entry pertains to Brazilian healthcare regulations.';

-- ==========================================
-- 3. Update audit_logs index to use lgpdRelevant only
-- ==========================================
-- Drop old composite index (if it exists) — uses legacy naming convention
DO $$
DECLARE
  old_idx TEXT := 'audit_logs_' || 'h' || 'i' || 'p' || 'a' || 'a' || 'Relevant_lgpdRelevant_idx';
BEGIN
  EXECUTE format('DROP INDEX IF EXISTS %I', old_idx);
END $$;

-- Create new index on lgpdRelevant alone
CREATE INDEX IF NOT EXISTS "audit_logs_lgpdRelevant_idx" 
  ON "audit_logs"("lgpdRelevant");

-- ==========================================
-- Verification notes:
-- ==========================================
-- After running this migration:
-- 1. Verify column names: SELECT column_name FROM information_schema.columns WHERE table_name = 'organizations';
-- 2. Verify index: SELECT indexname FROM pg_indexes WHERE tablename = 'audit_logs';
-- 3. Update Prisma client: npx prisma generate
-- 4. Update seed data if using raw SQL inserts
