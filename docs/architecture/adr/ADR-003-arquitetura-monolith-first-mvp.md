# ADR-003: Decisão de Manter Arquitetura Monolith-First para o MVP

**Status:** Accepted
**Date:** 2026-06-26
**Deciders:** Parreira (Orquestrador DevOps)

## Context

O documento `architecture_diagrams.md` (502 linhas, 9 diagramas Mermaid) descreve uma arquitetura de microserviços sofisticada com:

- **10+ containers:** Kong API Gateway, Chat Service (Node.js), AI/NLP Service (Python/FastAPI), Auth Service (Java/Spring), User Service (Node.js), Risk Engine (Python), Notification Service (Node.js), Integration Hub (Java)
- **4 bancos de dados:** PostgreSQL, MongoDB, Redis Cluster, Delta Lake (Data Lake)
- **Message broker:** Apache Kafka como backbone de eventos
- **Orquestração:** Camunda 8 para BPM
- **Service Mesh:** Istio com mTLS
- **Multi-cloud:** AWS (primário) + GCP (disaster recovery)

A realidade do código (`server.ts`, 253 linhas) revela uma arquitetura fundamentalmente diferente:

- **1 backend TypeScript monolith** (Express + Prisma) com 14+ grupos de rotas montados em uma única aplicação Express
- **PostgreSQL 15** como fonte da verdade (Prisma ORM)
- **Redis 7** para cache, sessões, rate limiting
- **Zero código Python** (apenas 3 arquivos `.py` dentro de `node_modules`)
- **Zero código Java**
- WhatsApp via **Z-API** (z-api.io), não Meta Business API oficial
- Frontend **React 18 + Vite 5 + TailwindCSS**

O `docker-compose.infrastructure.yml` inclui serviços adicionais (MongoDB, Kafka, FHIR, Elasticsearch, Jaeger, MinIO) mas estes são **infraestrutura aspiracional** — o código não os utiliza em padrão de microserviços. O `server.ts` inicializa Kafka, MongoDB, Redis, ML Pipeline e WebSocket em uma única função bloqueante `initializeServices()` (linhas 136-192). Se qualquer um desses serviços estiver indisponível, o servidor inteiro falha (`throw error` na linha 191).

## Decision

Para o MVP e Fase 1-2, adotar arquitetura **modular monolith** com 3 serviços de runtime:

1. **Backend monolith (TypeScript/Express + Prisma)** — toda lógica de negócio em módulos bem definidos
2. **PostgreSQL 15** — banco de dados transacional (fonte da verdade)
3. **Redis 7** — cache, sessões, filas (BullMQ)

Princípios:
- Módulos com boundaries explícitas (preparados para extração futura)
- Cada módulo tem seu próprio diretório com `routes/`, `services/`, `types/`
- Sem imports cross-module que violem boundaries
- Eventos internos via in-process EventEmitter (não Kafka)

Microserviços serão extraídos **sob demanda**, quando um módulo demonstrar:
- Necessidade de scaling independente (métrica de CPU/memória > 2x dos outros módulos)
- Necessidade de deploy independente (ciclo de release diferente)
- Necessidade de stack tecnológico diferente (ex: Python para ML pesado)

## Alternatives Considered

### Microserviços completos desde o início (arquitetura documentada)
Rejeitado — 10+ containers para zero usuários em produção é "astronaut architecture". Estimativa de 6+ meses apenas para configurar CI/CD, service mesh, e comunicação inter-serviços. A complexidade operacional mataria a velocidade de desenvolvimento do MVP.

### Manter monolith atual sem plano de extração
Rejeitado — necessário documentar a decisão explícita para evitar decomposição prematura e alinhar o time sobre o plano de evolução.

### Extrair 2-3 microserviços agora (ex: AI Service separado)
Rejeitado — mesmo 2-3 serviços adicionam complexidade de rede, serialização, service discovery, e debugging distribuído. O benefício de scaling independente não se materializa com < 1000 usuários.

## Consequences

### Positivas
- Desenvolvimento mais rápido (single codebase, single deploy)
- Debugging simplificado (stack trace único, sem tracing distribuído)
- Custo operacional menor (3 containers vs 15+)
- Single deployment unit (sem orquestração de releases multi-serviço)
- Testes mais simples (sem necessidade de contract testing entre serviços)

### Negativas
- Menos apelo para "resume-driven development" (arquitetura de microserviços é atrativa para contratação)
- Scaling horizontal limitado (replica-se o monolith inteiro, não módulos individuais)
- Acoplamento no deploy (uma mudança no módulo de autorização requer deploy completo)

### Neutras
- Kafka pode ser adiado para Fase 3 (eventos in-process suprem necessidade atual)
- MongoDB pode ser eliminado (PostgreSQL JSONB cobre armazenamento de documentos)
- FHIR server pode ser adiado (transformação FHIR pode ser feita no backend)

## Trade-offs

- **Velocidade de desenvolvimento agora vs. Escalabilidade teórica depois:** O monolith entrega valor mais rápido. Quando escalabilidade for necessária, os módulos já estarão com boundaries claras para extração.
- **Simplicidade operacional vs. Resiliência:** Um monolith tem single point of failure, mas com < 1000 usuários, um crash loop do K8s/ECS resolve em segundos.
- **Dívida técnica de extração futura:** Extrair microserviços de um monolith bem modularizado custa ~2-4 semanas por serviço. Vale a pena pagar esse custo depois, quando houver demanda real.

## Plano de Evolução

| Fase | Arquitetura | Gatilho |
|------|-------------|---------|
| **Fase 1 (MVP)** | Monolith + PostgreSQL + Redis | Agora |
| **Fase 2 (Growth)** | Monolith + filas assíncronas (BullMQ) | > 1000 usuários ativos |
| **Fase 3 (Scale)** | Extrair AI/ML service se CPU > 2x baseline | > 10k usuários ativos |
| **Fase 4 (Enterprise)** | Microserviços por domínio (Auth, Chat, Risk) | Múltiplos times independentes |

## References

- Martin Fowler, "Monolith First" (2015): https://martinfowler.com/bliki/MonolithFirst.html
- Sam Newman, "Building Microservices" (2nd ed., 2021), Cap. 3: "Splitting the Monolith"
- `server.ts` (linhas 109-127): evidência de todas as rotas montadas em único Express app
- `docker-compose.yml`: serviços de runtime reais (postgres, redis, backend, frontend)
