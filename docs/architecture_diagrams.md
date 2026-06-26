# 🎨 System Architecture Diagrams: AUSTA Care Platform

**Version:** 2.0
**Date:** June 26, 2026
**Purpose:** Honest architectural representation — current state + future aspirations

> ⚠️ **IMPORTANT NOTE:** The diagrams below are split into **CURRENT** (what actually exists in the codebase right now) and **FUTURE** (target architecture for later phases). The previous version of this document (v1.0, July 2025) described a 12-container microservices architecture that did NOT exist. This v2.0 corrects that.

---

## 📋 Current vs Target Architecture Summary

| Aspect | Current (MVP — June 2026) | Target (Fase 3+) |
|--------|---------------------------|-------------------|
| **Runtime services** | 3 containers | 6-8 containers |
| **Backend** | 1 TypeScript monolith (Express) | 4-5 microservices extraídos |
| **Database** | PostgreSQL 15 | PostgreSQL 15 (permanece) |
| **Cache** | Redis 7 | Redis 7 (permanece) |
| **Message broker** | In-process EventEmitter | Apache Kafka (quando necessário) |
| **WhatsApp** | Z-API (z-api.io) | Z-API + potencial multi-provedor |
| **Deploy** | Docker Compose (single VM) | Kubernetes (EKS) |
| **Frontend** | React 18 + Vite 5 | React 18 + Vite 5 (permanece) |
| **ADR Reference** | ADR-003 | ADR-003 § Plano de Evolução |

---

## 📊 C4 Context Diagram (CURRENT)

```mermaid
C4Context
    title System Context Diagram - AUSTA Care Platform (Current)

    Person(patient, "Paciente/Beneficiário", "Usuário do plano de saúde via WhatsApp")
    Person(nurse, "Coordenador de Cuidado", "Profissional de saúde gerenciando cuidado")
    Person(admin, "Admin da Plataforma", "Administrador do sistema")

    System(austa, "AUSTA Care Platform", "Plataforma de coordenação de cuidado com IA")

    System_Ext(zapi, "Z-API (z-api.io)", "Gateway WhatsApp brasileiro")
    System_Ext(tasy, "ERP Tasy (Philips)", "Sistema de gestão hospitalar")
    System_Ext(openai, "OpenAI GPT-4", "Modelo de linguagem para IA conversacional")

    Rel(patient, zapi, "Envia mensagens via", "WhatsApp")
    Rel(zapi, austa, "Webhook de eventos", "HTTPS/REST")
    Rel(nurse, austa, "Dashboard de cuidado", "HTTPS")
    Rel(admin, austa, "Administração", "HTTPS")

    Rel(austa, tasy, "Dados de pacientes, autorizações", "REST/SOAP")
    Rel(austa, openai, "Processamento de IA", "HTTPS/API")
```

**Nota:** Z-API substitui WhatsApp Business API (Meta). Ver ADR-003 para detalhes da decisão de provedor.

---

## 🏗️ Container Diagram (CURRENT — Modular Monolith)

```mermaid
C4Container
    title Container Diagram - AUSTA Care Platform (Current Architecture)

    Container(backend, "Backend API", "TypeScript/Express + Prisma", "Monolith: toda lógica de negócio em módulos com boundaries explícitas")

    ContainerDb(postgres, "PostgreSQL 15", "Relational Database", "Fonte da verdade: dados transacionais, pacientes, saúde")
    ContainerDb(redis, "Redis 7", "In-Memory Cache", "Sessões, rate limiting, filas (BullMQ), cache de queries")

    Container(web, "Frontend Dashboard", "React 18 + Vite 5 + TailwindCSS", "Dashboard administrativo SPA")

    System_Ext(zapi, "Z-API", "WhatsApp Gateway")
    System_Ext(tasy, "ERP Tasy", "Sistema hospitalar")
    System_Ext(openai, "OpenAI GPT-4", "LLM")

    Rel(zapi, backend, "Webhook (mensagens)", "HTTPS/REST")
    Rel(web, backend, "API calls", "HTTPS/REST")
    Rel(backend, postgres, "Leitura/Escrita", "TCP/Prisma")
    Rel(backend, redis, "Cache/Sessões", "TCP/ioredis")
    Rel(backend, tasy, "Integração", "REST/SOAP")
    Rel(backend, openai, "Processamento IA", "HTTPS/API")
```

**Nota:** A arquitetura atual é um **modular monolith** — todos os 14+ módulos (auth, conversations, health-data, risk-assessment, ai, ocr, authorization, gamification, etc.) rodam em um único processo Express. Microserviços serão extraídos sob demanda (ver ADR-003).

---

## 🏗️ Container Diagram (FUTURE — Target Fase 3+)

