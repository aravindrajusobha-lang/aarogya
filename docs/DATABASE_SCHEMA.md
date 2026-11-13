# 🗄️ Aarogya-Drishti: Complete Database Schema Dictionary

> **Platform Version:** 0.2.0 (Simulation Demo Environment)  
> **Database Engine:** MongoDB 7.0+ (WiredTiger, Single-Node Replica Set `rs0`)  
> **Total Document Collections:** 18  
> **ACID Transaction Support:** Enabled platform-wide

---

## 1. Schema Entity Relationship Overview

### Patient care assignments and transfers (2026-11-13)

- `patientcares`: `patientId` (unique), `doctorId` (indexed), `version` (integer, starts at 1), timestamps, `simulation`. This is a patient-specific care relationship; it does not change the patient's registration hospital.
- `caretransfers`: `requestId` (unique UUID), `patientId`, `fromDoctorId`, `toDoctorId`, `assignmentVersion`, `status` (`pending`, `approved`, `rejected`, `superseded`), optional `decidedAt`, timestamps, `simulation`. A partial unique index on `(patientId, toDoctorId)` for pending rows prevents duplicate outstanding requests.
- Assignment changes use a compare-and-set on patient, current doctor and version within a transaction. Approval increments the version and supersedes competing pending requests. Requests retain their original parties and decision history.
- `sync_ledgers` stores `entityType: patient_care`, patient ID, operation fingerprint (actor, action, patient, request), cached response and status code. Audit events identify requester/approver without storing passwords or clinical images.
- Legacy care is resolved from latest attended appointment or earliest accepted booking until a claim/transfer persists the assignment. Existing appointments and clinical history retain their original doctor attribution. BackupService discovers these collections automatically.


```mermaid
erDiagram
    HOSPITAL ||--o{ USER : employs
    HOSPITAL ||--o{ SPECIALIST : affiliates
    USER ||--o{ ASSIGNMENT : holds
    VILLAGE ||--o{ ASSIGNMENT : assigned_to
    VILLAGE_GROUP ||--o{ VILLAGE : contains
    PATIENT ||--o{ CONSENT : grants
    PATIENT ||--o{ SCREENING_CASE : undergoes
    PATIENT ||--o{ APPOINTMENT : books
    PATIENT ||--o{ REFERRAL : receives
    PATIENT ||--o{ BIOPSY : specimen_taken
    PATIENT ||--o{ TELECONSULTATION : attends
    SCREENING_CASE ||--o{ APPOINTMENT : leads_to
    SCREENING_CASE ||--o{ REFERRAL : initiates
    SCREENING_CASE ||--o{ BIOPSY : requests
    CAMP ||--o{ SCREENING_CASE : screens_at
    USER ||--o{ AUDIT_LOG : audits
```

---

## 2. Comprehensive Collection Specifications

### 2.1 Collection: `users`
- **Module:** Module 02 (Authentication & Identity)
- **Purpose:** Stores user profiles, hashed credentials, device session identifiers, and lockout trackers.
- **Fields:**
  - `userId`: `String` (Required, Unique, Indexed)
  - `username`: `String` (Required, Unique, Indexed, Trimmed)
  - `passwordHash`: `String` (Required, Argon2id hash)
  - `role`: `Enum['system_admin', 'admin', 'medical_officer', 'specialist', 'anm', 'asha', 'patient']`
  - `fullName`: `String` (Required)
  - `phone`: `String` (Optional, E.164 format)
  - `patientId`: `String` (Optional; generated `PAD-XXXXXX` for photo-registration accounts)
  - `yearOfBirth`, `gender`, `address`, `village`, `mandal`, `pincode`: Optional patient profile fields; stored only after explicit registration consent.
  - `verificationStatus`: Includes `UNVERIFIED`/`VERIFIED` for photo-registration patient accounts.
  - `hospitalId`: `String` (Optional, Indexed)
  - `failedLoginAttempts`: `Number` (Default 0)
  - `lockoutUntil`: `Date` (Optional)
  - `activeDevices`: `Array<{ deviceId: String, lastActive: Date, userAgent: String }>`
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ userId: 1 }` (Unique)
  - `{ username: 1 }` (Unique)
  - `{ hospitalId: 1 }`

---

### 2.2 Collection: `hospitals`
- **Module:** Module 05 (Hospitals Directory)
- **Purpose:** Primary, secondary, and tertiary healthcare institutions in the catchment network.
- **Fields:**
  - `hospitalId`: `String` (Required, Unique, Indexed)
  - `name`: `String` (Required)
  - `type`: `Enum['phc', 'chc', 'area_hospital', 'district_hospital', 'tertiary_medical_college']`
  - `district`: `String` (Default: "Alluri Sitharama Raju")
  - `mandal`: `String` (Required, Indexed)
  - `specialties`: `Array<String>`
  - `totalBeds`: `Number`
  - `status`: `Enum['active', 'inactive']`
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ hospitalId: 1 }` (Unique)
  - `{ mandal: 1 }`

