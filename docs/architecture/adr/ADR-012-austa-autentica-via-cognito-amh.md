# ADR-012: AUSTA Autentica via AMH Cognito (Identidade Federada)

**Status:** Accepted
**Date:** 2026-06-27
**Deciders:** Parreira (Orquestrador DevOps), AMH Principal Architect

## Context

A plataforma AUSTA Care Platform atualmente implementa autenticação própria usando JWT (`jsonwebtoken` + `bcrypt`) com RBAC básico baseado em `UserRole` enum (PATIENT, PROVIDER, ADMIN, CARE_COORDINATOR, NURSE). Este modelo é funcional para o MVP, mas não escala para o ecossistema multi-PJ da Americas Health e não se integra com o modelo de identidade e autorização da AMH (Cognito + IAM Identity Center + ABAC via session tags).

### Estado atual da autenticação AUSTA:
- **JWT:** Tokens gerados e validados localmente com `jsonwebtoken`. Secret armazenado em env var (`JWT_SECRET`)
- **Senhas:** Hasheadas com `bcrypt`. Usuários WhatsApp-only têm `password: null`
- **RBAC:** Enum `UserRole` com 5 roles. Verificação manual no código (middleware `requireRole()`)
- **Sem OAuth2/OIDC:** Zero integração com provedor de identidade externo
- **Sem session tags:** Sem propagação de identidade para serviços AWS (KMS, Secrets Manager, S3) — usa IAM role estático sem atributos de sessão
- **Refresh tokens:** Campo `refreshToken` no modelo `User` (string simples, sem rotação)

### Modelo de identidade AMH (Cognito):
A AMH utiliza Amazon Cognito como provedor de identidade (ADR-016a AMH), integrado com IAM Identity Center:
- **Cognito User Pool:** Gerencia usuários, grupos, e atributos. Suporta OIDC/SAML federation
- **IAM Identity Center:** SSO para contas AWS. Mapeamento de grupos AD → session tags
- **Session Tags ABAC:** `tenant=austa_clinicas`, `role=engineer|analyst|steward` injetados automaticamente
- **LF-Tags:** Lake Formation ABAC usa session tags para controle de acesso fino (ADR-005 AMH)

### Por que isso é um problema:
- **Identidade fragmentada:** Um coordenador de cuidado que acessa o dashboard AUSTA e o dashboard AMH precisa de duas contas separadas — experiência ruim e risco de segurança
- **Sem ABAC para AWS:** AUSTA não pode usar session tags para acessar recursos AWS (KMS CMK, Secrets Manager, S3) com isolamento por tenant. Toda chamada AWS usa IAM role estático — sem distinção de qual usuário ou tenant está fazendo a chamada
- **Sem integração com AD corporativo:** Funcionários da Americas Health autenticam via AD → IAM Identity Center. AUSTA, com seu próprio sistema de autenticação, fica fora desse fluxo
- **Duplicação de user management:** AUSTA gerencia usuários (criação, recuperação de senha, lockout, MFA) — duplica funcionalidade que o Cognito já provê como serviço gerenciado

## Decision

**AUSTA adota Amazon Cognito da AMH como provedor de identidade federada para todos os usuários (profissionais de saúde, coordenadores, administradores).** Pacientes (WhatsApp) continuam com autenticação simplificada (phone-based, sem senha), mas vinculados a um `mpi_id` no Cognito para identidade longitudinal. AUSTA para de gerar JWT tokens e passa a validar tokens emitidos pelo Cognito.

### Arquitetura de Autenticação Federada

```
┌──────────────────────────────────────────────────────────────┐
│                   AMH Cognito (sa-east-1)                     │
│                                                               │
│  User Pool: amh-care-platform-users                          │
│  ├── Grupos:                                                 │
│  │   ├── austa_clinicas-patients (WhatsApp users)            │
│  │   ├── austa_clinicas-providers (médicos, enfermeiras)     │
│  │   ├── austa_clinicas-care-coordinators                    │
│  │   ├── austa_clinicas-admins                               │
│  │   ├── amh-engineers (time AMH, acesso cross-tenant)       │
│  │   └── amh-stewards (data stewards MPI)                    │
│  ├── Atributos custom:                                       │
│  │   ├── custom:tenant = "austa_clinicas"                    │
│  │   ├── custom:mpi_id = "mpi_abc123" (para pacientes)      │
│  │   └── custom:role = "care_coordinator"                    │
│  ├── Identity Provider: Azure AD (corporate SSO)             │
│  └── OIDC endpoints: /.well-known/openid-configuration       │
│                                                               │
│  IAM Identity Center:                                        │
│  ├── Mapeamento: grupo AD → session tag tenant               │
│  └── Session tags injetadas via AssumeRoleWithSAML            │
└──────────────────────┬───────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌──────────────────┐     ┌──────────────────────┐
│  AUSTA Dashboard  │     │  AUSTA Backend        │
│  (React SPA)      │     │  (Express)            │
│                   │     │                       │
│  Amplify Auth UI  │     │  cognito-validator.ts  │
│  ou Cognito       │     │  ├── validateToken()  │
│  Hosted UI        │     │  │   (JWKS verifica-  │
│                   │     │  │    ção local)      │
│  POST /oauth2/    │     │  ├── extractTenant()  │
│  token → id_token │     │  └── extractMPIId()   │
│       │           │     │                       │
│       ▼           │     │  Middleware:          │
│  Authorization:   │     │  requireTenant(       │
│  Bearer id_token──┼────▶│    'austa_clinicas')  │
│                   │     │  requireRole(         │
│                   │     │    'care_coordinator') │
│                   │     │                       │
│                   │     │  AWS SDK calls com    │
│                   │     │  session tags:        │
│                   │     │  tenant=austa_clinicas│
│                   │     │  role=care_coordinator│
└──────────────────┘     └──────────────────────┘
```

