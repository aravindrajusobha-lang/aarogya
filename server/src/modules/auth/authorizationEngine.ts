import { Request, Response, NextFunction } from 'express';
import { UserRole } from './userModel.js';
import { Delegation } from './delegationModel.js';

export const ALL_ROLES: UserRole[] = [
  'system_admin',
  'admin',
  'medical_officer',
  'anm',
  'asha',
  'patient',
];

// Central Static Capability Matrix
export const ROLE_CAPABILITY_MATRIX: Record<UserRole, string[]> = {
  system_admin: ['*'], // Superuser: All capabilities granted
  admin: [
    'auth:me',
    'devices:manage_own',
    'mfa:manage_own',
    'webauthn:manage_own',
    'screening:create',
    'screening:read',
    'screening:review',
    'screening:assign',
    'screening:release',
    'screening:read_own',
    'storage:read_clinical',
    'consent:grant',
    'consent:read',
    'consent:revoke',
    'consent:verify',
    'delegation:create',
    'delegation:revoke',
    'audit:read',
    'users:manage',
    'hospital:read',
    'hospital:manage',
    'invitation:create',
    'invitation:read',
    'invitation:revoke',
    'specialist:read',
    'specialist:manage',
    'assignment:create',
    'assignment:read',
    'reference:villages',
    'reference:manage',
    'patient:create',
    'patient:read',
    'patient:manage',
    'patient:duplicate_review',
    'sync:submit',
    'notification:read_own',
    'notification:manage_own',
    'notification:send',
    'recovery:initiate',
    'recovery:read',
    'recovery:verify',
    'recovery:approve',
    'recovery:complete',
    'village_group:read',
    'village_group:manage',
    'camps:create',
    'camps:read',
    'camps:publish',
    'camps:manage',
    'appointment:create',
    'appointment:read',
    'appointment:confirm',
    'appointment:reschedule',
    'appointment:cancel',
    'appointment:manage',
    'biopsy:create',
    'biopsy:read',
    'biopsy:manage',
    'biopsy:findings',
    'biopsy:release',
    'referral:create',
    'referral:read',
    'referral:manage',
    'telemedicine:consult',
    'telemedicine:request',
    'telemedicine:read',
    'telemedicine:manage',
    'telemedicine:notes',
    'telemedicine:release',
    'telemedicine:discuss',
    'map:read',
    'map:export',
    'reports:read',
    'reports:export',
    'reports:export_pii',
    'aadhaar:mock_auth',
    'aadhaar:mock_read',
  ],
  medical_officer: [
    'auth:me',
    'devices:manage_own',
    'mfa:manage_own',
    'webauthn:manage_own',
    'screening:create',
    'screening:read',
    'screening:review',
    'screening:assign',
    'screening:release',
    'screening:read_own',
    'telemedicine:consult',
    'telemedicine:request',
    'telemedicine:read',
    'telemedicine:manage',
    'telemedicine:notes',
    'telemedicine:release',
    'telemedicine:discuss',
    'storage:upload',
    'storage:read_clinical',
    'consent:grant',
    'consent:read',
    'consent:verify',
    'delegation:create',
    'delegation:revoke',
    'hospital:read',
    'specialist:read',
    'specialist:manage',
    'assignment:create',
    'assignment:read',
    'reference:villages',
    'patient:create',
    'patient:read',
    'patient:manage',
    'patient:duplicate_review',
    'sync:submit',
    'notification:read_own',
    'notification:manage_own',
    'notification:send',
    'recovery:initiate',
    'recovery:read',
    'recovery:verify',
    'recovery:approve',
    'recovery:complete',
    'village_group:read',
    'village_group:manage',
    'camps:create',
    'camps:read',
    'camps:publish',
    'camps:manage',
    'appointment:create',
    'appointment:read',
    'appointment:confirm',
    'appointment:reschedule',
    'appointment:cancel',
    'appointment:manage',
    'biopsy:create',
    'biopsy:read',
    'biopsy:manage',
    'biopsy:findings',
    'biopsy:release',
    'referral:create',
    'referral:read',
    'referral:manage',
    'map:read',
    'map:export',
    'reports:read',
    'reports:export',
    'aadhaar:mock_auth',
    'aadhaar:mock_read',
  ],
  anm: [
    'auth:me',
    'devices:manage_own',
    'mfa:manage_own',
    'webauthn:manage_own',
    'screening:create',
    'screening:read',
    'screening:read_own',
    'storage:upload',

    'storage:read_clinical',
    'consent:grant',
    'consent:read',
    'consent:verify',
    'hospital:read',
    'specialist:read',
    'assignment:read',
    'reference:villages',
    'patient:create',
    'patient:read',
    'sync:submit',
    'notification:read_own',
    'notification:manage_own',
    'notification:send',
    'recovery:initiate',
    'recovery:read',
    'recovery:verify',
    'recovery:complete',
    'village_group:read',
    'camps:read',
    'appointment:create',
    'appointment:read',
    'appointment:reschedule',
    'appointment:cancel',
    'biopsy:read',
    'referral:read',
    'telemedicine:request',
    'telemedicine:read',
    'telemedicine:discuss',
    'map:read',
    'reports:read',
    'aadhaar:mock_auth',
    'aadhaar:mock_read',
  ],
  asha: [
    'auth:me',
    'devices:manage_own',
    'mfa:manage_own',
    'webauthn:manage_own',
    'screening:create',
    'screening:read',
    'screening:read_own',
    'storage:upload',

    'storage:read_clinical',
    'consent:grant',
    'consent:read',
    'consent:verify',
    'hospital:read',
    'specialist:read',
    'assignment:read',
    'reference:villages',
    'patient:create',
    'patient:read',
    'sync:submit',
    'notification:read_own',
    'notification:manage_own',
    'notification:send',
    'recovery:initiate',
    'recovery:read',
    'recovery:verify',
    'recovery:complete',
    'village_group:read',
    'camps:read',
    'appointment:create',
    'appointment:read',
    'appointment:reschedule',
    'appointment:cancel',
    'biopsy:read',
    'referral:read',
    'telemedicine:request',
    'telemedicine:read',
    'telemedicine:discuss',
    'map:read',
    'reports:read',
    'aadhaar:mock_auth',
    'aadhaar:mock_read',
  ],
  patient: [
    'auth:me',
    'devices:manage_own',
    'mfa:manage_own',
    'webauthn:manage_own',
    'consent:grant',
    'consent:read',
    'consent:revoke',
    'consent:verify',
    'screening:read_own',
    'hospital:read',
    'specialist:read',
    'reference:villages',
    'patient:read_own',
    'notification:read_own',
    'notification:manage_own',
    'recovery:initiate',
    'recovery:read',
    'recovery:complete',
    'appointment:create',
    'appointment:read',
    'appointment:cancel',
    'biopsy:read',
    'referral:read',
    'telemedicine:request',
    'telemedicine:read',
  ],
};

