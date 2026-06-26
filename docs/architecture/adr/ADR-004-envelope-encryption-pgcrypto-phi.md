# ADR-004: Estratégia de Envelope Encryption com pgcrypto para PHI/PII

**Status:** Accepted
**Date:** 2026-06-26
**Deciders:** Parreira (Orquestrador DevOps)

## Context

O schema do Prisma (`schema.prisma`, 1259 linhas, 45+ tabelas) inclui dados sensíveis que se enquadram como Protected Health Information (PHI) sob LGPD e dados pessoais sensíveis (Art. 5º, II):

- **CPF** (identificador único do paciente)
- **Dados de saúde** (JSONB `HealthData`, `VitalSign`)
- **Contatos de emergência** (nome, telefone, relação)
- **Documentos médicos** (OCR extraído, armazenado como texto)
- **Respostas de questionários** (histórico médico, condições pré-existentes)

Evidências atuais:
- Migration SQL inclui extensão `pgcrypto` (`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
- `schema.prisma` tem campo `isEncrypted` no modelo `Document`
- `Requisitos.md` menciona "AES-256 encryption at rest" e "PII tokenization"
- **NÃO** há implementação visível de criptografia em nível de coluna
- **NÃO** há pipeline de criptografia no código de serviço

LGPD Art. 46 exige "medidas de segurança, técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas". Para dados de saúde (sensíveis), o padrão é criptografia em nível de campo, não apenas em disco.

## Decision

Implementar **envelope encryption usando pgcrypto** para todas as colunas contendo PHI/PII:

### Arquitetura de Chaves
```
┌─────────────────────────────────────────┐
│          AWS KMS / Vault (externo)       │
│  Customer Master Key (CMK)              │
│  → Rotação anual                        │
└──────────────┬──────────────────────────┘
               │ decrypt
               ▼
┌─────────────────────────────────────────┐
│        PostgreSQL (pgcrypto)            │
│  Data Encryption Key (DEK) por tenant   │
│  → Rotação a cada 90 dias              │
│  → Armazenado em tabela encryption_keys │
└──────────────┬──────────────────────────┘
               │ pgp_sym_encrypt(data, dek)
               ▼
┌─────────────────────────────────────────┐
│  Colunas criptografadas                 │
│  CPF, dados_saude, contatos_emergencia  │
│  → Formato: bytea (binário)             │
└─────────────────────────────────────────┘
```

### Implementação
1. Gerar DEK por tenant, armazenado criptografado com CMK do AWS KMS
2. Criptografar colunas sensíveis usando `pgp_sym_encrypt(data, dek, 'compress-algo=2, cipher-algo=aes256')`
3. Descriptografar via `pgp_sym_decrypt(column, dek)` com cache de DEK em Redis (TTL: 5 minutos)
4. Rotação de chaves: job agendado (cron) a cada 90 dias, re-encriptando registros em batch
5. Verification: health check que valida round-trip encrypt/decrypt com chave de teste

### Colunas a proteger
| Tabela | Coluna | Tipo atual | Tipo pós-cripto | Justificativa |
|--------|--------|-----------|-----------------|---------------|
| Patient | cpf | String | bytea (encrypted) | Identificador único, LGPD Art. 5º |
| HealthData | data | JSONB | bytea (encrypted) | Dados de saúde, LGPD Art. 5º, II |
| EmergencyContact | name, phone | String | bytea (encrypted) | Dados pessoais de terceiros |
| Document | extractedText | String | bytea (encrypted) | Pode conter PHI via OCR |

## Alternatives Considered

### Apenas criptografia em nível de aplicação
Rejeitado — pgcrypto provê defesa em profundidade no nível do banco. Um atacante com acesso ao banco (SQL injection, backup vazado) não consegue ler dados sem a DEK.

### Apenas criptografia de disco (full-disk encryption)
Rejeitado — insuficiente para proteção em nível de coluna exigida pela LGPD Art. 46. Full-disk encryption protege contra roubo físico do disco, mas não contra acesso privilegiado ao banco.

### Apenas AWS RDS encryption
Rejeitado — protege dados em repouso no storage layer, mas não contra acesso privilegiado ao banco (DBA, aplicação com credenciais do banco).

### Tokenização para campos frequentemente consultados
Considerado como complemento — CPF pode ser tokenizado (hash + salt) para permitir busca sem descriptografar. Tokenização não substitui criptografia; é uma otimização para queries de lookup.

## Consequences

### Positivas
- Conformidade com LGPD Art. 46 (medidas técnicas de segurança)
- Defesa em profundidade (aplicação + banco)
- Audit-ready: registros criptografados evidenciam proteção de dados sensíveis
- Facilita certificações (ISO 27001, SBIS/CFM)

### Negativas
- Overhead de performance: ~5-15% em operações de leitura/escrita nas colunas criptografadas
- Complexidade de gerenciamento de chaves (KMS + rotação + cache)
- Colunas criptografadas não podem ser indexadas para busca textual — requer tokenização complementar
- Sorting e filtering no banco ficam impossíveis em colunas criptografadas (resolver no application layer)

## Trade-offs

- **Segurança vs. Performance de query:** Colunas criptografadas não suportam WHERE/LIKE/ORDER BY. Campos frequentemente consultados (CPF) devem usar tokenização (hash lookup) como índice secundário.
- **Complexidade operacional vs. Risco de vazamento:** Gerenciar KMS + rotação de chaves adiciona complexidade, mas o custo de um vazamento de dados de saúde sob LGPD é multa de até 2% do faturamento (limitado a R$ 50 milhões).

## References

- LGPD Art. 46: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- PostgreSQL pgcrypto documentation: https://www.postgresql.org/docs/15/pgcrypto.html
- AWS KMS Envelope Encryption: https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping
- `schema.prisma`: evidência do campo `isEncrypted` e extensão `pgcrypto`
- `migrations/001_init_austa_care_schema.sql`: `CREATE EXTENSION IF NOT EXISTS pgcrypto`
