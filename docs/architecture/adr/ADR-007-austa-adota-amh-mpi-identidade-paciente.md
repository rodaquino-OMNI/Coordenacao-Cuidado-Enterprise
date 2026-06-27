# ADR-007: AUSTA Adota AMH MPI como Fonte Canônica de Identidade do Paciente

**Status:** Accepted
**Date:** 2026-06-27
**Deciders:** Parreira (Orquestrador DevOps), AMH Principal Architect

## Context

A plataforma AUSTA Care Platform atualmente implementa seu próprio modelo de identidade de paciente baseado no campo `User.cpf` (CPF em plaintext no PostgreSQL) e `User.phone` (WhatsApp como identificador primário de comunicação). Este modelo é incompleto e não interoperável com a plataforma AMH Data Platform, que opera um Master Patient Index (MPI) sofisticado com linking determinístico + probabilístico e consent gate (ADR-006 do AMH).

### Evidências do estado atual:
- `User.cpf` armazenado como String plaintext (marcado como "PHI - encrypt at rest" mas sem criptografia em nível de coluna no código)
- Zero referência a `mpi_id` em todo o schema (1301 linhas, 45+ tabelas)
- Nenhuma integração com MPI — identidade do paciente é completamente isolada da visão longitudinal que o MPI provê
- WhatsApp onboarding coleta CPF na Mission 1 ("Me Conhece") mas não resolve identidade contra um índice mestre

### Por que isso é um problema:
- **Visão fragmentada:** O mesmo paciente que interage via WhatsApp (AUSTA) e tem registros no Tasy (ERP hospitalar) não é reconhecido como a mesma pessoa — impossibilitando visão 360 cross-channel
- **Duplicação de identidade:** Dois sistemas mantendo identificadores de paciente independentes é anti-pattern de healthcare arquiteture (viola princípio AMH 5.4: "Identidade Centralizada, Posse Distribuída")
- **Risco LGPD:** CPF armazenado em plaintext viola LGPD Art. 46 (medidas técnicas de segurança para dados sensíveis)
- **Falta de consent gate:** Sem integração com MPI, AUSTA não pode verificar consentimento do paciente para federation cross-tenant (obrigatório sob LGPD Art. 11 para dados de saúde)

## Decision

**AUSTA adota o AMH MPI como fonte canônica de identidade do paciente.** Toda resolução de identidade passa pela MPI REST API. AUSTA armazena `mpi_id` como chave estrangeira (foreign key) em seu modelo `User` e em todas as entidades clínicas. CPF é hasheado com salt antes de armazenamento e usado apenas como identificador de lookup, não como identidade primária.

### Fluxo de Resolução de Identidade

```
WhatsApp Onboarding (AUSTA) → Coleta CPF + dados demográficos
    │
    ▼
AUSTA hashes CPF: SHA-256(CPF + salt) [salt do Secrets Manager AMH]
    │
    ▼
POST /mpi/v1/lookup (AMH MPI REST API)
    Body: { cpf_hash, full_name, birth_date, phone_hash, source_tenant: "austa_clinicas" }
    │
    ▼
AMH MPI → deterministic match (CPF/CNS hash) → probabilistic fallback (nome+DN+telefone)
    │
    ▼
Response: { mpi_id, match_method, match_confidence, golden_record }
    │
    ▼
AUSTA armazena mpi_id no User + entidades clínicas
```

### Schema Changes

```sql
-- User model additions
ALTER TABLE users ADD COLUMN mpi_id VARCHAR(64);
ALTER TABLE users ADD COLUMN mpi_match_confidence FLOAT;
ALTER TABLE users ADD COLUMN mpi_match_method VARCHAR(50);
ALTER TABLE users ADD COLUMN cpf_hash VARCHAR(128); -- SHA-256 hash, not plaintext

-- Indexes
CREATE INDEX idx_users_mpi_id ON users(mpi_id);
CREATE INDEX idx_users_cpf_hash ON users(cpf_hash);

-- Clinical entities also carry mpi_id for direct linking
ALTER TABLE health_data ADD COLUMN mpi_id VARCHAR(64);
ALTER TABLE vital_signs ADD COLUMN mpi_id VARCHAR(64);
ALTER TABLE authorizations ADD COLUMN mpi_id VARCHAR(64);
ALTER TABLE questionnaire_responses ADD COLUMN mpi_id VARCHAR(64);

-- Migration: backfill cpf_hash from existing cpf (one-time)
UPDATE users SET cpf_hash = ENCODE(DIGEST(cpf || '${SALT}', 'sha256'), 'hex') WHERE cpf IS NOT NULL;
-- After verification: ALTER TABLE users DROP COLUMN cpf; (eventually)
```

