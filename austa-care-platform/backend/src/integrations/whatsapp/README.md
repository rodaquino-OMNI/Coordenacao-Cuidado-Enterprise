# WhatsApp Business Cloud API Client

Production-ready WhatsApp Business Cloud API integration using Meta's official Cloud API.

## Features

- ✅ Send text messages
- ✅ Send template messages (pre-approved templates)
- ✅ Send media (images, documents, audio, video)
- ✅ Interactive messages (buttons and lists)
- ✅ Webhook handling and verification
- ✅ Message status tracking
- ✅ Media upload/download
- ✅ Automatic retry with exponential backoff
- ✅ Comprehensive error handling
- ✅ Event publishing for all operations

## Setup

### 1. Get WhatsApp Business API Credentials

1. Create a Meta Business Account at https://business.facebook.com
2. Set up WhatsApp Business API
3. Get your credentials:
   - Phone Number ID
   - Business Account ID
   - Access Token
   - Webhook Verify Token

### 2. Configure Environment Variables

Add to `.env`:

```bash
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret
WHATSAPP_API_VERSION=v18.0
```

### 3. Initialize Client

```typescript
import { getWhatsAppClient } from './integrations/whatsapp/whatsapp-business.client';

const whatsappClient = getWhatsAppClient({
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
  apiVersion: 'v18.0',
});
```

## Usage Examples

### Send Text Message

```typescript
const response = await whatsappClient.sendText(
  '5511999999999',
  'Olá! Bem-vindo ao AUSTA Care.'
);
```

### Send Template Message

```typescript
const response = await whatsappClient.sendTemplate(
  '5511999999999',
  'appointment_reminder',
  'pt_BR',
  [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'João Silva' },
        { type: 'text', text: '15/11/2025 às 14:00' },
      ],
    },
  ]
);
```

### Send Interactive Buttons

```typescript
const response = await whatsappClient.sendInteractiveButtons(
  '5511999999999',
  'Como você está se sentindo hoje?',
  [
    { id: 'btn_1', title: 'Muito Bem' },
    { id: 'btn_2', title: 'Bem' },
    { id: 'btn_3', title: 'Mal' },
  ],
  'Avaliação de Saúde',
  'Responda para continuarmos'
);
```

### Send Interactive List

```typescript
const response = await whatsappClient.sendInteractiveList(
  '5511999999999',
  'Selecione uma opção:',
  'Ver Opções',
  [
    {
      title: 'Consultas',
      rows: [
        { id: 'opt_1', title: 'Agendar Consulta', description: 'Agende uma nova consulta' },
        { id: 'opt_2', title: 'Ver Consultas', description: 'Consultas agendadas' },
      ],
    },
    {
      title: 'Exames',
      rows: [
        { id: 'opt_3', title: 'Resultados', description: 'Ver resultados de exames' },
      ],
    },
  ],
  'Menu Principal'
);
```

### Send Image

```typescript
const response = await whatsappClient.sendImage(
  '5511999999999',
  'https://example.com/image.jpg',
  'Seu resultado de exame'
);
```

### Send Document

```typescript
const response = await whatsappClient.sendDocument(
  '5511999999999',
  'https://example.com/prescription.pdf',
  'Receita_Médica.pdf',
  'Sua receita médica'
);
```

## Webhook Handling

### Setup Webhook Endpoint

```typescript
import express from 'express';

const app = express();

// Webhook verification (GET)
app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const result = whatsappClient.verifyWebhook(mode, token, challenge);

  if (result) {
    res.status(200).send(result);
  } else {
    res.sendStatus(403);
  }
});

// Webhook events (POST)
app.post('/webhooks/whatsapp', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);

  // Verify signature
  if (!whatsappClient.verifyWebhookSignature(payload, signature)) {
    return res.sendStatus(403);
  }

  // Process webhook
  await whatsappClient.processWebhook(req.body);

  res.sendStatus(200);
});
```

## Event Publishing

The client publishes the following events via Kafka:

- `whatsapp.message.sent` - Message sent successfully
- `whatsapp.message.failed` - Message failed to send
- `whatsapp.message.received` - Incoming message received
- `whatsapp.message.status` - Message status update (delivered, read, etc.)

Subscribe to these events for processing:

```typescript
// Example: Handle incoming messages
kafkaConsumer.on('whatsapp.message.received', async (event) => {
  const { message, from } = event.data;

  if (message.type === 'text') {
    console.log(`Received from ${from}: ${message.text.body}`);
  }
});
```

## Error Handling

The client includes comprehensive error handling:

- Automatic retry with exponential backoff (default: 3 attempts)
- Rate limit detection and logging
- Detailed error information including Facebook trace IDs
- Graceful degradation

```typescript
try {
  await whatsappClient.sendText('5511999999999', 'Hello');
} catch (error) {
  console.error('Failed to send message:', error.message);
  console.error('Error code:', error.code);
  console.error('FB Trace ID:', error.fbtrace_id);
}
```

## Media Handling

### Upload Media

```typescript
const mediaBuffer = fs.readFileSync('./image.jpg');
const mediaId = await whatsappClient.uploadMedia(mediaBuffer, 'image/jpeg');

// Use media ID in message
await whatsappClient.sendMessage({
  messaging_product: 'whatsapp',
  to: '5511999999999',
  type: 'image',
  image: { id: mediaId },
});
```

### Download Media

```typescript
const mediaBuffer = await whatsappClient.downloadMedia('media_id_here');
fs.writeFileSync('./downloaded.jpg', mediaBuffer);
```

## Template Message Guidelines

1. All templates must be pre-approved by Meta
2. Template names use lowercase and underscores (e.g., `appointment_reminder`)
3. Maximum 3 buttons per message
4. Button text limited to 20 characters
5. Support for dynamic parameters in body and header

## Best Practices

1. **Rate Limits**: Meta enforces rate limits - the client logs these automatically
2. **Message Templates**: Use templates for proactive messaging (24h window rule)
3. **Interactive Messages**: Use for better user engagement
4. **Webhook Security**: Always verify webhook signatures
5. **Error Handling**: Implement proper retry logic for failed messages
6. **Media Storage**: Store media URLs for at least 30 days

## Testing

```bash
npm test -- whatsapp
```

## Resources

- [WhatsApp Business Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
