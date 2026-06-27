# AUSTA Care Platform — Scalability & Infrastructure Forensics Report

**Date:** 2026-06-27  
**Audience:** Platform Engineering, SRE, CTO  
**Scope:** 100K+ beneficiaries integrated with AMH Data Platform  
**Repo:** `Coordenacao-Cuidado-Enterprise/austa-care-platform`  
**Reference Architecture:** AMH Data Platform (`amh-data-platform/architecture/adrs/`)

---

## Executive Summary

AUSTA is a monolith Express/TypeScript application with 18 Prisma models, PostgreSQL + Redis, designed for a single tenant per organization. The codebase is well-structured but has **critical gaps for 100K-user scale**:

| Category | Status | Criticality |
|---|---|---|
| Database Indexing | ⚠️ Partial — 7 missing indexes | HIGH |
| Connection Pooling | 🔴 Not configured | CRITICAL |
| N+1 Query Patterns | 🔴 3 confirmed patterns | HIGH |
| Caching Strategy | 🔴 Basic key-value only | HIGH |
| Async Processing | 🔴 Zero async jobs — everything synchronous | CRITICAL |
| Docker/K8s Config | ⚠️ Good foundation, missing resource limits | MEDIUM |
| HPA Scaling | ⚠️ Max 10 replicas — insufficient | HIGH |
| Partitioning | 🔴 No table partitioning | CRITICAL |
| AMH Integration | ⚠️ CDC defined but not connected | MEDIUM |

**Estimated effort:** 12-16 weeks to achieve production readiness for 100K users.

---

## Part A: Database Forensics

### A.1 Schema Analysis (`prisma/schema.prisma`, 1301 lines, 18 models)

#### Table Size & Growth Projections (100K beneficiaries)

| Table | Est. Rows at Launch | Est. Rows at 100K Users (12mo) | Partitioning Needed |
|---|---|---|---|
| `users` | 100K | 120K (churn) | No |
| `organizations` | ~50 | ~200 | No |
| `conversations` | 100K | **18.2M** | **YES — monthly** |
| `messages` | 500K | **91M** | **YES — monthly** |
| `health_data` | 500K | 1.8M | Maybe (yearly) |
| `audit_logs` | 500K | **10M+** | **YES — monthly** |
| `documents` | 50K | 500K | Maybe |
| `vital_signs` | 200K | 3.6M | Maybe (quarterly) |
| `questionnaire_responses` | 50K | 1.8M | Maybe |

#### A.2 Missing Indexes (Critical)

Based on query patterns found in controllers and service code:

```sql
-- 1. Messages: queries for failed/pending messages by status and time
-- Found in: whatsapp.service.ts message delivery tracking
CREATE INDEX CONCURRENTLY idx_messages_status_sentat 
  ON messages (status, sent_at) 
  WHERE deleted_at IS NULL;

-- 2. Conversations: org-level listing sorted by recent activity
-- Found in: conversation.controller.ts GET /
CREATE INDEX CONCURRENTLY idx_conversations_org_lastmsg 
  ON conversations (organization_id, last_message_at DESC) 
  WHERE deleted_at IS NULL;

-- 3. Health data: user-specific time-range queries
-- Found in: health-data.controller.ts, temporal-risk-tracking.service.ts
CREATE INDEX CONCURRENTLY idx_health_data_user_recorded 
  ON health_data (user_id, recorded_at DESC) 
  WHERE is_active = true AND deleted_at IS NULL;

-- 4. Audit logs: retention/purge queries by time
-- Found in: auditService.ts (background cleanup)
CREATE INDEX CONCURRENTLY idx_audit_logs_occurred 
  ON audit_logs (occurred_at) 
  WHERE lgpd_relevant = false; -- quick purge of non-LGPD logs

-- 5. Documents: organization-level listing
-- Found in: document.controller.ts
CREATE INDEX CONCURRENTLY idx_documents_org_uploaded 
  ON documents (organization_id, uploaded_at DESC) 
  WHERE is_active = true AND deleted_at IS NULL;

-- 6. Authorizations: pending approvals by org
-- Found in: authorization schemas
CREATE INDEX CONCURRENTLY idx_authorizations_org_pending 
  ON authorizations (organization_id, status) 
  WHERE status IN ('PENDING', 'UNDER_REVIEW') AND deleted_at IS NULL;

-- 7. Questionnaire responses: completion lookup
-- Found in: gamification.controller.ts, health-data.controller.ts
CREATE INDEX CONCURRENTLY idx_questionnaire_user_questionnaire 
  ON questionnaire_responses (user_id, questionnaire_id) 
  WHERE deleted_at IS NULL;
```