---

### 2.3 Collection: `specialists`
- **Module:** Module 07 (Specialist Directory)
- **Purpose:** Registry of medical and surgical oncology specialists available for teleconsultations and referrals.
- **Fields:**
  - `specialistId`: `String` (Required, Unique, Indexed)
  - `name`: `String` (Required)
  - `qualification`: `String` (Required, e.g. "MS, MCh Surgical Oncology")
  - `specialty`: `Enum['head_and_neck_oncology', 'oral_maxillofacial', 'pathology', 'radiotherapy', 'general_medicine']`
  - `hospitalId`: `String` (Required, Indexed)
  - `teleconsultAvailable`: `Boolean` (Default true)
  - `availableDays`: `Array<String>`
  - `status`: `Enum['active', 'inactive']`
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ specialistId: 1 }` (Unique)
  - `{ hospitalId: 1 }`
  - `{ specialty: 1, teleconsultAvailable: 1 }`

---

### 2.4 Collection: `assignments`
- **Module:** Module 08 (Health Worker Assignments)
- **Purpose:** Scopes frontline ASHA and ANM workers to specific tribal habitations.
- **Fields:**
  - `assignmentId`: `String` (Required, Unique, Indexed)
  - `workerId`: `String` (Required, Indexed)
  - `workerName`: `String` (Required)
  - `workerRole`: `Enum['asha', 'anm']`
  - `hospitalId`: `String` (Required, Indexed)
  - `assignedMandal`: `String` (Required)
  - `assignedVillages`: `Array<String>` (Village IDs)
  - `status`: `Enum['active', 'revoked']`
  - `assignedAt`: `Date` (Default: Date.now)
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ assignmentId: 1 }` (Unique)
  - `{ workerId: 1, status: 1 }`
  - `{ hospitalId: 1 }`

---

### 2.5 Collection: `villages`
- **Module:** Module 09 (Tribal Census Reference)
- **Purpose:** Tribal habitations, geographic coordinates, settlement types, and transport accessibility.
- **Fields:**
  - `villageId`: `String` (Required, Unique, Indexed)
  - `villageName`: `String` (Required, Indexed)
  - `mandal`: `String` (Required, Indexed)
  - `district`: `String` (Default: "Alluri Sitharama Raju")
  - `coordinates`: `{ latitude: Number, longitude: Number }`
  - `totalPopulation`: `Number`
  - `primaryTribe`: `String` (e.g. "Konda Reddi", "Bagata", "Valmiki")
  - `connectivityStatus`: `Enum['good', 'poor', 'none']`
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ villageId: 1 }` (Unique)
  - `{ mandal: 1, villageName: 1 }`

---

### 2.6 Collection: `villagegroups`
- **Module:** Module 14 (Village Groups Topology)
- **Purpose:** Clustered tribal habitations sharing health sub-centres or transport routes.
- **Fields:**
  - `groupId`: `String` (Required, Unique, Indexed)
  - `groupName`: `String` (Required)
  - `mandal`: `String` (Required, Indexed)
  - `villageIds`: `Array<String>` (Required)
  - `linkedFacilityId`: `String` (Required)
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ groupId: 1 }` (Unique)
  - `{ mandal: 1 }`

---

