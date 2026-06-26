# Section 8: Gaps & Risks (Compliance & Security Contribution)

## AUSTA Care Platform — Cross-Cutting Gap Analysis

**Purpose:** This section contributes the compliance and security findings to the consolidated PLATFORM-REVIEW.md Section 8 (Gaps & Risks). It identifies cross-cutting risks that span architecture, data engineering, product, and regulatory domains.

---

## 8.1 Risk Matrix — All Compliance & Security Findings

### 8.1.1 Critical (🔴) — Must Resolve Before Any Patient Data

| ID | Gap | Cross-Cutting Impact |
|----|-----|---------------------|
| **C-01** | **HIPAA/LGPD Regulatory Misclassification** | **Product:** Claims "HIPAA-compliant" could be seen as misleading marketing. **Legal:** LGPD violations could result in ANPD fines (up to 2% of revenue in Brazil, capped at R$50M). **Architecture:** `hipaaCompliant` boolean on Organization must be replaced with `lgpdCompliant`; all HIPAA references must be replaced with LGPD. |
| **C-02** | **No ANVISA Registration** | **Product:** Platform cannot legally process clinical data in Brazil. **Architecture:** Clinical features (symptom analysis, risk scoring) must be gated behind regulatory clearance. **Data:** Without ANVISA classification, the required clinical validation documentation cannot be defined. |
| **C-03** | **Missing RIPD (Data Protection Impact Report)** | **Legal:** Mandatory LGPD document. **Product:** Without RIPD, the legal basis for each processing purpose is undocumented. **Architecture:** RIPD findings should inform data minimization, retention, and encryption requirements. |
| **C-04** | **No DPO Designated** | **Legal:** LGPD Art. 41 violation. **Product:** No point of contact for data subjects exercising rights. **Operations:** No internal authority for data protection decisions. |
| **C-05** | **No Breach Notification Process** | **Legal:** LGPD Art. 48 requires 48-hour ANPD notification. **Operations:** No incident response runbook for data breaches. **Architecture:** Audit trail and monitoring must feed breach detection. |
| **C-06** | **PHI/PII Encryption Not Implemented** | **Data:** All health data in plaintext JSONB. CPF in plaintext. **Architecture:** pgcrypto loaded but unused. No crypto code in backend source. **Product:** Encryption claimed in documentation but not verifiable. |
| **C-07** | **Secrets Management — Plain Text** | **Infrastructure:** Hardcoded passwords in docker-compose. `.env.example` exposes credential patterns. **Architecture:** No Vault, no AWS Secrets Manager despite SDK being a dependency. **Operations:** Credential rotation impossible at scale. |
| **C-08** | **Audit Trail Not Persistent** | **Architecture:** auditService.ts returns mock data. auditMiddleware.ts logs to mutable files. **Product:** Cannot demonstrate accountability (LGPD Art. 6º, VII). **Operations:** No way to reconstruct "who did what when" for security incidents. |
| **C-09** | **Data Residency — Wrong AWS Region** | **Infrastructure:** Terraform configures `us-east-1` instead of `sa-east-1`. **Legal:** Data may leave Brazil without LGPD Art. 33 safeguards. **Product:** Brazilian healthcare data sovereignty not respected. |
| **C-10** | **OpenAI/International Data Transfer** | **Architecture:** Patient data flows to OpenAI (U.S.) without documented safeguards. **Legal:** Requires LGPD Art. 33 compliance (adequacy decision, SCCs, or specific consent). **Product:** AI features may be unusable without data transfer framework. |

### 8.1.2 High (🟠) — Must Resolve Before Production

