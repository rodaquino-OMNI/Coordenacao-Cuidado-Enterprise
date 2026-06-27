# ADR-010: AUSTA Herda Stack de Observabilidade da AMH (AMP + Managed Grafana)

**Status:** Accepted
**Date:** 2026-06-27
**Deciders:** Parreira (Orquestrador DevOps), AMH Principal Architect

## Context

A plataforma AUSTA Care Platform atualmente opera sua própria stack de observabilidade em containers Docker locais: Prometheus (métricas), Grafana (dashboards), e Jaeger (tracing distribuído). Esta stack é adequada para desenvolvimento local, mas não é production-grade e duplica infraestrutura de observabilidade que a AMH já provê como plataforma gerenciada.

### Estado atual:
- **Prometheus:** Container `prom/prometheus:latest` em `docker-compose.infrastructure.yml` (porta 9090), com pushgateway (porta 9091)
- **Grafana:** Container `grafana/grafana:latest` (porta 3000) com 2 dashboards provisionados: `system-health.json`, `api-performance.json`
- **Jaeger:** Container `jaegertracing/all-in-one:latest` (portas 5775, 6831, 6832, 5778, 16686, 14250, 14268, 14269, 9411) — 10 portas expostas
- **Métricas AUSTA:** `prom-client` npm package no backend — métricas expostas em `/metrics` (formato Prometheus)
- **Alerta:** Zero integração com PagerDuty ou SNS — alertas são apenas logs locais
- **Tracing:** Zero instrumentação de tracing distribuído no código AUSTA (apesar do Jaeger running). Sem propagação de `trace_id`.
- **Logs:** Winston structured logger com output para console — sem agregação centralizada

### Por que isso é um problema:
- **Stack não-gerenciada:** Prometheus + Grafana + Jaeger self-hosted exigem operação (patching, backup, scaling, troubleshooting) — sobrecarga para um time de aplicação
- **Duplicação de infraestrutura:** AMH já opera Amazon Managed Prometheus (AMP) + Amazon Managed Grafana (AMG) + AWS X-Ray + CloudWatch Logs (ADR-011 AMH) como stack corporativa
- **Sem correlação de sinais:** Sem `trace_id` propagado entre AUSTA e AMH, é impossível debugar um incidente que atravessa sistemas (ex: WhatsApp webhook → AUSTA → MPI lookup → HAPI FHIR)
- **Visão fragmentada:** SREs precisam alternar entre Grafana local da AUSTA e Grafana gerenciado da AMH para entender saúde do ecossistema completo
- **Princípio AMH 5.7:** "Observabilidade Não-Negociável" — e a stack corporativa é AMP + AMG + X-Ray

## Decision

**AUSTA adota a stack de observabilidade da AMH: Amazon Managed Prometheus (AMP) + Amazon Managed Grafana (AMG) + AWS X-Ray + CloudWatch Logs.** AUSTA instrumenta sua aplicação com OpenTelemetry SDK (substituindo `prom-client`) e exporta telemetria via OTLP para o OTEL Collector da AMH. AUSTA dashboards são provisionados no workspace AMG existente. Containers locais de Prometheus, Grafana e Jaeger são removidos.

### Arquitetura de Observabilidade Integrada

```
AUSTA Backend (Express/Node.js)
    │
    │ @opentelemetry/sdk-node
    │ @opentelemetry/exporter-otlp-grpc
    │ @opentelemetry/instrumentation-http
    │ @opentelemetry/instrumentation-express
    │ @opentelemetry/instrumentation-pg
    │ @opentelemetry/instrumentation-redis
    │
    ├──▶ OTLP gRPC (métricas + traces) → OTEL Collector AMH (ECS Fargate)
    │         │
    │         ├──▶ AMP (métricas) — remote write
    │         ├──▶ AWS X-Ray (traces) — service map + trace details
    │         └──▶ CloudWatch Logs (com trace_id correlation)
    │
    └──▶ Winston → CloudWatch Logs (via OTEL log exporter ou CloudWatch agent)
              │
              └──▶ Log groups: /amh/austa/backend, /amh/austa/fhir-publisher
```

### Métricas AUSTA (exportadas para AMP)

| Métrica | Tipo | Labels | Descrição |
|---------|------|--------|-----------|
| `austa_http_requests_total` | Counter | `method`, `route`, `status_code` | Total de requisições HTTP |
| `austa_http_request_duration_seconds` | Histogram | `method`, `route` | Duração de requisições (P50, P95, P99) |
| `austa_whatsapp_messages_total` | Counter | `direction` (inbound/outbound), `type` | Mensagens WhatsApp processadas |
| `austa_conversations_active` | Gauge | — | Conversas ativas no momento |
| `austa_risk_assessments_total` | Counter | `algorithm`, `algorithm_version` | Escores de risco gerados |
| `austa_emergency_detections_total` | Counter | `severity` | Emergências detectadas |
| `austa_mpi_lookup_duration_seconds` | Histogram | `match_method` | Latência de lookup MPI |
| `austa_fhir_publish_duration_seconds` | Histogram | `resource_type`, `status_code` | Latência de publicação FHIR |
| `austa_fhir_publish_total` | Counter | `resource_type`, `status` (success/failure) | Publicações FHIR |
| `austa_gamification_points_awarded_total` | Counter | `mission_id`, `source_type` | HealthPoints concedidos |
| `austa_authorization_requests_total` | Counter | `status` | Autorizações processadas |
| `austa_db_query_duration_seconds` | Histogram | `operation` (SELECT/INSERT/UPDATE/DELETE), `model` | Latência de queries PostgreSQL |

