import { Mission, MissionStep, PersonaType, UserProfile } from '../types/ai';
import { logger } from '../utils/logger';
import { RedisService } from './redisService';
import { prisma } from '../config/database';
import type { TransactionType, ProgressStatus } from '@prisma/client';

export interface MissionProgress {
  userId: string;
  currentMissionId: string;
  currentStepId: string;
  totalProgress: number; // 0-100%
  healthPoints: number;
  badges: string[];
  completedMissions: string[];
  riskScore: number;
  riskFlags: string[];
}

export interface GameificationReward {
  healthPoints: number;
  badge?: string;
  unlockMessage: string;
  benefits?: string[];
}

export class MissionService {
  private redis: RedisService;
  private missions: Map<string, Mission> = new Map();

  constructor() {
    this.redis = new RedisService();
    this.initializeMissions();
  }

  private initializeMissions(): void {
    const missions: Mission[] = [
      {
        id: 'mission_1_conhecer',
        title: 'Me Conhece',
        description: 'Vamos nos conhecer melhor! Conte sobre seu dia a dia',
        type: 'onboarding',
        status: 'pending',
        steps: [
          {
            id: 'step_1_1_apresentacao',
            title: 'Apresentação',
            description: 'Apresentação inicial e consent LGPD',
            type: 'information',
            completed: false
          },
          {
            id: 'step_1_2_cotidiano',
            title: 'Cotidiano',
            description: 'Como é seu dia a dia? Trabalha, estuda, ambos?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_1_3_contexto_familiar',
            title: 'Contexto Familiar',
            description: 'Você mora sozinho(a) ou com outras pessoas?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_1_4_hobbies',
            title: 'Hobbies e Atividades',
            description: 'O que você gosta de fazer no tempo livre?',
            type: 'question',
            completed: false
          }
        ]
      },
      {
        id: 'mission_2_estilo_vida',
        title: 'Estilo de Vida',
        description: 'Vamos entender seus hábitos de saúde',
        type: 'onboarding',
        status: 'pending',
        steps: [
          {
            id: 'step_2_1_atividade_fisica',
            title: 'Atividade Física',
            description: 'Você costuma praticar atividade física?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_2_2_alimentacao',
            title: 'Alimentação',
            description: 'Como você descreveria sua alimentação?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_2_3_hidratacao',
            title: 'Hidratação',
            description: 'Você bebe bastante água durante o dia?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_2_4_habitos_sociais',
            title: 'Hábitos Sociais',
            description: 'Sobre hábitos sociais: álcool, tabaco',
            type: 'question',
            completed: false
          }
        ]
      },
      {
        id: 'mission_3_bem_estar',
        title: 'Bem-estar',
        description: 'Como está seu sono e energia?',
        type: 'onboarding',
        status: 'pending',
        steps: [
          {
            id: 'step_3_1_qualidade_sono',
            title: 'Qualidade do Sono',
            description: 'De 0 a 10, que nota daria para seu sono?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_3_2_energia_disposicao',
            title: 'Energia e Disposição',
            description: 'Como tem sido sua disposição no dia a dia?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_3_3_humor_emocional',
            title: 'Humor e Estado Emocional',
            description: 'Como definiria seu humor na maior parte do tempo?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_3_4_stress_pressao',
            title: 'Stress e Pressão',
            description: 'Você tem muito estresse na sua vida atualmente?',
            type: 'question',
            completed: false
          }
        ]
      },
      {
        id: 'mission_4_saude_atual',
        title: 'Saúde Atual',
        description: 'Como você está se sentindo?',
        type: 'onboarding',
        status: 'pending',
        steps: [
          {
            id: 'step_4_1_sintomas_desconfortos',
            title: 'Sintomas e Desconfortos',
            description: 'Tem sentido algum desconforto ultimamente?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_4_2_medicamentos_tratamentos',
            title: 'Medicamentos e Tratamentos',
            description: 'Faz algum tratamento ou usa medicação contínua?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_4_3_historico_exames',
            title: 'Histórico de Exames',
            description: 'Costuma fazer check-ups ou exames de rotina?',
            type: 'question',
            completed: false
          },
          {
            id: 'step_4_4_antecedentes_familiares',
            title: 'Antecedentes Familiares',
            description: 'Na sua família, alguém tem doenças importantes?',
            type: 'question',
            completed: false
          }
        ]
      },
      {
        id: 'mission_5_documentos',
        title: 'Documentos',
        description: 'Vamos organizar seus dados de saúde',
        type: 'onboarding',
        status: 'pending',
        steps: [
          {
            id: 'step_5_1_documentos_medicos',
            title: 'Documentos Médicos',
            description: 'Tem exames ou documentos dos últimos 12 meses?',
            type: 'action',
            completed: false
          },
          {
            id: 'step_5_2_informacoes_emergencia',
            title: 'Informações de Emergência',
            description: 'Contato de emergência e alergias',
            type: 'question',
            completed: false
          },
          {
            id: 'step_5_3_finalizacao',
            title: 'Finalização',
            description: 'Parabéns! Perfil completo',
            type: 'information',
            completed: false
          }
        ]
      }
    ];

    missions.forEach(mission => {
      this.missions.set(mission.id, mission);
    });

    logger.info(`Initialized ${missions.length} onboarding missions`);
  }