| ID | Gap | Cross-Cutting Impact |
|----|-----|---------------------|
| **H-01** | **No Algorithm Versioning** | **Architecture:** Clinical scoring engine produces decisions without versioned models. **Product:** Cannot reproduce historical risk assessments. **Regulatory:** ANVISA requires traceability of algorithm versions. |
| **H-02** | **No Idempotency for Clinical Messages** | **Architecture:** Duplicate WhatsApp messages, Kafka redeliveries, or FHIR replays could trigger duplicate clinical actions. **Product:** Risk of duplicate authorizations, double notifications, or repeated clinical escalations. |
| **H-03** | **No Infrastructure-as-Code** | **Infrastructure:** Terraform has only `.tfvars.example` — no `main.tf`, `variables.tf`, or `providers.tf`. **Operations:** Cannot reproducibly deploy secure infrastructure. **Compliance:** No audit trail of infrastructure changes. |
| **H-04** | **No SBIS Certification Path** | **Product:** Brazilian hospitals practically require SBIS certification for software procurement. **Legal:** Not legally mandatory but commercially blocking. |
| **H-05** | **ISO 27001 Claimed Without Certification** | **Product:** Requisitos.md §4.2 claims "ISO 27001: Security management system." **Legal:** Misleading compliance claim; cannot be used in marketing. **Operations:** No ISMS implementation evidence. |
| **H-06** | **Legal Basis Conflation** | **Product:** Wellness gamification and clinical decision support share the same data pipeline without distinct legal bases. **Legal:** "Proteção da vida" (Art. 11, II, g) applies to ICU/emergency contexts but NOT to gamification incentives. |
| **H-07** | **Redis Single Point of Failure** | **Infrastructure:** Known crash (ECONNREFUSED) fixed with graceful degradation but still single Redis instance. **Architecture:** Session loss, cache loss, and Socket.IO adapter failure under Redis outage. |

### 8.1.3 Medium (🟡) — Should Resolve Before Scale

| ID | Gap | Cross-Cutting Impact |
|----|-----|---------------------|
| **M-01** | **Row-Level Security Not Implemented** | **Data:** Access control is middleware-only — no PostgreSQL RLS. **Architecture:** A direct database connection bypasses all access controls. |
| **M-02** | **No External Penetration Test** | **Security:** Annual pentest is standard hospital procurement requirement. **Architecture:** Unknown attack surface in WhatsApp webhook, FHIR endpoints, API gateway. |
| **M-03** | **Consent Enforcement Gap** | **Product:** Questionary_Sugested.md describes gamified LGPD consent flow, but backend has no consent state enforcement. **Architecture:** auditService.ts defines `lgpd-consent-tracking` rule but doesn't enforce it. |
| **M-04** | **Health Check Monitoring Gap** | **Operations:** Health checks exist but don't validate audit trail persistence. **Architecture:** Platform could appear healthy while audit logs are silently failing. |
| **M-05** | **No mTLS for Service-to-Service** | **Architecture:** Flat Docker network with no service identity verification. **Security:** Compromised container could impersonate any service. |

---

## 8.2 Architecture-to-Code Gap Analysis

### 8.2.1 Documented vs Actual Architecture

The C4 Container diagram (architecture_diagrams.md lines 36-76) describes a **12-service microservices architecture**:

```
Documented: Kong → Chat(JS) + AI(Python/FastAPI) + Auth(Java/Spring) + User(JS) + Risk(Python) + Notification(JS) + Integration(Java)
           ↓
           PostgreSQL + MongoDB + Redis Cluster + Data Lake (Delta Lake)
           + Apache Kafka
```

**Actual codebase:**
- 100% TypeScript monolith (backend/src/)
- No Python services found
- No Java/Spring services found
- No Kong API Gateway in docker-compose
- No Camunda 8 (BPM) implementation
- No Apache Spark
- No Delta Lake

### 8.2.2 Impact on Compliance Posture

The gap between documented and actual architecture creates **compliance documentation debt**:

| Documented Security Control | Implementation Reality |
|---------------------------|----------------------|
| "Kong API Gateway with authentication, rate limiting" (architecture_diagrams.md line 42) | Express app with helmet + rate-limiter middleware |
| "Secret Management" (architecture_diagrams.md line 216) | `.env` files with plain text secrets |
| "Key Management" (architecture_diagrams.md line 223) | No KMS implementation; `ENCRYPTION_KEY` unused |
| "SIEM/SOC" (architecture_diagrams.md line 228) | No SIEM integration; Winston file-based logging |
| "DLP Controls" (architecture_diagrams.md line 224) | No data loss prevention implemented |

**Severity:** 🟠 High — The documented security architecture is an **aspiration**, not a reflection of the implemented system. Auditors reviewing the documentation would find security controls that don't exist.

---