#### A.3 JSONB/GIN Indexes (recommended for Json fields)

```sql
-- HealthData.riskScore is queried during temporal analysis
CREATE INDEX CONCURRENTLY idx_health_data_riskscore_gin 
  ON health_data USING GIN (risk_score);

-- AuditLog.oldValues/newValues queried for change history
CREATE INDEX CONCURRENTLY idx_audit_logs_changes_gin 
  ON audit_logs USING GIN (old_values, new_values);
```

#### A.4 N+1 Query Patterns Detected

**Pattern 1: User listing** (`user.helpers.ts` + `controllers/user.ts`)
```typescript
// ❌ CURRENT: N+1 queries
const formattedUsers = await Promise.all(
  users.map(user => formatUserResponse(user, true))
);
// formatUserResponse internally calls getUserHealthScore(userId) 
// which makes a separate prisma.healthPoints.findUnique() per user

// ✅ FIX: Batch query with include
const users = await prisma.user.findMany({
  where,
  include: {
    healthPoints: { select: { availablePoints: true } },
    onboardingProgress: { select: { status: true, currentStep: true } }
  }
});
```

**Pattern 2: User detail** (`controllers/user.ts` GET `/:id`)
```typescript
// ❌ CURRENT: Separate queries
const user = await prisma.user.findUnique({ where: { id } });
const formattedUser = await formatUserResponse(user, true); // extra query
const onboardingStatus = await getUserOnboardingStatus(user.id); // extra query

// ✅ FIX: Single query with includes
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    healthPoints: true,
    onboardingProgress: { orderBy: { completedAt: 'desc' }, take: 5 }
  }
});
```

**Pattern 3: Multiple PrismaClient instances** (memory/resource leak)
```typescript
// ❌ CURRENT: Multiple PrismaClient instances created per controller
// prisma.ts exports a global singleton, but controllers create their own:
const prisma = new PrismaClient(); // in conversation.controller.ts
const prisma = new PrismaClient(); // in user.ts
const prisma = new PrismaClient(); // in health-data.controller.ts
const prisma = new PrismaClient(); // in advanced-risk-controller.ts
const prisma = new PrismaClient(); // in user.helpers.ts

// ✅ FIX: Import the singleton everywhere
import { prisma } from '../database/prisma';
// or from '../config/database';
```

#### A.5 Connection Pool Configuration

**Current state:** No connection pool configuration in Prisma.

```typescript
// ❌ CURRENT (database/prisma.ts):
new PrismaClient({
  log: config.nodeEnv === 'development' ? ['query', ...] : ['error'],
})
// No connection_limit, pool_timeout, or idle_timeout set

// ✅ RECOMMENDED for 100K users:
new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: config.database.url,
    },
  },
  // Prisma uses connection pool under the hood. Add via connection string:
  // postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=30
})
```

**PgBouncer / RDS Proxy Recommendation:**
- **For 100K users:** Deploy PgBouncer (sidecar) or AWS RDS Proxy
- **Connection pool sizing:** 20 connections per backend instance × 3-10 pods = 60-200 connections
- **Without pooler:** PostgreSQL max_connections defaults to 100, easily exhausted
- **With RDS Proxy:** Pool multiplexing reduces DB connections by 80%+

**Recommended DATABASE_URL format:**
```
postgresql://user:pass@rds-proxy.proxy-xxx.sa-east-1.rds.amazonaws.com:5432/austa_care?connection_limit=15&pool_timeout=10&socket_timeout=30
```

