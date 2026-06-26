# Appendix — Glossário, Acrônimos & Análise de Stack
# AUSTA Care Platform

---

## A. Glossário Estendido

| Termo | Definição | Fonte |
|-------|-----------|-------|
| **ANS** | Agência Nacional de Saúde Suplementar — regula planos de saúde no Brasil | Requisitos.md §4.2 |
| **ANVISA** | Agência Nacional de Vigilância Sanitária — regula dispositivos médicos (incluindo software/SaMD) | Implícito (não citado diretamente — GAP) |
| **BAA** | Business Associate Agreement — contrato exigido por HIPAA entre covered entity e business associate | Requisitos.md §4.2 |
| **Beneficiário** | Cliente final do plano de saúde, usuário principal da plataforma | Requisitos.md §1.4 |
| **CFM** | Conselho Federal de Medicina — regula exercício da medicina no Brasil | Não citado — GAP |
| **CPT** | Cobertura Parcial Temporária — para condições pré-existentes em planos de saúde | Requisitos.md §1.4 |
| **CQRS** | Command Query Responsibility Segregation — padrão de separação leitura/escrita | Requisitos.md §2.1 |
| **Enfermeira Navegadora** | Profissional que coordena jornadas de cuidado complexas | Requisitos.md §1.4 |
| **FHIR R4** | Fast Healthcare Interoperability Resources — padrão HL7 para interoperabilidade | Requisitos.md §1.4, docker-compose.infrastructure.yml |
| **HealthPoints** | Sistema de gamificação — pontos ganhos por completar missões de saúde | Requisitos.md §1.4, schema.prisma |
| **HIPAA** | Health Insurance Portability and Accountability Act — regulação de privacidade de saúde DOS EUA (não se aplica ao Brasil) | Referenciado 15+ vezes — ver ADR-001 |
| **HL7** | Health Level Seven — padrões de interoperabilidade em saúde (v2, v3, FHIR) | Requisitos.md §5.2 |
| **HAPI FHIR** | Servidor open-source FHIR em Java | docker-compose.infrastructure.yml |
| **ICD-10 / CID-10** | Classificação Internacional de Doenças, 10ª edição | Requisitos.md §5.2 |
| **LGPD** | Lei Geral de Proteção de Dados (Lei 13.709/2018) — regime de privacidade brasileiro | Requisitos.md §4.2, Questionary_Sugested.md |
| **LOINC** | Logical Observation Identifiers Names and Codes — terminologia para exames laboratoriais | Requisitos.md §5.2 |
| **NPS** | Net Promoter Score — métrica de satisfação do cliente | Requisitos.md §6.2 |
| **OMS** | Organização Mundial da Saúde | Referência implícita |
| **PHI** | Protected Health Information — informação de saúde protegida (termo HIPAA) | schema.prisma, DATABASE_SCHEMA_DOCUMENTATION.md |
| **PII** | Personally Identifiable Information — informação pessoal identificável | Requisitos.md §4.2 |
| **RDC 657/2022** | Resolução ANVISA que classifica Software como Dispositivo Médico (SaMD) | Não citado — GAP crítico |
| **RIPD** | Relatório de Impacto à Proteção de Dados — obrigatório LGPD Art. 38 | Não citado — GAP |
| **SaMD** | Software as Medical Device — software com finalidade médica | Não citado — GAP crítico |
| **SBIS** | Sociedade Brasileira de Informática em Saúde — certificação de software de saúde | Não citado — GAP |
| **SNOMED CT** | Systematized Nomenclature of Medicine — Clinical Terms — terminologia clínica abrangente | Requisitos.md §5.2 |
| **Tasy** | ERP de gestão hospitalar (Philips) — sistema legado de integração | Requisitos.md §1.3 |
| **TISS** | Troca de Informações em Saúde Suplementar — padrão ANS para billing | Não citado — pode ser necessário |
| **Zeca/Ana** | Personas do assistente virtual (WhatsApp chatbot) | Requisitos.md §1.4, Questionary_Sugested.md |

---

## B. Acrônimos Técnicos

| Acrônimo | Significado | Contexto |
|----------|-------------|----------|
| **APM** | Application Performance Monitoring | Observability (New Relic/Datadog) |
| **BPM** | Business Process Management | Camunda (workflow engine) |
| **CDN** | Content Delivery Network | CloudFront |
| **CI/CD** | Continuous Integration / Continuous Deployment | DevOps |
| **CORS** | Cross-Origin Resource Sharing | Segurança API |
| **CSRF** | Cross-Site Request Forgery | Segurança web |
| **DAU/MAU** | Daily/Monthly Active Users | Métricas de negócio |
| **DLP** | Data Loss Prevention | Segurança de dados |
| **DMN** | Decision Model and Notation | Camunda (regras de decisão) |
| **DR** | Disaster Recovery | GCP como região secundária |
| **EKS/GKE** | Elastic/Google Kubernetes Engine | Orquestração de containers |
| **ELK** | Elasticsearch, Logstash, Kibana | Stack de logging |
| **HATEOAS** | Hypermedia as the Engine of Application State | REST maturity level 3 |
| **HPA** | Horizontal Pod Autoscaler | Kubernetes auto-scaling |
| **IdP** | Identity Provider | Autenticação (implícito via OAuth2) |
| **JWT** | JSON Web Token | Autenticação stateless |
| **KMS** | Key Management Service | Gestão de chaves de criptografia |
| **MLLP** | Minimal Lower Layer Protocol | Transporte HL7 v2 sobre TCP |
| **ML** | Machine Learning | XGBoost, TensorFlow, Spark |
| **NLP** | Natural Language Processing | Análise de sintomas, intenção |
| **OCR** | Optical Character Recognition | Leitura de documentos médicos |
| **OPA** | Open Policy Agent | Policy-as-code (não implementado) |
| **OWASP** | Open Web Application Security Project | Segurança de aplicações |
| **PAM** | Privileged Access Management | Gestão de acesso privilegiado |
| **PWA** | Progressive Web App | Frontend React com suporte offline |
| **RBAC/ABAC** | Role/Attribute-Based Access Control | Autorização |
| **RPA** | Robotic Process Automation | IBM RPA (automação administrativa) |
| **SIEM** | Security Information and Event Management | Monitoramento de segurança |
| **SOC** | Security Operations Center | Operações de segurança |
| **VPC** | Virtual Private Cloud | Isolamento de rede AWS |
| **WAF** | Web Application Firewall | Proteção de aplicações web |
| **XSS** | Cross-Site Scripting | Vulnerabilidade web |

