# Forensics Mission: AUSTA → AMH Data Platform Integration Architecture

**Date:** 2026-06-27  
**Analyst:** Hermes Agent (subagent delegated by Parreira)  
**Status:** Complete — Architecture Analysis + 6 Integration ADRs Proposed  

---

## Part A: AMH Pattern Analysis

### Key AMH Architecture Patterns Relevant to AUSTA Integration

| Pattern | ADR Ref | Description | Relevance to AUSTA |
|---------|---------|-------------|-------------------|
| **Multi-Tenant Prefix + LF-Tags + ABAC** | ADR-005 | 4-layer isolation: S3 prefix → Glue DB → LF-Tags → session tags. Tenant `austa_clinicas` is first active. | AUSTA is a tenant (`austa_clinicas`) with its own prefix, KMS CMK, and Glue databases. |
| **MPI: Deterministic + Probabilistic Linking + Consent Gate** | ADR-006 | `mpi_id` as universal patient identity. CPF/CNS hash → deterministic match (≥85% coverage). Probabilistic fallback (threshold 0.92 auto-merge, 0.75-0.92 stewarded). Consent gate for cross-tenant federation. | AUSTA must resolve patients via MPI and store `mpi_id` locally — not maintain a competing patient identity. |
| **FHIR as Lateral Clinical Channel** | ADR-007 | HAPI FHIR (ECS Fargate + Aurora) as dedicated clinical channel. Parallel to Iceberg lakehouse (analytical). FHIR for patient-level access; dimensional for aggregation. | AUSTA clinical scores become FHIR Observations published to AMH HAPI, not a separate FHIR server. |
| **OpenTelemetry + AMP + Managed Grafana** | ADR-011 | Unified observability stack: OTEL SDK → OTEL Collector → AMP (metrics) + X-Ray (traces) + CloudWatch (logs). 10 standard dashboards provisioned via IaC. | AUSTA emits OTEL telemetry to AMH OTEL Collector. Dashboards live in AMH Managed Grafana. |
| **KMS CMK per Tenant** | ADR-012 | One CMK per tenant for S3 encryption. CMKs for Aurora, MPI, Secrets. Bucket policy Deny for wrong KMS key. Auto-rotation annual. | AUSTA uses `alias/amh-lake-austa-clinicas` KMS CMK. No more pgcrypto + env-var key. |
| **Debezium CDC → MSK → Flink → Iceberg** | ADR-020/025/029 | CDC stack per tenant: Debezium on ECS Fargate captures PostgreSQL changes → MSK Serverless topic → Flink (Managed Service for Apache Flink) → Iceberg Bronze. | AUSTA PostgreSQL must be instrumented with Debezium CDC to emit events to MSK. |
| **Glue Schema Registry + Avro** | ADR-010 | All Kafka topics have Avro schemas in Glue Schema Registry. DLQ mandatory. | AUSTA CDC topics must register Avro schemas in Glue Schema Registry. |
| **GitHub OIDC Scoped Roles** | ADR-022 | GitHub Actions authenticate via OIDC, scoped IAM roles per workload (terraform, mwaa, emr). | AUSTA CI/CD inherits this pattern for deployment to AMH VPC. |

