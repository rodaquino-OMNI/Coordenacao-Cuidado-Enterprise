# ADR-008: AUSTA Emite Eventos CDC para AMH MSK para Ingestão no Lakehouse

**Status:** Accepted
**Date:** 2026-06-27
**Deciders:** Parreira (Orquestrador DevOps), AMH Principal Architect

## Context

A plataforma AUSTA Care Platform gera dados clínicos, operacionais e de engajamento valiosos através de sua operação diária: conversas WhatsApp, escores de risco clínico, eventos de gamificação, autorizações de procedimentos, e registros de auditoria. Atualmente, todos esses dados residem exclusivamente no PostgreSQL transacional da AUSTA — sem ingestão no data lakehouse da AMH Data Platform, que é o repositório analítico do grupo Americas Health.

### Estado atual:
- **Zero CDC (Change Data Capture):** Nenhum mecanismo de captura de mudanças do PostgreSQL para streaming
- **Eventos in-process:** `EventEmitter` do Node.js para comunicação interna entre módulos do monolith — não publica eventos para sistemas externos
- **BullMQ (Redis):** Usado para filas assíncronas (jobs), não para streaming de dados
- **Kafka configurado mas não usado:** `docker-compose.infrastructure.yml` inclui Confluent Kafka 7.5.0, `kafkajs` instalado no `package.json` — zero código produtivo usando Kafka
- **Sem event backbone:** AUSTA não tem como publicar eventos de negócio para consumo por outros sistemas do grupo

### Por que isso é um problema:
- **Dados isolados:** Ricos dados de coordenação de cuidado (conversas, escores clínicos, engajamento) ficam presos no PostgreSQL operacional — invisíveis para analytics, BI, e agentes IA da AMH
- **Visão 360 incompleta:** A plataforma AMH consolida dados de Tasy (ERP), OMNI (App), e Diagnose (LIS) via CDC — AUSTA é o elo faltante na jornada do paciente
- **Duplicação de analytics:** Se AUSTA construir seus próprios dashboards analíticos diretamente sobre PostgreSQL, duplica infraestrutura analítica que a AMH já provê via Iceberg/Athena
- **Princípio AMH 5.5:** "Streaming-First para Dados Clínicos" — eventos clínicos não esperam batch. AUSTA gerando dados clínicos (risk scores, emergency detections) deve publicá-los em streaming

## Decision

**AUSTA PostgreSQL é instrumentado com Debezium CDC (Change Data Capture) que publica mudanças em tópicos MSK Serverless da AMH.** Os eventos são ingeridos pela pipeline Flink → Iceberg Bronze da AMH, seguindo o mesmo padrão CDC já estabelecido para outros tenants (ADR-025, ADR-029 do AMH). AUSTA não opera Kafka — apenas publica via Debezium connector gerenciado pela AMH.

### Arquitetura CDC

```
AUSTA PostgreSQL 15 (sa-east-1 VPC)
    │
    │ logical replication slot: debezium_austa_clinicas
    │ WAL (Write-Ahead Log) streaming
    ▼
Debezium Connector (ECS Fargate, tenant austa_clinicas)
    │
    │ Avro serialization (Glue Schema Registry)
    │ Topic prefix: amh.austa_clinicas.cdc.
    ▼
MSK Serverless Cluster (sa-east-1)
    │
    ▼
Flink (Managed Service for Apache Flink)
    │
    │ Validation, enrichment, mpi_id resolution
    ▼
Iceberg Bronze Tables (S3: amh-lake-bronze/tenant=austa_clinicas/)
```

### Tópicos MSK e Mapeamento de Tabelas

| Tópico MSK | Tabela AUSTA (PostgreSQL) | Tipo de Dado | Frequência |
|-----------|--------------------------|-------------|------------|
| `amh.austa_clinicas.cdc.users` | `users` | Dados cadastrais, onboarding, mpi_id | On change |
| `amh.austa_clinicas.cdc.conversations` | `conversations` | Conversas WhatsApp (início, fim, status) | ~100/dia |
| `amh.austa_clinicas.cdc.messages` | `messages` | Mensagens WhatsApp individuais | ~1000+/dia |
| `amh.austa_clinicas.cdc.health_data` | `health_data` | Condições, medicamentos, alergias, sintomas | On assessment |
| `amh.austa_clinicas.cdc.clinical_scores` | `health_data` (filtered: WHERE riskScore IS NOT NULL) | Escores de risco, emergency detections | On calculation |
| `amh.austa_clinicas.cdc.vital_signs` | `vital_signs` | Sinais vitais reportados | On measurement |
| `amh.austa_clinicas.cdc.health_points` | `health_points` | Saldo e progresso de pontos | On change |
| `amh.austa_clinicas.cdc.point_transactions` | `point_transactions` | Transações de HealthPoints | On transaction |
| `amh.austa_clinicas.cdc.onboarding_progress` | `onboarding_progress` | Progresso em missões de onboarding | On progress |
| `amh.austa_clinicas.cdc.authorizations` | `authorizations` | Autorizações de procedimentos | On status change |
| `amh.austa_clinicas.cdc.audit_logs` | `audit_logs` | Trilha de auditoria da aplicação | On audit event |