### 2.7 Collection: `patients`
- **Module:** Module 10 (Patient Intake & Deduplication)
- **Purpose:** Demographic and tribal landmark registry (zero raw Aadhaar stored).
- **Fields:**
  - `patientId`: `String` (Required, Unique, Indexed)
  - `fullName`: `String` (Required, Indexed)
  - `gender`: `Enum['male', 'female', 'other']`
  - `ageEstimated`: `Number` (Required, 1-120)
  - `phone`: `String` (Optional, Indexed)
  - `guardianName`: `String` (Optional)
  - `villageId`: `String` (Required, Indexed)
  - `villageName`: `String` (Required)
  - `mandal`: `String` (Required, Indexed)
  - `originalAddressText`: `String` (Required, preserved verbatim)
  - `hospitalId`: `String` (Required, Indexed)
  - `registeredBy`: `String` (Required)
  - `registeredAt`: `Date` (Default: Date.now)
  - `isDuplicateCandidate`: `Boolean` (Default false)
  - `duplicateReviewStatus`: `Enum['none', 'pending_review', 'confirmed_distinct', 'merged_manual']`
  - `history`: `Array<{ timestamp: Date, action: String, performedBy: String }>`
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ patientId: 1 }` (Unique)
  - `{ fullName: 1, phone: 1 }`
  - `{ villageId: 1 }`
  - `{ isDuplicateCandidate: 1, duplicateReviewStatus: 1 }`

---

### 2.8 Collection: `screeningcases`
- **Module:** Module 15 (Oral Screening Cases)
- **Purpose:** Community oral screening encounters, lesion photographs, and DEMO AI triaging.
- **Fields:**
  - `caseId`: `String` (Required, Unique, Indexed)
  - `patientId`: `String` (Required, Indexed)
  - `patientName`: `String` (Required)
  - `villageId`: `String` (Required, Indexed)
  - `hospitalId`: `String` (Required, Indexed)
  - `createdBy`: `String` (Required)
  - `status`: `Enum['pending_assignment', 'assigned', 'under_review', 'completed', 'escalated', 'referral_requested']`
  - `priority`: `Enum['routine', 'urgent', 'high_priority']`
  - `photoIds`: `Array<String>`
  - `demoAiResult`: `{ riskSupportLabel: String, confidenceScore: Number, disclaimer: String, simulationBanner: String }`
  - `assignedMoId`: `String` (Optional, Indexed)
  - `assignedMoName`: `String` (Optional)
  - `resultReleased`: `Boolean` (Default false)
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ caseId: 1 }` (Unique)
  - `{ patientId: 1 }`
  - `{ assignedMoId: 1, status: 1 }`
  - `{ hospitalId: 1, status: 1 }`

---

### 2.9 Collection: `camps`
- **Module:** Module 16 (Community Screening Camps)
- **Purpose:** Planning, publishing, execution, and outcomes for field screening camps.
- **Fields:**
  - `campId`: `String` (Required, Unique, Indexed)
  - `title`: `String` (Required)
  - `hospitalId`: `String` (Required, Indexed)
  - `hospitalName`: `String` (Required)
  - `villageIds`: `Array<String>` (Required)
  - `assignedStaffIds`: `Array<String>` (Required)
  - `startDate`: `Date` (Required)
  - `endDate`: `Date` (Required)
  - `targetScreenings`: `Number` (Required)
  - `status`: `Enum['DRAFT', 'PUBLISHED', 'STARTED', 'COMPLETED', 'CANCELLED']`
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ campId: 1 }` (Unique)
  - `{ hospitalId: 1, status: 1 }`

---

### 2.10 Collection: `appointments`
- **Module:** Module 17 (Patient Appointments Scheduling)
- **Purpose:** Follow-up clinical visits at PHC, CHC, or tertiary referral centers.
- **Fields:**
  - `appointmentId`: `String` (Required, Unique, Indexed)
  - `patientId`: `String` (Required, Indexed)
  - `patientName`: `String` (Required)
  - `destinationHospitalId`: `String` (Required, Indexed)
  - `destinationHospitalName`: `String` (Required)
  - `department`: `String` (Required)
  - `slotStartTime`: `Date` (Required)
  - `slotEndTime`: `Date` (Required)
  - `status`: `Enum['pending', 'confirmed', 'attended', 'cancelled', 'rescheduled']`
  - `type`: `Enum['screening_followup', 'clinical_consultation', 'biopsy_procedure', 'teleconsultation']`
  - `videoInvite`: Optional object containing a SHA-256 `tokenHash` (raw token is never stored), `issuedBy`, `issuedAt`, `expiresAt` (30-minute window), and optional `revokedAt`.
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ appointmentId: 1 }` (Unique)
  - `{ patientId: 1 }`
  - `{ destinationHospitalId: 1, slotStartTime: 1 }`

---

