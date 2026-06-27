# Coordenação-Cuidado → Enterprise Platform: AMH Data Platform Integration Plan

**Status:** Updated with Forensics Findings
**Date:** 2026-06-27
**Author:** Parreira (Orquestrador DevOps)
**Target:** Convert AUSTA Care Platform from prototype to enterprise-grade, paired with AMH Data Platform

---

## Forensics Findings Incorporated

This section summarizes actionable findings from three comprehensive forensics reports run on 2026-06-27: `forensics-security.md`, `forensics-scalability.md`, and `forensics-integration.md`. These findings directly inform the plan's gap analysis, risk register, and prioritization.

### Security Maturity Score: 52/100

The platform scored **52/100** on the security maturity assessment against OWASP Top 10 (2021), LGPD, ANS, and AMH Data Platform standards (ADR-005, ADR-009, ADR-012, ADR-022).

**Key metrics from `forensics-security.md`:**

| Metric | Value |
|--------|-------|
| Security Maturity Score | **52/100** |
| AMH Standards Compliance | **35%** (target: 95%+ post-integration) |
| Critical Vulnerabilities | 2 (frontend: vitest, @vitest/ui) |
| High Vulnerabilities | 23 (16 backend + 7 frontend) |
| Moderate Vulnerabilities | 29 (26 backend + 3 frontend) |
| **Total npm audit vulnerabilities** | **54** (42 backend + 12 frontend) |

**Top 10 Critical & High Findings (from forensics report):**

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| F1 | **CRITICAL** | Plaintext password storage in user creation paths (`controllers/user.ts`, `routes/user.routes.ts`) | Apply `bcrypt.hash(password, 12)` before storing |
| F2 | **CRITICAL** | **Dual auth implementation** — real auth (`controllers/auth.ts`) is never wired; `routes/auth.routes.ts` returns 501 for all endpoints. Auth is non-functional. | Wire `controllers/auth.ts` into `routes/index.ts` (now being addressed by E1-A) |
| F3 | **HIGH** | JWT accepts any algorithm — "none" attack possible | Add `{ algorithms: ['HS256'] }` to `jwt.verify()` |
| F4 | **HIGH** | Hardcoded encryption key `0123456789abcdef0123456789abcdef` in git history | Rotate ALL keys; use `git filter-branch` or BFG to purge |
| F5 | **HIGH** | CORS allows all origins (`cors()` with no config in `app.ts`) | Apply `corsConfig` from `config/security.config.ts` |
| F6 | **HIGH** | Helmet uses defaults, not hardened CSP configuration | Use `configureSecurityHeaders(app)` from `security.config.ts` |
| F7 | **HIGH** | PHI/PII returned in plaintext in ALL user API responses | Mask/encrypt fields in `formatUserResponse()` |
| F8 | **HIGH** | Tokens in localStorage + no httpOnly cookie strategy | Migrate to httpOnly secure cookies with CSRF protection |
| F9 | **HIGH** | Error handler logs full request body (passwords, CPF, PHI) | Sanitize `req.body` before logging |
| F10 | **MEDIUM** | No encryption for PHI fields at database level | Call `encryptPHI()` on all PHI/PII fields; implement KMS per AMH ADR-012 |

### Dual Auth Issue (F2) — Remediation Underway

The forensics audit discovered that the codebase has **two competing authentication implementations**:

1. `src/routes/auth.routes.ts` — Returns `501 NOT_IMPLEMENTED` for ALL endpoints (login, register, refresh) — this is what's wired into the app.
2. `src/controllers/auth.ts` — Fully implemented with login, register, refresh, bcrypt, JWT — but **never mounted** because `routes/index.ts` imports from the stub, not the real controller.

**Impact:** All authentication endpoints are non-functional in the current codebase. The real implementation exists but is unreachable.

**Fix (E1-A):** Replace the `authRoutes` import in `routes/index.ts` to point to `controllers/auth.ts` instead of `routes/auth.routes.ts`. Add JWT algorithm pinning, token blacklisting on logout, and `tokenVersion` enforcement. This is a prerequisite for Cognito migration (ENT-005).

### Database: 7 Missing Indexes

The scalability forensics (`forensics-scalability.md`) identified **7 missing database indexes** that will cause severe performance degradation at scale. Below are the exact SQL statements needed:

```sql
-- 1. Messages: queries for failed/pending messages by status and time
-- (whatsapp.service.ts message delivery tracking)
CREATE INDEX CONCURRENTLY idx_messages_status_sentat 
  ON messages (status, sent_at) 
  WHERE deleted_at IS NULL;

-- 2. Conversations: org-level listing sorted by recent activity
-- (conversation.controller.ts GET /)
CREATE INDEX CONCURRENTLY idx_conversations_org_lastmsg 
  ON conversations (organization_id, last_message_at DESC) 
  WHERE deleted_at IS NULL;

-- 3. Health data: user-specific time-range queries
-- (health-data.controller.ts, temporal-risk-tracking.service.ts)
CREATE INDEX CONCURRENTLY idx_health_data_user_recorded 
  ON health_data (user_id, recorded_at DESC) 
  WHERE is_active = true AND deleted_at IS NULL;

-- 4. Audit logs: retention/purge queries by time
-- (auditService.ts background cleanup)
CREATE INDEX CONCURRENTLY idx_audit_logs_occurred 
  ON audit_logs (occurred_at) 
  WHERE lgpd_relevant = false;

-- 5. Documents: organization-level listing
-- (document.controller.ts)
CREATE INDEX CONCURRENTLY idx_documents_org_uploaded 
  ON documents (organization_id, uploaded_at DESC) 
  WHERE is_active = true AND deleted_at IS NULL;

-- 6. Authorizations: pending approvals by org
-- (authorization schemas)
CREATE INDEX CONCURRENTLY idx_authorizations_org_pending 
  ON authorizations (organization_id, status) 
  WHERE status IN ('PENDING', 'UNDER_REVIEW') AND deleted_at IS NULL;

-- 7. Questionnaire responses: completion lookup
-- (gamification.controller.ts, health-data.controller.ts)
CREATE INDEX CONCURRENTLY idx_questionnaire_user_questionnaire 
  ON questionnaire_responses (user_id, questionnaire_id) 
  WHERE deleted_at IS NULL;
```

Plus 2 recommended JSONB/GIN indexes:
```sql
CREATE INDEX CONCURRENTLY idx_health_data_riskscore_gin 
  ON health_data USING GIN (risk_score);

CREATE INDEX CONCURRENTLY idx_audit_logs_changes_gin 
  ON audit_logs USING GIN (old_values, new_values);
```

**Estimated index size overhead:** ~15-20% additional storage (acceptable given query performance gains of 10-100x).

### N+1 Query Patterns (3 Confirmed)

The forensics audit identified **3 confirmed N+1 query patterns** that cause linear query explosion:

1. **User listing** (`user.helpers.ts` + `controllers/user.ts`): `formatUserResponse()` calls `getUserHealthScore()` (separate `prisma.healthPoints.findUnique()`) for each user. **Fix:** Use Prisma `include` to batch-fetch health points and onboarding progress in a single query.

2. **User detail** (`controllers/user.ts` GET `/:id`): Separate queries for user, formatted response, and onboarding status. **Fix:** Single `findUnique` with nested `include` for healthPoints and onboardingProgress.

3. **Multiple PrismaClient instances** (memory/resource leak): 5 controllers create their own `new PrismaClient()` instead of importing the singleton from `database/prisma.ts`. **Fix:** Import the singleton everywhere.

### AMH Compliance Gap: 35% → Target 95%+

Current AMH standards compliance is **35%**. The target after full integration is **95%+**. Key gaps driving this score:

| AMH Standard | Requirement | AUSTA Status |
|-------------|-------------|--------------|
| ADR-012 (KMS CMK per tenant) | Encryption keys via KMS, not env vars | ❌ env var only (0%) |
| ADR-005 (LF-Tags ABAC) | Fine-grained authorization | ❌ RBAC only (0%) |
| ADR-022 (GitHub OIDC) | Scoped CI/CD roles | ❌ Not integrated (0%) |
| ADR-009 (7-year audit retention) | Immutable audit retention | ✅ `retentionDays: 3650` (100%) |
| ADR-005 (Multi-tenant isolation) | S3 prefix + Glue DB + IAM | ⚠️ OrgId exists, no DB-level isolation (50%) |

### Updated Risk Register (Post-Forensics)

These forensics findings add urgency to existing plan items:

| Finding | Elevates Plan Item | New Priority |
|---------|-------------------|-------------|
| Dual auth (F2) | **E1-A (immediate):** Wire real auth controller | 🔴 Before any other work |
| Plaintext passwords (F1) | **E1-A:** Hash passwords in all creation paths | 🔴 Same PR as auth fix |
| JWT algorithm (F3) | **E1-A:** Pin JWT algorithm to HS256 | 🔴 Same PR |
| 7 missing indexes | **ENT-022:** Database query optimization | 🟠 Move from Phase 3 to Phase 1 |
| N+1 patterns | **ENT-022:** Database query optimization | 🟠 Move from Phase 3 to Phase 1 |
| npm audit 54 vulns | **New task:** Dependency upgrade sprint | 🟠 Phase 1 (1 week) |
| CORS + Helmet (F5, F6) | **New task:** Security hardening sprint | 🟠 Phase 1 (3 days) |
| PHI in responses (F7) | **ENT-008:** KMS encryption migration | 🟠 Accelerate to Phase 1 |
| Hardcoded keys (F4) | **ENT-008:** KMS encryption migration | 🔴 Rotate immediately |

---

## 0. Executive Summary

Coordenação-Cuidado (AUSTA) is a WhatsApp-first care coordination platform with genuine clinical domain expertise — risk scoring, emergency detection, gamified onboarding. After 4 development waves, it compiles with 0 TypeScript errors and runs locally. But it's a prototype.

**To become enterprise-grade paired with AMH Data Platform, AUSTA needs transformation across 5 dimensions:**

| Dimension | Current State | Enterprise Target | Effort |
|-----------|--------------|-------------------|--------|
| **Architecture** | Monolith + own PostgreSQL | Service integrated into AMH ecosystem | 12-16 weeks |
| **Security** | pgcrypto + env vars + JWT | KMS CMK + Cognito + ABAC | 6-8 weeks |
| **Scalability** | Single instance, no async | Multi-AZ, CDC-enabled, queue-driven | 4-6 weeks |
| **Compliance** | Partial LGPD, no ANVISA | Full ANVISA + SBIS + ISO 27001 path | 12-18 months |
| **Operations** | Manual deploy, local Docker | GitOps, Managed Grafana, PagerDuty | 4-6 weeks |

**Total estimated enterprise hardening: 26-40 weeks engineering + 12-18 months regulatory.**

---

## 1. Current State: What AUSTA Has (Post Waves 0-4)

### Strengths (Preserve)

| Asset | Value | Why |
|-------|-------|-----|
| Clinical scoring algorithms | 2,100+ lines | Risk assessment + emergency detection — core IP |
| Gamification system | Mission/HealthPoints/Achievement | Patient engagement differentiator |
| WhatsApp conversational UX | Z-API integration + webhook handling | Primary patient interface |
| Prisma schema | 18 models, 30+ enums | Well-normalized healthcare data model |
| Audit trail | Full 18-field AuditLog model | LGPD/ANS compliance foundation |
| CI/CD | 14 GitHub Actions workflows | Automated testing and deployment |
| Observability | Prometheus + Grafana + Jaeger | Monitoring foundation |
| Infrastructure as Code | 6 Terraform modules, K8s manifests | Production deployment ready |

### Gaps (Must Fix)

| Gap | Severity | Current Workaround |
|-----|----------|-------------------|
| No ANVISA classification | 🔴 Critical | Not addressed |
| HIPAA→LGPD done but ANVISA/SBIS pending | 🔴 Critical | Framework adopted, specialist not engaged |
| Patient identity duplicated (own User model vs AMH MPI) | 🟠 High | AUSTA maintains separate identity |
| Encryption keys in env vars, not KMS | 🟠 High | pgcrypto works but key management is dev-grade |
| No CDC/streaming — all processing synchronous | 🟠 High | REST APIs are blocking |
| Monolith deployment — no service isolation | 🟡 Medium | Works for prototype, not for 100K users |
| Custom JWT auth — not federated | 🟡 Medium | No SSO, no Cognito integration |
| No FHIR for clinical scores | 🟡 Medium | Scores stored in PostgreSQL only |

---

## 2. AMH Data Platform: What It Provides

AMH is a **Tier 0 Mission Critical production lakehouse** with 33 ADRs. AUSTA's tenant `austa_clinicas` already exists.

### AMH Capabilities AUSTA Must Consume

