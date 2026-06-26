# Architecture Decision Records (ADRs) — AUSTA Care Platform

> **Status:** DRAFT — Catalog of existing implicit decisions + proposed new ADRs
> **Generated:** 2026-06-26 by Parreira
> **Note:** Zero formal ADRs were found in the repository. The decisions below are **reconstructed** from documentation and code.

---

## Catalog of EXISTING Implicit Decisions

| ID | Title | Where Found | Status |
|----|-------|-------------|--------|
| IMP-001 | WhatsApp as primary patient interface | Requisitos.md §1.1, Questionary_Sugested.md full script | Implemented |
| IMP-002 | Event-driven architecture with Kafka backbone | architecture_diagrams.md (C4Container, Data Flow, Event-Driven seq), docker-compose.infrastructure.yml (Kafka+Zookeeper) | Partially implemented |
| IMP-003 | PostgreSQL as primary transactional store | schema.prisma (1259 lines), docker-compose.yml, package.json (@prisma/client) | Implemented |
| IMP-004 | Prisma ORM for database access | schema.prisma, package.json (prisma 6.19), migrations/ | Implemented |
| IMP-005 | Gamification for patient engagement | Requisitos.md §3.1 (RF 1.2), Questionary_Sugested.md (5 missions, HealthPoints), schema.prisma (Mission, HealthPoints, PointTransaction, Achievement) | Implemented |
| IMP-006 | TypeScript monolith backend (not Python microservices) | All source files are .ts, package.json (no Python deps) | **Contradicts architecture_diagrams.md** |
| IMP-007 | HIPAA referenced as compliance framework | schema.prisma (hipaaRelevant), DATABASE_SCHEMA_DOCUMENTATION.md, package.json description, architecture_diagrams.md §Compliance | **Wrong jurisdiction** |
| IMP-008 | Multi-tenancy via Organization model | schema.prisma (Organization model with relations to all entities) | Implemented |

---

## Proposed NEW ADRs

### ADR-001 — Resolve HIPAA/LGPD Jurisdiction Confusion
**Status:** Proposed  
**Context:** The codebase, database schema, and documentation reference "HIPAA compliance" 15+ times. However, the platform targets the Brazilian market (AUSTA is a Brazilian health plan administrator). HIPAA is a United States regulation and does NOT apply to Brazil-only operations. The correct framework is LGPD (Lei 13.709/2018), ANS regulations, and ANVISA for SaMD.

**Decision:** Replace ALL HIPAA references with LGPD/ANS/ANVISA throughout codebase, schema, and documentation. Remove `hipaaCompliant` and `hipaaRelevant` fields; add `lgpdCompliant` and `lgpdRelevant`. Update package.json description.

**Alternatives Considered:**
- Keep both HIPAA and LGPD (rejected — adds confusion, doubles compliance burden with no benefit)
- Remove both and have no compliance framework (rejected — illegal for Brazilian health data)

**Consequences:**
- Positive: Legal compliance, no misleading claims, correct regulatory posture
- Negative: Migration needed to rename DB columns, rewrite docs, retrain team on LGPD

**Trade-offs:** Effort now vs. regulatory risk later. The longer HIPAA references stay, the higher the liability.

---

### ADR-002 — ANVISA SaMD Classification
**Status:** Proposed  
**Context:** The platform performs clinical risk scoring (cardiovascular, diabetes, mental health, respiratory), symptom analysis with severity classification (1-10 scale), and emergency detection with automated escalation. These functions likely constitute Software as Medical Device (SaMD) under ANVISA RDC 657/2022.

**Decision:** Engage ANVISA regulatory specialist to classify the platform's **intended use**. Likely classification: **Classe II** (analyzes data to support clinical decisions, allows independent verification) with risk of **Classe III** due to critical care context (ICU, emergency detection).

**Alternatives Considered:**
- Self-classify without specialist (rejected — high liability risk)
- Remove clinical scoring to avoid SaMD classification (rejected — core value proposition)

**Consequences:**
- Positive: Regulatory clarity, legal operation, market access
- Negative: Registration process takes 6-18 months, requires clinical evidence, costs R$ 50k-200k+
- Critical: Cannot process real patient data for clinical decisions before registration

**Trade-offs:** Time-to-market vs. regulatory compliance. The ANVISA process is lengthy but non-negotiable.

---

### ADR-003 — Architecture Simplification: Monolith-First for MVP
**Status:** Proposed  
**Context:** architecture_diagrams.md specifies 10 containers (Kong API Gateway, Chat Service/Node.js, AI Service/Python, Auth/Java Spring, User/Node.js, Risk/Python, Notification/Node.js, Integration Hub/Java; PostgreSQL, MongoDB, Redis, Delta Lake; Kafka backbone; Camunda BPM). The actual codebase is a single TypeScript backend with Prisma ORM. The documented architecture is 5-10x more complex than implemented.