### AMH Architecture Diagram (Simplified Integration Points)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        AMH Data Platform (sa-east-1)                  │
│                                                                       │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐       │
│  │ Raw (S3) │───▶│ Bronze   │───▶│ Silver   │───▶│ Gold (S3)│       │
│  │ parquet  │    │ (Iceberg)│    │ (Iceberg)│    │ (Iceberg)│       │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘       │
│        ▲              ▲                                               │
│        │              │                                               │
│  ┌─────┴──────┐ ┌────┴──────────┐                                    │
│  │ MSK        │ │ Flink (MSF)    │                                    │
│  │ Serverless │◀│ CDC → Iceberg  │                                    │
│  └─────▲──────┘ └───────────────┘                                    │
│        │                                                              │
│  ┌─────┴──────┐                                                       │
│  │ Debezium   │ ◀── CDC from source PostgreSQL                       │
│  │ ECS Fargate│                                                       │
│  └────────────┘                                                       │
│                                                                       │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐      │
│  │ HAPI FHIR│   │ Maezo    │   │ MPI Linker   │   │ Cognito  │      │
│  │ ECS      │   │ ECS      │   │ EMR Serverless│   │ + IAM IC │      │
│  └────┬─────┘   └──────────┘   └──────────────┘   └──────────┘      │
│       │                                                               │
│  ┌────┴─────┐   ┌──────────────┐   ┌──────────────┐                  │
│  │ Aurora   │   │ OTEL Collector│   │ AMP + AMG   │                  │
│  │ HAPI/    │   │ ECS Fargate  │   │ (Managed)   │                  │
│  │ Maezo    │   └──────────────┘   └──────────────┘                  │
│  └──────────┘                                                         │
│                                                                       │
│  Tenant: austa_clinicas (S3 prefix, KMS CMK, Glue DB, LF-Tags)       │
└──────────────────────────────────────────────────────────────────────┘
         ▲              ▲              ▲              ▲
         │              │              │              │
    ┌────┴──────┐ ┌────┴──────┐ ┌────┴──────┐ ┌────┴──────┐
    │ MPI REST  │ │FHIR REST  │ │ OTEL gRPC │ │ Cognito   │
    │ Lookup    │ │ Create Obs│ │ OTLP      │ │ OIDC      │
    └───────────┘ └───────────┘ └───────────┘ └───────────┘
         │              │              │              │
    ┌────┴──────────────┴──────────────┴──────────────┴────┐
    │              AUSTA Care Platform                      │
    │  PostgreSQL + Redis + Express (Monolith)              │
    │  WhatsApp-first Care Coordination                     │
    └──────────────────────────────────────────────────────┘