### 2.11 Collection: `biopsies`
- **Module:** Module 18 (Biopsy Specimen & Lab Findings)
- **Purpose:** Tracking pathology requisitions, transit status, and immutable histopathology reports.
- **Fields:**
  - `biopsyId`: `String` (Required, Unique, Indexed)
  - `patientId`: `String` (Required, Indexed)
  - `patientName`: `String` (Required)
  - `hospitalId`: `String` (Required, Indexed)
  - `status`: `Enum['REQUESTED', 'SPECIMEN_COLLECTED', 'IN_TRANSIT', 'PROCESSING', 'RESULT_RECEIVED', 'AMENDED']`
  - `anatomicalLocation`: `String` (Required)
  - `requestingDoctorId`: `String` (Required)
  - `labAttachment`: `{ currentFileId: String, currentSha256: String, version: Number, amendmentHistory: Array<any> }`
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ biopsyId: 1 }` (Unique)
  - `{ patientId: 1 }`
  - `{ hospitalId: 1, status: 1 }`

---

### 2.12 Collection: `referrals`
- **Module:** Module 19 (Tertiary Referrals)
- **Purpose:** Inter-facility patient navigation from tribal facilities to regional cancer hospitals (e.g. KGH).
- **Fields:**
  - `referralId`: `String` (Required, Unique, Indexed)
  - `patientId`: `String` (Required, Indexed)
  - `sourceHospitalId`: `String` (Required, Indexed)
  - `destinationHospitalId`: `String` (Required, Indexed)
  - `referringDoctorId`: `String` (Required)
  - `reasonForReferral`: `String` (Required)
  - `status`: `Enum['PENDING', 'CONFIRMED', 'ATTENDED', 'CANCELLED', 'ESCALATED']`
  - `priority`: `Enum['routine', 'urgent', 'high_priority']`
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ referralId: 1 }` (Unique)
  - `{ patientId: 1 }`
  - `{ destinationHospitalId: 1, status: 1 }`
  - `{ sourceHospitalId: 1 }`

---

### 2.13 Collection: `teleconsultations`
- **Module:** Module 20 (Teleconsultation Management)
- **Purpose:** Clinical video/voice stubs (marked BLOCKED) and versioned clinical discussion notes.
- **Fields:**
  - `consultationId`: `String` (Required, Unique, Indexed)
  - `patientId`: `String` (Required, Indexed)
  - `hospitalId`: `String` (Required, Indexed)
  - `assignedClinicianId`: `String` (Required, Indexed)
  - `scheduledAt`: `Date` (Required)
  - `status`: `Enum['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']`
  - `videoAdapterStatus`: `Enum['BLOCKED', 'AVAILABLE']` (Always BLOCKED)
  - `voiceAdapterStatus`: `Enum['BLOCKED', 'AVAILABLE']` (Always BLOCKED)
  - `notes`: `Array<{ version: Number, recordedBy: String, recordedAt: Date, observations: String, sha256Hash: String }>`
  - `resultReleased`: `Boolean` (Default false)
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ consultationId: 1 }` (Unique)
  - `{ assignedClinicianId: 1, status: 1 }`
  - `{ patientId: 1 }`

---

### 2.14 Collection: `auditlogs`
- **Module:** Module 03 (Security & Audit Logging)
- **Purpose:** Append-only, tamper-evident record of all security-relevant mutations and exports.
- **Fields:**
  - `logId`: `String` (Required, Unique, Indexed)
  - `action`: `String` (Required, Indexed)
  - `actorId`: `String` (Required, Indexed)
  - `actorRole`: `String` (Required)
  - `resourceType`: `String` (Required, Indexed)
  - `resourceId`: `String` (Optional)
  - `ip`: `String` (Masked / Redacted)
  - `timestamp`: `Date` (Default: Date.now, Indexed)
  - `details`: `Schema.Types.Mixed` (Sanitized)
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ logId: 1 }` (Unique)
  - `{ timestamp: -1 }`
  - `{ action: 1, timestamp: -1 }`
  - `{ actorId: 1 }`

---