| AMH Capability | ADR | How AUSTA Uses It |
|---------------|-----|-------------------|
| **MPI — Master Patient Index** | ADR-006 | AUSTA resolves patient identity via MPI API. Stores `mpi_id`, not duplicate identity. |
| **HAPI FHIR Server** | ADR-007 | AUSTA publishes clinical scores as FHIR Observations. Consumes patient demographics. |
| **MSK Serverless (Kafka)** | ADR-002 | AUSTA emits CDC events: conversations, scores, gamification events. |
| **Iceberg Lakehouse** | ADR-001 | Analytical queries on AUSTA data via Athena. Dashboards in Grafana. |
| **KMS CMK per Tenant** | ADR-012 | AUSTA encrypts PHI with `austa_clinicas` KMS key instead of pgcrypto env var. |
| **Cognito + ABAC** | ADR-016a, ADR-005 | AUSTA authenticates via Cognito. Authorization via LF-Tags ABAC. |
| **AMP + Managed Grafana** | ADR-011 | AUSTA emits OTel spans. Dashboards in AMH workspace. |
| **MWAA (Airflow)** | ADR-003 | Scheduled jobs: data quality checks, report generation. |
| **Glue Schema Registry** | ADR-010 | AUSTA CDC events validated against Avro schemas. |

### AMH Principles AUSTA Must Follow

1. **Managed-first**: Use AWS managed services, not self-managed (from ADR-002, ADR-003, ADR-004)
2. **ACID by Default**: All data writes are ACID via Iceberg (ADR-001)
3. **Streaming-first for clinical data**: CDC, not batch ETL (ADR-025, ADR-026)
4. **Defense in depth**: Multi-layer tenant isolation (ADR-005)
5. **7-year retention**: All audit data, immutable (ADR-009)

---

## 3. Target Enterprise Architecture

### 3.1 Container Diagram (Enterprise)

```
┌─────────────────────────────────────────────────────────────────┐
│                        AUSTA Care Platform                        │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ WhatsApp  │  │  Clinical  │  │Gamification│  │  Authorization │  │
│  │  Service  │  │  Engine   │  │  Engine  │  │    Workflow    │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └───────┬────────┘  │
│       │              │              │                 │           │
│  ┌────┴──────────────┴──────────────┴─────────────────┴────┐      │
│  │              AUSTA PostgreSQL (RDS Aurora)               │      │
│  │       Transactions ONLY — not analytical queries         │      │
│  └──────────────────────────┬──────────────────────────────┘      │
│                             │                                      │
│                    Debezium CDC (ECS Fargate)                      │
└─────────────────────────────┼──────────────────────────────────────┘
                              │
              ╔═══════════════╧═══════════════════╗
              ║      AMH Data Platform            ║
              ║                                    ║
              ║  MSK Serverless (Kafka)            ║
              ║    ↓                               ║
              ║  Managed Flink (FHIR mapper)       ║
              ║    ↓                    ↓          ║
              ║  HAPI FHIR          Iceberg        ║
              ║  (Aurora)        (S3 sa-east-1)    ║
              ║    ↓                    ↓          ║
              ║  RNDS/Partners     Athena/Grafana   ║
              ║                                    ║
              ║  Shared Services:                  ║
              ║  - MPI (patient identity)          ║
              ║  - Cognito (auth)                  ║
              ║  - KMS (encryption keys)           ║
              ║  - AMP/Grafana (observability)     ║
              ║  - Glue Schema Registry            ║
              ╚════════════════════════════════════╝
```

### 3.2 Key Architectural Decisions for Enterprise

| Decision | Rationale |
|----------|-----------|
| **AUSTA keeps its own PostgreSQL** | Transactional workload (OLTP) vs AMH analytical (OLAP) — different SLOs |
| **Debezium CDC bridges the gap** | AUSTA events flow into AMH lakehouse without AUSTA knowing about Iceberg |
| **FHIR via AMH HAPI, not AUSTA** | Single FHIR endpoint for entire organization. AUSTA publishes, doesn't serve. |
| **MPI as identity source of truth** | AUSTA User model gains `mpi_id` FK. No duplicate identity resolution. |
| **Cognito replaces custom JWT** | Federation across all AMH products. Single sign-on for providers and patients. |
| **KMS replaces pgcrypto env var** | Per-tenant key management, automatic rotation, AWS CloudTrail audit. |

### 3.3 Data Flow: Patient Onboarding (Enterprise)

