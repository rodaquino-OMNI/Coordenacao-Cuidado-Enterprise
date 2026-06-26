# 🏥 AUSTA Care Platform — Coordenação de Cuidado com IA

[![Status](https://img.shields.io/badge/Status-Alpha%20%2F%20Pre--Production-yellow)](https://github.com/austa-health/austa-care-platform)
[![Stack](https://img.shields.io/badge/Stack-TypeScript%20Monolith%20%7C%20PostgreSQL%20%7C%20Redis-blue)](https://github.com/austa-health/austa-care-platform)
[![Compliance](https://img.shields.io/badge/Compliance-LGPD%20%7C%20ANS%20%7C%20ANVISA-green)](https://www.gov.br/anpd/pt-br)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Z--API%20(z--api.io)-25D366)](https://z-api.io)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%205-61DAFB)](https://react.dev)

> **⚠️ STATUS HONESTO — Junho 2026:** A plataforma está em fase **Alpha/Pre-Production**. O backend é um **monolito TypeScript modular** (Express + Prisma), não microserviços. Documentação anterior descrevia uma arquitetura de 12 containers que não existe. Esta versão do README reflete a realidade do código.

## 🎯 O Problema Que Resolvemos

Operadoras de saúde enfrentam desafios críticos:

- **Altos custos de sinistro** devido a modelos de cuidado reativos
- **Baixo engajamento** com programas de saúde (<20% de participação)
- **Processos manuais** consumindo 70% do tempo operacional
- **Detecção tardia** de condições crônicas que poderiam ser prevenidas
- **Cuidado fragmentado** sem visão unificada do paciente

## 💡 Nossa Solução

**AUSTA Care Platform** é um sistema de inteligência com IA que transforma a jornada de cuidado:

### 🤖 Assistente Virtual Inteligente
- Agentes virtuais humanizados (Zeca/Ana) via **WhatsApp — app que 99% dos brasileiros usam**
- Análise de sintomas em tempo real com triagem inteligente
- Detecção preditiva de risco usando machine learning
- Personalização baseada em comportamento e histórico

### 📊 Inteligência Operacional
- Automação de autorizações e agendamentos
- Orquestração inteligente de fluxos de cuidado
- Insights preditivos para intervenção proativa
- Dashboard 360° com visão completa do beneficiário

## 📈 Status Atual do Desenvolvimento

### Estado Real (Junho 2026)

| Área | Status | Detalhe |
|------|--------|---------|
| **Backend** | ✅ Funcional | TypeScript/Express monolith + Prisma ORM |
| **Database** | ✅ Funcional | PostgreSQL 15 com pgcrypto |
| **Cache** | ✅ Funcional | Redis 7 (sessões, rate limiting, filas BullMQ) |
| **WhatsApp** | ✅ Funcional | Z-API (z-api.io) — gateway brasileiro |
| **IA/NLP** | ✅ Funcional | OpenAI GPT-4 via LangChain |
| **Frontend** | ✅ Funcional | React 18 + Vite 5 + TailwindCSS |
| **Testes** | ✅ Implementados | Unit + Integration + E2E (Jest/Vitest) |
| **CI/CD** | 🔄 Configurando | Docker Compose local; K8s planejado |
| **Produção** | 🔜 Pre-Production | Deploy em VM única; sem multi-region ainda |

### O Que REALMENTE Existe

```
✅ 1 backend TypeScript monolith (Express + Prisma)
✅ PostgreSQL 15 (fonte da verdade)
✅ Redis 7 (cache, sessões)
✅ WhatsApp via Z-API (não Meta Business API)
✅ Frontend React 18 + Vite 5 + TailwindCSS
✅ Testes unitários, integração e E2E
✅ Docker Compose para desenvolvimento local
✅ Documentação de arquitetura honesta (ver docs/)
✅ 6 ADRs formais (docs/architecture/adr/)
```

### O Que NÃO Existe (Ainda)

```
❌ Microserviços separados (Python, Java, etc.)
❌ Apache Kafka em produção
❌ MongoDB em produção
❌ Deploy Kubernetes multi-region
❌ Service mesh (Istio)
❌ API Gateway Kong em produção
❌ Multi-cloud AWS/GCP
❌ Certificação ANVISA SaMD (em processo)
❌ 100k usuários concorrentes comprovados
```

## 🛠️ Stack Tecnológica Real

### Backend (Monolith)
- **Runtime:** Node.js + Express + TypeScript
- **ORM:** Prisma (PostgreSQL)
- **Cache:** Redis 7 (ioredis)
- **Filas:** BullMQ (backed by Redis)
- **IA:** OpenAI GPT-4 + LangChain
- **Validação:** Zod + Joi
- **Autenticação:** JWT + bcrypt
- **Logging:** Winston + Morgan
- **Métricas:** prom-client (Prometheus)

### Frontend
- **Framework:** React 18 + TypeScript
- **Build:** Vite 5
- **Estilo:** TailwindCSS
- **Estado:** Zustand + React Query
- **Roteamento:** React Router DOM v6
- **Componentes:** Radix UI + Lucide Icons
- **Gráficos:** Recharts

### Banco de Dados
- **Primário:** PostgreSQL 15
- **Criptografia:** pgcrypto (envelope encryption para PHI)
- **Migrations:** Prisma Migrate

### Infraestrutura
- **Container:** Docker + Docker Compose
- **Observabilidade:** Prometheus + Grafana (local)
- **CI/CD:** Em configuração (GitHub Actions planejado)

## 🚀 Quick Start (Desenvolvimento)

### Pré-requisitos
- Node.js 18+
- Docker e Docker Compose
- Conta Z-API (WhatsApp)
- Chave API OpenAI

### Setup

```bash
# 1. Clone
git clone https://github.com/austa-health/austa-care-platform.git
cd austa-care-platform

# 2. Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais (Z-API, OpenAI, etc.)

# 3. Inicie infraestrutura
docker-compose up -d postgres redis

# 4. Instale dependências
cd austa-care-platform/backend && npm install
cd ../frontend && npm install

# 5. Execute migrations
cd ../austa-care-platform/backend
npm run db:migrate
npm run db:seed

# 6. Inicie servidores
# Terminal 1 - Backend
cd austa-care-platform/backend && npm run dev
# Terminal 2 - Frontend
cd austa-care-platform/frontend && npm run dev

# 7. Verifique
curl http://localhost:3000/health
```

## 📂 Estrutura do Projeto

```
Coordenacao-Cuidado-Enterprise/
├── austa-care-platform/
│   ├── backend/                  # Monolith TypeScript/Express
│   │   ├── src/
│   │   │   ├── routes/          # 14+ route groups
│   │   │   ├── services/        # Business logic modules
│   │   │   ├── controllers/     # Legacy controllers
│   │   │   ├── middleware/      # Auth, validation, error handling
│   │   │   ├── types/           # TypeScript type definitions
│   │   │   ├── utils/           # Helpers, logger, webhook utils
│   │   │   ├── validation/      # Zod/Joi schemas
│   │   │   ├── infrastructure/  # Kafka, Redis, MongoDB clients
│   │   │   └── config/          # Environment config
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # 1259 linhas, 45+ tabelas
│   │   │   └── migrations/      # Migration SQL
│   │   └── tests/
│   │       ├── unit/
│   │       ├── integration/
│   │       └── e2e/
│   ├── frontend/                 # React 18 + Vite 5 SPA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   │   ├── store/           # Zustand stores
│   │   │   └── types/
│   │   └── vite.config.ts
│   ├── k8s/                      # Kubernetes manifests (aspiracionais)
│   ├── infrastructure/           # Terraform, Kong config (planejado)
│   └── monitoring/               # Prometheus + Grafana configs
├── docs/
│   ├── architecture_diagrams.md  # Diagramas C4 honestos
│   ├── architecture/
│   │   └── adr/                  # 6 ADRs formais
│   ├── _analysis/                # Análise da plataforma
│   └── *.md                      # Documentação complementar
├── docker-compose.yml            # Serviços de runtime reais
├── docker-compose.infrastructure.yml  # Serviços opcionais/planejados
└── README.md                     # Este arquivo
```

## 📋 Roadmap

### ✅ Completado (Waves 0-3)
- ✔️ Backend TypeScript monolith funcional
- ✔️ Integração WhatsApp via Z-API
- ✔️ Integração OpenAI GPT-4
- ✔️ Schema PostgreSQL completo (45+ tabelas)
- ✔️ Sistema de autenticação JWT + RBAC
- ✔️ Frontend React dashboard
- ✔️ Testes unitários, integração e E2E
- ✔️ Docker Compose desenvolvimento
- ✔️ Documentação de arquitetura corrigida (honesta)
- ✔️ 6 ADRs formais documentados

### 🔄 Em Progresso
- 🔄 Preparação para classificação ANVISA SaMD
- 🔄 Substituição completa HIPAA → LGPD/ANS/ANVISA
- 🔄 CI/CD pipeline (GitHub Actions)
- 🔄 Testes de carga

### 📍 Próximos Passos (Wave 4+)
- **Imediato:** Finalizar migration HIPAA→LGPD, implementar pgcrypto
- **Curto prazo:** Deploy staging, testes de carga, ajustes de performance
- **Médio prazo:** Registro ANVISA, extração de microserviços sob demanda
- **Longo prazo:** Kubernetes, multi-region, certificações (ISO 27001, SBIS/CFM)

## 🔒 Compliance & Regulatório

A plataforma segue o framework regulatório brasileiro:

- **LGPD** (Lei 13.709/2018) — proteção de dados pessoais e sensíveis
- **ANS** (RN 277/2011, RN 305/2012) — regulação de operadoras de saúde
- **ANVISA** (RDC 657/2022) — classificação SaMD em andamento

> **Nota:** Documentação anterior referia-se a "HIPAA compliance". Isso foi corrigido — HIPAA é regulação dos EUA e não se aplica ao mercado brasileiro. Ver ADR-001.

## 📚 Documentação de Arquitetura

- **Diagramas:** `docs/architecture_diagrams.md` — C4Context, C4Container, Data Flow, Security, Deployment (atuais + futuros)
- **ADRs:** `docs/architecture/adr/` — 6 decisões arquiteturais formais
- **Análise:** `docs/_analysis/` — Análise detalhada da plataforma

## 📝 Licença

Este projeto é software proprietário da AUSTA Health. Todos os direitos reservados.

---

**🏥 Transformando coordenação de cuidado, uma mensagem por vez.**

*Stack real: TypeScript monolith + PostgreSQL + Redis | Alpha/Pre-Production | Junho 2026*
