# Section 6: Compliance & Risk Analysis (Regulatory, Security & Audit)

## AUSTA Care Platform — Coordenação-Cuidado Enterprise

**Analysis Date:** 2026-06-26
**Jurisdiction:** Federative Republic of Brazil
**Primary Regulatory Framework:** LGPD (Lei 13.709/2018), ANVISA (RDC 657/2022), CFM Resolutions, ANS (RN 563/2024)
**Analyst:** Compliance & Security Specialist Agent

---

## 6.1 Regulatory Classification

### 6.1.1 ANVISA SaMD Classification — 🔴 CRITICAL GAP

The platform performs functions that clearly fall under ANVISA RDC 657/2022 (Software as Medical Device):

| Function | ANVISA Class | Rationale |
|----------|-------------|-----------|
| Symptom Analysis Engine | **Classe II** | Analyzes patient data and generates risk-stratified recommendations (see Requisitos.md §3.3.1, lines 220-257) |
| Risk Stratification Algorithm | **Classe II–III** | `calculate_risk_score()` pseudocode (Requisitos.md lines 279-290) computes risk scores 0-100 for clinical triage — impacts patient care pathway decisions |
| Emergency Detection Rules | **Classe III** | Automatic escalation based on cardiac, diabetes, apnea, and depression risk patterns (Questionary_Sugested.md lines 914-920, README_AI_INTEGRATION.md lines 114-122) |
| Clinical Decision Support (Authorization) | **Classe II** | Automated approval/denial of medical procedures with AI-driven eligibility checking (Requisitos.md §3.5.1, lines 330-341) |

**Finding:** The platform is almost certainly a SaMD. The `intended use statement` (mandatory for ANVISA classification) has not been written. Without ANVISA registration, the platform **cannot legally process real patient clinical data** in Brazil.

**Source evidence:**
- Requisitos.md §3.3.1 defines symptom analysis with severity scoring and escalation to emergency services — this constitutes clinical decision support
- README_AI_INTEGRATION.md lines 114-129 define automatic health risk scoring with numeric thresholds (≥80 = critical, 60-79 = high)
- No mention of ANVISA, RDC 657/2022, or SaMD in any project documentation (search: 0 results for "SaMD", 4 for "ANVISA" — only 1 in non-review docs)

### 6.1.2 Required Certifications — 🔴 MAJOR GAPS

| Certification | Status | Required For |
|--------------|--------|--------------|
| **SBIS (Sociedade Brasileira de Informática em Saúde)** | ❌ Not mentioned | Mandatory in practice for Brazilian hospital software procurement |
| **ISO 27001** | ⚠️ Claimed but not certified | Information Security Management System — cannot claim without formal audit |
| **Pentest Externo (Annual)** | ❌ Not conducted | Required by hospital procurement contracts |
| **ANVISA Cadastro/Registro** | ❌ Not initiated | Required for SaMD before clinical use |

**Evidence:**
- Requisitos.md §4.2, line 410: "ISO 27001: Security management system" — claims compliance without certification
- Prisma README.md line 1: "HIPAA-compliant healthcare platform" — misleading for Brazilian context
- `search_files(pattern="SBIS")` across entire repository: 0 results

---

## 6.2 HIPAA vs LGPD Confusion — 🔴 CRITICAL FINDING

### 6.2.1 The Core Issue

The AUSTA Care Platform is a **Brazilian healthcare platform** targeting the Brazilian supplementary health market (planos de saúde). **HIPAA (U.S. Health Insurance Portability and Accountability Act) does not apply to Brazil-only deployments.** The applicable law is **LGPD (Lei Geral de Proteção de Dados, Lei 13.709/2018)** .

Despite this, HIPAA is referenced **18 times** across the codebase, compared to only **4 times** for LGPD.

### 6.2.2 HIPAA Reference Inventory

| File | HIPAA Occurrences | Context | Severity |
|------|------------------|---------|----------|
| `prisma/DATABASE_SCHEMA_DOCUMENTATION.md` | 9 | "HIPAA-compliant healthcare platform", "HIPAA audit reports", "HIPAA Compliance" section header | 🔴 Misleading |
| `prisma/README.md` | 5 | "HIPAA-compliant healthcare platform" (line 1), "HIPAA Compliance" features (line 79), "HIPAA Audit Trails" (line 137) | 🔴 Misleading |
| `prisma/schema.prisma` | 3 | `hipaaRelevant` field on AuditLog (line 893), `hipaaCompliant` on Organization (line 29), "HIPAA-compliant" comment (line 2) | 🟠 Inaccurate |
| `prisma/migrations/001_init_austa_care_schema.sql` | 1 | "HIPAA-compliant" header comment (line 3) | 🟡 Minor |

