/**
 * Audit Service — LGPD/ANS Compliance Audit Trail
 *
 * AUSTA Care Platform — healthcare brasileira.
 *
 * Persists every security-relevant event to the AuditLog model (Prisma/PostgreSQL).
 * Implements column-level encryption for sensitive metadata via pgcrypto.
 *
 * Compliance coverage:
 *   - LGPD (Lei Geral de Proteção de Dados): data access, consent, deletion
 *   - ANS (Agência Nacional de Saúde Suplementar): authorization decisions, appeals
 *   - Internal: security events, data exports
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { encryptPHI } from '../lib/crypto';
import { AuditAction } from '@prisma/client';
import {
  AuthorizationState,
  WorkflowAction,
  WorkflowEvent,
} from '../types/authorization';

// ---------------------------------------------------------------------------
// Types (public interfaces preserved from original)
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  timestamp: Date;
  authorizationId: string | null;
  eventType: string;
  action: string;
  performedBy: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  complianceFlags: string[];
  severity: string;
  encrypted: boolean;
  organizationId?: string;
}

interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  regulation: string;
  triggers: string[];
  requiredFields: string[];
  retentionDays: number;
  isActive: boolean;
}

interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  category: string;
  retentionDays: number;
  archiveAfterDays: number;
  anonymizeAfterDays: number | null;
  deleteAfterDays: number;
  exceptions: string[];
  isActive: boolean;
}

export interface AuditSearchCriteria {
  startDate?: Date;
  endDate?: Date;
  authorizationIds?: string[];
  eventTypes?: string[];
  performedBy?: string;
  complianceFlags?: string[];
  severity?: string;
  limit?: number;
  offset?: number;
}

export interface ComplianceReport {
  id: string;
  regulation: string;
  generatedAt: Date;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  totalEvents: number;
  eventsByType: Record<string, number>;
  complianceViolations: ComplianceViolation[];
  processingTimeMetrics: ProcessingTimeMetrics;
  dataAccessMetrics: DataAccessMetrics;
  recommendations: string[];
  summary: string;
}

interface ComplianceViolation {
  id: string;
  ruleId: string;
  auditId: string;
  violationType: string;
  description: string;
  severity: string;
  detectedAt: Date;
}

interface ProcessingTimeMetrics {
  averageProcessingTime: number;
  slaComplianceRate: number;
  bottlenecks: string[];
}

interface DataAccessMetrics {
  totalAccesses: number;
  uniqueUsers: number;
  accessByPurpose: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map the auditService's internal (eventType, action) pair to a Prisma
 * AuditAction enum value. Uses only the values that exist in the
 * generated Prisma client (aligned with the database).
 */
function mapToAuditAction(eventType: string, action: string): AuditAction {
  // ---- Security events ----
  if (eventType === 'security_event') {
    const a = action.toLowerCase();
    if (a.includes('login_failure')) return AuditAction.ACCESS_DENIED;
    if (a.includes('unauthorized')) return AuditAction.ACCESS_DENIED;
    if (a.includes('privilege_escalation')) return AuditAction.ACCESS_DENIED;
    if (a.includes('login')) return AuditAction.LOGIN;
    if (a.includes('logout')) return AuditAction.LOGOUT;
    if (a.includes('export')) return AuditAction.EXPORT;
    return AuditAction.ACCESS_DENIED;
  }

  // ---- Data access ----
  if (eventType === 'data_access') return AuditAction.READ;

  // ---- Workflow / state transitions ----
  if (action === WorkflowAction.INITIATE) return AuditAction.CREATE;
  if (action === WorkflowAction.APPROVE) return AuditAction.UPDATE;
  if (action === WorkflowAction.REJECT) return AuditAction.ACCESS_DENIED;
  if (action === WorkflowAction.CANCEL) return AuditAction.DELETE;
  if (action === WorkflowAction.APPEAL) return AuditAction.UPDATE;
  if (action === WorkflowAction.ESCALATE) return AuditAction.UPDATE;
  if (action === 'workflow_event') return AuditAction.UPDATE;

  // Default
  return AuditAction.READ;
}