**Decision:** For MVP and Phase 1-2, adopt a **modular monolith** architecture with 3-4 services maximum:
1. API Gateway (Nginx/Kong) — routing, rate limiting, TLS termination
2. Backend monolith (TypeScript/Express) — all business logic in well-defined modules
3. PostgreSQL — transactional data
4. Redis — caching, session, rate limiting

Extract microservices ONLY when a module demonstrates independent scaling needs (Phase 3+).

**Alternatives Considered:**
- Full microservices from start (rejected — 10+ containers for zero production users is "astronaut architecture")
- Keep current monolith with no plan (rejected — need explicit decision to prevent premature decomposition)

**Consequences:**
- Positive: Faster development, simpler debugging, lower operational cost, single deployment unit
- Negative: Less "resume-driven development" appeal, harder to scale individual components
- Neutral: Kafka can be deferred to Phase 3; MongoDB can be eliminated (PostgreSQL JSONB covers document storage)

**Trade-offs:** Developer velocity now vs. theoretical scalability later. The 10-container architecture would take 6+ months just to set up CI/CD.

---

### ADR-004 — Encryption Strategy for PHI at Rest
**Status:** Proposed  
**Context:** schema.prisma and migration SQL include `pgcrypto` extension. Requisitos.md claims "AES-256 encryption at rest" and "PII tokenization." However, no implementation of column-level encryption is visible. `isEncrypted` boolean exists on Document model but encryption pipeline not found.

**Decision:** Implement envelope encryption using pgcrypto for all PHI/PII columns:
1. Generate per-tenant encryption keys stored in AWS KMS or HashiCorp Vault
2. Encrypt sensitive columns (CPF, health data JSONB, emergency contacts) using `pgp_sym_encrypt()` with tenant key
3. Implement key rotation schedule (90-day default)
4. Add encryption verification to health check endpoint

**Alternatives Considered:**
- Application-level encryption only (rejected — pgcrypto provides DB-level defense in depth)
- Full-disk encryption only (rejected — insufficient for column-level PHI protection required by LGPD Art. 46)
- AWS RDS encryption only (rejected — protects at rest but not from privileged DB access)

**Consequences:**
- Positive: LGPD Art. 46 compliance, defense in depth, audit-ready
- Negative: ~5-15% performance overhead on encrypted columns, key management complexity

**Trade-offs:** Security vs. query performance. Encrypted columns cannot be indexed for search — consider tokenization for frequently-queried fields.

---

### ADR-005 — Clinical Algorithm Versioning
**Status:** Proposed  
**Context:** The risk-assessment service (1564 lines) and emergency-detection service (579 lines) implement clinical scoring algorithms without version tracking. Healthcare invariants require that every clinical score records which algorithm version produced it.

**Decision:** Add `algorithm_version` field to all clinical score entities (HealthData, VitalSign, QuestionnaireResponse). Implement a version registry that maps algorithm names to git commit SHAs. On every algorithm change, increment version and require code review by clinical team.

**Alternatives Considered:**
- Timestamp-based tracking (rejected — doesn't identify which algorithm logic was used)
- Git tags only (rejected — need database-level traceability for audit)

**Consequences:**
- Positive: Audit readiness, clinical reproducibility, regulatory compliance (CFM requirements)
- Negative: Additional field on every clinical score, version management overhead

**Trade-offs:** Storage overhead (~50 bytes per record) vs. clinical safety and regulatory compliance. Non-negotiable for patient safety.

---

### ADR-006 — Idempotency for HL7/WhatsApp Message Processing
**Status:** Proposed  
**Context:** The platform processes WhatsApp messages as the primary input channel. Requisitos.md mentions FHIR Gateway and HL7 for interoperability but WhatsApp message idempotency (preventing duplicate processing) is not explicitly addressed. docker-compose.infrastructure.yml includes HAPI FHIR server.

**Decision:** Implement idempotency keys for all inbound message processing:
1. WhatsApp: Use `whatsappMessageId` (already unique in schema) with `INSERT ON CONFLICT DO NOTHING`
2. FHIR: Use message header ID as idempotency key
3. Tasy ERP: Use integration reference IDs
4. Add idempotency verification to all webhook handlers

**Alternatives Considered:**
- Application-level deduplication cache (rejected — race condition risk)
- No idempotency (rejected — duplicate clinical data is a patient safety risk)

**Consequences:**
- Positive: Patient safety (no duplicate alerts/actions), data integrity
- Negative: Slight latency increase (~2ms for conflict check)

---