### Dashboards AUSTA no AMG

4 dashboards provisionados como código (JSON) no repositório IaC do AMH:

1. **AUSTA Care Coordination Overview**
   - Widgets: Active patients (gauge), conversations by status (pie), risk score distribution (histogram), emergency detections (time-series), WhatsApp message volume (time-series)

2. **AUSTA Clinical Scores**
   - Widgets: Risk assessments by algorithm version (time-series), P95 latency by algorithm (stat), score distribution by risk level (heatmap), emergency detection rate (stat + sparkline)

3. **AUSTA WhatsApp Engagement**
   - Widgets: Message volume inbound/outbound (time-series), response time P50/P95 (stat), active conversations (gauge), onboarding completion funnel (bar), conversation sentiment trend (time-series)

4. **AUSTA Integration Health**
   - Widgets: MPI lookup latency P95 (time-series + stat), MPI lookup error rate (time-series), FHIR publish latency P95 (time-series), FHIR publish error rate (time-series), CDC lag (time-series), circuit breaker status (state timeline)

### Instrumentação com OpenTelemetry (Substituição do prom-client)

```typescript
// Antes (ADR-010 pre-migration):
import client from 'prom-client';
const riskAssessmentsCounter = new client.Counter({
  name: 'austa_risk_assessments_total',
  help: 'Total clinical risk assessments performed',
  labelNames: ['algorithm', 'algorithm_version'],
});

// Depois (ADR-010):
import { metrics } from '@opentelemetry/api';
const meter = metrics.getMeter('austa-care-platform');
const riskAssessmentsCounter = meter.createCounter('austa_risk_assessments_total', {
  description: 'Total clinical risk assessments performed',
});
// Uso:
riskAssessmentsCounter.add(1, {
  algorithm: 'cardiovascular-risk',
  algorithm_version: '1.0.0',
});
```

### Propagação de Trace Context

AUSTA propaga `traceparent` header (W3C Trace Context) em todas as chamadas HTTP para serviços AMH:

```
WhatsApp Webhook → AUSTA Backend
    trace_id: 4bf92f3577b34da6a3ce929d0e0e4736
    span_id: 00f067aa0ba902b7
        │
        ├──▶ MPI Lookup (POST /mpi/v1/lookup)
        │       header: traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
        │       → trace contínuo no X-Ray: AUSTA → MPI → PostgreSQL MPI
        │
        └──▶ FHIR Publish (POST /fhir/Observation)
                header: traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-abc123def456-01
                → trace contínuo: AUSTA → HAPI FHIR → Aurora HAPI → Kafka fhir.*
```

### Alerta Integrado

Alertas AUSTA configurados no AMP Alert Manager → SNS → PagerDuty:

| Alerta | Condição | Severidade | Runbook |
|--------|---------|-----------|---------|
| `AustaHighErrorRate` | `rate(austa_http_requests_total{status_code=~"5.."}[5m]) > 0.05` | P2 | RB-AUSTA-001 |
| `AustaMPILookupLatencyHigh` | `histogram_quantile(0.95, austa_mpi_lookup_duration_seconds) > 1.0` | P3 | RB-AUSTA-002 |
| `AustaFHIRPublishFailing` | `rate(austa_fhir_publish_total{status="failure"}[5m]) > 0.01` | P2 | RB-AUSTA-003 |
| `AustaEmergencyDetectSpike` | `rate(austa_emergency_detections_total[5m]) > 10` | P2 | RB-AUSTA-004 |
| `AustaCircuitBreakerOpen` | `austa_circuit_breaker_state == 1` | P1 (se MPI ou FHIR) | RB-AUSTA-005 |
| `AustaDeadMansSwitchStale` | Sem atividade por > 5 minutos | P1 | RB-AUSTA-006 |

## Alternatives Considered

### Manter stack própria (Prometheus + Grafana + Jaeger self-hosted)
Rejeitado — duplica infraestrutura e esforço operacional. Time AUSTA não tem SREs dedicados para operar stack de observabilidade. AMH já provê stack gerenciada (AMP + AMG) como serviço corporativo.

### Usar apenas CloudWatch nativo (sem AMP/AMG)
Rejeitado — CloudWatch métricas são limitadas em dashboards e recording rules. AMP + AMG provê dashboards Grafana-quality e alerting integrado com PagerDuty que CloudWatch sozinho não oferece.

### Datadog ou outro vendor SaaS
Rejeitado — custo (~US$ 15/host/mês) e dados de telemetria (que podem conter contexto clínico) saindo da VPC para vendor externo. AMP + AMG é gerenciado pela AWS dentro da conta AMH.

