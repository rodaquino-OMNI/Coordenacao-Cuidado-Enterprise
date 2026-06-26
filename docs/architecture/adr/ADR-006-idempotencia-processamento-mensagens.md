# ADR-006: Idempotência para Processamento de Mensagens WhatsApp/FHIR/Tasy

**Status:** Accepted
**Date:** 2026-06-26
**Deciders:** Parreira (Orquestrador DevOps)

## Context

A plataforma AUSTA processa mensagens de três canais de entrada como fontes primárias de dados clínicos:

| Canal | Provedor | Tipo de Mensagem | Volume Estimado |
|-------|----------|-----------------|-----------------|
| **WhatsApp** | Z-API (z-api.io) | Mensagens de texto, imagem, áudio, documento | 1000+/dia |
| **FHIR Gateway** | HAPI FHIR (planejado) | Resources FHIR (Patient, Observation, QuestionnaireResponse) | Variável |
| **Tasy ERP** | Philips Tasy | Dados de paciente, autorizações, agendamentos | Síncrono |

**Problema:** O processamento atual de mensagens WhatsApp (`whatsapp.service.ts`, 837 linhas) não implementa garantia de idempotência. O webhook da Z-API pode entregar a mesma mensagem múltiplas vezes devido a:

- Retries da Z-API (timeout no webhook)
- Replay de eventos após falha de processamento
- Partições de rede que causam duplicação no message broker

Mensagens duplicadas podem causar:
- **Risco ao paciente:** Duas autorizações de emergência para o mesmo evento
- **Inconsistência de dados:** Duas entradas de `HealthData` para a mesma medição
- **Experiência ruim:** Paciente recebe resposta duplicada do assistente virtual
- **Problemas de auditoria:** Contagem incorreta de interações para relatórios ANS

O código atual tem proteção parcial:
- `whatsappMessageId` é único no schema (`@unique` no Prisma) — previne INSERT duplicado
- **Mas não previne** processamento duplicado da lógica de negócio (escore de risco, resposta automática) antes da constraint de banco

## Decision

Implementar **idempotency keys** para todo processamento de mensagens inbound, usando o padrão "at-most-once processing" com `INSERT ON CONFLICT DO NOTHING` no PostgreSQL.

### Estratégia por Canal

#### 1. WhatsApp (Z-API)
```typescript
// Idempotency key: whatsappMessageId (já único no schema)
// Abordagem: INSERT ON CONFLICT + processamento condicional
const existing = await db.whatsAppMessage.findUnique({
  where: { messageId: webhookMessage.id }
});
if (existing) {
  logger.info(`Duplicate message ${webhookMessage.id}, skipping processing`);
  return { status: 'duplicate', originalStatus: existing.status };
}
// Process message...
```

#### 2. FHIR (planejado)
```typescript
// Idempotency key: FHIR Bundle.id ou MessageHeader.id
// Abordagem: Tabela de idempotência dedicada
await db.fhirProcessingLog.create({
  data: {
    fhirMessageId: bundle.id,
    resourceType: bundle.resourceType,
    status: 'PROCESSING',
  }
});
// Se duplicado, ON CONFLICT retorna erro → responder 200 OK (reconhecimento, sem reprocessar)
```

#### 3. Tasy ERP (integração)
```typescript
// Idempotency key: integrationReferenceId do Tasy
// Abordagem: INSERT ON CONFLICT DO NOTHING
await db.$executeRaw`
  INSERT INTO tasy_integration_log (reference_id, status, received_at)
  VALUES (${tasyRefId}, 'PROCESSING', NOW())
  ON CONFLICT (reference_id) DO NOTHING
`;
```

### Tabela de Idempotência Centralizada (opcional, Fase 2+)

Para Fase 1, usar constraints existentes. Para Fase 2+, criar tabela dedicada:

```sql
CREATE TABLE idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,     -- 'whatsapp', 'fhir', 'tasy'
  status VARCHAR(50) NOT NULL,      -- 'PROCESSING', 'COMPLETED', 'FAILED'
  response JSONB,                   -- resposta original (para replay)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);
```

### Regras de Implementação

1. **Todo webhook handler** deve verificar idempotency antes de processar
2. **Resposta ao gateway:** Se mensagem já processada, retornar `200 OK` com status `duplicate` (não retornar erro — o gateway reenviaria)
3. **Idempotency window:** 30 dias (mensagens reenviadas após 30 dias são tratadas como novas)
4. **Atomicidade:** Verificação de idempotência e início de processamento devem ser atômicos (usar transação PostgreSQL)

## Alternatives Considered

### Cache de deduplicação em Redis (application-level)
Rejeitado — risco de race condition. Dois workers podem verificar Redis simultaneamente, ambos encontrarem "não processado", e ambos processarem. PostgreSQL UNIQUE constraint é atômica.

### Sem idempotência — "a Z-API garante entrega única"
Rejeitado — a Z-API documenta retries com backoff exponencial. Garantia de "exactly-once delivery" é impossível em sistemas distribuídos (Two Generals Problem). Dados clínicos duplicados são risco à segurança do paciente.

### Kafka exactly-once semantics
Rejeitado para Fase 1 — Kafka não está em uso para processamento de mensagens (está configurado mas não é o backbone de eventos). Adicionar Kafka apenas para idempotência seria overengineering.

## Consequences

### Positivas
- Segurança do paciente: zero processamento duplicado de mensagens clínicas
- Integridade de dados: impossível criar dois registros `HealthData` para a mesma medição
- Experiência do paciente: sem respostas duplicadas do assistente virtual
- Conformidade: trilha de auditoria limpa para relatórios ANS

### Negativas
- Latência adicional: ~2ms por verificação de idempotência (query em índice único)
- Storage adicional: registros de idempotência crescem linearmente com volume de mensagens (~100 bytes/mensagem)
- Complexidade de implementação: cada novo canal de entrada precisa implementar o padrão

## Trade-offs

- **Latência vs. Segurança:** 2ms adicionais por mensagem é negligenciável comparado ao risco de processamento duplicado de dados clínicos.
- **Complexidade agora vs. Correção depois:** Implementar idempotência desde o início é mais barato que corrigir dados duplicados em produção.
- **Idempotency window de 30 dias:** Balanceia storage (limpeza automática) com tolerância a retries de longa duração.

## Implementation Plan

1. Adicionar verificação de idempotência em `whatsapp.service.ts` → `processIncomingMessage()`
2. Criar migration para tabela `idempotency_keys` (Fase 2)
3. Adicionar testes de unidade: simular mensagem duplicada e verificar que processamento ocorre apenas uma vez
4. Adicionar métrica `austa_idempotency_duplicates_total` (Prometheus counter) para monitorar taxa de duplicação
5. Documentar padrão no playbook para novos desenvolvedores

## References

- Two Generals Problem: https://en.wikipedia.org/wiki/Two_Generals%27_Problem
- PostgreSQL `INSERT ON CONFLICT`: https://www.postgresql.org/docs/15/sql-insert.html#SQL-ON-CONFLICT
- Z-API Webhook Documentation: https://developer.z-api.io/en/webhooks
- `whatsapp.service.ts` (837 linhas): evidência de ausência de verificação de idempotência
- `schema.prisma`: campo `messageId` com `@unique` (proteção parcial)