### MPI Integration Points

| Ponto de Integração | Quando | Requisição MPI | Ação AUSTA |
|---------------------|--------|---------------|------------|
| **WhatsApp Onboarding** | Mission 1 "Me Conhece" — paciente fornece CPF | `POST /mpi/v1/lookup` | Armazenar `mpi_id` no User recém-criado |
| **Tasy Sync** | Dados de paciente importados do ERP Tasy | `POST /mpi/v1/lookup` com `source_tenant=tasy` + `source_id=nr_atendimento` | Vincular `mpi_id` ao User ou criar novo |
| **Bulk B2B Onboarding** | Upload CSV/Excel com 10k+ beneficiários | `POST /mpi/v1/bulk-lookup` (batch, async) | Processar em lote, notificar quando completo |
| **Consulta de Paciente** | Enfermeira/coordenador busca paciente | `GET /mpi/v1/patients/{mpi_id}` | Obter golden record do MPI para exibição |
| **Eventos Clínicos** | Criação de HealthData, VitalSign, Authorization | N/A (usa `mpi_id` já armazenado) | Incluir `mpi_id` em todo registro clínico |

### Critérios de Matching e Tratamento por Cenário

| Cenário | Match Method | Match Score | Ação AUSTA |
|---------|-------------|-------------|------------|
| CPF + Nome + DN batem exatamente | `deterministic` | 1.0 | Auto-link: armazenar `mpi_id` |
| CPF bate, nome/dados variam ligeiramente | `deterministic` | 0.95-0.99 | Auto-link com flag `mpi_match_confidence < 1.0` para revisão |
| Sem CPF, match probabilístico alto | `probabilistic` | ≥0.92 | Auto-link (confiável segundo threshold AMH) |
| Match probabilístico ambíguo | `probabilistic` | 0.75-0.92 | Aguardar stewarding do MPI (queue); AUSTA armazena `mpi_id` provisório |
| Sem match | `new_patient` | N/A | MPI cria novo `mpi_id`; AUSTA armazena |
| CPF não fornecido (usuário WhatsApp sem CPF) | `probabilistic` (nome+tel+DN) | Variável | Tentar match sem CPF; se falhar, novo `mpi_id` |

## Alternatives Considered

### AUSTA mantém seu próprio MPI (não integra com AMH)
Rejeitado — duplicação de esforço, dados, e complexidade. AMH MPI já cobre todas as PJs do grupo Americas Health. Criar um segundo MPI é anti-pattern que fragmenta a identidade do paciente em vez de unificá-la. Viola o princípio AMH 5.4.

### AUSTA usa `cpf_hash` como identidade primária (sem MPI)
Rejeitado — CPF é um identificador, não uma identidade. Não cobre pacientes sem CPF (recém-nascidos, estrangeiros, erros cadastrais — estimados 10-15% da população de saúde). Não provê linking cross-tenant. Não gerencia consentimento.

### MPI lookup assíncrono (fire-and-forget)
Rejeitado para onboarding — o paciente que acabou de fornecer CPF espera confirmação imediata. Lookup síncrono com timeout de 500ms. Para batch B2B (10k+ registros), usar endpoint bulk assíncrono.

### AUSTA acessa MPI diretamente via banco de dados
Rejeitado — viola isolamento multi-tenant do AMH (ADR-005). MPI é camada de serviço com acesso restrito. AUSTA acessa via REST API com autenticação Cognito + session tag `tenant=austa_clinicas`.

## Consequences

