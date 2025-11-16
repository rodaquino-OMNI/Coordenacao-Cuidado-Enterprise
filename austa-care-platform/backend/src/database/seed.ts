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
 * Context: Brazilian healthcare system with HIPAA/LGPD compliance
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
        hipaaCompliant: true,
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
        hipaaCompliant: true,
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
        hipaaCompliant: true,
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
        whatsappId: 'wa_joao_silva_123',
        preferredLanguage: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        isActive: true,
        isVerified: true,
        organizationId: organizations[0].id,
        emergencyContact: {
          name: 'Maria Silva',
          phone: '+5511987654322',
          relationship: 'Esposa',
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
        whatsappId: 'wa_maria_santos_456',
        preferredLanguage: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        isActive: true,
        isVerified: true,
        organizationId: organizations[0].id,
        emergencyContact: {
          name: 'João Silva',
          phone: '+5511987654321',
          relationship: 'Esposo',
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
        whatsappId: 'wa_pedro_oliveira_789',
        preferredLanguage: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        isActive: true,
        isVerified: true,
        organizationId: organizations[1].id,
        emergencyContact: {
          name: 'Ana Oliveira',
          phone: '+5511987654324',
          relationship: 'Filha',
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
        whatsappId: 'wa_ana_costa_012',
        preferredLanguage: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        isActive: true,
        isVerified: false,
        organizationId: organizations[1].id,
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
        organizationId: organizations[0].id,
        type: 'CONDITION',
        category: 'CARDIOLOGY',
        conditions: {
          primary: 'Hipertensão Arterial',
          secondary: [],
          diagnosedDate: '2018-03-15',
          severity: 'MODERATE',
        },
        source: 'PROVIDER_ENTERED',
        reliability: 'VERIFIED',
        isVerified: true,
        verifiedBy: providers[0].id,
        verifiedAt: new Date(),
        sensitivityLevel: 'SENSITIVE',
        accessLevel: 'PROVIDER_PATIENT',
      },
    }),
    prisma.healthData.create({
      data: {
        userId: users[0].id,
        organizationId: organizations[0].id,
        type: 'MEDICATION',
        category: 'CARDIOLOGY',
        medications: {
          name: 'Losartana Potássica',
          dosage: '50mg',
          frequency: '1x ao dia',
          startDate: '2018-03-15',
          prescribedBy: 'Dr. Carlos Silva',
          active: true,
        },
        source: 'PROVIDER_ENTERED',
        reliability: 'VERIFIED',
        isVerified: true,
        verifiedBy: providers[0].id,
        verifiedAt: new Date(),
        sensitivityLevel: 'NORMAL',
        accessLevel: 'PROVIDER_PATIENT',
      },
    }),
    prisma.healthData.create({
      data: {
        userId: users[1].id,
        organizationId: organizations[0].id,
        type: 'CONDITION',
        category: 'DIABETES',
        conditions: {
          primary: 'Diabetes Mellitus Tipo 2',
          diagnosedDate: '2019-06-20',
          severity: 'MODERATE',
          underControl: true,
        },
        source: 'PROVIDER_ENTERED',
        reliability: 'VERIFIED',
        isVerified: true,
        verifiedBy: providers[1].id,
        verifiedAt: new Date(),
        sensitivityLevel: 'SENSITIVE',
        accessLevel: 'PROVIDER_PATIENT',
      },
    }),
    prisma.healthData.create({
      data: {
        userId: users[2].id,
        organizationId: organizations[1].id,
        type: 'ALLERGY',
        category: 'GENERAL',
        allergies: {
          allergen: 'Penicilina',
          reaction: 'Urticária',
          severity: 'HIGH',
          diagnosedDate: '2010-01-10',
        },
        source: 'USER_REPORTED',
        reliability: 'MEDIUM',
        isVerified: false,
        sensitivityLevel: 'HIGHLY_SENSITIVE',
        accessLevel: 'ORGANIZATION',
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
        pointsReward: 100,
        badgeReward: 'NEWCOMER',
        prerequisites: [],
        requiredActions: {
          steps: [
            'Preencher dados pessoais',
            'Conectar WhatsApp',
            'Aceitar termos de uso',
          ],
        },
        isActive: true,
        organizationId: organizations[0].id,
        estimatedTime: 10,
        tags: ['onboarding', 'inicial'],
      },
    }),
    prisma.mission.create({
      data: {
        title: 'Primeira Consulta Agendada',
        description: 'Agende sua primeira consulta médica',
        category: 'ENGAGEMENT',
        difficulty: 'EASY',
        pointsReward: 150,
        badgeReward: 'FIRST_APPOINTMENT',
        prerequisites: [],
        requiredActions: {
          steps: ['Agendar consulta'],
        },
        isActive: true,
        organizationId: organizations[0].id,
        estimatedTime: 5,
        tags: ['consulta', 'agendamento'],
      },
    }),
    prisma.mission.create({
      data: {
        title: 'Compartilhe seus Medicamentos',
        description: 'Cadastre os medicamentos que você utiliza',
        category: 'HEALTH_EDUCATION',
        difficulty: 'EASY',
        pointsReward: 200,
        badgeReward: 'MEDICATION_MASTER',
        prerequisites: [],
        requiredActions: {
          steps: [
            'Acessar área de medicamentos',
            'Cadastrar pelo menos 1 medicamento',
          ],
        },
        isActive: true,
        organizationId: organizations[0].id,
        estimatedTime: 15,
        tags: ['medicamentos', 'saúde'],
      },
    }),
    prisma.mission.create({
      data: {
        title: 'Atividade Física Regular',
        description: 'Pratique 30 minutos de atividade física por dia durante 7 dias',
        category: 'LIFESTYLE',
        difficulty: 'MEDIUM',
        pointsReward: 500,
        badgeReward: 'FITNESS_CHAMPION',
        prerequisites: [],
        requiredActions: {
          steps: [
            'Registrar atividade física por 7 dias consecutivos',
            'Mínimo 30 minutos por dia',
          ],
        },
        isActive: true,
        organizationId: organizations[0].id,
        estimatedTime: 210,
        tags: ['exercícios', 'bem-estar'],
      },
    }),
    prisma.mission.create({
      data: {
        title: 'Exames em Dia',
        description: 'Mantenha seus exames preventivos em dia',
        category: 'PREVENTIVE_CARE',
        difficulty: 'MEDIUM',
        pointsReward: 300,
        badgeReward: 'HEALTH_GUARDIAN',
        prerequisites: [],
        requiredActions: {
          steps: [
            'Fazer check-up anual',
            'Enviar resultados de exames',
          ],
        },
        isActive: true,
        organizationId: organizations[0].id,
        estimatedTime: 60,
        tags: ['exames', 'prevenção'],
      },
    }),
  ]);
  console.log(`✅ Created ${missions.length} missions\n`);

  // 6. Create Onboarding Progress
  console.log('📊 Creating onboarding progress...');
  const onboardingProgress = await Promise.all([
    prisma.onboardingProgress.create({
      data: {
        userId: users[0].id,
        missionId: missions[0].id,
        organizationId: organizations[0].id,
        status: 'COMPLETED',
        progress: 100,
        currentStep: 3,
        totalSteps: 3,
        startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        pointsEarned: 100,
        badgeEarned: 'NEWCOMER',
        attemptsCount: 1,
        timeSpent: 10,
      },
    }),
    prisma.onboardingProgress.create({
      data: {
        userId: users[0].id,
        missionId: missions[2].id,
        organizationId: organizations[0].id,
        status: 'IN_PROGRESS',
        progress: 50,
        currentStep: 1,
        totalSteps: 2,
        startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        attemptsCount: 1,
        timeSpent: 5,
      },
    }),
    prisma.onboardingProgress.create({
      data: {
        userId: users[1].id,
        missionId: missions[0].id,
        organizationId: organizations[0].id,
        status: 'COMPLETED',
        progress: 100,
        currentStep: 3,
        totalSteps: 3,
        startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        pointsEarned: 100,
        badgeEarned: 'NEWCOMER',
        attemptsCount: 1,
        timeSpent: 12,
      },
    }),
  ]);
  console.log(`✅ Created ${onboardingProgress.length} onboarding progress records\n`);

  // 7. Create Health Points
  console.log('⭐ Creating health points...');
  const healthPoints = await Promise.all([
    prisma.healthPoints.create({
      data: {
        userId: users[0].id,
        organizationId: organizations[0].id,
        totalPoints: 350,
        availablePoints: 350,
        spentPoints: 0,
        onboardingPoints: 100,
        engagementPoints: 150,
        healthPoints: 100,
        achievementPoints: 0,
        currentLevel: 2,
        experiencePoints: 350,
        nextLevelAt: 500,
        badges: ['NEWCOMER', 'FIRST_APPOINTMENT'],
        achievements: [
          {
            id: 'onboarding_complete',
            name: 'Cadastro Completo',
            earnedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
        ],
        dailyStreak: 5,
        weeklyStreak: 1,
        longestStreak: 7,
      },
    }),
    prisma.healthPoints.create({
      data: {
        userId: users[1].id,
        organizationId: organizations[0].id,
        totalPoints: 100,
        availablePoints: 100,
        spentPoints: 0,
        onboardingPoints: 100,
        engagementPoints: 0,
        healthPoints: 0,
        achievementPoints: 0,
        currentLevel: 1,
        experiencePoints: 100,
        nextLevelAt: 250,
        badges: ['NEWCOMER'],
        achievements: [],
        dailyStreak: 2,
        weeklyStreak: 1,
        longestStreak: 3,
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
        type: 'EARNED',
        amount: 100,
        reason: 'Missão completada: Bem-vindo ao AUSTA!',
        sourceType: 'MISSION',
        sourceId: missions[0].id,
        metadata: {
          missionName: 'Bem-vindo ao AUSTA!',
          completionTime: 10,
        },
      },
    }),
    prisma.pointTransaction.create({
      data: {
        userId: users[0].id,
        healthPointsId: healthPoints[0].id,
        type: 'EARNED',
        amount: 150,
        reason: 'Missão completada: Primeira Consulta Agendada',
        sourceType: 'MISSION',
        sourceId: missions[1].id,
      },
    }),
    prisma.pointTransaction.create({
      data: {
        userId: users[0].id,
        healthPointsId: healthPoints[0].id,
        type: 'EARNED',
        amount: 100,
        reason: 'Engajamento diário',
        sourceType: 'ENGAGEMENT',
        metadata: {
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
        description: 'Ecocardiograma transtorácico com Doppler',
        userId: users[0].id,
        providerId: providers[0].id,
        organizationId: organizations[0].id,
        healthDataId: healthData[0].id,
        relatedConditions: ['Hipertensão Arterial'],
        status: 'APPROVED',
        priority: 'NORMAL',
        urgencyLevel: 'MEDIUM',
        requestedBy: providers[0].id,
        reviewedBy: providers[3].id,
        approvedBy: providers[3].id,
        requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        reviewedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        approvedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        validFrom: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        justification: 'Avaliação da função cardíaca em paciente hipertenso',
        clinicalNotes: 'Paciente com HA controlada, sem sintomas atuais',
      },
    }),
    prisma.authorization.create({
      data: {
        type: 'MEDICATION',
        procedureName: 'Insulina NPH',
        procedureCode: 'MED-INS-001',
        description: 'Insulina NPH 100UI/ml - 3 frascos',
        userId: users[1].id,
        providerId: providers[1].id,
        organizationId: organizations[0].id,
        healthDataId: healthData[2].id,
        relatedConditions: ['Diabetes Mellitus Tipo 2'],
        status: 'PENDING',
        priority: 'HIGH',
        urgencyLevel: 'HIGH',
        requestedBy: providers[1].id,
        requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        justification: 'Controle glicêmico inadequado com medicação oral',
        clinicalNotes: 'HbA1c 8.5%, indicado início de insulinoterapia',
      },
    }),
  ]);
  console.log(`✅ Created ${authorizations.length} authorizations\n`);

  // 10. Create Conversations
  console.log('💬 Creating conversations...');
  const conversations = await Promise.all([
    prisma.conversation.create({
      data: {
        whatsappChatId: 'chat_joao_silva_001',
        status: 'ACTIVE',
        type: 'SUPPORT',
        userId: users[0].id,
        organizationId: organizations[0].id,
        title: 'Dúvida sobre medicação',
        tags: ['medicação', 'dúvida'],
        priority: 'NORMAL',
        botEnabled: true,
        healthTopics: ['medicação', 'hipertensão'],
        messageCount: 5,
        avgResponseTime: 2.5,
      },
    }),
    prisma.conversation.create({
      data: {
        whatsappChatId: 'chat_maria_santos_001',
        status: 'ACTIVE',
        type: 'HEALTH_CHECK',
        userId: users[1].id,
        organizationId: organizations[0].id,
        title: 'Acompanhamento de glicemia',
        tags: ['diabetes', 'glicemia'],
        priority: 'HIGH',
        botEnabled: true,
        healthTopics: ['diabetes', 'glicemia'],
        messageCount: 12,
        avgResponseTime: 1.8,
      },
    }),
  ]);
  console.log(`✅ Created ${conversations.length} conversations\n`);

  // 11. Create Messages
  console.log('✉️ Creating messages...');
  const messages = await Promise.all([
    prisma.message.create({
      data: {
        whatsappMessageId: 'msg_001',
        direction: 'INBOUND',
        type: 'TEXT',
        content: 'Olá! Tenho dúvida sobre meu remédio de pressão',
        conversationId: conversations[0].id,
        userId: users[0].id,
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
        status: 'READ',
        readAt: new Date(),
      },
    }),
    prisma.message.create({
      data: {
        whatsappMessageId: 'msg_002',
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: 'Olá! Claro, estou aqui para ajudar. Qual é sua dúvida sobre a Losartana?',
        conversationId: conversations[0].id,
        userId: users[0].id,
        isBot: true,
        botResponseTime: 1.2,
        aiProcessed: true,
        aiConfidence: 0.95,
        status: 'READ',
        readAt: new Date(),
      },
    }),
    prisma.message.create({
      data: {
        whatsappMessageId: 'msg_003',
        direction: 'INBOUND',
        type: 'TEXT',
        content: 'Minha glicemia hoje está em 180 mg/dL em jejum',
        conversationId: conversations[1].id,
        userId: users[1].id,
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
        status: 'READ',
        readAt: new Date(),
      },
    }),
  ]);
  console.log(`✅ Created ${messages.length} messages\n`);

  // 12. Create Tasy Integration
  console.log('🔗 Creating Tasy ERP integration...');
  const tasyIntegration = await prisma.tasyIntegration.create({
    data: {
      organizationId: organizations[0].id,
      tasyInstanceUrl: 'https://tasy.hospitalsaopaulo.com.br',
      apiVersion: 'v1',
      isActive: true,
      apiKey: 'encrypted_api_key_here',
      syncEnabled: true,
      syncInterval: 300,
      lastSyncAt: new Date(Date.now() - 60 * 60 * 1000),
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

  // 13. Create Audit Logs (without entity-specific foreign keys to avoid constraint issues)
  console.log('📝 Creating audit logs...');
  const auditLogs = await Promise.all([
    prisma.auditLog.create({
      data: {
        userId: users[0].id,
        organizationId: organizations[0].id,
        action: 'CREATE',
        entity: 'User',
        // Note: entityId is set but not connected via specific FK relations
        description: 'Usuário criado no sistema',
        riskLevel: 'LOW',
        sensitiveData: true,
        hipaaRelevant: true,
        lgpdRelevant: true,
      },
    }),
    prisma.auditLog.create({
      data: {
        providerId: providers[0].id,
        organizationId: organizations[0].id,
        action: 'CREATE',
        entity: 'Authorization',
        // Note: entityId is set but not connected via specific FK relations
        description: 'Autorização de procedimento criada',
        riskLevel: 'MEDIUM',
        sensitiveData: true,
        hipaaRelevant: true,
        lgpdRelevant: true,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: users[0].id,
        organizationId: organizations[0].id,
        action: 'READ',
        entity: 'HealthData',
        // Note: entityId is set but not connected via specific FK relations
        description: 'Usuário acessou seus dados de saúde',
        riskLevel: 'LOW',
        sensitiveData: true,
        hipaaRelevant: true,
        lgpdRelevant: true,
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