  /**
   * Get user's current mission progress
   * First checks Redis cache, then Prisma OnboardingProgress
   */
  async getUserProgress(userId: string): Promise<MissionProgress | null> {
    try {
      const progressKey = `mission_progress:${userId}`;
      const progressData = await this.redis.get(progressKey);
      
      if (progressData) {
        return JSON.parse(progressData);
      }
      
      // Fallback: check Prisma OnboardingProgress
      const onboarding = await prisma.onboardingProgress.findFirst({
        where: { userId },
      });
      
      if (onboarding) {
        // Map OnboardingProgress to MissionProgress
        // currentStep is a step index; derive mission from step range (4 steps per mission)
        const missionIndex = Math.floor((onboarding.currentStep - 1) / 4);
        const missionOrder = [
          'mission_1_conhecer',
          'mission_2_estilo_vida',
          'mission_3_bem_estar',
          'mission_4_saude_atual',
          'mission_5_documentos'
        ];
        const currentMissionId = missionOrder[Math.min(missionIndex, missionOrder.length - 1)];
        const currentStepId = `step_${onboarding.currentStep}`;
        const totalProgress: number = onboarding.status === 'COMPLETED' ? 100 : onboarding.progress;

        const progress: MissionProgress = {
          userId,
          currentMissionId,
          currentStepId,
          totalProgress,
          healthPoints: 0, // will be computed from PointTransaction
          badges: [],
          completedMissions: [], // derived from completed steps
          riskScore: 0,
          riskFlags: [],
        };
        
        // Get HealthPoints from Prisma
        const healthPoints = await prisma.healthPoints.findUnique({
          where: { userId },
        });
        if (healthPoints) {
          progress.healthPoints = healthPoints.availablePoints;
        }
        
        return progress;
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting user progress for ${userId}`, error);
      return null;
    }
  }

  /**
   * Initialize user's mission progress
   */
  async initializeUserProgress(userId: string): Promise<MissionProgress> {
    try {
      const progress: MissionProgress = {
        userId,
        currentMissionId: 'mission_1_conhecer',
        currentStepId: 'step_1_1_apresentacao',
        totalProgress: 0,
        healthPoints: 0,
        badges: [],
        completedMissions: [],
        riskScore: 0,
        riskFlags: []
      };

      await this.saveUserProgress(progress);
      return progress;
    } catch (error) {
      logger.error(`Error initializing user progress for ${userId}`, error);
      throw error;
    }
  }

  /**
   * Save user progress to Redis (cache) and Prisma (durable)
   */
  async saveUserProgress(progress: MissionProgress): Promise<void> {
    try {
      // Save to Redis as fast cache (30 day TTL)
      const progressKey = `mission_progress:${progress.userId}`;
      await this.redis.setex(progressKey, 86400 * 30, JSON.stringify(progress));
      
      // Persist to Prisma OnboardingProgress
      // Extract step number from currentStepId (e.g., "step_1_1_apresentacao" -> 1)
      const stepMatch = progress.currentStepId.match(/step_(\d+)_/);
      const stepNumber = stepMatch ? parseInt(stepMatch[1], 10) : 1;
      const isCompleted = progress.totalProgress >= 100;

      // Use findFirst since OnboardingProgress has @@unique([userId, missionId])
      const existing = await prisma.onboardingProgress.findFirst({
        where: { userId: progress.userId, missionId: progress.currentMissionId },
      });

      if (existing) {
        await prisma.onboardingProgress.update({
          where: { id: existing.id },
          data: {
            currentStep: stepNumber,
            progress: progress.totalProgress,
            status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
            completedAt: isCompleted ? new Date() : null,
            metadata: {
              healthPoints: progress.healthPoints,
              badges: progress.badges,
              riskScore: progress.riskScore,
              riskFlags: progress.riskFlags,
            } as any,
          },
        });
      } else {
        await prisma.onboardingProgress.create({
          data: {
            userId: progress.userId,
            missionId: progress.currentMissionId,
            organizationId: '', // Will be filled by trigger/default
            currentStep: stepNumber,
            totalSteps: 4,
            progress: progress.totalProgress,
            status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
            completedAt: isCompleted ? new Date() : null,
            metadata: {
              healthPoints: progress.healthPoints,
              badges: progress.badges,
              riskScore: progress.riskScore,
              riskFlags: progress.riskFlags,
            } as any,
          } as any,
        });
      }
      
      logger.debug('User progress saved to Prisma and Redis', {
        userId: progress.userId,
        totalProgress: progress.totalProgress,
        onboardingId: result.id,
      });
    } catch (error) {
      logger.error(`Error saving user progress for ${progress.userId}`, error);
      throw error;
    }
  }

  /**
   * Get current mission for user
   */
  async getCurrentMission(userId: string): Promise<Mission | null> {
    try {
      const progress = await this.getUserProgress(userId);
      if (!progress) {
        return null;
      }

      return this.missions.get(progress.currentMissionId) || null;
    } catch (error) {
      logger.error(`Error getting current mission for ${userId}`, error);
      return null;
    }
  }

  /**
   * Get current step for user
   */
  async getCurrentStep(userId: string): Promise<MissionStep | null> {
    try {
      const progress = await this.getUserProgress(userId);
      if (!progress) {
        return null;
      }

      const mission = this.missions.get(progress.currentMissionId);
      if (!mission || !mission.steps) {
        return null;
      }

      return mission.steps.find(step => step.id === progress.currentStepId) || null;
    } catch (error) {
      logger.error(`Error getting current step for ${userId}`, error);
      return null;
    }
  }

  /**
   * Complete current step and advance to next
   */
  async completeCurrentStep(userId: string, response?: string): Promise<{
    progress: MissionProgress;
    reward?: GameificationReward;
    nextStep?: MissionStep;
    missionCompleted?: boolean;
  }> {
    try {
      let progress = await this.getUserProgress(userId);
      if (!progress) {
        progress = await this.initializeUserProgress(userId);
      }

      const mission = this.missions.get(progress.currentMissionId);
      if (!mission || !mission.steps) {
        throw new Error('Invalid mission state');
      }

      // Mark current step as completed
      const currentStepIndex = mission.steps.findIndex(step => step.id === progress.currentStepId);
      if (currentStepIndex === -1) {
        throw new Error('Current step not found');
      }

      mission.steps[currentStepIndex].completed = true;
      mission.steps[currentStepIndex].response = response;

      // Check if mission is completed
      const allStepsCompleted = mission.steps.every(step => step.completed);
      let reward: GameificationReward | undefined;
      let missionCompleted = false;

      if (allStepsCompleted) {
        // Mission completed - award points and badge
        reward = this.getMissionReward(mission.id);
        progress.healthPoints += reward.healthPoints;
        if (reward.badge) {
          progress.badges.push(reward.badge);
        }
        progress.completedMissions.push(mission.id);
        missionCompleted = true;

        // Persist HealthPoints and PointTransaction to Prisma
        await this.awardHealthPointsToPrisma(userId, reward.healthPoints, mission.id, reward.badge);

        // Move to next mission
        const nextMissionId = this.getNextMissionId(mission.id);
        if (nextMissionId) {
          progress.currentMissionId = nextMissionId;
          const nextMission = this.missions.get(nextMissionId);
          progress.currentStepId = nextMission?.steps?.[0]?.id || '';
        }
      } else {
        // Move to next step in current mission
        const nextStepIndex = currentStepIndex + 1;
        if (nextStepIndex < mission.steps.length) {
          progress.currentStepId = mission.steps[nextStepIndex].id;
        }
      }

      // Update total progress
      progress.totalProgress = this.calculateTotalProgress(progress);

      // Save progress
      await this.saveUserProgress(progress);

      // Get next step
      const nextStep = await this.getCurrentStep(userId);

      logger.info(`Step completed for user ${userId}`, {
        missionId: mission.id,
        stepId: mission.steps[currentStepIndex].id,
        missionCompleted,
        healthPoints: progress.healthPoints
      });

      return {
        progress,
        reward,
        nextStep: nextStep || undefined,
        missionCompleted
      };

    } catch (error) {
      logger.error(`Error completing step for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get mission reward configuration
   */
  private getMissionReward(missionId: string): GameificationReward {
    const rewards: Record<string, GameificationReward> = {
      mission_1_conhecer: {
        healthPoints: 100,
        badge: 'Primeiro Passo',
        unlockMessage: 'Parabéns! Você completou a MISSÃO 1: ME CONHECE!',
        benefits: ['Badge "Primeiro Passo" desbloqueado']
      },
      mission_2_estilo_vida: {
        healthPoints: 150,
        badge: 'Estilo Consciente',
        unlockMessage: 'MISSÃO 2 CONCLUÍDA! Que progresso incrível!',
        benefits: ['Badge "Estilo Consciente" desbloqueado']
      },
      mission_3_bem_estar: {
        healthPoints: 200,
        badge: 'Bem-estar Consciente',
        unlockMessage: 'MISSÃO 3 FINALIZADA! Você está arrasando!',
        benefits: ['Badge "Bem-estar Consciente" desbloqueado']
      },
      mission_4_saude_atual: {
        healthPoints: 250,
        badge: 'Saúde Transparente',
        unlockMessage: 'MISSÃO 4 CONCLUÍDA! Estamos quase lá!',
        benefits: ['Badge "Saúde Transparente" desbloqueado']
      },
      mission_5_documentos: {
        healthPoints: 300,
        badge: 'Perfil Completo',
        unlockMessage: 'PARABÉNS! TODAS AS MISSÕES CONCLUÍDAS!',
        benefits: [
          'Consulta de check-up gratuita',
          'Acesso prioritário ao agendamento',
          'Relatório personalizado de saúde',
          'Programa de bem-estar customizado'
        ]
      }
    };

    return rewards[missionId] || {
      healthPoints: 50,
      unlockMessage: 'Missão completada!',
      benefits: []
    };
  }

  /**
   * Award HealthPoints to Prisma (upsert HealthPoints + create PointTransaction).
   * This is the canonical durable store for gamification points.
   */
  private async awardHealthPointsToPrisma(
    userId: string,
    points: number,
    missionId: string,
    badge?: string
  ): Promise<void> {
    try {
      // Upsert HealthPoints record
      const healthPoints = await prisma.healthPoints.upsert({
        where: { userId },
        create: {
          userId,
          organizationId: '',
          availablePoints: points,
          lifetimePoints: points,
          currentLevel: Math.floor(points / 100) + 1,
          streak: 1,
          longestStreak: 1,
          lastActivityAt: new Date(),
        } as any,
        update: {
          availablePoints: { increment: points },
          lifetimePoints: { increment: points },
          currentLevel: { increment: Math.floor(points / 100) },
          lastActivityAt: new Date(),
        },
      });

      // Create PointTransaction record for audit trail
      await prisma.pointTransaction.create({
        data: {
          userId,
          healthPointsId: healthPoints.id,
          missionId,
          amount: points,
          points,
          type: 'EARNED',
          sourceType: 'MISSION',
          reason: badge ? `Mission completed: ${badge}` : 'Mission completed',
          metadata: badge ? { badge } : undefined,
        } as any,
      });

      logger.info('HealthPoints awarded via Prisma', {
        userId,
        points,
        missionId,
        totalPoints: healthPoints.availablePoints + points,
        badge,
      });
    } catch (error) {
      logger.error(`Error awarding HealthPoints to Prisma for user ${userId}`, error);
      // Non-fatal: Redis cache still has the data, Prisma write is best-effort
    }
  }

  /**
   * Get next mission ID
   */
  private getNextMissionId(currentMissionId: string): string | null {
    const missionOrder = [
      'mission_1_conhecer',
      'mission_2_estilo_vida',
      'mission_3_bem_estar',
      'mission_4_saude_atual',
      'mission_5_documentos'
    ];

    const currentIndex = missionOrder.indexOf(currentMissionId);
    if (currentIndex === -1 || currentIndex === missionOrder.length - 1) {
      return null; // No next mission
    }

    return missionOrder[currentIndex + 1];
  }

  /**
   * Calculate total progress percentage
   */
  private calculateTotalProgress(progress: MissionProgress): number {
    const totalMissions = 5;
    const completedMissions = progress.completedMissions.length;
    
    // Base progress from completed missions
    let totalProgress = (completedMissions / totalMissions) * 100;
    
    // Add partial progress from current mission
    const currentMission = this.missions.get(progress.currentMissionId);
    if (currentMission && currentMission.steps) {
      const completedSteps = currentMission.steps.filter(step => step.completed).length;
      const totalSteps = currentMission.steps.length;
      const currentMissionProgress = (completedSteps / totalSteps) * (100 / totalMissions);
      totalProgress += currentMissionProgress;
    }

    return Math.min(Math.round(totalProgress), 100);
  }

  /**
   * Calculate health risk score based on responses
   */
  async calculateRiskScore(userId: string, responses: Record<string, any>): Promise<{
    riskScore: number;
    riskFlags: string[];
  }> {
    let riskScore = 0;
    const riskFlags: string[] = [];

    try {
      // Cardiovascular risk factors
      if (responses.headache_frequency === 'daily') {
        riskScore += 30;
        riskFlags.push('HYPERTENSION_RISK');
      }

      if (responses.chest_pain || responses.shortness_of_breath === 'at_rest') {
        riskScore += 50;
        riskFlags.push('CARDIAC_RISK');
      }

      // Diabetes risk factors
      if (responses.thirst === 'excessive' && 
          responses.diet === 'fast_food' && 
          responses.urination === 'frequent') {
        riskScore += 60;
        riskFlags.push('DIABETES_RISK');
      }

      // Sleep apnea risk
      if (responses.sleep_quality <= 6 && 
          responses.snoring === 'severe' && 
          responses.breathing_pauses === 'yes') {
        riskScore += 70;
        riskFlags.push('SLEEP_APNEA_RISK');
      }

      // Mental health risk
      if (responses.mood === 'down' && 
          responses.anhedonia === 'yes' && 
          responses.energy === 'low') {
        riskScore += 40;
        riskFlags.push('DEPRESSION_RISK');
      }

      // Substance use risk
      if (responses.smoking === 'current' && responses.cigarettes_per_day > 20) {
        riskScore += 45;
        riskFlags.push('SMOKING_RISK');
      }

      if (responses.alcohol_frequency === 'daily') {
        riskScore += 25;
        riskFlags.push('ALCOHOL_RISK');
      }

      // Update user progress with risk data
      const progress = await this.getUserProgress(userId);
      if (progress) {
        progress.riskScore = riskScore;
        progress.riskFlags = riskFlags;
        await this.saveUserProgress(progress);
      }

      logger.info(`Risk score calculated for user ${userId}`, {
        riskScore,
        riskFlags: riskFlags.length
      });

      return { riskScore, riskFlags };

    } catch (error) {
      logger.error(`Error calculating risk score for user ${userId}`, error);
      return { riskScore: 0, riskFlags: [] };
    }
  }

  /**
   * Check if escalation is needed based on risk score
   */
  shouldEscalateToHuman(riskScore: number, riskFlags: string[]): {
    escalate: boolean;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
  } {
    // Critical escalation triggers
    if (riskFlags.includes('CARDIAC_RISK') && riskScore >= 50) {
      return {
        escalate: true,
        urgency: 'critical',
        reason: 'Cardiac symptoms detected - immediate medical evaluation needed'
      };
    }

    if (riskFlags.includes('DIABETES_RISK') && riskScore >= 60) {
      return {
        escalate: true,
        urgency: 'high',
        reason: 'Multiple diabetes symptoms - urgent screening recommended'
      };
    }

    if (riskFlags.includes('SLEEP_APNEA_RISK') && riskScore >= 70) {
      return {
        escalate: true,
        urgency: 'high',
        reason: 'Sleep apnea indicators - pulmonology consultation needed'
      };
    }

    if (riskFlags.includes('DEPRESSION_RISK') && riskScore >= 40) {
      return {
        escalate: true,
        urgency: 'medium',
        reason: 'Mental health symptoms - psychology support recommended'
      };
    }

    if (riskScore >= 100) {
      return {
        escalate: true,
        urgency: 'high',
        reason: 'Multiple health risk factors detected'
      };
    }

    return {
      escalate: false,
      urgency: 'low',
      reason: 'No immediate escalation needed'
    };
  }

  /**
   * Get all missions
   */
  getAllMissions(): Mission[] {
    return Array.from(this.missions.values());
  }

  /**
   * Get mission by ID
   */
  getMissionById(missionId: string): Mission | undefined {
    return this.missions.get(missionId);
  }

  /**
   * Reset user progress (for testing or restart)
   */
  async resetUserProgress(userId: string): Promise<void> {
    try {
      const progressKey = `mission_progress:${userId}`;
      await this.redis.del(progressKey);
      
      logger.info(`User progress reset for ${userId}`);
    } catch (error) {
      logger.error(`Error resetting user progress for ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get mission statistics
   */
  async getMissionStatistics(): Promise<{
    totalUsers: number;
    completionRates: Record<string, number>;
    averageProgress: number;
    riskDistribution: Record<string, number>;
  }> {
    try {
      // This would typically query a database
      // For now, return basic structure
      return {
        totalUsers: 0,
        completionRates: {},
        averageProgress: 0,
        riskDistribution: {}
      };
    } catch (error) {
      logger.error('Error getting mission statistics', error);
      throw error;
    }
  }
}