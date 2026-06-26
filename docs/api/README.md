# AUSTA Care Platform — API Reference

## Visualizar a Especificação

### Opção 1: Swagger Editor (Online)

1. Acesse [editor.swagger.io](https://editor.swagger.io)
2. Cole o conteúdo de `docs/api/openapi.yaml` no editor
3. A UI interativa renderiza automaticamente

### Opção 2: Swagger UI (Local)

```bash
# Usando Docker
docker run -p 8080:8080 \
  -v $(pwd)/docs/api/openapi.yaml:/openapi.yaml \
  -e SWAGGER_JSON=/openapi.yaml \
  swaggerapi/swagger-ui

# Acessar: http://localhost:8080
```

### Opção 3: VS Code Extension

Instale a extensão **OpenAPI (Swagger) Editor** e abra `openapi.yaml`.

## Gerar Clientes a partir do Spec

### TypeScript/JavaScript (Node.js)

```bash
# openapi-generator-cli
npx @openapitools/openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g typescript-axios \
  -o ./generated/api-client

# Ou com npx openapi-typescript (recomendado para fetch nativo)
npx openapi-typescript docs/api/openapi.yaml -o ./generated/api-types.ts
```

### Python

```bash
pip install openapi-generator-cli

openapi-generator generate \
  -i docs/api/openapi.yaml \
  -g python \
  -o ./generated/python-client
```

### Kotlin / Java / Go / Swift

Consulte [OpenAPI Generator](https://openapi-generator.tech/docs/generators) para a lista completa.

## Validar o Spec

```bash
# Docker (sem instalar nada)
docker run --rm -v $(pwd)/docs/api:/spec:ro \
  openapitools/openapi-generator-cli validate \
  -i /spec/openapi.yaml

# Ou com swagger-cli
npx @apidevtools/swagger-cli validate docs/api/openapi.yaml
```

## Estrutura

```
docs/api/
├── openapi.yaml     ← Especificação OpenAPI 3.0
└── README.md        ← Este arquivo
```

## Autenticação

Todos os endpoints protegidos usam **Bearer JWT**:

```
Authorization: Bearer eyJhbGc...
```

Tokens são obtidos via `POST /api/v1/auth/login` ou `POST /api/v1/auth/register`.

## Tags

| Tag             | Descrição                              |
|----------------|----------------------------------------|
| Health         | Health checks e probes (não autenticados) |
| Auth           | Login, registro, refresh, sessão       |
| Users          | CRUD de usuários (admin/self)          |
| Authorizations | Fluxo de autorizações ANS              |
| Risk Assessment| Avaliação de risco médico              |
| Gamification   | Badges, pontos, leaderboard            |
| WhatsApp       | Webhooks e envio de mensagens          |

## Erros

Formato padrão de erro:

```json
{
  "error": "Mensagem descritiva",
  "success": false,
  "timestamp": "2025-06-26T10:30:00.000Z",
  "path": "/api/v1/users",
  "method": "GET"
}
```

Códigos HTTP:
- `400` — Dados inválidos
- `401` — Token ausente, inválido ou expirado
- `403` — Permissão insuficiente
- `404` — Recurso não encontrado
- `429` — Rate limit excedido
- `500` — Erro interno
- `503` — Serviço indisponível
