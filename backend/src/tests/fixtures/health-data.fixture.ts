/**
 * Health Data Test Fixtures
 * Predefined health data for testing
 */

import { HealthDataFactory } from '../utils/mock-factory';
import { testUsers } from './users.fixture';

/**
 * Standard vital signs data
 */
export const testVitalSigns = {
  normal: HealthDataFactory.createVitalSigns({
    id: 'vital-1',
    userId: testUsers.patient1.id,
    data: {
      heartRate: 72,
      bloodPressure: {
        systolic: 120,
        diastolic: 80,
      },
      temperature: 36.8,
      oxygenSaturation: 98,
    },
    source: 'device',
    verified: true,
  }),

  elevated: HealthDataFactory.createVitalSigns({
    id: 'vital-2',
    userId: testUsers.patient1.id,
    data: {
      heartRate: 95,
      bloodPressure: {
        systolic: 145,
        diastolic: 92,
      },
      temperature: 37.2,
      oxygenSaturation: 96,
    },
    source: 'manual',
    verified: false,
  }),

  critical: HealthDataFactory.createVitalSigns({
    id: 'vital-3',
    userId: testUsers.patient2.id,
    data: {
      heartRate: 110,
      bloodPressure: {
        systolic: 165,
        diastolic: 105,
      },
      temperature: 38.5,
      oxygenSaturation: 92,
    },
    source: 'device',
    verified: true,
  }),
};

/**
 * Standard medication data
 */
export const testMedications = {
  metformin: HealthDataFactory.createMedication({
    id: 'med-1',
    userId: testUsers.patient1.id,
    data: {
      name: 'Metformin',
      dosage: '500mg',
      frequency: 'twice_daily',
      takenAt: new Date('2025-11-15T08:00:00Z'),
    },
    source: 'manual',
    verified: true,
  }),

  lisinopril: HealthDataFactory.createMedication({
    id: 'med-2',
    userId: testUsers.patient1.id,
    data: {
      name: 'Lisinopril',
      dosage: '10mg',
      frequency: 'daily',
      takenAt: new Date('2025-11-15T09:00:00Z'),
    },
    source: 'manual',
    verified: true,
  }),

  aspirin: HealthDataFactory.createMedication({
    id: 'med-3',
    userId: testUsers.patient2.id,
    data: {
      name: 'Aspirin',
      dosage: '81mg',
      frequency: 'daily',
      takenAt: new Date('2025-11-15T07:00:00Z'),
    },
    source: 'manual',
    verified: false,
  }),

  prn: HealthDataFactory.createMedication({
    id: 'med-4',
    userId: testUsers.patient1.id,
    data: {
      name: 'Ibuprofen',
      dosage: '200mg',
      frequency: 'as_needed',
      takenAt: new Date('2025-11-15T14:00:00Z'),
    },
    source: 'manual',
    verified: true,
  }),
};

/**
 * Standard lab results
 */
export const testLabResults = {
  bloodGlucose: HealthDataFactory.create({
    id: 'lab-1',
    userId: testUsers.patient1.id,
    type: 'lab_result',
    data: {
      testName: 'Blood Glucose',
      value: 145,
      unit: 'mg/dL',
      referenceRange: { min: 70, max: 100 },
    },
    source: 'ehr',
    verified: true,
  }),

  a1c: HealthDataFactory.create({
    id: 'lab-2',
    userId: testUsers.patient1.id,
    type: 'lab_result',
    data: {
      testName: 'A1C',
      value: 7.2,
      unit: '%',
      referenceRange: { min: 4, max: 5.6 },
    },
    source: 'ehr',
    verified: true,
  }),

  cholesterol: HealthDataFactory.create({
    id: 'lab-3',
    userId: testUsers.patient1.id,
    type: 'lab_result',
    data: {
      testName: 'Cholesterol',
      value: 195,
      unit: 'mg/dL',
      referenceRange: { min: 0, max: 200 },
    },
    source: 'ehr',
    verified: true,
  }),
};

/**
 * Standard symptom data
 */
export const testSymptoms = {
  headache: HealthDataFactory.create({
    id: 'symp-1',
    userId: testUsers.patient2.id,
    type: 'symptom',
    data: {
      name: 'headache',
      severity: 8,
      duration: 2,
      notes: 'Throbbing pain on the right side',
    },
    source: 'manual',
    verified: false,
  }),

  fatigue: HealthDataFactory.create({
    id: 'symp-2',
    userId: testUsers.patient1.id,
    type: 'symptom',
    data: {
      name: 'fatigue',
      severity: 5,
      duration: 12,
      notes: 'Feeling tired throughout the day',
    },
    source: 'manual',
    verified: false,
  }),

  nausea: HealthDataFactory.create({
    id: 'symp-3',
    userId: testUsers.patient1.id,
    type: 'symptom',
    data: {
      name: 'nausea',
      severity: 3,
      duration: 1,
      notes: 'Mild nausea after breakfast',
    },
    source: 'manual',
    verified: false,
  }),
};

/**
 * Standard activity data
 */
export const testActivities = {
  walking: HealthDataFactory.create({
    id: 'act-1',
    userId: testUsers.patient1.id,
    type: 'activity',
    data: {
      type: 'walking',
      duration: 30,
      distance: 2.5,
      calories: 150,
    },
    source: 'device',
    verified: true,
  }),

  running: HealthDataFactory.create({
    id: 'act-2',
    userId: testUsers.patient2.id,
    type: 'activity',
    data: {
      type: 'running',
      duration: 45,
      distance: 6.5,
      calories: 425,
    },
    source: 'device',
    verified: true,
  }),

  cycling: HealthDataFactory.create({
    id: 'act-3',
    userId: testUsers.patient1.id,
    type: 'activity',
    data: {
      type: 'cycling',
      duration: 60,
      distance: 15,
      calories: 350,
    },
    source: 'device',
    verified: true,
  }),
};

/**
 * Health data groups for batch testing
 */
export const healthDataGroups = {
  allVitalSigns: Object.values(testVitalSigns),
  allMedications: Object.values(testMedications),
  allLabResults: Object.values(testLabResults),
  allSymptoms: Object.values(testSymptoms),
  allActivities: Object.values(testActivities),
  patient1Data: [
    testVitalSigns.normal,
    testVitalSigns.elevated,
    testMedications.metformin,
    testMedications.lisinopril,
    testLabResults.bloodGlucose,
    testLabResults.a1c,
    testSymptoms.fatigue,
  ],
};

/**
 * Helper to get health data by ID
 */
export function getHealthDataById(id: string): any {
  const allData = [
    ...Object.values(testVitalSigns),
    ...Object.values(testMedications),
    ...Object.values(testLabResults),
    ...Object.values(testSymptoms),
    ...Object.values(testActivities),
  ];
  return allData.find(data => data.id === id);
}

/**
 * Helper to get health data by user ID
 */
export function getHealthDataByUserId(userId: string): any[] {
  const allData = [
    ...Object.values(testVitalSigns),
    ...Object.values(testMedications),
    ...Object.values(testLabResults),
    ...Object.values(testSymptoms),
    ...Object.values(testActivities),
  ];
  return allData.filter(data => data.userId === userId);
}

/**
 * Helper to get health data by type
 */
export function getHealthDataByType(type: string): any[] {
  const allData = [
    ...Object.values(testVitalSigns),
    ...Object.values(testMedications),
    ...Object.values(testLabResults),
    ...Object.values(testSymptoms),
    ...Object.values(testActivities),
  ];
  return allData.filter(data => data.type === type);
}
