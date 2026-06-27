-- =============================================
-- AUSTA Care Platform: Performance Indexes
-- 7 critical indexes + 2 GIN indexes from forensics analysis
-- 
-- APPLY MANUALLY IN PRODUCTION (not via Prisma migrate):
--   psql -d austa_care -f db/performance_indexes.sql
-- =============================================

-- 1. Messages: status + sent_at, filtering soft-deleted rows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_status_sentat
ON messages (status, sent_at) WHERE deleted_at IS NULL;

-- 2. Conversations: organization + last message time (descending)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_org_lastmsg
ON conversations (organization_id, last_message_at DESC) WHERE deleted_at IS NULL;

-- 3. Health data: user + recorded time (descending), active only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_health_data_user_recorded
ON health_data (user_id, recorded_at DESC) WHERE is_active = true AND deleted_at IS NULL;

-- 4. Audit logs: occurred_at where not LGPD-relevant (for general queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_occurred
ON audit_logs (occurred_at) WHERE lgpd_relevant = false;

-- 5. Documents: organization + uploaded time (descending), active only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_org_uploaded
ON documents (organization_id, uploaded_at DESC) WHERE is_active = true AND deleted_at IS NULL;

-- 6. Authorizations: organization + status for pending/under-review
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_authorizations_org_pending
ON authorizations (organization_id, status) WHERE status IN ('PENDING', 'UNDER_REVIEW') AND deleted_at IS NULL;

-- 7. Questionnaire responses: user + questionnaire composite
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questionnaire_user_questionnaire
ON questionnaire_responses (user_id, questionnaire_id) WHERE deleted_at IS NULL;

-- JSONB GIN indexes for advanced querying

-- Health data: GIN index on risk_score JSONB column
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_health_data_riskscore_gin
ON health_data USING GIN (risk_score);

-- Audit logs: GIN index on old_values + new_values JSONB columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_changes_gin
ON audit_logs USING GIN (old_values, new_values);
