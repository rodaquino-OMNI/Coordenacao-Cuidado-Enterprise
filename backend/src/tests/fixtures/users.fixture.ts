/**
 * User Test Fixtures
 * Predefined user data for testing
 */

import { UserFactory } from '../utils/mock-factory';

/**
 * Standard test users
 */
export const testUsers = {
  // Active patient user
  patient1: UserFactory.createPatient({
    id: 'test-patient-1',
    email: 'patient1@test.com',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    dateOfBirth: new Date('1980-01-01'),
    gender: 'male',
    language: 'en',
    isActive: true,
    emailVerified: true,
  }),

  // Secondary patient user
  patient2: UserFactory.createPatient({
    id: 'test-patient-2',
    email: 'patient2@test.com',
    firstName: 'Jane',
    lastName: 'Smith',
    phoneNumber: '+1234567891',
    dateOfBirth: new Date('1990-05-15'),
    gender: 'female',
    language: 'en',
    isActive: true,
    emailVerified: true,
  }),

  // Portuguese-speaking patient
  patientPt: UserFactory.createPatient({
    id: 'test-patient-pt',
    email: 'paciente@test.com',
    firstName: 'Maria',
    lastName: 'Silva',
    phoneNumber: '+5511999999999',
    dateOfBirth: new Date('1985-03-20'),
    gender: 'female',
    language: 'pt',
    isActive: true,
    emailVerified: true,
  }),

  // Healthcare provider
  provider1: UserFactory.createProvider({
    id: 'test-provider-1',
    email: 'provider1@test.com',
    firstName: 'Dr. Sarah',
    lastName: 'Johnson',
    phoneNumber: '+1234567892',
    dateOfBirth: new Date('1975-08-10'),
    gender: 'female',
    language: 'en',
    isActive: true,
    emailVerified: true,
  }),

  // Care coordinator
  coordinator1: UserFactory.createCoordinator({
    id: 'test-coordinator-1',
    email: 'coordinator1@test.com',
    firstName: 'Michael',
    lastName: 'Brown',
    phoneNumber: '+1234567893',
    dateOfBirth: new Date('1982-11-25'),
    gender: 'male',
    language: 'en',
    isActive: true,
    emailVerified: true,
  }),

  // Admin user
  admin1: UserFactory.create({
    id: 'test-admin-1',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    phoneNumber: '+1234567894',
    dateOfBirth: new Date('1970-01-01'),
    gender: 'other',
    language: 'en',
    isActive: true,
    emailVerified: true,
  }),

  // Inactive user
  inactiveUser: UserFactory.create({
    id: 'test-inactive',
    email: 'inactive@test.com',
    firstName: 'Inactive',
    lastName: 'User',
    role: 'patient',
    isActive: false,
    emailVerified: false,
  }),

  // Unverified email user
  unverifiedUser: UserFactory.create({
    id: 'test-unverified',
    email: 'unverified@test.com',
    firstName: 'Unverified',
    lastName: 'User',
    role: 'patient',
    isActive: true,
    emailVerified: false,
  }),
};

/**
 * User groups for batch testing
 */
export const userGroups = {
  allPatients: [testUsers.patient1, testUsers.patient2, testUsers.patientPt],
  allProviders: [testUsers.provider1],
  allCoordinators: [testUsers.coordinator1],
  allActive: [
    testUsers.patient1,
    testUsers.patient2,
    testUsers.patientPt,
    testUsers.provider1,
    testUsers.coordinator1,
    testUsers.admin1,
  ],
  allInactive: [testUsers.inactiveUser],
};

/**
 * User credentials for authentication testing
 */
export const userCredentials = {
  patient1: {
    email: 'patient1@test.com',
    password: 'Test123!@#',
  },
  provider1: {
    email: 'provider1@test.com',
    password: 'Provider123!@#',
  },
  admin1: {
    email: 'admin@test.com',
    password: 'Admin123!@#',
  },
  invalid: {
    email: 'invalid@test.com',
    password: 'WrongPassword123',
  },
};

/**
 * User profile updates for testing
 */
export const userUpdates = {
  validUpdate: {
    firstName: 'Updated',
    lastName: 'Name',
    phoneNumber: '+1111111111',
  },
  invalidUpdate: {
    email: 'invalid-email',
    role: 'invalid-role',
  },
  partialUpdate: {
    firstName: 'NewFirstName',
  },
};

/**
 * Helper to get user by ID
 */
export function getUserById(id: string): any {
  return Object.values(testUsers).find(user => user.id === id);
}

/**
 * Helper to get user by email
 */
export function getUserByEmail(email: string): any {
  return Object.values(testUsers).find(user => user.email === email);
}

/**
 * Helper to get users by role
 */
export function getUsersByRole(role: string): any[] {
  return Object.values(testUsers).filter(user => user.role === role);
}