#### A.6 Migration Health

- **Existing migration:** `20251117135809_init/migration.sql` (569 lines)
- **Schema vs. actual DB drift:** The migration SQL differs from the current `schema.prisma` (e.g., migration has `OrganizationType` with 5 values, schema has 7; migration has `UserRole` with 7 values, schema has 5). This indicates schema evolution without migration tracking.
- **Pending migrations:** Unknown — need `npx prisma migrate status` against target DB
- **Recommendation:** Run `prisma migrate diff` to detect drift, generate a reconciliation migration

---

## Part B: Caching Strategy Audit

### B.1 Current Redis Usage

**File:** `backend/src/services/redisService.ts`

Current implementation is a thin wrapper around `redis` npm package with only basic operations:
- `get(key)` — simple key lookup
- `set(key, value)` — no TTL by default
- `setex(key, seconds, value)` — only TTL mechanism
- `del(key)` — single key deletion (no pattern-based invalidation)
- `keys(pattern)` — **DANGEROUS** — O(N) scan, blocks Redis in production
- `flushdb()` — flushes everything

**Critical issues:**
1. **No cache strategy:** No consistent key naming convention
2. **No TTL defaults:** `set()` has no default expiration — keys are never evicted unless explicitly set via `setex()`
3. **`keys()` method:** O(N) operation that blocks Redis event loop — must be replaced with `SCAN`
4. **No cache invalidation:** When data changes in PostgreSQL, corresponding Redis keys are not invalidated
5. **`ioredis` listed as dependency but never used** — dead dependency

### B.2 What's Currently Not Cached (Should Be)

| Data | Read Frequency | TTL | Expected Hit Rate |
|---|---|---|---|
| User profiles (by ID) | Very High | 5 min | 85% |
| Organization config | High | 15 min | 95% |
| Mission definitions | Medium | 30 min | 90% |
| Algorithm versions | Low | 1 hour | 99% |
| Authorization rules | Medium | 10 min | 85% |
| MPI lookup results | High | 1 hour | 80% |
| FHIR resource cache | Medium | 15 min | 70% |
| Rate limit counters | Very High | per window | — |
| Session state | Very High | 24 hours | 99% |

### B.3 Recommended Redis Architecture

```typescript
// Proposed: CacheService with automatic TTL and invalidation patterns
interface CacheStrategy {
  ttl: number;           // seconds
  invalidationTags: string[];  // tags for bulk invalidation
  staleWhileRevalidate?: boolean;
}

class CacheService {
  // User profile cache — auto-invalidated on user update
  async getUserProfile(userId: string): Promise<User | null> {
    const key = `user:${userId}:profile`;
    let data = await this.redis.get(key);
    if (!data) {
      data = await this.fetchAndCacheUser(userId, key);
    }
    return JSON.parse(data);
  }

  // Pattern-based invalidation using Redis sets + tags
  async invalidateUser(userId: string): Promise<void> {
    // Delete all keys tagged with this user
    const keys = await this.redis.sMembers(`tag:user:${userId}`);
    if (keys.length) await this.redis.del(...keys);
    await this.redis.del(`tag:user:${userId}`);
  }

  // NEVER use KEYS — always SCAN
  async scan(pattern: string, count = 100): Promise<string[]> {
    // Use cursor-based SCAN
  }
}
```

**Cache key naming convention:**
```
{entity}:{id}:{subresource}
user:abc123:profile
org:xyz789:settings
mission:health-weekly:definition
mpi:cns-hash:result
fhir:Patient:pat-001-json
rate:whatsapp:user-abc123
session:jwt-sid-xyz
```

---

## Part C: Async Processing Analysis

### C.1 Synchronous Blockers Identified

Every heavy operation currently blocks the Express request/response cycle:

| Operation | Current | Duration | Impact | Queue |
|---|---|---|---|---|
| WhatsApp message sending | SYNC | 500ms-3s | Blocks health webhook response | `whatsapp-outbound` |
| OpenAI API calls (GPT-4 Turbo) | SYNC | 1-8s | Blocks WhatsApp response cycle | `ai-inference` |
| OCR (Textract/Tesseract) | SYNC | 5-30s | Blocks document upload response | `ocr-processing` |
| Clinical risk scoring | SYNC | 500ms-2s | Blocks risk assessment response | `clinical-scoring` |
| Emergency alert dispatch | SYNC | 1-5s | Blocks assessment completion | `emergency-alerts` |
| FHIR export generation | SYNC | 2-10s | Blocks document processing | `fhir-export` |
| Tasy ERP sync | SYNC | 10-60s | Can block request cycle | `tasy-sync` |
| Notification sending | SYNC | 100ms-1s | Blocks user operations | `notifications` |

### C.2 Async Architecture Design (BullMQ-based)

`bullmq` (v5.1.1) is already a dependency but has **zero usage** in the codebase.

```
┌──────────────────────────────────────────────────────────────────┐
│                        REQUEST/RESPONSE                           │
│  Express API → Validate → Persist → Return 202 Accepted          │
│                          ↓                                        │
│                   Queue (BullMQ + Redis)                          │
│                          ↓                                        │
│    ┌────────────────────┼────────────────────┐                   │
│    ↓                    ↓                    ↓                     │
│  whatsapp-        ai-inference        ocr-processing              │
│  outbound         (OpenAI/LangChain)  (Textract/Tesseract)        │
│  High priority    High priority       Normal priority              │
│  Concurrency: 10  Concurrency: 5      Concurrency: 3              │
│    ↓                    ↓                    ↓                     │
│    └────────────────────┼────────────────────┘                   │
│                         ↓                                          │
│    ┌────────────────────┼────────────────────┐                   │
│    ↓                    ↓                    ↓                     │
│  clinical-         emergency-           fhir-export               │
│  scoring           alerts               Normal priority           │
│  High priority     Critical priority    Concurrency: 2            │
│  Concurrency: 4    Concurrency: 10                                 │
│                                                                     │
│  Dead Letter Queue (per queue):                                     │
│    Max attempts: 3 → DLQ → Alert → Manual review                   │
└──────────────────────────────────────────────────────────────────┘
```

### C.3 BullMQ Queue Definitions

```typescript
// queues/whatsapp.queue.ts
import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../config/redis';

export const whatsappOutboundQueue = new Queue('whatsapp-outbound', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600 },   // keep 1 hr
    removeOnFail: { age: 86400 },       // keep 24 hrs
  },
});

// Priority levels: 1=critical, 2=high, 3=normal, 4=low
export async function enqueueWhatsAppMessage(
  phone: string, message: string, priority = 3
) {
  return whatsappOutboundQueue.add('send-text', { phone, message }, {
    priority,
    jobId: `wa-${phone}-${Date.now()}`,
  });
}

// Worker
const worker = new Worker('whatsapp-outbound', async (job) => {
  const { phone, message } = job.data;
  return whatsappService.sendTextMessage({ phone, message });
}, {
  connection: redisConnection,
  concurrency: 10,
  limiter: { max: 20, duration: 60000 }, // 20 per minute (Z-API rate limit)
});
```

### C.4 Dead Letter Queue Strategy

```typescript
// Each queue gets a DLQ
const dlq = new Queue('whatsapp-outbound-dlq', {
  connection: redisConnection,
});

// Worker with failure handling
worker.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts!) {
    await dlq.add('failed-whatsapp', {
      originalJobId: job.id,
      data: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
    // AlertOps / PagerDuty notification
    await notificationService.sendAlert({
      type: 'DLQ_THRESHOLD',
      queue: 'whatsapp-outbound',
      message: `Job ${job.id} failed after ${job.attemptsMade} attempts`,
    });
  }
});
```

---

## Part D: Container & Infrastructure Analysis

### D.1 Docker Configuration Review

