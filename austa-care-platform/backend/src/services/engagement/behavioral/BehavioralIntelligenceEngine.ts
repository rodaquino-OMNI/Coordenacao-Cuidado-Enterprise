import { BaseEngagementService, Repository, MockRepository } from '../base/BaseEngagementService';
import {
  UserBehaviorProfile,
  EngagementEvent,
  EngagementPattern,
  MotivationType,
  CommunicationStyle,
  RiskTolerance,
  LiteracyLevel,
  CulturalContext
} from '../../../types/engagement/behavioralTypes';

export class BehavioralIntelligenceEngine extends BaseEngagementService {
  private userBehaviorRepository: Repository<UserBehaviorProfile>;
  private engagementEventRepository: Repository<EngagementEvent>;

  constructor(
    userBehaviorRepository?: Repository<UserBehaviorProfile>,
    engagementEventRepository?: Repository<EngagementEvent>
  ) {
    super({ name: 'BehavioralIntelligenceEngine', version: '1.0.0' });
    this.userBehaviorRepository = userBehaviorRepository || new MockRepository<UserBehaviorProfile>();
    this.engagementEventRepository = engagementEventRepository || new MockRepository<EngagementEvent>();
  }

  protected async onInitialize(): Promise<void> {
    console.log('BehavioralIntelligenceEngine initialized');
  }

  async analyzeBehavior(userId: string): Promise<UserBehaviorProfile> {
    const existingProfile = await this.userBehaviorRepository.findOne({ where: { userId } });
    
    if (existingProfile) {
      return existingProfile;
    }

    // Create a new behavior profile
    const profile: UserBehaviorProfile = {
      userId,
      engagementPattern: EngagementPattern.MODERATELY_ENGAGED,
      motivationType: MotivationType.INTRINSIC,
      communicationPreference: CommunicationStyle.SUPPORTIVE,
      riskTolerance: RiskTolerance.MEDIUM,
      healthLiteracyLevel: LiteracyLevel.INTERMEDIATE,
      culturalContext: CulturalContext.INDIVIDUALISTIC,
      preferredContactTimes: [{
        dayOfWeek: 1, // Monday
        startHour: 8,
        endHour: 12,
        timezone: 'America/Sao_Paulo'
      }],
      responseTimePattern: 30, // 30 minutes average
      sessionLengthPreference: 15, // 15 minutes
      topicInterests: ['health_improvement'],
      avoidanceTopics: [],
      lastProfileUpdate: new Date(),
      confidenceScore: 0.5
    };

    return await this.userBehaviorRepository.save(profile);
  }

  async updateBehaviorProfile(userId: string, updates: Partial<UserBehaviorProfile>): Promise<UserBehaviorProfile> {
    const existing = await this.userBehaviorRepository.findOne({ where: { userId } });
    if (!existing) {
      throw new Error(`User profile not found: ${userId}`);
    }

    const updated = { ...existing, ...updates, lastUpdated: new Date() };
    return await this.userBehaviorRepository.save(updated);
  }

  async trackEngagementEvent(event: EngagementEvent): Promise<void> {
    await this.engagementEventRepository.save(event);

    // Update behavior profile based on engagement
    const profile = await this.analyzeBehavior(event.userId);

    // Update engagement pattern based on event quality
    let newEngagementPattern = profile.engagementPattern;
    if (event.quality && event.quality > 0.7) {
      newEngagementPattern = EngagementPattern.HIGHLY_ENGAGED;
    } else if (event.quality && event.quality > 0.4) {
      newEngagementPattern = EngagementPattern.MODERATELY_ENGAGED;
    }

    await this.updateBehaviorProfile(event.userId, {
      engagementPattern: newEngagementPattern
    });
  }
}

export const behavioralIntelligenceEngine = new BehavioralIntelligenceEngine();