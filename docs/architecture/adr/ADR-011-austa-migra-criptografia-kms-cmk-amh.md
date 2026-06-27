# ADR-011: AUSTA Migra Criptografia para Modelo KMS CMK por Tenant da AMH

**Status:** Accepted
**Date:** 2026-06-27
**Deciders:** Parreira (Orquestrador DevOps), AMH Principal Architect

## Context

A plataforma AUSTA Care Platform implementa criptografia de dados sensíveis (PHI/PII) usando `pgcrypto` com envelope encryption, conforme documentado no ADR-004. A chave de criptografia (DEK — Data Encryption Key) é derivada de variáveis de ambiente (`ENCRYPTION_KEY`, `AUDIT_ENCRYPTION_KEY`) ou AWS Secrets Manager, sem integração com AWS KMS Customer Managed Keys (CMK).

A plataforma AMH, por outro lado, implementa um modelo de KMS CMK por tenant (ADR-012 AMH) onde cada tenant possui sua própria CMK (`alias/amh-lake-austa-clinicas` para o tenant AUSTA Clínicas), com key policy que reforça isolamento entre tenants via session tags ABAC.

### Estado atual da criptografia AUSTA:
- **pgcrypto:** Extensão carregada no PostgreSQL. Funções `encryptPHI()` e `decryptPHI()` em `lib/crypto.ts` usando `pgp_sym_encrypt`/`pgp_sym_decrypt`
- **Chave de criptografia:** Resolução hierárquica: `AUDIT_ENCRYPTION_KEY` → `ENCRYPTION_KEY` → `PGCRYPTO_KEY` → fallback dev
- **Uso atual:** Primariamente no `auditService.ts` para criptografar metadata de auditoria sensível
- **Colunas PHI:** `User.cpf`, `HealthData.conditions/medications/allergies/symptoms/vitalSigns/labResults`, `EmergencyContact` — marcadas como "PHI - encrypt at rest" no schema mas criptografia em nível de aplicação não verificada em todos os paths de código
- **Chave mestra:** Sem Customer Managed Key no KMS — chave existe apenas como string em Secrets Manager ou env var
- **Rotação de chave:** Placeholder documentado ("TODO para produção") — sem rotação implementada

### Por que isso é um problema:
- **Chave sem isolamento:** Se a chave de criptografia da AUSTA for comprometida, não há KMS key policy que limite o blast radius
- **Sem auditabilidade de uso de chave:** Uso de chave via `pgp_sym_encrypt` não gera CloudTrail logs. Impossível auditar quem descriptografou qual dado
- **Sem rotação automática:** AWS KMS CMK oferece rotação anual automática sem impacto operacional. Chave em env var/Secrets Manager requer rotação manual
- **Fora do modelo AMH:** AMH opera 16 CMKs com isolamento por tenant. AUSTA usando seu próprio mecanismo de chave é uma exceção que enfraquece o modelo de segurança do grupo
- **Compliance healthcare:** Dados PHI exigem criptografia com Customer Managed Keys sob controle organizacional (não AWS Managed Keys ou env vars)

## Decision

**AUSTA migra sua raiz de confiança criptográfica para o KMS CMK do tenant `austa_clinicas` provisionado pela AMH (`alias/amh-lake-austa-clinicas`).** A DEK (Data Encryption Key) do pgcrypto passa a ser protegida por envelope encryption com a CMK do tenant via AWS KMS. AUSTA adota o mesmo modelo de key policy, auto-rotação, e auditabilidade via CloudTrail que o resto da plataforma AMH.

### Arquitetura de Envelope Encryption com KMS