```
1. Patient sends WhatsApp message
2. AUSTA WhatsApp Service receives via webhook
3. AUSTA creates/updates User in PostgreSQL (with phone, name, etc.)
4. AUSTA calls MPI API: "resolve patient with phone=+5511999999999"
5. MPI returns: { mpi_id: "mpi-abc123", confidence: 0.97, golden_record: {...} }
6. AUSTA stores mpi_id on User record
7. Debezium captures CDC: User created → MSK topic austa.users
8. Flink maps to FHIR Patient resource → HAPI FHIR
9. AUSTA runs risk assessment → stores score in PostgreSQL
10. Debezium captures CDC: HealthData created → MSK topic austa.clinical_scores
11. Flink maps to FHIR Observation → HAPI FHIR
12. Both raw events land in Iceberg Bronze → Silver → Gold
13. Athena queries available for population analytics
```

### 3.4 Security Architecture (Enterprise)

```
                    ┌─────────────┐
                    │   Cognito    │ ← User Pool (patients, providers, admins)
                    └──────┬──────┘
                           │ JWT with tenant claims
                    ┌──────┴──────┐
                    │  API Gateway │ ← WAF + rate limiting + JWT validation
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
         │  AUSTA  │ │  HAPI   │ │   MPI   │
         │  (ECS)  │ │  (ECS)  │ │  (ECS)  │
         └────┬────┘ └────┬────┘ └────┬────┘
              │            │            │
         ┌────┴────────────┴────────────┴────┐
         │        KMS CMK (per tenant)         │
         │   Encrypts: PHI columns, S3 data    │
         └─────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │    Lake Formation ABAC         │
         │  LF-Tag: tenant=austa_clinicas │
         │  Permissions via session tags   │
         └───────────────────────────────┘
```

---

## 4. Gap Analysis: What Must Be Built

### Phase 1: Foundation (Weeks 1-6) — "AMH Integration Skeleton"

| ID | Task | Effort | Dependencies |
|----|------|--------|-------------|
| **ENT-001** | Provision AUSTA resources in AMH AWS account (VPC, ECS, RDS Aurora) | M (2 wk) | Terraform modules exist |
| **ENT-002** | Set up Debezium CDC on AUSTA PostgreSQL → MSK | M (2 wk) | ENT-001 |
| **ENT-003** | Register Avro schemas in Glue Schema Registry for AUSTA topics | S (1 wk) | ENT-002 |
| **ENT-004** | Create Flink job: AUSTA CDC → FHIR mapper → HAPI FHIR | L (3 wk) | ENT-003 |
| **ENT-005** | Integrate AUSTA auth with Cognito (replace custom JWT) ** | M (2 wk) | Cognito pool exists (ADR-016a) |
| **ENT-006** | Add `mpi_id` to AUSTA User model + migration | S (3 days) | None |
| **ENT-007** | Implement MPI client in AUSTA (REST API call on onboarding) | S (1 wk) | ENT-006 |
| **ENT-008** | Migrate encryption from pgcrypto env var to KMS CMK | M (2 wk) | ENT-001 |
| **ENT-009** | Emit OpenTelemetry spans from AUSTA → AMH OTel Collector | S (1 wk) | ENT-001 |
| **ENT-010** | Create AUSTA dashboards in AMH Managed Grafana workspace | S (1 wk) | ENT-009 |

### Phase 2: Hardening (Weeks 7-14) — "Production Ready"

| ID | Task | Effort | Dependencies |
|----|------|--------|-------------|
| **ENT-011** | Make WhatsApp processing async (BullMQ queue) | M (2 wk) | ENT-001 |
| **ENT-012** | Make clinical scoring async (BullMQ queue) | S (1 wk) | ENT-001 |
| **ENT-013** | Make OCR processing async with DLQ | M (2 wk) | ENT-012 |
| **ENT-014** | Implement circuit breaker for external APIs (OpenAI, Z-API, Tasy) | M (2 wk) | ENT-011 |
| **ENT-015** | Configure RDS Proxy for connection pooling | S (1 wk) | ENT-001 |
| **ENT-016** | Implement read replicas for analytical queries | S (1 wk) | ENT-015 |
| **ENT-017** | Partition large tables (conversations, messages, audit_logs) | M (2 wk) | ENT-015 |
| **ENT-018** | PgBouncer for connection pooling (if RDS Proxy insufficient) | S (1 wk) | ENT-015 |
| **ENT-019** | Multi-AZ deployment (ECS tasks in 3 AZs) | S (1 wk) | ENT-001 |
| **ENT-020** | Configure K8s HPA with custom metrics (queue depth, latency) | S (1 wk) | ENT-019 |

### Phase 3: Scale (Weeks 15-22) — "100K+ Ready"

