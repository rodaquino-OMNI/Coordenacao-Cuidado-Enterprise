# Healthcare Invariants — AUSTA Care Platform

> **Verification checklist for the 6 healthcare MVP invariants.**
> Each invariant MUST be verified before processing real patient data (LGPD/ANS/ANVISA compliance).

---

## INV-1: Audit Trail Imutável

**Status:** ✅ IMPLEMENTED

**Descrição:** Toda ação sobre dados clínicos deve gerar um registro de auditoria imutável (create/read/update/delete), com timestamp, usuário, recurso e mudanças.

**Implementação:**
- Model `AuditLog` no Prisma (`prisma/schema.prisma:610-629`)
- `auditService.ts` — serviço de logging centralizado
- `audit.middleware.ts` — middleware que intercepta requisições automaticamente
- Campos: `id`, `userId`, `action` (CREATE|READ|UPDATE|DELETE|LOGIN|LOGOUT|EXPORT|IMPORT|APPROVE|DENY|ARCHIVE), `resource`, `resourceId`, `changes` (JSON), `ipAddress`, `userAgent`, `metadata`, `createdAt`

**Verificação:**
- [x] Model AuditLog existe no schema Prisma
- [x] Middleware de auditoria registra automaticamente
- [x] Toda modificação em HealthData gera AuditLog (emergency-detection.service.ts:612-628)
- [x] Índices no banco: `userId`, `action`, `resource`, `createdAt`

**Arquivos:** `prisma/schema.prisma`, `src/services/auditService.ts`, `src/middleware/audit.middleware.ts`

---

## INV-2: Idempotência de Mensagens

**Status:** ✅ IMPLEMENTED

**Descrição:** Mensagens WhatsApp não podem ser processadas em duplicata. Cada mensagem deve ter um identificador único que garanta idempotência no processamento.

**Implementação:**
- `whatsappMessageId` field in `Message` model — unique constraint (`prisma/schema.prisma:364`)
- `@unique` annotation garante rejeição de duplicatas a nível de banco
- Processamento de webhooks usa `upsert` com `whatsappMessageId` como chave

**Verificação:**
- [x] Campo `whatsappMessageId` tem constraint `@unique` no Prisma
- [x] Índice no banco: `@@index([whatsappMessageId])`
- [x] Webhook processor usa upsert baseado em whatsappMessageId

**Arquivos:** `prisma/schema.prisma:364`, `src/services/webhook-processor.service.ts`, `src/services/whatsapp.service.ts`

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
- `HealthData.algorithmVersion` no Prisma (`prisma/schema.prisma:175`)
- Risk Assessment: salva `algorithmVersion` em `storeAssessment()` (`risk-assessment.service.ts:1571`)
- Emergency Detection: salva `algorithmVersion` em `saveEmergencyAlerts()` e `AuditLog` (`emergency-detection.service.ts:595, 622`)
- Funções utilitárias: `getAlgorithmVersion()`, `isCurrentVersion()`

**Verificação:**
- [x] `algorithm-registry.ts` existe com 4 algoritmos registrados
- [x] Campo `algorithmVersion` existe no modelo `HealthData`
- [x] Risk assessment persiste `algorithmVersion` (`ALGORITHM_VERSION = 'risk-v1.0.0'`)
- [x] Emergency detection persiste `algorithmVersion` (`ALGORITHM_VERSION = 'emergency-v1.0.0'`)
- [x] AuditLog registra `algorithmVersion` em metadados

**Arquivos:** `src/lib/algorithm-registry.ts`, `prisma/schema.prisma:175`, `src/services/risk-assessment.service.ts:31,1571`, `src/services/emergency-detection.service.ts:21,595,622`

---

## INV-4: Criptografia em Repouso (Encryption at Rest)

**Status:** ✅ IMPLEMENTED

**Descrição:** Toda PHI (Protected Health Information) e PII (Personally Identifiable Information) deve ser criptografada em repouso usando pgcrypto (envelope encryption por tenant).

**Implementação:**
- `lib/crypto.ts` — `encryptPHI()` e `decryptPHI()` usando `pgp_sym_encrypt`/`pgp_sym_decrypt`
- Tenant-level encryption key (por `organizationId`)
- Production path planejado: AWS Secrets Manager / HashiCorp Vault
- Health check verifica se extensão `pgcrypto` está instalada e funcional:
  ```sql
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
  ```
