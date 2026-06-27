/**
 * AUSTA Care Platform - Database Seed Script
 *
 * This script populates the database with initial data for development and testing.
 * Includes:
 * - Organizations (hospitals, clinics)
 * - Users (patients, providers, admins)
 * - Sample health data
 * - Gamification missions
 * - Authorization templates
 *
 * Context: Brazilian healthcare system with LGPD/ANS/ANVISA compliance
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Brazilian healthcare context data
const BRAZILIAN_STATES = ['SP', 'RJ', 'MG', 'RS', 'BA', 'PR', 'SC'];
const BRAZILIAN_CITIES = {
  SP: ['São Paulo', 'Campinas', 'Santos', 'Ribeirão Preto'],
  RJ: ['Rio de Janeiro', 'Niterói', 'Petrópolis'],
  MG: ['Belo Horizonte', 'Uberlândia', 'Contagem'],
};

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // Clean existing data (in development only!)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.auditLog.deleteMany();
    await prisma.pointTransaction.deleteMany();
    await prisma.healthPoints.deleteMany();
    await prisma.onboardingProgress.deleteMany();
    await prisma.mission.deleteMany();
    await prisma.document.deleteMany();
    await prisma.authorization.deleteMany();
    await prisma.healthData.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.tasySyncLog.deleteMany();
    await prisma.tasyIntegration.deleteMany();
    await prisma.provider.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
    console.log('✅ Existing data cleaned\n');
  }

  // 1. Create Organizations
  console.log('🏥 Creating organizations...');
  const organizations = await Promise.all([
    prisma.organization.create({
      data: {
        name: 'Hospital São Paulo',
        type: 'HOSPITAL',
        taxId: '12.345.678/0001-90',
        address: {
          street: 'Rua Napoleão de Barros, 715',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '04024-002',
          country: 'Brasil',
        },
        phone: '+55 11 5576-4000',
        email: 'contato@hospitalsaopaulo.com.br',
        isActive: true,
        lgpdCompliant: true,
        dataRetentionYears: 7,
        settings: {
          timezone: 'America/Sao_Paulo',
          language: 'pt-BR',
          currency: 'BRL',
          features: {
            whatsapp: true,
            gamification: true,
            tasyIntegration: true,
          },
        },
      },
    }),
    prisma.organization.create({
      data: {
        name: 'Clínica Saúde e Vida',
        type: 'CLINIC',
        taxId: '98.765.432/0001-10',
        address: {
          street: 'Av. Paulista, 1578',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01310-200',
          country: 'Brasil',
        },
        phone: '+55 11 3283-5000',
        email: 'contato@saudeevida.com.br',
        isActive: true,
        lgpdCompliant: true,
        dataRetentionYears: 7,
        settings: {
          timezone: 'America/Sao_Paulo',
          language: 'pt-BR',
          currency: 'BRL',
          features: {
            whatsapp: true,
            gamification: true,
            tasyIntegration: false,
          },
        },
      },
    }),
    prisma.organization.create({
      data: {
        name: 'Laboratório Diagnóstico Total',
        type: 'LABORATORY',
        taxId: '11.222.333/0001-44',
        address: {
          street: 'Rua dos Três Irmãos, 123',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '05615-010',
          country: 'Brasil',
        },
        phone: '+55 11 3768-9000',
        email: 'contato@diagnosticototal.com.br',
        isActive: true,
        lgpdCompliant: true,
        dataRetentionYears: 10,
      },
    }),
  ]);
  console.log(`✅ Created ${organizations.length} organizations\n`);

  // 2. Create Providers
  console.log('👨‍⚕️ Creating healthcare providers...');
  const hashedPassword = await bcrypt.hash('Provider@123', 12);

  const providers = await Promise.all([
    prisma.provider.create({
      data: {
        firstName: 'Dr. Carlos',
        lastName: 'Silva',
        email: 'carlos.silva@hospitalsaopaulo.com.br',
        phone: '+55 11 98765-4321',
        license: 'CRM-SP 123456',
        specialty: ['CARDIOLOGY', 'INTERNAL_MEDICINE'],
        organizationId: organizations[0].id,
        role: 'DOCTOR',
        isActive: true,
      },
    }),
    prisma.provider.create({
      data: {
        firstName: 'Dra. Ana',
        lastName: 'Santos',
        email: 'ana.santos@hospitalsaopaulo.com.br',
        phone: '+55 11 98765-1234',
        license: 'CRM-SP 654321',
        specialty: ['PEDIATRICS', 'GENERAL_PRACTICE'],
        organizationId: organizations[0].id,
        role: 'DOCTOR',
        isActive: true,
      },
    }),
    prisma.provider.create({
      data: {
        firstName: 'Enf. Maria',
        lastName: 'Oliveira',
        email: 'maria.oliveira@saudeevida.com.br',
        phone: '+55 11 98765-5678',
        license: 'COREN-SP 789012',
        specialty: ['NURSING', 'GENERAL_CARE'],
        organizationId: organizations[1].id,
        role: 'NURSE',
        isActive: true,
      },
    }),
    prisma.provider.create({
      data: {
        firstName: 'Admin',
        lastName: 'Sistema',
        email: 'admin@hospitalsaopaulo.com.br',
        phone: '+55 11 99999-9999',
        specialty: ['ADMINISTRATION'],
        organizationId: organizations[0].id,
        role: 'ADMINISTRATOR',
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ Created ${providers.length} providers\n`);

  // 3. Create Users (Patients)
  console.log('👥 Creating users/patients...');
  const users = await Promise.all([
    prisma.user.create({
      data: {
        firstName: 'João',
        lastName: 'Silva',
        email: 'joao.silva@email.com',
        phone: '+5511987654321',
        cpf: '123.456.789-00',
        dateOfBirth: new Date('1980-05-15'),
        gender: 'MALE',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
        organizationId: organizations[0].id,
        metadata: {
          emergencyContact: {
            name: 'Maria Silva',
            phone: '+5511987654322',
            relationship: 'Esposa',
          },
        },
        preferences: {
          language: 'pt-BR',
          timezone: 'America/Sao_Paulo',
        },
      },
    }),
    prisma.user.create({
      data: {
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'maria.santos@email.com',
        phone: '+5511987654322',
        cpf: '987.654.321-00',
        dateOfBirth: new Date('1985-08-20'),
        gender: 'FEMALE',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
        organizationId: organizations[0].id,
        metadata: {
          emergencyContact: {
            name: 'João Silva',
            phone: '+5511987654321',
            relationship: 'Esposo',
          },
        },
        preferences: {
          language: 'pt-BR',
          timezone: 'America/Sao_Paulo',
        },
      },
    }),
    prisma.user.create({
      data: {
        firstName: 'Pedro',
        lastName: 'Oliveira',
        email: 'pedro.oliveira@email.com',
        phone: '+5511987654323',
        cpf: '456.789.123-00',
        dateOfBirth: new Date('1975-03-10'),
        gender: 'MALE',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
        organizationId: organizations[1].id,
        metadata: {
          emergencyContact: {
            name: 'Ana Oliveira',
            phone: '+5511987654324',
            relationship: 'Filha',
          },
        },
        preferences: {
          language: 'pt-BR',
          timezone: 'America/Sao_Paulo',
        },
      },
    }),
    prisma.user.create({
      data: {
        firstName: 'Ana',
        lastName: 'Costa',
        email: 'ana.costa@email.com',
        phone: '+5511987654324',
        cpf: '789.123.456-00',
        dateOfBirth: new Date('1990-11-25'),
        gender: 'FEMALE',
        status: 'ACTIVE',
        emailVerified: false,
        phoneVerified: false,
        organizationId: organizations[1].id,
        preferences: {
          language: 'pt-BR',
          timezone: 'America/Sao_Paulo',
        },
      },
    }),
  ]);
  console.log(`✅ Created ${users.length} users\n`);

  // 4. Create Health Data
  console.log('💊 Creating health data...');
  const healthData = await Promise.all([
    prisma.healthData.create({
      data: {
        userId: users[0].id,
        type: 'CONDITION',
        category: 'CARDIOLOGY',
        value: {
          primary: 'Hipertensão Arterial',
          secondary: [],
          diagnosedDate: '2018-03-15',
          severity: 'MODERATE',
        },
        source: 'PROVIDER_ENTERED',
        organizationId: organizations[0].id,
        metadata: {
          category: 'CARDIOLOGY',
          verifiedBy: providers[0].id,
          verifiedAt: new Date().toISOString(),
          sensitivityLevel: 'SENSITIVE',
          accessLevel: 'PROVIDER_PATIENT',
        },
      },
    }),
    prisma.healthData.create({
      data: {
        userId: users[0].id,
        type: 'MEDICATION',
        category: 'CARDIOLOGY',
        value: {
          name: 'Losartana Potássica',
          dosage: '50mg',
          frequency: '1x ao dia',
          startDate: '2018-03-15',
          prescribedBy: 'Dr. Carlos Silva',
          active: true,
        },
        source: 'PROVIDER_ENTERED',
        organizationId: organizations[0].id,
        metadata: {
          category: 'CARDIOLOGY',
          verifiedBy: providers[0].id,
          verifiedAt: new Date().toISOString(),
          sensitivityLevel: 'NORMAL',
          accessLevel: 'PROVIDER_PATIENT',
        },
      },
    }),
    prisma.healthData.create({
      data: {
        userId: users[1].id,
        type: 'CONDITION',
        category: 'DIABETES',
        value: {
          primary: 'Diabetes Mellitus Tipo 2',
          diagnosedDate: '2019-06-20',
          severity: 'MODERATE',
          underControl: true,
        },
        source: 'PROVIDER_ENTERED',
        organizationId: organizations[0].id,
        metadata: {
          category: 'DIABETES',
          verifiedBy: providers[1].id,
          verifiedAt: new Date().toISOString(),
          sensitivityLevel: 'SENSITIVE',
          accessLevel: 'PROVIDER_PATIENT',
        },
      },
    }),
    prisma.healthData.create({
      data: {
        userId: users[2].id,
        type: 'ALLERGY',
        category: 'GENERAL',
        value: {
          allergen: 'Penicilina',
          reaction: 'Urticária',
          severity: 'HIGH',
          diagnosedDate: '2010-01-10',
        },
        source: 'USER_REPORTED',
        organizationId: organizations[1].id,
        metadata: {
          category: 'GENERAL',
          sensitivityLevel: 'HIGHLY_SENSITIVE',
          accessLevel: 'ORGANIZATION',
        },
      },
    }),
  ]);
  console.log(`✅ Created ${healthData.length} health data records\n`);

  // 5. Create Gamification Missions
  console.log('🎮 Creating gamification missions...');
  const missions = await Promise.all([
    prisma.mission.create({
      data: {
        title: 'Bem-vindo ao AUSTA!',
        description: 'Complete seu cadastro e conecte seu WhatsApp',
        category: 'ONBOARDING',
        difficulty: 'EASY',
        points: 100,
        organizationId: organizations[0].id,
        requiredActions: {
          steps: [
            'Preencher dados pessoais',
            'Conectar WhatsApp',
            'Aceitar termos de uso',
          ],
        },
        badgeReward: 'NEWCOMER',
        estimatedTime: 10,
        isActive: true,
        tags: ['onboarding', 'inicial'],
      },
    }),
    prisma.mission.create({
      data: {
        title: 'Primeira Consulta Agendada',
        description: 'Agende sua primeira consulta médica',
        category: 'ENGAGEMENT',
        difficulty: 'EASY',
        points: 150,
        organizationId: organizations[0].id,
        prerequisites: [],
        requiredActions: {
          steps: ['Agendar consulta'],
        },
        badgeReward: 'FIRST_APPOINTMENT',
        estimatedTime: 5,
        isActive: true,
        tags: ['consulta', 'agendamento'],
      },
    }),
    prisma.mission.create({
      data: {
        title: 'Compartilhe seus Medicamentos',
        description: 'Cadastre os medicamentos que você utiliza',
        category: 'MEDICATION_ADHERENCE',
        difficulty: 'EASY',
        points: 200,
        organizationId: organizations[0].id,
        prerequisites: [],
        requiredActions: {
          steps: [
            'Acessar área de medicamentos',
            'Cadastrar pelo menos 1 medicamento',
          ],
        },
        badgeReward: 'MEDICATION_MASTER',
        estimatedTime: 15,
        isActive: true,
        tags: ['medicamentos', 'saúde'],
      },
    }),
    prisma.mission.create({
      data: {
        title: 'Atividade Física Regular',
        description: 'Pratique 30 minutos de atividade física por dia durante 7 dias',
        category: 'LIFESTYLE',
        difficulty: 'MEDIUM',
        points: 500,
        organizationId: organizations[0].id,
        prerequisites: [],
        requiredActions: {
          steps: [
            'Registrar atividade física por 7 dias consecutivos',
            'Mínimo 30 minutos por dia',
          ],
        },
        badgeReward: 'FITNESS_CHAMPION',
        estimatedTime: 210,
        isActive: true,
        tags: ['exercícios', 'bem-estar'],
      },
    }),
    prisma.mission.create({
      data: {
        title: 'Exames em Dia',
        description: 'Mantenha seus exames preventivos em dia',
        category: 'PREVENTIVE_CARE',
        difficulty: 'MEDIUM',
        points: 300,
        organizationId: organizations[0].id,
        prerequisites: [],
        requiredActions: {
          steps: [
            'Fazer check-up anual',
            'Enviar resultados de exames',
          ],
        },
        badgeReward: 'HEALTH_GUARDIAN',
        estimatedTime: 60,
        isActive: true,
        tags: ['exames', 'prevenção'],
      },
    }),
  ]);
  console.log(`✅ Created ${missions.length} missions\n`);

  // 6. Create Onboarding Progress
  console.log('📊 Creating onboarding progress...');
  const onboardingProgress = await Promise.all([
    (prisma.onboardingProgress.create as any)({
      data: {
        userId: users[0].id,
        missionId: missions[0].id,
        organizationId: organizations[0].id,
        currentStep: 3,
        totalSteps: 3,
        status: 'COMPLETED',
        completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        metadata: {
          missionId: missions[0].id,
          organizationId: organizations[0].id,
          status: 'COMPLETED',
          progress: 100,
          totalSteps: 3,
          startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          pointsEarned: 100,
          badgeEarned: 'NEWCOMER',
          attemptsCount: 1,
          timeSpent: 10,
        },
      },
    }),
    (prisma.onboardingProgress.create as any)({
      data: {
        userId: users[1].id,
        missionId: missions[0].id,
        organizationId: organizations[0].id,
        currentStep: 3,
        totalSteps: 3,
        status: 'COMPLETED',
        completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        metadata: {
          missionId: missions[0].id,
          organizationId: organizations[0].id,
          status: 'COMPLETED',
          progress: 100,
          totalSteps: 3,
          startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          pointsEarned: 100,
          badgeEarned: 'NEWCOMER',
          attemptsCount: 1,
          timeSpent: 12,
        },
      },
    }),
  ]);
  console.log(`✅ Created ${onboardingProgress.length} onboarding progress records\n`);

  // 7. Create Health Points
  console.log('⭐ Creating health points...');
  const healthPoints = await Promise.all([
    (prisma.healthPoints.create as any)({
      data: {
        userId: users[0].id,
        organizationId: organizations[0].id,
        availablePoints: 350,
        totalPoints: 350,
        currentLevel: 2,
        streak: 5,
        longestStreak: 7,
        lastActivityAt: new Date(),
        metadata: {
          organizationId: organizations[0].id,
          availablePoints: 350,
          spentPoints: 0,
          onboardingPoints: 100,
          engagementPoints: 150,
          healthPoints: 100,
          achievementPoints: 0,
          experiencePoints: 350,
          nextLevelAt: 500,
          badges: ['NEWCOMER', 'FIRST_APPOINTMENT'],
          achievements: [
            {
              id: 'onboarding_complete',
              name: 'Cadastro Completo',
              earnedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ],
          dailyStreak: 5,
          weeklyStreak: 1,
        },
      },
    }),
    (prisma.healthPoints.create as any)({
      data: {
        userId: users[1].id,
        organizationId: organizations[0].id,
        availablePoints: 100,
        totalPoints: 100,
        currentLevel: 1,
        streak: 2,
        longestStreak: 3,
        lastActivityAt: new Date(),
        metadata: {
          organizationId: organizations[0].id,
          availablePoints: 100,
          spentPoints: 0,
          onboardingPoints: 100,
          engagementPoints: 0,
          healthPoints: 0,
          achievementPoints: 0,
          experiencePoints: 100,
          nextLevelAt: 250,
          badges: ['NEWCOMER'],
          achievements: [],
          dailyStreak: 2,
          weeklyStreak: 1,
        },
      },
    }),
  ]);
  console.log(`✅ Created ${healthPoints.length} health points records\n`);

  // 8. Create Point Transactions
  console.log('💰 Creating point transactions...');
  const transactions = await Promise.all([
    prisma.pointTransaction.create({
      data: {
        userId: users[0].id,
        healthPointsId: healthPoints[0].id,
        missionId: missions[0].id,
        type: 'EARNED',
        amount: 100,
        sourceType: 'MISSION',
        points: 100,
        reason: 'Missão completada: Bem-vindo ao AUSTA!',
        metadata: {
          sourceType: 'MISSION',
          sourceId: missions[0].id,
          missionName: 'Bem-vindo ao AUSTA!',
          completionTime: 10,
        },
      },
    }),
    prisma.pointTransaction.create({
      data: {
        userId: users[0].id,
        healthPointsId: healthPoints[0].id,
        missionId: missions[1].id,
        type: 'EARNED',
        amount: 150,
        sourceType: 'MISSION',
        points: 150,
        reason: 'Missão completada: Primeira Consulta Agendada',
        metadata: {
          sourceType: 'MISSION',
          sourceId: missions[1].id,
        },
      },
    }),
    prisma.pointTransaction.create({
      data: {
        userId: users[0].id,
        healthPointsId: healthPoints[0].id,
        type: 'EARNED',
        amount: 100,
        sourceType: 'ENGAGEMENT',
        points: 100,
        reason: 'Engajamento diário',
        metadata: {
          sourceType: 'ENGAGEMENT',
          streakDays: 5,
        },
      },
    }),
  ]);
  console.log(`✅ Created ${transactions.length} point transactions\n`);

  // 9. Create Authorizations
  console.log('📋 Creating authorizations...');
  const authorizations = await Promise.all([
    prisma.authorization.create({
      data: {
        type: 'PROCEDURE',
        procedureName: 'Ecocardiograma',
        procedureCode: '28.01.014.01',
        userId: users[0].id,
        providerId: providers[0].id,
        organizationId: organizations[0].id,
        status: 'APPROVED',
        priority: 'NORMAL',
        requestedBy: providers[0].id,
        requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        approvedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        justification: 'Avaliação da função cardíaca em paciente hipertenso',
        clinicalNotes: 'Paciente com HA controlada, sem sintomas atuais',
      } as any,
    }),
    prisma.authorization.create({
      data: {
        type: 'MEDICATION',
        procedureName: 'Insulina NPH',
        procedureCode: 'MED-INS-001',
        userId: users[1].id,
        providerId: providers[1].id,
        organizationId: organizations[0].id,
        status: 'PENDING',
        priority: 'URGENT',
        requestedBy: providers[1].id,
        requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        justification: 'Controle glicêmico inadequado com medicação oral',
        clinicalNotes: 'HbA1c 8.5%, indicado início de insulinoterapia',
        healthDataId: healthData[2].id,
        relatedConditions: ['Diabetes Mellitus Tipo 2'],
        urgencyLevel: 'HIGH' as any,
      } as any,
    }),
  ]);
  console.log(`✅ Created ${authorizations.length} authorizations\n`);

  // 10. Create Conversations
  console.log('💬 Creating conversations...');
  const conversations = await Promise.all([
    prisma.conversation.create({
      data: {
        userId: users[0].id,
        whatsappChatId: 'chat_joao_silva_001',
        organizationId: organizations[0].id,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
        lastMessageAt: new Date(),
        metadata: {
          whatsappChatId: 'chat_joao_silva_001',
          type: 'SUPPORT',
          organizationId: organizations[0].id,
          title: 'Dúvida sobre medicação',
          tags: ['medicação', 'dúvida'],
          priority: 'NORMAL',
          botEnabled: true,
          healthTopics: ['medicação', 'hipertensão'],
          messageCount: 5,
          avgResponseTime: 2.5,
        },
      },
    }),
    prisma.conversation.create({
      data: {
        userId: users[1].id,
        whatsappChatId: 'chat_maria_santos_001',
        organizationId: organizations[0].id,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
        lastMessageAt: new Date(),
        metadata: {
          whatsappChatId: 'chat_maria_santos_001',
          type: 'HEALTH_CHECK',
          organizationId: organizations[0].id,
          title: 'Acompanhamento de glicemia',
          tags: ['diabetes', 'glicemia'],
          priority: 'HIGH',
          botEnabled: true,
          healthTopics: ['diabetes', 'glicemia'],
          messageCount: 12,
          avgResponseTime: 1.8,
        },
      },
    }),
  ]);
  console.log(`✅ Created ${conversations.length} conversations\n`);

  // 11. Create Messages
  console.log('✉️ Creating messages...');
  const messages = await Promise.all([
    prisma.message.create({
      data: {
        conversationId: conversations[0].id,
        userId: users[0].id,
        content: 'Olá! Tenho dúvida sobre meu remédio de pressão',
        type: 'TEXT',
        direction: 'INBOUND',
        status: 'READ',
        readAt: new Date(),
        sentAt: new Date(),
        metadata: {
          whatsappMessageId: 'msg_001',
          aiProcessed: true,
          aiConfidence: 0.92,
          aiIntent: 'medication_question',
          aiEntities: {
            medication: ['remédio de pressão'],
            condition: ['pressão'],
          },
          healthKeywords: ['remédio', 'pressão'],
          urgencyLevel: 'LOW',
          requiresResponse: true,
        },
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversations[0].id,
        userId: users[0].id,
        content: 'Olá! Claro, estou aqui para ajudar. Qual é sua dúvida sobre a Losartana?',
        type: 'TEXT',
        direction: 'OUTBOUND',
        status: 'READ',
        readAt: new Date(),
        sentAt: new Date(),
        metadata: {
          whatsappMessageId: 'msg_002',
          isBot: true,
          botResponseTime: 1.2,
          aiProcessed: true,
          aiConfidence: 0.95,
        },
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversations[1].id,
        userId: users[1].id,
        content: 'Minha glicemia hoje está em 180 mg/dL em jejum',
        type: 'TEXT',
        direction: 'INBOUND',
        status: 'READ',
        readAt: new Date(),
        sentAt: new Date(),
        metadata: {
          whatsappMessageId: 'msg_003',
          aiProcessed: true,
          aiConfidence: 0.88,
          aiIntent: 'health_report',
          aiEntities: {
            vitalSign: ['glicemia'],
            value: ['180'],
            unit: ['mg/dL'],
            timing: ['jejum'],
          },
          healthKeywords: ['glicemia', 'jejum'],
          urgencyLevel: 'MEDIUM',
          requiresResponse: true,
        },
      },
    }),
  ]);
  console.log(`✅ Created ${messages.length} messages\n`);

  // 12. Create Tasy Integration
  console.log('🔗 Creating Tasy ERP integration...');
  const tasyIntegration = await prisma.tasyIntegration.create({
    data: {
      organizationId: organizations[0].id,
      tasyInstanceUrl: 'https://tasy.hospitalsaopaulo.com.br/api/v1',
      apiKey: 'encrypted_api_key_here',
      apiVersion: 'v1',
      isActive: true,
      lastSyncAt: new Date(Date.now() - 60 * 60 * 1000),
      syncInterval: 300,
      syncEnabled: true,
      nextSyncAt: new Date(Date.now() + 4 * 60 * 1000),
      fieldMapping: {
        patient: {
          tasyField: 'CD_PACIENTE',
          austaField: 'userId',
        },
        provider: {
          tasyField: 'CD_PRESTADOR',
          austaField: 'providerId',
        },
        procedure: {
          tasyField: 'CD_PROCEDIMENTO',
          austaField: 'procedureCode',
        },
      },
      status: 'ACTIVE',
      errorCount: 0,
      avgSyncTime: 45.5,
      recordsProcessed: 1250,
      recordsFailured: 5,
    },
  });
  console.log(`✅ Created Tasy integration\n`);

  // 13. Create Audit Logs
  console.log('📝 Creating audit logs...');
  const auditLogs = await Promise.all([
    prisma.auditLog.create({
      data: {
        userId: users[0].id,
        organizationId: organizations[0].id,
        action: 'CREATE',
        entity: 'User',
        entityId: users[0].id,
        changes: {
          description: 'Usuário criado no sistema',
        },
        metadata: {
          organizationId: organizations[0].id,
          entity: 'User',
          riskLevel: 'LOW',
          sensitiveData: true,
          lgpdRelevant: true,
        },
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: users[0].id,
        organizationId: organizations[0].id,
        action: 'CREATE',
        entity: 'Authorization',
        entityId: authorizations[0].id,
        changes: {
          description: 'Autorização de procedimento criada',
        },
        metadata: {
          providerId: providers[0].id,
          organizationId: organizations[0].id,
          entity: 'Authorization',
          riskLevel: 'MEDIUM',
          sensitiveData: true,
          lgpdRelevant: true,
        },
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: users[0].id,
        organizationId: organizations[0].id,
        action: 'READ',
        entity: 'HealthData',
        entityId: healthData[0].id,
        changes: {
          description: 'Usuário acessou seus dados de saúde',
        },
        metadata: {
          organizationId: organizations[0].id,
          entity: 'HealthData',
          riskLevel: 'LOW',
          sensitiveData: true,
          lgpdRelevant: true,
        },
      },
    }),
  ]);
  console.log(`✅ Created ${auditLogs.length} audit logs\n`);

  // Summary
  console.log('🎉 Database seeding completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   - Organizations: ${organizations.length}`);
  console.log(`   - Providers: ${providers.length}`);
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Health Data: ${healthData.length}`);
  console.log(`   - Missions: ${missions.length}`);
  console.log(`   - Onboarding Progress: ${onboardingProgress.length}`);
  console.log(`   - Health Points: ${healthPoints.length}`);
  console.log(`   - Point Transactions: ${transactions.length}`);
  console.log(`   - Authorizations: ${authorizations.length}`);
  console.log(`   - Conversations: ${conversations.length}`);
  console.log(`   - Messages: ${messages.length}`);
  console.log(`   - Tasy Integration: 1`);
  console.log(`   - Audit Logs: ${auditLogs.length}`);
  console.log('\n✅ All data seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