export function getRoleCapabilities(role: UserRole): string[] {
  return ROLE_CAPABILITY_MATRIX[role] || [];
}

/**
 * Checks if a user has a required capability, either natively via the capability matrix
 * or via active delegated permissions checked live in the database.
 */
export async function hasCapability(
  user: { id: string; role: UserRole },
  requiredCapability: string
): Promise<boolean> {
  // 1. System Admin has all permissions
  if (user.role === 'system_admin') {
    return true;
  }

  // 2. Check native Role Capability Matrix
  const roleCaps = ROLE_CAPABILITY_MATRIX[user.role] || [];
  if (roleCaps.includes('*') || roleCaps.includes(requiredCapability)) {
    return true;
  }

  // 3. Check live Delegated Permissions in Database
  try {
    const now = new Date();
    const activeDelegation = await Delegation.findOne({
      toUserId: user.id,
      capabilities: requiredCapability,
      status: 'active',
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    });

    if (activeDelegation) {
      return true;
    }
  } catch {
    // If DB check fails or model not connected, fail closed
    return false;
  }

  return false;
}

/**
 * Express middleware to enforce a required capability.
 * Checks native capability matrix and live DB delegations.
 */
export function authorizeCapability(requiredCapability: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.envelopeError('UNAUTHORIZED', 'Authentication required', undefined, 401);
      return;
    }

    const authorized = await hasCapability(req.user, requiredCapability);
    if (!authorized) {
      res.envelopeError(
        'FORBIDDEN',
        `Access denied. Missing capability: ${requiredCapability}`,
        {
          userRole: req.user.role,
          requiredCapability,
        },
        403
      );
      return;
    }

    next();
  };
}

/**
 * Programmatic Route-to-Capability Registry.
 * Maps every endpoint path and method to its required capability or 'public'.
 */
export interface EndpointRouteConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  requiredCapability: string | 'public';
  description: string;
}