```

---

## Part B: Duplication Analysis

### Complete Capability-to-Capability Mapping

| Capability | AUSTA Implementation | AMH Implementation | Verdict |
|------------|---------------------|-------------------|---------|
| **Patient Identity** | `User.cpf` (plaintext, unique constraint) + phone number as primary identifier. No MPI, no `mpi_id`, no consent gate. | MPI with deterministic (CPF/CNS hash) + probabilistic linking (ADR-006). `mpi_id` as universal cross-tenant identity. Consent gate per tenant. | **DUPLICATE — AUSTA must use AMH MPI.** AUSTA stores `mpi_id` as foreign key, resolves identity via MPI REST API. AUSTA's `User.cpf` becomes a source identifier, not the authoritative identity. |
| **FHIR Server** | HAPI FHIR in `docker-compose.infrastructure.yml` (not wired to code). `fhir` npm package in dependencies. Aspirational only — zero operational FHIR. | HAPI FHIR on ECS Fargate + Aurora PostgreSQL Multi-AZ (ADR-007). Full FHIR R4 support with Flink mapper (Tasy→FHIR). Maezo orchestration. Production-grade. | **DUPLICATE — AUSTA uses AMH HAPI FHIR.** AUSTA clinical scores published as FHIR Observations via AMH HAPI REST API. AUSTA does not operate its own HAPI instance. |
| **Observability** | Prometheus (server + pushgateway) + Grafana (2 dashboards: system-health, api-performance) + Jaeger all-in-one. All in docker-compose.infrastructure.yml. Local, self-hosted. | Amazon Managed Prometheus (AMP) + Amazon Managed Grafana (AMG) + AWS X-Ray + CloudWatch Logs. 10 standard dashboards provisioned via IaC (ADR-011). OpenTelemetry SDK standard. | **DUPLICATE — AUSTA inherits AMH observability stack.** AUSTA emits OTEL telemetry to AMH OTEL Collector. Dashboards in AMG workspace. Local Prometheus/Grafana/Jaeger retired. |
| **Data Storage** | PostgreSQL 15 (transactional, Prisma ORM). 45+ tables for operational data: users, conversations, health data, gamification, authorizations. No analytical layer. | Iceberg lakehouse (Raw→Bronze→Silver→Gold) on S3 (ADR-001). Athena for queries. Optimized for analytical scans (TB-scale). No operational/transactional store. | **COMPLEMENTARY — AUSTA keeps PostgreSQL for transactions; AMH Iceberg for analytics.** AUSTA is a data producer; AMH is the analytical consumer. CDC from AUSTA PG → AMH lakehouse. |
| **Encryption at Rest** | `pgcrypto` extension loaded. `lib/crypto.ts` with `encryptPHI()`/`decryptPHI()` using `pgp_sym_encrypt`. Key from `ENCRYPTION_KEY` env var or AWS Secrets Manager. No KMS integration. | KMS CMK per tenant (ADR-012). `alias/amh-lake-austa-clinicas`. Auto-rotation annual. S3 Bucket Keys enabled. Deny-explicit bucket policy on wrong key. CloudTrail audit of key usage. | **DUPLICATE — AUSTA migrates to AMH KMS CMK.** AUSTA uses `alias/amh-lake-austa-clinicas` for encrypting data at rest in its PostgreSQL and any S3 exports. pgcrypto usage scoped to application-level encryption; KMS becomes the root of trust. |
| **Audit Trail** | `AuditLog` Prisma model (18 fields), persisted to PostgreSQL. `auditService.ts` (1053 lines) with compliance rules (8 rules) + retention policies (3 policies). Application-level audit. | S3 Object Lock compliance mode (ADR-009) + CloudTrail (API-level audit of all AWS actions) + DataHub lineage (ADR-015). Infrastructure-level audit plus data lineage. | **COMPLEMENTARY — AUSTA app audit + AMH infra audit.** AUSTA `AuditLog` remains for application actions (who accessed what patient). AMH CloudTrail/S3 Object Lock for infrastructure and data layer audit. AUSTA audit events can also flow to AMH Gold for consolidated compliance views. |
| **AuthN/AuthZ** | JWT tokens (`jsonwebtoken` + `bcrypt`). `UserRole` enum (PATIENT, PROVIDER, ADMIN, CARE_COORDINATOR, NURSE). Basic RBAC. No OAuth2, no OIDC, no federation. | Amazon Cognito (ADR-016a) with IAM Identity Center. LF-Tags ABAC (ADR-005). Session tags injected via SSO. Fine-grained Lake Formation permissions. | **DUPLICATE — AUSTA migrates to Cognito.** AUSTA authenticates via Cognito User Pool or federated identity. Session tag `tenant=austa_clinicas` injected. AUSTA JWT validation replaced by Cognito token verification. |
| **Secrets Management** | `.env` files (local dev) + AWS Secrets Manager SDK (`@aws-sdk/client-secrets-manager`). Naming: `austa-care/<env>/<service>`. | KMS CMK (`alias/amh-secrets`) + AWS Secrets Manager. Secrets encrypted with customer-managed key. IAM role access controlled by key policy. | **PARTIAL DUPLICATE — Enhance and converge.** AUSTA secrets migrated to `alias/amh-secrets` CMK protection. Naming convention aligned. AUSTA IAM roles scoped to `tenant=austa_clinicas` session tag for Secrets Manager access. |
| **Ingestion/CDC** | None. No event streaming. In-process EventEmitter for internal events. BullMQ (Redis-backed) for async jobs. No CDC, no Kafka, no event backbone. | Debezium on ECS Fargate → MSK Serverless → Flink (MSF) → Iceberg (ADR-020/025/029). Full CDC pipeline per tenant. Streaming-first for clinical data (Principle 5.5). | **GAP — AUSTA must produce CDC events.** Debezium connector on AUSTA PostgreSQL publishes CDC to AMH MSK topics. AUSTA becomes a data producer in the AMH event backbone. |

### Detailed Duplication Resolution

#### 1. Patient Identity — The Most Critical Duplication

**Current AUSTA state:**
- `User.cpf` stored as plaintext String (marked "PHI - encrypt at rest" but encryption not enforced at column level)
- `User.phone` used as primary identifier for WhatsApp
- Zero integration with MPI
- No `mpi_id` field anywhere in schema

**Required changes:**
1. Add `mpi_id` field to AUSTA `User` model (nullable initially, populated on first MPI lookup)
2. Add `mpi_match_confidence` field (Float?) to track linkage quality
3. During WhatsApp onboarding, immediately after CPF capture:
   - Call AMH MPI REST API: `POST /mpi/lookup` with `{ cpfHash, name, birthDate, phone }`
   - Receive `{ mpi_id, match_method, match_confidence }`
   - Store `mpi_id` on User record
4. Every clinical event (HealthData, VitalSign, Authorization) carries `mpi_id`
5. AUSTA's `User.cpf` is hashed before storage (SHA-256 + salt from AMH Secrets Manager) — becomes a source identifier, not the authoritative identity

#### 2. FHIR Duplication — AUSTA Does Not Need Its Own HAPI

**Current AUSTA state:**
- HAPI FHIR container in `docker-compose.infrastructure.yml` (port 8080) — **never wired to application code**
- `fhir` npm package v4.11 in backend dependencies — **zero source code usage found**
- FHIR is purely aspirational

**Decision:** AUSTA does NOT operate HAPI FHIR. Instead:
- AUSTA publishes clinical scores as FHIR Observations via AMH HAPI FHIR REST API
- AUSTA calls `POST https://hapi.amh.internal/fhir/Observation` with structured FHIR JSON
- AMH HAPI handles: validation, storage, indexing, search, RNDS integration
- This eliminates the docker-compose FHIR container and simplifies AUSTA operations