## 8.3 Codebase Audit — Implementation Verification

### 8.3.1 Verified vs Claimed Controls

| Control | Claim (Source) | Verified Implementation | Gap |
|---------|---------------|----------------------|-----|
| JWT Authentication | Requisitos.md §4.2 | ✅ `jsonwebtoken` + `auth.ts` middleware | — |
| Password Hashing | Implicit | ✅ `bcrypt` with 12 rounds | — |
| Rate Limiting | Requisitos.md §4.2 | ✅ `express-rate-limit` (3 tiers) | — |
| Security Headers | Requisitos.md §4.2 | ✅ `helmet` v7.1.0 | — |
| CORS | Implicit | ✅ `cors` v2.8.5 | — |
| Input Validation | Requisitos.md §4.2 | ✅ `joi` + `zod` | — |
| AES-256 at Rest | Requisitos.md §4.2 (line 401) | ❌ pgcrypto loaded, never used | 🔴 Critical |
| TLS 1.3 in Transit | Requisitos.md §4.2 (line 402) | ❌ No nginx in docker-compose; no TLS config | 🔴 Critical |
| PII Tokenization | Requisitos.md §4.2 (line 404) | ❌ No implementation found | 🔴 Critical |
| OAuth 2.0 | Requisitos.md §4.2 (line 395) | ❌ Only JWT; no OAuth 2.0 flow | 🟠 High |
| Database Encryption | Requisitos.md §4.2 (line 403) | ❌ No column-level encryption | 🔴 Critical |
| Audit Trails | Requisitos.md §4.2 (line 408) | ⚠️ Model exists, service is scaffold | 🔴 Critical |
| CSRF Protection | Requisitos.md §4.2 (line 398) | ⚠️ helmet provides some, no explicit csurf | 🟡 Medium |

### 8.3.2 Positive Findings

Despite critical compliance gaps, the codebase shows **security-conscious engineering**:

1. **TypeScript strict mode**: Strong typing reduces injection and type-confusion vulnerabilities
2. **Zod schema validation**: Runtime validation of environment variables (config.ts lines 8-77)
3. **JWT minimum length enforcement**: config.ts line 44: `z.string().min(32)` — prevents weak secrets
4. **Bcrypt rounds at 12**: .env.example line 29 — above OWASP minimum (10)
5. **Sanitization middleware**: Audit middleware redacts passwords/tokens from log output (audit.middleware.ts lines 77-91)
6. **Strict rate limiting for auth endpoints**: 5 requests/15min (rateLimiter.ts line 20) — good anti-brute-force
7. **Comprehensive schema design**: 18 models with HIPAA/LGPD awareness (despite incorrect primary framing)

---

## 8.4 Remediation Roadmap (Compliance & Security)

### Phase 0: Regulatory Foundation (Weeks 1-4) — IMMEDIATE

**Before any further clinical development:**

| Priority | Action | Owner |
|----------|--------|-------|
| P0 | Engage ANVISA specialist for SaMD classification (RDC 657/2022) | Legal/Product |
| P0 | Replace ALL HIPAA references with LGPD across codebase, schema, docs, config | Engineering |
| P0 | Designate DPO/Encarregado (LGPD Art. 41) | Legal |
| P0 | Commission RIPD (DPIA) for all health data processing activities | Legal/DPO |
| P0 | Define legal basis for each processing purpose (clinical vs gamification vs marketing) | Legal/DPO |
| P0 | Implement breach notification procedure (48h to ANPD template) | Legal/Operations |
| P1 | Rename `hipaaCompliant` → `lgpdCompliant` in Organization model (with migration) | Engineering |
| P1 | Rename `hipaaRelevant` → `lgpdRelevant` as primary field; deprecate HIPAA field | Engineering |

### Phase 1: Security Hardening (Weeks 5-8)