#### Backend Dockerfile (`backend/Dockerfile`)
| Check | Status | Notes |
|---|---|---|
| Multi-stage build | ✅ | dependencies → build → development → production |
| Non-root user | ✅ | `USER nodejs` (UID 1001) |
| Health check | ✅ | HTTP GET /health, 30s interval |
| Build optimization | ⚠️ | `tsc --noEmitOnError false` swallows type errors |
| Security | ⚠️ | Runs Chromium in container — large attack surface |
| Layer caching | ⚠️ | `npm install` before source copy enables layer cache (good) |

#### Frontend Dockerfile (`frontend/Dockerfile`)
| Check | Status | Notes |
|---|---|---|
| Multi-stage build | ✅ | development → build → production (nginx) |
| nginx serving | ✅ | Using nginx:alpine |
| Health check | ✅ | curl localhost:80 |
| Security | ⚠️ | `nginx` user exists but not explicitly switched in CMD |
| Build optimization | ✅ | `.dockerignore` should be verified |

#### Docker Compose (`docker-compose.yml` and `docker-compose.infrastructure.yml`)
| Check | Status | Notes |
|---|---|---|
| Resource limits | 🔴 **MISSING** | No `deploy.resources.limits` on any service |
| Memory reservation | 🔴 **MISSING** | Redis: `--maxmemory 512mb` set but no container limit |
| Postgres healthcheck | ✅ | `pg_isready` |
| Redis persistence | ✅ | AOF enabled in infrastructure compose |
| Backend debug port | ⚠️ | Port 9229 exposed — remove in production |

**Required resource limits for docker-compose:**
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G
  postgres:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
  redis:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

### D.2 Kubernetes Configuration Review

#### HPA (`k8s/hpa.yaml`)
| Parameter | Current | Recommended (100K) | Gap |
|---|---|---|---|
| Backend minReplicas | 3 | 5 | +2 |
| Backend maxReplicas | 10 | 30 | +20 |
| Frontend minReplicas | 2 | 3 | +1 |
| Frontend maxReplicas | 5 | 10 | +5 |
| CPU target | 70% | 60% | Tighten |
| Scale-up policy | 50%/60s | Pods:4/60s | More aggressive |
| Custom metrics | None | **Need request latency P95** | Missing |

**Recommended custom metric HPA:**
```yaml
- type: Pods
  pods:
    metric:
      name: http_requests_per_second
    target:
      type: AverageValue
      averageValue: "500"  # 500 req/s per pod
```

#### Backend Deployment (`deployments/backend-deployment.yaml`)
| Check | Status | Notes |
|---|---|---|
| runAsNonRoot | ✅ | UID 1001 |
| Resource requests | ✅ | 500m CPU, 1Gi RAM |
| Resource limits | ⚠️ | 2 CPU, 4Gi RAM — borderline |
| Liveness probe | ✅ | /health, 60s initial |
| Readiness probe | ✅ | /health, 30s initial |
| Node cluster mode | 🔴 **MISSING** | Single Node.js process per pod |

**Critical Issue: No PM2/Cluster Mode**
A single Node.js process can only use 1 CPU core effectively. With `limits.cpu: 2000m` (2 cores), 1 core is wasted.

```dockerfile
# Add to production stage CMD:
CMD ["node", "--max-old-space-size=3072", "dist/server.js"]
```

Or use PM2 cluster mode:
```dockerfile
CMD ["npx", "pm2-runtime", "start", "dist/server.js", "-i", "max"]
```

#### Backend Service (`services/backend-service.yaml`)
| Issue | Impact |
|---|---|
| `sessionAffinity: ClientIP` | Prevents proper load distribution |
| `timeoutSeconds: 10800` (3 hours!) | Long-lived sticky sessions = hot pods |
| Recommendation: **Remove sessionAffinity** or use Redis-backed sessions |

