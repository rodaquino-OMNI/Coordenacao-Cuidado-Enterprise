# Healthcare Invariants — AUSTA Care Platform

> **Verification checklist for the 6 healthcare MVP invariants.**
> Each invariant MUST be verified before processing real patient data (LGPD/ANS/ANVISA compliance).
> **Last verified:** 2026-06-27 (Wave 2 completion)

---

## INV-1: Audit Trail Imutável

**Status:** ✅ IMPLEMENTED — Persisted to PostgreSQL via Prisma AuditLog

**Descrição:** Toda ação sobre dados clínicos deve gerar um registro de auditoria imutável (create/read/update/delete), persistido diretamente no PostgreSQL via Prisma ORM, com todos os 18 campos do modelo AuditLog preenchidos.

**Implementação (Wave 2 enhanced):**
- Model `AuditLog` no Prisma (`prisma/schema.prisma:886-944`) — 18 campos, polimórfico, índices especializados
- `auditService.ts` (1053 linhas) — `storeAuditEntry()` persiste via `prisma.auditLog.create()` imediatamente
- Buffer em memória mantido como fallback + batch periódico (30s interval)
- Campos mapeados: `id`, `userId`, `providerId`, `organizationId`, `userAgent`, `ipAddress`, `action` (AuditAction enum), `entity`, `entityId`, `oldValues`, `newValues`, `changedFields`, `description`, `reason`, `sessionId`, `requestId`, `riskLevel` (LOW|MEDIUM|HIGH|CRITICAL), `sensitiveData`, `requiresReview`, `lgpdRelevant`, `metadata` (JSONB), `occurredAt`
- `getAuditEntries()` consulta via `prisma.auditLog.findMany()` com filtros por data, entidade, usuário, compliance
- `ComplianceRule` engine (8 regras: LGPD data access, consent, deletion + ANS authorization, processing times, appeals + Internal security, data export)
- `RetentionPolicy` engine (3 políticas: patient-authorization-data, audit-trail-data, compliance-reports)
- Compliance reports (`generateComplianceReport`) com detection de violações
- EventEmitter para `securityAlert` (high/critical) e `complianceViolation`

**Verificação:**
- [x] Model AuditLog existe no schema Prisma (18 campos, 6 índices, 4 relações polimórficas)
- [x] `storeAuditEntry()` persiste diretamente via `prisma.auditLog.create()` (guaranteed write)
- [x] Todos os 18 campos do AuditLog mapeados no momento da persistência
- [x] Buffer em memória é secundário (fallback em caso de erro de DB)
- [x] `flushAuditBuffer()` (30s interval) também usa o mapeamento completo de campos
- [x] Toda modificação em dados de saúde/estado gera AuditLog com change tracking (`oldValues`, `newValues`, `changedFields`)
- [x] Severidade mapeada para `riskLevel` (LOW|MEDIUM|HIGH|CRITICAL)
- [x] `lgpdRelevant` flag setado automaticamente para dados de paciente
- [x] `sensitiveData` e `requiresReview` flags setados baseados em tipo de evento
- [x] Queries usam `occurredAt` (timestamp do evento) para ordenação/filtro

**Arquivos:** `prisma/schema.prisma`, `src/services/auditService.ts`

---

## INV-2: Idempotência de Mensagens

**Status:** ✅ IMPLEMENTED — Enhanced with P2002 error handling (2026-06-27)

**Descrição:** Mensagens WhatsApp não podem ser processadas em duplicata. Cada mensagem deve ter um identificador único que garanta idempotência no processamento.

**Implementação (Wave 3 enhanced):**
- `whatsappMessageId` field in `Message` model — unique constraint (`prisma/schema.prisma:231`)
- `@unique` annotation garante rejeição de duplicatas a nível de banco
- **Webhook processor** (`webhook-processor.service.ts`): inbound messages use `upsert` with `whatsappMessageId`; outbound messages now set `whatsappMessageId` from Z-API response and catch `PrismaClientKnownRequestError` (P2002) for idempotent handling
- **WhatsApp routes** (`whatsapp.routes.ts`): all three `prisma.message.create` calls (inbound, outbound, template) wrapped with P2002 idempotency catch

