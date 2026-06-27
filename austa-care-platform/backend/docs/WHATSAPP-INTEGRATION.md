# WhatsApp Integration — AUSTA Care Platform

## Current Provider: Z-API (z-api.io)

**Status**: ✅ Active in development

The current WhatsApp integration uses **Z-API** (https://z-api.io), a third-party WhatsApp API provider that bridges the gap between the platform and the WhatsApp network. Z-API provides a RESTful API for sending/receiving messages, managing instances, and handling webhooks.

## Target Provider for Production: Meta WhatsApp Business API

**Status**: 🔮 Planned

The long-term target is the **Meta WhatsApp Business API** (formerly WhatsApp Business Platform). Z-API is used as a convenient development proxy while we work toward direct Meta API integration for production environments.

## Environment Variables

The following environment variables control the WhatsApp integration:

| Variable | Required | Default | Description |
|---|---|---|---|
| `WHATSAPP_PROVIDER` | No | `z-api` | Provider selection (`z-api` only currently) |
| `ZAPI_BASE_URL` | No | `https://api.z-api.io` | Z-API base URL |
| `ZAPI_INSTANCE_ID` | **Yes** | — | Your Z-API instance ID |
| `ZAPI_TOKEN` | **Yes** | — | Your Z-API authentication token |
| `ZAPI_WEBHOOK_SECRET` | **Yes** | — | Secret for webhook payload validation |
| `ZAPI_WEBHOOK_VERIFY_TOKEN` | **Yes** | — | Token for webhook endpoint verification |
| `ZAPI_RATE_LIMIT_REQUESTS` | No | `20` | Max requests per window |
| `ZAPI_RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window in ms |
| `ZAPI_RETRY_ATTEMPTS` | No | `3` | Max retry attempts on failure |
| `ZAPI_RETRY_DELAY_MS` | No | `1000` | Delay between retries in ms |

### Example `.env` configuration:

```env
WHATSAPP_PROVIDER=z-api
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=your-instance-id-here
ZAPI_TOKEN=your-token-here
ZAPI_WEBHOOK_SECRET=your-webhook-secret
ZAPI_WEBHOOK_VERIFY_TOKEN=austa_care_verify_token
```

## Webhook Setup

### Endpoint

```
POST /api/v1/webhooks/whatsapp/webhook
```

### Verification (GET)

```
GET /api/v1/webhooks/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
```

When configuring the webhook in Z-API's dashboard, point it to:
```
https://your-domain.com/api/v1/webhooks/whatsapp/webhook
```

### Example Webhook Payload (Message Received)

```json
{
  "instanceId": "instance-123",
  "messageId": "msg_abc123",
  "phone": "5511999999999",
  "fromMe": false,
  "momment": 1689001234567,
  "status": "received",
  "chatName": "John Doe",
  "senderPhoto": "https://example.com/photo.jpg",
  "senderName": "John Doe",
  "type": "ReceivedCallback",
  "text": {
    "message": "Olá, preciso de ajuda com minha consulta"
  }
}
```

### Example Webhook Payload (Status Update)

```json
{
  "instanceId": "instance-123",
  "messageId": "msg_abc123",
  "phone": "5511999999999",
  "fromMe": true,
  "momment": 1689001235000,
  "status": "delivered",
  "chatName": "John Doe",
  "senderName": "AUSTA Care",
  "type": "DeliveryCallback"
}
```

## Message Types Supported via Z-API

| Type | Z-API Endpoint | Service Method |
|---|---|---|
| Text | `/send-text` | `sendTextMessage()` |
| Image | `/send-image` | `sendImageMessage()` |
| Document | `/send-document` | `sendDocumentMessage()` |
| Audio | `/send-audio` | `sendAudioMessage()` |
| Video | `/send-video` | `sendVideoMessage()` |
| Location | `/send-location` | `sendLocationMessage()` |
| Contact | `/send-contact` | `sendContactMessage()` |
| Button List | `/send-button-list` | `sendButtonMessage()` |
| Option List | `/send-option-list` | `sendListMessage()` |
| Template | `/send-template` | `sendTemplateMessage()` |

## Architecture

### Service Layer

- **`src/services/whatsapp.service.ts`**: Core WhatsApp service wrapping Z-API REST calls with retry logic, rate limiting, and message queue management.
- **`src/routes/whatsapp.routes.ts`**: Express routes for webhook handling, message sending, and statistics.
- **`src/types/whatsapp.ts`**: Z-API specific TypeScript type definitions.
- **`src/types/whatsapp.types.ts`**: Higher-level WhatsApp domain types (messages, conversations, sessions).

### Retry & Resilience

The WhatsApp service uses the centralized retry library (`src/lib/retry.ts`) with exponential backoff:
- Retries on server errors (5xx), network errors, and rate limits (429)
- Does NOT retry on client errors (4xx except 429)
- Configurable max attempts and delay via environment variables

### Rate Limiting

Z-API imposes rate limits. The service:
- Tracks rate limit headers from responses (`X-RateLimit-*`)
- Queues messages when rate-limited
- Supports automatic retry with backoff

### Message Queue

Outbound messages can be queued for delayed/retried delivery:
- `addToQueue()`: Enqueue a message with retry configuration
- `getQueueStats()`: View queue status
- `clearCompletedMessages()`: Clean up processed messages

## Migration Path: Z-API → Meta WhatsApp Business API

When migrating to Meta's official API:

1. **Authentication**: Switch from Z-API token to Meta's token-based auth with app ID/secret
2. **Webhooks**: Meta uses a different webhook format (`entry[].changes[].value.messages[]`)
3. **Phone Numbers**: Meta requires WhatsApp Business Account (WABA) phone number registration
4. **Templates**: Meta requires template approval via Business Manager
5. **Rate Limits**: Different limits and headers format

The `WHATSAPP_PROVIDER` environment variable and the service architecture are designed to support a provider-agnostic interface when the time comes.

## Related Files

| File | Purpose |
|---|---|
| `src/services/whatsapp.service.ts` | Core service implementation |
| `src/routes/whatsapp.routes.ts` | REST API routes |
| `src/types/whatsapp.ts` | Z-API type definitions |
| `src/types/whatsapp.types.ts` | Domain-level WhatsApp types |
| `src/config/config.ts` | Environment variable validation |
| `src/lib/retry.ts` | Retry/backoff library |
