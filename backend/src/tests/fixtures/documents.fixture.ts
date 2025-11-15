/**
 * Document Test Fixtures
 * Predefined document data for testing
 */

import { DocumentFactory } from '../utils/mock-factory';
import { testUsers } from './users.fixture';

/**
 * Standard test documents
 */
export const testDocuments = {
  // Medical record PDF
  medicalRecord: DocumentFactory.createMedicalRecord({
    id: 'doc-1',
    userId: testUsers.patient1.id,
    filename: 'medical-record-2025.pdf',
    mimeType: 'application/pdf',
    size: 2457600, // 2.4 MB
    category: 'medical_record',
    s3Key: 'documents/test-patient-1/medical-record-2025.pdf',
    metadata: {
      uploadedBy: testUsers.patient1.id,
      description: 'Annual medical examination results',
      tags: ['annual', 'checkup', '2025'],
    },
    processingStatus: 'completed',
    extractedText: 'Patient: John Doe\nDate: 2025-01-15\nDiagnosis: Type 2 Diabetes...',
    virusScanStatus: 'clean',
  }),

  // Lab result PDF
  labResult: DocumentFactory.create({
    id: 'doc-2',
    userId: testUsers.patient1.id,
    filename: 'lab-results-glucose.pdf',
    mimeType: 'application/pdf',
    size: 512000, // 500 KB
    category: 'lab_result',
    s3Key: 'documents/test-patient-1/lab-results-glucose.pdf',
    metadata: {
      uploadedBy: testUsers.provider1.id,
      description: 'Glucose tolerance test results',
      tags: ['lab', 'glucose', 'diabetes'],
    },
    processingStatus: 'completed',
    extractedText: 'Test: Glucose Tolerance\nResult: 145 mg/dL\nReference: 70-100 mg/dL',
    virusScanStatus: 'clean',
  }),

  // Prescription image
  prescription: DocumentFactory.create({
    id: 'doc-3',
    userId: testUsers.patient1.id,
    filename: 'prescription-metformin.jpg',
    mimeType: 'image/jpeg',
    size: 1536000, // 1.5 MB
    category: 'prescription',
    s3Key: 'documents/test-patient-1/prescription-metformin.jpg',
    metadata: {
      uploadedBy: testUsers.patient1.id,
      description: 'Metformin prescription from Dr. Johnson',
      tags: ['prescription', 'metformin', 'diabetes'],
    },
    processingStatus: 'completed',
    extractedText: 'Rx: Metformin 500mg\nSig: Take 1 tablet twice daily with meals',
    virusScanStatus: 'clean',
  }),

  // Medical image
  xrayImage: DocumentFactory.create({
    id: 'doc-4',
    userId: testUsers.patient2.id,
    filename: 'chest-xray-2025.png',
    mimeType: 'image/png',
    size: 3072000, // 3 MB
    category: 'image',
    s3Key: 'documents/test-patient-2/chest-xray-2025.png',
    metadata: {
      uploadedBy: testUsers.provider1.id,
      description: 'Chest X-ray - routine screening',
      tags: ['xray', 'chest', 'screening'],
    },
    processingStatus: 'completed',
    extractedText: null, // Images may not have extracted text
    virusScanStatus: 'clean',
  }),

  // Generic document
  generalDocument: DocumentFactory.create({
    id: 'doc-5',
    userId: testUsers.patient1.id,
    filename: 'insurance-card.jpg',
    mimeType: 'image/jpeg',
    size: 768000, // 750 KB
    category: 'document',
    s3Key: 'documents/test-patient-1/insurance-card.jpg',
    metadata: {
      uploadedBy: testUsers.patient1.id,
      description: 'Health insurance card front and back',
      tags: ['insurance', 'card', 'important'],
    },
    processingStatus: 'completed',
    extractedText: 'Insurance Company: Blue Cross\nMember ID: 123456789',
    virusScanStatus: 'clean',
  }),

  // Processing document
  processingDocument: DocumentFactory.create({
    id: 'doc-6',
    userId: testUsers.patient1.id,
    filename: 'recent-upload.pdf',
    mimeType: 'application/pdf',
    size: 2048000, // 2 MB
    category: 'medical_record',
    s3Key: 'documents/test-patient-1/recent-upload.pdf',
    metadata: {
      uploadedBy: testUsers.patient1.id,
      description: 'Recently uploaded document',
      tags: ['recent'],
    },
    processingStatus: 'processing',
    extractedText: null,
    virusScanStatus: 'pending',
  }),

  // Failed processing document
  failedDocument: DocumentFactory.create({
    id: 'doc-7',
    userId: testUsers.patient1.id,
    filename: 'corrupted-file.pdf',
    mimeType: 'application/pdf',
    size: 256000, // 250 KB
    category: 'document',
    s3Key: 'documents/test-patient-1/corrupted-file.pdf',
    metadata: {
      uploadedBy: testUsers.patient1.id,
      description: 'Failed to process',
      tags: ['error'],
    },
    processingStatus: 'failed',
    extractedText: null,
    virusScanStatus: 'clean',
  }),

  // Large document
  largeDocument: DocumentFactory.create({
    id: 'doc-8',
    userId: testUsers.patient1.id,
    filename: 'complete-health-history.pdf',
    mimeType: 'application/pdf',
    size: 10485760, // 10 MB (max size)
    category: 'medical_record',
    s3Key: 'documents/test-patient-1/complete-health-history.pdf',
    metadata: {
      uploadedBy: testUsers.coordinator1.id,
      description: 'Complete patient health history',
      tags: ['history', 'comprehensive', 'important'],
    },
    processingStatus: 'completed',
    extractedText: 'Comprehensive patient history spanning 20 years...',
    virusScanStatus: 'clean',
  }),
};