### Validação de Token Cognito no Backend AUSTA

```typescript
// middleware/cognito-auth.ts
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!, // sa-east-1_xxxxx
  tokenUse: 'id', // id_token (contém custom attributes)
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export async function cognitoAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const payload = await verifier.verify(token);

    // Extrair atributos custom do token
    req.user = {
      sub: payload.sub,
      email: payload.email,
      tenant: payload['custom:tenant'] || 'austa_clinicas',
      role: payload['custom:role'] || 'patient',
      mpi_id: payload['custom:mpi_id'] || null,
      groups: payload['cognito:groups'] || [],
    };

    // Verificar tenant (defense in depth — Cognito group já garante, mas verificamos também)
    if (req.user.tenant !== 'austa_clinicas') {
      return res.status(403).json({ error: 'Tenant access denied' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware de role
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
```

### Autenticação de Pacientes (WhatsApp)

Pacientes que interagem exclusivamente via WhatsApp não têm senha. O fluxo é:

1. **Onboarding:** Paciente inicia conversa WhatsApp → AUSTA verifica número de telefone
2. **Lookup Cognito:** Se paciente não existe no Cognito, AUSTA cria usuário "passwordless" no Cognito via AdminCreateUser API:
   ```typescript
   await cognito.adminCreateUser({
     UserPoolId: POOL_ID,
     Username: `whatsapp_${phone}`,
     UserAttributes: [
       { Name: 'custom:tenant', Value: 'austa_clinicas' },
       { Name: 'custom:mpi_id', Value: mpiId },
       { Name: 'custom:role', Value: 'patient' },
       { Name: 'phone_number', Value: phone },
     ],
     MessageAction: 'SUPPRESS', // Sem email/sms — WhatsApp é o canal
   });
   ```
3. **Token:** AUSTA gera token para o paciente (via `custom:role=patient`) usando client credentials ou token de serviço
4. **Vinculação:** Token gerado é usado para chamadas autenticadas subsequentes (lookup saúde, gamificação)

### Migração de Usuários Existentes

| Perfil | Ação |
|--------|------|
| **Profissionais (providers, admins, care_coordinators)** | Migrar para Cognito User Pool. Importar via CSV (cognito:username, email, role). Usuários autenticam via AD corporativo (SSO) ou Cognito Hosted UI |
| **Pacientes WhatsApp existentes** | Criar no Cognito como usuários passwordless (`custom:role=patient`) com `phone_number` como username. `mpi_id` setado como atributo custom |
| **Pacientes com senha (dashboard web)** | Migrar senha com `cognito:aws:password` (hash bcrypt compatível) ou forçar reset de senha no primeiro login Cognito |

### Sessão AWS com Session Tags (ABAC)

```typescript
// lib/aws-session.ts
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';

// Para operações que exigem acesso a recursos AWS com isolamento por tenant:
// Em vez de usar a role estática da task ECS, assume role com session tags
export async function getScopedAwsCredentials(user: AuthenticatedUser) {
  const sts = new STSClient({});
  const response = await sts.send(new AssumeRoleCommand({
    RoleArn: 'arn:aws:iam::123456789:role/austa-backend-scoped',
    RoleSessionName: `austa-${user.sub}`,
    Tags: [
      { Key: 'tenant', Value: user.tenant },
      { Key: 'role', Value: user.role },
      { Key: 'mpi_id', Value: user.mpi_id || 'unknown' },
    ],
  }));

  return response.Credentials; // AccessKeyId, SecretAccessKey, SessionToken
}
```

## Alternatives Considered

### Manter JWT próprio + RBAC local (sem Cognito)
Rejeitado — duplica sistema de identidade. Sem integração com AD corporativo (SSO). Sem session tags AWS → impossível implementar ABAC para acesso a KMS, S3, Secrets Manager com isolamento por tenant.

### AUSTA cria seu próprio User Pool no Cognito (separado do AMH)
Rejeitado — fragmenta identidade mesmo usando mesmo serviço (Cognito). Dois User Pools = dois diretórios de usuários = sem SSO unificado = sem session tags cross-AUSTA-AMH.

### Autenticação apenas para profissionais (pacientes continuam com phone-only)
Aceitável como Phase 1. Pacientes WhatsApp podem continuar com autenticação simplificada, mas vinculados ao Cognito via `custom:mpi_id`. Isso garante que eventos clínicos e chamadas AWS sejam atribuíveis a um `mpi_id` mesmo sem token JWT tradicional.