```mermaid
C4Container
    title Container Diagram - AUSTA Care Platform (Future Target)

    Container(web, "Frontend Dashboard", "React 18 + Vite 5", "SPA administrativa")

    Container(gateway, "API Gateway", "Nginx/Kong", "Roteamento, rate limiting, TLS")
    Container(chat, "Chat Service", "TypeScript/Express", "Processamento WhatsApp")
    Container(care, "Care Coordination", "TypeScript/Express", "Coordenação de cuidado, autorizações")
    Container(ai, "AI/ML Service", "TypeScript/Express", "Análise de risco, NLP, ML")
    Container(integration, "Integration Hub", "TypeScript/Express", "Tasy, FHIR, externals")

    ContainerDb(postgres, "PostgreSQL 15", "Relational DB", "Dados transacionais")
    ContainerDb(redis, "Redis 7", "Cache", "Sessões, filas, cache")

    Rel(web, gateway, "API calls", "HTTPS")
    Rel(gateway, chat, "Routes", "HTTPS")
    Rel(gateway, care, "Routes", "HTTPS")
    Rel(gateway, ai, "Routes", "HTTPS")
    Rel(gateway, integration, "Routes", "HTTPS")

    Rel(chat, postgres, "Read/Write", "TCP")
    Rel(care, postgres, "Read/Write", "TCP")
    Rel(ai, postgres, "Read/Write", "TCP")

    Rel(chat, redis, "Cache", "TCP")
    Rel(care, redis, "Cache", "TCP")

    UpdateLayoutConfig($C4_SHAPE, "aspiracional")
```

---

## 🔄 Data Flow Architecture (CURRENT)

```mermaid
graph TB
    subgraph "Input Channels"
        A[WhatsApp via Z-API]
        B[Web Dashboard]
        C[ERP Tasy Integration]
    end

    subgraph "Backend Monolith (Express + Prisma)"
        D[API Routes<br/>14+ route groups]
        E[Business Logic<br/>Services Layer]
        F[Prisma ORM]
    end

    subgraph "Storage Layer"
        G[PostgreSQL 15<br/>Transactional Data]
        H[Redis 7<br/>Cache / Sessions / Queues]
    end

    subgraph "External Services"
        I[OpenAI GPT-4<br/>NLP & AI]
        J[Tasy ERP<br/>Patient Data]
        K[Z-API Webhook<br/>WhatsApp Events]
    end

    A -->|Webhook| K
    K --> D
    B --> D
    C --> E

    D --> E
    E --> F
    F --> G
    E --> H

    E -->|API Call| I
    E -->|REST/SOAP| J

    style D fill:#e1f5fe
    style G fill:#e8f5e8
    style H fill:#fff3e0
```

**Nota:** Kafka, MongoDB, Data Lake, e outros componentes do diagrama v1.0 foram removidos por não estarem em uso. Ver ADR-003 para justificativa. O processamento de eventos é in-process (EventEmitter) nesta fase.

---

## 🔐 Security Architecture (CURRENT)

```mermaid
graph TB
    subgraph "Network Layer"
        A[Helmet.js<br/>Security Headers]
        B[CORS<br/>Origin Control]
        C[Rate Limiting<br/>express-rate-limit]
    end

    subgraph "Authentication & Authorization"
        D[JWT Tokens<br/>jsonwebtoken]
        E[bcrypt<br/>Password Hashing]
        F[RBAC<br/>Role-based Access]
    end

    subgraph "Data Protection"
        G[pgcrypto Extension<br/>PostgreSQL Encryption]
        H[TLS/SSL<br/>Encryption in Transit]
        I[Input Validation<br/>Zod + Joi Schemas]
    end

    subgraph "Compliance Framework"
        J[LGPD<br/>Lei 13.709/2018]
        K[ANS<br/>RN 277/2011]
        L[ANVISA<br/>RDC 657/2022]
    end

    A --> D
    B --> D
    C --> D

    D --> G
    E --> G
    F --> G

    G --> J
    H --> J
    I --> J

    J --> K
    K --> L

    style D fill:#e3f2fd
    style G fill:#f1f8e9
    style J fill:#fff3e0
```

**Nota:** HIPAA foi substituído por LGPD/ANS/ANVISA (ver ADR-001). pgcrypto para envelope encryption de PHI (ver ADR-004). RBAC implementado via middleware de roles em TypeScript.

---

## 📡 Integration Architecture (CURRENT)

```mermaid
graph TB
    subgraph "AUSTA Backend (Monolith)"
        A[Integration Services<br/>TypeScript Modules]
        B[Webhook Handlers]
        C[API Clients]
    end

    subgraph "WhatsApp"
        D[Z-API (z-api.io)<br/>Gateway Brasileiro]
    end

    subgraph "Healthcare Systems"
        E[ERP Tasy<br/>Philips]
        F[HAPI FHIR Server<br/>Planejado]
    end

    subgraph "AI Services"
        G[OpenAI GPT-4<br/>Chat Completions]
        H[LangChain<br/>Orquestração IA]
    end

    subgraph "Storage"
        I[AWS S3<br/>Documentos]
        J[AWS Textract<br/>OCR]
    end

    B --> D
    C --> E
    C --> F
    C --> G
    A --> H
    A --> I
    C --> J

    style A fill:#e1f5fe
    style D fill:#f3e5f5
```