#### 3. Observability — Consolidate to AMH Stack

**Current AUSTA state:**
- Prometheus server (port 9090), Pushgateway (port 9091)
- Grafana (port 3000) with 2 dashboards
- Jaeger all-in-one (ports 5775, 6831, 6832, 5778, 16686, 14250, 14268, 14269, 9411)
- `prom-client` npm package in backend

**Decision:** AUSTA inherits the AMH observability stack:
- AUSTA `prom-client` replaced by OpenTelemetry SDK (node.js) → OTLP export to AMH OTEL Collector
- AUSTA dashboards moved to AMH Managed Grafana workspace
- AUSTA alerts routed through AMH SNS → PagerDuty pipeline
- Local Prometheus + Grafana + Jaeger containers removed from docker-compose
- AUSTA retains a local OTEL Collector sidecar for development, pointing to AMH in production

---

## Part C: Integration Architecture Design

### 1. Identity Resolution Flow

```
WhatsApp Onboarding Flow (AUSTA):
1. Patient answers WhatsApp message: provides CPF (Mission 1 "Me Conhece")
2. AUSTA hashes CPF: SHA-256(CPF + salt_from_amh_secrets)
3. AUSTA calls AMH MPI REST API:
   POST /mpi/v1/lookup
   Content-Type: application/json
   Authorization: Bearer <cognito_token>
   {
     "cpf_hash": "...",
     "full_name": "Maria Silva",
     "birth_date": "1985-03-15",
     "phone_hash": "SHA-256(+5511999999999 + salt)",
     "source_tenant": "austa_clinicas",
     "source_id": "user_cuid_xxx"
   }
4. AMH MPI responds:
   {
     "mpi_id": "mpi_abc123def456",
     "match_method": "deterministic",  // or "probabilistic" or "new_patient"
     "match_confidence": 1.0,
     "is_new": false,
     "golden_record": {
       "canonical_name": "Maria Silva",
       "canonical_birth_date": "1985-03-15"
     }
   }
5. AUSTA stores mpi_id on User record:
   UPDATE users SET mpi_id = 'mpi_abc123def456', mpi_match_confidence = 1.0 WHERE id = 'user_cuid_xxx'
```

**AUSTA Schema Changes:**
```sql
ALTER TABLE users ADD COLUMN mpi_id VARCHAR(64);
ALTER TABLE users ADD COLUMN mpi_match_confidence FLOAT;
ALTER TABLE users ADD COLUMN mpi_match_method VARCHAR(50);
ALTER TABLE users ADD COLUMN cpf_hash VARCHAR(128); -- SHA-256 hash of CPF, not plaintext
CREATE INDEX idx_users_mpi_id ON users(mpi_id);
```

### 2. Data Flow: AUSTA Events → AMH Lakehouse

