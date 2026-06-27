# ADR-009: AUSTA Publica Escores Clínicos como Observações FHIR via HAPI da AMH

**Status:** Accepted
**Date:** 2026-06-27
**Deciders:** Parreira (Orquestrador DevOps), AMH Principal Architect

## Context

A AUSTA Care Platform executa algoritmos clínicos que geram escores com potencial impacto na saúde do paciente: avaliação de risco cardiovascular, diabetes, saúde mental, detecção de emergências, e tracking temporal de evolução de risco. Estes escores são armazenados no PostgreSQL da AUSTA (`HealthData.riskScore`, `HealthData.emergencyAlerts`), mas não são publicados em formato interoperável (FHIR) para consumo por outros sistemas do ecossistema Americas Health.

### Estado atual:
- **Algoritmos clínicos:** 4 algoritmos versionados (ADR-005 AUSTA): cardiovascular-risk v1.0.0, emergency-detection v1.0.0, symptom-analysis v1.0.0, population-stratification v1.0.0
- **Armazenamento:** `HealthData.riskScore` (JSONB), `HealthData.emergencyAlerts` (JSONB) — formato proprietário
- **FHIR aspiracional:** HAPI FHIR configurado em `docker-compose.infrastructure.yml` (porta 8080) mas **zero código de aplicação** que publica ou consome FHIR. `fhir` npm package v4.11 instalado mas nunca usado em código fonte.
- **Sem interoperabilidade:** Escores clínicos da AUSTA são invisíveis para o ecossistema AMH (RNDS, parceiros externos, agentes IA de gestão populacional)

### Por que isso é um problema:
- **RNDS compliance:** A Rede Nacional de Dados em Saúde (RNDS) exige interoperabilidade via FHIR R4. Escores clínicos que impactam a saúde do paciente devem estar disponíveis na RNDS.
- **Visão clínica fragmentada:** Um coordenador de cuidado usando o dashboard AMH não vê os escores de risco gerados pela AUSTA via WhatsApp — o canal clínico e o canal de coordenação estão desconectados
- **Duplicação de infraestrutura:** Operar um HAPI FHIR separado para AUSTA (mesmo que atualmente inativo) duplica custo e complexidade operacional (Aurora, ECS tasks, backup, monitoring)
- **Agentes IA cegos:** Agentes IA da AMH (Evah, Helena, Jair, Marina, Rafael, Tina) precisam de contexto clínico individual por paciente — sem FHIR, acessar escores da AUSTA exige query direta ao PostgreSQL (anti-pattern)

## Decision

**AUSTA publica escores clínicos como recursos FHIR (Observation, QuestionnaireResponse) através da API REST do HAPI FHIR da AMH.** AUSTA não opera seu próprio servidor FHIR. Toda publicação é síncrona (POST HTTP) com tolerância a falhas (retry com backoff). O HAPI FHIR da AMH (ADR-007 AMH) é o canal clínico canônico do grupo Americas Health.

### Fluxo de Publicação FHIR

```
AUSTA Clinical Algorithm (ex: risk-assessment.service.ts)
    │
    │ Gera escore (ex: Cardiovascular Risk = 72.5%)
    │
    ▼
AUSTA FHIR Publisher Service (novo: fhir-publisher.service.ts)
    │
    │ Constrói recurso FHIR Observation
    │   - subject: { reference: "Patient/mpi_abc123" }
    │   - valueQuantity: { value: 72.5, unit: "%" }
    │   - component: algorithmVersion, sub-scores
    │
    ▼
POST https://hapi.amh.internal/fhir/Observation
    Authorization: Bearer <cognito_jwt>
    X-Tenant: austa_clinicas
    Content-Type: application/fhir+json
    │
    ▼
AMH HAPI FHIR (ECS Fargate + Aurora)
    │
    │ Validação FHIR R4
    │ Armazenamento no Aurora HAPI
    │ Indexação para busca
    │
    ├──▶ Disponível para RNDS (integração nacional)
    ├──▶ Disponível para agentes IA (contexto clínico por paciente)
    ├──▶ Disponível para parceiros externos (API Gateway + WAF)
    └──▶ Maezo → Kafka fhir.* topics → Iceberg Bronze FHIR
```

### Recursos FHIR Publicados pela AUSTA

| Evento Clínico AUSTA | Recurso FHIR | Campos-Chave |
|----------------------|-------------|-------------|
| **Risk Assessment** | `Observation` | `code`: LOINC para risk score. `valueQuantity`: score + unidade. `interpretation`: LOW/HIGH/CRITICAL. `component`: sub-escores (framingham, LDL, HDL, etc.) |
| **Emergency Detection** | `Observation` | `code`: SNOMED para emergency flag. `valueCodeableConcept`: emergency type. `interpretation`: CRITICAL. `component`: trigger symptoms |
| **Vital Signs** | `Observation` (vital-signs profile) | `code`: LOINC. `valueQuantity`: valor + unidade. `effectiveDateTime`: momento da medição |
| **Symptom Report** | `Observation` | `code`: SNOMED. `valueString`: descrição do sintoma. `component`: severity, duration, context |
| **Onboarding Questionnaire** | `QuestionnaireResponse` | `questionnaire`: URL do Questionário AUSTA. `item`: respostas por pergunta. `subject`: Patient/{mpi_id} |
| **Authorization** | `Task` / `ServiceRequest` | `status`: requested/accepted/rejected. `intent`: order. `code`: procedure. `subject`: Patient/{mpi_id} |