| Priority | Action | Owner |
|----------|--------|-------|
| P0 | Implement PHI encryption using pgcrypto or application-level crypto (AES-256-GCM) | Backend |
| P0 | Implement persistent audit trail — wire auditService.ts to AuditLog table | Backend |
| P0 | Replace hardcoded credentials with AWS Secrets Manager or HashiCorp Vault | DevOps |
| P1 | Add nginx with TLS 1.3 termination to docker-compose | DevOps |
| P1 | Implement idempotency keys for all clinical event handlers | Backend |
| P1 | Add algorithm versioning to risk scoring, emergency detection, and NLP models | Backend/ML |
| P2 | Implement PostgreSQL Row-Level Security for multi-tenant isolation | Backend/DB |
| P2 | Add Kafka with `enable.idempotence=true` for exactly-once semantics | DevOps |
| P2 | Deploy Redis Sentinel or Cluster for high availability | DevOps |

### Phase 2: Compliance Validation (Weeks 9-12)

| Priority | Action | Owner |
|----------|--------|-------|
| P1 | Commission external penetration test | Security |
| P1 | Begin SBIS certification process | Product/Legal |
| P1 | Implement consent state enforcement in backend (not just UI script) | Backend |
| P1 | Document international data transfer safeguards (OpenAI SCCs) | Legal |
| P1 | Build compliance reporting dashboard (audit trail → ANS reports) | Backend/Frontend |
| P2 | Conduct internal ISO 27001 gap analysis | Security/Legal |
| P2 | Implement SIEM integration (Wazuh or AWS Security Hub) | DevOps |

### Phase 3: Production Readiness (Weeks 13-16)

| Priority | Action | Owner |
|----------|--------|-------|
| P1 | Complete Terraform main.tf (infrastructure-as-code for sa-east-1) | DevOps |
| P1 | Implement dead man's switch for audit trail health | Backend |
| P1 | Achieve ISO 27001 certification | Security/Legal |
| P2 | Establish annual pentest schedule | Security |
| P2 | Document business continuity and disaster recovery plan | Operations |
| P2 | Clinical algorithm validation with medical board | Product/Clinical |

---

## 8.5 Risk Acceptance Recommendations

Some gaps may be **strategically accepted** if the platform's initial deployment is limited:

| Gap | Acceptance Condition | Risk Mitigation |
|-----|---------------------|-----------------|
| ISO 27001 certification | Delay until post-MVP | Tag all marketing as "ISO 27001 *targeted*, not yet certified" |
| SBIS certification | Delay until hospital sales cycle | Begin paperwork immediately; certification takes 6+ months |
| mTLS | Accept for MVP with flat network | Implement network segmentation; add mTLS in Phase 2 |
| MongoDB replica set | Accept single instance for MVP | Document recovery procedure; implement backup |
| Row-Level Security | Accept middleware-only for MVP | Add PostgreSQL RLS in Phase 2; document this as a known limitation |

**Cannot be accepted under any circumstances:**
- No patient data without ANVISA classification
- No patient data without PHI encryption
- No patient data without persistent audit trail
- No patient data without breach notification procedure
- No patient data without documented legal basis

---

## 8.6 Final Assessment

The AUSTA Care Platform has a **solid engineering foundation** with good security basics (JWT, bcrypt, rate limiting, helmet, Zod validation). However, its compliance posture is **fundamentally broken** in three dimensions:

1. **Regulatory Framework**: The platform targets Brazilian healthcare but builds compliance around U.S. HIPAA. This is not a minor mislabeling — it's a foundational error that affects schema design, documentation, infrastructure configuration, and legal obligations.

2. **ANVISA Gap**: The platform performs clinical decision support functions (risk scoring, symptom analysis, emergency detection) that almost certainly require ANVISA registration as SaMD. This has not been initiated.

3. **Implementation Gap**: Critical security controls (encryption at rest, persistent audit trail, secrets management) are documented as implemented but are actually scaffold code or completely absent from the codebase.

### Bottom Line

**The platform CANNOT process real patient data in its current state.** The minimum viable compliance requirements (ANVISA classification, PHI encryption, persistent audit trail, breach notification, DPO designation, RIPD completion) represent approximately **8-12 weeks of dedicated legal + engineering work** before the platform can ethically and legally process any Brazilian patient health data.

The code quality is good. The architecture vision is ambitious. But **compliance must come first** — building more features on a non-compliant foundation compounds technical and legal debt.

---

> **This section was produced by the Compliance & Security Specialist Agent as part of Wave 2 analysis for the consolidated PLATFORM-REVIEW.md (Section 8: Gaps & Risks).**
