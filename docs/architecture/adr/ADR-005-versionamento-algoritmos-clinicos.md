# ADR-005: Versionamento de Algoritmos Clínicos (algorithm-registry.ts)

**Status:** Accepted
**Date:** 2026-06-26
**Deciders:** Parreira (Orquestrador DevOps)

## Context

A plataforma AUSTA implementa algoritmos clínicos que produzem escores e classificações com impacto direto na saúde do paciente:

| Serviço | Arquivo | Linhas | Função Clínica |
|---------|---------|--------|----------------|
| `risk-assessment.service.ts` | `backend/src/services/` | 1564 | Escore de risco cardiovascular, diabetes, saúde mental, respiratório |
| `emergency-detection.service.ts` | `backend/src/services/` | 579 | Detecção de emergência com classificação de severidade |
| `advanced-risk-assessment.service.ts` | `backend/src/services/` | ~800 | Escore de risco avançado com múltiplos fatores |
| `temporal-risk-tracking.service.ts` | `backend/src/services/` | ~400 | Tracking temporal de evolução de risco |

**Nenhum desses algoritmos possui versionamento.** Toda pontuação clínica gerada é armazenada sem referência a qual versão do algoritmo a produziu.

Isso viola invariantes fundamentais de healthcare:
- **Rastreabilidade clínica:** Todo escore deve ser reprodutível (CFM Resolução 2.147/2017)
- **Auditabilidade:** Em caso de erro ou viés, é necessário identificar exatamente qual algoritmo gerou cada resultado
- **Melhoria contínua:** Sem versionamento, é impossível comparar performance entre versões de algoritmo (A/B testing clínico)
- **Defesa regulatória:** ANVISA exige rastreabilidade de versões de software médico (RDC 657/2022, Anexo I)

## Decision

Criar um **Algorithm Registry** (`algorithm-registry.ts`) que mapeia cada algoritmo clínico a uma versão imutável, e adicionar `algorithm_version` a toda entidade de escore clínico.

### Estrutura do Registry

```typescript
// algorithm-registry.ts
export interface AlgorithmVersion {
  name: string;           // ex: "cardiovascular-risk-v2"
  version: string;        // ex: "2.1.3"
  gitCommit: string;      // SHA do commit que introduziu esta versão
  releasedAt: Date;       // data de ativação em produção
  description: string;    // mudanças em relação à versão anterior
  reviewedBy: string;     // profissional clínico que revisou
}

export const algorithmRegistry: Record<string, AlgorithmVersion> = {
  "cardiovascular-risk": {
    name: "cardiovascular-risk",
    version: "1.0.0",
    gitCommit: "abc123def456",
    releasedAt: new Date("2026-06-26"),
    description: "Initial version: Framingham score + LDL/HDL ratio",
    reviewedBy: "Dr. [Nome] — CRM/XX 12345",
  },
  // ... outros algoritmos
};
```

### Campos a adicionar nas entidades

| Entidade | Novo Campo | Tipo |
|----------|-----------|------|
| `HealthData` | `algorithmVersion` | String (ex: "cardiovascular-risk@1.0.0") |
| `VitalSign` | `algorithmVersion` | String |
| `QuestionnaireResponse` | `algorithmVersion` | String |
| `RiskAssessment` | `algorithmVersion` | String |
| `EmergencyDetection` | `algorithmVersion` | String |

### Regras de versionamento

1. **Semver-like:** MAJOR.MINOR.PATCH (ex: `1.2.3`)
   - MAJOR: mudança no modelo estatístico ou lógica de escore (requer revalidação clínica)
   - MINOR: ajuste de thresholds ou pesos (requer code review clínico)
   - PATCH: bug fix ou otimização sem alteração de lógica
2. **Code review obrigatório** por profissional de saúde para qualquer mudança MAJOR ou MINOR
3. **Git tag** correspondente a cada versão registrada
4. **Campo `algorithmVersion` NUNCA é atualizado retroativamente** — registros existentes mantêm a versão com que foram gerados

## Alternatives Considered

### Versionamento baseado apenas em timestamp
Rejeitado — não identifica qual lógica de algoritmo foi usada. Dois algoritmos diferentes poderiam ser deployados no mesmo dia.

### Git tags apenas (sem registro no banco)
Rejeitado — necessário rastreabilidade em nível de banco para auditoria. Auditores não têm acesso ao repositório Git.

### Não versionar — "o algoritmo atual é o correto"
Rejeitado — viola requisitos regulatórios e de segurança do paciente. Em caso de erro, é impossível determinar quais pacientes foram afetados.

## Consequences

### Positivas
- Audit readiness: cada escore é rastreável ao código exato que o produziu
- Reprodutibilidade clínica: possível recalcular escores históricos com a versão original
- Conformidade regulatória (ANVISA RDC 657, CFM 2.147)
- Segurança do paciente: rollback preciso em caso de viés ou erro

### Negativas
- Overhead de storage: ~50 bytes adicionais por registro de escore
- Complexidade de gerenciamento de versões (registry + git tags + code review)
- Custo de revalidação clínica para mudanças MAJOR

## Trade-offs

- **Storage vs. Segurança clínica:** 50 bytes/registro × milhões de registros = overhead de ~50MB/milhão. Negligenciável comparado ao risco de não rastreabilidade.
- **Velocidade de iteração vs. Rigor clínico:** Code review clínico obrigatório para mudanças MAJOR/MINOR reduz velocidade de deploy, mas é não-negociável para segurança do paciente.

## Implementation Plan

1. Criar `backend/src/services/algorithm-registry.ts` com registro inicial de todos os algoritmos atuais (versão `1.0.0`)
2. Adicionar migration Prisma: `algorithmVersion VARCHAR(100)` em `HealthData`, `VitalSign`, `QuestionnaireResponse`, `RiskAssessment`
3. Modificar serviços para injetar `algorithmVersion` em toda criação de escore
4. Criar endpoint `GET /api/v1/admin/algorithms` para auditoria
5. Documentar processo de code review clínico no playbook de desenvolvimento

## References

- CFM Resolução 2.147/2017: https://sistemas.cfm.org.br/normas/visualizar/resolucoes/BR/2017/2147
- ANVISA RDC 657/2022, Anexo I — Requisitos de segurança e eficácia para SaMD
- `risk-assessment.service.ts` (1564 linhas): evidência de algoritmos sem versionamento
- `emergency-detection.service.ts` (579 linhas): evidência de algoritmos sem versionamento