```
┌──────────────────────────────────────────────────────────────┐
│              AWS KMS (sa-east-1)                              │
│                                                               │
│  alias/amh-lake-austa-clinicas (CMK)                         │
│  ├── Key Policy: Allow use by principals with                │
│  │               session tag tenant=austa_clinicas            │
│  ├── Auto-rotation: 1 ano                                    │
│  └── CloudTrail: GenerateDataKey, Decrypt auditados          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ 1. GenerateDataKey (retorna plaintext + encrypted DEK)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              AUSTA Application Layer                          │
│                                                               │
│  lib/crypto.ts (atualizado)                                  │
│  ├── getDEK(): KMS.generateDataKey(KeyId: alias/amh-lake-    │
│  │              austa-clinicas, KeySpec: AES_256)             │
│  │    → Retorna: { plaintextDEK, encryptedDEK }              │
│  ├── encryptPHI(data, plaintextDEK): pgp_sym_encrypt()       │
│  └── decryptPHI(encryptedData, encryptedDEK):                │
│        1. KMS.decrypt(encryptedDEK) → plaintextDEK           │
│        2. pgp_sym_decrypt(encryptedData, plaintextDEK)       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ pgp_sym_encrypt(data, plaintextDEK)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              PostgreSQL (pgcrypto)                            │
│                                                               │
│  encryption_keys (nova tabela)                               │
│  ├── key_id: VARCHAR(64) PRIMARY KEY                         │
│  ├── encrypted_dek: BYTEA (DEK criptografada com KMS CMK)   │
│  ├── created_at: TIMESTAMPTZ                                 │
│  ├── rotated_at: TIMESTAMPTZ                                 │
│  └── is_active: BOOLEAN                                      │
│                                                               │
│  Colunas criptografadas:                                     │
│  ├── users.cpf_hash (SHA-256 + salt) + encrypted_data (BYTEA)│
│  ├── health_data.encrypted_value (BYTEA)                     │
│  ├── emergency_contacts (JSON encrypted → BYTEA)             │
│  └── documents.encrypted_text (BYTEA)                        │
└──────────────────────────────────────────────────────────────┘
```

### Implementação do Envelope Encryption

```typescript
// lib/kms-crypto.ts (novo - substitui lib/crypto.ts)
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: 'sa-east-1' });
const CMK_ALIAS = 'alias/amh-lake-austa-clinicas';

interface DEKCache {
  plaintext: Buffer;
  encrypted: Buffer;
  createdAt: Date;
}

let dekCache: DEKCache | null = null;
const DEK_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getDEK(): Promise<DEKCache> {
  if (dekCache && (Date.now() - dekCache.createdAt.getTime()) < DEK_CACHE_TTL_MS) {
    return dekCache;
  }

  const response = await kms.send(new GenerateDataKeyCommand({
    KeyId: CMK_ALIAS,
    KeySpec: 'AES_256',
  }));

  dekCache = {
    plaintext: Buffer.from(response.Plaintext!),
    encrypted: Buffer.from(response.CiphertextBlob!),
    createdAt: new Date(),
  };

  return dekCache;
}

export async function encryptPHI(plaintext: string): Promise<{ encryptedData: Buffer; encryptedDEK: Buffer }> {
  const dek = await getDEK();
  const query = `SELECT pgp_sym_encrypt($1, $2, 'compress-algo=2, cipher-algo=aes256') AS encrypted`;
  const result = await db.$queryRawUnsafe<[{ encrypted: Buffer }]>(query, plaintext, dek.plaintext);
  return { encryptedData: result[0].encrypted, encryptedDEK: dek.encrypted };
}

export async function decryptPHI(encryptedData: Buffer, encryptedDEK: Buffer): Promise<string> {
  // 1. Decrypt DEK using KMS CMK
  const kmsResponse = await kms.send(new DecryptCommand({
    KeyId: CMK_ALIAS,
    CiphertextBlob: encryptedDEK,
  }));
  const plaintextDEK = Buffer.from(kmsResponse.Plaintext!);

  // 2. Decrypt data using plaintext DEK
  const query = `SELECT pgp_sym_decrypt($1, $2) AS decrypted`;
  const result = await db.$queryRawUnsafe<[{ decrypted: string }]>(query, encryptedData, plaintextDEK);
  return result[0].decrypted;
}

// Rotação de DEK (chamada a cada 90 dias ou on-demand)
export async function rotateDEK(): Promise<void> {
  // 1. Gerar nova DEK
  const newDEK = await getDEK();

  // 2. Para cada registro criptografado com DEK antiga:
  //    - Descriptografar com DEK antiga
  //    - Re-criptografar com nova DEK
  //    (batch processing, fora do hot path)

  // 3. Invalidar cache
  dekCache = null;

  // 4. Registrar rotação em encryption_keys
  await db.$executeRaw`
    UPDATE encryption_keys
    SET is_active = false, rotated_at = NOW()
    WHERE is_active = true
  `;
}
```