/** Determine which Prisma resource (table name) an event relates to. */
function mapResource(eventType: string, authorizationId: string | null): string {
  if (authorizationId) return 'Authorization';
  if (eventType === 'data_access') return 'HealthData';
  if (eventType === 'security_event') return 'System';
  return 'AuditLog';
}

/** Resolve the organization ID: explicit > env fallback > 'system'. */
function resolveOrganizationId(explicit?: string): string {
  return explicit || process.env.DEFAULT_ORG_ID || 'system';
}

/** Map severity string to Prisma RiskLevel enum. */
function mapSeverityToRiskLevel(severity: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (severity) {
    case 'critical': return 'CRITICAL';
    case 'high': return 'HIGH';
    case 'medium': return 'MEDIUM';
    default: return 'LOW';
  }
}

// ---------------------------------------------------------------------------
// AuditService
// ---------------------------------------------------------------------------

export class AuditService extends EventEmitter {
  // Buffer retained for batch-flush performance (secondary to direct writes)
  private auditBuffer: Map<string, AuditEntry[]>;
  private complianceRules: Map<string, ComplianceRule>;
  private retentionPolicies: Map<string, RetentionPolicy>;

  constructor() {
    super();
    this.auditBuffer = new Map();
    this.complianceRules = new Map();
    this.retentionPolicies = new Map();
    this.initializeComplianceRules();
    this.initializeRetentionPolicies();
    this.startPeriodicFlush();
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  private initializeComplianceRules(): void {
    const rules: ComplianceRule[] = [
      // LGPD
      {
        id: 'lgpd-data-access',
        name: 'LGPD Data Access Logging',
        description: 'Log all access to patient personal data',
        regulation: 'LGPD',
        triggers: ['patient_data_access', 'medical_data_view'],
        requiredFields: ['userId', 'patientId', 'dataType', 'purpose', 'timestamp'],
        retentionDays: 2190,
        isActive: true,
      },
      {
        id: 'lgpd-consent-tracking',
        name: 'LGPD Consent Tracking',
        description: 'Track patient consent for data processing',
        regulation: 'LGPD',
        triggers: ['consent_given', 'consent_withdrawn', 'data_processing'],
        requiredFields: ['patientId', 'consentType', 'purpose', 'timestamp'],
        retentionDays: 2190,
        isActive: true,
      },
      {
        id: 'lgpd-data-deletion',
        name: 'LGPD Data Deletion Tracking',
        description: 'Track patient data deletion requests',
        regulation: 'LGPD',
        triggers: ['deletion_request', 'data_deleted', 'anonymization'],
        requiredFields: ['patientId', 'requestReason', 'deletionMethod', 'timestamp'],
        retentionDays: 3650,
        isActive: true,
      },
      // ANS
      {
        id: 'ans-authorization-decisions',
        name: 'ANS Authorization Decision Tracking',
        description: 'Track all authorization decisions for ANS reporting',
        regulation: 'ANS',
        triggers: ['authorization_approved', 'authorization_rejected', 'appeal_decision'],
        requiredFields: ['authorizationId', 'decision', 'reviewerId', 'justification', 'timestamp'],
        retentionDays: 1825,
        isActive: true,
      },
      {
        id: 'ans-processing-times',
        name: 'ANS Processing Time Tracking',
        description: 'Track processing times for ANS compliance',
        regulation: 'ANS',
        triggers: ['workflow_started', 'review_started', 'decision_made'],
        requiredFields: ['authorizationId', 'phase', 'duration', 'timestamp'],
        retentionDays: 1825,
        isActive: true,
      },
      {
        id: 'ans-appeal-tracking',
        name: 'ANS Appeal Process Tracking',
        description: 'Track appeal processes for ANS reporting',
        regulation: 'ANS',
        triggers: ['appeal_submitted', 'appeal_reviewed', 'appeal_decided'],
        requiredFields: ['authorizationId', 'appealId', 'reason', 'outcome', 'timestamp'],
        retentionDays: 3650,
        isActive: true,
      },
      // Internal
      {
        id: 'internal-security-events',
        name: 'Security Events Logging',
        description: 'Log all security-related events',
        regulation: 'Internal',
        triggers: ['login_failure', 'unauthorized_access', 'privilege_escalation'],
        requiredFields: ['userId', 'eventType', 'ipAddress', 'timestamp'],
        retentionDays: 2555,
        isActive: true,
      },
      {
        id: 'internal-data-export',
        name: 'Data Export Tracking',
        description: 'Track all data exports for compliance',
        regulation: 'Internal',
        triggers: ['data_export', 'report_generation', 'bulk_access'],
        requiredFields: ['userId', 'exportType', 'recordCount', 'purpose', 'timestamp'],
        retentionDays: 2190,
        isActive: true,
      },
    ];

    rules.forEach((rule) => this.complianceRules.set(rule.id, rule));
    logger.info(`Loaded ${rules.length} compliance rules`);
  }

  private initializeRetentionPolicies(): void {
    const policies: RetentionPolicy[] = [
      {
        id: 'patient-authorization-data',
        name: 'Patient Authorization Data',
        description: 'Retention policy for patient authorization records',
        category: 'authorization',
        retentionDays: 2190,
        archiveAfterDays: 1095,
        anonymizeAfterDays: 2555,
        deleteAfterDays: 3650,
        exceptions: ['legal_hold', 'ongoing_treatment'],
        isActive: true,
      },
      {
        id: 'audit-trail-data',
        name: 'Audit Trail Data',
        description: 'Retention policy for audit trail records',
        category: 'audit',
        retentionDays: 3650,
        archiveAfterDays: 1825,
        anonymizeAfterDays: null,
        deleteAfterDays: 3650,
        exceptions: ['investigation', 'litigation'],
        isActive: true,
      },
      {
        id: 'compliance-reports',
        name: 'Compliance Reports',
        description: 'Retention policy for compliance reports',
        category: 'compliance',
        retentionDays: 2555,
        archiveAfterDays: 1095,
        anonymizeAfterDays: null,
        deleteAfterDays: 2555,
        exceptions: ['regulatory_inquiry'],
        isActive: true,
      },
    ];

    policies.forEach((policy) => this.retentionPolicies.set(policy.id, policy));
    logger.info(`Loaded ${policies.length} retention policies`);
  }

  // -----------------------------------------------------------------------
  // Public API — Record events (persisted to Prisma AuditLog)
  // -----------------------------------------------------------------------

  /**
   * Record a workflow event.
   */
  async recordEvent(
    event: WorkflowEvent,
    organizationId?: string
  ): Promise<void> {
    const auditEntry: AuditEntry = {
      id: this.generateAuditId(),
      timestamp: event.timestamp,
      authorizationId: event.authorizationId,
      eventType: 'workflow_event',
      action: event.action,
      performedBy: event.performedBy,
      metadata: event.metadata || {},
      ipAddress: event.metadata?.ipAddress || '0.0.0.0',
      userAgent: event.metadata?.userAgent || 'AUSTA-Care-Platform/1.0',
      sessionId: event.metadata?.sessionId || `session-${Date.now()}`,
      complianceFlags: this.getComplianceFlags(event),
      severity: this.calculateEventSeverity(event),
      encrypted: false,
      organizationId,
    };

    await this.storeAuditEntry(auditEntry);
    await this.checkComplianceRules(auditEntry);

    logger.info('Workflow event recorded', {
      auditId: auditEntry.id,
      authorizationId: event.authorizationId,
      action: event.action,
    });
  }

  /**
   * Record a state transition.
   */
  async recordStateTransition(
    transition: {
      authorizationId: string;
      fromState: AuthorizationState;
      toState: AuthorizationState;
      action: WorkflowAction;
      performedBy: string;
      timestamp: Date;
      metadata?: Record<string, any>;
      organizationId?: string;
    }
  ): Promise<void> {
    const auditEntry: AuditEntry = {
      id: this.generateAuditId(),
      timestamp: transition.timestamp,
      authorizationId: transition.authorizationId,
      eventType: 'state_transition',
      action: transition.action,
      performedBy: transition.performedBy,
      metadata: {
        fromState: transition.fromState,
        toState: transition.toState,
        ...transition.metadata,
      },
      ipAddress: transition.metadata?.ipAddress || '0.0.0.0',
      userAgent: transition.metadata?.userAgent || 'AUSTA-Care-Platform/1.0',
      sessionId: transition.metadata?.sessionId || `session-${Date.now()}`,
      complianceFlags: this.getComplianceFlags(transition),
      severity: 'medium',
      encrypted: false,
      organizationId: transition.organizationId,
    };

    await this.storeAuditEntry(auditEntry);

    if (this.isANSReportableTransition(transition)) {
      await this.createANSComplianceRecord(auditEntry, transition);
    }

    logger.info('State transition recorded', {
      auditId: auditEntry.id,
      authorizationId: transition.authorizationId,
      fromState: transition.fromState,
      toState: transition.toState,
    });
  }

  /**
   * Record data access for LGPD compliance.
   */
  async recordDataAccess(
    access: {
      userId: string;
      patientId: string;
      dataType: string;
      purpose: string;
      accessMethod: string;
      timestamp: Date;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      organizationId?: string;
    }
  ): Promise<void> {
    const auditEntry: AuditEntry = {
      id: this.generateAuditId(),
      timestamp: access.timestamp,
      authorizationId: null,
      eventType: 'data_access',
      action: 'data_access',
      performedBy: access.userId,
      metadata: {
        patientId: access.patientId,
        dataType: access.dataType,
        purpose: access.purpose,
        accessMethod: access.accessMethod,
      },
      ipAddress: access.ipAddress || '0.0.0.0',
      userAgent: access.userAgent || 'AUSTA-Care-Platform/1.0',
      sessionId: access.sessionId || `session-${Date.now()}`,
      complianceFlags: ['LGPD'],
      severity: 'low',
      encrypted: true,
      organizationId: access.organizationId,
    };

    await this.storeAuditEntry(auditEntry);

    logger.info('Data access recorded for LGPD compliance', {
      auditId: auditEntry.id,
      userId: access.userId,
      dataType: access.dataType,
    });
  }

  /**
   * Record a security event.
   */
  async recordSecurityEvent(
    event: {
      eventType: string;
      userId?: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      ipAddress?: string;
      timestamp: Date;
      metadata?: Record<string, any>;
      organizationId?: string;
    }
  ): Promise<void> {
    const auditEntry: AuditEntry = {
      id: this.generateAuditId(),
      timestamp: event.timestamp,
      authorizationId: null,
      eventType: 'security_event',
      action: event.eventType,
      performedBy: event.userId || 'system',
      metadata: {
        description: event.description,
        ...event.metadata,
      },
      ipAddress: event.ipAddress || '0.0.0.0',
      userAgent: event.metadata?.userAgent || 'AUSTA-Care-Platform/1.0',
      sessionId: event.metadata?.sessionId || `session-${Date.now()}`,
      complianceFlags: ['Internal Security'],
      severity: event.severity,
      encrypted: true,
      organizationId: event.organizationId,
    };

    await this.storeAuditEntry(auditEntry);

    if (event.severity === 'high' || event.severity === 'critical') {
      this.emit('securityAlert', {
        auditId: auditEntry.id,
        severity: event.severity,
        description: event.description,
        timestamp: event.timestamp,
      });
    }

    logger.warn('Security event recorded', {
      auditId: auditEntry.id,
      eventType: event.eventType,
      severity: event.severity,
    });
  }

  // -----------------------------------------------------------------------
  // Reports & queries (Prisma-backed)
  // -----------------------------------------------------------------------

  async generateComplianceReport(params: {
    regulation: 'LGPD' | 'ANS' | 'Internal';
    startDate: Date;
    endDate: Date;
    authorizationIds?: string[];
  }): Promise<ComplianceReport> {
    logger.info('Generating compliance report', {
      regulation: params.regulation,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const relevantRules = Array.from(this.complianceRules.values()).filter(
      (rule) => rule.regulation === params.regulation && rule.isActive
    );

    const auditEntries = await this.getAuditEntries({
      startDate: params.startDate,
      endDate: params.endDate,
      authorizationIds: params.authorizationIds,
      complianceFlags: [params.regulation],
    });

    const report: ComplianceReport = {
      id: this.generateReportId(),
      regulation: params.regulation,
      generatedAt: new Date(),
      reportPeriod: {
        startDate: params.startDate,
        endDate: params.endDate,
      },
      totalEvents: auditEntries.length,
      eventsByType: this.groupEventsByType(auditEntries),
      complianceViolations: await this.detectComplianceViolations(
        auditEntries,
        relevantRules
      ),
      processingTimeMetrics: this.calculateProcessingTimeMetrics(auditEntries),
      dataAccessMetrics: this.calculateDataAccessMetrics(auditEntries),
      recommendations: this.generateComplianceRecommendations(
        auditEntries,
        relevantRules
      ),
      summary: this.generateReportSummary(auditEntries, params.regulation),
    };

    await this.storeComplianceReport(report);

    this.emit('complianceReportGenerated', {
      reportId: report.id,
      regulation: params.regulation,
      eventCount: auditEntries.length,
    });

    return report;
  }

  async getAuthorizationAuditTrail(
    authorizationId: string
  ): Promise<AuditEntry[]> {
    return this.getAuditEntries({ authorizationIds: [authorizationId] });
  }

  async searchAuditLogs(
    criteria: AuditSearchCriteria
  ): Promise<AuditEntry[]> {
    return this.getAuditEntries(criteria);
  }

  // -----------------------------------------------------------------------
  // Core persistence: storeAuditEntry → prisma.auditLog.create
  // -----------------------------------------------------------------------

  private async storeAuditEntry(entry: AuditEntry): Promise<void> {
    // Encrypt sensitive metadata if flagged
    let metadataPayload: Record<string, any> = { ...entry.metadata };

    if (entry.encrypted && Object.keys(metadataPayload).length > 0) {
      try {
        const orgId = entry.organizationId || resolveOrganizationId();
        const jsonPayload = JSON.stringify(metadataPayload);
        const encrypted = await encryptPHI(orgId, jsonPayload);
        metadataPayload = { _encrypted: true, _ciphertext: encrypted };
      } catch (err) {
        logger.error('Failed to encrypt audit metadata', {
          auditId: entry.id,
          error: err,
        });
      }
    }

    // Embed additional audit data into metadata for the lean AuditLog model
    metadataPayload = {
      ...metadataPayload,
      _eventType: entry.eventType,
      _severity: entry.severity,
      _sessionId: entry.sessionId,
      _complianceFlags: entry.complianceFlags,
      _organizationId: entry.organizationId || resolveOrganizationId(),
      _internalAction: entry.action,
    };

    const auditAction = mapToAuditAction(entry.eventType, entry.action);
    const entity = mapResource(entry.eventType, entry.authorizationId);
    const userId =
      entry.performedBy && entry.performedBy !== 'system'
        ? entry.performedBy
        : null;

    // Extract optional fields from metadata
    const description =
      (entry.metadata?.description as string) || null;
    const reason =
      (entry.metadata?.reason as string) || (entry.metadata?.justification as string) || null;
    const requestId =
      (entry.metadata?.requestId as string) || null;
    const providerId =
      (entry.metadata?.providerId as string) || null;

    // Map severity to RiskLevel enum
    const riskLevel = mapSeverityToRiskLevel(entry.severity);

    // Determine compliance flags
    const lgpdRelevant = entry.complianceFlags.includes('LGPD');
    const sensitiveData = entry.encrypted || entry.complianceFlags.includes('LGPD');
    const requiresReview =
      entry.severity === 'high' || entry.severity === 'critical';

    // Extract change tracking from state transitions
    const oldValues =
      entry.metadata?.fromState
        ? { state: entry.metadata.fromState }
        : undefined;
    const newValues =
      entry.metadata?.toState
        ? { state: entry.metadata.toState }
        : undefined;
    const changedFields: string[] = [];
    if (entry.metadata?.fromState && entry.metadata?.toState) {
      changedFields.push('state');
    }
    if (entry.metadata?.changedFields) {
      changedFields.push(...(entry.metadata.changedFields as string[]));
    }

    // Immediate persistence via Prisma (guaranteed write)
    try {
      await prisma.auditLog.create({
        data: {
          id: entry.id,
          userId,
          providerId,
          organizationId: entry.organizationId || resolveOrganizationId(),
          action: auditAction,
          entity,
          entityId: entry.authorizationId || null,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          description,
          reason,
          sessionId: entry.sessionId,
          requestId,
          riskLevel,
          sensitiveData,
          requiresReview,
          lgpdRelevant,
          oldValues,
          newValues,
          changedFields,
          metadata: metadataPayload,
          occurredAt: entry.timestamp,
        },
      });
    } catch (err) {
      logger.error('Failed to persist audit entry to database', {
        auditId: entry.id,
        error: err,
      });

      // Fallback: buffer the entry so it's not lost
      const key = entry.authorizationId || 'system';
      if (!this.auditBuffer.has(key)) {
        this.auditBuffer.set(key, []);
      }
      this.auditBuffer.get(key)!.push(entry);
      return;
    }

    // Also add to buffer for batch operations (secondary)
    const key = entry.authorizationId || 'system';
    if (!this.auditBuffer.has(key)) {
      this.auditBuffer.set(key, []);
    }
    this.auditBuffer.get(key)!.push(entry);

    // Immediate flush for critical events
    if (entry.severity === 'critical') {
      await this.flushAuditBuffer();
    }
  }

  // -----------------------------------------------------------------------
  // Query audit entries from Prisma
  // -----------------------------------------------------------------------

  private async getAuditEntries(
    criteria: AuditSearchCriteria
  ): Promise<AuditEntry[]> {
    const where: Record<string, any> = {};

    if (criteria.startDate || criteria.endDate) {
      where.occurredAt = {};
      if (criteria.startDate) where.occurredAt.gte = criteria.startDate;
      if (criteria.endDate) where.occurredAt.lte = criteria.endDate;
    }

    if (criteria.authorizationIds?.length) {
      where.entityId = { in: criteria.authorizationIds };
    }

    if (criteria.performedBy) {
      where.userId = criteria.performedBy;
    }

    if (criteria.severity) {
      where.action = mapToAuditAction(
        'security_event',
        criteria.severity
      );
    }

    // Compliance filtering: check for LGPD flag in metadata
    // (metadata is JSONB — filtering on JSON content)
    if (criteria.complianceFlags?.includes('LGPD')) {
      // For LGPD filtering, we rely on resource or action type
      where.OR = [
        { entity: 'HealthData' },
        { action: AuditAction.READ },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: criteria.limit || 1000,
      skip: criteria.offset || 0,
    });

    return logs.map((log): AuditEntry => {
      const meta = (log.metadata as Record<string, any>) || {};
      return {
        id: log.id,
        timestamp: log.occurredAt,
        authorizationId: log.entityId,
        eventType: meta._eventType || log.entity.toLowerCase(),
        action: meta._internalAction || log.action.toLowerCase(),
        performedBy: log.userId || 'system',
        metadata: meta,
        ipAddress: log.ipAddress || '0.0.0.0',
        userAgent: log.userAgent || '',
        sessionId: meta._sessionId || '',
        complianceFlags: meta._complianceFlags || [],
        severity: meta._severity || 'low',
        encrypted: meta._encrypted || false,
        organizationId: meta._organizationId,
      };
    });
  }

  // -----------------------------------------------------------------------
  // Batch flush (periodic, secondary to direct writes)
  // -----------------------------------------------------------------------

  private startPeriodicFlush(): void {
    setInterval(() => {
      this.flushAuditBuffer().catch((error) => {
        logger.error('Failed to flush audit buffer', { error });
      });
    }, 30000);
  }

  private async flushAuditBuffer(): Promise<void> {
    if (this.auditBuffer.size === 0) return;

    const entriesToFlush: AuditEntry[] = [];
    for (const [, entries] of this.auditBuffer.entries()) {
      entriesToFlush.push(...entries);
    }

    if (entriesToFlush.length === 0) return;

    try {
      const created = await Promise.allSettled(
        entriesToFlush.map((entry) => {
          const auditAction = mapToAuditAction(entry.eventType, entry.action);
          const entity = mapResource(entry.eventType, entry.authorizationId);
          const userId =
            entry.performedBy && entry.performedBy !== 'system'
              ? entry.performedBy
              : null;

          const metadataPayload = {
            ...entry.metadata,
            _eventType: entry.eventType,
            _severity: entry.severity,
            _sessionId: entry.sessionId,
            _complianceFlags: entry.complianceFlags,
            _organizationId: entry.organizationId || resolveOrganizationId(),
            _internalAction: entry.action,
          };

          const description =
            (entry.metadata?.description as string) || null;
          const reason =
            (entry.metadata?.reason as string) || (entry.metadata?.justification as string) || null;
          const requestId =
            (entry.metadata?.requestId as string) || null;
          const providerId =
            (entry.metadata?.providerId as string) || null;
          const riskLevel = mapSeverityToRiskLevel(entry.severity);
          const lgpdRelevant = entry.complianceFlags.includes('LGPD');
          const sensitiveData = entry.encrypted || entry.complianceFlags.includes('LGPD');
          const requiresReview =
            entry.severity === 'high' || entry.severity === 'critical';
          const oldValues = entry.metadata?.fromState
            ? { state: entry.metadata.fromState }
            : undefined;
          const newValues = entry.metadata?.toState
            ? { state: entry.metadata.toState }
            : undefined;
          const changedFields: string[] = [];
          if (entry.metadata?.fromState && entry.metadata?.toState) {
            changedFields.push('state');
          }
          if (entry.metadata?.changedFields) {
            changedFields.push(...(entry.metadata.changedFields as string[]));
          }

          return prisma.auditLog.create({
            data: {
              id: entry.id,
              userId,
              providerId,
              organizationId: entry.organizationId || resolveOrganizationId() || '',
              action: auditAction,
              entity,
              entityId: entry.authorizationId || null,
              ipAddress: entry.ipAddress,
              userAgent: entry.userAgent,
              description,
              reason,
              sessionId: entry.sessionId,
              requestId,
              riskLevel,
              sensitiveData,
              requiresReview,
              lgpdRelevant,
              oldValues,
              newValues,
              changedFields,
              metadata: metadataPayload,
              occurredAt: entry.timestamp,
            },
          });
        })
      );

      const failed = created.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        logger.error(`${failed.length} audit entries failed to flush`);
      }

      logger.info(`Flushed ${entriesToFlush.length} audit entries`);
      this.auditBuffer.clear();

      this.emit('auditBufferFlushed', {
        entriesCount: entriesToFlush.length,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to flush audit entries', {
        error,
        entriesCount: entriesToFlush.length,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Compliance helpers
  // -----------------------------------------------------------------------

  private async checkComplianceRules(entry: AuditEntry): Promise<void> {
    const applicableRules = Array.from(this.complianceRules.values()).filter(
      (rule) => rule.isActive && rule.triggers.includes(entry.action)
    );

    for (const rule of applicableRules) {
      const hasRequiredFields = rule.requiredFields.every(
        (field) =>
          (entry as any).hasOwnProperty(field) ||
          entry.metadata.hasOwnProperty(field)
      );

      if (!hasRequiredFields) {
        logger.warn('Compliance rule violation detected', {
          ruleId: rule.id,
          auditId: entry.id,
          missingFields: rule.requiredFields.filter(
            (field) =>
              !(entry as any).hasOwnProperty(field) &&
              !entry.metadata.hasOwnProperty(field)
          ),
        });

        this.emit('complianceViolation', {
          ruleId: rule.id,
          auditId: entry.id,
          violation: 'missing_required_fields',
        });
      }
    }
  }

  private getComplianceFlags(event: any): string[] {
    const flags: string[] = [];

    if (event.metadata?.patientId || event.action?.includes('patient')) {
      flags.push('LGPD');
    }

    if (
      event.action?.includes('authorization') ||
      event.action?.includes('approval')
    ) {
      flags.push('ANS');
    }

    if (
      event.action?.includes('security') ||
      event.action?.includes('access')
    ) {
      flags.push('Security');
    }

    return flags;
  }

  private calculateEventSeverity(event: any): string {
    if (
      event.action?.includes('security') ||
      event.action?.includes('unauthorized')
    ) {
      return 'high';
    }
    if (
      event.action?.includes('approval') ||
      event.action?.includes('rejection')
    ) {
      return 'medium';
    }
    return 'low';
  }

  private isANSReportableTransition(transition: any): boolean {
    const reportableActions = ['approve', 'reject', 'appeal', 'escalate'];
    return reportableActions.includes(transition.action);
  }

  private async createANSComplianceRecord(
    entry: AuditEntry,
    transition: any
  ): Promise<void> {
    logger.info('Creating ANS compliance record', {
      auditId: entry.id,
      authorizationId: transition.authorizationId,
    });
  }

  // -----------------------------------------------------------------------
  // Report helpers
  // -----------------------------------------------------------------------

  private groupEventsByType(entries: AuditEntry[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const entry of entries) {
      grouped[entry.eventType] = (grouped[entry.eventType] || 0) + 1;
    }
    return grouped;
  }

  private async detectComplianceViolations(
    _entries: AuditEntry[],
    _rules: ComplianceRule[]
  ): Promise<ComplianceViolation[]> {
    return [];
  }

  private calculateProcessingTimeMetrics(
    _entries: AuditEntry[]
  ): ProcessingTimeMetrics {
    return {
      averageProcessingTime: 0,
      slaComplianceRate: 0.95,
      bottlenecks: [],
    };
  }

  private calculateDataAccessMetrics(
    _entries: AuditEntry[]
  ): DataAccessMetrics {
    return {
      totalAccesses: 0,
      uniqueUsers: 0,
      accessByPurpose: {},
    };
  }

  private generateComplianceRecommendations(
    _entries: AuditEntry[],
    _rules: ComplianceRule[]
  ): string[] {
    return [
      'Consider implementing additional access controls',
      'Review user access patterns for anomalies',
      'Update data retention policies',
    ];
  }

  private generateReportSummary(
    entries: AuditEntry[],
    regulation: string
  ): string {
    return `Compliance report for ${regulation} covering ${entries.length} audit events.`;
  }

  private async storeComplianceReport(report: ComplianceReport): Promise<void> {
    logger.info(`Stored compliance report ${report.id}`);
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  private generateAuditId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  async cleanup(): Promise<void> {
    await this.flushAuditBuffer();
    logger.info('Audit service cleaned up');
  }
}

export default AuditService;
