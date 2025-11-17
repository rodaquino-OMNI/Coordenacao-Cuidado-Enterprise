import { UserStatus, UserRole, HealthDataType, MissionStatus, MissionDifficulty } from '@prisma/client';

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: PaginationMeta;
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * User response format for API
 */
export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  cpf: string | null;
  phone: string | null;
  status: UserStatus;
  isActive: boolean;
  role: UserRole;
  healthScore?: number;
  onboardingStatus?: OnboardingStatusData;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Onboarding status data
 */
export interface OnboardingStatusData {
  isComplete: boolean;
  currentStep: number;
  completedSteps: string[];
  stepsCompleted: number;
  totalSteps: number;
  completionPercentage: number;
}

/**
 * Health score data with breakdown
 */
export interface HealthScoreData {
  userId: string;
  currentPoints: number;
  totalEarned: number;
  level: number;
  pointsToNextLevel: number;
  progress: number;
  lastUpdated: Date;
}

/**
 * Achievement data response
 */
export interface AchievementData {
  id: string;
  points: number;
  earnedAt: Date;
  mission: {
    id: string;
    title: string;
    description: string;
    difficulty: MissionDifficulty;
    category: string | null;
  } | null;
}

/**
 * Mission data response
 */
export interface MissionData {
  id: string;
  title: string;
  description: string;
  requiredPoints: number;
  difficulty: MissionDifficulty;
  category: string | null;
  status: MissionStatus;
  isCompleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vital sign data response
 */
export interface VitalSignData {
  id: string;
  type: HealthDataType;
  value: number;
  unit: string;
  recordedAt: Date;
  notes: string | null;
  source: string | null;
}

/**
 * Vital signs statistics
 */
export interface VitalSignStats {
  type: HealthDataType;
  min: number;
  max: number;
  average: number;
  count: number;
  period: string;
  unit: string;
}

/**
 * Latest vitals summary
 */
export interface LatestVitalsData {
  [key: string]: VitalSignData;
}

/**
 * Gamification statistics
 */
export interface GamificationStats {
  currentPoints: number;
  totalEarned: number;
  level: number;
  achievementsCount: number;
  activeMissionsCount: number;
  pointsToNextLevel: number;
  progress: number;
  completionRate?: number;
  rank?: number;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  level: number;
  totalPoints: number;
  currentPoints: number;
}

/**
 * User profile complete data
 */
export interface UserProfileData extends UserResponse {
  healthScore: number;
  onboardingStatus: OnboardingStatusData | null;
  gamificationStats?: GamificationStats;
  latestVitals?: LatestVitalsData;
}

/**
 * Health data summary
 */
export interface HealthDataSummary {
  totalRecords: number;
  recordsByType: Record<string, number>;
  latestVitals: LatestVitalsData;
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };
}

/**
 * Authentication response
 */
export interface AuthResponse {
  user: UserResponse;
  token: string;
  refreshToken?: string;
  expiresAt: Date;
}

/**
 * Error response codes
 */
export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT'
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, meta?: ApiResponse['meta']): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Error response helper
 */
export function errorResponse(
  code: ErrorCode | string,
  message: string,
  details?: any
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Pagination response helper
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta
): ApiResponse<T[]> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination
    }
  };
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}
