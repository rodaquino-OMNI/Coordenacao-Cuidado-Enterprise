# Helper Functions API Documentation

## Overview

This document provides comprehensive documentation for the helper functions created to simplify controller modernization. These helpers abstract the new Prisma schema's enterprise-grade normalization patterns.

**Created:** 2025-11-17
**Session:** local-deploy-complete-2025-11-17
**Agent:** SCHEMA_HELPER_ARCHITECT

---

## Table of Contents

1. [User Helpers](#user-helpers)
2. [Health Data Helpers](#health-data-helpers)
3. [Gamification Helpers](#gamification-helpers)
4. [API Response Types](#api-response-types)

---

## User Helpers

**Location:** `src/utils/user.helpers.ts`

### Functions

#### `getFullName(user)`
Concatenates firstName and lastName for display purposes.

```typescript
function getFullName(user: Pick<User, 'firstName' | 'lastName'>): string
```

**Example:**
```typescript
const fullName = getFullName(user); // "John Doe"
```

---

#### `getUserHealthScore(userId)`
Retrieves current health score from HealthPoints table.

```typescript
async function getUserHealthScore(userId: string): Promise<number>
```

**Returns:** Current health points or 0 if not found

**Example:**
```typescript
const score = await getUserHealthScore(userId); // 450
```

---

#### `isUserActive(user)`
Checks if user status is ACTIVE.

```typescript
function isUserActive(user: Pick<User, 'status'>): boolean
```

**Example:**
```typescript
if (isUserActive(user)) {
  // User is active
}
```

---

#### `getUserOnboardingStatus(userId)`
Retrieves onboarding progress and calculates completion percentage.

```typescript
async function getUserOnboardingStatus(userId: string): Promise<{
  isComplete: boolean;
  currentStep: number;
  completedSteps: string[];
  stepsCompleted: number;
  totalSteps: number;
  completionPercentage: number;
} | null>
```

**Example:**
```typescript
const onboarding = await getUserOnboardingStatus(userId);
console.log(`${onboarding.completionPercentage}% complete`);
```

---

#### `formatUserResponse(user, includeHealthScore?)`
Formats user data for API responses.

```typescript
async function formatUserResponse(
  user: User,
  includeHealthScore: boolean = false
): Promise<UserResponse>
```

**Example:**
```typescript
const response = await formatUserResponse(user, true);
// Returns: { id, email, fullName, healthScore, ... }
```

---

#### `getUserProfile(userId)`
Gets complete user profile including health score and onboarding.

```typescript
async function getUserProfile(userId: string): Promise<UserProfileData | null>
```

**Example:**
```typescript
const profile = await getUserProfile(userId);
```

---

#### `updateUserStatus(userId, status)`
Updates user status field.

```typescript
async function updateUserStatus(userId: string, status: UserStatus): Promise<User>
```

---

#### `activateUser(userId)` / `deactivateUser(userId)` / `suspendUser(userId)`
Convenience functions for status changes.

```typescript
async function activateUser(userId: string): Promise<User>
async function deactivateUser(userId: string): Promise<User>
async function suspendUser(userId: string): Promise<User>
```

**Example:**
```typescript
await activateUser(userId);
```

---

#### `hasCompletedOnboarding(userId)`
Checks if user completed onboarding.

```typescript
async function hasCompletedOnboarding(userId: string): Promise<boolean>
```

---

#### `getUsersByStatus(status, limit?)`
Retrieves users filtered by status.

```typescript
async function getUsersByStatus(
  status: UserStatus,
  limit: number = 100
): Promise<User[]>
```

---

#### `searchUsers(query, limit?)`
Searches users by name or email.

```typescript
async function searchUsers(query: string, limit: number = 50): Promise<User[]>
```

**Example:**
```typescript
const results = await searchUsers("john");
```

---

## Health Data Helpers

**Location:** `src/utils/health-data.helpers.ts`

### Functions

#### `getVitalSigns(userId, types?, limit?)`
Retrieves vital signs filtered by type.

```typescript
async function getVitalSigns(
  userId: string,
  types?: HealthDataType[],
  limit: number = 100
): Promise<HealthData[]>
```

**Example:**
```typescript
const vitals = await getVitalSigns(userId, [
  HealthDataType.BLOOD_PRESSURE_SYSTOLIC,
  HealthDataType.HEART_RATE
]);
```

---

#### `recordVitalSign(userId, data)`
Records a new vital sign measurement.

```typescript
async function recordVitalSign(
  userId: string,
  data: {
    type: HealthDataType;
    value: number;
    unit: string;
    recordedAt?: Date;
    notes?: string;
    source?: string;
  }
): Promise<HealthData>
```

**Example:**
```typescript
await recordVitalSign(userId, {
  type: HealthDataType.BLOOD_PRESSURE_SYSTOLIC,
  value: 120,
  unit: "mmHg",
  notes: "Morning reading"
});
```

---

#### `getLatestVitals(userId)`
Gets the most recent reading for each vital sign type.

```typescript
async function getLatestVitals(userId: string): Promise<Record<string, HealthData>>
```

**Example:**
```typescript
const latest = await getLatestVitals(userId);
// { BLOOD_PRESSURE_SYSTOLIC: {...}, HEART_RATE: {...} }
```

---

#### `getVitalSignsInRange(userId, startDate, endDate, type?)`
Retrieves vital signs within a date range.

```typescript
async function getVitalSignsInRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  type?: HealthDataType
): Promise<HealthData[]>
```

---

#### Specific Vital Sign Getters

```typescript
async function getBloodPressureReadings(userId: string, limit?: number): Promise<HealthData[]>
async function getBloodGlucoseReadings(userId: string, limit?: number): Promise<HealthData[]>
async function getHeartRateReadings(userId: string, limit?: number): Promise<HealthData[]>
async function getWeightReadings(userId: string, limit?: number): Promise<HealthData[]>
```

---

#### `getAverageVitalSign(userId, type, days?)`
Calculates average value for a vital sign type.

```typescript
async function getAverageVitalSign(
  userId: string,
  type: HealthDataType,
  days: number = 30
): Promise<number | null>
```

**Example:**
```typescript
const avgGlucose = await getAverageVitalSign(
  userId,
  HealthDataType.BLOOD_GLUCOSE,
  7
);
```

---

#### `getVitalSignStats(userId, type, days?)`
Gets statistics (min, max, average) for a vital sign.

```typescript
async function getVitalSignStats(
  userId: string,
  type: HealthDataType,
  days: number = 30
): Promise<{
  min: number;
  max: number;
  average: number;
  count: number;
  period: string;
} | null>
```

---

#### `deleteHealthRecords(userId, recordIds)`
Deletes health data records (with authorization check).

```typescript
async function deleteHealthRecords(userId: string, recordIds: string[]): Promise<number>
```

---

#### `updateHealthRecord(recordId, userId, updates)`
Updates a health data record.

```typescript
async function updateHealthRecord(
  recordId: string,
  userId: string,
  updates: {
    value?: number;
    unit?: string;
    notes?: string;
    recordedAt?: Date;
  }
)
```

---

#### `getHealthDataCounts(userId)`
Gets count of records by type.

```typescript
async function getHealthDataCounts(userId: string): Promise<Record<string, number>>
```

---

## Gamification Helpers

**Location:** `src/utils/gamification.helpers.ts`

### Functions

#### `getUserAchievements(userId, limit?)`
Retrieves user's achievements (completed missions).

```typescript
async function getUserAchievements(userId: string, limit: number = 100): Promise<AchievementData[]>
```

**Example:**
```typescript
const achievements = await getUserAchievements(userId);
```

---

#### `awardAchievement(userId, missionId, points)`
Awards an achievement to a user.

```typescript
async function awardAchievement(
  userId: string,
  missionId: string,
  points: number
): Promise<PointTransaction>
```

**Note:** Creates transaction and updates health points atomically.

**Example:**
```typescript
await awardAchievement(userId, missionId, 50);
```

---

#### `getUserMissions(userId, status?, limit?)`
Gets user's missions with completion status.

```typescript
async function getUserMissions(
  userId: string,
  status?: MissionStatus,
  limit: number = 100
): Promise<Array<Mission & { isCompleted: boolean }>>
```

---

#### `calculateUserLevel(points)`
Calculates user level from total points.

```typescript
function calculateUserLevel(points: number): number
```

**Formula:** Every 100 points = 1 level

**Example:**
```typescript
const level = calculateUserLevel(450); // 5
```

---

#### `getPointsForNextLevel(currentLevel)`
Gets points required for next level.

```typescript
function getPointsForNextLevel(currentLevel: number): number
```

---

#### `getUserGamificationStats(userId)`
Gets comprehensive gamification statistics.

```typescript
async function getUserGamificationStats(userId: string): Promise<GamificationStats>
```

**Returns:**
```typescript
{
  currentPoints: number;
  totalEarned: number;
  level: number;
  achievementsCount: number;
  activeMissionsCount: number;
  pointsToNextLevel: number;
  progress: number; // percentage to next level
}
```

---

#### `getAvailableMissions(userId, difficulty?)`
Gets missions not yet completed by user.

```typescript
async function getAvailableMissions(
  userId: string,
  difficulty?: MissionDifficulty
): Promise<Mission[]>
```

---

#### `completeMission(userId, missionId)`
Completes a mission for a user (validates and awards points).

```typescript
async function completeMission(userId: string, missionId: string): Promise<PointTransaction>
```

---

#### `getLeaderboard(limit?)`
Gets top users by points.

```typescript
async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]>
```

**Example:**
```typescript
const top10 = await getLeaderboard(10);
```

---

#### `getUserRank(userId)`
Gets user's rank on the leaderboard.

```typescript
async function getUserRank(userId: string): Promise<number | null>
```

---

#### `createMission(data)`
Creates a new mission.

```typescript
async function createMission(data: {
  title: string;
  description: string;
  requiredPoints: number;
  difficulty: MissionDifficulty;
  category?: string;
  status?: MissionStatus;
}): Promise<Mission>
```

---

#### `updateMissionStatus(missionId, status)`
Updates mission status.

```typescript
async function updateMissionStatus(
  missionId: string,
  status: MissionStatus
): Promise<Mission>
```

---

#### `getMissionCompletionRate(userId)`
Gets user's mission completion rate percentage.

```typescript
async function getMissionCompletionRate(userId: string): Promise<number>
```

---

## API Response Types

**Location:** `src/types/api-responses.ts`

### Core Types

#### `ApiResponse<T>`
Standard API response wrapper.

```typescript
interface ApiResponse<T = any> {
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
```

---

#### `UserResponse`
User data for API responses.

```typescript
interface UserResponse {
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
```

---

#### `VitalSignData`
Vital sign measurement response.

```typescript
interface VitalSignData {
  id: string;
  type: HealthDataType;
  value: number;
  unit: string;
  recordedAt: Date;
  notes: string | null;
  source: string | null;
}
```

---

#### `AchievementData`
Achievement response format.

```typescript
interface AchievementData {
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
```

---

### Helper Functions

#### `successResponse<T>(data, meta?)`
Creates a success response.

```typescript
function successResponse<T>(data: T, meta?: ApiResponse['meta']): ApiResponse<T>
```

**Example:**
```typescript
return successResponse(userData);
```

---

#### `errorResponse(code, message, details?)`
Creates an error response.

```typescript
function errorResponse(
  code: ErrorCode | string,
  message: string,
  details?: any
): ApiResponse
```

**Example:**
```typescript
return errorResponse(ErrorCode.NOT_FOUND, "User not found");
```

---

#### `paginatedResponse<T>(data, pagination)`
Creates a paginated response.

```typescript
function paginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta
): ApiResponse<T[]>
```

---

#### `calculatePagination(page, pageSize, totalItems)`
Calculates pagination metadata.

```typescript
function calculatePagination(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationMeta
```

---

## Usage in Controllers

### Example: User Controller Migration

**Before (Old Schema):**
```typescript
// Used user.name directly
const userName = user.name;

// Used user.isActive boolean
if (user.isActive) { ... }

// Used user.healthScore directly
const score = user.healthScore;
```

**After (New Schema with Helpers):**
```typescript
import { getFullName, isUserActive, getUserHealthScore } from '../utils/user.helpers';

// Use helper to get full name
const userName = getFullName(user);

// Use helper to check active status
if (isUserActive(user)) { ... }

// Use helper to get health score
const score = await getUserHealthScore(user.id);
```

---

### Example: Health Data Controller

```typescript
import {
  recordVitalSign,
  getLatestVitals,
  getVitalSignStats
} from '../utils/health-data.helpers';
import { successResponse } from '../types/api-responses';

// Record new vital sign
await recordVitalSign(userId, {
  type: HealthDataType.BLOOD_GLUCOSE,
  value: 95,
  unit: "mg/dL"
});

// Get latest vitals
const latestVitals = await getLatestVitals(userId);

// Get statistics
const stats = await getVitalSignStats(
  userId,
  HealthDataType.BLOOD_GLUCOSE,
  30
);

// Return formatted response
return successResponse({ latestVitals, stats });
```

---

### Example: Gamification Controller

```typescript
import {
  getUserGamificationStats,
  completeMission,
  getLeaderboard
} from '../utils/gamification.helpers';

// Get user stats
const stats = await getUserGamificationStats(userId);

// Complete mission
await completeMission(userId, missionId);

// Get leaderboard
const leaderboard = await getLeaderboard(10);
```

---

## Migration Checklist

- [ ] Replace `user.name` with `getFullName(user)`
- [ ] Replace `user.isActive` with `isUserActive(user)`
- [ ] Replace `user.healthScore` with `await getUserHealthScore(userId)`
- [ ] Replace `user.onboardingComplete` with `await getUserOnboardingStatus(userId)`
- [ ] Update achievement queries to use `getUserAchievements()`
- [ ] Update vital signs queries to use health data helpers
- [ ] Use API response helpers for consistent formatting

---

## Summary

**Total Deliverables:**
- 39 helper functions
- 16 TypeScript types
- 1,030 lines of clean, documented code
- 4 organized utility files

**Key Benefits:**
1. **Abstraction:** Controllers don't need to know schema details
2. **Consistency:** Single source of truth for data access
3. **Type Safety:** Full TypeScript support
4. **Maintainability:** Changes isolated to helpers
5. **Testability:** Pure functions easy to test
6. **Documentation:** Comprehensive JSDoc comments

---

**Created by:** SCHEMA_HELPER_ARCHITECT Agent
**Session:** local-deploy-complete-2025-11-17
**Status:** ✅ Complete and Ready for Integration