### CloudTrail Audit de Uso de Chave

Todo uso da CMK gera eventos CloudTrail:

```
Event: GenerateDataKey
  Principal: arn:aws:sts::123456789:assumed-role/austa-backend-task/session-id
  PrincipalTag/tenant: austa_clinicas
  Resource: arn:aws:kms:sa-east-1:123456789:key/abc-123-def
  ResourceTag/tenant: austa_clinicas
  → Auditável: qual workload, em qual tenant, gerou chave de dados

Event: Decrypt
  Principal: arn:aws:sts::123456789:assumed-role/austa-backend-task/session-id
  PrincipalTag/tenant: austa_clinicas
  → Auditável: qual workload descriptografou dados (compliance LGPD)
```

### Key Policy (CMK do tenant)

```json
{
  "Statement": [
    {
      "Sid": "AllowAustaWorkloads",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789:role/austa-backend-task"
      },
      "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:PrincipalTag/tenant": "austa_clinicas"
        }
      }
    },
    {
      "Sid": "DenyOtherTenants",
      "Effect": "Deny",
      "Principal": "*",
      "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalTag/tenant": "austa_clinicas"
        },
        "Null": {
          "aws:PrincipalTag/tenant": "false"
        }
      }
    }
  ]
}
```

## Alternatives Considered

### Manter pgcrypto com chave em Secrets Manager (sem KMS CMK)
Rejeitado — sem auditabilidade de uso de chave (CloudTrail), sem rotação automática, sem isolamento por tenant via key policy. Não atende padrão de compliance healthcare para Customer Managed Keys.

### Migrar totalmente para criptografia do lado do KMS (KMS Encrypt/Decrypt API, sem pgcrypto)
Rejeitado — KMS Encrypt/Decrypt tem limite de 4 KB por operação e latência maior (API call). pgcrypto com envelope encryption (DEK gerenciada pelo KMS) é o padrão para criptografia de colunas em banco de dados — combina performance do pgcrypto com auditabilidade do KMS.

### Usar AWS Managed Key (aws/rds) em vez de CMK
Rejeitado — AWS Managed Keys não têm key policy customizável, não permitem restrição por session tag tenant, e não oferecem o mesmo nível de auditabilidade (sem CloudTrail por principal).

### Continuar com chave em env var para desenvolvimento local
Aceitável para desenvolvimento local. Em produção, KMS CMK é obrigatório. Health check (`/health/detailed`) verifica se a CMK está acessível e emite alerta se configuração de dev for detectada em ambiente de produção.

## Consequences

### Positivas
- **Isolamento de blast radius:** Comprometimento da chave de criptografia da AUSTA não expõe dados de outros tenants (IMC, IOP, Diagnose, etc.)
- **Auditabilidade completa:** CloudTrail registra todo `GenerateDataKey` e `Decrypt` — essencial para compliance LGPD e auditoria ANS
- **Rotação automática:** KMS CMK com rotação anual automática — sem intervenção operacional
- **Defense in depth:** Duas camadas: (1) IAM ABAC controla quem pode usar a chave, (2) KMS Key policy reforça tenant isolation
- **Alinhamento com AMH:** AUSTA segue o mesmo modelo de segurança que o resto da plataforma — simplifica auditoria e operação