### 2.15 Collection: `consents`
- **Module:** Module 04 (Patient Consent Governance)
- **Purpose:** Records explicit consent for AI screening support and teleconsultation data sharing.
- **Fields:**
  - `consentId`: `String` (Required, Unique, Indexed)
  - `patientId`: `String` (Required, Indexed)
  - `purpose`: `Enum['screening_ai_analysis', 'telemedicine_share', 'data_storage']`
  - `status`: `Enum['granted', 'revoked']`
  - `witnessName`: `String` (Optional)
  - `language`: `String` (Default: "en")
  - `grantedAt`: `Date` (Default: Date.now)
  - `validUntil`: `Date` (Required)
  - `revokedAt`: `Date` (Optional)
- **Indices:**
  - `{ consentId: 1 }` (Unique)
  - `{ patientId: 1, purpose: 1, status: 1 }`

---

### 2.16 Collection: `notifications`
- **Module:** Module 12 (Notification Center)
- **Purpose:** Non-diagnostic alert queue and multi-lingual dispatch ledger.
- **Fields:**
  - `notificationId`: `String` (Required, Unique, Indexed)
  - `recipientUserId`: `String` (Required, Indexed)
  - `type`: `Enum['screening_alert', 'appointment_reminder', 'referral_update', 'system_notice']`
  - `title`: `String` (Required)
  - `body`: `String` (Required, verified non-diagnostic)
  - `read`: `Boolean` (Default false)
  - `deliveredAt`: `Date`
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ notificationId: 1 }` (Unique)
  - `{ recipientUserId: 1, read: 1 }`

---

### 2.17 Collection: `recoverytickets`
- **Module:** Module 13 (Account Recovery)
- **Purpose:** Cryptographic 72-hour single-use administrator-issued password recovery tickets.
- **Fields:**
  - `ticketId`: `String` (Required, Unique, Indexed)
  - `targetUserId`: `String` (Required, Indexed)
  - `tokenHash`: `String` (Required, SHA-256)
  - `issuedBy`: `String` (Required)
  - `expiresAt`: `Date` (Required, 72 hours from creation)
  - `used`: `Boolean` (Default false)
  - `simulation`: `Boolean` (Default true)
- **Indices:**
  - `{ ticketId: 1 }` (Unique)
  - `{ targetUserId: 1, used: 1 }`
  - `{ expiresAt: 1 }` (TTL Index)

---

### 2.18 Collection: `syncledgers`
- **Module:** Module 11 (Offline Queue Batch Synchronization)
- **Purpose:** Idempotency ledger preventing replay attacks and duplicate creations from frontline offline queues.
- **Fields:**
  - `mutationId`: `String` (Required, Unique, Indexed)
  - `workerId`: `String` (Required, Indexed)
  - `deviceId`: `String` (Required)
  - `action`: `String` (Required)
  - `entityId`: `String` (Required)
  - `statusCode`: `Number` (Required)
  - `responsePayload`: `Schema.Types.Mixed`
  - `syncedAt`: `Date` (Default: Date.now)
- **Indices:**
  - `{ mutationId: 1 }` (Unique)
  - `{ workerId: 1, syncedAt: -1 }`

---

### 2.19 Collection: `aiscreenings`
- **Module:** AI Engine (Multi-Disease Oral Screening: Modules A, B, C & Consolidated Report)
- **Purpose:** Stores multi-factor AI oral screening assessments combining mucosal lesion models, multi-label dental examination, and patient-reported risk history.
- **Fields:**
  - `screeningId`: `String` (Required, Unique, Indexed, e.g. `AI-SCR-A1B2C3D4`)
  - `patientId`: `String` (Required, Indexed)
  - `performedBy`: `Object` (`{ userId, username, role, fullName }`)
  - `hospitalId`: `String` (Optional, Indexed)
  - `label`: `String` (Top-level Module A predicted label, e.g. `normal`, `opmd`)
  - `confidence`: `Number` (Top-level confidence score)
  - `probabilities`: `Map<String, Number>` (Softmax probability distribution)
  - `referToSpecialist`: `Boolean` (Consolidated referral flag)
  - `modelVersion`: `String` (Model identifier)
  - `source`: `Enum['server', 'on-device']`
  - `imageRef`: `String` (File reference in private storage)
  - `imageQuality`: `Object` (`{ ok, reason, blurScore, brightness }`)
  - `moduleA`: `Object` (Structured Mucosal Lesion analysis with configurable classes)
  - `moduleB`: `Object` (`{ findings: Array<{ label, probability, threshold, flagged }>, seeDentistRecommended, modelVersion, source, imageRef }`)
  - `moduleC`: `Object` (`{ answers: IRiskQuestionnaireAnswers, score: Number, level: "LOW"|"MODERATE"|"HIGH", flaggedSymptoms: String[], flaggedHabits: String[], reportedByPatient: Boolean, rationale: String, clinicalValidationRequired: Boolean }`)
  - `combinedRecommendation`: `Object` (`{ referToSpecialist: Boolean, seeDentist: Boolean, triageCategory: "URGENT_SPECIALIST"|"DENTAL_MONITOR"|"ROUTINE", badgeColor: "RED"|"AMBER"|"GREEN", triggerModules: String[], advice: String }`)
  - `clinicianReview`: `Object` (`{ status: "PENDING"|"CONFIRMED"|"OVERRIDDEN", reviewedBy: String, reviewerName: String, finalImpression: String, notes: String, reviewedAt: Date }`)
  - `serverVerification`: `Object` (`{ label, confidence, probabilities, dentalFindings, verifiedAt: Date, matchesOnDevice: Boolean }`)
  - `consentGiven`: `Boolean` (Mandatory true)
  - `consentTimestamp`: `Date`
  - `syncStatus`: `Enum['SYNCED', 'PENDING_SYNC']` (Indexed)
  - `clientId`: `String` (Required, Unique, Indexed UUID for offline deduplication)
- **Indices:**
  - `{ screeningId: 1 }` (Unique)
  - `{ clientId: 1 }` (Unique)
  - `{ patientId: 1, createdAt: -1 }`
  - `{ hospitalId: 1, createdAt: -1 }`
  - `{ syncStatus: 1 }`



---

### 2.19 Collection Schema Updates: `users` (Verification & Initial Password)
- **Module:** Module 02 & Module 03 (Identity & Hospital Admin)
- **Enhanced Fields:**
  - `mustChangePassword`: `Boolean` (Default `false`). Flagged `true` for accounts generated by Administrators/Hospital Managers.
  - `verificationStatus`: `Enum['pending_verification', 'verified', 'rejected', 'UNVERIFIED', 'VERIFIED']` (Default `'verified'`). Doctor onboarding uses lowercase values; patient photo registration uses uppercase `UNVERIFIED` until in-person confirmation.
  - `verificationDetails`: `Object`
    - `verifiedBy`: `String` (User ID of verifying Hospital Manager).
    - `verifiedAt`: `Date` (Timestamp of verification approval).
    - `councilRegistrationNumber`: `String` (State Dental / Medical Council ID).
    - `specialization`: `String` (e.g. Oral Medicine, Maxillofacial Surgery).
    - `experienceYears`: `Number`.
    - `qualificationDocuments`: `Array<{ documentId: String, documentType: String, fileUrl: String, sha256Hash: String, uploadedAt: Date }>` (Uploaded certificates stored in private storage).
    - `rejectionReason`: `String` (Optional explanation if rejected).
- **Indices:**
  - `{ verificationStatus: 1 }`
  - `{ hospitalId: 1, role: 1, verificationStatus: 1 }`

### 2.20 Collection Schema Updates: `teleconsultations` (Urgent Triage Pipeline)
- **Module:** Module 13 (Teleconsultation)
- **Enhanced Fields:**
  - `isUrgent`: `Boolean` (Default `false`, Indexed). Marks case for high-priority emergency triage.
  - `urgencyDetails`: `Object`
    - `urgencyReason`: `String` (e.g. rapidly enlarging ulcer, active bleeding, severe trismus).
    - `symptomDurationDays`: `Number` (Duration of acute symptom in days).
    - `doctorNotificationDispatched`: `Boolean` (Records alert dispatch to on-call clinician).
    - `urgentStatus`: `Enum['REQUESTED', 'ACKNOWLEDGED', 'TRIAGED', 'RESOLVED']` (Triage progress tracker).
    - `acknowledgedBy`: `String` (Clinician user ID).
    - `acknowledgedAt`: `Date`.
    - `emergencyInstructions`: `Array<String>` (Pre-transit first aid and interim palliative instructions).
    - `hospitalEmergencyContact`: `String` (108 Free Emergency Ambulance & CHC Casualty Desk number).
- **Indices:**
  - `{ isUrgent: 1, "urgencyDetails.urgentStatus": 1 }`
  - `{ hospitalId: 1, isUrgent: 1, createdAt: -1 }`
### 2.21 Appointment Video Consultations (`videoconsultations`)

One document per appointment-linked or direct consultation. Fields: `consultationId` (unique), `appointmentId` (unique; direct calls use a generated `DIRECT-` identifier), `callType` (`APPOINTMENT` or `DIRECT`), `patientId`, `doctorId`, `hospitalId`, `status` (`LINK_SENT`, `WAITING`, `IN_CALL`, `COMPLETED`, `MISSED`, `CANCELLED`), `roomName`, `roomUrl`, `tokenHash` (SHA-256; raw join token is never persisted), `linkSentAt`, `expiresAt`, `patientWaitingAt`, `startedAt`, `endedAt`, and `durationSeconds`.

Indexes: unique `{ appointmentId: 1 }`, `{ callType: 1 }`, unique sparse `{ roomName: 1 }`, `{ patientId: 1, status: 1 }`, `{ hospitalId: 1, status: 1 }`, `{ expiresAt: 1 }`, and a partial unique `{ doctorId: 1 }` where status is `IN_CALL` to enforce one active doctor call. Daily room expiration is updated to `startedAt + 30 minutes`; the server scheduler closes expired rooms and completes/misses consultation records and linked appointments. Existing `teleconsultations` remain text-enabled and their separate video adapter remains blocked.

### 2.22 Collection: `dailyproviderconfigs`
- **Purpose:** Stores system-admin-configured Daily provider settings.
- **Fields:** `provider` (`daily`), `domain`, `encryptedApiKey`, `iv`, `authTag`, `configuredBy`, `configuredAt`, and timestamps.
- The API key is AES-256-GCM encrypted with the server-only `VIDEO_CONFIG_ENCRYPTION_KEY`; it is excluded from normal queries and never returned through an API. Losing the encryption key makes stored credentials unreadable.
- **Index:** unique `{ provider: 1 }`.

## Patient Dashboard Portal (Additive)

- `users`: additive `profileConsentAt` date records the last explicit consent accompanying a patient profile update. The profile API returns only the patient allowlist; it never returns password or session fields.
- `aichatmessages`: new additive `AiChatMessage` model/collection. Patient report chat records are keyed by a patient-scoped `chatId` and `screeningId`. Message IDs preserve UUID mutation identity; report and profile-context flags are metadata only.
- `treatmentplans` and `treatmentlogs`: new additive Mongoose models/collections. Plans are copied from a prescription owned by that patient; daily logs are indexed by plan and date. Patient APIs query both `patientId` and plan ownership. A medicine log may omit `scheduledTime` when the prescription has no configured schedule. Photo progress stores `photoId` plus a private `fileId`; original bytes are SHA-256 hashed and patient file reads remain owner scoped.
- `supporttickets`: new additive collection. Fields include `ticketId`, `patientId`, `clientMutationId`, category, subject, description, status, and simulation marker. A unique compound index on `{ patientId, clientMutationId }` supports replay safety.
- `notificationpreferences`: existing collection, no schema migration required. Patient updates may include a UUID `mutationId`; successful replay response payloads use the existing `syncledgers` collection.
- `appointments`: no collection change. Patient share consent is recorded in existing `visitDetails` as report/profile booleans, grant state, and server `recordedAt`; a report ID is only attached when consent is granted.

No SQL migration runner exists in this MongoDB repository. No existing collection or field was renamed or removed.

### Doctor appointment response fields (additive)

The existing `appointments` collection gains optional `patientNote` (maximum 2,000 characters) and `declineReason` (maximum 1,000 characters). Its status string accepts the additive value `declined`; `statusHistory` records the actor, time, and response reason. Replayed appointment mutations use the existing `syncledgers` collection, so no new collection is required.

Socket.IO WebRTC appointment signaling uses the existing `videoconsultations` record with `callType: APPOINTMENT`, appointment/patient/assigned doctor/facility IDs, lifecycle timestamps, and an opaque random token hash. It does not store SDP, ICE payloads, or media. Room membership stays in memory and is limited to one patient and one assigned doctor.


### Doctor workflow extension (2026-11-12)

Doctor sidebar destinations now remain under `/doctor/:section` (queue, appointments, high-risk, referrals, biopsy, patients, availability). Admin doctor provisioning uses the existing hospital doctor API and private storage; approval requires qualification documents and council registration.

- `GET/POST /api/v1/consultations/doctor/availability`: authenticated approved doctor publishes future 20-minute slots in India time; POST accepts `{startTime: ISO, mutationId: UUID}` and returns `{slot}`. GET returns own `{slots}`.
- `GET /api/v1/consultations/availability/:doctorId?date=YYYY-MM-DD`: authenticated appointment reader receives published slots and availability. Existing patient availability listing now counts doctor-published slots. Booking validates the doctor, facility and exact published slot. Existing facility conflict protection remains in place.
- `GET /api/v1/consultations/doctor/patients/:patientId/records`: approved doctor with patient-read capability; facility-scoped, audited patient, screenings, clinical cases, prescriptions, appointments, consultations and versioned notes. No cross-facility search.
- Additive `doctorslots` collection: doctorId, hospitalId, startTime, endTime, mutationId; unique doctor/start and mutation indexes.
- Additive `consultationchats` collection: messageId (unique), appointmentId, senderId, role, text (immutable), SHA-256 (immutable), timestamps. Socket chat uses authenticated appointment rooms, bounded messages and idempotent message IDs. History is returned only after room authorization. Doctor starts the room before patient joins.
- Prescriptions add optional immutable SHA-256 and sparse unique mutationId fields. Existing documents remain valid. New prescriptions resolve doctor/patient/facility names server-side and require approved treating doctor access. UI starts with empty clinician-authored medicine fields.
- Verification: consultationSocket tests cover doctor-first room access, signaling and saved chat replay; appointmentsManagement tests cover slot publication, publication authorization and replay; module smoke, backup/restore and secret-scanner checks. Real camera/audio testing across two devices and network TURN relay remains an operational acceptance check.

### Consultation session fields on `videoconsultations` (2026-11-12, additive)
- `consultationMode` (`online`|`offline`), `startedBy`, `endedBy` (user IDs).
- `followUp` subdocument: `frequency` (`none|weekly|biweekly|monthly|quarterly|custom`), `intervalDays` (1–365), `nextFollowUpAt`, `plannedSessions` (1–52), `instructions` (≤2000), `setBy`, `setAt`.
- Existing documents remain valid. Sessions are started/ended by `/api/v1/consultation-sessions`; clinical notes stay in the versioned `consultationnotes` collection (SHA-256 history), separate from AI screening records.
- `aiscreenings.reanalysisOf` (String, indexed, optional, 2026-11-12): screeningId of the original record a detailed re-analysis was created from. Originals are never modified.
- `users` (2026-11-12, additive): `doctorCode` (unique sparse, uppercase), `email`; `verificationDetails` adds `department`, `departmentName`, `qualifications[]`, `consultationFee`, `languages[]`, `consultationModes[]`, `councilName`, `rejectedBy`, `rejectedAt`. New `counters` collection `{_id: 'doctorCode', seq}`; existing doctors are backfilled at server start.
- `consultationcaptures` (2026-11-12): captureId, appointmentId, consultationId, patientId, doctorId, doctorName, hospitalId, fileId (immutable), sha256Hash (immutable), note, aiScreeningId, clientId (unique). `storedfiles` adds `storageProvider: 'cloudinary'`, `cloudinaryPublicId`, `cloudinaryResourceType`, `cloudinaryFormat`. `appointments` unique active-slot index now includes `assignedDoctorId`.
- `users` (2026-11-12, additive): `abhaHash` (unique sparse HMAC of ABHA number), `abhaMasked`, `phoneVerified`, `registrationMethod`.
- Facility operations (2026-11-13): `facilitywards` (wardId, hospitalId, name, wardType, totalBeds, occupiedBeds, notes, updatedBy; unique hospitalId+name), `facilitymedicines` (itemId, hospitalId, name, form, strength, unit, stock ≥ 0, reorderLevel, batchNo, expiryDate; unique hospitalId+name+strength), `facilitystockmovements` (immutable: movementId, itemId, change, reason, note, balanceAfter, by, byName, createdAt), `facilityequipment` (equipmentId, hospitalId, name, category, quantity, functionalCount, lastServicedAt, notes).
# Patient record access policy — 2026-11-13

No persisted schema change. Exact-ID record reads by verified doctors may span facilities. AuditLog retains the actor, patient/file resource, timestamp, and read action; cross-facility record reads use metadata.reason `verified_doctor_lookup`. The response-only `access.canPrescribe` flag is derived from facility or appointment association; write authorization remains enforced separately.
