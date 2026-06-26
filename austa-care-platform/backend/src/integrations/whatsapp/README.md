# Z-API WhatsApp Integration

> **IMPORTANTE:** O AUSTA Care utiliza **Z-API (z-api.io)** como provider de WhatsApp, **NÃO** a Meta Business API (Cloud API).  
> A Z-API é uma ponte não-oficial que conecta números de WhatsApp pessoais/business via WhatsApp Web, oferecendo uma API REST simples.

## Visão Geral

A Z-API permite enviar e receber mensagens do WhatsApp usando um número conectado via QR Code (WhatsApp Web).  
Diferente da Meta Cloud API (que exige Business Verification e templates pré-aprovados), a Z-API oferece:

- ✅ Envio de mensagens de texto, imagens, documentos, áudio, vídeo
- ✅ Mensagens interativas (botões e listas)
- ✅ Webhook para recebimento de mensagens
- ✅ Gerenciamento de contatos e chats
- ✅ Rate limiting integrado
- ✅ Retry automático com exponential backoff

**Limitações importantes:**
- ❌ Requer que o número esteja online (WhatsApp Web conectado)
- ❌ Sujeito a bloqueios do WhatsApp (uso de número pessoal para automação)
- ❌ Não é oficialmente sancionada pelo Meta — use com cautela em produção
- ❌ Rate limits mais restritivos que a API oficial

## Setup da Conta Z-API

### 1. Criar Conta