**Key Examples:**
- **Schema line 2:** `// Austa Care Platform - Comprehensive Prisma Database Schema` → `// HIPAA-compliant, multi-tenant healthcare platform with WhatsApp integration`
- **Organization model line 29:** `hipaaCompliant Boolean @default(false)` — no corresponding `lgpdCompliant` field
- **DATABASE_SCHEMA_DOCUMENTATION.md line 262:** Links to `https://www.hhs.gov/hipaa/...` (U.S. government website) — irrelevant for Brazil
- **.env.example lines 117-121:** `HIPAA_ENABLED=true` — no enforcement mechanism

### 6.2.3 LGPD Reference Inventory

| File | LGPD Occurrences | Context | Assessment |
|------|-----------------|---------|------------|
| `prisma/README.md` line 138 | 1 | "LGPD (Brazilian privacy law) compliance" | Superficial |
| `prisma/DATABASE_SCHEMA_DOCUMENTATION.md` | 1 | "HIPAA and LGPD compliance logging" | Secondary mention |
| `backend/README_AI_INTEGRATION.md` | 2 | "LGPD Compliance - Explicit consent management" (line 222), "How do I handle LGPD compliance?" FAQ (line 462) | Surface-level |
| `docs/Requisitos.md` §4.2 | 1 | "LGPD: Consentimento granular, direito ao esquecimento, portabilidade" | Listed as compliance checkbox |

**Finding:** HIPAA dominates the compliance narrative 4.5:1 over LGPD. The platform's self-description as "HIPAA-compliant" is **factually incorrect for a Brazil-only deployment** and could constitute a **regulatory misrepresentation**.

### 6.2.4 LGPD Deep Assessment

#### ✅ Present (but superficial):
- **Consent management**: LGPD consent flow in Questionary_Sugested.md §1.2 (lines 84-120) — gamified, with explicit opt-out and "modo limitado"
- **Right to erasure**: "direito ao esquecimento" mentioned in Requisitos.md §4.2 (line 407)
- **Data portability**: "portabilidade" mentioned in Requisitos.md §4.2 (line 407)
- **AuditLog field**: `lgpdRelevant` Boolean exists on schema line 894
- **Audit service compliance rules**: `lgpd-data-access`, `lgpd-consent-tracking`, `lgpd-data-deletion` rules defined in auditService.ts lines 37-66

#### ❌ Missing (CRITICAL):
- **RIPD (Relatório de Impacto à Proteção de Dados Pessoais)**: Mandatory under LGPD Art. 38 for large-scale processing of sensitive health data. **Not mentioned anywhere.** (search: 0 results for "RIPD", "DPIA", "impacto", "relatório de impacto")
- **DPO/Encarregado**: Data Protection Officer appointment required by LGPD Art. 41. **Not mentioned anywhere.** (search: 0 results for "DPO", "encarregado", "data protection officer")
- **Breach Notification**: LGPD Art. 48 requires notification to ANPD within 48 hours of a data breach. **Not mentioned anywhere.** (search: 0 results for "breach", "ANPD", "48 horas")
- **Legal Basis for Processing**: LGPD Art. 11, II requires specific legal basis for sensitive health data. "Proteção da vida" (Art. 11, II, g) would apply in ICU/emergency contexts but **NOT** for gamification, wellness scoring, or marketing. The platform mixes clinical and non-clinical purposes without documenting distinct legal bases.
- **International Data Transfer**: If OpenAI API is used (GPT-4), patient data may be transferred to U.S. servers — requires LGPD Art. 33 safeguards (adequacy decision, SCCs, etc.). **Not addressed.**

---

## 6.3 PHI/PII Handling — 🟠 HIGH RISK

### 6.3.1 Data Classification

The schema defines sensitivity levels for health data (schema lines 1057-1063):
- `PUBLIC`, `NORMAL`, `SENSITIVE`, `HIGHLY_SENSITIVE`, `CONFIDENTIAL`
- `accessLevel`: `PATIENT_ONLY`, `PROVIDER_PATIENT`, `ORGANIZATION`, `SYSTEM_ADMIN`