```
AUSTA PostgreSQL (transactional)
    │
    │ logical replication slot
    ▼
Debezium Connector (ECS Fargate, tenant austa_clinicas)
    │
    │ CDC events (Avro, Glue Schema Registry)
    ▼
MSK Serverless Topics:
    amh.austa_clinicas.cdc.users
    amh.austa_clinicas.cdc.conversations
    amh.austa_clinicas.cdc.messages
    amh.austa_clinicas.cdc.health_data
    amh.austa_clinicas.cdc.clinical_scores
    amh.austa_clinicas.cdc.vital_signs
    amh.austa_clinicas.cdc.gamification_events
    amh.austa_clinicas.cdc.authorizations
    amh.austa_clinicas.cdc.audit_logs
    │
    ▼
Flink (Managed Service for Apache Flink)
    │
    │ transforms, validates, enriches with mpi_id
    ▼
Iceberg Bronze Tables (S3: amh-lake-bronze/tenant=austa_clinicas/)
    austa_conversations
    austa_clinical_scores
    austa_gamification_events
    austa_health_data
    austa_vital_signs
    austa_authorizations
    │
    ▼ (dbt/Spark transformations)
Iceberg Silver Tables
    austa_care_journey (patient journey timeline)
    austa_risk_scores (time-series risk progression)
    austa_engagement_metrics (gamification aggregation)
    │
    ▼
Gold Layer
    cross_tenant_patient_360 (MPI-joined view with consent gate)
    population_health_dashboard (aggregated across austa_clinicas patients)
```

**Key CDC Topics:**
| Topic | Source AUSTA Table | Purpose |
|-------|-------------------|---------|
| `amh.austa_clinicas.cdc.users` | users | Patient registration, onboarding progress |
| `amh.austa_clinicas.cdc.conversations` | conversations | WhatsApp conversation lifecycle |
| `amh.austa_clinicas.cdc.messages` | messages | Individual WhatsApp messages (AI-processed) |
| `amh.austa_clinicas.cdc.health_data` | health_data | Clinical conditions, medications, allergies, symptoms |
| `amh.austa_clinicas.cdc.clinical_scores` | health_data (risk-scored subset) | Risk assessment scores, emergency detections |
| `amh.austa_clinicas.cdc.vital_signs` | vital_signs | Vital sign measurements |
| `amh.austa_clinicas.cdc.gamification_events` | health_points, point_transactions, onboarding_progress | Gamification and engagement |
| `amh.austa_clinicas.cdc.authorizations` | authorizations | Authorization requests and approvals |
| `amh.austa_clinicas.cdc.audit_logs` | audit_logs | Application-level audit trail |

### 3. FHIR Clinical Score Publication

**Pattern:** AUSTA calls AMH HAPI FHIR REST API directly (synchronous, latency < 200ms acceptable for clinical scoring events)

```
AUSTA Clinical Score → FHIR Observation:

POST https://hapi.amh.internal/fhir/Observation
Authorization: Bearer <cognito_token>
Content-Type: application/fhir+json
{
  "resourceType": "Observation",
  "id": "obs-austa-{healthDataId}",
  "meta": {
    "profile": ["https://amh.americashealth.com.br/fhir/StructureDefinition/AustaRiskScore"],
    "tag": [
      { "system": "https://amh.americashealth.com.br/fhir/tenant", "code": "austa_clinicas" }
    ]
  },
  "identifier": [
    { "system": "https://austa.americashealth.com.br/fhir/healthDataId", "value": "cuid_xxx" }
  ],
  "status": "final",
  "category": [
    {
      "coding": [
        { "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "survey" }
      ]
    }
  ],
  "code": {
    "coding": [
      { "system": "https://austa.americashealth.com.br/fhir/CodeSystem/clinical-scores", "code": "CARDIOVASCULAR_RISK" }
    ],
    "text": "Cardiovascular Risk Score"
  },
  "subject": {
    "reference": "Patient/mpi_abc123def456"
  },
  "effectiveDateTime": "2026-06-27T10:30:00-03:00",
  "valueQuantity": {
    "value": 72.5,
    "unit": "%",
    "system": "http://unitsofmeasure.org",
    "code": "%"
  },
  "interpretation": [
    {
      "coding": [
        { "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", "code": "H" }
      ],
      "text": "High risk"
    }
  ],
  "component": [
    {
      "code": { "text": "algorithm_version" },
      "valueString": "cardiovascular-risk@1.0.0"
    },
    {
      "code": { "text": "algorithm_version" },
      "valueString": "cardiovascular-risk@1.0.0"
    }
    {
      "code": { "text": "framingham_score" },
      "valueQuantity": { "value": 15, "unit": "%" }
    }
  ]
}
```