| ID | Task | Effort | Dependencies |
|----|------|--------|-------------|
| **ENT-021** | Load testing: simulate 10K concurrent WhatsApp conversations | M (2 wk) | ENT-011-020 |
| **ENT-022** | Database query optimization based on load test findings | M (2 wk) | ENT-021 |
| **ENT-023** | Redis Cluster (from single node) for session + cache HA | M (2 wk) | ENT-019 |
| **ENT-024** | CDN for frontend assets (CloudFront) | S (1 wk) | None |
| **ENT-025** | Implement data archival strategy (old conversations → S3) | M (2 wk) | ENT-017 |
| **ENT-026** | Horizontal scaling: target 500 req/s per ECS task | S (1 wk) | ENT-019 |
| **ENT-027** | Chaos engineering: test failure scenarios (Redis down, DB failover) | M (2 wk) | ENT-019 |
| **ENT-028** | DR plan: cross-region replication (sa-east-1 → us-east-2) | M (2 wk) | ENT-019 |

### Phase 4: Regulatory (Months 1-18) — "Compliance Complete"

| ID | Task | Effort | Dependencies |
|----|------|--------|-------------|
| **ENT-029** | Engage ANVISA specialist → classify as SaMD Classe II/III | M (2-4 mo) | None |
| **ENT-030** | Prepare ANVISA registration dossier (clinical evidence, architecture docs) | L (3-6 mo) | ENT-029 |
| **ENT-031** | Initiate SBIS certification process | M (3-6 mo) | ENT-001-020 |
| **ENT-032** | ISO 27001 gap analysis → remediation → certification | XL (12-18 mo) | ENT-001-020 |
| **ENT-033** | External penetration test (annual requirement) | S (2 wk) | ENT-001-010 |
| **ENT-034** | LGPD RIPD (Data Protection Impact Report) | M (1 mo) | None |
| **ENT-035** | DPO designation + ANPD registration | S (1 wk) | None |
| **ENT-036** | Breach notification procedure + drill | S (1 wk) | ENT-035 |

---

## 5. Integration Contracts: AUSTA ↔ AMH

### 5.1 AUSTA → AMH (Data Producer)

| Data Type | Mechanism | Topic / Target | Schema |
|-----------|-----------|---------------|--------|
| New patient registered | Debezium CDC | `austa.users` | Avro (Glue Registry) |
| Conversation message | Debezium CDC | `austa.conversations` | Avro |
| Clinical score (risk) | REST API → HAPI FHIR | `POST /fhir/Observation` | FHIR R4 |
| Emergency alert | REST API → HAPI FHIR | `POST /fhir/Flag` | FHIR R4 |
| Gamification event | Debezium CDC | `austa.gamification` | Avro |
| Authorization decision | Debezium CDC | `austa.authorizations` | Avro |
| Audit log entry | Debezium CDC | `austa.audit_logs` | Avro |

### 5.2 AMH → AUSTA (Data Consumer)

| Data Type | Mechanism | Endpoint | Caching |
|-----------|-----------|----------|---------|
| Patient identity (MPI) | REST API | `GET /mpi/resolve?phone=X` | Redis TTL 1h |
| Patient demographics | HAPI FHIR | `GET /fhir/Patient/{mpi_id}` | Redis TTL 30min |
| Population risk stats | Athena (Gold) | Query `amh_austa_clinicas_gold.population_risk` | Scheduled cache refresh |
| Provider directory | HAPI FHIR | `GET /fhir/Practitioner?organization=X` | Redis TTL 1h |
| Drug formulary | HAPI FHIR | `GET /fhir/MedicationKnowledge` | Redis TTL 24h |

---

## 6. Enterprise Security Posture

### 6.1 Before vs After

| Security Control | Current (Dev) | Enterprise Target |
|-----------------|---------------|-------------------|
| **AuthN** | Custom JWT (jsonwebtoken) | Cognito User Pool with OIDC |
| **AuthZ** | RBAC (ProviderRole enum) | ABAC via Lake Formation LF-Tags + IAM |
| **Encryption at Rest** | pgcrypto + env var key | KMS CMK per tenant, automatic rotation |
| **Encryption in Transit** | TLS (Nginx) | TLS 1.3 + VPC internal traffic encryption |
| **Secrets** | .env + start-dev.sh | AWS Secrets Manager + KMS |
| **API Security** | Helmet + rate-limit | WAF + API Gateway + rate-limit + Shield |
| **Audit** | PostgreSQL AuditLog | CloudTrail + S3 Object Lock + AUSTA AuditLog |
| **Network** | Docker bridge | VPC private subnets + Security Groups + NACLs |
| **Vulnerability Mgmt** | npm audit (manual) | Amazon Inspector + Dependabot + ECR scanning |
| **SIEM** | None | CloudTrail → Security Lake → Athena queries |