/**
 * Document groups for batch testing
 */
export const documentGroups = {
  patient1Documents: [
    testDocuments.medicalRecord,
    testDocuments.labResult,
    testDocuments.prescription,
    testDocuments.generalDocument,
    testDocuments.processingDocument,
    testDocuments.failedDocument,
    testDocuments.largeDocument,
  ],
  patient2Documents: [testDocuments.xrayImage],
  completedDocuments: [
    testDocuments.medicalRecord,
    testDocuments.labResult,
    testDocuments.prescription,
    testDocuments.xrayImage,
    testDocuments.generalDocument,
    testDocuments.largeDocument,
  ],
  processingDocuments: [testDocuments.processingDocument],
  failedDocuments: [testDocuments.failedDocument],
  imageDocuments: [
    testDocuments.prescription,
    testDocuments.xrayImage,
    testDocuments.generalDocument,
  ],
  pdfDocuments: [
    testDocuments.medicalRecord,
    testDocuments.labResult,
    testDocuments.processingDocument,
    testDocuments.failedDocument,
    testDocuments.largeDocument,
  ],
};

/**
 * Document upload requests for testing
 */
export const documentUploadRequests = {
  validPdf: {
    filename: 'new-document.pdf',
    mimeType: 'application/pdf',
    size: 1024000,
    category: 'medical_record',
  },
  validImage: {
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    size: 2048000,
    category: 'image',
  },
  invalidType: {
    filename: 'document.exe',
    mimeType: 'application/x-executable',
    size: 1024000,
    category: 'document',
  },
  tooLarge: {
    filename: 'huge-file.pdf',
    mimeType: 'application/pdf',
    size: 52428800, // 50 MB (too large)
    category: 'document',
  },
};

/**
 * Helper to get document by ID
 */
export function getDocumentById(id: string): any {
  return Object.values(testDocuments).find(doc => doc.id === id);
}

/**
 * Helper to get documents by user ID
 */
export function getDocumentsByUserId(userId: string): any[] {
  return Object.values(testDocuments).filter(doc => doc.userId === userId);
}

/**
 * Helper to get documents by category
 */
export function getDocumentsByCategory(category: string): any[] {
  return Object.values(testDocuments).filter(doc => doc.category === category);
}

/**
 * Helper to get documents by processing status
 */
export function getDocumentsByStatus(status: string): any[] {
  return Object.values(testDocuments).filter(doc => doc.processingStatus === status);
}