**Nota:** A integração é feita por módulos TypeScript dentro do monolith, não por um Integration Hub separado. O HAPI FHIR Server está no `docker-compose.infrastructure.yml` mas não é ativamente utilizado pelo código.

---

## 🚀 Deployment Architecture (CURRENT)

```mermaid
graph TB
    subgraph "Single VM / Docker Host"
        subgraph "Docker Compose"
            A[Backend Container<br/>Node.js/Express:3000]
            B[PostgreSQL Container<br/>Postgres:5432]
            C[Redis Container<br/>Redis:6379]
        end
        D[Frontend<br/>Vite Dev Server:5173]
    end

    subgraph "External (SaaS)"
        E[Z-API<br/>WhatsApp Gateway]
        F[OpenAI API<br/>GPT-4]
        G[AWS S3 + Textract<br/>Document Storage]
    end

    A --> B
    A --> C
    D --> A
    A --> E
    A --> F
    A --> G

    style A fill:#4caf50
    style B fill:#2196f3
    style C fill:#ff9800
```

**Nota:** O deploy atual é via Docker Compose em VM única. Kubernetes manifests existem em `k8s/` mas são aspiracionais (Fase 3+). Não há multi-cloud nem multi-region atualmente.

---

## 📊 Monitoring & Observability (CURRENT)

```mermaid
graph TB
    subgraph "Data Collection"
        A[Winston Logger<br/>Structured Logs]
        B[Prometheus Metrics<br/>prom-client]
        C[Morgan<br/>HTTP Request Logging]
    end

    subgraph "Visualization (Docker Compose)"
        D[Prometheus<br/>:9090]
        E[Grafana<br/>:3001]
    end

    A --> D
    B --> D
    C --> D

    D --> E

    style D fill:#ff5722
    style E fill:#4caf50
```

**Nota:** Stack de observabilidade atual é Winston (logs) + Prometheus (métricas) + Grafana (dashboards). Jaeger, Elasticsearch, e Kibana estão no `docker-compose.infrastructure.yml` como infraestrutura opcional, mas não são integrados ao código.

---

## 🎯 Diagram Usage Guidelines

### For Development Teams
- Use **Container Diagram (CURRENT)** para entender boundaries reais dos módulos
- Reference **Data Flow (CURRENT)** para padrões de processamento
- Consulte os **ADRs** em `docs/architecture/adr/` para decisões arquiteturais documentadas

### For Operations Teams
- Deploy seguindo `docker-compose.yml` (runtime real)
- `docker-compose.infrastructure.yml` contém serviços opcionais/planejados
- Monitore via Prometheus + Grafana em `:3001`

### For Business Stakeholders
- **C4Context** mostra o panorama real de sistemas
- A plataforma opera como **modular monolith** — simples, eficaz, pronta para evoluir
- Microserviços serão extraídos quando houver demanda real de escala

### For Compliance Teams
- Framework regulatório: **LGPD/ANS/ANVISA** (não HIPAA) — ver ADR-001
- Criptografia PHI: pgcrypto envelope encryption — ver ADR-004
- Algoritmos clínicos versionados — ver ADR-005
- Idempotência de mensagens para integridade de dados — ver ADR-006

---

## 📚 Architecture Decision Records (ADRs)

Decisões arquiteturais formais estão documentadas em `docs/architecture/adr/`:

| ADR | Título | Status |
|-----|--------|--------|
| ADR-001 | Substituição HIPAA → LGPD/ANS/ANVISA | Accepted |
| ADR-002 | Classificação ANVISA SaMD (RDC 657/2022) | Accepted |
| ADR-003 | Arquitetura Monolith-First para MVP | Accepted |
| ADR-004 | Envelope Encryption com pgcrypto para PHI | Accepted |
| ADR-005 | Versionamento de Algoritmos Clínicos | Accepted |
| ADR-006 | Idempotência para Mensagens WhatsApp/FHIR/Tasy | Accepted |

---

## 🔮 Roadmap Arquitetural

| Fase | Arquitetura | Gatilho |
|------|-------------|---------|
| **Fase 1 (MVP — Atual)** | Monolith + PostgreSQL + Redis | Agora |
| **Fase 2 (Growth)** | Monolith + BullMQ filas assíncronas | > 1.000 usuários ativos |
| **Fase 3 (Scale)** | Extrair AI/ML service se CPU > 2x baseline | > 10.000 usuários ativos |
| **Fase 4 (Enterprise)** | Microserviços por domínio | Múltiplos times independentes |