### 6.2 Zero-Trust Implementation

1. **No public endpoints** — everything behind API Gateway + WAF
2. **Service-to-service auth** — IAM roles, not API keys
3. **Just-in-time access** — no standing credentials for production
4. **Session-based access** — Cognito + LF-Tags for data access
5. **All access logged** — CloudTrail + AUSTA AuditLog → S3 immutable

---

## 7. Scalability Model

### 7.1 Capacity Planning

| Metric | 1K Users | 10K Users | 100K Users |
|--------|----------|-----------|------------|
| DAU (10% of total) | 100 | 1,000 | 10,000 |
| WhatsApp msg/day | 500 | 5,000 | 50,000 |
| Clinical scores/day | 50 | 500 | 5,000 |
| Peak req/s | 10 | 100 | 1,000 |
| ECS tasks | 2 (0.5 vCPU) | 4 (1 vCPU) | 10+ (2 vCPU) |
| RDS instance | db.t3.medium | db.r5.large | db.r5.2xlarge |
| Redis node | cache.t3.micro | cache.t3.small | cache.m5.large |
| Monthly cost (est) | ~$500 | ~$2,500 | ~$12,000 |

### 7.2 Scaling Triggers

| Trigger | Action |
|---------|--------|
| CPU > 70% for 5 min | Add 1 ECS task |
| Queue depth > 1000 | Add 2 ECS tasks |
| DB connections > 80% | Scale up RDS or add read replica |
| Redis memory > 75% | Scale up ElastiCache |
| API P95 latency > 500ms | Investigate + scale |

---

## 8. Operational Model

### 8.1 Deployment Pipeline (Enterprise)

```
PR Merge → GitHub Actions CI (type-check, lint, test)
         → Build Docker image → push to ECR
         → Deploy to staging (ECS rolling update)
         → Smoke tests (health check, critical paths)
         → Approval gate (required for production)
         → Deploy to production (blue/green via ECS)
         → Canary: 10% traffic for 30 min
         → Full rollout
         → Monitor (Grafana dashboard + alerts)
```

### 8.2 Incident Response

| Severity | Response Time | Escalation |
|----------|--------------|------------|
| **SEV1** (Platform down) | 5 min acknowledge, 30 min resolve | CTO + SRE Lead |
| **SEV2** (Feature broken) | 15 min acknowledge, 2 hr resolve | SRE + Eng Lead |
| **SEV3** (Performance degraded) | 1 hr acknowledge, next business day | Eng team |

### 8.3 SLOs

| Service | SLO | Measurement |
|---------|-----|-------------|
| WhatsApp webhook processing | 99.9% availability, P95 < 3s | Prometheus |
| Clinical risk assessment | 99.5% availability, P95 < 2s | Prometheus |
| Patient onboarding | 99.9% availability, P95 < 5s | Prometheus |
| FHIR Observation publish | 99.9% availability, P95 < 1s | HAPI metrics |
| MPI resolution | 99.95% availability, P95 < 200ms | MPI service metrics |

---

## 9. Cost Model (Running on AMH Infrastructure)

### 9.1 Monthly Run Rate (Production, 10K users)

| Service | Resource | Monthly Cost |
|---------|----------|-------------|
| ECS Fargate (AUSTA backend) | 4 tasks × 1 vCPU / 2GB | ~$250 |
| ECS Fargate (Debezium CDC) | 1 task × 0.5 vCPU / 1GB | ~$50 |
| RDS Aurora PostgreSQL | db.r5.large, Multi-AZ | ~$350 |
| ElastiCache Redis | cache.t3.small | ~$40 |
| MSK Serverless | Ingestion + processing | ~$400 |
| Managed Flink | 2 KPU | ~$200 |
| HAPI FHIR (ECS) | 2 tasks × 1 vCPU / 2GB | ~$120 |
| Cognito | 10K MAU | ~$50 |
| KMS | Per-tenant CMK | ~$10 |
| API Gateway + WAF | 50K req/day | ~$80 |
| AMP + Grafana | Managed workspace | ~$120 |
| Secrets Manager | 20 secrets | ~$10 |
| CloudTrail + S3 | Audit logs | ~$50 |
| **TOTAL** | | **~$1,730/month** |