### Configuração do Debezium

```json
{
  "name": "austa_clinicas-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "austa-postgres.internal",
    "database.port": "5432",
    "database.user": "debezium_cdc_user",
    "database.password": "${secrets:austa/debezium-password}",
    "database.dbname": "austa_care",
    "database.server.name": "amh.austa_clinicas.cdc",
    "table.include.list": "public.users,public.conversations,public.messages,public.health_data,public.vital_signs,public.health_points,public.point_transactions,public.onboarding_progress,public.authorizations,public.audit_logs",
    "plugin.name": "pgoutput",
    "slot.name": "debezium_austa_clinicas",
    "publication.autocreate.mode": "filtered",
    "key.converter": "io.confluent.connect.avro.AvroConverter",
    "value.converter": "io.confluent.connect.avro.AvroConverter",
    "key.converter.schema.registry.url": "https://glue-schema-registry.amh.internal",
    "value.converter.schema.registry.url": "https://glue-schema-registry.amh.internal",
    "transforms": "Reroute",
    "transforms.Reroute.type": "io.debezium.transforms.ByLogicalTableRouter",
    "transforms.Reroute.topic.regex": "amh.austa_clinicas.cdc.(.*)",
    "transforms.Reroute.topic.replacement": "amh.austa_clinicas.cdc.$1",
    "topic.creation.default.replication.factor": 3,
    "topic.creation.default.partitions": 6,
    "topic.creation.default.cleanup.policy": "compact"
  }
}
```

### Transformações CDC no Flink

O Flink job `austa-cdc-to-bronze` (AMH) aplica as seguintes transformações:

1. **Deserialização Avro** → `austa.User`, `austa.HealthData`, etc.
2. **Validação de schema:** Rejeita registros que não conformam ao schema Avro registrado no Glue Schema Registry
3. **Enriquecimento de identidade:** Garante que `mpi_id` está presente; se ausente, consulta MPI (lookup por `cpf_hash`)
4. **Máscara de PHI:** Colunas sensíveis (cpf_hash, dados de saúde) recebem tag `sensitivity=phi` no Iceberg
5. **Deduplicação:** Remove eventos duplicados via `event_id` idempotency key
6. **Roteamento:** Escreve na tabela Iceberg Bronze correspondente: `amh_austa_clinicas_bronze.austa_conversations`, etc.
7. **DLQ:** Registros inválidos ou não-processáveis → `amh.austa_clinicas.cdc.dlq`

## Alternatives Considered

### AUSTA publica eventos diretamente via KafkaJS (aplicação → MSK)
Rejeitado — adiciona complexidade de aplicação (buffering, retry, schema management) ao monolith AUSTA. CDC via Debezium é transparente para a aplicação: AUSTA continua escrevendo no PostgreSQL normalmente; Debezium captura do WAL. Dual-write (PostgreSQL + Kafka) também é rejeitado — risco de inconsistência.

### Batch ETL noturno (pg_dump → S3 → Spark)
Rejeitado — viola princípio AMH 5.5 (streaming-first para dados clínicos). Dados de risco clínico e emergência precisam estar disponíveis para analytics em near-real-time (< 1 minuto), não overnight.

### Kafka Connect no próprio cluster AUSTA
Rejeitado — AUSTA é time pequeno (não tem SREs dedicados para operar Kafka Connect). Debezium em ECS Fargate gerenciado pelo time AMH (que já opera Debezium para outros tenants) reduz carga operacional em AUSTA.

