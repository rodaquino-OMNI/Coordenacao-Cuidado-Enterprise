# PLATFORM-REVIEW.md — Análise Técnica Consolidada
## AUSTA Care Platform / Coordenação-Cuidado Enterprise

**Status:** COMPLETE — v1.0  
**Data da análise:** 2026-06-26  
**Analista principal:** Parreira (Orquestrador DevOps) + 4 agentes especialistas (Wave 1: Product/Reqs, Architecture/Data, Codebase/Infra; Wave 2: Compliance/Security)  
**Versão do documento:** v1.0-final

---

> **NOTA:** Este documento está sendo construído incrementalmente. As seções 2-8 serão populadas com os outputs dos agentes especialistas despachados em 2 waves.
> 
> **Wave 1 (3 agentes):** Product & Requirements | Architecture & Data | Codebase & Infrastructure
> **Wave 2 (1 agente):** Compliance & Security
> **Fase final:** Consolidação cross-cutting, ADRs, roadmap, e recomendações

---

## 0. Executive Summary

### What is this platform?

The **AUSTA Care Platform** (codename "Coordenacao-Cuidado-Enterprise") is an ambitious healthcare coordination platform designed for the **Brazilian supplementary health market** (planos de saúde). Its core premise is transforming healthcare delivery from reactive to **proactive and predictive** through a WhatsApp-first conversational interface, AI-powered risk detection, and gamified patient engagement.

### Maturity Assessment

⚠️ **ALPHA/PRE-PRODUCTION** — The platform has substantial code (200+ files, TypeScript backend + React frontend), comprehensive database schema (Prisma with 18 models and 30+ enums), and sophisticated clinical algorithms. However, it is **not production-ready** for real patient data. Key indicators:

- **Code exists:** ✅ Yes — 622 files, 161 TypeScript source files, 30+ services, Prisma ORM, 16 test files
- **Infrastructure exists:** ✅ Partial — Docker Compose (2 files, 14+ services), K8s manifests (production-quality with HPA), Terraform (incomplete — only tfvars.example)
- **Documentation exists:** ✅ 3 primary docs (Requisitos.md v3.0, architecture_diagrams.md, Questionary_Sugested.md)
- **Code quality:** ⚠️ Technical debt — **123+ active TypeScript compilation errors** (code doesn't compile), NestJS decorators mistakenly used in Express app, duplicate test infrastructure, overall grade 4.4/10
- **Regulatory readiness:** ❌ Major gaps — HIPAA/LGPD confusion, no ANVISA SaMD classification, missing RIPD
- **Production invariants:** ⚠️ Partial — audit trail exists (in-memory only), 5/6 invariants need implementation

### Top-5 Findings

| # | Finding | Severity |
|---|---------|----------|
| 1 | **HIPAA/LGPD Confusion**: Platform claims HIPAA compliance (18 references) but targets Brazil; HIPAA does not apply. LGPD appears only 4 times. This is a fundamental misclassification. | 🔴 Critical |
| 2 | **No ANVISA Classification**: Clinical scoring (risk assessment, symptom analysis, emergency detection) likely constitutes SaMD Classe II/III. ANVISA mentioned ZERO times in project docs. | 🔴 Critical |
| 3 | **PHI Encryption Not Implemented**: pgcrypto extension loaded but NEVER used — 0 results for encrypt/decrypt in 161 source files. Health data and CPF stored in plaintext. | 🔴 Critical |
| 4 | **Architecture-Documentation Gap**: Docs describe Python/FastAPI AI services + 12+ microservices; actual codebase is 100% TypeScript monolith + Prisma | 🟠 High |
| 5 | **AWS Region Misconfiguration**: Terraform uses `us-east-1` (USA) instead of `sa-east-1` (Brazil). Patient data would leave Brazil without LGPD Art. 33 safeguards. | 🔴 Critical |

### Top-5 Recommended Next Steps

1. **Resolve regulatory classification immediately** — engage ANVISA specialist for SaMD classification before further clinical development
2. **Replace HIPAA references with LGPD throughout** — HIPAA is a misleading claim for a Brazil-only platform
3. **Simplify to MVP architecture** — reduce from 10 containers to 3-4: API Gateway, Backend monolith (TypeScript), PostgreSQL, Redis
4. **Implement healthcare invariants before patient data** — audit trail persistence, encryption at rest (pgcrypto), idempotency, algorithm versioning
5. **Validate clinical algorithms with medical board** — risk scoring thresholds, emergency detection rules, and the onboarding questionnaire need clinical review

---

## 1. Document Inventory & Coverage Map

| File | Type | Purpose | Version/Date | Status | Confidence |
|------|------|---------|--------------|--------|------------|
| `docs/Requisitos.md` (541 linhas) | Requirements | Especificação completa de requisitos funcionais e não-funcionais | v3.0, Jul 14 2025 | **Authoritative** | HIGH |
| `docs/architecture_diagrams.md` (502 linhas) | Architecture | 8 diagramas Mermaid (C4, Container, Data Flow, Security, Deployment, etc.) | v1.0, Jul 14 2025 | **Draft/Aspirational** | MEDIUM |
| `docs/Questionary_Sugested.md` (958 linhas) | UX Script | Roteiro completo de onboarding conversacional WhatsApp | Undated | **Detailed Design** | HIGH |
| `prisma/schema.prisma` (1259 linhas) | Database Schema | Schema Prisma completo com 18 models, 30+ enums | N/A (code) | **Authoritative (implemented)** | HIGH |
| `prisma/DATABASE_SCHEMA_DOCUMENTATION.md` (473 linhas) | DB Docs | Documentação do schema com HIPAA claims | Undated | **Draft** | MEDIUM |
| `prisma/migrations/001_init_austa_care_schema.sql` (541 linhas) | Migration | SQL migration com extensions (pgcrypto, uuid-ossp, pg_trgm) | N/A (code) | **Authoritative** | HIGH |
| `docker-compose.yml` (174 linhas) | Infra | Setup dev: PostgreSQL, Redis, Backend, Elasticsearch, Kibana | N/A (code) | **Authoritative** | HIGH |
| `docker-compose.infrastructure.yml` (265 linhas) | Infra | Stack completa: 14 serviços (PG, Redis, Mongo, Kafka, FHIR, Prometheus, Grafana, Jaeger, MinIO, ES, Kibana) | N/A (code) | **Authoritative** | HIGH |
| `k8s/*.yaml` (6 arquivos) | Infra | K8s manifests: namespace, deployments (2), services (2), ingress, HPA | N/A (code) | **Draft** | MEDIUM |
| `infrastructure/terraform/` (1 arquivo) | Infra | Apenas `terraform.tfvars.example` — sem `main.tf`, `variables.tf` | N/A (code) | **Incomplete** | LOW |
| `package.json` (root) | Config | Node.js >=18, TypeScript 5.5, Express, Prisma 6.19, Jest, Zod | N/A (code) | **Authoritative** | HIGH |
| `backend/package.json` | Config | Express, LangChain/OpenAI, TensorFlow.js, KafkaJS, AWS SDK, FHIR, BullMQ | N/A (code) | **Authoritative** | HIGH |
| `frontend/package.json` | Config | React 18, Vite 5, TailwindCSS, Zustand, React Query, Recharts, PWA | N/A (code) | **Authoritative** | HIGH |
| `hive/fix-swarm/*` (19 arquivos) | Bug Reports | Documentação de fixes: Redis crash, Prisma auth, native deps | Nov 16 2025 | **Historical** | HIGH |
| `CLAUDE.md` | Config | SPARC development environment, 54 agents, Claude Code config | N/A (config) | **Active** | HIGH |
| `.github/workflows/` | CI/CD | 2 backend CI workflows + CodeQL security scanning | N/A (code) | **Active** | HIGH |

### What's Missing (Gaps in Documentation)

| Gap | Severity |
|-----|----------|
| No ADRs (Architecture Decision Records) — zero formal decisions documented | 🟠 High |
| No API documentation (OpenAPI/Swagger) — mentioned in Requisitos.md but not found | 🟠 High |
| No deployment runbook or operations manual | 🟡 Medium |
| No clinical validation documentation for algorithms | 🔴 Critical |
| No security penetration test reports | 🟠 High |
| No data flow diagrams for PHI/PII (only high-level Mermaid) | 🟡 Medium |
| No disaster recovery plan | 🟡 Medium |
| No user personas document (only implicit in Questionary_Sugested.md) | 🟡 Medium |

---

## 2. Platform Goals & Vision

> **Source:** Requisitos.md §1.1-1.3 (authoritative, v3.0 Jul 14 2025)

### North-Star Vision

**"Criar a primeira plataforma de saúde verdadeiramente preditiva do Brasil, onde cada beneficiário recebe cuidado personalizado antes mesmo de perceber a necessidade, através de uma experiência digital excepcional centrada no WhatsApp."** *(Requisitos.md §1.1)*

### Business Objectives

**Primary (Requisitos.md §1.2):**
- Reduce global loss ratio by 15% through prevention and intelligent routing
- Increase NPS of large clients to >70 through differentiated experience
- Automate 85% of authorizations and scheduling via conversational AI
- Achieve 90% first call resolution through predictive care

**Secondary:**
- Reduce operational costs by 30% through intelligent automation
- Scale to 100,000+ beneficiaries with same operational structure
- Establish new market standard in digital care coordination

### Target Users / Personas

| Persona | Description | Source |
|---------|-------------|--------|
| **Beneficiário** | Healthcare plan member — primary user via WhatsApp | Requisitos.md §1.4, Questionary_Sugested.md |
| **Enfermeira Navegadora** | Professional coordinating complex care journeys (medium/high risk) | Requisitos.md §1.4 |
| **RH Empresarial** | Corporate HR uploading beneficiary spreadsheets for B2B onboarding | Requisitos.md §3.1 (RF 1.1) |
| **Provedor/Prestador** | Doctor, nurse, or healthcare professional managing authorizations | schema.prisma (Provider model) |
| **Admin Plataforma** | System administrator | architecture_diagrams.md (C4Context) |

### Value Proposition

- **For health plans:** Loss ratio reduction, operational efficiency, differentiation
- **For beneficiaries:** 24/7 WhatsApp access, personalized care, gamified engagement
- **For care coordinators:** AI-assisted risk stratification, automated workflows

### Success Metrics / KPIs

**Operational (Requisitos.md §6.2):**
- First Contact Resolution: >75%
- Average Response Time: <30 seconds
- System Availability: >99.9%
- User Adoption Rate: >80% in 90 days

**Business:**
- Loss Ratio Reduction: -15% in 12 months
- NPS Improvement: +25 points
- Operational Cost Reduction: -30%
- Customer Satisfaction: >4.5/5.0

**Onboarding (Questionary_Sugested.md §Métricas):**
- Completion Rate: >85%
- Average Time: <20 minutes (distributed)
- Initial Engagement: >90% respond to first 3 messages
- Risk Detection Accuracy: >95%

### In-Scope vs Out-of-Scope

**In-Scope (Requisitos.md §1.3):**
- Digital gamified onboarding
- AI risk detection engine (CPT + fraud)
- Virtual clinical assistant (symptom analysis)
- Care orchestration and navigation
- Intelligent process automation (RPA + AI)
- Predictive engine (ML for health needs anticipation)
- Integration with ERP Tasy and WhatsApp Business API

**Out-of-Scope (Not documented — analyst inference):**
- Direct medical care delivery (telemedicine consults) — NOT explicitly stated as in-scope
- EHR/HIS replacement — platform is coordination layer, not medical record
- Primary care clinic management
- Billing/claims processing (TISS) — delegated to Tasy ERP

---

## 3. Domain Model & Bounded Contexts

> **Source:** Requisitos.md §1.4, §3; Questionary_Sugested.md; schema.prisma

### Ubiquitous Language Glossary

*(See Appendix A for full glossary — Requisitos.md §1.4 + additions from code)*

### Bounded Contexts (Analyst Reconstruction)

Based on the 5 modules in Requisitos.md and the Prisma schema:

| Context | Description | Core Entities | Source |
|---------|-------------|---------------|--------|
| **Onboarding & Engagement** | Digital onboarding, gamification, HealthPoints | User, Mission, OnboardingProgress, HealthPoints, PointTransaction, Achievement | Requisitos.md §3.1, Questionary_Sugested.md |
| **Risk Detection** | CPT detection, fraud prevention, risk stratification | HealthData, QuestionnaireResponse, VitalSign (risk scoring logic in risk-assessment.service.ts) | Requisitos.md §3.2 |
| **Clinical Assistant** | Symptom analysis, medical knowledge, triage | Conversation, Message (AI-processed), emergency-detection.service.ts | Requisitos.md §3.3 |
| **Care Coordination** | Population stratification, predictive triggers, care orchestration | Authorization, workflow services, notification services | Requisitos.md §3.4 |
| **Process Automation** | Authorization workflow, smart scheduling | Authorization, businessRulesEngine, stateMachine | Requisitos.md §3.5 |
| **Integration Hub** | Tasy ERP, WhatsApp, FHIR, external APIs | TasyIntegration, TasySyncLog | Requisitos.md §5, docker-compose.infrastructure.yml |
| **Identity & Organization** | Users, providers, multi-tenancy | Organization, User, Provider, AuditLog | schema.prisma (core models) |

### Key Workflow: End-to-End Patient Journey

**Documented fact (from Questionary_Sugested.md — full conversational script):**

1. **Trigger:** 24h after plan activation → WhatsApp welcome message
2. **Phase 1 — Consent:** Gamified LGPD consent (HealthPoints incentive) with opt-out option
3. **Phase 2 — Mission 1 "Me Conhece":** Demographics, family context, hobbies (100 HealthPoints)
4. **Phase 3 — Mission 2 "Estilo de Vida":** Physical activity, diet, hydration, social habits, smoking/alcohol (150 HealthPoints)
5. **Phase 4 — Mission 3 "Bem-Estar":** Sleep quality, energy, mood, stress (200 HealthPoints) — with embedded screening for sleep apnea, depression, anxiety
6. **Phase 5 — Mission 4 "Saúde Atual":** Current symptoms, medications, family history (250 HealthPoints) — with OCR for medication labels and exam results
7. **Phase 6 — Mission 5 "Documentos":** Medical document collection via OCR (300 HealthPoints)
8. **Completion:** 1000/1000 HealthPoints → rewards unlocked, personalized health report generated in 24h

**Risk scoring runs in parallel** — NLP analysis detects indirect signs of diabetes (polydipsia+polyphagia+polyuria triad), hypertension (frequent headaches), sleep apnea (snoring+pauses), depression (low mood+anhedonia), cardiac issues (chest pain+dyspnea), and more.

### Risk Escalation Protocol

*(Documented in Questionary_Sugested.md §Sistema de Scoring and §Alertas e Escalações)*

| Score Range | Action | Timeframe |
|-------------|--------|-----------|
| ≥80 (Critical) | Immediate escalation to nursing | Immediate |
| 60-79 (High) | Nursing contact | Within 24h |
| 40-59 (Medium) | Preventive scheduling | Routine |
| <40 (Low) | Routine follow-up | Standard |

---

## 4. Product Requirements

### 4.1 Functional Requirements (MoSCoW + Source)

#### Módulo 1: Onboarding & Engagement

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-001 | Bulk B2B onboarding: Excel/CSV upload up to 10,000 records with validation, dedup, risk profiling in <15 min | Must Have | Requisitos.md §3.1 RF 1.1 |
| REQ-002 | Gamified individual onboarding via WhatsApp with 5 missions, HealthPoints, badges | Must Have | Requisitos.md §3.1 RF 1.2, Questionary_Sugested.md |
| REQ-003 | OCR intelligent document processing: multi-engine (Tesseract + AWS Textract), medical entity extraction, FHIR structuring | Should Have | Requisitos.md §3.1 RF 1.3 |
| REQ-004 | Persona selection algorithm (Zeca/Ana) by age, gender, region | Must Have | Questionary_Sugested.md §Personalização |
| REQ-005 | Adaptive language by digital literacy level | Should Have | Questionary_Sugested.md §Personalização |

#### Módulo 2: Risk Detection

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-006 | Indirect pre-existing condition detection via conversational NLP | Must Have | Requisitos.md §3.2 RF 2.1 |
| REQ-007 | Multi-layer anti-fraud system (document forensics, behavioral analysis, network analysis via Neo4j) | Must Have | Requisitos.md §3.2 RF 2.2 |
| REQ-008 | Confidence scoring for each detected risk | Should Have | Requisitos.md §3.2 RF 2.1 |
| REQ-009 | Cross-reference validation with utilization history (Tasy) | Should Have | Requisitos.md §3.2 RF 2.1 |

#### Módulo 3: Clinical Assistant

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-010 | Symptom analysis engine with NLP, severity scoring (1-10), temporal analysis | Must Have | Requisitos.md §3.3 RF 3.1 |
| REQ-011 | Risk classification: 🟢 Low (1-3), 🟡 Medium (4-6), 🔴 High (7-10) with action recommendations | Must Have | Requisitos.md §3.3 RF 3.1 |
| REQ-012 | Medical knowledge base: evidence-based (Cochrane, PubMed), clinical guidelines, ANVISA drug database | Should Have | Requisitos.md §3.3 RF 3.2 |
| REQ-013 | Comorbidity assessment and drug interaction checking | Should Have | Requisitos.md §3.3 RF 3.1 |
| REQ-014 | Continuous learning via feedback loop and expert validation | Could Have | Requisitos.md §3.3 RF 3.2 |

#### Módulo 4: Care Coordination

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-015 | Population risk stratification: 🔴 Complex (>90), 🟠 High (70-90), 🟡 Moderate (40-70), 🟢 Healthy (<40) | Must Have | Requisitos.md §3.4 RF 4.1 |
| REQ-016 | Predictive triggers engine: temporal, event-based, predictive, AI-generated | Must Have | Requisitos.md §3.4 RF 4.2 |
| REQ-017 | 30-day hospitalization risk prediction | Should Have | Requisitos.md §3.4 RF 4.2 |
| REQ-018 | Wearables integration for early warning signals | Could Have | Requisitos.md §3.4 RF 4.2 |

#### Módulo 5: Process Automation

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| REQ-019 | Ultra-fast authorization: <30 seconds for 80% of simple cases | Must Have | Requisitos.md §3.5 RF 5.1 |
| REQ-020 | Smart scheduling: real-time availability, preference learning, geographic optimization | Should Have | Requisitos.md §3.5 RF 5.2 |
| REQ-021 | Auto-approval rules: low cost (<R$500), good standing, in-network, no fraud history | Should Have | Requisitos.md §3.5 RF 5.1 |
| REQ-022 | Wait list management with automatic notifications | Could Have | Requisitos.md §3.5 RF 5.2 |

### 4.2 Non-Functional Requirements

| Category | Target | Source |
|----------|--------|--------|
| **WhatsApp Latency** | <3s P95 | Requisitos.md §4.1 |
| **API Latency** | <200ms P99 | Requisitos.md §4.1 |
| **Throughput** | >1000 msg/s | Requisitos.md §4.1 |
| **Availability** | 99.9% | Requisitos.md §4.1 |
| **Error Rate** | <0.1% | Requisitos.md §4.1 |
| **Encryption** | AES-256 at rest, TLS 1.3 in transit | Requisitos.md §4.2 |
| **Auth** | OAuth 2.0 + JWT | Requisitos.md §4.2 |
| **Language** | PT-BR primary (WhatsApp default "pt-BR" in schema) | schema.prisma (User.preferredLanguage) |
| **Time Zone** | America/Sao_Paulo default | schema.prisma (User.timezone) |
| **Data Retention** | 7 years default (configurable per org) | schema.prisma (Organization.dataRetentionYears) |

### 4.3 Use Cases / User Stories

**Documented in Questionary_Sugested.md (conversational script format):**

| UC-ID | Use Case | Acceptance Criteria | Source |
|-------|----------|---------------------|--------|
| UC-01 | Beneficiary receives welcome WhatsApp 24h after activation | Trigger automático; Zeca/Ana persona apresentada | Questionary_Sugested.md §FASE 1 |
| UC-02 | Beneficiary gives LGPD consent (gamified) | 100 HealthPoints on consent; opt-out → "modo limitado" | Questionary_Sugested.md §1.2 |
| UC-03 | Beneficiary completes 5 gamified missions | 1000 HealthPoints total; badges unlocked at each milestone | Questionary_Sugested.md §MISSÕES 1-5 |
| UC-04 | NLP detects diabetes risk during onboarding | Tríade: sede + fome + urina frequente = ALERTA CRÍTICO | Questionary_Sugested.md §4.2-4.3 |
| UC-05 | NLP detects sleep apnea risk | Ronco + pausas respiratórias + sonolência diurna = ALERTA APNEIA | Questionary_Sugested.md §5.1 |
| UC-06 | NLP detects depression risk | Humor baixo + anedonia + fadiga = ALERTA DEPRESSÃO | Questionary_Sugested.md §5.2-5.3 |
| UC-07 | Emergency escalation for high-risk findings | Score ≥80 → immediate nursing contact | Questionary_Sugested.md §Alertas |
| UC-08 | OCR processes medication photo | Structured data extraction; drug database cross-reference | Questionary_Sugested.md §6.2 |
| UC-09 | Bulk beneficiary import (B2B) | 10,000 records in <15 min; 95%+ auto inconsistency detection | Requisitos.md §3.1 RF 1.1 |
| UC-10 | Authorization request via WhatsApp | <30 seconds for simple cases; auto-approval rules applied | Requisitos.md §3.5 RF 5.1 |

---

## 5. Architecture — Current State

### 5.1 Logical/Component Architecture

> **Documented:** architecture_diagrams.md (8 Mermaid diagrams)  
> **Implemented:** Single TypeScript/Express monolith with modular service classes

#### Documented Architecture (architecture_diagrams.md)

The C4Container diagram specifies 10 containers:
1. **API Gateway** (Kong) — request routing, auth, rate limiting
2. **Chat Service** (Node.js) — WhatsApp message handling
3. **AI/NLP Service** (Python/FastAPI) — symptom analysis, NLP
4. **Authorization Service** (Java/Spring) — healthcare authorization
5. **User Service** (Node.js) — user management
6. **Risk Engine** (Python) — health risk assessment
7. **Notification Service** (Node.js) — multi-channel notifications
8. **Integration Hub** (Java) — external system integrations
9. **PostgreSQL** — transactional data
10. **MongoDB** — conversations, documents
11. **Redis Cluster** — cache, sessions
12. **Data Lake** (Delta Lake) — analytics, ML
13. **Apache Kafka** — event backbone

**Communication pattern:** Async event-driven via Kafka (Event Sourcing + CQRS) *(Requisitos.md §2.1)*

#### Actual Implementation (Verified in Code)

**Analyst inference based on codebase analysis:**

- **Single TypeScript/Express backend** — all services coexist in `backend/src/services/` as classes/modules, not separate containers
- **No Python code found** — despite architecture_diagrams.md specifying Python/FastAPI for AI and Risk Engine
- **No Java code found** — despite C4Container showing Java/Spring for Auth and Integration Hub
- **PostgreSQL via Prisma** — the only operational database
- **Redis** — caching (ioredis), queues (BullMQ), Socket.IO adapter
- **MongoDB** — configured in docker-compose.infrastructure.yml but NOT used in backend code (no Mongoose/MongoDB driver in package.json)
- **Kafka** — configured in docker-compose.infrastructure.yml with Confluent 7.5.0; kafkajs package installed but service usage not verified

#### Architecture Gap Analysis

| Container (Documented) | Actually Implemented? | Gap |
|------------------------|----------------------|-----|
| Kong API Gateway | Config file exists (kong.yaml) | ⚠️ Not wired into docker-compose.yml main file |
| Chat Service (Node.js) | ✅ Part of monolith (whatsapp.service.ts) | Overlap with other services |
| AI/NLP Service (Python) | ❌ No Python code | 🔴 Major gap — Python/FastAPI doesn't exist |
| Authorization Service (Java) | ❌ No Java code | 🔴 Major gap — Java/Spring doesn't exist |
| User Service (Node.js) | ✅ Part of monolith | — |
| Risk Engine (Python) | ❌ Implemented in TypeScript (risk-assessment.service.ts) | ⚠️ Language mismatch |
| Notification Service (Node.js) | ✅ notificationService.ts | — |
| Integration Hub (Java) | ❌ Implemented in TypeScript (tasyIntegration.ts) | ⚠️ Language mismatch |
| MongoDB | ❌ Configured but not used by backend code | ⚠️ Unnecessary operational complexity |
| Delta Lake | ❌ Not configured | 🔴 Missing entirely |
| Kafka | ⚠️ Configured, package installed, usage unclear | 🟡 Needs verification |
| Camunda 8 BPM | ❌ Not configured | 🔴 Missing; replaced by custom state machine |

### 5.2 Tech Stack Assessment

| Component | Documented Stack | Actual Stack | Verdict |
|-----------|-----------------|--------------|---------|
| **Backend Language** | Node.js + Python + Java | TypeScript only | ⚠️ Simpler than documented |
| **Backend Framework** | Express + FastAPI + Spring | Express (TypeScript) | ✅ Working |
| **ORM** | Not specified | Prisma 6.19 | ✅ Excellent choice |
| **Frontend** | React PWA | React 18 + Vite 5 + TailwindCSS | ✅ Modern, well-configured |
| **Database** | PostgreSQL + MongoDB + Delta Lake | PostgreSQL only (operational) | ⚠️ 2/3 DBs unused |
| **Cache** | Redis | Redis 7 (ioredis) | ✅ Working |
| **Message Queue** | Kafka + RabbitMQ | BullMQ (Redis) + Kafka configured | ⚠️ Kafka unused |
| **ML/AI** | GPT-4, XGBoost, TensorFlow, Spark | @langchain/openai, @tensorflow/tfjs-node | ⚠️ Spark, XGBoost absent |
| **OCR** | Tesseract + AWS Textract | Tesseract.js + @aws-sdk/client-textract | ✅ Both configured |
| **Observability** | Prometheus + Grafana + ELK + Jaeger | All 4 configured in docker-compose | ✅ Impressive setup |
| **Infra** | AWS EKS + GCP GKE | Docker Compose (local), K8s manifests (draft) | ⚠️ Cloud not provisioned |

### 5.3 Data Architecture

*(Source: schema.prisma 1259 lines, DATABASE_SCHEMA_DOCUMENTATION.md, migration SQL)*

**Core Entity-Relationship:**

```
Organization (1) ──→ (*) User
Organization (1) ──→ (*) Provider
User (1) ──→ (*) Conversation ──→ (*) Message
User (1) ──→ (*) HealthData
User (1) ──→ (*) OnboardingProgress ──→ (1) Mission
User (1) ──→ (1) HealthPoints ──→ (*) PointTransaction
User (1) ──→ (*) Authorization ──→ (1) Provider
User (1) ──→ (*) Document
User (1) ──→ (*) VitalSign
User (1) ──→ (*) QuestionnaireResponse
User (1) ──→ (*) Achievement
Organization (1) ──→ (*) TasyIntegration ──→ (*) TasySyncLog
AuditLog ←→ multiple entities (polymorphic via entity+entityId)
```

**Key Design Decisions (from schema):**
- Multi-tenant via `organizationId` on every entity
- Soft deletes via `deletedAt` timestamp
- CPF encryption at application level (documented, not verified)
- Emergency contacts stored as encrypted JSON
- Health data in JSONB for flexibility (conditions, medications, allergies, symptoms)
- HIPAA/LGPD flags on AuditLog (both frameworks tracked — see ADR-001)
- PostgreSQL extensions: uuid-ossp, pgcrypto, pg_trgm

### 5.4 Interoperability & Standards

| Standard | Status | Evidence |
|----------|--------|----------|
| **FHIR R4** | ⚠️ Planned/Partial | HAPI FHIR server in docker-compose.infrastructure.yml; `fhir` npm package v4.11 in backend deps; FHIR Gateway in architecture diagrams |
| **HL7 v2 (MLLP)** | ❌ Not documented | No mention in any doc; no MLLP libraries in package.json |
| **SNOMED CT** | 📋 Planned | Mentioned in Requisitos.md §5.2; no implementation found |
| **ICD-10 / CID-10** | 📋 Planned | Mentioned in Requisitos.md §5.2; `medical-entity-extractor.service.ts` likely handles coding |
| **LOINC** | 📋 Planned | Mentioned in Requisitos.md §5.2; no implementation found |
| **TISS** | ❌ Not documented | Brazilian standard for health plan billing — NOT mentioned (delegated to Tasy) |
| **RNDS** | ❌ Not documented | National Health Data Network — NOT mentioned |

### 5.5 Integrations

| Integration | Status | Protocol | Source |
|-------------|--------|----------|--------|
| WhatsApp Business API | ⚠️ Z-API implementation, NOT Meta Official API as documented | whatsapp.service.ts (Z-API base URL), Requisitos.md §5.2 claims Meta |
| **ERP Tasy** | ⚠️ Config/Service exists | REST + OAuth2 | tasyIntegration.ts, TasyIntegration schema model |
| **OpenAI GPT-4** | ✅ Configured | REST API (LangChain wrapper) | openaiService.ts, @langchain/openai |
| **AWS Textract** | ✅ Configured | AWS SDK v3 | textract.service.ts, @aws-sdk/client-textract |
| **Google Cloud Vision** | ✅ Configured | GCP SDK | @google-cloud/vision in package.json |
| **FHIR Gateway** | ⚠️ HAPI Server configured | REST (HAPI FHIR R4) | docker-compose.infrastructure.yml |
| **AWS S3** | ✅ Configured | AWS SDK v3 | @aws-sdk/client-s3 in package.json |
| **AWS Secrets Manager** | ✅ Configured | AWS SDK v3 | @aws-sdk/client-secrets-manager in package.json |

### 5.6 Cross-Cutting Concerns

| Concern | Implementation | Maturity |
|---------|---------------|----------|
| **AuthN** | JWT (jsonwebtoken + bcrypt), OAuth2 mentioned | ⚠️ Basic — working but OAuth2 not verified |
| **AuthZ** | RBAC via ProviderRole enum; ABAC mentioned but not implemented | ⚠️ Basic |
| **Audit Trail** | AuditService (805 lines) with LGPD/ANS compliance rules; in-memory buffer, not yet persisted to Prisma AuditLog | ⚠️ Partial — needs DB persistence |
| **Encryption at Rest** | pgcrypto extension loaded; encryption methods in AuditService; not verified for PHI columns | ⚠️ Partial |
| **API Security** | Helmet, CORS, rate-limit, compression | ✅ Good |
| **Logging** | Winston structured logger | ✅ Good |
| **Monitoring** | Prometheus + Grafana (2 dashboards: system-health, api-performance) | ✅ Configured |
| **Tracing** | Jaeger (all-in-one configured) | ✅ Configured |
| **CI/CD** | GitHub Actions: 2 backend workflows (CI + TypeScript validation), CodeQL security scanning. No frontend CI. No CD/deployment pipeline. | ⚠️ Partial |
| **Deployment** | Docker Compose (dev), K8s manifests (draft), Terraform (incomplete) | ⚠️ Dev only |

---

## 6. Compliance & Risk

### 6.1 Regulatory Posture

#### CRITICAL FINDING: HIPAA/LGPD Confusion

The platform references **HIPAA** 15+ times across:
- `package.json`: "HIPAA-compliant healthcare platform"
- `schema.prisma`: `hipaaCompliant` (Organization), `hipaaRelevant` (AuditLog)
- `DATABASE_SCHEMA_DOCUMENTATION.md`: "HIPAA Compliance" as first architecture principle
- `architecture_diagrams.md`: "Validate data flows for LGPD/HIPAA compliance"
- `backend/tests/README.md`: "HIPAA-compliant"

**HIPAA is a UNITED STATES regulation.** It does NOT apply to Brazilian healthcare operations. The correct framework is:
- **LGPD** (Lei 13.709/2018) — data protection and privacy
- **ANVISA RDC 657/2022** — SaMD classification
- **ANS** — health plan regulations
- **CFM** — medical practice regulations
- **SBIS** — health informatics certification

#### LGPD Assessment

| Requirement | Status | Source |
|-------------|--------|--------|
| Consent management | ✅ Implemented (gamified, with opt-out) | Questionary_Sugested.md §1.2 |
| Right to erasure ("direito ao esquecimento") | 📋 Mentioned | Requisitos.md §4.2 |
| Data portability | 📋 Mentioned | Requisitos.md §4.2 |
| RIPD (DPIA) | ❌ NOT mentioned — mandatory for sensitive health data at scale | GAP |
| DPO/Encarregado | ❌ NOT mentioned | GAP |
| Breach notification (48h to ANPD) | ❌ NOT mentioned | GAP |
| Legal basis for processing | ❌ Not explicitly defined | GAP |
| Data retention policy | ✅ Configurable (7yr default) | schema.prisma |

#### ANVISA SaMD Classification (RDC 657/2022)

**This is the most critical regulatory gap.** The platform performs:
- Clinical risk scoring (cardiovascular, diabetes, mental health, respiratory)
- Symptom severity classification with action recommendations
- Automated emergency detection and escalation

These functions likely constitute **Software as Medical Device (SaMD) Classe II** (analyzes data to support clinical decisions) with risk of **Classe III** reclassification due to critical care context (ICU, emergency protocols).

**ANVISA RDC 657/2022 is NOT referenced anywhere in the documentation.** This is a 🔴 CRITICAL gap.

#### Other Regulatory Gaps

| Standard | Status | Risk |
|----------|--------|------|
| **SBIS Certification** | ❌ Not mentioned | 🟠 Hospital market access blocked without it |
| **ISO 27001** | 📋 Mentioned but no evidence | 🟡 Cannot claim compliance without certification |
| **CFM Resolutions** | ❌ Not mentioned | 🔴 Clinical decision support must respect physician final responsibility |
| **ANS Reporting** | 📋 Mentioned (automated reports) | 🟡 Needs TISS integration for billing compliance |

### 6.2 PHI/PII Handling

| Data Type | Protection Claimed | Verified Implementation |
|-----------|-------------------|------------------------|
| CPF | Application-level encryption | ❌ Not verified |
| Health Data JSONB | Encrypted | ❌ Not verified (isEncrypted flag exists but pipeline not found) |
| Emergency Contacts | Encrypted | ❌ Not verified |
| Passwords | bcrypt hashing | ✅ Verified (bcryptjs in package.json) |
| API Keys (Tasy) | Encrypted | ❌ Not verified |
| Data in Transit | TLS 1.3 | ⚠️ Nginx configured with TLS; Docker local uses plaintext |
| Data at Rest | AES-256 | ⚠️ pgcrypto loaded; column-level encryption not verified |

### 6.3 Audit Trail Maturity

**AuditService (805 lines) — Strengths:**
- Comprehensive compliance rules for LGPD (data access, consent, deletion) and ANS (authorization decisions, processing times, appeals)
- Retention policies with archive/anonymize/delete stages
- Security event tracking with severity-based alerting
- Compliance report generation

**AuditService — Gaps:**
- **Uses in-memory Map buffer** (`auditBuffer: Map<string, AuditEntry[]>`), not the Prisma AuditLog model
- **No database persistence** — data lost on server restart
- **AuditLog Prisma model** (polymorphic, 25+ fields, exists in schema) is NOT used by the AuditService
- **Missing immutable guarantee** — in-memory buffer is mutable

### 6.4 Open Compliance Risks

*(Full risk register in Section 8)*

| Risk | Severity |
|------|----------|
| HIPAA references throughout codebase are misleading and legally dangerous | 🔴 Critical |
| No ANVISA SaMD classification for clinical scoring functions | 🔴 Critical |
| No RIPD (DPIA) for sensitive health data processing at scale | 🟠 High |
| Audit trail not persisted to database (in-memory only) | 🟠 High |
| SBIS certification not initiated | 🟡 Medium |
| No DPO/Encarregado identified | 🟡 Medium |
| Missing breach notification procedure | 🟡 Medium |

---

## 7. Architecture Decision Records (ADRs)

### 7.1 Catalog of Existing Implicit Decisions

| ID | Title | Where Found | Status |
|----|-------|-------------|--------|
| IMP-001 | WhatsApp as primary patient interface | Requisitos.md §1.1, Questionary_Sugested.md | Implemented |
| IMP-002 | Event-driven architecture with Kafka | architecture_diagrams.md, docker-compose.infrastructure.yml | Partially configured |
| IMP-003 | PostgreSQL as primary transactional store | schema.prisma, docker-compose.yml | Implemented |
| IMP-004 | Prisma ORM for database access | schema.prisma, package.json | Implemented |
| IMP-005 | Gamification for patient engagement | Requisitos.md §3.1, schema.prisma | Implemented |
| IMP-006 | TypeScript monolith (not Python/Java microservices) | All source code | **Contradicts docs** |
| IMP-007 | HIPAA referenced as compliance framework | 15+ locations | **Wrong jurisdiction** |
| IMP-008 | Multi-tenancy via Organization model | schema.prisma | Implemented |

### 7.2 Proposed New ADRs

*(Full ADR details in docs/_analysis/adrs-draft.md)*

| ID | Title | Status | Impact |
|----|-------|--------|--------|
| ADR-001 | Resolve HIPAA/LGPD Jurisdiction Confusion | Proposed | 🔴 Critical |
| ADR-002 | ANVISA SaMD Classification | Proposed | 🔴 Critical |
| ADR-003 | Architecture Simplification: Monolith-First for MVP | Proposed | 🟠 High |
| ADR-004 | Encryption Strategy for PHI at Rest | Proposed | 🟠 High |
| ADR-005 | Clinical Algorithm Versioning | Proposed | 🟠 High |
| ADR-006 | Idempotency for Message Processing | Proposed | 🟠 High |

---

## 8. Gaps, Open Questions & Risks

### 8.1 Risk Register

*(Full risk details in docs/_analysis/risk-register-roadmap.md)*

| ID | Risk | Severity | Likelihood |
|----|------|----------|------------|
| RISK-001 | Operation without ANVISA classification | 🔴 Critical | 🔴 Very High |
| RISK-002 | Misleading HIPAA compliance claims | 🔴 Critical | 🔴 Very High |
| RISK-003 | PHI leak due to insufficient encryption | 🔴 Critical | 🟠 Medium |
| RISK-004 | Clinical decisions without medical validation | 🔴 Critical | 🟡 Medium |
| RISK-005 | Over-engineered architecture blocking MVP | 🟠 High | 🔴 Very High |
| RISK-006 | Missing RIPD (LGPD Art. 38) | 🟠 High | 🔴 Very High |
| RISK-007 | WhatsApp message idempotency not verified | 🟠 High | 🟡 Medium |
| RISK-008 | External service dependency without circuit breaker | 🟠 High | 🟡 Medium |
| RISK-009 | No formal CI/CD pipeline | 🟡 Medium | 🟠 High |
| RISK-010 | Terraform incomplete (IAC gap) | 🟡 Medium | 🟡 Medium |
| RISK-011 | SBIS certification gap | 🟡 Medium | 🟠 High |
| RISK-012 | Algorithm versioning absent | 🟡 Medium | 🟡 Medium |
| RISK-013 | MongoDB unnecessary in stack | 🟢 Low | 🟡 Medium |
| RISK-014 | Aspirational vs actual test coverage | 🟡 Medium | 🟡 Medium |

### 8.2 Critical Open Questions

| # | Question | Priority |
|---|----------|----------|
| Q1 | What is the legal basis for LGPD processing? Consent (Art. 7) or protection of life (Art. 11, II, g)? | 🔴 Critical |
| Q2 | Has a BAA been signed with Meta for WhatsApp? (mentioned in Requisitos.md) | 🟠 High |
| Q3 | Is there a nursing/care navigation team hired to respond to alerts? | 🔴 Critical |
| Q4 | Are Tasy ERP APIs actually accessible for integration? | 🟠 High |
| Q5 | What is the realistic timeline for first patient? | 🔴 Critical |
| Q6 | Is this single-tenant per operator or multi-tenant SaaS? | 🟠 High |
| Q7 | What is the monthly cloud infrastructure budget? | 🟡 Medium |
| Q8 | Who are the initial target ANS operators? | 🟡 Medium |

---

## 9. Forward Roadmap

### ⏱️ NOW (Weeks 1-4): Regulatory & Technical Foundation

| ID | Item | Effort |
|----|------|--------|
| NEXT-001 | Engage ANVISA specialist — classify platform | M (2-4 wks) |
| NEXT-002 | Replace HIPAA→LGPD throughout codebase & docs | S (1-2 wks) |
| NEXT-003 | Implement 6 healthcare invariants | L (3-4 wks) |
| NEXT-004 | Clinical algorithm validation with medical team | M (2-3 wks) |
| NEXT-005 | Initiate RIPD (LGPD Data Protection Impact Report) | M (2-4 wks) |
| NEXT-006 | Create basic CI/CD pipeline (GitHub Actions) | S (1 wk) |

### 🔜 NEXT (Months 2-4): Platform Consolidation

| ID | Item | Effort |
|----|------|--------|
| NEXT-007 | Simplify architecture (ADR-003) — remove MongoDB, defer Kafka/Camunda/Spark | M |
| NEXT-008 | Implement column-level encryption (ADR-004) | L |
| NEXT-009 | Implement message idempotency (ADR-006) | S |
| NEXT-010 | Implement algorithm versioning (ADR-005) | S |
| NEXT-011 | Complete Terraform AWS modules (sa-east-1) | M |
| NEXT-012 | Create production Grafana dashboards | S |
| NEXT-013 | Real Tasy ERP integration (OAuth2) | L |

### 🔮 LATER (Months 5-12): Scale & Differentiation

| ID | Item | Effort |
|----|------|--------|
| NEXT-014 | SBIS Certification | L (3-6 mo) |
| NEXT-015 | ISO 27001 certification path | XL (6-12 mo) |
| NEXT-016 | External penetration test | M |
| NEXT-017 | Full FHIR R4 interoperability | L |
| NEXT-018 | Extract microservices on demand | L |
| NEXT-019 | Kafka event streaming (Phase 3) | XL |
| NEXT-020 | Advanced ML predictive triggers | XL (6-12 mo) |

### Quick Wins

| ID | Item | Effort |
|----|------|--------|
| QW-1 | Rename `hipaaCompliant` → `lgpdCompliant` in schema | 2h |
| QW-2 | Add `algorithm_version` to clinical entities | 4h |
| QW-3 | Create GitHub Actions CI (test + lint + type-check) | 4h |
| QW-4 | Generate OpenAPI/Swagger from Express routes | 4h |
| QW-5 | Implement `INSERT ON CONFLICT DO NOTHING` for whatsappMessageId | 2h |
| QW-6 | Health check endpoint with DB + Redis + encryption verification | 3h |
| QW-7 | Fix package.json description (remove HIPAA, add LGPD) | 5 min |

---

## 10. Appendix

### A. Full Glossary

*(See docs/_analysis/appendix-glossary-stack.md — Section A for complete 30+ term glossary)*

### B. Acronym List

*(See docs/_analysis/appendix-glossary-stack.md — Section B for 40+ acronyms)*

### C. Tech Stack Comparison — Documented vs Implemented

*(See docs/_analysis/appendix-glossary-stack.md — Section C for detailed comparison table)*

### D. Healthcare Invariants Verification

| # | Invariant | Status |
|---|-----------|--------|
| 1 | Immutable audit trail | ⚠️ Partial — in-memory only |
| 2 | Message idempotency | ❌ Absent |
| 3 | Algorithm versioning | ❌ Absent |
| 4 | Encryption at rest | ⚠️ Partial |
| 5 | Health check + dead man's switch | ⚠️ Partial |
| 6 | Retry with backoff | ⚠️ Partial |

### E. Stakeholder Questions

*(See Section 8.2 — Open Questions)*

### F. Unresolved Contradictions

| # | Contradiction | Sources |
|---|---------------|---------|
| 1 | Architecture specifies Python/FastAPI + Java/Spring; code is 100% TypeScript | architecture_diagrams.md vs all source files |
| 2 | HIPAA referenced as primary compliance framework; correct framework is LGPD | schema.prisma, docs vs Brazilian law |
| 3 | 10 containers in C4Container diagram; 1 operational backend monolith | architecture_diagrams.md vs docker-compose.yml |
| 4 | MongoDB configured but no MongoDB driver in backend dependencies | docker-compose.infrastructure.yml vs backend/package.json |
| 5 | "ISO 27001" claimed; no certification evidence or ISMS documentation | Requisitos.md §4.2 vs codebase |
| 6 | WhatsApp webhook tests document coverage; whatsappMessageId idempotency not verified | tests/README.md vs service implementation |
| 7 | WhatsApp provider is Z-API (z-api.io), NOT Meta Business API as documented in Requisitos.md §5.2 | whatsapp.service.ts base URL vs Requisitos.md |
| 8 | Prisma version mismatch within monorepo: root ^6.19.0 vs backend ^5.7.0 | package.json (root) vs backend/package.json |
| 9 | NestJS decorators found in Express app — code likely copied from another project | ~50 EventEmitter misuse errors across services |

---

## Final Verdict

The **AUSTA Care Platform** has genuine clinical domain expertise embedded in its code (risk assessment, emergency detection, audit service) and a coherent product vision. The WhatsApp-first, gamified approach to patient engagement is innovative for the Brazilian market.

However, the platform is **not ready for production with real patient data** due to three 🔴 Critical blockers:

1. **No ANVISA SaMD classification** — processing clinical data without registration is illegal
2. **HIPAA/LGPD confusion** — compliance claims reference wrong jurisdiction
3. **Missing healthcare invariants** — 5 of 6 production invariants are absent or incomplete

**Recommendation:** Continue development but **pause all clinical algorithm work** until ANVISA classification is resolved. In parallel, execute the "NOW" roadmap items (NEXT-001 through NEXT-006) which address the critical blockers within 4 weeks. The codebase foundation is solid — invest in regulatory readiness before building more features.

---

### What I'd Do First

Contratar um especialista regulatório ANVISA para classificar a plataforma como SaMD e, paralelamente, substituir todas as referências a HIPAA por LGPD no código, schema e documentação. Estas duas ações eliminam os riscos legais mais graves e desbloqueiam o caminho para processar dados reais de pacientes. Sem isso, todo o resto é construir sobre uma fundação juridicamente inviável.

---

*Relatório gerado por Parreira (Orquestrador DevOps) com suporte de 4 agentes especialistas.*  
*Documentação complementar em: docs/_analysis/ | HANDOFF.yaml | docs/review-queue.md*