**FHIR Resources Published by AUSTA:**
| AUSTA Clinical Event | FHIR Resource | Trigger |
|----------------------|---------------|---------|
| Risk Assessment (healthData.riskScore) | Observation (risk score) | After risk assessment calculation |
| Emergency Detection | Observation (emergency flag) | After emergency detection service |
| Vital Signs | Observation (vital signs panel) | After vital sign recording |
| Onboarding Completion | QuestionnaireResponse | On mission completion |
| Authorization | Task / ServiceRequest | Authorization status change |

### 4. Observability Integration

```
AUSTA Backend (Express/Node.js)
    │
    │ OpenTelemetry JS SDK
    │ @opentelemetry/api + @opentelemetry/sdk-node
    │ @opentelemetry/exporter-otlp-grpc
    │
    ▼ (OTLP gRPC:4317)
AMH OTEL Collector (ECS Fargate, multi-AZ)
    │
    ├──▶ AMP (Amazon Managed Prometheus)
    │      - austa_http_requests_total
    │      - austa_whatsapp_messages_processed
    │      - austa_clinical_scores_generated
    │      - austa_risk_assessment_latency_p95
    │      - austa_mpi_lookup_latency_p95
    │      - austa_fhir_observation_latency_p95
    │
    ├──▶ AWS X-Ray
    │      - End-to-end traces: WhatsApp webhook → AI processing → FHIR publish → AMH HAPI
    │
    └──▶ CloudWatch Logs
           - AUSTA structured logs with trace_id correlation
```

**AUSTA-specific Metrics (exported to AMP):**
| Metric Name | Type | Description |
|-------------|------|-------------|
| `austa_whatsapp_messages_total` | Counter | Total WhatsApp messages (inbound/outbound) |
| `austa_conversations_active` | Gauge | Active conversations at time of measurement |
| `austa_risk_assessments_total` | Counter | Clinical risk assessments performed (by algorithm version) |
| `austa_emergency_detections_total` | Counter | Emergency detections triggered |
| `austa_mpi_lookup_latency_seconds` | Histogram | MPI lookup latency (P50, P95, P99) |
| `austa_fhir_publish_latency_seconds` | Histogram | FHIR Observation publish latency |
| `austa_gamification_points_awarded` | Counter | HealthPoints awarded (by mission type) |
| `austa_authorization_requests_total` | Counter | Authorization requests (by status) |

**AUSTA Dashboards in AMG:**
1. **AUSTA Care Coordination Overview** — Active patients, conversations, risk distribution
2. **AUSTA Clinical Scores** — Risk score trends by algorithm version, anomaly detection
3. **AUSTA WhatsApp Engagement** — Message volume, response time, onboarding completion rates
4. **AUSTA Gamification** — Points earned, missions completed, streaks, levels