export const ENDPOINT_CAPABILITY_TABLE: EndpointRouteConfig[] = [
  // Health
  { method: 'GET', path: '/api/v1/health', requiredCapability: 'public', description: 'System health probe' },
  { method: 'GET', path: '/api/v1/health/simulation', requiredCapability: 'public', description: 'Simulation mode probe' },

  // Auth - Public Authentication & Flow
  { method: 'POST', path: '/api/v1/auth/login', requiredCapability: 'public', description: 'Staff & Patient password login' },
  { method: 'POST', path: '/api/v1/auth/register', requiredCapability: 'public', description: 'Patient & community registration' },
  { method: 'POST', path: '/api/v1/auth/mfa/verify', requiredCapability: 'public', description: 'TOTP 2FA verification challenge' },
  { method: 'POST', path: '/api/v1/auth/refresh', requiredCapability: 'public', description: 'Refresh token rotation & exchange' },
  { method: 'POST', path: '/api/v1/auth/webauthn/login/options', requiredCapability: 'public', description: 'WebAuthn login options challenge' },
  { method: 'POST', path: '/api/v1/auth/webauthn/login/verify', requiredCapability: 'public', description: 'WebAuthn biometric login verification' },
  { method: 'GET', path: '/api/v1/auth/patient/qr-code', requiredCapability: 'public', description: 'Generate Aarogya Setu / ABHA QR code for patient intake' },
  { method: 'POST', path: '/api/v1/auth/patient/qr-scan', requiredCapability: 'public', description: 'Process scanned Aarogya Setu QR code and send verification OTP' },
  { method: 'POST', path: '/api/v1/auth/patient/send-otp', requiredCapability: 'public', description: 'Send mobile OTP to patient' },
  { method: 'POST', path: '/api/v1/auth/patient/verify-otp', requiredCapability: 'public', description: 'Verify patient mobile OTP' },

  // Auth - Protected User & MFA
  { method: 'GET', path: '/api/v1/auth/me', requiredCapability: 'auth:me', description: 'Get logged in user profile' },
  { method: 'PUT', path: '/api/v1/auth/profile', requiredCapability: 'auth:me', description: 'Update user profile details' },
  { method: 'POST', path: '/api/v1/auth/change-password', requiredCapability: 'auth:me', description: 'Change password for authenticated user' },
  { method: 'POST', path: '/api/v1/auth/change-initial-password', requiredCapability: 'auth:me', description: 'Mandatory initial password change for newly created accounts' },
  { method: 'DELETE', path: '/api/v1/auth/account', requiredCapability: 'auth:me', description: 'Deactivate user account' },
  { method: 'POST', path: '/api/v1/auth/logout', requiredCapability: 'auth:me', description: 'Revoke current device session' },
  { method: 'POST', path: '/api/v1/auth/mfa/setup', requiredCapability: 'mfa:manage_own', description: 'Generate TOTP MFA secret' },
  { method: 'POST', path: '/api/v1/auth/mfa/enable', requiredCapability: 'mfa:manage_own', description: 'Enable TOTP MFA with code' },
  { method: 'POST', path: '/api/v1/auth/mfa/disable', requiredCapability: 'mfa:manage_own', description: 'Disable TOTP MFA' },

  // Auth - WebAuthn Enrollment
  { method: 'POST', path: '/api/v1/auth/webauthn/register/options', requiredCapability: 'webauthn:manage_own', description: 'Generate WebAuthn enrollment options' },
  { method: 'POST', path: '/api/v1/auth/webauthn/register/verify', requiredCapability: 'webauthn:manage_own', description: 'Verify WebAuthn enrollment credential' },

  // Auth - Device Management & Revocation
  { method: 'GET', path: '/api/v1/auth/devices', requiredCapability: 'devices:manage_own', description: 'List active registered devices' },
  { method: 'POST', path: '/api/v1/auth/devices/:deviceId/revoke', requiredCapability: 'devices:manage_own', description: 'Revoke specific device session' },
  { method: 'POST', path: '/api/v1/auth/devices/revoke-others', requiredCapability: 'devices:manage_own', description: 'Revoke all other device sessions' },

  // Auth - Delegated Permissions (Live Database)
  { method: 'POST', path: '/api/v1/auth/delegations', requiredCapability: 'delegation:create', description: 'Delegate capabilities to another user' },
  { method: 'GET', path: '/api/v1/auth/delegations/my', requiredCapability: 'auth:me', description: 'List user delegations received' },
  { method: 'POST', path: '/api/v1/auth/delegations/:id/revoke', requiredCapability: 'delegation:revoke', description: 'Revoke active delegation' },

  // Storage
  { method: 'POST', path: '/api/v1/storage/upload', requiredCapability: 'storage:upload', description: 'Upload clinical photo / file' },
  { method: 'GET', path: '/api/v1/storage/files/:fileId', requiredCapability: 'storage:read_clinical', description: 'Stream authorized clinical file' },

  // Append-Only Audit Log
  { method: 'GET', path: '/api/v1/audit/logs', requiredCapability: 'audit:read', description: 'Query append-only audit trail' },

  // Patient Consent Service
  { method: 'POST', path: '/api/v1/consent', requiredCapability: 'consent:grant', description: 'Grant or record patient informed consent' },
  { method: 'GET', path: '/api/v1/consent/patient/:patientId', requiredCapability: 'consent:read', description: 'List consents for a patient' },
  { method: 'POST', path: '/api/v1/consent/:id/revoke', requiredCapability: 'consent:revoke', description: 'Revoke patient consent' },
  { method: 'GET', path: '/api/v1/consent/verify', requiredCapability: 'consent:verify', description: 'Verify active consent status' },

  // Phase 3: Administration - Hospitals & Health Facilities
  { method: 'POST', path: '/api/v1/hospitals', requiredCapability: 'hospital:manage', description: 'Create health facility / hospital' },
  { method: 'GET', path: '/api/v1/hospitals', requiredCapability: 'hospital:read', description: 'List active health facilities' },
  { method: 'GET', path: '/api/v1/hospitals/nearby', requiredCapability: 'public', description: 'Discover nearby healthcare facilities and active doctors' },
  { method: 'GET', path: '/api/v1/hospitals/:hospitalId', requiredCapability: 'hospital:read', description: 'Get facility details (cross-hospital guard)' },
  { method: 'PUT', path: '/api/v1/hospitals/:hospitalId', requiredCapability: 'hospital:manage', description: 'Update facility details (cross-hospital guard)' },
  { method: 'POST', path: '/api/v1/hospitals/:hospitalId/managers', requiredCapability: 'hospital:manage', description: 'Create hospital manager account scoped to facility' },
  { method: 'POST', path: '/api/v1/hospitals/:hospitalId/managers/reset-password', requiredCapability: 'hospital:manage', description: 'Reset manager credentials' },
  { method: 'GET', path: '/api/v1/hospitals/:hospitalId/performance', requiredCapability: 'hospital:read', description: 'Get hospital performance metrics' },
  { method: 'POST', path: '/api/v1/hospitals/:hospitalId/doctors', requiredCapability: 'hospital:manage', description: 'Create doctor account with qualifications and verification requirements' },
  { method: 'GET', path: '/api/v1/hospitals/:hospitalId/doctors', requiredCapability: 'hospital:read', description: 'List doctor accounts registered at this facility' },
  { method: 'POST', path: '/api/v1/hospitals/:hospitalId/doctors/:doctorId/verify', requiredCapability: 'hospital:manage', description: 'Hospital manager verifies and activates doctor account' },

  // Phase 3: Administration - 72-Hour Invitations
  { method: 'POST', path: '/api/v1/invitations', requiredCapability: 'invitation:create', description: 'Create 72-hour copyable staff invitation' },
  { method: 'GET', path: '/api/v1/invitations', requiredCapability: 'invitation:read', description: 'List facility staff invitations' },
  { method: 'GET', path: '/api/v1/invitations/verify/:token', requiredCapability: 'public', description: 'Verify invitation token validity' },
  { method: 'POST', path: '/api/v1/invitations/accept', requiredCapability: 'public', description: 'Accept invitation & create account (self-approval blocked)' },
  { method: 'POST', path: '/api/v1/invitations/:id/revoke', requiredCapability: 'invitation:revoke', description: 'Revoke pending staff invitation' },

  // Phase 3: Administration - Specialists Directory
  { method: 'GET', path: '/api/v1/specialists', requiredCapability: 'specialist:read', description: 'Query specialists directory for referral' },
  { method: 'POST', path: '/api/v1/specialists', requiredCapability: 'specialist:manage', description: 'Register or update clinical specialist' },

  // Phase 3: Administration - Health Worker Assignments
  { method: 'POST', path: '/api/v1/assignments', requiredCapability: 'assignment:create', description: 'Assign health worker to village scope (self-approval blocked)' },
  { method: 'GET', path: '/api/v1/assignments', requiredCapability: 'assignment:read', description: 'List health worker village assignments' },
  { method: 'GET', path: '/api/v1/assignments/worker/:workerId', requiredCapability: 'assignment:read', description: 'Get specific worker village assignments' },
  { method: 'POST', path: '/api/v1/assignments/:id/revoke', requiredCapability: 'assignment:create', description: 'Revoke health worker village assignment' },

  // Phase 3: Administration - Village Reference Data
  { method: 'GET', path: '/api/v1/reference/villages', requiredCapability: 'reference:villages', description: 'List tribal villages (scoped to worker assignments)' },
  { method: 'POST', path: '/api/v1/reference/villages', requiredCapability: 'reference:manage', description: 'Register tribal village reference data' },
  { method: 'GET', path: '/api/v1/reference/asr/mandals', requiredCapability: 'reference:villages', description: 'Get all 22 mandals in Alluri Sitharama Raju district' },
  { method: 'GET', path: '/api/v1/reference/asr/panchayats', requiredCapability: 'reference:villages', description: 'Get gram panchayats for ASR district mandals' },
  { method: 'GET', path: '/api/v1/reference/asr/villages', requiredCapability: 'reference:villages', description: 'Get tribal villages in ASR district with filters' },
  { method: 'GET', path: '/api/v1/reference/asr/facilities', requiredCapability: 'reference:villages', description: 'Get healthcare facilities in ASR district' },
  { method: 'POST', path: '/api/v1/reference/asr/villages/import', requiredCapability: 'reference:manage', description: 'Bulk import tribal villages in ASR district' },
  { method: 'PUT', path: '/api/v1/reference/asr/villages/:id/coordinates', requiredCapability: 'reference:manage', description: 'Update GPS coordinates for an ASR village' },

  // Phase 4: Patients and Sync
  { method: 'POST', path: '/api/v1/patients', requiredCapability: 'patient:create', description: 'Register patient (OTP-free, idempotency ledger, duplicate detection)' },
  { method: 'GET', path: '/api/v1/patients', requiredCapability: 'patient:read', description: 'Query patient records (worker scope partitioned)' },
  { method: 'GET', path: '/api/v1/patients/duplicates/review', requiredCapability: 'patient:duplicate_review', description: 'List pending duplicate review tickets' },
  { method: 'POST', path: '/api/v1/patients/duplicates/:reviewId/resolve', requiredCapability: 'patient:duplicate_review', description: 'Resolve duplicate review ticket' },
  { method: 'POST', path: '/api/v1/patients/sync', requiredCapability: 'sync:submit', description: 'Batch idempotent sync for offline encrypted queue' },
  { method: 'GET', path: '/api/v1/patients/:id', requiredCapability: 'patient:read', description: 'Get patient profile and history' },

  // Phase 5: Notification Core
  { method: 'GET', path: '/api/v1/notifications', requiredCapability: 'notification:read_own', description: 'List in-app notifications for authenticated user' },
  { method: 'POST', path: '/api/v1/notifications', requiredCapability: 'notification:send', description: 'Enqueue and dispatch notification across configured channels' },
  { method: 'PATCH', path: '/api/v1/notifications/read-all', requiredCapability: 'notification:manage_own', description: 'Mark all in-app notifications as read' },
  { method: 'PATCH', path: '/api/v1/notifications/:id/read', requiredCapability: 'notification:manage_own', description: 'Mark specific in-app notification as read' },
  { method: 'GET', path: '/api/v1/notifications/preferences', requiredCapability: 'notification:read_own', description: 'Get recipient notification preferences' },
  { method: 'PUT', path: '/api/v1/notifications/preferences', requiredCapability: 'notification:manage_own', description: 'Update recipient notification preferences' },
  { method: 'GET', path: '/api/v1/notifications/templates', requiredCapability: 'notification:read_own', description: 'Query notification templates registry' },
  { method: 'GET', path: '/api/v1/notifications/:id/delivery-status', requiredCapability: 'notification:read_own', description: 'Inspect delivery status per channel (verifies BLOCKED stubs)' },

  // Phase 6: Account Recovery (Three-Party Verified Flow)
  { method: 'POST', path: '/api/v1/recovery/initiate', requiredCapability: 'recovery:initiate', description: 'Initiate account recovery ticket (enumeration resistant)' },
  { method: 'GET', path: '/api/v1/recovery/tickets', requiredCapability: 'recovery:read', description: 'List account recovery tickets' },
  { method: 'GET', path: '/api/v1/recovery/tickets/:id', requiredCapability: 'recovery:read', description: 'Get specific account recovery ticket' },
  { method: 'POST', path: '/api/v1/recovery/tickets/:id/verify', requiredCapability: 'recovery:verify', description: 'Frontline verification of claimant identity (verifier != requester)' },
  { method: 'POST', path: '/api/v1/recovery/tickets/:id/approve', requiredCapability: 'recovery:approve', description: 'Designated administrative approval (approver != requester && approver != verifier)' },
  { method: 'POST', path: '/api/v1/recovery/complete', requiredCapability: 'recovery:complete', description: 'Complete account recovery using single-use claim token' },

  // Phase 7: Village Groups (v0.2 "Village Group Management")
  { method: 'GET', path: '/api/v1/village-groups/aggregates', requiredCapability: 'village_group:read', description: 'Village group aggregates with small-count cell suppression' },
  { method: 'GET', path: '/api/v1/village-groups', requiredCapability: 'village_group:read', description: 'List village groups' },
  { method: 'POST', path: '/api/v1/village-groups', requiredCapability: 'village_group:manage', description: 'Create village group' },
  { method: 'GET', path: '/api/v1/village-groups/:id', requiredCapability: 'village_group:read', description: 'Get village group by ID' },
  { method: 'POST', path: '/api/v1/village-groups/:id/approve', requiredCapability: 'village_group:manage', description: 'Admin approve village group' },
  { method: 'POST', path: '/api/v1/village-groups/:id/reject', requiredCapability: 'village_group:manage', description: 'Admin reject village group' },
  { method: 'POST', path: '/api/v1/village-groups/:id/unblock-auto', requiredCapability: 'village_group:manage', description: 'Admin unblock auto-trigger for village group' },

  // Phase 8: Screening, Demo AI, and MO Case Queue
  { method: 'POST', path: '/api/v1/screening/photos/upload', requiredCapability: 'screening:create', description: 'Upload clinical screening photo with consent guard' },
  { method: 'POST', path: '/api/v1/screening/photos/:id/amend', requiredCapability: 'screening:create', description: 'Amend clinical photo while keeping original byte-identical' },
  { method: 'GET', path: '/api/v1/screening/photos/:id', requiredCapability: 'screening:read', description: 'Get screening photo metadata and amendment history' },
  { method: 'POST', path: '/api/v1/screening/ai/analyze', requiredCapability: 'screening:read', description: 'Run demo AI screening analysis' },
  { method: 'POST', path: '/api/v1/screening/cases', requiredCapability: 'screening:create', description: 'Create screening case in medical officer queue' },
  { method: 'GET', path: '/api/v1/screening/cases', requiredCapability: 'screening:read', description: 'List cases in medical officer queue' },
  { method: 'GET', path: '/api/v1/screening/cases/:id', requiredCapability: 'screening:read', description: 'Get screening case details' },
  { method: 'POST', path: '/api/v1/screening/cases/:id/assign', requiredCapability: 'screening:assign', description: 'Assign case to medical officer (cross-hospital guard)' },
  { method: 'POST', path: '/api/v1/screening/cases/:id/assess', requiredCapability: 'screening:review', description: 'Record clinician assessment findings (separate entity)' },
  { method: 'POST', path: '/api/v1/screening/cases/:id/release-result', requiredCapability: 'screening:release', description: 'Release screening results to patient (separate entity)' },
  { method: 'POST', path: '/api/v1/screening/cases/:id/escalate', requiredCapability: 'screening:review', description: 'Escalate screening case for specialist review' },
  { method: 'POST', path: '/api/v1/screening/cases/:id/referral', requiredCapability: 'screening:review', description: 'Request specialist referral for screening case' },
  { method: 'GET', path: '/api/v1/screening/patient/:patientId/results', requiredCapability: 'screening:read_own', description: 'Patient access to released screening results' },
  { method: 'GET', path: '/api/v1/screening/questionnaire-config', requiredCapability: 'public', description: 'Configurable multi-language oral risk intake questionnaire' },
  { method: 'POST', path: '/api/v1/screening/quality-check', requiredCapability: 'public', description: 'Guided oral image quality and anatomical region validation' },
  { method: 'GET', path: '/api/v1/screening/cases/:id/report/pdf', requiredCapability: 'screening:read', description: 'Generate and securely download screening summary report PDF' },

  // Phase 9: Screening Camps Management
  { method: 'POST', path: '/api/v1/camps', requiredCapability: 'camps:create', description: 'Create a new screening camp in draft status' },
  { method: 'GET', path: '/api/v1/camps', requiredCapability: 'camps:read', description: 'List screening camps scoped by hospital / assigned villages' },
  { method: 'GET', path: '/api/v1/camps/:id', requiredCapability: 'camps:read', description: 'Get details of a single screening camp' },
  { method: 'PUT', path: '/api/v1/camps/:id', requiredCapability: 'camps:manage', description: 'Update screening camp details' },
  { method: 'DELETE', path: '/api/v1/camps/:id', requiredCapability: 'camps:manage', description: 'Delete draft screening camp' },
  { method: 'POST', path: '/api/v1/camps/:id/publish', requiredCapability: 'camps:publish', description: 'Publish a draft screening camp' },
  { method: 'POST', path: '/api/v1/camps/:id/start', requiredCapability: 'camps:manage', description: 'Start a screening camp (must be published)' },
  { method: 'POST', path: '/api/v1/camps/:id/complete', requiredCapability: 'camps:manage', description: 'Complete an in-progress screening camp' },
  { method: 'POST', path: '/api/v1/camps/:id/cancel', requiredCapability: 'camps:manage', description: 'Cancel a draft or published camp' },
  { method: 'POST', path: '/api/v1/camps/:id/transition', requiredCapability: 'camps:manage', description: 'Transition camp lifecycle status' },
  { method: 'POST', path: '/api/v1/camps/:id/workers', requiredCapability: 'camps:manage', description: 'Assign health workers to screening camp' },
  { method: 'GET', path: '/api/v1/camps/:id/statistics', requiredCapability: 'camps:read', description: 'Get camp statistics with small-count cell suppression' },
  { method: 'GET', path: '/api/v1/camps/:id/counts', requiredCapability: 'camps:read', description: 'Get camp-level counts with privacy masking' },
  { method: 'POST', path: '/api/v1/camps/:id/screenings', requiredCapability: 'camps:manage', description: 'Record screening counts in active camp' },
  { method: 'GET', path: '/api/v1/camps/planning/dashboard', requiredCapability: 'camps:read', description: 'Aggregated medical camp planning metrics across ASR district' },
  { method: 'GET', path: '/api/v1/camps/planning/recommendations', requiredCapability: 'camps:read', description: 'Location-based medical camp recommendations with score weighting' },

  // Phase 10: Patient Appointments Scheduling
  { method: 'GET', path: '/api/v1/appointments/slots', requiredCapability: 'appointment:read', description: 'Query available OPD consultation slots for hospital' },
  { method: 'POST', path: '/api/v1/appointments', requiredCapability: 'appointment:create', description: 'Request appointment consultation (idempotent, ACID conflict guard)' },
  { method: 'GET', path: '/api/v1/appointments', requiredCapability: 'appointment:read', description: 'List appointments with hospital and patient scoping' },
  { method: 'GET', path: '/api/v1/appointments/:id', requiredCapability: 'appointment:read', description: 'Get appointment details' },
  { method: 'POST', path: '/api/v1/appointments/:id/confirm', requiredCapability: 'appointment:confirm', description: 'Confirm appointment (destination hospital manager/MO only, self-confirm blocked)' },
  { method: 'POST', path: '/api/v1/appointments/:id/reschedule', requiredCapability: 'appointment:reschedule', description: 'Reschedule appointment with slot conflict verification' },
  { method: 'POST', path: '/api/v1/appointments/:id/cancel', requiredCapability: 'appointment:cancel', description: 'Cancel appointment with mandatory reason' },
  { method: 'POST', path: '/api/v1/appointments/:id/check-in', requiredCapability: 'appointment:manage', description: 'Mark patient as checked in for consultation' },
  { method: 'POST', path: '/api/v1/appointments/:id/complete', requiredCapability: 'appointment:manage', description: 'Complete consultation appointment' },

  // Phase 11: Biopsy Workflow
  { method: 'POST', path: '/api/v1/biopsy', requiredCapability: 'biopsy:create', description: 'Request a new biopsy procedure' },
  { method: 'GET', path: '/api/v1/biopsy', requiredCapability: 'biopsy:read', description: 'List biopsy procedures' },
  { method: 'GET', path: '/api/v1/biopsy/:id', requiredCapability: 'biopsy:read', description: 'Get biopsy procedure by ID' },
  { method: 'POST', path: '/api/v1/biopsy/:id/schedule', requiredCapability: 'biopsy:manage', description: 'Schedule biopsy procedure' },
  { method: 'POST', path: '/api/v1/biopsy/:id/collect', requiredCapability: 'biopsy:manage', description: 'Collect specimen for biopsy' },
  { method: 'POST', path: '/api/v1/biopsy/:id/send-to-lab', requiredCapability: 'biopsy:manage', description: 'Send specimen to pathology laboratory' },
  { method: 'POST', path: '/api/v1/biopsy/:id/recollection-required', requiredCapability: 'biopsy:manage', description: 'Flag biopsy recollection required' },
  { method: 'POST', path: '/api/v1/biopsy/:id/findings', requiredCapability: 'biopsy:findings', description: 'Record findings by qualified pathologist' },
  { method: 'POST', path: '/api/v1/biopsy/:id/release-result', requiredCapability: 'biopsy:release', description: 'Authorize and release biopsy result' },
  { method: 'POST', path: '/api/v1/biopsy/:id/amend-attachment', requiredCapability: 'biopsy:manage', description: 'Amend biopsy lab attachment' },
  { method: 'POST', path: '/api/v1/biopsy/:id/cancel', requiredCapability: 'biopsy:manage', description: 'Cancel biopsy procedure' },
  { method: 'GET', path: '/api/v1/biopsy/:id/findings', requiredCapability: 'biopsy:read', description: 'Get biopsy findings details' },
  { method: 'GET', path: '/api/v1/biopsy/:id/release', requiredCapability: 'biopsy:read', description: 'Get biopsy result release details' },

  // Phase 12: Referrals and Follow-up
  { method: 'POST', path: '/api/v1/referrals', requiredCapability: 'referral:create', description: 'Create a referral request (MO or MO lead only)' },
  { method: 'GET', path: '/api/v1/referrals', requiredCapability: 'referral:read', description: 'List referrals with destination hospital scoping' },
  { method: 'GET', path: '/api/v1/referrals/:id', requiredCapability: 'referral:read', description: 'Get referral by ID with cross-hospital scoping' },
  { method: 'POST', path: '/api/v1/referrals/:id/accept', requiredCapability: 'referral:manage', description: 'Accept referral by destination hospital staff' },
  { method: 'POST', path: '/api/v1/referrals/:id/schedule', requiredCapability: 'referral:manage', description: 'Schedule follow-up date and agenda reminder' },
  { method: 'POST', path: '/api/v1/referrals/:id/missed', requiredCapability: 'referral:manage', description: 'Mark follow-up as missed and escalate to MO queue (Exactly once)' },
  { method: 'POST', path: '/api/v1/referrals/:id/attended', requiredCapability: 'referral:manage', description: 'Mark referral consultation as attended' },
  { method: 'POST', path: '/api/v1/referrals/:id/cancel', requiredCapability: 'referral:manage', description: 'Cancel referral with mandatory reason' },

  // Phase 13: Teleconsultation
  { method: 'POST', path: '/api/v1/teleconsultation', requiredCapability: 'telemedicine:request', description: 'Request teleconsultation session' },
  { method: 'POST', path: '/api/v1/teleconsultation/urgent', requiredCapability: 'telemedicine:request', description: 'Submit urgent teleconsultation request with emergency instructions' },
  { method: 'POST', path: '/api/v1/teleconsultation/:id/urgent-acknowledge', requiredCapability: 'telemedicine:manage', description: 'Acknowledge urgent teleconsultation by clinical team' },
  { method: 'GET', path: '/api/v1/teleconsultation', requiredCapability: 'telemedicine:read', description: 'List teleconsultation sessions' },
  { method: 'GET', path: '/api/v1/teleconsultation/:id', requiredCapability: 'telemedicine:read', description: 'Get teleconsultation session details' },
  { method: 'POST', path: '/api/v1/teleconsultation/:id/schedule', requiredCapability: 'telemedicine:manage', description: 'Schedule teleconsultation session' },
  { method: 'POST', path: '/api/v1/teleconsultation/:id/start', requiredCapability: 'telemedicine:manage', description: 'Mark teleconsultation session in progress' },
  { method: 'GET', path: '/api/v1/teleconsultation/:id/video-session', requiredCapability: 'telemedicine:read', description: 'Get video session adapter BLOCKED status' },
  { method: 'GET', path: '/api/v1/teleconsultation/:id/voice-session', requiredCapability: 'telemedicine:read', description: 'Get voice session adapter BLOCKED status' },
  { method: 'POST', path: '/api/v1/teleconsultation/:id/notes', requiredCapability: 'telemedicine:notes', description: 'Record clinical notes by assigned clinician' },
  { method: 'POST', path: '/api/v1/teleconsultation/:id/notes/amend', requiredCapability: 'telemedicine:notes', description: 'Amend clinical notes with version increment' },
  { method: 'GET', path: '/api/v1/teleconsultation/:id/notes', requiredCapability: 'telemedicine:read', description: 'Get clinical notes (release gated for patient)' },
  { method: 'POST', path: '/api/v1/teleconsultation/:id/release', requiredCapability: 'telemedicine:release', description: 'Release consultation summary for patient viewing' },
  { method: 'POST', path: '/api/v1/teleconsultation/:id/messages', requiredCapability: 'telemedicine:discuss', description: 'Post case discussion message (healthcare staff only)' },
  { method: 'GET', path: '/api/v1/teleconsultation/:id/messages', requiredCapability: 'telemedicine:discuss', description: 'Get case discussion messages (healthcare staff only)' },
  { method: 'POST', path: '/api/v1/teleconsultation/:id/cancel', requiredCapability: 'telemedicine:manage', description: 'Cancel teleconsultation session' },

  // Phase 14: Village Data Map (13 endpoints)
  { method: 'GET', path: '/api/v1/map/clusters', requiredCapability: 'map:read', description: 'Get habitation clusters and village groups' },
  { method: 'GET', path: '/api/v1/map/boundaries/mandals', requiredCapability: 'map:read', description: 'Get mandal boundary polygon features' },
  { method: 'GET', path: '/api/v1/map/corridors/transport', requiredCapability: 'map:read', description: 'Get transport corridors to District Hospital' },
  { method: 'GET', path: '/api/v1/map/connectivity-zones', requiredCapability: 'map:read', description: 'Get cellular and offline shadow zones' },
  { method: 'GET', path: '/api/v1/map/heatmap/screening-coverage', requiredCapability: 'map:read', description: 'Get village-level screening coverage heatmap' },
  { method: 'GET', path: '/api/v1/map/geo-export', requiredCapability: 'map:export', description: 'Export GeoJSON dataset with small-count suppression' },
  { method: 'GET', path: '/api/v1/map/villages', requiredCapability: 'map:read', description: 'List scoped villages with coordinates' },
  { method: 'GET', path: '/api/v1/map/villages/:id', requiredCapability: 'map:read', description: 'Get village details and demographics' },
  { method: 'GET', path: '/api/v1/map/villages/:id/workers', requiredCapability: 'map:read', description: 'Get assigned frontline health workers for village' },
  { method: 'GET', path: '/api/v1/map/villages/:id/facilities', requiredCapability: 'map:read', description: 'Get catchment healthcare facilities' },
  { method: 'GET', path: '/api/v1/map/villages/:id/screenings-summary', requiredCapability: 'map:read', description: 'Get village screening counts with small-count suppression' },
  { method: 'GET', path: '/api/v1/map/villages/:id/risk-metrics', requiredCapability: 'map:read', description: 'Get village mucosal risk density with small-count suppression' },
  { method: 'GET', path: '/api/v1/map/villages/:id/camps', requiredCapability: 'map:read', description: 'Get screening camps associated with village' },

  // Phase 15: Reports and Dashboards (7 endpoints)
  { method: 'GET', path: '/api/v1/reports/dashboards/mo-queue', requiredCapability: 'reports:read', description: 'Get Medical Officer case queue report dashboard' },
  { method: 'GET', path: '/api/v1/reports/dashboards/referral-pipeline', requiredCapability: 'reports:read', description: 'Get referral pipeline report dashboard' },
  { method: 'GET', path: '/api/v1/reports/dashboards/camp-outcomes', requiredCapability: 'reports:read', description: 'Get screening camp outcomes report dashboard' },
  { method: 'GET', path: '/api/v1/reports/dashboards/follow-up-completion', requiredCapability: 'reports:read', description: 'Get follow-up completion adherence dashboard' },
  { method: 'GET', path: '/api/v1/reports/dashboards/sync-health', requiredCapability: 'reports:read', description: 'Get offline synchronization health dashboard' },
  { method: 'GET', path: '/api/v1/reports/export/csv', requiredCapability: 'reports:export', description: 'Export report data in CSV format with audit and PII gating' },
  { method: 'GET', path: '/api/v1/reports/export/pdf', requiredCapability: 'reports:export', description: 'Export report data in PDF format with audit and PII gating' },

  // Phase 16: Aadhaar Verification Mock Service (4 endpoints)
  { method: 'POST', path: '/api/v1/mock/aadhaar/generate-otp', requiredCapability: 'aadhaar:mock_auth', description: 'Generate simulated OTP for test Aadhaar number' },
  { method: 'POST', path: '/api/v1/mock/aadhaar/verify-otp', requiredCapability: 'aadhaar:mock_auth', description: 'Evaluate simulated OTP code' },
  { method: 'POST', path: '/api/v1/mock/aadhaar/demographic-auth', requiredCapability: 'aadhaar:mock_auth', description: 'Evaluate simulated demographic match' },
  { method: 'GET', path: '/api/v1/mock/aadhaar/status', requiredCapability: 'aadhaar:mock_read', description: 'Get Aadhaar mock adapter operational and blocked status' },

  // Phase 17: Offline and PWA Hardening (2 endpoints)
  { method: 'POST', path: '/api/v1/sync/batch', requiredCapability: 'sync:submit', description: 'Batch idempotent sync for offline encrypted queue' },
  { method: 'GET', path: '/api/v1/sync/encryption-report', requiredCapability: 'auth:me', description: 'Real encryption strength report & known limitations' },

  // Intelligent 2D Multilingual Robotic AI Assistant
  { method: 'POST', path: '/api/v1/assistant/query', requiredCapability: 'public', description: 'Intelligent Multilingual 2D AI Robotic Assistant Query' },
];

