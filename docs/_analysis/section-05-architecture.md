# 5. Architecture — Current State Analysis

**Analysis Date:** 26 June 2026
**Analyst:** Hermes Agent (subagent) | **Profile:** parreira
**Source Codebase:** `/Users/familia/code/Coordenacao-Cuidado-Enterprise`

---

## 5.1 Logical/Component Architecture

### 5.1.1 Documented Architecture (architecture_diagrams.md)

The architecture documentation at `docs/architecture_diagrams.md` [lines 1–502] presents **9 Mermaid diagrams** describing a sophisticated microservices ecosystem:

| Diagram | Services Identified |
|---------|-------------------|
| **C4Context** (line 12) | Patient, Care Coordinator, Admin → AUSTA Platform → WhatsApp Business API, ERP Tasy, OpenAI GPT-4, FHIR Gateway |
| **C4Container** (line 39) | API Gateway (Kong), Chat Service (Node.js), AI/NLP Service (Python/FastAPI), Auth Service (Java/Spring), User Service (Node.js), Risk Engine (Python), Notification Service (Node.js), Integration Hub (Java) |
| **Data Flow** (line 81) | Sources → Kafka → Stream/Batch Processing → Storage (Operational DB, Document Store, Cache, Data Lake) → Analytics/ML |
| **AI/ML Pipeline** (line 143) | Ingestion → Feature Engineering → Model Development → Deployment with A/B testing and feedback loop |
| **Security Architecture** (line 198) | Perimeter → Identity & Access (OAuth2/OIDC, MFA, RBAC/ABAC) → Application Security → Data Protection → Runtime Security |
| **Integration Architecture** (line 264) | Integration Hub + Message Queue connecting 16 external systems across Healthcare, Communication, AI/ML, and External APIs |
| **Deployment** (line 331) | Multi-cloud (AWS EKS primary + GCP GKE DR), RDS, DocumentDB, ElastiCache, S3 Data Lake, CloudFront CDN |
| **Event-Driven Sequence** (line 390) | WhatsApp → Gateway → Chat → Kafka → AI → Auth → Notification → Tasy ERP |
| **Monitoring** (line 428) | Data Collection → Prometheus/Elasticsearch/Jaeger/InfluxDB → Grafana/Kibana → AlertManager/PagerDuty |

### 5.1.2 Actual Implementation

**Finding 1: Monolith, Not Microservices** [ANALYST INFERENCE from evidence below]

The documented C4Container diagram describes **7+ independent services** in different languages. The actual `server.ts` [backend/src/server.ts, lines 1–253] reveals a **single Node.js/Express process** mounting all routes under one application:

```typescript
// server.ts lines 109–127 — all routes mounted on one Express app
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/health-data', healthDataRoutes);
app.use('/api/v1/authorizations', authorizationRoutes);
app.use('/api/v1/risk-assessment', advancedRiskRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/ocr', ocrRoutes);
// ... 14+ route groups, single process
```

There is **no service mesh, no separate deployable units**, no inter-service RPC. All "services" are TypeScript modules within one Node.js backend.

**Finding 2: Language Disconnect** [DOCUMENTED FACT]

The C4Container diagram specifies:
- **AI/NLP Service** as `Python/FastAPI` (line 45)
- **Auth Service** as `Java/Spring` (line 46)
- **Risk Engine** as `Python` (line 48)
- **Integration Hub** as `Java` (line 50)

**Zero Python (.py) files exist anywhere in the repository.** [search_files for `*.py` returned `total_count: 0`, confirmed]
**Zero Java (.java) files exist anywhere in the repository.** [search_files for `*.java` returned `total_count: 0`, confirmed]

All actual code is TypeScript/Node.js:
- **AI Service**: `openaiService.ts` [backend/src/services/openaiService.ts, 675 lines] — TypeScript class using the `openai` npm package
- **Risk Engine**: `risk-assessment.service.ts` — TypeScript
- **Auth**: JWT handled in TypeScript middleware/routes (`jsonwebtoken` in backend/package.json line 49)
- **Integration Hub**: `tasyIntegration.ts` [717 lines] — TypeScript class

**Finding 3: WhatsApp API Provider Discrepancy** [DOCUMENTED FACT]

The architecture diagrams and Requisitos.md (line 70) specify **WhatsApp Business API (Meta)**. However, the actual implementation in `whatsapp.service.ts` [line 2] reveals:

```typescript
/**
 * Z-API WhatsApp Service
 * Comprehensive WhatsApp integration using Z-API
 */
export class WhatsAppService {
    private apiClient: AxiosInstance;  // Calls Z-API endpoints
```