### Usar Auth0 ou outro provedor externo em vez de Cognito
Rejeitado — Cognito já é o padrão AMH (ADR-016a). Adicionar outro provedor de identidade fragmenta o ecossistema. Cognito integra nativamente com IAM Identity Center, API Gateway, ALB — serviços que AUSTA usa.

## Consequences

### Positivas
- **SSO corporativo:** Funcionários Americas Health acessam AUSTA Dashboard e AMH Grafana com a mesma conta AD
- **ABAC via session tags:** Toda chamada AWS (KMS, Secrets Manager, S3) carrega `tenant`, `role`, `mpi_id` → auditável via CloudTrail
- **MFA gerenciado:** Cognito suporta MFA via TOTP/SMS — AUSTA herda sem implementar
- **User management delegado:** Criação de usuário, reset de senha, lockout, MFA — tudo gerenciado pelo Cognito e AD corporativo
- **Compliance:** Autenticação centralizada é requisito para ISO 27001 e ANS

### Negativas
- **Migração de usuários:** 100+ profissionais e 1000+ pacientes precisam ser migrados para Cognito
- **Dependência do Cognito:** Se Cognito estiver indisponível (raro, serviço gerenciado AWS), autenticação de profissionais fica bloqueada
- **Complexidade de fluxo passwordless:** Pacientes WhatsApp sem senha exigem fluxo customizado (client credentials grant) que não é padrão Cognito Hosted UI
- **Latência de validação:** Verificação JWT local (JWKS) é < 5ms, mas primeira chamada (fetch JWKS) pode levar ~50ms

### Neutras
- AUSTA para de armazenar `password` hash e `refreshToken` no modelo `User` — colunas podem ser removidas após migração
- Pacientes WhatsApp continuam sem senha — a experiência não muda para o usuário final
- Login web (dashboard) passa a redirecionar para Cognito Hosted UI ou integração com Amplify Auth

## Trade-offs

- **Controle local vs. Identidade federada:** AUSTA perde controle direto sobre criação e gerenciamento de usuários, mas ganha SSO, ABAC, e segurança gerenciada
- **Complexidade da migração vs. Simplicidade futura:** Migrar usuários é esforço único (~2 semanas). Manter sistema próprio é complexidade perpétua (bugs de segurança, compliance, feature requests)

## Implementation Plan

1. **Phase 1:** Configurar AUSTA client no Cognito User Pool AMH (`austa-care-platform` client com OIDC flow)
2. **Phase 2:** Implementar `cognito-auth.ts` middleware com validação JWT local (JWKS) + extração de custom attributes
3. **Phase 3:** Migrar profissionais (providers, admins, care_coordinators) para Cognito. Criar grupos correspondentes
4. **Phase 4:** Integrar login do dashboard AUSTA com Cognito Hosted UI ou AWS Amplify Auth
5. **Phase 5:** Criar usuários passwordless no Cognito para pacientes WhatsApp existentes
6. **Phase 6:** Implementar session tags AWS (STS AssumeRole) para chamadas a KMS, S3, Secrets Manager
7. **Phase 7:** Adicionar middleware `requireTenant('austa_clinicas')` e `requireRole(...)` usando claims do Cognito
8. **Phase 8:** Remover geração de JWT local, colunas `password`/`refreshToken` do modelo User, e middleware de auth antigo

## Validation

- [ ] Profissional autentica via AD corporativo → acessa dashboard AUSTA com token Cognito válido
- [ ] Token Cognito contém `custom:tenant=austa_clinicas` e `custom:role` correto
- [ ] Middleware `requireRole('care_coordinator')` bloqueia acesso de paciente
- [ ] Session tags AWS: `AssumeRole` com tags `tenant=austa_clinicas` → consegue `kms:Decrypt` na CMK do tenant
- [ ] Paciente WhatsApp onboarded → usuário passwordless criado no Cognito → `custom:mpi_id` setado
- [ ] CloudTrail: chamadas AWS da AUSTA registram `PrincipalTag/tenant=austa_clinicas`
- [ ] Zero JWT tokens gerados localmente (apenas validação de tokens Cognito)
- [ ] Teste de segurança: token expirado → 401 Unauthorized

## References

- AMH ADR-016a: [Cognito como OIDC Adapter para CIB Seven](../../amh-data-platform/architecture/adrs/ADR-016a-cognito-oidc-adapter-for-cib7.md)
- AMH ADR-005: [Estratégia Multi-Tenant — ABAC + session tags IAM](../../amh-data-platform/architecture/adrs/ADR-005-estrategia-multi-tenant.md)
- Amazon Cognito User Pools: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html
- AWS JWT Verifier for Cognito: https://github.com/awslabs/aws-jwt-verify
- IAM Session Tags ABAC: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_session-tags.html
- AUSTA Schema: modelo `User` (role, password, refreshToken) — a ser simplificado
- AUSTA ADR-007: [AUSTA adota AMH MPI](ADR-007-austa-adota-amh-mpi-identidade-paciente.md) — `mpi_id` como atributo Cognito