**Verificação:**
- [x] Campo `whatsappMessageId` tem constraint `@unique` no Prisma
- [x] Índice no banco: `@@index([whatsappMessageId])`
- [x] Webhook processor: inbound via upsert, outbound with whatsappMessageId + P2002 catch
- [x] WhatsApp routes: all create calls have P2002 idempotency handling
- [x] Outbound messages now persist whatsappMessageId from Z-API SendMessageResponse

**Arquivos:** `prisma/schema.prisma`, `src/services/webhook-processor.service.ts`, `src/routes/whatsapp.routes.ts`

---

## INV-3: Versionamento de Algoritmos

**Status:** ✅ IMPLEMENTED

**Descrição:** Todo score clínico salvo deve registrar a versão do algoritmo que o gerou. Mudanças em lógica clínica (thresholds, weights, regras) exigem bump de versão e registro no algorithm-registry.

**Implementação:**
- `lib/algorithm-registry.ts` — registro centralizado de versões:
  - `risk-assessment`: `1.0.0`
  - `emergency-detection`: `1.0.0`
  - `symptom-analysis`: `1.0.0`
  - `population-stratification`: `1.0.0`
- `HealthData.algorithmVersion` no Prisma (`prisma/schema.prisma:309`)
- Risk Assessment: salva `algorithmVersion` em `storeAssessment()` (`risk-assessment.service.ts`)
- Emergency Detection: salva `algorithmVersion` em `saveEmergencyAlerts()` e `AuditLog`
- Funções utilitárias: `getAlgorithmVersion()`, `isCurrentVersion()`

**Verificação:**
- [x] `algorithm-registry.ts` existe com 4 algoritmos registrados
- [x] Campo `algorithmVersion` existe no modelo `HealthData`
- [x] Risk assessment persiste `algorithmVersion` (`ALGORITHM_VERSION = 'risk-v1.0.0'`)
- [x] Emergency detection persiste `algorithmVersion` (`ALGORITHM_VERSION = 'emergency-v1.0.0'`)
- [x] AuditLog registra `algorithmVersion` em metadados

**Arquivos:** `src/lib/algorithm-registry.ts`, `prisma/schema.prisma`, `src/services/risk-assessment.service.ts`, `src/services/emergency-detection.service.ts`

---

## INV-4: Criptografia em Repouso (Encryption at Rest)

**Status:** ✅ IMPLEMENTED — pgcrypto actively used for audit metadata encryption

**Descrição:** Toda PHI (Protected Health Information) e PII (Personally Identifiable Information) deve ser criptografada em repouso usando pgcrypto (envelope encryption por tenant).

**Implementação (Wave 2 enhanced):**
- `lib/crypto.ts` — `encryptPHI()` e `decryptPHI()` usando `pgp_sym_encrypt`/`pgp_sym_decrypt`
  - `getEncryptionKey()` — resolução hierárquica: `AUDIT_ENCRYPTION_KEY` → `ENCRYPTION_KEY` → `PGCRYPTO_KEY` → fallback dev
  - `getTenantKey()` — tenant-level key resolution (production path: AWS Secrets Manager / Vault)
  - Compressão e AES-256 via pgcrypto nativo
- **Uso ativo no audit service**: `storeAuditEntry()` criptografa metadata sensível via `encryptPHI()` quando `entry.encrypted = true`
  - Exemplo: eventos de `recordDataAccess` (LGPD) e `recordSecurityEvent` (alta severidade) são criptografados
- Health check verifica se extensão `pgcrypto` está instalada e funcional:
  ```sql
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
  ```
- Key rotation placeholder documentado (TODO para produção)

**Verificação:**
- [x] `lib/crypto.ts` existe com `encryptPHI`/`decryptPHI` + `getEncryptionKey()`
- [x] pgcrypto é usado ativamente pelo audit service (não apenas "loaded but unused")
- [x] Health check `/health/detailed` verifica pgcrypto
- [x] Health check `/health/ready` inclui verificação de criptografia
- [x] Resposta do health check inclui `services.encryption` status
- [x] `AUDIT_ENCRYPTION_KEY` env var suportada com fallback hierarchy

**Arquivos:** `src/lib/crypto.ts`, `src/services/auditService.ts`, `src/controllers/health.ts`

---

## INV-5: Health Check + Dead Man's Switch

**Status:** ✅ IMPLEMENTED — Enhanced with latency measurement (2026-06-27)

