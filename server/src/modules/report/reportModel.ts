import { SuppressedMetric } from '../shared/aggregationUtils.js';

export const SIMULATION_BANNER_TEXT =
  '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE';

export interface BaseDashboardHeader {
  hospitalId?: string;
  generatedAt: string;
  generatedByRole: string;
  simulationBanner: string;
  privacyNotice: string;
}

export interface MoQueueDashboard extends BaseDashboardHeader {
  summary: {
    totalCases: SuppressedMetric;
    pendingAssignment: SuppressedMetric;
    underReview: SuppressedMetric;
    completed: SuppressedMetric;
    escalated: SuppressedMetric;
    referralsRequested: SuppressedMetric;
  };
  priorities: {
    routine: SuppressedMetric;
    urgent: SuppressedMetric;
    highPriority: SuppressedMetric;
  };
  processMetrics: {
    averageReviewHours: number | null;
  };
}

export interface ReferralPipelineDashboard extends BaseDashboardHeader {
  summary: {
    totalReferrals: SuppressedMetric;
    requested: SuppressedMetric;
    accepted: SuppressedMetric;
    scheduled: SuppressedMetric;
    attended: SuppressedMetric;
    missed: SuppressedMetric;
    cancelled: SuppressedMetric;
  };
  priorities: {
    routine: SuppressedMetric;
    urgent: SuppressedMetric;
    highPriority: SuppressedMetric;
  };
  destinationFacilityBreakdown: Array<{
    destinationHospitalId: string;
    facilityName: string;
    referralsCount: SuppressedMetric;
  }>;
  missedEscalationsCount: SuppressedMetric;
}

export interface CampOutcomesDashboard extends BaseDashboardHeader {
  summary: {
    totalCamps: number;
    completedCamps: number;
    ongoingCamps: number;
    publishedCamps: number;
    targetPopulationTotal: number;
    screeningsConducted: SuppressedMetric;
    abnormalFindingsFlagged: SuppressedMetric;
    referralsInitiated: SuppressedMetric;
  };
  campsBreakdown: Array<{
    campId: string;
    name: string;
    villageId: string;
    status: string;
    screeningsConducted: SuppressedMetric;
    abnormalFindings: SuppressedMetric;
    referralsCount: SuppressedMetric;
  }>;
}

export interface FollowUpCompletionDashboard extends BaseDashboardHeader {
  summary: {
    totalFollowUps: SuppressedMetric;
    attendedOnTime: SuppressedMetric;
    missedCount: SuppressedMetric;
    escalatedToMoQueue: SuppressedMetric;
    adherenceRateDisplay: string;
  };
}

export interface SyncHealthDashboard extends BaseDashboardHeader {
  summary: {
    totalAuditOperations: number;
    activeDevicesCount: number;
    duplicateReplaySuppressionCount: number;
    syncQueueHealth: 'healthy' | 'degraded';
    lastSyncTimestamp?: string;
  };
}

export type ReportType =
  | 'mo-queue'
  | 'referral-pipeline'
  | 'camp-outcomes'
  | 'follow-up-completion'
  | 'sync-health';