### Exemplo: Observation para Escore de Risco Cardiovascular

```json
POST /fhir/Observation
{
  "resourceType": "Observation",
  "meta": {
    "profile": ["https://amh.americashealth.com.br/fhir/StructureDefinition/AustaRiskScore"],
    "tag": [{ "system": "https://amh.americashealth.com.br/fhir/tenant", "code": "austa_clinicas" }]
  },
  "identifier": [{
    "system": "https://austa.americashealth.com.br/fhir/healthDataId",
    "value": "cuid_a1b2c3d4"
  }],
  "basedOn": [{
    "reference": "QuestionnaireResponse/qr-austa-onboarding-{userId}"
  }],
  "status": "final",
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/observation-category",
      "code": "survey",
      "display": "Survey"
    }]
  }],
  "code": {
    "coding": [
      { "system": "http://loinc.org", "code": "88637-8", "display": "Cardiovascular disease risk score" },
      { "system": "https://austa.americashealth.com.br/fhir/CodeSystem/clinical-scores", "code": "CARDIOVASCULAR_RISK" }
    ],
    "text": "Avaliação de Risco Cardiovascular"
  },
  "subject": { "reference": "Patient/mpi_abc123def456" },
  "effectiveDateTime": "2026-06-27T10:30:00-03:00",
  "issued": "2026-06-27T10:30:01-03:00",
  "performer": [{
    "reference": "Device/austa-care-platform",
    "display": "AUSTA Care Platform - Risk Assessment Engine"
  }],
  "valueQuantity": {
    "value": 72.5,
    "unit": "%",
    "system": "http://unitsofmeasure.org",
    "code": "%"
  },
  "interpretation": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
      "code": "H",
      "display": "High"
    }],
    "text": "Risco Alto — requer intervenção em até 24h"
  }],
  "referenceRange": [
    { "low": { "value": 0, "unit": "%" }, "high": { "value": 40, "unit": "%" }, "text": "Baixo Risco" },
    { "low": { "value": 40, "unit": "%" }, "high": { "value": 70, "unit": "%" }, "text": "Risco Moderado" },
    { "low": { "value": 70, "unit": "%" }, "high": { "value": 100, "unit": "%" }, "text": "Risco Alto" }
  ],
  "component": [
    { "code": { "text": "algorithm_version" }, "valueString": "cardiovascular-risk@1.0.0" },
    { "code": { "text": "framingham_score" }, "valueQuantity": { "value": 15, "unit": "%" } },
    { "code": { "text": "ldl_hdl_ratio" }, "valueQuantity": { "value": 3.2, "unit": "ratio" } },
    { "code": { "text": "blood_pressure_factor" }, "valueQuantity": { "value": 45, "unit": "%" } }
  ]
}
```

### Estratégia de Resiliência

```typescript
// fhir-publisher.service.ts
async function publishObservation(observation: FHIRObservation): Promise<void> {
  try {
    await retryWithBackoff(
      () => hapiClient.post('/fhir/Observation', observation),
      {
        maxAttempts: 3,
        initialDelayMs: 200,
        maxDelayMs: 5000,
        shouldRetry: (err) => {
          // Retry on 5xx, 429 (rate limit), network errors
          // Do NOT retry on 4xx (validation errors)
          return err.status >= 500 || err.status === 429 || err.code === 'ECONNREFUSED';
        }
      }
    );
    metrics.fhirPublishSuccess.inc({ resourceType: 'Observation' });
  } catch (err) {
    metrics.fhirPublishFailure.inc({ resourceType: 'Observation', error: err.code });
    // Fallback: enfileirar para retry posterior (BullMQ)
    await fhirRetryQueue.add('publish-observation', { observation, attempt: 1 });
    throw err; // Não perder o erro — camada superior decide se bloqueia ou segue
  }
}
```

## Alternatives Considered

### AUSTA opera seu próprio servidor HAPI FHIR
Rejeitado — duplicação de infraestrutura (ECS tasks, Aurora cluster, backup, monitoring) para um serviço que já existe e é operado pelo time AMH. AUSTA é time de aplicação, não de plataforma. Operar HAPI FHIR adicionaria ~US$ 700/mês em custo de infra + sobrecarga operacional de um time que não tem SREs dedicados.

### AUSTA publica via Kafka (tópico FHIR) em vez de REST direto
Considerado para Phase 2. Publicar via REST diretamente no HAPI FHIR é mais simples (HTTP POST) e atende ao SLO de latência (< 200ms P95). Kafka adiciona um hop assíncrono que é valioso para desacoplamento, mas adiciona complexidade de consumidor (Flink FHIR mapper). REST direto para o caso de uso atual (1-10 publicações/segundo) é adequado.