### Continuar com `prom-client` e exportar para AMP via remote write
Considerado como ponte temporária. `prom-client` pode exportar métricas no formato Prometheus que o OTEL Collector pode scrape e forward para AMP. Mas OpenTelemetry é o standard corporativo AMH (ADR-011) — migrar para OTEL SDK alinha AUSTA com o resto da plataforma.

## Consequences

### Positivas
- **Zero operação de stack de observabilidade:** AMP e AMG são gerenciados pela AWS — sem patching, backup, scaling manual
- **Dashboards como código:** Provisionados via Grafana provisioning (JSON) no repositório IaC — versionados, revisados, automatizados
- **Correlação de sinais:** `trace_id` propagado entre AUSTA e serviços AMH → debugging cross-system em segundos
- **Alerta profissional:** SNS → PagerDuty com runbook links — mesmo pipeline de alerta do resto da plataforma AMH
- **Custo previsível:** AMP + AMG + X-Ray estimado ~US$ 100-200/mês adicionais (AUSTA é baixo volume comparado ao resto da AMH)

### Negativas
- **Migração de instrumentação:** Substituir `prom-client` por OpenTelemetry SDK exige refactor de todos os pontos de métrica (~30-40 counter/histogram/gauge calls)
- **Dependência de conectividade:** Se OTEL Collector da AMH estiver indisponível, telemetria da AUSTA é perdida (mitigável com OTEL Collector sidecar local)
- **Curva de aprendizado:** OpenTelemetry SDK para Node.js é menos maduro que `prom-client` — time AUSTA precisa aprender nova API

### Neutras
- Containers Prometheus + Grafana + Jaeger são removidos do `docker-compose.infrastructure.yml` — simplifica ambiente de desenvolvimento
- Para desenvolvimento local, AUSTA pode usar um OTEL Collector sidecar que exporta para console/stdout (debugging) sem depender da infra AMH

## Trade-offs

- **OpenTelemetry vs. prom-client:** OTEL é standard aberto e corporativo, mas menos maduro em Node.js. Migrar agora (quando AUSTA tem ~30-40 métricas) é mais barato que migrar depois (quando terá centenas).
- **Stack gerenciada vs. Controle total:** AMP/AMG são gerenciados (menos controle, menos operação). Self-hosted (mais controle, mais operação). Para time de aplicação sem SREs, gerenciado é a escolha correta.

## Implementation Plan

1. **Phase 1:** Instalar OpenTelemetry SDK packages: `@opentelemetry/sdk-node`, `@opentelemetry/exporter-otlp-grpc`, instrumentations (http, express, pg, redis, ioredis)
2. **Phase 2:** Criar `tracing.ts` — configuração do OTEL SDK com OTLP exporter apontando para OTEL Collector AMH
3. **Phase 3:** Migrar métricas de `prom-client` para OTEL: counter → `meter.createCounter()`, histogram → `meter.createHistogram()`, gauge → `meter.createObservableGauge()`
4. **Phase 4:** Adicionar propagação de `traceparent` em chamadas HTTP para MPI, HAPI FHIR, e Tasy (usar `@opentelemetry/instrumentation-http` que faz propagação automática)
5. **Phase 5:** Provisionar 4 dashboards AUSTA no AMG via IaC (JSON provisioning)
6. **Phase 6:** Configurar alertas no AMP Alert Manager → SNS → PagerDuty
7. **Phase 7:** Remover containers Prometheus, Grafana, Jaeger do `docker-compose.infrastructure.yml`

## Validation

- [ ] 100% das métricas críticas (WhatsApp, Clinical, FHIR, MPI) visíveis no AMP (verificar via Grafana Explore)
- [ ] `trace_id` propagado em todas as chamadas AUSTA → AMH (verificar no X-Ray service map)
- [ ] 4 dashboards AUSTA renderizando no AMG com dados live
- [ ] Alerta de teste: simular `AustaFHIRPublishFailing` → PagerDuty notificado em < 1 minuto
- [ ] `AustaDeadMansSwitchStale` funcional: parar AUSTA → alerta P1 em 5 minutos
- [ ] Latência de telemetria < 5 segundos (AUSTA → OTEL Collector → AMP/AMG visível)

## References

- AMH ADR-011: [OpenTelemetry + AMP + AMG como Observability Stack](../../amh-data-platform/architecture/adrs/ADR-011-opentelemetry-amp-grafana-observabilidade.md)
- AMH Principle 5.7: "Observabilidade Não-Negociável"
- OpenTelemetry JavaScript SDK: https://opentelemetry.io/docs/languages/js/
- W3C Trace Context: https://www.w3.org/TR/trace-context/
- Amazon Managed Prometheus: https://docs.aws.amazon.com/prometheus/latest/userguide/
- Amazon Managed Grafana: https://docs.aws.amazon.com/grafana/latest/userguide/
- AUSTA `docker-compose.infrastructure.yml`: containers Prometheus, Grafana, Jaeger (a serem removidos)