The code uses **Z-API** (z-api.io), a third-party Brazilian WhatsApp gateway provider, NOT Meta's official WhatsApp Business API. This is a **significant architectural deviation** with implications for:
- Data residency (Z-API infrastructure vs Meta's)
- Message throughput and pricing models
- LGPD compliance (Brazilian data protection law)
- WhatsApp policy compliance (Meta's terms of service prohibit unofficial APIs)

### 5.1.3 Communication Patterns

| Pattern | Documented | Implemented | Evidence |
|---------|-----------|-------------|----------|
| **REST APIs** | All services | ✅ Express routes | server.ts lines 109–127 |
| **Kafka event streaming** | Event backbone | ✅ kafkajs configured, topics created | server.ts lines 146–160 |
| **WebSocket** | Not in diagrams | ✅ socket.io with Redis adapter | backend/package.json line 63; server.ts line 37 |
| **Redis pub/sub** | Cache layer | ✅ ioredis client | backend/package.json line 48 |
| **BullMQ queues** | Not documented | ✅ bullmq package | backend/package.json line 39 |
| **Service mesh** | Implicit in diagrams | ❌ Not implemented | Monolithic server |
| **gRPC** | Not mentioned | ❌ Not implemented | No protobuf files found |

[ANALYST INFERENCE] The Kafka integration is wired in infrastructure code (`kafkaClient` imported in server.ts line 34) and topics are created at startup (lines 146–160), but there is **no evidence of true event-driven decoupling** — the server initializes Kafka, MongoDB, Redis, ML Pipeline, and WebSocket all in a single blocking `initializeServices()` function (lines 136–192). If Kafka is unavailable, the entire server startup fails (line 189–191: `throw error`).

### 5.1.4 Kong API Gateway

`infrastructure/kong/kong.yaml` [329 lines] defines an **extremely comprehensive Kong configuration**:
- 3 upstreams (backend, whatsapp-service, ml-service)
- 4 service definitions (backend-api, whatsapp-api, ml-api, websocket-api)
- 7+ global plugins (CORS, rate limiting, request size, security headers, correlation-id, http-log, prometheus)
- Service-specific plugins (JWT auth, request validation, IP restriction, proxy-cache)
- Consumer groups with tiered rate limits

**However**, Kong is **not present in either docker-compose file** (docker-compose.yml and docker-compose.infrastructure.yml). This configuration is **aspirational infrastructure** — documented but not deployable from the repository.

---

## 5.2 Tech Stack Assessment

### 5.2.1 Languages

| Language | Documented Role | Actual Presence | Evidence |
|----------|----------------|-----------------|----------|
| **TypeScript** | Chat, User, Notification services | **100% of backend** | All `.ts` files in backend/src/ |
| **JavaScript (React)** | Frontend | ✅ PWA frontend | 16 `.tsx` files, frontend/package.json |
| **Python** | AI/NLP, Risk Engine | **ZERO files** | search_files `*.py` → 0 |
| **Java** | Auth, Integration Hub | **ZERO files** | search_files `*.java` → 0 |

**Assessment:** The codebase is **homogeneously TypeScript/Node.js**. The polyglot architecture described in diagrams does not exist. [DOCUMENTED FACT]

### 5.2.2 Frameworks and Libraries

**Backend (backend/package.json, lines 1–105):**

| Category | Packages | Version |
|----------|----------|---------|
| **Web framework** | Express | ^4.18.2 |
| **ORM** | @prisma/client | ^5.7.0 |
| **Validation** | Zod, Joi | ^3.22.4, ^17.11.0 |
| **Auth** | jsonwebtoken, bcrypt | ^9.0.2, ^5.1.1 |
| **AI/ML** | @langchain/openai, @tensorflow/tfjs-node, openai | ^1.1.1, ^4.16.0, ^4.20.1 |
| **Messaging** | kafkajs, bullmq | ^2.2.4, ^5.1.1 |
| **Cache** | ioredis | ^5.3.2 |
| **FHIR** | fhir | ^4.11.1 |
| **Document processing** | @aws-sdk/client-textract, @google-cloud/vision, tesseract.js, sharp, puppeteer | Various |
| **Real-time** | socket.io, @socket.io/redis-adapter | ^4.6.1, ^8.3.0 |
| **Monitoring** | prom-client, winston | ^15.1.0, ^3.11.0 |
| **Security** | helmet, cors, express-rate-limit, compression | Various |
| **WhatsApp** | whatsapp-web.js | ^1.23.0 |

**Frontend (frontend/package.json, lines 1–69):**

| Category | Packages | Version |
|----------|----------|---------|
| **UI framework** | React 18 | ^18.2.0 |
| **Build** | Vite 5 | ^5.0.6 |
| **Routing** | React Router 6 | ^6.20.1 |
| **State management** | TanStack React Query 5, Zustand 4 | ^5.8.4, ^4.4.7 |
| **Forms** | React Hook Form 7, Zod 3 | ^7.48.2, ^3.22.4 |
| **UI components** | Radix UI, Lucide React, Framer Motion | Various |
| **Charts** | Recharts 2 | ^2.8.0 |
| **PWA** | workbox-window | ^7.0.0 |
| **Styling** | TailwindCSS 3 | ^3.3.6 |
| **Testing** | Vitest, Testing Library | ^1.0.4, ^14.1.2 |

**Root (package.json, lines 1–81):**

| Category | Version |
|----------|---------|
| **Node.js engine** | >=18.0.0 |
| **TypeScript** | ^5.5.3 |
| **Prisma** | ^6.19.0 (newer than backend's ^5.7.0 — version mismatch) |
| **Testing** | Jest ^29.7.0 |

**Key Observation:** Root uses Prisma ^6.19.0 but backend uses ^5.7.0 — **Prisma version mismatch within the same monorepo**. [DOCUMENTED FACT]

### 5.2.3 Data Stores: Documented vs Implemented

| Store | Architecture Diagram Claim | docker-compose.infrastructure.yml | docker-compose.yml (basic) | Backend package.json | Verdict |
|-------|---------------------------|----------------------------------|---------------------------|---------------------|---------|
| **PostgreSQL** | Primary transactional DB | ✅ postgres:15-alpine | ✅ postgres:15-alpine | @prisma/client | ✅ **Implemented** |
| **MongoDB** | Document store (conversations) | ✅ mongo:6 | ❌ Not present | mongodb ^6.3.0 | ⚠️ **Wired but absent in dev compose** |
| **Redis** | Cache, real-time | ✅ redis:7-alpine | ✅ redis:7-alpine | ioredis, redis ^4.6.11 | ✅ **Implemented** |
| **Delta Lake / Data Lake** | Analytics/ML storage | ❌ Not present | ❌ Not present | ❌ No relevant package | ❌ **Aspirational only** |
| **Kafka** | Event backbone | ✅ Confluent 7.5.0 | ❌ Not present | kafkajs | ⚠️ **Infra compose only** |
| **FHIR Server** | Interoperability | ✅ HAPI FHIR R4 | ❌ Not present | fhir ^4.11.1 | ⚠️ **Infra compose only** |
| **Elasticsearch** | Logging, search | ✅ ES 8.11 | ✅ ES 8.11 (logging profile) | ❌ No package | ⚠️ **Optional/infra only** |
| **MinIO** | S3-compatible storage | ✅ minio:latest | ❌ Not present | @aws-sdk/client-s3 | ⚠️ **Dev S3 alternative** |

[ANALYST INFERENCE] The data architecture is **split across two docker-compose files**:
- `docker-compose.yml` (174 lines) — the **working development setup**: PostgreSQL, Redis, Backend, pgAdmin, Redis Commander, optional ELK
- `docker-compose.infrastructure.yml` (265 lines) — the **aspirational full stack**: everything above plus MongoDB, Kafka+Zookeeper, FHIR, Prometheus, Grafana, Jaeger, MinIO, ELK

This suggests the project uses `docker-compose.yml` for daily development and `docker-compose.infrastructure.yml` represents the target production architecture. The Delta Lake / Data Lake from the diagrams has **no infrastructure representation** in either compose file.

### 5.2.4 Infrastructure & Deployment

#### Container Orchestration

**K8s manifests exist** at `austa-care-platform/k8s/`:
- `namespace.yaml` — namespace `austa-production`
- `deployments/backend-deployment.yaml` — 3 replicas, resource limits (500m–2000m CPU, 1Gi–4Gi RAM), secrets/configmaps for DB/Redis/Kafka/AWS/OpenAI
- `deployments/frontend-deployment.yaml` — frontend deployment
- `services/backend-service.yaml`, `services/frontend-service.yaml` — ClusterIP services
- `ingress.yaml` — ingress routing
- `hpa.yaml` [72 lines] — HorizontalPodAutoscaler: backend 3–10 pods (CPU 70%/MEM 80%), frontend 2–5 pods

**Dockerfile** at `backend/Dockerfile` [121 lines] — multi-stage (dependencies → build → development → production), non-root user, Chromium for Puppeteer, health check.

#### Infrastructure as Code

**Terraform:** Only `terraform.tfvars.example` exists [103 lines] — no actual `.tf` module files. This is an **aspirational template**. The file references:
- AWS EKS cluster v1.28
- RDS PostgreSQL r6g.xlarge with Multi-AZ
- ElastiCache Redis, DocumentDB
- WAF, Shield, GuardDuty, Security Hub
- LGPD + HIPAA compliance tags

**Assessment:** No deployable Terraform configuration exists. The `.tfvars.example` is a variable definition without any resource modules. [DOCUMENTED FACT]

#### CI/CD

No CI/CD configuration files (GitHub Actions `.github/workflows/`, GitLab CI `.gitlab-ci.yml`, Jenkinsfile, etc.) were found in the repository. The K8s deployments reference `ghcr.io/austa-care/backend:latest` (GitHub Container Registry), suggesting GitHub Actions is the intended CI but not yet configured.

---

## 5.3 Data Architecture

### 5.3.1 Prisma Schema Analysis

The Prisma schema at `prisma/schema.prisma` [1259 lines] defines a comprehensive PostgreSQL data model with **17 entity models** and **32 enum types**.

#### Core Entities

| Entity | Table | Purpose | Notable Columns |
|--------|-------|---------|-----------------|
| **Organization** | `organizations` | Multi-tenant isolation | taxId (CNPJ), hipaaCompliant, dataRetentionYears, settings (JSONB) |
| **User** | `users` | Patient/Beneficiary | phone (WhatsApp ID), cpf (encrypted), whatsappId, emergencyContact (JSONB encrypted) |
| **Provider** | `providers` | Healthcare professionals | license (CRM/COREN), specialty[], role (enum) |
| **Conversation** | `conversations` | WhatsApp chat sessions | whatsappChatId, aiContext (JSONB), healthTopics[], botEnabled |
| **Message** | `messages` | Individual messages | aiConfidence, aiIntent, aiEntities (JSONB), urgencyLevel |
| **HealthData** | `health_data` | Medical records (encrypted) | conditions/medications/allergies (JSONB encrypted), sensitivityLevel, accessLevel |
| **Authorization** | `authorizations` | Procedure authorizations | procedureCode, tasyReferenceId, multi-step approval workflow |
| **Document** | `documents` | Uploaded files + OCR | ocrText, ocrConfidence, extractedData (JSONB), retentionUntil |
| **Mission** | `missions` | Gamified tasks | pointsReward, badgeReward, prerequisites[], requiredActions (JSONB) |
| **HealthPoints** | `health_points` | User points/levels | totalPoints, currentLevel, badges[], dailyStreak |
| **OnboardingProgress** | `onboarding_progress` | Mission tracking | progress (0-100), currentStep, pointsEarned |
| **PointTransaction** | `point_transactions` | Points audit trail | type, amount, sourceType |
| **VitalSign** | `vital_signs` | Health measurements | type, value, unit, measuredAt |
| **QuestionnaireResponse** | `questionnaire_responses` | Survey responses | responses (JSONB), score |
| **Achievement** | `achievements` | Badge tracking | achievementType, badgeId, isCompleted |
| **TasyIntegration** | `tasy_integrations` | ERP config | apiKey (encrypted), syncInterval, fieldMapping (JSONB) |
| **TasySyncLog** | `tasy_sync_logs` | Sync audit | recordsAttempted/Succeeded/Failed, errorDetails |
| **AuditLog** | `audit_logs` | Full audit trail | oldValues/newValues (JSONB), riskLevel, hipaaRelevant, lgpdRelevant |

#### Relationship Analysis

```
Organization (1) ──< (N) User
Organization (1) ──< (N) Provider
User (1) ──< (N) Conversation
User (1) ──< (N) Message
Conversation (1) ──< (N) Message
User (1) ──< (N) HealthData
User (1) ──< (N) Authorization
User (1) ──< (N) Document
User (1) ──< (N) VitalSign
User (1) ──< (N) QuestionnaireResponse
User (1) ──< (N) HealthPoints (unique)
User (1) ──< (N) OnboardingProgress
User (1) ──< (N) Achievement
HealthPoints (1) ──< (N) PointTransaction
Authorization ── Provider (nullable)
Authorization ── HealthData (nullable)
TasyIntegration (1) ──< (N) TasySyncLog
AuditLog ── User, Provider, Conversation, HealthData, Authorization, Document, TasyIntegration (all nullable)
```

[ANALYST INFERENCE] The AuditLog model uses a **polymorphic pattern** with nullable foreign keys to multiple entity types (lines 904–911: `userId`, `providerId`, plus named relations to `conversation`, `healthData`, `authorization`, `document`, `tasyIntegration`). This is fragile — the `entityId` string field must be manually correlated to the correct FK.

### 5.3.2 Multi-Tenancy

Multi-tenancy is implemented via the `organizationId` field on **every entity table**. The Organization model serves as the tenant anchor.

**Documentation claims** (DATABASE_SCHEMA_DOCUMENTATION.md, line 27): "Complete data separation between organizations" and (line 314): "Row-Level Security: PostgreSQL RLS for multi-tenancy."

**Reality check:** The Prisma schema and SQL migration show **organizationId foreign keys** on every relevant table but **no PostgreSQL Row-Level Security (RLS) policies** in the migration SQL. The migration file `001_init_austa_care_schema.sql` has no `CREATE POLICY` or `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements. [DOCUMENTED FACT — documented claim vs actual migration SQL]

Multi-tenancy isolation relies entirely on **application-level filtering** (Prisma queries filtered by organizationId) rather than database-enforced RLS.

### 5.3.3 Encryption Strategy

**Documentation claims** (DATABASE_SCHEMA_DOCUMENTATION.md, lines 305–309):
- CPF encryption at application level
- Health data encryption at application level
- Emergency contacts encryption
- API keys encryption

**Reality check:** The Prisma schema defines these fields as regular `String`/`Json`/`JSONB` types:
- `User.cpf` → `String?` (line 66), comment says "encrypted"
- `User.emergencyContact` → `Json?` (line 95), comment says "Encrypted"
- `HealthData.conditions/medications/allergies/symptoms/vitalSigns/labResults` → `Json?` (lines 292–297), comments say "Encrypted"
- `TasyIntegration.apiKey` → `String` (line 658), comment says "Encrypted"

The migration SQL mirrors this — fields are plain TEXT/JSONB with comments about encryption (e.g., migration line 344: `"cpf" TEXT, -- Will be encrypted at application level`).

**Assessment:** Encryption is **documented as intended behavior** but the schema offers **no server-side encryption mechanisms** (no pgcrypto usage, no application-level encryption library in package.json such as `crypto-js`, `node-crypto`, or AWS KMS SDK). The `pgcrypto` extension IS enabled in the migration (line 7: `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`) but is **never used** in any column definitions or triggers. [DOCUMENTED FACT]

The Document model (line 617) includes `encryptionKey String?` and `isEncrypted Boolean @default(false)` — suggesting client-side or manual encryption only.

### 5.3.4 Audit Trail

The `AuditLog` model (schema lines 861–918) is **comprehensive and well-designed**:

| Feature | Implementation |
|---------|---------------|
| **Actor tracking** | userId, providerId (nullable FK), ipAddress, userAgent |
| **Action catalog** | 14 audit actions (CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT, SYNC, BACKUP, RESTORE, PERMISSION_CHANGE, CONFIG_CHANGE, EMERGENCY_ACCESS) |
| **Change tracking** | oldValues (JSONB), newValues (JSONB), changedFields (String[]) |
| **Risk assessment** | riskLevel (enum: LOW/MEDIUM/HIGH/CRITICAL), sensitiveData flag, requiresReview flag |
| **Compliance** | hipaaRelevant, lgpdRelevant flags |
| **Session correlation** | sessionId, requestId |
| **Indexed** | 5 composite indexes (org+occurredAt, user+action, entity+entityId, riskLevel+sensitiveData, hipaaRelevant+lgpdRelevant) |

[ANALYST INFERENCE] The audit model is one of the most mature components of the schema. However, there is **no evidence of middleware or service code that populates these audit logs automatically** — the audit service (`auditService.ts`) exists by name in the task description but was not found as a standalone file in the backend/src/services directory.

### 5.3.5 Data Model Gaps

1. **No FHIR resource tables**: Despite the `fhir` npm package and HAPI FHIR server in infra compose, there are no FHIR-specific database tables (Patient, Observation, Condition, MedicationRequest, etc.) in the Prisma schema.

2. **No terminology/code system tables**: No tables for ICD-10 codes, SNOMED-CT, LOINC, or Brazilian TUSS codes. The `procedureCode` field on Authorization is a free-text string.

3. **No scheduling/appointment model**: Despite "APPOINTMENT" being a ConversationType enum value, there is no Appointment entity.

4. **No notification template model**: Despite a Notification Service in the architecture, there is no notification template or delivery tracking table.

5. **Prisma version mismatch**: Root package.json has `prisma: ^6.19.0` while backend has `prisma: ^5.7.0` — these produce incompatible Prisma clients. [DOCUMENTED FACT]

---

## 5.4 Interoperability & Standards

### 5.4.1 FHIR (HL7 FHIR R4)

| Aspect | Status | Evidence |
|--------|--------|----------|
| **FHIR Server** | ⚠️ Configured in infra | docker-compose.infrastructure.yml line 114: HAPI FHIR R4 on port 8090 |
| **FHIR npm package** | ✅ Dependency present | backend/package.json line 45: `fhir: ^4.11.1` |
| **FHIR in OCR pipeline** | 📋 Documented | Requisitos.md line 173: "Estruturação FHIR" step in OCR pipeline |
| **FHIR resource models** | ❌ No DB tables | No FHIR resource tables in Prisma schema |
| **FHIR in Kong** | ❌ Not configured | Kong routes have no FHIR-specific service |

**Assessment:** FHIR is configured as **infrastructure** (HAPI server) and **planned** for document processing, but there is **no evidence of FHIR resource creation, storage, or exchange** in the application code. The OCR pipeline documentation mentions FHIR structuring (Requisitos.md line 173), suggesting intention but not implementation.

### 5.4.2 Terminology Standards

| Standard | Documentation Mention | Codebase | Assessment |
|----------|----------------------|----------|------------|
| **ICD-10 (CID-10)** | Requisitos.md line 162: "Identifica CID-10" in OCR pipeline | No ICD-10 table/seed data | 📋 Planned for OCR |
| **SNOMED-CT** | Not mentioned | No implementation | ❌ Not considered |
| **LOINC** | Not mentioned | No implementation | ❌ Not considered |
| **TISS/TUSS** (Brazilian health insurance standards) | Not mentioned | No implementation | ❌ **Critical gap for Brazilian market** |
| **RNDS** (Brazilian National Health Data Network) | Not mentioned | No implementation | ❌ Not considered |

**Critical Gap:** The platform targets the **Brazilian healthcare market** (CNPJ, CPF, pt-BR locale, Tasy ERP) but has **no implementation of mandatory Brazilian interoperability standards** (TISS for health insurance data exchange, TUSS for procedure terminology, RNDS for national health data network). [ANALYST INFERENCE — the absence is a regulatory compliance risk for production deployment in Brazil]

### 5.4.3 Compliance Standards

| Standard | Documentation | Implementation |
|----------|--------------|----------------|
| **HIPAA** | Claimed in schema docs, diagram, .tfvars tags | AuditLog has `hipaaRelevant` flag; schema has `hipaaCompliant` flag; no actual HIPAA implementation (BAAs, encryption at rest, access logging automation) |
| **LGPD** | Referenced in schema doc (Brazilian GDPR equivalent) | AuditLog has `lgpdRelevant` flag; no data subject request (DSAR) handling, no consent management tables, no data portability mechanisms |
| **ISO 27001** | Not mentioned | No evidence |
| **SOC 2** | Not mentioned | No evidence |

**Assessment:** HIPAA and LGPD are **acknowledged via flags and tags** but not **implemented as compliance controls**. The platform has the **scaffolding** (audit log model, encryption markers, retention fields) but lacks the **operational mechanisms** (automated audit logging, consent management, data subject access request workflows, breach notification procedures). [DOCUMENTED FACT]

---

## 5.5 Integrations

### 5.5.1 Integration Inventory

| Integration | Architecture Diagram | Configured/Implemented | Status |
|-------------|---------------------|----------------------|--------|
| **WhatsApp** | Meta WhatsApp Business API | Z-API (Brazilian provider) | ⚠️ **Divergent implementation** |
| **ERP Tasy** | OAuth2 integration | ✅ tasyIntegration.ts (717 lines) | ✅ **Implemented** |
| **OpenAI GPT-4** | AI language model | ✅ openaiService.ts (675 lines), @langchain/openai | ✅ **Implemented** |
| **AWS Textract** | OCR service (diagram line 316) | ✅ @aws-sdk/client-textract in package.json | ✅ **Dependency present** |
| **Google Cloud Vision** | OCR service | ✅ @google-cloud/vision in package.json | ✅ **Dependency present** |
| **AWS Comprehend Medical** | AI/ML (diagram line 315) | ❌ No SDK dependency | ❌ **Not implemented** |
| **FHIR Gateway** | Interoperability | ⚠️ HAPI FHIR in infra compose only | ⚠️ **Infrastructure only** |
| **Payment Gateways** | External APIs (diagram line 294) | ❌ No implementation | ❌ **Not implemented** |
| **Government APIs** | External APIs (diagram line 295) | ❌ No implementation | ❌ **Not implemented** |
| **Insurance Networks** | External APIs (diagram line 296) | ❌ No implementation | ❌ **Not implemented** |
| **Pharmacy Systems** | External APIs (diagram line 297) | ❌ No implementation | ❌ **Not implemented** |
| **SMS Gateway** | Communication (diagram line 280) | ❌ No implementation | ❌ **Not implemented** |
| **Email Service** | Communication (diagram line 281) | ❌ No implementation | ❌ **Not implemented** |
| **Push Notifications** | Communication (diagram line 282) | ❌ No implementation | ❌ **Not implemented** |

**Assessment:** Only **3 of 14 documented integrations** have actual implementation evidence (WhatsApp via Z-API, Tasy ERP, OpenAI). The remaining 11 are aspirational diagram entries with no corresponding code, configuration, or infrastructure.

### 5.5.2 Tasy ERP Integration — Deep Dive

`tasyIntegration.ts` [717 lines] implements:
- **OAuth2 token management** with token refresh (auth token + expiry tracking, lines 13–14)
- **Eligibility checks** (`/eligibility/{patientId}` endpoint, line 32)
- **Rate limiting** with request queuing (lines 16–17)
- **EventEmitter pattern** for integration events
- **Deduplication** of concurrent requests

The `TasyIntegration` database model (schema lines 648–696) mirrors this with:
- Instance URL, API version
- Encrypted API key + client ID
- Configurable sync interval (default 300s)
- Field mapping (JSONB for configurable data transformations)
- Error tracking (errorCount, lastError, lastErrorAt)
- Performance metrics (avgSyncTime, recordsProcessed, recordsFailed)

The `TasySyncLog` model (schema lines 698–738) provides detailed sync auditing:
- Full/incremental/differential/real-time sync types
- Import/export/bidirectional direction tracking
- Per-record-type processing statistics
- Duration tracking and error details

**Assessment:** The Tasy integration is the **most mature integration** in the codebase, with both a comprehensive service implementation and detailed database tracking. [DOCUMENTED FACT]

### 5.5.3 WhatsApp Integration — Provider Discrepancy

As noted in §5.1.2, the architecture specifies **Meta WhatsApp Business API** but the code implements **Z-API**. This has cascading implications:

1. **Webhook format**: Z-API and Meta have different webhook payload structures
2. **Message template management**: Different APIs for template creation/approval
3. **Media handling**: Different endpoints and formats
4. **Pricing**: Z-API charges per-message with different tiers
5. **WhatsApp policy compliance**: Meta's Business Policy prohibits unofficial API usage
6. **LGPD implications**: Z-API's data processing terms vs Meta's

The `webhook-processor.service.ts` needs to align with whichever provider is actually used.

---

## 5.6 Cross-Cutting Concerns

### 5.6.1 Authentication & Authorization

**Implemented:**
- **JWT tokens**: `jsonwebtoken` package (backend/package.json line 49), refresh token support in User model (schema line 74)
- **bcrypt**: Password hashing (backend/package.json line 38: `bcrypt: ^5.1.1`)
- **Helmet**: Security headers (server.ts line 45)
- **CORS**: Configured with origin and credentials (server.ts lines 58–62)
- **Rate limiting**: express-rate-limit on `/api routes` (server.ts lines 75–85)
- **Kong JWT plugin**: Configured in kong.yaml (lines 211–218) — aspirational since Kong is not deployed

**Documented but unimplemented:**
- **OAuth 2.0/OIDC**: Architecture diagram line 200 claims OAuth 2.0/OIDC — zero OAuth/OIDC npm packages (no `openid-client`, `passport`, `oauth2orize`)
- **MFA**: Diagram line 201 claims Multi-Factor Auth — no MFA packages (no `speakeasy`, `otplib`)
- **RBAC/ABAC**: Diagram line 202 claims RBAC/ABAC — no authorization framework packages (no `casbin`, `accesscontrol`); the Provider model has a `role` enum but no permission matrix

**Assessment:** Authentication is **basic JWT-based** — adequate for early stages but far below the multi-layered security described in the architecture diagrams. [DOCUMENTED FACT]

### 5.6.2 Audit Trail

As analyzed in §5.3.4, the `AuditLog` model is well-designed. However:

- **No Prisma middleware for automatic audit logging** found in the codebase
- **No service-level audit wrapper** evident in server.ts or route files
- **Document audit relationships exist** (named relations in schema lines 907–911) but require manual population

### 5.6.3 Observability

| Component | Status | Evidence |
|-----------|--------|----------|
| **Prometheus** | ✅ Configured | prometheus.yml [107 lines] with 8 scrape jobs (backend, postgres, mongodb, redis, kafka, node, nginx, k8s); docker-compose.infrastructure.yml line 134 |
| **Grafana** | ✅ Configured | Dashboards: system-health.json, api-performance.json; datasources configured; docker-compose.infrastructure.yml line 155 |
| **Jaeger** | ✅ Configured | docker-compose.infrastructure.yml line 177 (all-in-one), ports 5775–16686 |
| **ELK Stack** | ✅ Configured | Elasticsearch + Kibana in both compose files (profiled in basic); docker-compose.infrastructure.yml lines 216–248 |
| **prom-client** | ✅ Dependency | backend/package.json line 57: `prom-client: ^15.1.0` |
| **Metrics endpoint** | ✅ Code | server.ts lines 96–103: `/metrics` endpoint serving Prometheus format |
| **Structured logging** | ✅ Code | Winston logger (server.ts line 10, backend/package.json line 66) with Morgan HTTP logging |
| **AlertManager** | ⚠️ Config only | Referenced in prometheus.yml line 13; no alert rules found in repo |
| **PagerDuty** | ❌ Not configured | Diagram line 468 only |
| **Slack/Teams** | ❌ Not configured | Diagram line 470 only |

**The observability stack is one of the most complete aspects of the infrastructure configuration.** The Prometheus config targets 8 specific services, Grafana has predefined dashboards, and the backend exposes metrics natively. However, all of this is in `docker-compose.infrastructure.yml` — **not the basic development compose file**. [DOCUMENTED FACT]

### 5.6.4 Deployment & CI/CD

| Aspect | Status | Evidence |
|--------|--------|----------|
| **Docker** | ✅ Multi-stage builds | backend/Dockerfile [121 lines] with deps/build/dev/prod stages |
| **Kubernetes** | ✅ Manifests exist | 8 YAML files in k8s/ directory |
| **K8s HPA** | ✅ Configured | hpa.yaml: CPU 70%/MEM 80% scaling triggers |
| **Terraform** | ❌ Stub only | Only .tfvars.example, no .tf module files |
| **CI/CD pipeline** | ❌ Not found | No .github/workflows, .gitlab-ci.yml, or Jenkinsfile |
| **Blue-green deploy** | 📋 Documented | Requisitos.md line 100: "Blue-green deployment com rollback automático" |
| **Secrets management** | ⚠️ K8s secrets only | backend-deployment.yaml references `austa-secrets` Secret; @aws-sdk/client-secrets-manager package present |

**Assessment:** Docker and K8s configurations are production-ready in structure. The **critical gap is the absence of CI/CD pipeline definitions** and the **Terraform infrastructure-as-code being only a variable template** without actual resource definitions.

---

## 5.7 Key Findings Summary

### 5.7.1 Contradictions Between Documentation and Implementation

| # | Contradiction | Documentation | Implementation | Severity |
|---|--------------|---------------|----------------|----------|
| 1 | **Service architecture** | 7+ microservices in 4 languages | Single monolithic Node.js/Express backend | 🔴 **Critical** |
| 2 | **Python/Java services** | AI in Python FastAPI, Auth & Integration in Java Spring | 100% TypeScript | 🔴 **Critical** |
| 3 | **WhatsApp provider** | Meta WhatsApp Business API | Z-API (third-party Brazilian provider) | 🔴 **Critical** |
| 4 | **Data Lake** | Delta Lake for analytics/ML | No Delta Lake, no data lake infrastructure | 🟡 Significant |
| 5 | **OAuth2 / MFA / RBAC** | Full identity architecture | Basic JWT only | 🟡 Significant |
| 6 | **Encryption at rest** | "Application-level encryption" for sensitive fields | Fields are plain TEXT/JSONB; pgcrypto enabled but unused | 🟡 Significant |
| 7 | **PostgreSQL RLS** | "Row-Level Security for multi-tenancy" | No RLS policies in migration SQL | 🟡 Significant |
| 8 | **Kong API Gateway** | Full Kong config (329 lines) | Not present in any docker-compose file | 🟡 Significant |
| 9 | **Terraform IaC** | Production AWS infrastructure | Only .tfvars.example (no .tf modules) | 🟡 Significant |
| 10 | **AWSDocumentDB** (K8s config) | AWS DocumentDB via secret | Actual infra has MongoDB, not DocumentDB | 🟢 Minor |
| 11 | **Camunda BPM** | Requisitos.md line 75: Camunda 8 | Not in package.json or infrastructure | 🟢 Minor |
| 12 | **PRISMA version** | Root ^6.19.0 vs Backend ^5.7.0 | Incompatible Prisma versions in monorepo | 🟢 Minor |

### 5.7.2 Is the Architecture Over-Engineered?

**Yes, for the current project stage.** The documentation describes a production-grade, multi-cloud, polyglot microservices architecture suitable for 100,000+ users with:
- 7+ independent services in 4 programming languages
- 3 database types + data lake + feature store
- Multi-cloud DR (AWS + GCP)
- Full observability with Prometheus/Grafana/Jaeger/ELK
- Kong API Gateway with tiered rate limiting
- Event-driven architecture with Kafka backbone
- AI/ML pipeline with A/B testing and feedback loops

**The actual codebase** is:
- A single Node.js/Express backend
- One database (PostgreSQL) with Redis cache
- MongoDB wired but non-essential
- Docker Compose for local development
- K8s manifests for production deployment
- No CI/CD pipeline configured

[ANALYST INFERENCE] The architecture was likely designed from a reference architecture blueprint or a generative AI output before implementation began. The diagrams describe a **target state** while the code reflects **current capabilities**. The gap is **substantial** — approximately 75% of documented capabilities are aspirational.

### 5.7.3 What's Actually Working (Evidence-Based)

| Component | Assessment |
|-----------|-----------|
| **Prisma data model** | ✅ Mature: 17 entities, 32 enums, well-indexed |
| **Tasy ERP integration** | ✅ Most mature integration: 717 lines, OAuth2, rate limiting, sync logging |
| **OpenAI integration** | ✅ Working: 675 lines, persona system (Zeca/Ana), token tracking |
| **WhatsApp via Z-API** | ✅ Working: 839 lines, message queue, multi-media |
| **OCR pipeline** | ✅ Dependencies present: AWS Textract + Google Vision + Tesseract |
| **Health scoring/risk assessment** | ✅ Services exist with unit tests |
| **Gamification system** | ✅ Full data model: missions, points, levels, streaks, achievements |
| **Frontend PWA** | ✅ React 18 + Vite 5, 16 components, modern stack |
| **Authorization workflow** | ✅ State machine (605 lines) with multi-step approval |
| **Docker multi-stage builds** | ✅ Production-ready backend Dockerfile |
| **K8s deployment configs** | ✅ Manifest-ready (no CI/CD to execute them) |

### 5.7.4 Critical Gaps for Production Readiness

1. **Brazilian Interoperability Standards** (TISS/TUSS/RNDS): Complete absence — regulatory risk for ANS compliance
2. **Encryption at Rest**: Claimed but not evidenced in code or schema
3. **LGPD Compliance**: No data subject rights management, no consent tracking beyond audit flags
4. **CI/CD Pipeline**: No automated build/test/deploy pipeline
5. **Infrastructure as Code**: No deployable Terraform modules
6. **API Gateway**: Kong configured but not deployable from repo
7. **WhatsApp Provider**: Vendor lock-in to Z-API; migration path to Meta Business API needed
8. **Data Lake / Analytics**: Aspirational with no infrastructure

---

## 5.8 Recommendations

### Immediate (Sprint-Level)
1. **Align WhatsApp provider**: Decide Z-API vs Meta Business API and document the decision
2. **Resolve Prisma version mismatch**: Standardize on one Prisma version across monorepo
3. **Add CI/CD**: GitHub Actions workflow for build → test → lint → container build → push
4. **Implement audit logging middleware**: Prisma middleware to auto-populate AuditLog on mutations

### Short-Term (1–2 Sprints)
5. **Encryption implementation**: Add `crypto-js` or `node:crypto` layer for CPF, health data, API keys
6. **PostgreSQL RLS**: Implement row-level security policies or document decision not to use RLS
7. **Terraform modules**: Create actual .tf files from the .tfvars template
8. **OAuth2 provider integration**: Add OIDC support for provider login (Azure AD, Google Workspace)

### Medium-Term (Roadmap)
9. **TISS/TUSS implementation**: Brazilian insurance data exchange standards
10. **Microservice decomposition**: Split monolithic backend into independently deployable services along documented boundaries
11. **Data Lake architecture**: Implement Delta Lake or document alternative analytics strategy
12. **LGPD compliance features**: DSAR workflow, consent management, data portability exports

---

*End of Section 5 — Architecture & Data Analysis*
