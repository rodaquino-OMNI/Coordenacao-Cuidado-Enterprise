import { PrismaClient, User, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get user's full name by combining firstName and lastName
 * @param user - User object with firstName and lastName
 * @returns Full name as a string
 */
export function getFullName(user: Pick<User, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

/**
 * Get user's current health score from HealthPoints table
 * @param userId - User ID to query
 * @returns Current health points or 0 if not found
 */
export async function getUserHealthScore(userId: string): Promise<number> {
  const healthPoints = await prisma.healthPoints.findUnique({
    where: { userId },
    select: { currentPoints: true }
  });
  return healthPoints?.currentPoints ?? 0;
}

/**
 * Check if user is active based on status field
 * @param user - User object with status field
 * @returns True if user status is ACTIVE
 */
export function isUserActive(user: Pick<User, 'status'>): boolean {
  return user.status === UserStatus.ACTIVE;
}

/**
 * Get user's onboarding status and completion percentage
 * @param userId - User ID to query
 * @returns Onboarding progress data or null if not found
 */
export async function getUserOnboardingStatus(userId: string) {
  const onboarding = await prisma.onboardingProgress.findUnique({
    where: { userId },
    select: {
      isCompleted: true,
      currentStep: true,
      completedSteps: true,
      completedAt: true
    }
  });

  if (!onboarding) {
    return null;
  }

  // Calculate progress based on completed steps (assume 5 total steps)
  const totalSteps = 5;
  const stepsCompleted = onboarding.completedSteps.length;
  const completionPercentage = totalSteps > 0
    ? Math.round((stepsCompleted / totalSteps) * 100)
    : 0;

  return {
    isComplete: onboarding.isCompleted,
    currentStep: parseInt(onboarding.currentStep) || 1,
    completedSteps: onboarding.completedSteps,
    stepsCompleted,
    totalSteps,
    completionPercentage,
    completedAt: onboarding.completedAt
  };
}

/**
 * Format user data for API responses
 * @param user - User object from database
 * @param includeHealthScore - Whether to include health score (async query)
 * @returns Formatted user response
 */
export async function formatUserResponse(
  user: User,
  includeHealthScore: boolean = false
) {
  const response: any = {
    id: user.id,
    email: user.email,
    fullName: getFullName(user),
    firstName: user.firstName,
    lastName: user.lastName,
    cpf: user.cpf,
    phone: user.phone,
    status: user.status,
    isActive: isUserActive(user),
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  if (includeHealthScore) {
    response.healthScore = await getUserHealthScore(user.id);
  }

  return response;
}

/**
 * Get complete user profile including related data
 * @param userId - User ID to query
 * @returns Complete user profile with health score and onboarding status
 */
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    return null;
  }

  const [healthScore, onboardingStatus] = await Promise.all([
    getUserHealthScore(userId),
    getUserOnboardingStatus(userId)
  ]);

  return {
    ...user,
    fullName: getFullName(user),
    healthScore,
    onboardingStatus
  };
}

/**
 * Update user status
 * @param userId - User ID to update
 * @param status - New status value
 * @returns Updated user
 */
export async function updateUserStatus(userId: string, status: UserStatus) {
  return prisma.user.update({
    where: { id: userId },
    data: { status }
  });
}

/**
 * Activate user account
 * @param userId - User ID to activate
 * @returns Updated user
 */
export async function activateUser(userId: string) {
  return updateUserStatus(userId, UserStatus.ACTIVE);
}

/**
 * Deactivate user account
 * @param userId - User ID to deactivate
 * @returns Updated user
 */
export async function deactivateUser(userId: string) {
  return updateUserStatus(userId, UserStatus.INACTIVE);
}

/**
 * Suspend user account
 * @param userId - User ID to suspend
 * @returns Updated user
 */
export async function suspendUser(userId: string) {
  return updateUserStatus(userId, UserStatus.SUSPENDED);
}

/**
 * Check if user has completed onboarding
 * @param userId - User ID to check
 * @returns True if onboarding is complete
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const onboarding = await prisma.onboardingProgress.findUnique({
    where: { userId },
    select: { isCompleted: true }
  });
  return onboarding?.isCompleted ?? false;
}

/**
 * Get users by status
 * @param status - User status to filter by
 * @param limit - Maximum number of users to return
 * @returns Array of users with the specified status
 */
export async function getUsersByStatus(
  status: UserStatus,
  limit: number = 100
) {
  return prisma.user.findMany({
    where: { status },
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Search users by name or email
 * @param query - Search query string
 * @param limit - Maximum number of results
 * @returns Array of matching users
 */
export async function searchUsers(query: string, limit: number = 50) {
  return prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } }
      ]
    },
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
}