- Key rotation placeholder documentado (TODO)

**Verificação:**
- [x] `lib/crypto.ts` existe com encryptPHI/decryptPHI
- [x] Health check `/health/detailed` verifica pgcrypto
- [x] Health check `/health/ready` inclui verificação de criptografia
- [x] Resposta do health check inclui `services.encryption` status

**Arquivos:** `src/lib/crypto.ts`, `src/controllers/health.ts:211-224`

---

## INV-5: Health Check + Dead Man's Switch

**Status:** ✅ IMPLEMENTED

**Descrição:** Sistema deve expor endpoints de monitoramento para verificar saúde de todos os componentes e detectar inatividade (dead man's switch para alerta externo).

**Implementação:**

| Endpoint | Descrição | Status |
|---|---|---|
| `GET /health` | Liveness probe (leve) | `healthy`/`unhealthy` |
| `GET /health/detailed` | Component-level checks (DB, Redis, Encryption) | `healthy`/`degraded` |
| `GET /health/ready` | Readiness probe (critical: DB + Encryption) | `ready`/`not ready` |
| `GET /health/live` | Kubernetes liveness probe | `alive` |
| `GET /health/dead-mans-switch` | Dead man's switch — timestamp última atividade | `alive`/`stale` |

**Componentes monitorados:**
- **Database:** `SELECT 1` via Prisma
- **Redis:** `healthCheck()` com graceful degradation (servidor opera sem cache se Redis indisponível)
- **Encryption:** verifica extensão `pgcrypto` no PostgreSQL

**Dead Man's Switch:**
- `touchActivity()` — chamado a cada requisição autenticada para atualizar timestamp
- Configurável via `DEAD_MANS_SWITCH_THRESHOLD_MS` (default: 5 minutos)
- Se `lastActivity` > threshold → retorna HTTP 503 + `status: "stale"`
- Deve ser monitorado por Prometheus Blackbox Exporter externo

**Verificação:**
- [x] Endpoint `/health` retorna JSON com status
- [x] Endpoint `/health/detailed` verifica DB, Redis, Encryption
- [x] Endpoint `/health/dead-mans-switch` retorna timestamp da última atividade
- [x] Redis unavailable → graceful degradation (não quebra health check)
- [x] pgcrypto verification funcional

**Arquivos:** `src/controllers/health.ts`, `src/infrastructure/redis/redis.cluster.ts`

---

## INV-6: Retry com Backoff Unificado

**Status:** ✅ IMPLEMENTED

**Descrição:** Todas as chamadas a serviços externos (WhatsApp Z-API, Tasy ERP, notificações email/SMS) devem usar a mesma biblioteca de retry com exponential backoff + jitter.

**Implementação:**
- `lib/retry.ts` — biblioteca centralizada:
  - `retryWithBackoff<T>()` — retry com exponential backoff configurável
  - `withRetry<T>()` — wrapper simplificado (retorna apenas o resultado)
  - `defaultShouldRetry()` — condição padrão: retry em 5xx, 429, network errors; NO retry em 4xx
  - `calculateBackoff()` — delay com jitter (±25%) para evitar thundering herd
  - `isApiError()` — verifica se resposta HTTP é erro

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

**Arquivos:** `src/lib/retry.ts`, `src/services/whatsapp.service.ts:183-217`, `src/services/tasyIntegration.ts:335-338,368-375,399-410,252-265`, `src/services/notificationService.ts:5`

---

## Summary

| # | Invariante | Status |
|---|---|---|
| 1 | Audit Trail Imutável | ✅ |
| 2 | Idempotência de Mensagens | ✅ |
| 3 | Versionamento de Algoritmos | ✅ |
| 4 | Criptografia em Repouso | ✅ |
| 5 | Health Check + Dead Man's Switch | ✅ |
| 6 | Retry com Backoff Unificado | ✅ |

**Todos os 6 invariantes verificados e implementados.**

**Próximo passo:** Validação em ambiente de staging com healthcare dataset sintético antes do primeiro paciente real.