And access control matrix (DATABASE_SCHEMA_DOCUMENTATION.md lines 316-322):
- Patient → Own data only
- Provider → Org patient data
- Admin → Org data
- System → All data

**Finding:** Access control classification exists in schema but enforcement is middleware-based (`requireRole()`, `requirePermission()` in auth.ts lines 97-167) with no row-level security implementation in the database itself.

### 6.3.2 Encryption Implementation — 🔴 CRITICAL GAP

| Claim | Source | Implementation Status |
|-------|--------|----------------------|
| "CPF encrypted at application level" | schema.prisma line 65, DATABASE_SCHEMA_DOCUMENTATION.md line 53 | ❌ **No encryption code found** in backend source — `search_files(pattern="encrypt|decrypt|crypto")` in backend/src returned 0 results |
| "Health data encrypted in JSONB fields" | DATABASE_SCHEMA_DOCUMENTATION.md line 128 | ❌ **No encryption code found** |
| "AES-256 encryption at rest" | Requisitos.md line 401 | ⚠️ `pgcrypto` extension is LOADED (migration line 7) but **never used** in schema or backend |
| "PII tokenization" | Requisitos.md line 404 | ❌ **No tokenization implementation found** |
| `isEncrypted` flag on Documents | schema line 616 | ⚠️ Flag exists but `@default(false)` — not enforced |
| `ENCRYPTION_KEY` env var | config.ts line 50, .env.example line 28 | ✅ Variable exists, but no code uses it for PHI |

**The `pgcrypto` extension** is loaded in the migration (line 7: `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`), but the schema uses no pgcrypto functions (no `pgp_sym_encrypt`, no `pgp_pub_encrypt`, no column-level encryption). The extension was loaded but **never utilized**.

### 6.3.3 Data Residency — 🟠 HIGH RISK

| Concern | Finding |
|---------|---------|
| **AWS Region** | Terraform `terraform.tfvars.example` line 7: `aws_region = "us-east-1"` — **NOT sa-east-1 (São Paulo)**. Data would leave Brazil. |
| **OpenAI API** | Patient data sent to OpenAI (U.S.-based). No data processing agreement, no SCCs mentioned. |
| **WhatsApp Business API** | Meta infrastructure (global). Data may transit outside Brazil. BAA with Meta mentioned in Requisitos.md line 408 — but HIPAA BAA is irrelevant for Brazil. |

### 6.3.4 PII Fields Inventory

| Field | Location | Risk |
|-------|----------|------|
| `cpf` | User model (schema line 66) | 🔴 Brazilian tax ID — sensitive PII, claimed encrypted but not verified |
| `phone` | User model (schema line 65) | 🔴 Primary identifier, unique |
| `emergencyContact` | User model (schema line 95) | 🟠 Third-party PII, claimed encrypted |
| `dateOfBirth` | User model (schema line 67) | 🟡 Combined with CPF, enables identity fraud |
| `address` (Organization) | Organization model (schema line 21) | 🟡 JSONB field |
| Health data fields | HealthData model (schema lines 291-296) | 🔴 Medical conditions, medications, allergies — all JSONB |

---

## 6.4 Audit Trail Assessment — 🟠 HIGH RISK

### 6.4.1 Schema vs Implementation Gap

The `AuditLog` model (schema lines 861-918) is **comprehensive**:
- Entity tracking (userId, providerId, organizationId)
- Change tracking (oldValues, newValues, changedFields)
- Context (sessionId, requestId, userAgent, ipAddress)
- Risk assessment (riskLevel, sensitiveData, requiresReview)
- Compliance flags (hipaaRelevant, lgpdRelevant)
- 14 audit action types in `AuditAction` enum (lines 1199-1215)

**However, the model is not wired to any actual persistence layer.**

### 6.4.2 auditService.ts Analysis

The audit service (805 lines, `backend/src/services/auditService.ts`) is a **scaffold/placeholder**:

| Method | Line | Issue |
|--------|------|-------|
| `storeAuditEntry()` | 422-440 | Stores in **in-memory `Map<string, AuditEntry[]>`** — lost on server restart |
| `flushAuditBuffer()` | 564-592 | Comment at line 576: `"In production, batch insert to database"` — **does not actually persist** |
| `getAuditEntries()` | 597-601 | Returns **empty array** `return [];` for all queries |
| `encryptMetadata()` | 544-548 | Comment: `"In production, implement proper encryption. For now, return as-is"` — **no-op** |
| `createANSComplianceRecord()` | 531-539 | **Empty method body** — only logs |
| `storeComplianceReport()` | 676-679 | **Logs only** — "In production, store in database" |
| `detectComplianceViolations()` | 619-625 | Returns `[]` — "In production, implement sophisticated violation detection" |
| `calculateProcessingTimeMetrics()` | 630-637 | Returns hardcoded zeros |

### 6.4.3 audit.middleware.ts Analysis

The audit middleware (116 lines, `backend/src/middleware/audit.middleware.ts`):

- ✅ Logs all write operations (POST/PUT/PATCH/DELETE)
- ✅ Logs failed requests (status >= 400)
- ✅ Logs sensitive paths (`/api/v1/users`, `/api/v1/health-data`, `/api/v1/documents`)
- ✅ Sanitizes sensitive fields (password, token, secret, apiKey)
- ❌ **Logs to Winston logger only** — does NOT write to AuditLog table
- ❌ No correlation with auditService.ts ledger
- ❌ Audit trail is in application logs — **mutable, not append-only, not guaranteed durable**

### 6.4.4 Healthcare Invariants Assessment

| # | Invariant | Status | Evidence | Gap |
|---|-----------|--------|----------|-----|
| a | **Immutable append-only audit trail** | ❌ Red | Audit middleware → Winston logger (mutable files). Audit service → in-memory buffer (volatile). No database persistence. | LGPD Art. 6º, VII requires accountability; immutable audit trail is foundational. |
| b | **Idempotency for HL7/FHIR messages** | ❌ Red | No HL7 handling. No idempotency key pattern (MSH-10 for HL7, `X-Idempotency-Key` for REST). FHIR server is in docker-compose.infrastructure.yml but platform code doesn't produce FHIR messages. | Duplicate message processing could trigger duplicate authorizations, notifications, or clinical events. |
| c | **Algorithm versioning for clinical scores** | ❌ Red | Risk scoring in `calculateRiskScore()` pseudocode (Requisitos.md lines 279-290) has no version field. README_AI_INTEGRATION.md describes scoring rules (lines 114-129) without versioning. No model registry, no A/B test tracking. | ANVISA requires documentation of algorithm versions that produced clinical decisions. Without versioning, retrospective audits of "what scored this patient as high risk" are impossible. |
| d | **Encryption at rest** | ❌ Red | `pgcrypto` loaded but unused. `ENCRYPTION_KEY` in config but no crypto code in source. `encryptMetadata()` is a no-op. Schema fields have `isEncrypted` flag (default: false). | Health data in plaintext JSONB. CPF in plaintext. Violates LGPD Art. 46 (security measures) and Art. 49 (appropriate technical measures for sensitive data). |
| e | **Health check + dead man's switch** | ⚠️ Yellow | Docker Compose healthchecks: PostgreSQL (`pg_isready`), Redis (`redis-cli ping`), Prometheus, Jaeger, Elasticsearch, MinIO, MongoDB. No dead man's switch — if all health checks pass but audit trail is broken, no alert fires. | No monitoring that audit entries are actually being persisted. |
| f | **Retry with backoff for outbound notifications** | ⚠️ Yellow | Z-API WhatsApp has retry config (config.ts lines 128-131: `attempts: 3, delayMs: 1000`). No exponential backoff. No retry for audit persistence failures. No retry for notification service (if Kafka delivery fails). | WhatsApp notification failures could result in missed clinical escalations. |

---

## 6.5 Security Architecture Assessment

### 6.5.1 Authentication & Authorization — 🟡 MEDIUM

