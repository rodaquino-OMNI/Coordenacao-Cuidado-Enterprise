/**
 * Services Barrel Export
 * AUSTA Care Platform — centralized service exports
 */

// Clinical Risk Services
export { AdvancedRiskAssessmentService } from './risk-assessment.service';
export { EmergencyDetectionService } from './emergency-detection.service';
export type { EmergencyConfig, EmergencyContact, NotificationChannel, EmergencyDetectionRule, EmergencyCondition } from './emergency-detection.service';

// Compound Risk
export { CompoundRiskAnalysisService } from './compound-risk.service';

// Temporal Risk Tracking
export { TemporalRiskTrackingService } from './temporal-risk-tracking.service';

// Audit & Compliance
export { AuditService } from './auditService';

// Notifications
export { NotificationService } from './notificationService';

// Missions & Gamification
export { MissionService } from './missionService';

// WhatsApp Integration
export { WhatsAppService } from './whatsapp.service';

// Workflow & State Machine
export { WorkflowOrchestrator } from './workflowOrchestrator';
export { AuthorizationStateMachine as StateMachine } from './stateMachine';

// External Integrations
export { TasyIntegrationService } from './tasyIntegration';
export { RedisService } from './redisService';
export { OpenAIService } from './openaiService';

// OCR Pipeline
export { OCROrchestrator } from './ocr/ocr-orchestrator.service';

// Webhook Processing
export { WebhookProcessorService } from './webhook-processor.service';

// WhatsApp AI Integration
export { WhatsAppAIIntegration } from './whatsappAIIntegration';