### Apenas tópicos de aplicação (não CDC full-table)
Considerado para Phase 2. CDC full-table é mais simples inicialmente (zero mudança no código AUSTA). No futuro, eventos de domínio específicos (ex: `austa.patient.onboarding_completed`, `austa.clinical.risk_score_calculated`) podem complementar o CDC com semântica de negócio mais rica.

## Consequences

### Positivas
- **Zero mudança no código AUSTA:** Debezium captura do WAL do PostgreSQL — aplicação continua operando normalmente
- **Streaming near-real-time:** Eventos clínicos disponíveis no lakehouse em < 30 segundos (CDC lag típico de Debezium + Flink)
- **Schema gerenciado:** Avro + Glue Schema Registry garante contratos de dados versionados e validados
- **DLQ nativa:** Registros problemáticos vão para dead-letter queue, não bloqueiam a pipeline
- **Padrão AMH consistente:** AUSTA segue o mesmo padrão CDC que Tasy e outros sistemas já integrados — operação homogênea

### Negativas
- **Dependência operacional:** Debezium connector gerenciado pelo time AMH — AUSTA depende de outro time para operação do CDC
- **PostgreSQL WAL overhead:** Logical replication gera ~10-20% overhead de storage em WAL (mitigado com `wal_keep_size` apropriado)
- **Latência de schema evolution:** Mudanças no schema AUSTA exigem atualização do schema Avro no Glue Schema Registry (coordenado entre times)

### Neutras
- AUSTA não precisa instalar, configurar, ou operar Kafka — isso é responsabilidade da plataforma AMH
- AUSTA não tem acesso de leitura aos tópicos MSK (princípio de menor privilégio) — apenas produz dados via PostgreSQL

## Trade-offs

- **Simplicidade CDC vs. Eventos de Domínio:** CDC full-table é mais simples mas produz eventos de granularidade fina (row-level). Eventos de domínio (ex: `PatientOnboarded`) seriam semanticamente mais ricos mas exigem dual-write ou outbox pattern na aplicação AUSTA.
- **WAL overhead vs. Valor analítico:** 10-20% overhead de storage em WAL é custo aceitável para disponibilizar dados AUSTA no lakehouse AMH e habilitar visão 360 cross-channel.

## Implementation Plan

1. **Phase 1 (imediato):** Criar usuário `debezium_cdc_user` no PostgreSQL AUSTA com permissões de replicação. Configurar `wal_level = logical`.
2. **Phase 2:** Registrar schemas Avro para todas as tabelas AUSTA no Glue Schema Registry AMH.
3. **Phase 3:** Provisionar Debezium connector via Terraform (módulo AMH `cdc-per-tenant`).
4. **Phase 4:** Configurar Flink job `austa-cdc-to-bronze` para ingestão no Iceberg Bronze.
5. **Phase 5:** Validar pipeline: inserir registro no PostgreSQL AUSTA → verificar disponível no Iceberg Bronze via Athena em < 30s.

## Validation

- [ ] CDC lag P95 < 30 segundos (PostgreSQL commit → Iceberg Bronze disponível)
- [ ] Zero perda de dados: count(*) PostgreSQL = count(*) Iceberg Bronze (para cada tabela)
- [ ] Schemas Avro registrados no Glue Schema Registry para todas as tabelas
- [ ] DLQ vazia após 7 dias de operação estável (ou contendo apenas erros legítimos de schema)
- [ ] Debezium connector com uptime > 99.9% mensal
- [ ] PostgreSQL WAL size estável (sem crescimento não-controlado)

## References

- AMH ADR-025: [Debezium on ECS Fargate vs MSK Connect](../../amh-data-platform/architecture/adrs/ADR-025-debezium-on-ecs-fargate-vs-msk-connect.md)
- AMH ADR-029: [CDC Stack per Tenant via for_each](../../amh-data-platform/architecture/adrs/ADR-029-cdc-stack-per-tenant.md)
- AMH ADR-010: [Glue Schema Registry + DLQ Mandatory](../../amh-data-platform/architecture/adrs/ADR-010-glue-schema-registry-dlq-obrigatoria.md)
- AMH ADR-002: [MSK Serverless vs Kafka self-managed](../../amh-data-platform/architecture/adrs/ADR-002-msk-serverless-vs-kafka-self-managed.md)
- AMH Principle 5.5: "Streaming-First para Dados Clínicos"
- Debezium PostgreSQL Connector: https://debezium.io/documentation/reference/stable/connectors/postgresql.html
- AUSTA Schema: `prisma/schema.prisma` (1301 linhas, 45+ tabelas)