### 9.2 Shared AMH Infrastructure (Allocated Cost)

| Service | AUSTA Allocation | Monthly |
|---------|-----------------|---------|
| Athena queries | 500 queries/day | ~$100 |
| S3 storage (Iceberg) | 500 GB Bronze + Silver + Gold | ~$25 |
| MWAA (Airflow) | 2 DAGs for AUSTA data quality | ~$80 |
| DataHub (Lineage) | Metadata storage | ~$10 |
| **TOTAL Shared** | | **~$215/month** |

### 9.3 Total Platform Cost

| Stage | Users | Total Monthly |
|-------|-------|---------------|
| Staging/Dev | — | ~$500 |
| Production (1K users) | 1,000 | ~$1,000 |
| Production (10K users) | 10,000 | ~$1,945 |
| Production (100K users) | 100,000 | ~$12,000 |

---

## 10. Team & Organizational Requirements

### 10.1 Required Roles

| Role | FTE | Responsibility |
|------|-----|---------------|
| **Platform Engineer** | 1 | AUSTA infrastructure, Terraform, ECS, CI/CD |
| **Backend Engineer** | 2 | TypeScript/Express, clinical services, FHIR integration |
| **Frontend Engineer** | 1 | React PWA, patient UX, WhatsApp templates |
| **SRE** | 0.5 (shared with AMH) | Monitoring, incident response, on-call rotation |
| **Data Engineer** | 0.5 (shared with AMH) | Flink jobs, Avro schemas, Iceberg tables |
| **Security Engineer** | 0.5 (shared with AMH) | Pen testing, vulnerability management, compliance |
| **Clinical Domain Expert** | 0.5 | Algorithm validation, clinical accuracy review |
| **Regulatory Specialist** | 0.25 (shared) | ANVISA, SBIS, ISO 27001 coordination |
| **Product Manager** | 1 | Roadmap, stakeholder management, user research |

**Total: 7.25 FTE** (4.25 dedicated + 3 shared with AMH)

---

## 11. Key Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ANVISA classification takes >12 months | Medium | Critical | Start immediately. Prepare dossier in parallel with engineering. |
| Debezium CDC impacts AUSTA PostgreSQL performance | Medium | High | Use RDS replica for CDC. Monitor replication lag. |
| Cognito migration breaks existing auth | Low | High | Dual-auth during transition. Feature flag: use_cognito. |
| MPI resolution latency slows onboarding | Low | Medium | Cache MPI results in Redis. Async resolution for non-critical paths. |
| KMS key rotation causes decryption failures | Low | Critical | Test rotation in staging. Keep old key available during transition period. |
| AMH platform dependency creates tight coupling | Medium | Medium | Clean API contracts. AUSTA can run standalone (without AMH) for development. |

---

## 12. Immediate Next Steps (Ordered by Impact × Urgency)

| # | Action | Impact | Effort | Owner |
|---|--------|--------|--------|-------|
| 1 | Engage ANVISA regulatory specialist | 🔴 Critical | Start now | CEO + CTO |
| 2 | Add `mpi_id` to AUSTA User model + migration | 🟠 High | 3 days | Backend Eng |
| 3 | Set up AUSTA resources in AMH AWS account (Terraform) | 🟠 High | 2 weeks | Platform Eng |
| 4 | Implement MPI client in AUSTA (REST API call) | 🟠 High | 1 week | Backend Eng |
| 5 | Create Debezium CDC connector for AUSTA PostgreSQL | 🟠 High | 2 weeks | Data Eng |
| 6 | Create Avro schemas for AUSTA topics in Glue Registry | 🟡 Medium | 1 week | Data Eng |
| 7 | Implement Cognito auth in AUSTA (feature-flagged) | 🟡 Medium | 2 weeks | Backend Eng |
| 8 | Migrate encryption keys to KMS CMK | 🟡 Medium | 2 weeks | Security Eng |
| 9 | PgBouncer + RDS Proxy setup | 🟡 Medium | 1 week | Platform Eng |
| 10 | Load test with 10K concurrent users | 🟡 Medium | 2 weeks | SRE |

---

*Document updated with forensics agent findings on 2026-06-27. See "Forensics Findings Incorporated" section above for security score (52/100), 54 npm audit vulnerabilities, 7 missing indexes with SQL, 3 N+1 query patterns, dual auth issue (E1-A), and AMH compliance gap analysis (35% → 95%+ target).*