#### ConfigMap (`configmaps/backend-config.yaml`)
| Issue | Impact |
|---|---|
| `RATE_LIMIT_MAX_REQUESTS: "100"` per 15 min | Only 6.6 req/min — too restrictive at scale |
| `JWT_EXPIRY: "24h"` | OK, but should be configurable per role |
| `FHIR_VERSION: "R4"` | OK |
| `REDIS_CLUSTER_ENABLED: "false"` | Must enable for 100K scale |

---

## Part E: Scaling Plan for 100K+ Beneficiaries

### E.1 Load Estimation

| Metric | 1K Users | 10K Users | 100K Users |
|---|---|---|---|
| Daily Active Users (10%) | 100 | 1K | 10K |
| WhatsApp messages/day | 500 | 5K | 50K |
| Clinical scores/day | 50 | 500 | 5K |
| Onboarding completions/day (peak) | 20 | 200 | 2K |
| API requests/sec (avg) | 5 | 50 | 500 |
| API requests/sec (peak 10x) | 50 | 500 | 5,000 |
| Database queries/sec | 25 | 250 | 2,500 |
| Concurrent DB connections | 5 | 20 | 100-200 |
| Redis ops/sec | 50 | 500 | 5,000 |

### E.2 Database Scaling Roadmap

**Phase 1 (Immediate — 0-10K users):**
- Add missing indexes (Section A.2)
- Deploy PgBouncer or RDS Proxy
- Set Prisma `connection_limit=15` per instance
- Fix N+1 queries
- Enable `pg_stat_statements` for query analytics

**Phase 2 (10K-50K users):**
- Partition `messages` by month on `sent_at`:
```sql
CREATE TABLE messages (
  id TEXT NOT NULL,
  ...
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (sent_at);

CREATE TABLE messages_2026_07 PARTITION OF messages
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE messages_2026_08 PARTITION OF messages
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
```

- Partition `conversations` by organization and month:
```sql
CREATE TABLE conversations (...) PARTITION BY RANGE (started_at);

-- 12 monthly partitions pre-created
-- Each org gets query isolation via WHERE organization_id
```

- Partition `audit_logs` by month on `occurred_at`:
```sql
CREATE TABLE audit_logs (...)
  PARTITION BY RANGE (occurred_at);

-- Retain 7 years per LGPD: 84 partitions
-- Automate partition creation via pg_partman or cron
```

- Add read replica for analytics queries (Athena via CDC eventually)

**Phase 3 (50K-100K users):**
- Migrate to Amazon Aurora PostgreSQL (multi-AZ from ADR-008)
- Connection pooling via RDS Proxy (auto-scaling)
- Consider read/write splitting using Prisma's `$queryRaw` for read-replica
- Offload analytics to AMH Iceberg lake via CDC (MSK → Flink → Iceberg)

### E.3 Application Scaling

**Current:** Single Node.js process, Express, no clustering

**Target architecture for 500 req/s per instance:**

```
                ┌──────────────┐
                │  AWS ALB/NLB │
                └──────┬───────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐
     │ Pod 1   │ │ Pod 2   │ │ Pod N   │
     │ PM2 x2  │ │ PM2 x2  │ │ PM2 x2  │
     │ (2 proc)│ │ (2 proc)│ │ (2 proc)│
     └────┬────┘ └────┬────┘ └────┬────┘
          │           │           │
          └───────────┼───────────┘
                      │
          ┌───────────┴───────────┐
          │   RDS Proxy / PgBouncer│
          └───────────┬───────────┘
                      │
          ┌───────────┴───────────┐
          │   Aurora PostgreSQL    │
          │   (Writer + Reader)   │
          └───────────────────────┘
```

**Stateless design requirements:**
- Move session state from `sessionAffinity: ClientIP` to Redis-backed sessions
- Use `connect-redis` for Express session store
- All pod-local state (file uploads) → S3 with pre-signed URLs
- JWTs already stateless ✅