### Negativas
- **Latência adicional:** `GenerateDataKey` (cacheado por 5 min) e `Decrypt` (por operação de leitura) adicionam ~10-30ms de latência da API KMS
- **Dependência do KMS:** Se KMS estiver indisponível (raro, mas possível), criptografia/descriptografia de dados fica bloqueada
- **Migração de dados:** Dados criptografados com chave antiga (env var) precisam ser re-criptografados com nova DEK protegida por KMS
- **Custo KMS:** US$ 1/mês pela CMK (já provisionada) + custo de API calls (~US$ 0.03 por 10k operações)

### Neutras
- Em desenvolvimento local, fallback para `ENCRYPTION_KEY` env var é aceitável (com aviso no log: "WARNING: Using non-KMS encryption key for local development")
- A CMK `alias/amh-lake-austa-clinicas` já existe (provisionada pela AMH) — AUSTA não precisa criar nova CMK

## Trade-offs

- **Latência KMS vs. Auditabilidade:** 10-30ms por operação de decrypt adiciona overhead, mas a auditabilidade via CloudTrail é non-negotiable para dados de saúde
- **Complexidade de envelope encryption vs. Simplicidade de env var:** Envelope encryption é mais complexo (DEK + CMK), mas provê isolamento e auditabilidade que env var não oferece

## Implementation Plan

1. **Phase 1:** Configurar IAM role `austa-backend-task` com permissão `kms:GenerateDataKey` e `kms:Decrypt` na CMK `alias/amh-lake-austa-clinicas`
2. **Phase 2:** Criar `lib/kms-crypto.ts` com envelope encryption usando KMS + pgcrypto. Manter `lib/crypto.ts` como wrapper para transição suave
3. **Phase 3:** Criar tabela `encryption_keys` no PostgreSQL para rastreamento de DEKs
4. **Phase 4:** Migrar dados criptografados com chave antiga → re-criptografar com nova DEK protegida por KMS (batch job)
5. **Phase 5:** Remover fallback para `ENCRYPTION_KEY` env var em produção (health check bloqueia startup se detectar)
6. **Phase 6:** Configurar CloudWatch alarm para `kms:GenerateDataKey` e `kms:Decrypt` com principal sem session tag `tenant=austa_clinicas`

## Validation

- [ ] Teste de KMS: `GenerateDataKey` com role `austa-backend-task` + session tag `tenant=austa_clinicas` → sucesso
- [ ] Teste de isolamento: `GenerateDataKey` com session tag `tenant=imc` → `AccessDenied`
- [ ] Round-trip encrypt/decrypt: `encryptPHI("teste")` → `decryptPHI(encryptedData, encryptedDEK)` → "teste"
- [ ] CloudTrail: `GenerateDataKey` e `Decrypt` events visíveis com principal tag `tenant=austa_clinicas`
- [ ] Auto-rotação: CMK status `KeyRotationEnabled: true` verificado via `aws kms get-key-rotation-status`
- [ ] Health check `/health/detailed` reporta `encryption: { status: "up", algorithm: "aes256", keyProvider: "KMS_CMK" }`
- [ ] Nenhum dado descriptografável com chave errada (tenant errado → AccessDenied)

## References

- AMH ADR-012: [KMS CMK por Tenant para Encryption-at-Rest](../../amh-data-platform/architecture/adrs/ADR-012-kms-cmk-por-tenant-encryption.md)
- AMH ADR-005: [Estratégia Multi-Tenant — ABAC + LF-Tags](../../amh-data-platform/architecture/adrs/ADR-005-estrategia-multi-tenant.md)
- AUSTA ADR-004: [Envelope Encryption com pgcrypto](ADR-004-envelope-encryption-pgcrypto-phi.md) — substituído por esta ADR para a raiz de confiança
- AWS KMS Envelope Encryption: https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping
- AWS KMS GenerateDataKey API: https://docs.aws.amazon.com/kms/latest/APIReference/API_GenerateDataKey.html
- AUSTA `lib/crypto.ts`: implementação atual de criptografia
- LGPD Art. 46: Medidas de segurança técnicas e administrativas
