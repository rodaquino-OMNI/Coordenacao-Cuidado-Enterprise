# AUSTA Care Platform - Testing Infrastructure

## Overview

Comprehensive testing infrastructure for the AUSTA Care Platform backend, designed to ensure >80% code coverage and maintain high code quality standards.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Types](#test-types)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Test Utilities](#test-utilities)
6. [Fixtures](#fixtures)
7. [Templates](#templates)
8. [Best Practices](#best-practices)
9. [Coverage Requirements](#coverage-requirements)

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Install test dependencies
npm install --save-dev jest ts-jest @types/jest supertest @faker-js/faker
```

### Environment Setup

Create `.env.test` file:

```bash
# Test Database
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=austa_test
TEST_DB_USER=postgres
TEST_DB_PASSWORD=postgres

# Test Redis
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6379
TEST_REDIS_DB=1

# Test Kafka
TEST_KAFKA_BROKERS=localhost:9092

# Test Configuration
NODE_ENV=test
LOG_LEVEL=error
```

### Run Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- user.service.test.ts
```

## Test Types

### 1. Unit Tests (`src/tests/unit/`)

Test individual components in isolation with mocked dependencies.

**Example:**
```typescript
// src/tests/unit/services/user.service.test.ts
import { UserService } from '@services/user.service';

describe('UserService', () => {
  it('should create user', async () => {
    // Test logic here
  });
});
```

### 2. Integration Tests (`src/tests/integration/`)

Test multiple components working together with real database/Redis connections.

**Example:**
```typescript
// src/tests/integration/api/users.test.ts
import request from 'supertest';

describe('User API Integration', () => {
  it('should create and retrieve user', async () => {
    // Test full workflow
  });
});
```

### 3. E2E Tests (`src/tests/e2e/`)

Test complete user workflows from end to end.

**Example:**
```typescript
// src/tests/e2e/registration-flow.test.ts
describe('User Registration Flow', () => {
  it('should complete registration and login', async () => {
    // Test complete flow
  });
});
```

## Running Tests

### NPM Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --selectProjects unit",
    "test:integration": "jest --selectProjects integration",
    "test:e2e": "jest --selectProjects e2e",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

### Coverage Thresholds

Configured in `jest.config.js`:
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

```bash
# Check coverage
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

## Writing Tests

### Test Structure (Arrange-Act-Assert)

```typescript
describe('FeatureName', () => {
  describe('methodName', () => {
    it('should do something when condition', () => {
      // Arrange - Set up test data and mocks
      const input = { name: 'test' };
      const expected = { id: '123', name: 'test' };
      mockService.create.mockResolvedValue(expected);

      // Act - Execute the code under test
      const result = await service.create(input);

      // Assert - Verify the results
      expect(result).toEqual(expected);
      expect(mockService.create).toHaveBeenCalledWith(input);
    });
  });
});
```

### Using Templates

Copy templates from `src/tests/templates/` and customize:

```bash
# Copy service test template
cp src/tests/templates/service.test.template.ts \
   src/tests/unit/services/my-service.test.ts

# Edit and replace placeholders
# - YourService → MyService
# - YourRepository → MyRepository
```

### Test Naming Convention

- **Files**: `*.test.ts` (e.g., `user.service.test.ts`)
- **Describe blocks**: Feature/component name
- **It blocks**: `should [expected behavior] when [condition]`

**Examples:**
```typescript
it('should create user when valid data provided');
it('should throw error when email already exists');
it('should return 404 when user not found');
```

## Test Utilities

### Mock Factory (`utils/mock-factory.ts`)

Generate realistic test data:

```typescript
import { UserFactory, ConversationFactory } from '@tests/utils/mock-factory';

// Create single user
const user = UserFactory.createPatient({
  email: 'test@example.com',
});

// Create multiple users
const users = UserFactory.createMany(5);

// Create conversation with messages
const conversation = ConversationFactory.createWithMessages(10);
```

### Test Helpers (`utils/test-helpers.ts`)

Common utilities for testing:

```typescript
import {
  createMockRequest,
  createMockResponse,
  createAuthenticatedRequest,
  waitFor,
  sleep,
} from '@tests/utils/test-helpers';

// Mock Express objects
const req = createMockRequest({ body: { data: 'test' } });
const res = createMockResponse();

// Authenticated request
const authReq = createAuthenticatedRequest('user-id', 'patient');

// Wait for async condition
await waitFor(() => result.status === 'completed', 5000);
```

### Database Setup (`utils/test-db.setup.ts`)

Manage test database:

```typescript
import {
  setupTestDatabase,
  cleanupTestDatabase,
  clearTestDatabase,
  createTestTransaction,
} from '@tests/utils/test-db.setup';

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await clearTestDatabase(); // Clear data between tests
});

afterAll(async () => {
  await cleanupTestDatabase();
});
```

### Redis Setup (`utils/test-redis.setup.ts`)

Manage test Redis:

```typescript
import {
  setupTestRedis,
  getTestRedis,
  clearTestRedis,
  createMockRedis,
} from '@tests/utils/test-redis.setup';

// Integration tests - real Redis
beforeAll(async () => {
  await setupTestRedis();
});

beforeEach(async () => {
  await clearTestRedis();
});

// Unit tests - mock Redis
const mockRedis = createMockRedis();
```

### Kafka Setup (`utils/test-kafka.setup.ts`)

Manage test Kafka:

```typescript
import {
  setupTestKafka,
  publishTestMessages,
  consumeTestMessages,
  createMockKafka,
} from '@tests/utils/test-kafka.setup';

// Integration tests
beforeAll(async () => {
  await setupTestKafka();
});

// Publish and consume
await publishTestMessages('test-topic', [{ key: 'test', value: { data: 'test' } }]);
const messages = await consumeTestMessages('test-topic', 5000);

// Unit tests - mock Kafka
const mockKafka = createMockKafka();
```

## Fixtures

Pre-defined test data for consistent testing.

### User Fixtures (`fixtures/users.fixture.ts`)

```typescript
import { testUsers, userGroups } from '@tests/fixtures/users.fixture';

// Use predefined users
const patient = testUsers.patient1;
const provider = testUsers.provider1;

// Use groups
const allPatients = userGroups.allPatients;
```

### Conversation Fixtures (`fixtures/conversations.fixture.ts`)

```typescript
import {
  testConversations,
  conversationsWithMessages,
} from '@tests/fixtures/conversations.fixture';

const conversation = conversationsWithMessages.healthAssessmentFull;
```

### Health Data Fixtures (`fixtures/health-data.fixture.ts`)

```typescript
import {
  testVitalSigns,
  testMedications,
  testLabResults,
} from '@tests/fixtures/health-data.fixture';

const vitals = testVitalSigns.normal;
const medication = testMedications.metformin;
```

### Document Fixtures (`fixtures/documents.fixture.ts`)

```typescript
import { testDocuments, documentGroups } from '@tests/fixtures/documents.fixture';

const document = testDocuments.medicalRecord;
const allPdfs = documentGroups.pdfDocuments;
```

## Templates

### Available Templates

1. **Service Test Template** - `templates/service.test.template.ts`
2. **Controller Test Template** - `templates/controller.test.template.ts`
3. **Middleware Test Template** - `templates/middleware.test.template.ts`
4. **Integration Test Template** - `templates/integration.test.template.ts`

### Using Templates

1. Copy template to appropriate location
2. Replace placeholder names (YourService, YourController, etc.)
3. Customize test cases for your component
4. Add edge cases and error scenarios

## Best Practices

### 1. Test Independence

- Each test should be independent
- Use `beforeEach` to reset state
- Don't rely on test execution order

### 2. Descriptive Tests

```typescript
// ✅ Good
it('should return 404 when user not found')

// ❌ Bad
it('test user')
```

### 3. Mock External Dependencies

```typescript
// Mock database
const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
};

// Mock external services
jest.mock('@services/external-api');
```

### 4. Test Edge Cases

- Null/undefined inputs
- Empty arrays/objects
- Maximum/minimum values
- Concurrent operations
- Error conditions

### 5. Async Testing

```typescript
// Use async/await
it('should create user', async () => {
  const result = await service.createUser(data);
  expect(result).toBeDefined();
});

// Or return promise
it('should create user', () => {
  return service.createUser(data).then(result => {
    expect(result).toBeDefined();
  });
});
```

### 6. Cleanup

```typescript
afterEach(() => {
  jest.clearAllMocks(); // Clear mock calls
});

afterAll(async () => {
  await cleanupTestDatabase(); // Close connections
});
```

### 7. Test Organization

```
src/tests/
├── unit/              # Unit tests mirror src/ structure
│   ├── services/
│   ├── controllers/
│   └── middleware/
├── integration/       # Integration tests by feature
│   ├── api/
│   └── workflows/
├── e2e/              # End-to-end tests by user flow
│   ├── registration/
│   └── messaging/
├── fixtures/         # Test data
├── templates/        # Test templates
└── utils/           # Test utilities
```

## Coverage Requirements

### Target Coverage

- **Overall**: 80% minimum
- **Critical paths**: 100%
- **New features**: 90%+

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### CI/CD Integration

```bash
# Run in CI environment
npm run test:ci

# Fail build if coverage below threshold
jest --coverage --coverageThreshold='{"global": {"statements": 80}}'
```

## Troubleshooting

### Tests Timing Out

Increase timeout in `jest.config.js`:
```javascript
testTimeout: 30000 // 30 seconds
```

Or per test:
```typescript
it('slow test', async () => {
  jest.setTimeout(60000);
  // test code
});
```

### Database Connection Issues

Check `.env.test` configuration and ensure test database exists:
```bash
createdb austa_test
```

### Redis/Kafka Not Available

Use mocks for unit tests:
```typescript
import { createMockRedis, createMockKafka } from '@tests/utils';
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

## Support

For questions or issues with testing infrastructure:
- Review templates in `src/tests/templates/`
- Check existing tests for examples
- Consult team testing guidelines