Acesse [https://app.z-api.io](https://app.z-api.io) e crie uma conta.

### 2. Criar Instância

1. No dashboard, clique em **"Nova Instância"**
2. Escolha um nome (ex: `austa-care-prod`)
3. Selecione o plano adequado ao seu volume de mensagens

### 3. Conectar WhatsApp

1. Na instância criada, clique em **"Conectar"**
2. Um QR Code será exibido
3. Abra o WhatsApp no seu celular → **Configurações** → **WhatsApp Web** → **Escanear QR Code**
4. Após escanear, o status mudará para **"Conectado"**

### 4. Obter Credenciais

No dashboard da instância, copie:
- **Instance ID** (ex: `3C990F24A4BC8A6F27B4C6D8E1A5F7B2`)
- **Token** (ex: `F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6`)
- **Webhook Secret** (opcional — para validação de assinatura de webhooks)

## Configuração de Variáveis de Ambiente

Adicione ao `.env` do backend:

```bash
# WhatsApp Provider (z-api)
WHATSAPP_PROVIDER=z-api

# Z-API Configuration
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=3C990F24A4BC8A6F27B4C6D8E1A5F7B2
ZAPI_TOKEN=F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6

# Z-API Webhook
ZAPI_WEBHOOK_SECRET=your-webhook-secret
ZAPI_WEBHOOK_VERIFY_TOKEN=austa-webhook-verify-token-2024

# Z-API Rate Limits & Retry
ZAPI_RATE_LIMIT_REQUESTS=20
ZAPI_RATE_LIMIT_WINDOW_MS=60000
ZAPI_RETRY_ATTEMPTS=3
ZAPI_RETRY_DELAY_MS=1000
```

## Configuração do Webhook

### 1. Configurar URL de Webhook no Z-API

No dashboard da instância, configure o webhook:
- **URL:** `https://seu-dominio.com/api/webhooks/whatsapp`
- **Eventos:** Marcar `messages` (recebimento de mensagens) e `status` (status de envio)

### 2. Endpoint de Verificação

A Z-API envia uma requisição `GET` para verificar o webhook. O endpoint deve responder com o token:

```typescript
// src/controllers/webhook.controller.ts
export async function verifyWebhook(req: Request, res: Response) {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;

  if (mode === 'subscribe' && token === config.zapi.webhookVerifyToken) {
    logger.info('Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook verification failed');
  return res.sendStatus(403);
}
```

### 3. Processamento de Mensagens Recebidas

```typescript
// src/controllers/webhook.controller.ts
export async function handleIncomingMessage(req: Request, res: Response) {
  const payload = req.body;

  // Verificar assinatura do webhook
  const signature = req.headers['x-webhook-signature'];
  if (config.zapi.webhookSecret && signature !== config.zapi.webhookSecret) {
    return res.sendStatus(403);
  }

  // Processar mensagem
  if (payload.type === 'message' && payload.message) {
    const { phone, message } = payload.message;

    // Verificar idempotência: evitar processar mensagem duplicada
    const isDuplicate = await prisma.message.findFirst({
      where: { whatsappMessageId: payload.message.id }
    });

    if (isDuplicate) {
      logger.warn('Duplicate message received, skipping', { messageId: payload.message.id });
      return res.sendStatus(200);
    }

    // Processar com AI
    const aiResponse = await whatsappAIIntegration.processIncomingMessage({
      phone,
      message: message.text || message.caption || '',
      senderName: payload.message.senderName,
      timestamp: new Date(payload.message.timestamp)
    });

    // Enviar resposta
    await whatsappService.sendTextMessage({
      phone,
      message: aiResponse.message
    });

    // Persistir no banco
    await prisma.message.create({
      data: {
        id: payload.message.id, // ID do Z-API como UUID local
        whatsappMessageId: payload.message.id, // ID original para idempotência
        conversationId: conversation.id,
        userId: user.id,
        content: message.text || message.caption || '',
        contentType: 'TEXT',
        direction: 'INBOUND',
        status: 'DELIVERED',
      }
    });
  }

  return res.sendStatus(200);
}
```

## Uso do WhatsAppService

### Enviar Mensagem de Texto

```typescript
import { whatsappService } from '@/services/whatsapp.service';

const response = await whatsappService.sendTextMessage({
  phone: '11999999999',  // Com ou sem código do país
  message: 'Olá! Como você está se sentindo hoje?',
  delayMessage: 0,  // Delay em ms (opcional)
});

console.log('Message ID:', response.messageId);
console.log('Status:', response.status);
```

### Enviar Imagem

```typescript
await whatsappService.sendImageMessage({
  phone: '11999999999',
  image: 'https://exemplo.com/exame.jpg',  // URL pública
  caption: 'Seu resultado de exame',       // Opcional
});
```

### Enviar Documento

```typescript
await whatsappService.sendDocumentMessage({
  phone: '11999999999',
  document: 'https://exemplo.com/prescricao.pdf',
  fileName: 'Prescricao_Medica.pdf',
  caption: 'Sua receita médica',
});
```

### Enviar Mensagem Interativa (Botões)

```typescript
await whatsappService.sendButtonMessage({
  phone: '11999999999',
  message: 'Como você está se sentindo hoje?',
  buttonText: 'Selecionar',
  buttons: [
    { id: 'btn_bem', text: 'Muito Bem' },
    { id: 'btn_regular', text: 'Regular' },
    { id: 'btn_mal', text: 'Mal' },
  ],
  footer: 'Avaliação de Saúde',
});
```

### Enviar Lista de Opções

```typescript
await whatsappService.sendListMessage({
  phone: '11999999999',
  message: 'Selecione uma opção:',
  buttonText: 'Ver Opções',
  sections: [
    {
      title: 'Consultas',
      rows: [
        { id: 'opt_agendar', title: 'Agendar Consulta', description: 'Agende sua próxima consulta' },
        { id: 'opt_ver', title: 'Ver Consultas', description: 'Veja consultas agendadas' },
      ],
    },
    {
      title: 'Exames',
      rows: [
        { id: 'opt_resultados', title: 'Resultados', description: 'Ver resultados de exames' },
      ],
    },
  ],
  footer: 'Menu Principal',
});
```

## Idempotência de Mensagens

Para evitar processamento duplicado de mensagens (ex: webhook reenviado), o sistema implementa idempotência:

1. **No modelo Message do Prisma**, o campo `whatsappMessageId` armazena o ID original da Z-API
2. **Antes de processar**, o sistema verifica se já existe uma mensagem com o mesmo `whatsappMessageId`
3. **Se duplicada**, loga um warning e retorna 200 (sem reprocessar)

```typescript
// Verificação de idempotência no webhook handler
const existingMessage = await prisma.message.findUnique({
  where: { whatsappMessageId: zapiMessageId }
});

if (existingMessage) {
  return res.status(200).json({ status: 'duplicate', message: 'Already processed' });
}
```

## Retry com Exponential Backoff

O WhatsAppService implementa retry automático com backoff exponencial:

| Tentativa | Delay       | Comportamento                           |
|-----------|-------------|-----------------------------------------|
| 1         | 0ms         | Envio imediato                          |
| 2         | 1000ms      | Primeiro retry                          |
| 3         | 2000ms      | Segundo retry (backoff: 2x)             |
| 4+        | 30000ms cap | Retrys adicionais até maxAttempts       |

**Regras de retry:**
- ✅ Erros de rede/timeout → retry
- ✅ Rate limiting (429) → retry após `Retry-After`
- ✅ Erros de servidor (5xx) → retry
- ❌ Erros de cliente (4xx exceto 429) → NÃO retry

Além disso, mensagens que falham são colocadas em uma **fila de retry** (`MessageQueue`) que tenta reenviar com backoff configurável.

## Status da Instância

```typescript
const status = await whatsappService.getInstanceStatus();
console.log('Connected:', status.connected);
console.log('Phone:', status.phone);
console.log('State:', status.state); // CONNECTED | DISCONNECTED | QRCODE
```

Se a instância estiver desconectada, gere um novo QR Code:

```typescript
const qrCode = await whatsappService.getQRCode();
// Enviar qrCode.qrcode (base64) ou qrCode.urlCode para o frontend
```

## Troubleshooting

### "Instance not connected"
- Verifique se o WhatsApp no celular está online
- Regenere o QR Code e escaneie novamente
- Se o celular ficar offline por muito tempo, a Z-API pode desconectar

### "Rate limit exceeded"
- Aguarde o tempo indicado no header `Retry-After`
- Ajuste `ZAPI_RATE_LIMIT_REQUESTS` no `.env`
- Considere upgrade de plano na Z-API

### "Message not delivered"
- Destinatário pode não ter WhatsApp
- Número bloqueou a conta
- Formato do número incorreto (use DDI + DDD + número)

### "Webhook not receiving messages"
- Verifique se a URL do webhook está acessível publicamente
- Confirme que o endpoint responde 200 rapidamente
- Verifique os logs da Z-API no dashboard

## Diferenças: Z-API vs Meta Cloud API

| Característica           | Z-API (z-api.io)              | Meta Cloud API                  |
|--------------------------|-------------------------------|---------------------------------|
| **Tipo**                 | Não-oficial (WhatsApp Web)    | Oficial (Meta/Facebook)         |
| **Setup**                | QR Code, 5 minutos            | Business Verification, semanas  |
| **Custo**                | ~R$50-200/mês (plano Z-API)   | Por conversa (Meta pricing)     |
| **Mensagens proativas**  | Sem restrições de template    | Templates pré-aprovados apenas  |
| **Estabilidade**         | Depende do WhatsApp Web       | Infraestrutura oficial Meta     |
| **LGPD/Compliance**      | ❌ Zona cinzenta              | ✅ Oficial, auditável           |
| **Recomendado para**     | MVP, testes, baixo volume     | Produção em escala, compliance  |

> **Nota:** Para produção em escala com exigências de compliance (LGPD, ANS), considere migrar para a Meta Cloud API.
> A Z-API é adequada para MVPs, testes e cenários de baixo volume (< 1000 mensagens/dia).

## Arquitetura da Integração

```
┌──────────────────────────────────────────────────────────┐
│                      AUSTA Care Platform                  │
│                                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │ Webhook     │───▶│ WhatsApp AI  │───▶│ WhatsApp    │  │
│  │ Controller  │    │ Integration  │    │ Service     │  │
│  └─────────────┘    └──────────────┘    └──────┬──────┘  │
│                                                 │        │
│  ┌──────────────────────────┐                   │        │
│  │       Prisma DB          │                   │        │
│  │  ┌────────┐ ┌─────────┐  │                   │        │
│  │  │Message │ │Conversa-│  │                   │        │
│  │  │(idem-  │ │tion     │  │                   │        │
│  │  │potence)│ │         │  │                   │        │
│  │  └────────┘ └─────────┘  │                   │        │
│  └──────────────────────────┘                   │        │
│                                                  │        │
│  ┌──────────────────────────────────────┐        │        │
│  │           lib/retry.ts               │◀───────┘        │
│  │  Exponential backoff + jitter        │                 │
│  └──────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    Z-API (z-api.io)     │
              │  REST API Gateway       │
              └───────────┬─────────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │    WhatsApp Web         │
              │  (Celular conectado)    │
              └─────────────────────────┘
```

## Referências

- [Documentação Z-API](https://z-api.io/docs/)
- [Z-API Dashboard](https://app.z-api.io)
- [Z-API Endpoints (Swagger)](https://z-api.io/api-reference)