| Component | Documented | Implemented | Gap |
|-----------|-----------|-------------|-----|
| **OAuth 2.0** | Requisitos.md line 395 | ❌ Not in codebase | JWT only; OAuth 2.0 mentioned for Tasy integration but not implemented |
| **JWT** | Requisitos.md line 395 | ✅ `jsonwebtoken` (package.json line 49), `auth.ts` middleware (lines 34-92) | JWT secret requires ≥32 chars (config.ts line 44) — good |
| **Password Hashing** | Implicit | ✅ `bcrypt` (package.json line 38), `BCRYPT_ROUNDS=12` (.env.example line 29) | ✅ Strong |
| **RBAC** | architecture_diagrams.md line 208 | ✅ `requireRole()` and `requirePermission()` middleware (auth.ts lines 97-167) | Role/permission resolution relies on JWT claims — no database-backed role store |
| **ABAC** | architecture_diagrams.md line 208 | ❌ Not implemented | No attribute-based access control |
| **MFA** | architecture_diagrams.md line 207 | ❌ Not implemented | Mentioned in diagram only |
| **Refresh Tokens** | Implicit | ⚠️ `refreshToken` field added to User model (schema line 76) | No refresh token rotation logic found |

### 6.5.2 API Security — ✅ GOOD BASELINE

| Control | Implementation | Evidence |
|---------|---------------|----------|
| **Security Headers** | ✅ | `helmet` v7.1.0 (package.json line 46) |
| **Rate Limiting** | ✅ | `express-rate-limit` v7.1.5 (package.json line 44), 3 tiers: default (100/15min), strict (5/15min), lenient (500/15min) — rateLimiter.ts |
| **CORS** | ✅ | `cors` v2.8.5 (package.json line 41), configurable origin in config.ts line 66 |
| **Input Validation** | ✅ | `joi` v17.11.0 (package.json line 48), `zod` v3.22.4 (package.json line 67), sanitization middleware |
| **CSRF Protection** | ⚠️ | `helmet` provides some CSRF but no explicit `csurf` token |
| **XSS Protection** | ⚠️ | `helmet` Sets `X-XSS-Protection` header; no output encoding library found |

### 6.5.3 Secrets Management — 🔴 CRITICAL GAP

| Aspect | Status | Evidence |
|--------|--------|----------|
| **Secrets Store** | ❌ **No Vault, No AWS Secrets Manager** | `docker-compose.yml` contains hardcoded passwords: `austa_password` (line 10), `admin123` (pgAdmin, line 110), `austa_password` (docker-compose.infrastructure.yml line 10), `minioadmin` (line 205) |
| **AWS Secrets Manager SDK** | ⚠️ **Imported but unused** | `@aws-sdk/client-secrets-manager` v3.932.0 in package.json (line 28) — but no docker-compose or config integration |
| **Environment Variables** | 🔴 **Plain-text secrets in .env** | `.env.example` contains 40+ secrets including API keys, JWT secrets, encryption keys |
| **Docker Compose** | 🔴 **Hardcoded credentials** | Both compose files expose credentials in `environment:` blocks and default configs |

### 6.5.4 Network Security — 🟡 MEDIUM

| Control | Documented | Docker Compose | Terraform (Planned) |
|---------|-----------|---------------|---------------------|
| WAF | Requisitos.md line 389 | ❌ No WAF component | `enable_waf = true` (tfvars line 86) |
| DDoS Protection | Requisitos.md line 390 | ❌ No shield component | `enable_shield = true` (tfvars line 87) |
| VPC Isolation | Requisitos.md line 391 | ❌ Flat network (`austa-network`) | 3-tier subnets planned (tfvars lines 13-27) |
| TLS 1.3 in Transit | Requisitos.md line 402 | ❌ No nginx/TLS in compose | Not configured |
| mTLS | Not mentioned | ❌ | ❌ |

### 6.5.5 Observability — ✅ GOOD (Planned)

Docker-compose.infrastructure.yml includes (lines 133-246):
- ✅ Prometheus (metrics)
- ✅ Grafana (dashboards)
- ✅ Jaeger (distributed tracing)
- ✅ Elasticsearch + Kibana (ELK logging)
- ✅ Health checks on all services

**Gap:** All monitoring is planned/configured but **not validated in production**. No alert thresholds defined for audit trail failures.

---

## 6.6 Stability & Resilience

### 6.6.1 Infrastructure Single Points of Failure

| Component | Risk | Evidence |
|-----------|------|----------|
| **Redis** | 🔴 Single point of failure | Server crashed on ECONNREFUSED — Fix-swarm report (hive/fix-swarm/redis/). Fixed with graceful degradation but still single Redis instance. |
| **PostgreSQL** | 🟠 Single instance | No read replicas in docker-compose. Terraform `rds_multi_az = true` but no main.tf exists. |
| **Kafka** | 🟡 Single broker | docker-compose.infrastructure.yml: `KAFKA_BROKER_ID: 1` (line 80), single node |
| **MongoDB** | 🟡 Single instance | No replica set for non-structured data |