### AUSTA gera FHIR Bundle NDJSON e exporta para S3
Rejeitado — batch-oriented, não atende ao requisito de near-real-time para escores clínicos. Um escore de emergência (CRITICAL) publicado via bundle diário chegaria com 24h de atraso — inaceitável para coordenação de cuidado.

### Publicação fire-and-forget (sem confirmação de sucesso)
Rejeitado — dados clínicos não podem ser perdidos silenciosamente. Se HAPI FHIR estiver indisponível, AUSTA deve enfileirar para retry e alertar operações.

## Consequences

### Positivas
- **Interoperabilidade real:** Escores clínicos AUSTA disponíveis em FHIR R4 para RNDS, agentes IA, parceiros externos
- **Zero infraestrutura FHIR própria:** AUSTA não opera HAPI, Aurora HAPI, ECS tasks — reduz custo e complexidade
- **Validação FHIR server-side:** HAPI FHIR valida recursos contra profiles FHIR — erros de schema detectados no publish, não no consumo
- **Canal único clínico:** Consistente com princípio AMH 5.12 ("FHIR para Clínico, Dimensional para Analytics")
- **Maezo downstream:** Publicações FHIR da AUSTA são capturadas pelo Maezo → Kafka fhir.* → Iceberg Bronze → agentes IA têm contexto atualizado

### Negativas
- **Latência de rede:** POST HTTP para HAPI FHIR adiciona ~10-50ms (VPC interna) — aceitável para publicação de escores
- **Dependência de disponibilidade:** Se HAPI FHIR estiver indisponível, AUSTA enfileira para retry mas o escore não fica imediatamente visível para consumidores FHIR
- **Mapeamento FHIR manual:** Construir recursos FHIR Observation corretos exige conhecimento de terminologias (LOINC, SNOMED) — curva de aprendizado para time AUSTA

### Neutras
- AUSTA mantém seus dados clínicos no PostgreSQL (fonte da verdade transacional) e também os publica em FHIR (canal de interoperabilidade). Não há conflito — são dois padrões de acesso diferentes (transacional vs. interoperável)
- O container HAPI FHIR no `docker-compose.infrastructure.yml` da AUSTA é removido — substituído por chamadas HTTP ao HAPI da AMH

## Trade-offs

- **Simplicidade REST vs. Desacoplamento Kafka:** REST direto é mais simples e atende ao volume atual (< 10 publicações/seg). Se o volume crescer para > 100/seg, migrar para publicação via Kafka (tópico `fhir.austa.observations`) com Flink FHIR mapper.
- **Publicação síncrona vs. Assíncrona:** Síncrona garante que o escore foi aceito pelo HAPI antes de confirmar ao usuário. Assíncrona (fila) seria mais resiliente mas introduziria eventual consistency na confirmação.

## Implementation Plan

1. **Phase 1:** Criar `fhir-publisher.service.ts` — cliente HTTP para HAPI FHIR com retry, circuit breaker, e métricas
2. **Phase 2:** Mapear escores clínicos existentes para recursos FHIR Observation (cardiovascular, diabetes, mental health, emergency)
3. **Phase 3:** Integrar publisher nos serviços clínicos: após `risk-assessment.service.ts` gerar escore → publicar Observation
4. **Phase 4:** Adicionar `QuestionnaireResponse` para onboarding completo
5. **Phase 5:** Validar recursos FHIR publicados contra profiles AMH (usando HAPI $validate operation)
6. **Phase 6:** Remover container HAPI FHIR do `docker-compose.infrastructure.yml`

## Validation

- [ ] 100% dos escores clínicos gerados resultam em recurso FHIR Observation publicado com sucesso (métrica: `fhir_publish_success_rate > 99.9%`)
- [ ] Latência de publicação P95 < 200ms (AUSTA → HAPI response)
- [ ] Recursos FHIR validados contra StructureDefinition AMH (zero erros de validação)
- [ ] `mpi_id` presente em `subject.reference` de 100% dos recursos
- [ ] Retry com backoff funcional: falha simulada do HAPI → retry com sucesso em até 3 tentativas
- [ ] Métrica `fhir_publish_failure` dispara alerta P2 se > 1% de falhas em 5 minutos
- [ ] Recursos FHIR visíveis no HAPI FHIR search em < 1 segundo após publicação

## References

- AMH ADR-007: [FHIR como Canal Lateral (HAPI + Maezo)](../../amh-data-platform/architecture/adrs/ADR-007-fhir-canal-lateral-hapi-maezo.md)
- AMH Principle 5.12: "FHIR para Clínico, Dimensional para Analytics"
- AUSTA ADR-005: [Versionamento de Algoritmos Clínicos](ADR-005-versionamento-algoritmos-clinicos.md)
- AUSTA ADR-007: [AUSTA adota AMH MPI](ADR-007-austa-adota-amh-mpi-identidade-paciente.md) — `mpi_id` como subject
- HL7 FHIR R4 Observation: https://hl7.org/fhir/R4/observation.html
- LOINC 88637-8: Cardiovascular disease risk score
- HAPI FHIR REST API: https://hapifhir.io/hapi-fhir/docs/server_plain/rest_operations.html