### 5. Deployment & Networking Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    AWS sa-east-1 VPC (AMH)                       │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │ Private Subnet AZ-A  │    │ Private Subnet AZ-B          │   │
│  │                      │    │                              │   │
│  │  AUSTA Backend (ECS) │    │  AUSTA Backend (ECS)         │   │
│  │  AUSTA Frontend (S3+ │    │                              │   │
│  │   CloudFront)        │    │                              │   │
│  │  AUSTA PostgreSQL    │    │  AMH Services:               │   │
│  │  AUSTA Redis         │    │  - HAPI FHIR                 │   │
│  │                      │    │  - OTEL Collector            │   │
│  │  AMH Services:       │    │  - Debezium Connectors       │   │
│  │  - MPI API           │    │  - Maezo                     │   │
│  │  - Cognito           │    │                              │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
│                                                                  │
│  IAM:                                                            │
│  - Role: austa-backend-task                                      │
│    - Session tag: tenant=austa_clinicas                          │
│    - KMS: alias/amh-lake-austa-clinicas (decrypt, genDataKey)    │
│    - Secrets: austa-care/*                                       │
│    - S3: amh-lake-*/tenant=austa_clinicas/* (read own prefix)    │
│    - HAPI FHIR: invoke via VPC endpoint                          │
│    - MPI: invoke via VPC endpoint                                │
│    - Cognito: verify tokens only (no user management)            │
└─────────────────────────────────────────────────────────────────┘
```

### 6. API Contracts Summary

| API | Direction | Method | Endpoint | Authentication | SLA |
|-----|-----------|--------|----------|---------------|-----|
| **MPI Lookup** | AUSTA → AMH | `POST /mpi/v1/lookup` | Internal ALB | Cognito JWT + session tag | P95 < 100ms |
| **MPI Search** | AUSTA → AMH | `GET /mpi/v1/patients?cpf_hash=...` | Internal ALB | Cognito JWT + session tag | P95 < 200ms |
| **FHIR Observation** | AUSTA → AMH | `POST /fhir/Observation` | HAPI FHIR ALB | Cognito JWT + `X-Tenant: austa_clinicas` | P95 < 200ms |
| **FHIR QuestionnaireResponse** | AUSTA → AMH | `POST /fhir/QuestionnaireResponse` | HAPI FHIR ALB | Cognito JWT + `X-Tenant` header | P95 < 200ms |
| **OTEL Telemetry** | AUSTA → AMH | `OTLP gRPC` | OTEL Collector (internal) | mTLS (VPC internal) | Fire-and-forget |
| **CDC (Debezium)** | AUSTA PG → AMH | Kafka Connect API | MSK (IAM auth) | MSK IAM role + topic prefix acl | < 1s lag |
| **Cognito Verify** | AUSTA → AMH | `Verify JWT locally` | N/A (local validation) | JWKS endpoint | P95 < 5ms |
| **Secrets Manager** | AUSTA → AMH | `GetSecretValue` | AWS API | IAM role + session tag | P95 < 50ms |

---

## Part D: Tenant Model for AUSTA Integration

### Tenant Definition

**AUSTA Care Platform = Tenant `austa_clinicas` in AMH Data Platform**

This is the same tenant already provisioned:
- S3 prefix: `s3://amh-lake-{layer}/tenant=austa_clinicas/`
- KMS CMK: `alias/amh-lake-austa-clinicas`
- Glue databases: `amh_austa_clinicas_bronze`, `amh_austa_clinicas_silver`, `amh_austa_clinicas_gold`
- LF-Tags: `tenant: austa_clinicas`
- IAM Identity Center group: `amh-austa_clinicas-engineers`
- Cognito User Pool group: `austa_clinicas-users`

### Tenant Isolation for AUSTA Data

```
AUSTA data under AMH:
┌───────────────────────────────────────────────────────────┐
│ Tenant: austa_clinicas                                     │
│                                                            │
│ S3:                                                        │
│  s3://amh-lake-bronze/tenant=austa_clinicas/               │
│    ├── cdc.austa_conversations/                            │
│    ├── cdc.austa_clinical_scores/                          │
│    ├── cdc.austa_gamification_events/                      │
│    └── ...                                                 │
│  s3://amh-lake-silver/tenant=austa_clinicas/               │
│    ├── austa_care_journey/                                 │
│    ├── austa_risk_scores/                                  │
│    └── ...                                                 │
│                                                            │
│ Glue:                                                      │
│  amh_austa_clinicas_bronze                                 │
│  amh_austa_clinicas_silver                                 │
│  amh_austa_clinicas_gold                                   │
│                                                            │
│ KMS: alias/amh-lake-austa-clinicas                         │
│ LF-Tags: tenant=austa_clinicas, sensitivity=phi,           │
│          domain=clinical|operational|engagement            │
│                                                            │
│ Access:                                                    │
│  AUSTA engineers (role: amh-lake-engineer,                 │
│                    session tag: tenant=austa_clinicas)     │
│  MPI Linker (cross-tenant, consent-gated)                  │
│  Cross-tenant views (gold_amh_consolidated,                │
│                      consent-required)                     │
└───────────────────────────────────────────────────────────┘
```

### AUSTA as Data Producer (Not Consumer)

AUSTA writes data, AMH serves analytics:
- **AUSTA writes:** CDC events to MSK → AMH ingests to Iceberg. FHIR Observations to HAPI.
- **AUSTA reads:** MPI lookups (identity resolution), own PostgreSQL (transactions).
- **AUSTA does NOT query:** Iceberg tables, Athena, Gold views (analytics is AMH domain).
- **Exception:** AUSTA administrative dashboards may query Gold views via Athena with proper IAM role.

---

## Part E: Summary of Proposed ADRs

| ADR | Title | Key Decision |
|-----|-------|-------------|
| **ADR-007** | AUSTA uses AMH MPI for Patient Identity | AUSTA adopts `mpi_id` as foreign key. All patients resolved via AMH MPI REST API during WhatsApp onboarding. CPF hashed before storage. Consent gate respected. |
| **ADR-008** | AUSTA emits CDC events to AMH MSK for Lakehouse Ingestion | AUSTA PostgreSQL instrumented with Debezium CDC. Events published to MSK topics under `amh.austa_clinicas.cdc.*`. AMH Flink ingests to Iceberg Bronze. |
| **ADR-009** | AUSTA clinical scores published as FHIR Observations via AMH HAPI | AUSTA calls AMH HAPI FHIR REST API to create Observation/QuestionnaireResponse resources. AUSTA does not operate its own FHIR server. |
| **ADR-010** | AUSTA inherits AMH Observability Stack (AMP + Managed Grafana) | AUSTA emits OpenTelemetry to AMH OTEL Collector. AUSTA dashboards in AMH Managed Grafana workspace. Local Prometheus/Grafana/Jaeger retired. |
| **ADR-011** | AUSTA migrates encryption to AMH KMS CMK per-tenant model | AUSTA adopts `alias/amh-lake-austa-clinicas` as root of trust. pgcrypto DEK encrypted with KMS CMK. Secrets Manager keys under AMH KMS. |
| **ADR-012** | AUSTA authenticates via AMH Cognito (federated identity) | AUSTA accepts Cognito JWT tokens. Session tag `tenant=austa_clinicas` injected via SSO. AUSTA JWT generation replaced by Cognito-hosted UI or OIDC flow. |

---

## References

- AMH SAD: [SAD-AMH-Plataforma-Dados.md](../../amh-data-platform/architecture/sad/SAD-AMH-Plataforma-Dados.md)
- AMH ADR-005: [Multi-Tenant Strategy](../../amh-data-platform/architecture/adrs/ADR-005-estrategia-multi-tenant.md)
- AMH ADR-006: [MPI Linking + Consent Gate](../../amh-data-platform/architecture/adrs/ADR-006-mpi-linking-deterministico-probabilistico-consent-gate.md)
- AMH ADR-007: [FHIR Lateral Channel](../../amh-data-platform/architecture/adrs/ADR-007-fhir-canal-lateral-hapi-maezo.md)
- AMH ADR-011: [OpenTelemetry + AMP + AMG](../../amh-data-platform/architecture/adrs/ADR-011-opentelemetry-amp-grafana-observabilidade.md)
- AMH ADR-012: [KMS CMK per Tenant](../../amh-data-platform/architecture/adrs/ADR-012-kms-cmk-por-tenant-encryption.md)
- AUSTA ADR-003: [Monolith-First Architecture](../architecture/adr/ADR-003-arquitetura-monolith-first-mvp.md)
- AUSTA ADR-004: [pgcrypto Envelope Encryption](../architecture/adr/ADR-004-envelope-encryption-pgcrypto-phi.md)
- AUSTA ADR-005: [Clinical Algorithm Versioning](../architecture/adr/ADR-005-versionamento-algoritmos-clinicos.md)
- AUSTA ADR-006: [Idempotency for Message Processing](../architecture/adr/ADR-006-idempotencia-processamento-mensagens.md)
