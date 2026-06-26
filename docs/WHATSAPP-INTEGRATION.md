# WhatsApp Integration — AUSTA Care Platform

> **Provider:** [Z-API](https://z-api.io) — API REST não-oficial baseada em WhatsApp Web  
> **Provider NÃO utilizado:** Meta WhatsApp Business Cloud API  
> **Status:** Integrado com idempotência de mensagens, retry com exponential backoff, e conexão ao Prisma

## Sumário

1. [Por que Z-API e não Meta?](#por-que-zapi-e-nao-meta)
2. [Setup da Conta Z-API](#setup-da-conta-zapi)
3. [Variáveis de Ambiente](#variaveis-de-ambiente)
4. [Configuração de Webhook](#configuracao-de-webhook)
5. [Arquitetura da Integração](#arquitetura-da-integracao)
6. [Idempotência de Mensagens](#idempotencia-de-mensagens)
7. [Retry com Exponential Backoff](#retry-com-exponential-backoff)
8. [Serviços Integrados](#servicos-integrados)
9. [Exemplos de Uso](#exemplos-de-uso)
10. [Troubleshooting](#troubleshooting)
11. [Migração Futura para Meta Cloud API](#migracao-futura-para-meta-cloud-api)

---

## Por que Z-API e não Meta?

A AUSTA Care utiliza **Z-API (z-api.io)** em vez da Meta Business Cloud API pelos seguintes motivos:

| Fator | Z-API | Meta Cloud API |
|---|---|---|
| **Tempo de setup** | ~5 minutos (QR Code) | Semanas (Business Verification) |
| **Custo** | R$50-200/mês (plano fixo) | Por conversa (escala) |
| **Restrições de mensagem** | Sem restrições de template | Templates pré-aprovados (24h window para proativas) |
| **Estabilidade** | Depende do WhatsApp Web | Infraestrutura oficial Meta |
| **LGPD/Compliance** | Zona cinzenta (não-oficial) | Oficial, auditável |

**Para MVP e validação:** Z-API é adequada.  
**Para produção em escala com compliance (LGPD/ANS):** Considere migrar para Meta Cloud API.

---

## Setup da Conta Z-API

### 1. Criar Conta
Acesse [https://app.z-api.io](https://app.z-api.io) e crie sua conta.

### 2. Criar Instância
- Clique em **"Nova Instância"**
- Dê um nome (ex: `austa-care-prod`)
- Escolha o plano conforme volume previsto

### 3. Conectar WhatsApp
- Clique em **"Conectar"** na instância
- Escaneie o QR Code com seu WhatsApp (Configurações → WhatsApp Web)
- O status deve mudar para "Conectado"

### 4. Obter Credenciais
Copie do dashboard:
- **Instance ID** — identificador único da instância
- **Token** — token de autenticação da API
- **Webhook Secret** (opcional) — para validação de assinatura de webhooks

---

## Variáveis de Ambiente

Adicione ao `.env` do backend:

```bash
# WhatsApp Provider (EXPLÍCITO: usamos z-api, não Meta)
WHATSAPP_PROVIDER=z-api

# Z-API Configuration
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=3C990F24A4BC8A6F27B4C6D8E1A5F7B2
ZAPI_TOKEN=F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6

# Z-API Webhook
ZAPI_WEBHOOK_SECRET=your_webhook_secret
ZAPI_WEBHOOK_VERIFY_TOKEN=your_verify_token

# Z-API Rate Limits & Retry
ZAPI_RATE_LIMIT_REQUESTS=20
ZAPI_RATE_LIMIT_WINDOW_MS=60000
ZAPI_RETRY_ATTEMPTS=3
ZAPI_RETRY_DELAY_MS=1000
```

**Validação no código:** `src/config/config.ts` — schema Zod valida todas as variáveis.

---

## Configuração de Webhook

### URL do Webhook
Configure no dashboard da Z-API:
```
https://seu-dominio.com/api/webhooks/whatsapp
```

### Fluxo de Verificação (handshake)
1. Z-API envia `GET` com `hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y`
2. Backend verifica o token contra `ZAPI_WEBHOOK_VERIFY_TOKEN`
3. Se válido, responde com o `challenge` (HTTP 200)
4. Z-API confirma o webhook

### Processamento de Mensagens Recebidas
1. Z-API envia `POST` com payload JSON
2. Backend verifica assinatura (header `x-webhook-signature`) contra `ZAPI_WEBHOOK_SECRET`
3. **Idempotência:** verifica se `whatsappMessageId` já existe no banco
4. Processa via `WhatsAppAIIntegration` (NLP + persona + missão)
5. Envia resposta via `WhatsAppService.sendTextMessage()`
6. Persiste mensagem no Prisma (`Message` model)

---

## Arquitetura da Integração

```
┌──────────────────────────────────────────────────────────────┐
│                    AUSTA Care Platform Backend                │
│                                                              │
│  ┌─────────────────┐    ┌──────────────────┐                 │
│  │ Webhook         │───▶│ WhatsApp AI      │                 │
│  │ Controller      │    │ Integration      │                 │
│  │ (verificação +  │    │ (NLP + persona   │                 │
│  │  idempotência)  │    │  + missão)       │                 │
│  └─────────────────┘    └────────┬─────────┘                 │
│                                   │                          │
│  ┌──────────────────────────────┐ │   ┌───────────────────┐  │
│  │        Prisma DB             │ │   │  WhatsAppService  │  │
│  │  ┌──────────┐ ┌───────────┐  │ │   │  (Z-API Client)   │  │
│  │  │ Message  │ │Conversa-  │  │ │   │  - sendText       │  │
│  │  │ (whats-  │ │tion       │  │ │   │  - sendImage      │  │
│  │  │ appMsgId)│ │           │  │ │   │  - sendButton     │  │
│  │  └──────────┘ └───────────┘  │ │   │  - sendTemplate   │  │
│  │  ┌──────────┐ ┌───────────┐  │ │   │  - retry+backoff  │  │
│  │  │ Mission  │ │HealthPts  │  │ │   │  - messageQueue   │  │
│  │  └──────────┘ └───────────┘  │ │   └────────┬──────────┘  │
│  │  ┌──────────┐ ┌───────────┐  │ │            │             │
│  │  │PointTx   │ │Onboarding │  │ │   ┌────────┴──────────┐  │
│  │  │          │ │Progress   │  │ │   │  lib/retry.ts     │  │
│  │  └──────────┘ └───────────┘  │ │   │  (shared backoff) │  │
│  └──────────────────────────────┘ │   └───────────────────┘  │
│                                   │                          │
│  ┌────────────────────────────────┴────────────────────────┐ │
│  │            NotificationService (multi-canal)             │ │
│  │  WhatsApp ◀── SMS ◀── Email ◀── System (in-app)        │ │
│  │  (via WhatsAppService)                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    Z-API (z-api.io)     │
              │  REST API Gateway       │
              │  POST /send-text        │
              │  POST /send-image       │
              │  POST /send-template    │
              │  Webhook → AUSTA        │
              └───────────┬─────────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │    WhatsApp Web         │
              │  (Celular conectado)    │
              └─────────────────────────┘
```

---

## Idempotência de Mensagens

### Problema
Webhooks podem ser reenviados pela Z-API (timeout, rede, retry), causando processamento duplicado.

### Solução
O modelo `Message` no Prisma tem um campo `whatsappMessageId` (único) que armazena o ID original da Z-API.

### Implementação

**Schema Prisma:**
```prisma
model Message {
  whatsappMessageId  String?  @unique   // ID original da Z-API
  // ...
}
```

**Verificação no webhook handler:**
```typescript
const isDuplicate = await prisma.message.findUnique({
  where: { whatsappMessageId: payload.message.id }
});

if (isDuplicate) {
  logger.warn('Mensagem duplicada detectada, ignorando', {
    messageId: payload.message.id
  });
  return res.sendStatus(200); // ACK sem reprocessar
}
```

**Garantia adicional no banco:**
- `@unique` no campo `whatsappMessageId` previne INSERT duplicado
- Em caso de race condition, use `upsert` ou `INSERT ... ON CONFLICT DO NOTHING`

---

## Retry com Exponential Backoff

### Library compartilhada: `src/lib/retry.ts`

Todos os serviços (WhatsApp, notificações, gamificação) usam a mesma função `retryWithBackoff()`.

### Estratégia de Backoff

| Tentativa | Delay (base) | Com jitter (±25%) |
|-----------|-------------|-------------------|
| 1         | 0ms         | 0ms               |
| 2         | 1.000ms     | 750–1.250ms       |
| 3         | 2.000ms     | 1.500–2.500ms     |
| 4         | 4.000ms     | 3.000–5.000ms     |
| 5+        | cap 30.000ms| cap ±7.500ms      |

**Regras de retry automático:**
- ✅ Erros de rede / timeout → retry
- ✅ Rate limiting (HTTP 429) → retry após `Retry-After`
- ✅ Erros de servidor (5xx) → retry
- ❌ Erros de cliente (4xx exceto 429) → NÃO retry (problema na requisição)

**Jitter:** Variação aleatória de ±25% previne *thundering herd* em múltiplos clientes.

### Uso no WhatsAppService

```typescript
private async executeWithRetry<T>(
  operation: () => Promise<AxiosResponse<ZAPIResponse<T>>>,
  attempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await this.waitForRateLimit();
      const response = await operation();
      return response.data.value;
    } catch (error) {
      if (!shouldRetry(error)) throw error;
      const delay = delayMs * Math.pow(2, attempt - 1);
      await this.delay(delay);
    }
  }
  throw lastError;
}
```

### Fila de Retry (MessageQueue)

Além do retry imediato, o `WhatsAppService` mantém uma fila em memória para mensagens que falharam:
- Mensagens com status `pending` são reenviadas com backoff
- Após `maxAttempts` falhas, status muda para `failed`
- Métricas disponíveis via `getQueueStats()`

---

## Serviços Integrados

### 1. WhatsAppService (`src/services/whatsapp.service.ts`)
- **Provider:** Z-API (z-api.io)
- Cliente HTTP axios configurado com base URL, Instance ID e Token
- Suporta todos os tipos de mensagem Z-API
- Rate limiting integrado (headers `X-RateLimit-*`)
- Retry com exponential backoff
- Message queue para falhas persistentes

### 2. WhatsAppAIIntegration (`src/services/whatsappAIIntegration.ts`)
- Processamento de mensagens com NLP (intenção, sentimento, entidades)
- Personas (Ana/Zeca) baseadas em perfil do usuário
- Integração com MissionService e AdaptiveMissionEngine
- Detecção de emergência e escalação para time humano
- Conexão com ConversationFlowEngine para fluxo conversacional

### 3. NotificationService (`src/services/notificationService.ts`)
- Multi-canal: WhatsApp (via WhatsAppService), SMS, Email, System
- Templates para autorizações (aprovada, negada, revisão, escalação)
- Retry com exponential backoff por canal
- Conexão com Prisma para persistência

### 4. MissionService (`src/services/missionService.ts`)
- 5 missões de onboarding progressivas
- HealthPoints calculados e persistidos via Prisma (`PointTransaction`)
- Conexão com `Mission`, `HealthPoints`, `OnboardingProgress` models
- Badges e recompensas

### 5. AdaptiveMissionEngine (`src/services/adaptiveMissionEngine.ts`)
- Motor adaptativo de missões com complexidade dinâmica
- Personalização por perfil, engajamento e risco
- Pontuação adaptativa com multiplicadores de qualidade

### 6. AdaptiveGamificationSystem (`src/services/engagement/gamification/`)
- Sistema de gamificação com achievements, níveis e desafios
- Conectado ao Prisma via UserProgress/Achievement/Challenge models

---

## Exemplos de Uso

### Enviar Mensagem de Texto

```typescript
import { whatsappService } from '@/services/whatsapp.service';

const response = await whatsappService.sendTextMessage({
  phone: '11999999999',
  message: 'Olá! Como você está se sentindo hoje?',
});
// response.messageId, response.status
```

### Enviar Mensagem com Botões

```typescript
await whatsappService.sendButtonMessage({
  phone: '11999999999',
  message: 'Como você está hoje?',
  buttonText: 'Responder',
  buttons: [
    { id: 'bem', text: 'Muito Bem 😊' },
    { id: 'regular', text: 'Regular 😐' },
    { id: 'mal', text: 'Mal 😞' },
  ],
});
```

### Processar Resposta com AI

```typescript
import { whatsappAIIntegration } from '@/services/whatsappAIIntegration';

const aiResponse = await whatsappAIIntegration.processIncomingMessage({
  phone: '5511999999999',
  message: 'Estou com dor de cabeça há 3 dias',
  senderName: 'João',
});

// aiResponse.message — resposta personalizada com persona
// aiResponse.shouldEscalate — true se detectada emergência
// aiResponse.missionCompleted — true se missão foi completada
// aiResponse.reward — { healthPoints, badge } se ganhou recompensa
```

### Enviar Notificação Multi-canal

```typescript
import { notificationService } from '@/services/notificationService';

await notificationService.sendNotification({
  authorizationId: 'auth-123',
  type: 'approval',
  recipients: ['patient', 'provider'],
  metadata: {
    procedureName: 'Consulta Cardiológica',
    authorizationNumber: 'AUTH-2025-001',
  },
});
```

---

## Troubleshooting

### "Instance not connected" ou "QR Code expirado"
1. Verifique se o WhatsApp no celular está online
2. No dashboard Z-API, clique em "Desconectar" e depois "Conectar" novamente
3. Escaneie o novo QR Code

### "Rate limit exceeded" (HTTP 429)
1. O WhatsAppService aguarda automaticamente o `Retry-After`
2. Se persistente, reduza volume ou faça upgrade do plano Z-API
3. Ajuste `ZAPI_RATE_LIMIT_REQUESTS` no `.env`

### Mensagem não entregue
- Verifique formato do número: `55` + DDD + número (ex: `5511999999999`)
- Destinatário pode ter bloqueado o número
- O WhatsApp pode ter banido a conta (uso indevido do Web)

### Webhook não recebe mensagens
- URL do webhook deve ser acessível publicamente (não localhost)
- Verifique se o endpoint responde em < 5 segundos
- Confirme os tokens no `.env` batem com o dashboard Z-API
- Veja logs da Z-API: Dashboard → Instância → Logs de Webhook

### Mensagem duplicada sendo processada
- O sistema tem idempotência via `whatsappMessageId`
- Se ainda ocorrer, verifique se o campo `@unique` está aplicado no banco
- Rode `npx prisma migrate dev` para aplicar a migration

---

## Migração Futura para Meta Cloud API

Quando o volume de mensagens justificar e compliance (LGPD/ANS) for mandatório:

1. **Setup Meta Business Account**
   - Criar conta em [business.facebook.com](https://business.facebook.com)
   - Completar Business Verification
   - Criar WhatsApp Business App

2. **Migrar env vars**
   ```bash
   WHATSAPP_PROVIDER=meta
   WHATSAPP_PHONE_NUMBER_ID=...
   WHATSAPP_BUSINESS_ACCOUNT_ID=...
   WHATSAPP_ACCESS_TOKEN=...
   ```

3. **Implementar WhatsApp Business Client**
   - Usar a lib oficial `@whapi/cloud-api` ou axios direto
   - Adaptar `WhatsAppService` para suportar ambos providers via interface

4. **Migrar templates**
   - Criar templates no Meta Business Manager
   - Aguardar aprovação (24-48h)
   - Atualizar `sendTemplateMessage()` para usar Meta format

5. **Manter Z-API como fallback**
   - Modo híbrido: `WHATSAPP_PROVIDER=z-api` ou `meta`
   - Switch dinâmico baseado em env var
   - Ambos implementando a mesma interface `IWhatsAppProvider`