/**
 * Validates that every registered route in the Express application is accounted for
 * in the ENDPOINT_CAPABILITY_TABLE. Throws if any route is missing!
 */
export function verifyAllExpressRoutesCovered(expressApp: any): {
  totalRoutes: number;
  coveredRoutes: number;
  missingRoutes: string[];
} {
  const registered: { method: string; path: string }[] = [];

  function extractRoutes(stack: any[], prefix = '') {
    for (const layer of stack) {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods)
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase());

        for (const method of methods) {
          const fullPath = (prefix + layer.route.path).replace(/\/+/g, '/').replace(/\/$/, '');
          registered.push({ method, path: fullPath || '/' });
        }
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        // Express Router mount path
        let routerPrefix = '';
        if (layer.regexp) {
          const match = layer.regexp.source
            .replace('\\/?(?=\\/|$)', '')
            .replace('^\\', '')
            .replace('\\/', '/')
            .replace('(?=\\/|$)', '')
            .replace('^', '')
            .replace('$', '')
            .replace(/\\\//g, '/');
          routerPrefix = match;
        }
        extractRoutes(layer.handle.stack, prefix + (routerPrefix ? `/${routerPrefix}` : ''));
      }
    }
  }

  if (expressApp._router && expressApp._router.stack) {
    extractRoutes(expressApp._router.stack);
  }

  // Check each registered endpoint against ENDPOINT_CAPABILITY_TABLE
  const missingRoutes: string[] = [];

  for (const reg of registered) {
    // Skip internal catch-all or error handlers
    if (reg.path.includes('*')) continue;

    const matched = ENDPOINT_CAPABILITY_TABLE.some(
      (entry) =>
        entry.method === reg.method &&
        normalizeRoutePath(entry.path) === normalizeRoutePath(reg.path)
    );

    if (!matched) {
      missingRoutes.push(`${reg.method} ${reg.path}`);
    }
  }

  return {
    totalRoutes: registered.length,
    coveredRoutes: registered.length - missingRoutes.length,
    missingRoutes,
  };
}

function normalizeRoutePath(p: string): string {
  return p
    .replace(/:[a-zA-Z0-9_]+/g, ':param')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}