### Positivas
- **Identidade unificada:** Paciente WhatsApp (AUSTA) = Paciente Tasy (ERP) = Paciente OMNI (App) — visão 360 real
- **Conformidade LGPD:** CPF hasheado com salt, consent gate respeitado via MPI, pseudonimização implementada
- **Menos código AUSTA:** Delegação de identidade para o MPI reduz superfície de código de identity resolution em AUSTA
- **Cross-tenant habilitado:** Quando AUSTA clínicas precisar encaminhar paciente para Diagnose (exames), o `mpi_id` permite rastreamento do episódio completo
- **Golden record:** AUSTA se beneficia da lógica de golden record do MPI (nome canônico, dados de contato mais recentes) sem implementá-la

### Negativas
- **Dependência de rede:** Lookup MPI adiciona latência de ~50-100ms ao onboarding via WhatsApp (rede VPC interna)
- **Ponto único de falha:** Se MPI estiver indisponível, onboarding de novos pacientes fica bloqueado (mitigável com cache local e fila de retry)
- **Migração de dados:** Backfill de `mpi_id` para usuários existentes (que já completaram onboarding) requer batch job
- **Acoplamento organizacional:** Mudanças na API do MPI exigem coordenação entre times AUSTA e AMH

### Neutras
- CPF continua sendo coletado no WhatsApp onboarding (obrigatório para lookup determinístico), mas não é mais armazenado em plaintext
- Usuários que não fornecem CPF ainda podem ser onboarded — o MPI faz matching probabilístico com nome + telefone + data de nascimento

## Trade-offs

- **Latência vs. Precisão de identidade:** 50-100ms adicionais no onboarding em troca de identidade longitudinal unificada. Aceitável dado que o onboarding é interação assíncrona (WhatsApp).
- **Dependência vs. Consolidação:** Depender do MPI como serviço externo adiciona risco operacional, mas eliminar duplicação de identidade reduz risco clínico (false positive de identidade).
- **Simplicidade local vs. Complexidade distribuída:** Manter identidade apenas no PostgreSQL é mais simples, mas não escala para o ecossistema multi-PJ da Americas Health.

## Implementation Plan

1. **Phase 1 (imediato):** Adicionar `mpi_id`, `mpi_match_confidence`, `cpf_hash` ao modelo User. Criar migration.
2. **Phase 2:** Implementar `mpi-client.ts` com `lookupPatient()` e `getPatient()` — cliente HTTP para MPI REST API com retry e circuit breaker.
3. **Phase 3:** Integrar MPI lookup no fluxo de onboarding WhatsApp (Mission 1 handler). Emitir métricas de latência.
4. **Phase 4:** Backfill de `mpi_id` para usuários existentes via batch job.
5. **Phase 5:** Adicionar `mpi_id` a todas as entidades clínicas (HealthData, VitalSign, Authorization, QuestionnaireResponse).
6. **Phase 6:** Remover coluna `cpf` plaintext após migração e verificação.

## Validation

- [ ] 100% dos novos usuários onboarded recebem `mpi_id` em < 500ms P95
- [ ] `cpf_hash` calculado corretamente (SHA-256 + salt) — verificado via round-trip: hash conhecido → lookup MPI → golden record confirmado
- [ ] Zero CPF plaintext em logs, backups, ou queries após Phase 6
- [ ] MPI lookup com circuit breaker funcional: 3 falhas consecutivas → fallback para fila de retry
- [ ] Teste de integração: WhatsApp onboarding → MPI lookup → `mpi_id` armazenado → evento clínico carrega `mpi_id`

## References

- AMH ADR-006: [MPI — Linking Determinístico + Probabilístico com Consent Gate](../../amh-data-platform/architecture/adrs/ADR-006-mpi-linking-deterministico-probabilistico-consent-gate.md)
- AMH ADR-005: [Estratégia Multi-Tenant — Prefix S3 + Glue DB + LF-Tags + ABAC](../../amh-data-platform/architecture/adrs/ADR-005-estrategia-multi-tenant.md)
- AMH Principle 5.4: "Identidade Centralizada, Posse Distribuída"
- AUSTA Schema: `prisma/schema.prisma` — modelo User (linhas 57-130)
- LGPD Art. 11: Dados sensíveis de saúde exigem consentimento explícito
- LGPD Art. 46: Medidas de segurança técnicas e administrativas para dados pessoais