### 6.6.2 Fix-Swarm Learnings

| Issue | Impact | Resolution |
|-------|--------|------------|
| Redis ECONNREFUSED crash | 🔴 Critical — entire platform down if Redis unavailable | Graceful degradation pattern applied; service returns degraded responses instead of crashing |
| Schema/Auth mismatch | 🟠 High — users couldn't authenticate | Missing `password`, `resetToken`, `refreshToken` fields added to User model |
| Native deps compilation | 🟡 Medium — TensorFlow+Tesseract build failures | Build dependencies resolved; compilation environment documented |

**Lesson:** The Redis crash exposed that the platform was **not designed for resilience** — a single infrastructure component failure cascaded to total platform unavailability.

---

## 6.7 Consolidated Compliance Gap Register

| # | Gap | Severity | Likelihood | Impact | Regulatory Reference |
|---|-----|----------|------------|--------|---------------------|
| G-001 | **HIPAA/LGPD confusion** — HIPAA claimed as primary compliance framework; LGPD superficially addressed | 🔴 Critical | Certain | Regulatory misrepresentation; non-compliance with LGPD | LGPD Art. 1º–65º; HIPAA does NOT apply in Brazil |
| G-002 | **No ANVISA SaMD classification** — clinical decision support functions unregistered | 🔴 Critical | Certain | Illegal operation of medical device software | ANVISA RDC 657/2022 |
| G-003 | **Missing RIPD (DPIA)** — no data protection impact report for large-scale health data processing | 🔴 Critical | Certain | LGPD violation; ANPD sanctions | LGPD Art. 38 |
| G-004 | **No DPO/Encarregado** — data protection officer not designated | 🔴 Critical | Certain | LGPD violation; ANPD sanctions | LGPD Art. 41 |
| G-005 | **No breach notification procedure** — 48h ANPD notification not implemented | 🔴 Critical | Certain (eventually) | LGPD violation; fines up to 2% revenue | LGPD Art. 48 |
| G-006 | **PHI encryption not implemented** — pgcrypto loaded but unused; no backend crypto code | 🔴 Critical | Certain | Plaintext sensitive health data; LGPD violation | LGPD Art. 46, Art. 49 |
| G-007 | **Secrets in plain text** — hardcoded passwords, .env files, no Vault/AWS SM | 🔴 Critical | High | Credential exposure; data breach risk | LGPD Art. 46 (security measures) |
| G-008 | **Audit trail not persistent** — in-memory buffer, mock data; not append-only | 🔴 Critical | Certain | No accountability; LGPD Art. 6º, VII violation | LGPD Art. 6º, VII; Art. 37 |
| G-009 | **Data residency** — `us-east-1` configured instead of `sa-east-1` | 🔴 Critical | Uncertain | Data may leave Brazil without safeguards | LGPD Art. 33 |
| G-010 | **No algorithm versioning** — clinical scores unversioned; cannot reproduce decisions | 🔴 Critical | Certain | ANVISA RDC 657/2022 requires traceability | ANVISA RDC 657/2022; CFM Resolution |
| G-011 | **OpenAI data transfer** — patient data sent to U.S. without documented safeguards | 🔴 Critical | Certain | International transfer of sensitive data without LGPD Art. 33 compliance | LGPD Art. 33 |
| G-012 | **No SBIS certification** — practically mandatory for hospital procurement | 🟠 High | Certain | Market access blocked | Industry practice |
| G-013 | **No ISO 27001 certification** — claimed but not certified | 🟠 High | Certain | Misleading compliance claim | ISO 27001 |
| G-014 | **No legal basis documented per processing purpose** — wellness gamification vs clinical uses conflated | 🟠 High | Certain | Processing without valid legal basis | LGPD Art. 11, II |
| G-015 | **No infrastructure-as-code** — Terraform has only .tfvars.example, no main.tf | 🟠 High | Certain | Cannot reproducibly deploy secure infrastructure | Best practice |
| G-016 | **Idempotency not implemented** — duplicate messages could trigger duplicate clinical events | 🟠 High | Medium | Duplicate authorizations, alerts, notifications | HL7 v2 MSH-10; clinical safety |
| G-017 | **Redis single point of failure** — known crash, mitigated but not truly resilient | 🟠 High | Medium (under load) | Platform unavailability | SLA; ANS |
| G-018 | **Row-level security not implemented** — access control is middleware-only, not in database | 🟡 Medium | Medium | Data isolation bypass risk | LGPD Art. 46 |
| G-019 | **No pentest conducted** — annual external penetration test not performed | 🟡 Medium | High (undiscovered vulns) | Unknown attack surface | Hospital procurement requirements |
| G-020 | **Consent management only in UI script** — no backend enforcement of consent state | 🟡 Medium | High | Processing without valid consent | LGPD Art. 7º, Art. 11 |

