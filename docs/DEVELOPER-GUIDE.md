# AUSTA Care Platform — Developer Guide

> **Última atualização**: 2025-06-26  
> **Stack**: Node.js 18+, TypeScript 5.3, Express 4, Prisma 5, PostgreSQL 15, Redis 7

---

## 1. Pré-requisitos

| Ferramenta     | Versão Mínima | Instalação                                      |
|---------------|---------------|--------------------------------------------------|
| Node.js       | 18.0.0        | [nodejs.org](https://nodejs.org) ou `nvm install 18` |
| npm           | 9.0.0         | Incluso no Node.js                               |
| Docker        | 24+           | [docker.com](https://docker.com)                 |
| Docker Compose| 2+            | Incluso no Docker Desktop                        |
| PostgreSQL    | 15            | Via Docker (recomendado)                         |
| Git           | 2.40+         | [git-scm.com](https://git-scm.com)               |

---

## 2. Setup Rápido

```bash
# 1. Clonar o repositório
git clone git@github.com:austa-care/Coordenacao-Cuidado-Enterprise.git
cd Coordenacao-Cuidado-Enterprise

# 2. Subir serviços de infraestrutura (PostgreSQL + Redis)
docker compose up -d postgres redis

# 3. Aguardar PostgreSQL estar pronto
docker compose logs postgres | grep "ready to accept connections"

# 4. Instalar dependências do backend
cd austa-care-platform/backend
npm install

# 5. Gerar Prisma Client
npx prisma generate

# 6. Rodar migrações do banco
npx prisma migrate dev

# 7. (Opcional) Popular banco com dados de desenvolvimento
npx tsx prisma/seed/development.ts

# 8. Gerar secrets de desenvolvimento
bash ../../scripts/generate-dev-secrets.sh

# 9. Iniciar servidor de desenvolvimento
npm run dev

# O servidor estará disponível em http://localhost:3000
# Health check: http://localhost:3000/health
```

**Verificação rápida**:
```bash
curl -s http://localhost:3000/health | jq .status
# Deve retornar: "healthy"
```

---

## 3. Estrutura do Projeto

```
Coordenacao-Cuidado-Enterprise/
│
├── austa-care-platform/
│   ├── backend/                    ← BACKEND (este guia)
│   │   ├── src/
│   │   │   ├── server.ts           ← Entrypoint do Express
│   │   │   ├── config/             ← Configurações (env, database, redis)
│   │   │   │   ├── config.ts
│   │   │   │   └── database.ts
│   │   │   ├── controllers/        ← Handlers de requisição
│   │   │   │   ├── auth.ts
│   │   │   │   ├── user.ts
│   │   │   │   ├── health.ts
│   │   │   │   ├── whatsapp.ts
│   │   │   │   ├── authorizationController.ts
│   │   │   │   ├── advanced-risk-controller.ts
│   │   │   │   ├── gamification.controller.ts
│   │   │   │   ├── conversation.controller.ts
│   │   │   │   ├── document.controller.ts
│   │   │   │   ├── health-data.controller.ts
│   │   │   │   ├── ocr.controller.ts
│   │   │   │   ├── aiController.ts
│   │   │   │   └── admin.controller.ts
│   │   │   ├── routes/             ← Definição de rotas
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── user.routes.ts
│   │   │   │   ├── authorization.ts
│   │   │   │   ├── advanced-risk.ts
│   │   │   │   ├── gamification.routes.ts
│   │   │   │   ├── whatsapp.routes.ts
│   │   │   │   ├── conversation.routes.ts
│   │   │   │   ├── document.routes.ts
│   │   │   │   ├── health-data.routes.ts
│   │   │   │   ├── ocr.routes.ts
│   │   │   │   ├── ai.ts
│   │   │   │   └── admin.routes.ts
│   │   │   ├── services/           ← Lógica de negócio
│   │   │   │   ├── whatsapp.service.ts
│   │   │   │   ├── risk-assessment.service.ts
│   │   │   │   ├── temporal-risk-tracking.service.ts
│   │   │   │   ├── webhook-processor.service.ts
│   │   │   │   ├── workflowOrchestrator.ts
│   │   │   │   ├── stateMachine.ts
│   │   │   │   ├── openaiService.ts
│   │   │   │   ├── taskIntegration.ts
│   │   │   │   └── ...
│   │   │   ├── middleware/         ← Express middleware
│   │   │   │   ├── auth.ts         ← JWT + role-based auth
│   │   │   │   ├── validation.ts   ← Zod/Joi validation
│   │   │   │   ├── rateLimiter.ts  ← Rate limiting
│   │   │   │   ├── errorHandler.ts ← Global error handler
│   │   │   │   └── metrics.middleware.ts ← Prometheus metrics
│   │   │   ├── validation/         ← Schemas Zod/Joi
│   │   │   │   ├── index.ts
│   │   │   │   ├── middleware/
│   │   │   │   └── schemas/
│   │   │   ├── infrastructure/     ← Clientes de infra
│   │   │   │   ├── kafka/
│   │   │   │   ├── redis/
│   │   │   │   ├── mongodb/
│   │   │   │   ├── websocket/
│   │   │   │   ├── ml/
│   │   │   │   └── monitoring/
│   │   │   ├── types/              ← TypeScript type definitions
│   │   │   │   ├── index.ts
│   │   │   │   ├── core/
│   │   │   │   │   ├── enums.ts
│   │   │   │   │   ├── express.types.ts
│   │   │   │   │   └── branded.types.ts
│   │   │   │   ├── user.types.ts
│   │   │   │   ├── whatsapp.types.ts
│   │   │   │   ├── risk.types.ts
│   │   │   │   └── ...
│   │   │   └── utils/              ← Utilitários
│   │   │       ├── logger.ts       ← Winston logger
│   │   │       ├── webhook.ts
│   │   │       └── ...
│   │   ├── tests/                  ← Testes
│   │   │   ├── unit/               ← Testes unitários
│   │   │   ├── integration/        ← Testes de integração
│   │   │   ├── e2e/                ← Testes end-to-end
│   │   │   ├── performance/        ← Testes de carga
│   │   │   ├── helpers/            ← Test factories e helpers
│   │   │   └── setup.ts            ← Configuração global do Jest
│   │   ├── prisma/                 ← Schema e migrações
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── prisma/                     ← Documentação do schema
│       └── DATABASE_SCHEMA_DOCUMENTATION.md
│
├── docker-compose.yml              ← Serviços de dev
├── docker-compose.infrastructure.yml ← Infra adicional
├── scripts/
│   └── generate-dev-secrets.sh     ← Gerador de secrets .env
├── docs/                           ← Documentação
│   ├── api/
│   │   ├── openapi.yaml            ← OpenAPI 3.0 spec
│   │   └── README.md
│   ├── OPERATIONS-RUNBOOK.md
│   ├── DEVELOPER-GUIDE.md          ← Este arquivo
│   ├── HEALTHCARE-INVARIANTS.md
│   ├── SECRETS-MANAGEMENT.md
│   └── WHATSAPP-INTEGRATION.md
└── .env.example                    ← Template de variáveis de ambiente
```

### 3.1 Mapeamento de Rotas no Express

As rotas são montadas em `src/server.ts`:

```typescript
// Health checks (não versionados)
app.use('/health', healthRoutes);

// API v1
app.use('/api/v1/auth', authRoutes);              // Autenticação
app.use('/api/v1/users', userRoutes);              // Usuários
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/health-data', healthDataRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/gamification', gamificationRoutes);
app.use('/api/v1/authorizations', authorizationRoutes);
app.use('/api/v1/risk-assessment', advancedRiskRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/ocr', ocrRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/webhooks/whatsapp', whatsappRoutes);
```

---

## 4. Scripts Disponíveis

| Script                | Descrição                                     |
|-----------------------|-----------------------------------------------|
| `npm run dev`         | Inicia servidor com hot-reload (nodemon + tsx) |
| `npm run build`       | Compila TypeScript → JavaScript (dist/)       |
| `npm start`           | Roda versão compilada (produção)              |
| `npm test`            | Roda todos os testes                          |
| `npm run test:watch`  | Testes em modo watch                          |
| `npm run test:coverage` | Testes com relatório de cobertura           |
| `npm run test:unit`   | Apenas testes unitários                       |
| `npm run test:integration` | Apenas testes de integração             |
| `npm run test:e2e`    | Apenas testes end-to-end                      |
| `npm run test:performance` | Testes de carga                        |
| `npm run lint`        | ESLint                                        |
| `npm run lint:fix`    | ESLint com auto-fix                           |
| `npm run format`      | Prettier                                      |
| `npm run db:migrate`  | Prisma migrate dev                            |
| `npm run db:generate` | Prisma generate (regenera client)             |
| `npm run db:seed`     | Popula banco com dados dev                    |

---

## 5. Como Rodar Testes

### 5.1 Testes Unitários

```bash
# Todos os testes unitários
npm run test:unit

# Arquivo específico
npx jest tests/unit/controllers/auth.test.ts

# Com watch
npx jest tests/unit --watch
```

### 5.2 Testes de Integração

```bash
# Requer PostgreSQL rodando
docker compose up -d postgres
npm run test:integration
```

### 5.3 Testes E2E

```bash
# Requer todos os serviços
docker compose up -d postgres redis
npm run test:e2e
```

### 5.4 Cobertura

```bash
npm run test:coverage
# Relatório em: coverage/lcov-report/index.html
```

### 5.5 CI/CD

```bash
npm run test:ci
# Equivalente a: jest --coverage --watchAll=false --passWithNoTests
```

---

## 6. Convenções de Código

### 6.1 TypeScript — Strict Mode

`tsconfig.json` usa `"strict": true`. Isso habilita:
- `strictNullChecks`
- `strictFunctionTypes`
- `strictPropertyInitialization`
- `noImplicitAny`
- `noImplicitThis`

**Regras**:
- Sempre declare tipos explícitos para parâmetros de função
- Use `unknown` ao invés de `any` sempre que possível
- Prefira `interface` para objetos públicos, `type` para unions/utilitários
- Use branded types para IDs: `type UserId = string & { readonly __brand: 'UserId' }`

### 6.2 ESLint

```bash
npm run lint        # Verificar
npm run lint:fix    # Corrigir automaticamente
```

Regras principais:
- No unused variables (exceto prefixo `_`)
- No console.log (use Winston logger)
- Prefer const over let
- Explicit return types em funções exportadas
- No `any` sem `// eslint-disable-next-line` explícito

### 6.3 Prettier

```bash
npm run format
```

Configuração (`.prettierrc`):
- Single quotes
- Trailing commas
- 2 spaces indent
- 100 char print width
- Semicolons

### 6.4 Validação de Dados

Use **Zod** para validação de entrada em rotas:

```typescript
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login',
  validateRequest(LoginSchema),  // Middleware de validação
  async (req, res) => { ... }
);
```

Schemas complexos (ex: Risk Assessment) podem usar **Joi** (legado em migração para Zod).

### 6.5 Logging

Use o logger Winston (import de `src/utils/logger.ts`):

```typescript
import { logger } from '@/utils/logger';

logger.info('User registered', { userId: user.id, email: user.email });
logger.warn('Authentication failed', { path: req.path, ip: req.ip });
logger.error('Database connection failed', { error: err.message });
```

**NUNCA** use `console.log()` diretamente.

### 6.6 Tratamento de Erros

```typescript
// Em controllers/routes:
try {
  // ... lógica
} catch (error) {
  logger.error('Operation failed', { error });
  res.status(500).json({ error: 'Operation failed' });
}

// Ou use o error handler global (throw + next):
throw createError('Not found', 404);
```

O error handler global (`middleware/errorHandler.ts`) captura erros não tratados e retorna:
```json
{
  "success": false,
  "error": { "message": "..." },
  "timestamp": "...",
  "path": "...",
  "method": "..."
}
```

### 6.7 Autenticação e Autorização

```typescript
// Middleware de autenticação (obrigatório)
router.use(authenticateToken);

// Role-based access
router.get('/admin-only', requireRole('admin'), handler);
router.get('/multi-role', requireRole(['admin', 'compliance']), handler);

// Permission-based access
router.post('/sensitive', requirePermission('write:users'), handler);
```

### 6.8 Banco de Dados

Use **Prisma** para todas as operações de banco:

```typescript
import { prisma } from '@/config/database';

const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { profile: true }
});
```

**NUNCA** escreva SQL raw exceto em health checks ou migrações.

---

## 7. Como Contribuir

### 7.1 Fluxo de Trabalho

```bash
# 1. Atualizar da main
git checkout main
git pull origin main

# 2. Criar branch
git checkout -b feature/nome-da-feature
# ou: git checkout -b fix/nome-do-fix
# ou: git checkout -b docs/nome-da-doc

# 3. Desenvolver (TDD recomendado)
#    - Escrever teste → ver falhar → implementar → ver passar
npm run test:watch  # Deixe rodando

# 4. Verificar lint e formatação
npm run lint
npm run format

# 5. Rodar todos os testes
npm test

# 6. Commit (conventional commits)
git add .
git commit -m "feat: add user profile endpoint"
# Tipos: feat, fix, docs, refactor, test, chore, perf, ci, security

# 7. Push e abrir PR
git push origin feature/nome-da-feature
# Abrir PR no GitHub para branch `main`
```

### 7.2 Convenção de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: descrição curta
fix: descrição curta
docs: descrição curta
refactor: descrição curta
test: descrição curta
chore: descrição curta
perf: descrição curta
ci: descrição curta
security: descrição curta
```

### 7.3 Pull Requests

**Checklist antes de abrir PR**:
- [ ] Testes passam (`npm test`)
- [ ] Lint passa (`npm run lint`)
- [ ] Cobertura não diminuiu
- [ ] Documentação atualizada (OpenAPI, README, etc.)
- [ ] Commits seguem conventional commits
- [ ] Branch está atualizada com `main`
- [ ] Sem secrets hardcoded

**Template de PR**:
```markdown
## Descrição
[Breve descrição da mudança]

## Tipo
- [ ] feat (nova funcionalidade)
- [ ] fix (correção de bug)
- [ ] docs (documentação)
- [ ] refactor
- [ ] test
- [ ] chore

## Checklist
- [ ] Testes adicionados/atualizados
- [ ] Lint e formatação OK
- [ ] Documentação atualizada
- [ ] Testado localmente

## Breaking Changes?
[Se sim, descreva o impacto e plano de migração]
```

### 7.4 Code Review

**Revisores**: Pelo menos 1 aprovação de senior antes de merge.

**Critérios**:
- Código segue convenções do projeto
- Testes cobrem casos de borda
- Performance não degrada
- Segurança: sem injeção, XSS, dados expostos
- LGPD: dados sensíveis tratados corretamente

---

## 8. Configuração de Ambiente

### 8.1 Variáveis de Ambiente

Copie `.env.example` e ajuste:

```bash
cp .env.example .env
bash scripts/generate-dev-secrets.sh  # Preenche segredos aleatórios
```

**Variáveis essenciais**:
| Variável                  | Descrição                              | Dev Default            |
|---------------------------|----------------------------------------|------------------------|
| `NODE_ENV`                | Ambiente (development/staging/production) | `development`       |
| `PORT`                    | Porta do servidor                      | `3000`                 |
| `DATABASE_URL`            | Connection string PostgreSQL           | `postgresql://...`     |
| `REDIS_URL`               | Connection string Redis                | `redis://localhost:6379` |
| `JWT_SECRET`              | Chave de assinatura JWT                | (gerado pelo script)   |
| `JWT_REFRESH_SECRET`      | Chave de refresh token                 | (gerado pelo script)   |
| `ENCRYPTION_KEY`          | Chave de criptografia (hex)            | (gerado pelo script)   |
| `DEAD_MANS_SWITCH_THRESHOLD_MS` | Threshold para stale alert (ms) | `300000` (5 min) |

### 8.2 Serviços Locais (Docker)

```bash
# Infraestrutura básica (dev)
docker compose up -d postgres redis

# Infraestrutura completa (dev-tools)
docker compose --profile dev-tools up -d

# Serviços disponíveis:
# PostgreSQL:    localhost:5432
# Redis:         localhost:6379
# pgAdmin:       http://localhost:8080
# Redis Commander: http://localhost:8081
```

---

## 9. Troubleshooting Comum

### Erro: `pgcrypto extension is NOT installed`

```bash
docker compose exec postgres psql -U austa_user -d austa_care \
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

### Erro: `PrismaClientInitializationError`

```bash
# Garantir que DATABASE_URL está correto
echo $DATABASE_URL

# Rodar migrações
npx prisma migrate dev
npx prisma generate
```

### Erro: Porta 3000 em uso

```bash
# Encontrar processo
lsof -i :3000
# Matar
kill -9 PID
```

### Erro: `Cannot find module '@/*'`

Os path aliases (`@/controllers`, `@/services`, etc.) requerem `tsconfig-paths`:

```bash
# Dev (tsx + tsconfig-paths já configurados)
npm run dev

# Ou adicione ao ts-node:
npx ts-node -r tsconfig-paths/register src/server.ts
```

---

## 10. Recursos Adicionais

- **OpenAPI Spec**: `docs/api/openapi.yaml`
- **Schema do Banco**: `austa-care-platform/prisma/DATABASE_SCHEMA_DOCUMENTATION.md`
- **Invariantes de Saúde**: `docs/HEALTHCARE-INVARIANTS.md`
- **Guia de Secrets**: `docs/SECRETS-MANAGEMENT.md`
- **Integração WhatsApp**: `docs/WHATSAPP-INTEGRATION.md`
- **Runbook de Operações**: `docs/OPERATIONS-RUNBOOK.md`

---

## 11. Dúvidas?

- **Slack**: `#austa-backend`
- **Tech Lead**: [CONTATO]
- **Daily**: 9:30 BRT