**PM2 Cluster configuration:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'austa-backend',
    script: 'dist/server.js',
    instances: 2,               // 2 processes per pod (match CPU limit)
    exec_mode: 'cluster',
    max_memory_restart: '3G',   // Restart before OOM
    env: {
      NODE_ENV: 'production',
    },
  }],
};
```

### E.4 Integration with AMH Data Platform

**Current state:** AMH architecture is defined but AUSTA is not connected to the CDC pipeline.

**Integration roadmap:**

```
AUSTA PostgreSQL ──CDC──▶ ECS Fargate (Debezium) ──▶ MSK Serverless ──▶ Managed Flink
                                                                            │
                                                                            ▼
                                                                      Iceberg Tables
                                                                    (AMH Data Lake)
                                                                            │
                                                                            ▼
                                                               ┌──────────────────────┐
                                                               │  Athena Query Layer  │
                                                               │  (ADR-004)            │
                                                               └──────────┬───────────┘
                                                                          │
                                                    ┌─────────────────────┼──────────────────┐
                                                    ▼                     ▼                    ▼
                                              Dashboards         AI/ML Training         FHIR Analytics
                                              (OpenDash)         (SageMaker)           (HAPI FHIR)
```

**Concrete integration steps:**

1. **CDC Connector for AUSTA PostgreSQL** (following ADR-025 Debezium on ECS Fargate):
   - Source connector reading AUSTA's `messages`, `conversations`, `health_data`, `audit_logs`
   - Topics: `austa.messages`, `austa.conversations`, `austa.health_data`
   - Separate connector per tenant for isolation (ADR-029)

2. **FHIR queries offloaded to AMH HAPI FHIR** (ADR-007):
   - FHIR resources (Patient, Observation, DocumentReference) exported from AUSTA to HAPI
   - AUSTA API queries FHIR via AMH HAPI, not PostgreSQL directly
   - FHIR resource cache in AUSTA Redis with 1-hour TTL

3. **MPI lookup caching** (ADR-006):
   - First patient resolution → call AMH MPI API → cache in Redis for 1 hour
   - Subsequent lookups hit Redis with 80%+ hit rate
   - Invalidation on MPI golden record update via SNS → webhook

4. **Analytics offload:**
   - All reporting/BI queries go to Athena on Iceberg, not AUSTA PostgreSQL
   - This removes the heaviest SQL from AUSTA's primary DB
   - Real-time dashboards consume from Iceberg via Athena workgroups (ADR-004)

### E.5 Phase-by-Phase Implementation Plan

#### Phase 1: Foundation (Weeks 1-4)
- [ ] Fix all N+1 queries (3 patterns identified)
- [ ] Consolidate to single PrismaClient singleton
- [ ] Add 7 missing database indexes
- [ ] Configure connection pooling (PgBouncer or RDS Proxy)
- [ ] Add resource limits to docker-compose
- [ ] Replace `keys()` with `SCAN` in RedisService
- [ ] Set up BullMQ infrastructure with initial queues
- [ ] Move WhatsApp sending to async queue
- [ ] Add cache layer for user profiles and org config

#### Phase 2: Async Processing (Weeks 5-8)
- [ ] Implement all 8 BullMQ queues
- [ ] DLQ strategy with alerts
- [ ] Async OpenAI/LangChain processing
- [ ] Async OCR processing (Textract/Tesseract)
- [ ] Async clinical scoring
- [ ] Redis session store (remove ClientIP affinity)
- [ ] Implement cache invalidation patterns
- [ ] Enable PM2 cluster mode in production

#### Phase 3: Database Scale (Weeks 9-12)
- [ ] Partition `messages` and `conversations` by month
- [ ] Partition `audit_logs` by month
- [ ] Set up read replica
- [ ] Migrate to Aurora PostgreSQL if not already
- [ ] Configure RDS Proxy for connection pooling
- [ ] Run migration drift reconciliation
- [ ] JSONB GIN indexes for risk_score and audit changes

#### Phase 4: AMH Integration & 100K Readiness (Weeks 13-16)
- [ ] Deploy Debezium CDC connector for AUSTA → MSK
- [ ] Flink streaming job AUSTA → Iceberg
- [ ] FHIR export pipeline AUSTA → HAPI FHIR
- [ ] MPI cache integration
- [ ] Update HPA: maxReplicas=30 (backend), custom metrics
- [ ] Load test at 100K user simulation
- [ ] Chaos engineering (pod kills, DB failover)
- [ ] DR drill with AMH Aurora failover (ADR tools)

---

## Part F: Cost Estimation (T-Shirt Sizing)

Pricing in USD/month, AWS sa-east-1 region.

### Infrastructure Costs

| Resource | 1K Users | 10K Users | 100K Users | Notes |
|---|---|---|---|---|
| **Compute (ECS/K8s)** | | | | |
| Backend pods | 2 × m5.large | 5 × m5.xlarge | 30 × m5.xlarge | $150/pod/mo |
| Frontend (CDN) | CloudFront | CloudFront | CloudFront | ~$50 |
| Workers (Fargate) | 2 tasks | 5 tasks | 15 tasks | ~$80/task/mo |
| **Database** | | | | |
| Aurora PostgreSQL | db.r6g.large | db.r6g.xlarge | db.r6g.2xlarge | Writer |
| Read replica | — | db.r6g.large | db.r6g.xlarge | Reader |
| RDS Proxy | — | 1 endpoint | 2 endpoints | $25/endpt |
| Storage | 20 GB | 100 GB | 500 GB | $0.10/GB |
| **Redis** | | | | |
| ElastiCache | cache.t4g.micro | cache.r6g.large | cache.r6g.xlarge | Cluster mode |
| **Streaming (AMH)** | | | | |
| MSK Serverless | — | 1 cluster | 1 cluster | $500-1,500 |
| Managed Flink | — | 4 KPU | 8 KPU | $0.33/KPU-hr |
| **Storage (S3)** | | | | |
| Iceberg data lake | 10 GB | 500 GB | 5 TB | $0.023/GB |
| Backups | 20 GB | 200 GB | 1 TB | $0.023/GB |
| **Networking** | | | | |
| ALB/NLB | 1 ALB | 1 ALB | 2 ALB | $25/ALB |

### Monthly Cost Summary

| Tier | Compute | Database | Redis | Streaming | Storage | Network | **Total** |
|---|---|---|---|---|---|---|---|
| 1K Users | $300 | $250 | $30 | $0 | $10 | $25 | **$615** |
| 10K Users | $800 | $700 | $150 | $600 | $50 | $25 | **$2,325** |
| **100K Users** | $4,500 | $2,500 | $400 | $1,500 | $250 | $75 | **$9,225** |

### Cost Optimization Levers

1. **Spot instances for EKS workers:** 60-70% discount on non-critical pods
2. **Savings Plans:** 1-year commit for baseline (30% discount)
3. **Aurora Serverless v2:** For low-traffic periods (night time)
4. **Athena workgroup limits:** Cap at $200/mo per tenant for BI queries
5. **Redis cluster mode:** Scale out instead of up for cost efficiency
6. **Lifecycle policies:** Auto-archive audit_logs > 2 years to S3 Glacier

---

## Appendix: Tooling & Observability Gaps

### Missing Observability

| Area | Current | Recommended |
|---|---|---|
| APM | None | DataDog / New Relic / OpenTelemetry |
| DB query analytics | None | `pg_stat_statements` + Grafana |
| Distributed tracing | Jaeger configured | Wire OpenTelemetry SDK |
| Business metrics | Grafana dashboards exist | Add: message throughput, DLQ depth |
| Alerting | Prometheus + Grafana | Add PagerDuty/OpsGenie integration |
| Cost monitoring | None | AWS Cost Explorer + Budgets |

### Security Gaps for Scale

1. **No WAF rules for API:** Add AWS WAF with rate-based rules
2. **No secrets rotation:** Implement Secrets Manager rotation for DB creds
3. **Image scanning:** Enable ECR image scanning (Trivy or AWS Inspector)
4. **Network encryption:** TLS between all services (currently `PLAINTEXT` in Kafka config)

---

**Prepared by:** Forensics Audit (Automated)  
**Next review:** After Phase 1 completion (Week 4)