---

## 6.8 Summary Risk Heat Map

```
                    LIKELIHOOD
                    Low     Medium     High     Certain
        ┌─────────┬────────┬─────────┬────────┬──────────┐
        │ Critical│        │         │G-007   │G-001 G-002│
        │         │        │         │G-017   │G-003 G-004│
  I     │         │        │         │        │G-005 G-006│
  M     │         │        │         │        │G-008 G-009│
  P     ├─────────┼────────┼─────────┼────────┼──────────┤
  A     │ High    │        │G-016    │G-012   │          │
  C     │         │        │G-018    │G-013   │          │
  T     │         │        │G-019    │G-014   │          │
        │         │        │         │G-015   │          │
        ├─────────┼────────┼─────────┼────────┼──────────┤
        │ Medium  │        │         │        │          │
        │         │        │         │        │          │
        ├─────────┼────────┼─────────┼────────┼──────────┤
        │ Low     │        │         │        │          │
        └─────────┴────────┴─────────┴────────┴──────────┘
```

**Bottom Line:** 10 of 20 gaps are **Critical severity**, 7 are **High**, 3 are **Medium**. The platform's compliance posture is **not production-ready for real patient data**.

---

## 6.9 Sources Referenced

| Source File | Lines Referenced | Evidence Type |
|-------------|-----------------|---------------|
| `prisma/schema.prisma` | 2, 29-30, 65-66, 76, 95, 291-296, 616, 861-918, 893-894, 1057-1071, 1199-1215 | Schema (Authoritative) |
| `prisma/migrations/001_init_austa_care_schema.sql` | 3, 6-8 | Migration (Authoritative) |
| `prisma/DATABASE_SCHEMA_DOCUMENTATION.md` | 1, 10-14, 23, 53, 128, 249-262, 316-322 | Documentation |
| `prisma/README.md` | 1, 79, 137, 262 | Documentation |
| `docs/Requisitos.md` | 220-257, 279-290, 330-341, 389-410 | Requirements (Authoritative v3.0) |
| `docs/Questionary_Sugested.md` | 84-120, 914-920 | UX Script |
| `docs/architecture_diagrams.md` | 195-259, 425-473 | Architecture Diagrams |
| `backend/package.json` | 2, 28, 38, 44, 46, 49 | Dependencies (Authoritative) |
| `backend/src/middleware/audit.middleware.ts` | 1-116 | Code |
| `backend/src/middleware/auth.ts` | 1-200 | Code |
| `backend/src/middleware/rateLimiter.ts` | 1-54 | Code |
| `backend/src/services/auditService.ts` | 176-714 (key stubs at 422-601) | Code |
| `backend/src/config/config.ts` | 44-50, 128-131 | Configuration |
| `backend/README_AI_INTEGRATION.md` | 114-129, 222, 462 | Documentation |
| `.env.example` | 28, 29, 117-125 | Configuration |
| `docker-compose.yml` | 10, 56-63, 110, 174 | Infrastructure |
| `docker-compose.infrastructure.yml` | 10, 80, 205 | Infrastructure |
| `infrastructure/terraform/environments/production/terraform.tfvars.example` | 7, 86-90, 103 | Planned Infrastructure |
| `hive/fix-swarm/redis/` | — | Historical Bug Reports |

---

> **This section (Section 6) was produced by the Compliance & Security Specialist Agent as part of Wave 2 analysis for the consolidated PLATFORM-REVIEW.md.**
>
> **Continues in Section 8: Gaps & Risks (cross-cutting analysis with gap prioritization and remediation roadmap).**