---

## C. Tech Stack — Documentado vs Implementado

### Documented (Requisitos.md §2.2 + architecture_diagrams.md)

| Camada | Tecnologias Documentadas |
|--------|------------------------|
| **Apresentação** | WhatsApp Business API, PWA React.js, Voice AI (AWS Polly + Lex) |
| **Orquestração** | Camunda 8, Apache Kafka, Redis, RabbitMQ |
| **Inteligência** | GPT-4 (OpenAI), XGBoost, TensorFlow, Apache Spark, Elasticsearch |
| **Dados** | Delta Lake, PostgreSQL, MongoDB, Redis |
| **Integração** | IBM RPA, ERP Tasy APIs, FHIR Gateway |
| **Infra** | AWS (EKS, RDS, DocumentDB, ElastiCache, S3) + GCP DR (GKE, Cloud SQL, Firestore) |
| **Observabilidade** | Prometheus, Grafana, ELK, Jaeger, New Relic/Datadog, PagerDuty |
| **Segurança** | OAuth 2.0 + JWT, WAF, DDoS, VPC, AES-256, TLS 1.3 |
| **API** | Kong Gateway, REST (HATEOAS), GraphQL, WebSockets |

### Implemented (Verificado no código)

| Camada | Tecnologias Reais |
|--------|------------------|
| **Apresentação** | WhatsApp (via service mock), React 18 + Vite 5 + TailwindCSS + PWA |
| **Orquestração** | BullMQ (Redis), KafkaJS (parcial), node-cron |
| **Inteligência** | @langchain/openai, @tensorflow/tfjs-node, Tesseract.js OCR |
| **Dados** | PostgreSQL 15 + Prisma ORM, Redis 7 |
| **Integração** | FHIR (HAPI server config, fhir npm package), AWS Textract, Google Cloud Vision |
| **Infra** | Docker Compose (2 arquivos, 14 serviços), K8s manifests (básico), Terraform (incompleto) |
| **Observabilidade** | Prometheus + Grafana + Jaeger (todos em docker-compose.infrastructure.yml), Winston logger |
| **Segurança** | JWT (jsonwebtoken + bcrypt), Helmet, express-rate-limit, CORS |
| **API** | Express, Nginx reverse proxy, Kong config presente |

### Divergências Críticas

| Documentado | Implementado | Impacto |
|------------|-------------|---------|
| **Python/FastAPI (AI Service)** | TypeScript/Node.js (tudo) | ⚠️ Architecture diagrams mostram Python; código é 100% TS |
| **Java/Spring (Auth Service)** | TypeScript/Express (auth no monolito) | ⚠️ Diagrama C4Container mostra Java; não existe |
| **10 containers (C4Container)** | 1-3 containers (backend + postgres + redis) | ⚠️ Over-engineering 5-10x |
| **Delta Lake + MongoDB** | Apenas PostgreSQL + Redis | ⚠️ Duas DBs documentadas que não existem no código |
| **Camunda 8 BPM** | State machine customizada em TypeScript | ⚠️ BPM engine substituído por lógica própria |
| **Apache Spark** | Não implementado | ⚠️ Batch processing não existe |
| **IBM RPA** | Não implementado | ⚠️ Automação administrativa não implementada |
| **Multi-Cloud (AWS+GCP)** | Docker Compose local apenas | ⚠️ Sem provisionamento cloud real |
| **RabbitMQ** | Apenas Kafka config (docker-compose.infrastructure.yml) | ⚠️ Dois message brokers documentados; Kafka presente mas não usado no código backend |
| **HIPAA compliance** | LGPD parcial + HIPAA em nome apenas | 🔴 Claims enganosos |

---

## D. Healthcare Invariants — Verificação

| # | Invariante | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | **Audit trail imutável** | ⚠️ Parcial | AuditLog model existe no schema; AuditService (805 linhas) implementa buffer + compliance rules. Mas é em memória (Map) — não usa AuditLog model do Prisma diretamente. Precisa persistir. |
| 2 | **Idempotência de mensagens** | ❌ Ausente | whatsappMessageId é @unique no schema mas código não verificado para INSERT ON CONFLICT |
| 3 | **Versionamento de algoritmos** | ❌ Ausente | Risk assessment e emergency detection não registram versão do algoritmo |
| 4 | **Criptografia em repouso** | ⚠️ Parcial | pgcrypto carregado na migration; AuditService tem encryptMetadata() mas implementação não encontrada; isEncrypted flag no Document model |
| 5 | **Health check + dead man's switch** | ⚠️ Parcial | Health check endpoint existe (health.test.ts); docker-compose healthchecks configurados; mas sem dead man's switch externo |
| 6 | **Retry com backoff** | ⚠️ Parcial | BullMQ oferece retry nativo; mas WhatsApp/email notification retry pattern não verificado |

---