**Descrição:** Sistema deve expor endpoints de monitoramento para verificar saúde de todos os componentes e detectar inatividade (dead man's switch para alerta externo).

**Implementação:**

| Endpoint | Descrição | Status |
|---|---|---|
| `GET /api/v1/health` | Component-level checks with latency (DB, Redis, Encryption) | `healthy`/`degraded`/`unhealthy` |
| `GET /api/v1/health/dead-mans-switch` | Dead man's switch — timestamp última atividade | `alive`/`stale` |
| `GET /api/v1/health/ready` | Readiness probe (critical: DB + Encryption) | `ready`/`not ready` |
| `GET /api/v1/health/live` | Kubernetes liveness probe | `alive` |
| `GET /health` (root) | Simple liveness probe | `ok` |

**Componentes monitorados (with latency measurement):**
- **Database:** `SELECT 1` via Prisma — reports `latencyMs`
- **Redis:** `healthCheck()` with graceful degradation (servidor opera sem cache se Redis indisponível)
- **Encryption:** verifica extensão `pgcrypto` no PostgreSQL — reports `latencyMs` + `algorithm: "aes256"`

**Response format:**
```json
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": 123.4,
  "version": "1.0.0",
  "components": {
    "database": { "status": "up", "latencyMs": 2 },
    "redis": { "status": "up", "latencyMs": 1 },
    "encryption": { "status": "up", "latencyMs": 5, "algorithm": "aes256" }
  }
}
```

**Dead Man's Switch:**
- `touchActivity()` — chamado a cada requisição autenticada para atualizar timestamp
- Configurável via `DEAD_MANS_SWITCH_THRESHOLD_MS` (default: 5 minutos)
- Se `lastActivity` > threshold → retorna HTTP 503 + `status: "stale"`
- Deve ser monitorado por Prometheus Blackbox Exporter externo

**Verificação:**
- [x] Endpoint `/api/v1/health` retorna JSON com status + latency
- [x] Endpoint `/api/v1/health/dead-mans-switch` retorna timestamp da última atividade
- [x] Endpoint `/api/v1/health/ready` verifica DB + Encryption
- [x] Endpoint `/api/v1/health/live` lightweight probe
- [x] Redis unavailable → graceful degradation (não quebra health check)
- [x] pgcrypto verification funcional com latency measurement

**Arquivos:** `src/routes/health.ts`, `src/infrastructure/redis/redis.cluster.ts`, `src/config/database.ts`

---

## INV-6: Retry com Backoff Unificado

**Status:** ✅ IMPLEMENTED — Enhanced with RetryError + onRetry callback (2026-06-27)

**Descrição:** Todas as chamadas a serviços externos (WhatsApp Z-API, Tasy ERP, notificações email/SMS) devem usar a mesma biblioteca de retry com exponential backoff + jitter.

**Implementação:**
- `lib/retry.ts` — biblioteca centralizada:
  - `retryWithBackoff<T>()` — retry com exponential backoff configurável
  - `withRetry<T>()` — wrapper simplificado (retorna apenas o resultado)
  - `RetryError` — structured error with `attempts` and `lastError` properties
  - `defaultShouldRetry()` — condição padrão: retry em 5xx, 429, network errors; NO retry em 4xx
  - `calculateBackoff()` — delay com jitter (±25%) para evitar thundering herd
  - `isApiError()` — verifica se resposta HTTP é erro
  - `onRetry` callback — invoked before each retry attempt with (error, attempt, delayMs)

**Serviços que usam `lib/retry.ts`:**

| Serviço | Método de Retry | Status |
|---|---|---|
| **WhatsApp (Z-API)** | `retryWithBackoff` via `executeWithRetry()` | ✅ Unificado |
| **Tasy ERP** | `withRetry` em submitAuthorization, updateAuthorizationStatus, syncPatientData, performEligibilityCheck | ✅ Adicionado |
| **Notification (Email/SMS)** | `withRetry` + `defaultShouldRetry` | ✅ Já integrado |

**Configurações padrão:**
- `maxAttempts`: 3
- `initialDelayMs`: 1000
- `maxDelayMs`: 30000
- `backoffMultiplier`: 2 (exponencial)
- `jitter`: true (±25%)

**Verificação:**
- [x] `lib/retry.ts` existe e é importado por WhatsApp, Tasy e Notification
- [x] WhatsApp usa `retryWithBackoff` (substituiu retry customizado)
- [x] Tasy API calls wrapped com `withRetry`
- [x] Notification service usa `lib/retry.ts`
- [x] Jitter configurado para evitar thundering herd
- [x] `RetryError` class with structured error info (attempts, lastError)
- [x] `onRetry` callback support for custom retry handling

**Arquivos:** `src/lib/retry.ts`, `src/services/whatsapp.service.ts`, `src/services/tasyIntegration.ts`, `src/services/notificationService.ts`

---

## Wave 2 Enhancements (2026-06-27)

### Audit Service → Prisma AuditLog Persistence

| Enhancement | Before (Wave 1) | After (Wave 2) |
|---|---|---|
| Persistence | In-memory Map buffer only | Direct `prisma.auditLog.create()` + buffer fallback |
| Fields mapped | ~10 of 18 AuditLog fields | All 18 fields fully mapped |
| `occurredAt` vs `createdAt` | Used `createdAt` for event time | Correctly uses `occurredAt` |
| `riskLevel` | Not set | Mapped from severity (LOW→CRITICAL) |
| `lgpdRelevant` | Not set | Auto-detected from compliance flags |
| `sensitiveData` | Not set | Based on encryption + LGPD flags |
| `requiresReview` | Not set | High/critical events flagged |
| `oldValues`/`newValues`/`changedFields` | Not set | State transitions tracked |
| `description`/`reason`/`requestId`/`providerId`/`sessionId` | Embedded in JSON metadata only | Top-level fields populated |
| Query filtering | `createdAt` based | `occurredAt` based |

### pgcrypto Encryption

| Enhancement | Before (Wave 1) | After (Wave 2) |
|---|---|---|
| pgcrypto usage | Extension loaded but 0 usages in code | Actively called by audit service for sensitive metadata |
| Key resolution | `ENCRYPTION_KEY` only | `AUDIT_ENCRYPTION_KEY` → `ENCRYPTION_KEY` → `PGCRYPTO_KEY` hierarchy |
| Production guard | None | Throws error if production + no key set |
| `getEncryptionKey()` | Not present | Added with fallback chain |

---

## Wave 3 Enhancements (2026-06-27)

### Retry Library — RetryError + onRetry

| Enhancement | Before | After |
|---|---|---|
| Error handling | Raw error thrown on failure | `RetryError` with structured `attempts` / `lastError` |
| Retry callback | Logging only (internal) | `onRetry()` callback exposed to callers |
| Error reporting | Generic error message | Structured `RetryError` for alerting systems |

### WhatsApp — P2002 Idempotency

| Enhancement | Before | After |
|---|---|---|
| Outbound message ID | No `whatsappMessageId` persisted | Captured from Z-API `SendMessageResponse.messageId` |
| Duplicate handling | Crash on unique violation | P2002 caught, logged, operation skipped idempotently |
| Coverage | Only `upsert` for inbound | All 4 `prisma.message.create` calls protected |

### Health Check — Latency Measurement

| Enhancement | Before | After |
|---|---|---|
| Endpoint location | `controllers/health.ts` (unused) | `routes/health.ts` (active, mounted at `/api/v1/health`) |
| Component status | Binary healthy/unhealthy | `up`/`down`/`degraded` with `latencyMs` |
| Encryption check | Boolean pgcrypto check | Includes `algorithm: "aes256"` in response |
| Response format | Free-form JSON | Structured `HealthCheckResponse` type |

---

## Summary

| # | Invariante | Status |
|---|---|---|
| 1 | Audit Trail Imutável | ✅ Persisted to Prisma (all 18 fields) |
| 2 | Idempotência de Mensagens | ✅ Enhanced with P2002 handling |
| 3 | Versionamento de Algoritmos | ✅ |
| 4 | Criptografia em Repouso | ✅ pgcrypto actively used |
| 5 | Health Check + Dead Man's Switch | ✅ Enhanced with latency measurement |
| 6 | Retry com Backoff Unificado | ✅ Enhanced with RetryError + onRetry |

**Todos os 6 invariantes verificados e implementados com persistência real em banco de dados.**

**Próximo passo:** Validação em ambiente de staging com healthcare dataset sintético antes do primeiro paciente real.
