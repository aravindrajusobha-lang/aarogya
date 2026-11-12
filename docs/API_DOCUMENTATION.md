# 📡 Aarogya-Drishti: Complete REST API Specification (252 Endpoints)

> **Platform Version:** 0.2.0 (Simulation Demo Environment)  
> **Total Deduplicated Endpoints:** 252 Route-Method Permutations  
> **Base URL:** `https://localhost/api/v1`  
> **Simulation Notice:** All responses carry `simulation: true` or `simulationBanner`. All Aadhaar endpoints return `mock: true`. External telephony, video, SMS, and UIDAI integrations return `BLOCKED`.

---

## 1. Global API Standards & Envelope Specification

All Aarogya-Drishti endpoints adhere strictly to the standardized JSend-compliant envelope structure:

### Success Response Envelope (HTTP 200, 201)
```json
{
  "status": "success",
  "data": { ... },
  "message": "Optional human-readable confirmation message",
  "simulation": true,
  "timestamp": "2026-11-01T08:00:00.000Z"
}
```

### Error Response Envelope (HTTP 400, 401, 403, 404, 409, 429, 500)
```json
{
  "status": "error",
  "code": "ERROR_ENUM_CODE",
  "message": "Human-readable explanation of error",
  "details": { ... },
  "simulation": true,
  "timestamp": "2026-11-01T08:00:00.000Z"
}
```

### Common HTTP Security Headers
- `Cache-Control: private, no-cache, no-store, must-revalidate`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: default-src 'self'`

---

## 2. Global Route Permutations Summary (252 Endpoints)

The 252 deduplicated endpoints are structured across 24 core service modules:

| Module # | Functional Module | Deduplicated Routes | Key Capability |
|---|---|---|---|
| **01** | System Health & Diagnostics | 1 | Public / Internal health check |
| **02** | Core Authentication & Session Lifecycle | 6 | `auth:*`, Token rotation |
| **03** | Security & Audit Logging | 2 | `audit:read`, `audit:export` |
| **04** | Patient Consent Governance | 4 | `consent:grant`, `consent:revoke` |
| **05** | Hospitals Directory & Facilities | 5 | `hospital:read`, `hospital:manage` |
| **06** | Staff Invitations Management | 4 | `invitation:manage` |
| **07** | Specialist Directory & Registry | 4 | `specialist:read`, `specialist:manage` |
| **08** | Health Worker Village Assignments | 4 | `assignment:read`, `assignment:manage` |
| **09** | Tribal Census Reference Geography | 5 | `reference:read`, `reference:manage` |
| **10** | Patient Intake & Deduplication | 8 | `patient:create`, `patient:dedup` |
| **11** | Offline Queue Batch Synchronization | 3 | `sync:push`, `sync:status` |
| **12** | Notification Center & Delivery Queue | 6 | `notification:read`, `notification:send` |
| **13** | Administrative Account Recovery | 4 | `recovery:create`, `recovery:verify` |
| **14** | Village Groups Aggregation Topology | 5 | `village_group:read`, `village_group:manage` |
| **15** | Oral Screening Cases & MO Review Queue | 12 | `screening:submit`, `screening:review` |
| **16** | Community Screening Camps | 8 | `camp:read`, `camp:manage`, `camp:execute` |
| **17** | Patient Appointments & Scheduling | 8 | `appointment:read`, `appointment:manage` |
| **18** | Biopsy Specimen & Lab Findings | 6 | `biopsy:read`, `biopsy:manage`, `biopsy:amend` |
| **19** | Tertiary Referrals & Navigation Reminders | 8 | `referral:read`, `referral:manage` |
| **20** | Teleconsultation Management (Blocked Stubs) | 11 | `teleconsult:schedule`, `teleconsult:notes` |
| **21** | Spatial Habitation GIS Map (13 Endpoints) | 13 | `map:read`, Cell suppression (<5) |
| **22** | Reports & Small-Count Dashboards | 8 | `reports:read`, `reports:export` |
| **23** | Aadhaar Verification Mock Service | 5 | `mock:aadhaar:read`, `mock:aadhaar:verify` |
| **24** | Encrypted Storage & Binary Uploads | 3 | `storage:upload`, `storage:download` |
| **RBAC** | Matrix Role-Method Permutations | 108 | Comprehensive role access checks |
| **Total** | **Deduplicated API Route Endpoints** | **252** | **Full System Surface** |

---

## 3. Detailed Endpoint Catalog

### Module 01: System Health & Diagnostics
- `GET /api/v1/health`
  - **Auth:** Public
  - **Description:** Returns API operational status, timestamp, simulation marker, and MongoDB replica set status.
  - **Response:** `{ status: "HEALTHY", simulation: true, database: { status: "CONNECTED", replicaSet: "rs0" } }`

### Module 02: Core Authentication & Sessions
- `POST /api/v1/auth/login`
  - **Auth:** Public (Rate limit: 15 req/min per IP)
  - **Body:** `{ username, password, deviceId }`
  - **Description:** Authenticates user via Argon2id; issues short-lived JWT (15m) and rotating refresh token (7d).
- `POST /api/v1/auth/register-aadhaar-photo`
  - **Auth:** Public; rate-limited.
  - **Body:** `{ consent: true, name, yearOfBirth, gender, address?, village, mandal, pincode?, mobile? }`.
  - **Privacy:** Browser decodes the Aadhaar QR/OCR locally. Full Aadhaar digits, QR payloads, and card images are rejected as unknown body fields and never reach this endpoint. Only the consented profile fields and optional contact mobile are submitted; no PIN is collected or stored.
  - **Response:** `201 { patientId: "PAD-XXXXXX", user: { ..., verificationStatus: "UNVERIFIED" }, accessToken, refreshToken, deviceSessionId }`.
  - **Returning sign-in:** Uses the existing `POST /api/v1/auth/patient/send-otp` and `POST /api/v1/auth/patient/verify-otp` endpoints with `purpose: "LOGIN"` when a contact mobile was provided. Photo registration itself does not send an OTP.
- `POST /api/v1/mock/aadhaar/ocr-extract`
  - **Auth:** Required; legacy capability check retained.
  - **Behavior:** Compatibility path returns `410 AADHAAR_OCR_BLOCKED`. OCR and QR decoding run in the browser; callers must not send card images, QR payloads, or Aadhaar digits. Submit only consented profile fields to registration.
- `POST /api/v1/auth/refresh`
  - **Auth:** Public
  - **Body:** `{ refreshToken }`
  - **Description:** Rotates refresh token. Detects token reuse and invalidates user session family on breach.
- `POST /api/v1/auth/logout`
  - **Auth:** Required (`requireAuth`)
  - **Description:** Revokes current device session and refresh token.
- `GET /api/v1/auth/me`
  - **Auth:** Required
  - **Description:** Returns profile, hospital scope, role capabilities, and active session attributes.
- `POST /api/v1/auth/device/revoke`
  - **Auth:** Required
  - **Body:** `{ deviceId }`
  - **Description:** Immediately revokes authorization for specified device ID.
- `GET /api/v1/auth/devices`
  - **Auth:** Required
  - **Description:** Lists all active registered devices for authenticated user.

### Module 03: Security & Audit Logging
- `GET /api/v1/audit/logs`
  - **Auth:** `audit:read` (`system_admin` only)
  - **Query:** `limit`, `offset`, `action`, `actorId`
  - **Description:** Queries immutable audit log entries.
- `GET /api/v1/audit/export`
  - **Auth:** `audit:export` (`system_admin` only)
  - **Description:** Streams CSV export of security events; creates an audit log entry for the export itself.

### Module 04: Patient Consent Governance
- `POST /api/v1/consent`
  - **Auth:** `consent:grant`
  - **Body:** `{ patientId, purpose, validUntil?, witnessName?, language? }`
  - **Description:** Records patient consent for AI screening or telemedicine with witness attestation.
- `GET /api/v1/consent/patient/:patientId`
  - **Auth:** `consent:read`
  - **Description:** Retrieves active consent history for specified patient.
- `POST /api/v1/consent/:id/revoke`
  - **Auth:** `consent:revoke`
  - **Description:** Revokes existing consent with timestamp and actor attribution.
- `GET /api/v1/consent/verify`
  - **Auth:** `consent:read`
  - **Query:** `patientId`, `purpose`
  - **Description:** Verification check for whether active unexpired consent exists.

### Module 05: Hospitals Directory & Catchments
- `GET /api/v1/hospitals` — List active facilities.
- `POST /api/v1/hospitals` — Register hospital (`hospital:manage`).
- `GET /api/v1/hospitals/:hospitalId` — Fetch hospital details (enforces cross-hospital boundary).
- `PUT /api/v1/hospitals/:hospitalId` — Update facility metadata, beds, specialties.
- `DELETE /api/v1/hospitals/:hospitalId` — Mark facility inactive.

### Module 06: Staff Invitations Management
- `POST /api/v1/invitations` — Issue single-use 72h cryptographically signed invitation token.
- `GET /api/v1/invitations` — List pending invitations for facility.
- `POST /api/v1/invitations/accept` — Accept invitation and initialize account password.
- `DELETE /api/v1/invitations/:id` — Revoke pending invitation.

### Module 07: Specialist Directory & Registry
- `GET /api/v1/specialists` — Query specialists filtered by specialty and teleconsult availability.
- `POST /api/v1/specialists` — Register specialist in tertiary directory.
- `GET /api/v1/specialists/:id` — Specialist profile and schedule.
- `PUT /api/v1/specialists/:id` — Update availability, schedule, or hospital affiliation.

### Module 08: Health Worker Assignments
- `POST /api/v1/assignments` — Assign ANM/ASHA to mandal and village list (prevents self-assignment).
- `GET /api/v1/assignments` — List worker assignments.
- `GET /api/v1/assignments/worker/:workerId` — Query specific worker's assigned villages.
- `DELETE /api/v1/assignments/:id` — Revoke active village assignment.

### Module 09: Reference Tribal Geography & Census
- `GET /api/v1/reference/mandals` — List mandals in Alluri Sitharama Raju district.
- `GET /api/v1/reference/villages` — List villages (scoped to worker assignments if caller is ANM/ASHA).
- `GET /api/v1/reference/villages/:villageId` — Fetch village population, tribal settlements, and terrain.
- `POST /api/v1/reference/villages` — Register new tribal habitation.
- `GET /api/v1/reference/census-summary` — Aggregated population metrics with cell suppression (<5).

### Module 10: Patient Intake, Demographics & Deduplication
- `POST /api/v1/patients` — Register new patient (records verbatim address landmarks, flags duplicates).
- `PATCH /api/v1/patients/:id/verify` — Mark a self-registered patient account `VERIFIED` after in-person confirmation; only assigned ASHA/ANM workers or a Medical Officer with hospital scope may verify.
- `GET /api/v1/patients` — Search and list patients (scoped to worker's assigned villages).
- `GET /api/v1/patients/:patientId` — Retrieve patient profile and screening timeline.
- `PUT /api/v1/patients/:patientId` — Update patient demographics (appends to immutable patient history).
- `GET /api/v1/patients/duplicates/pending` — List duplicate candidates awaiting clinician resolution.
- `POST /api/v1/patients/duplicates/:id/resolve` — Clinician resolution (`confirmed_distinct` or `merged_manual`).
- `GET /api/v1/patients/:patientId/history` — Audit trail of demographic edits.
- `DELETE /api/v1/patients/:patientId` — Deactivate patient record.

### Module 11: Offline Queue Batch Synchronization
- `POST /api/v1/sync/batch` — Idempotent batch upload of offline queued mutations.
- `GET /api/v1/sync/status` — Sync health indicator, pending queue counts, and last sync timestamp.
- `GET /api/v1/sync/conflicts` — List items requiring manual review due to concurrent conflict.

### Module 12: Notification Center & Multi-Channel Dispatcher
- `GET /api/v1/notifications` — List notifications for authenticated user.
- `POST /api/v1/notifications` — Queue alert (validated against non-diagnostic wording rules).
- `GET /api/v1/notifications/:id` — Fetch alert details.
- `PATCH /api/v1/notifications/:id/read` — Mark alert as read.
- `GET /api/v1/notifications/delivery/status` — Simulated SMS/Push delivery status.
- `POST /api/v1/notifications/broadcast` — Program broadcast to health workers.

### Module 13: Administrative Account Recovery Workflow
- `POST /api/v1/recovery/tickets` — Admin generates 72h single-use password recovery ticket.
- `GET /api/v1/recovery/tickets` — List active recovery tickets.
- `POST /api/v1/recovery/tickets/verify` — Validate recovery ticket secret.
- `POST /api/v1/recovery/tickets/complete` — Set new password and revoke previous device sessions.
*(Notice: Unauthenticated public forgot-password paths return 404).*

### Module 14: Village Groups Aggregation Topology
- `GET /api/v1/village-groups` — List village clusters.
- `POST /api/v1/village-groups` — Create new administrative cluster.
- `GET /api/v1/village-groups/:id` — Cluster details and linked facilities.
- `PUT /api/v1/village-groups/:id` — Modify village group boundaries.
- `GET /api/v1/village-groups/:id/metrics` — Aggregate screening rates with cell suppression (<5).

### Module 15: Oral Screening Cases & Medical Officer Queue
- `POST /api/v1/screening/cases` — Submit new oral screening case.
- `GET /api/v1/screening/cases` — List cases (filtered by role and facility).
- `GET /api/v1/screening/cases/:caseId` — Full screening case details.
- `POST /api/v1/screening/cases/:caseId/photos` — Upload lesion photograph (stores SHA-256 hash).
- `POST /api/v1/screening/cases/:caseId/ai-analyze` — Execute DEMO AI triaging heuristic.
- `POST /api/v1/screening/cases/:caseId/assign` — Assign case to Medical Officer.
- `GET /api/v1/screening/cases/queue/mo` — Medical Officer unreviewed case queue.
- `POST /api/v1/screening/cases/:caseId/assessment` — Clinician records separate assessment note.
- `POST /api/v1/screening/cases/:caseId/release` — Clinician formally releases findings to patient.
- `POST /api/v1/screening/cases/:caseId/photos/:photoId/amend` — Amend photo (preserves byte-identical original).
- `GET /api/v1/screening/cases/:caseId/history` — Audit log of case status transitions.
- `POST /api/v1/screening/cases/:caseId/escalate` — Escalate case for immediate tertiary review.

### Module 16: Community Screening Camps
- `POST /api/v1/camps` — Create camp in `DRAFT` status.
- `GET /api/v1/camps` — List screening camps.
- `GET /api/v1/camps/:campId` — Camp details, targets, assigned staff.
- `PUT /api/v1/camps/:campId` — Update camp details.
- `POST /api/v1/camps/:campId/publish` — Transition camp from `DRAFT` to `PUBLISHED`.
- `POST /api/v1/camps/:campId/start` — Start camp (strictly rejected if still `DRAFT`).
- `POST /api/v1/camps/:campId/complete` — Close camp and calculate outcomes.
- `GET /api/v1/camps/:campId/summary` — Aggregate outcomes with cell suppression (<5).

### Module 17: Patient Appointments Scheduling
- `POST /api/v1/appointments` — Schedule follow-up clinical appointment.
- `GET /api/v1/appointments` — List appointments.
- `GET /api/v1/appointments/:id` — Appointment details.
- `PUT /api/v1/appointments/:id` — Update or reschedule appointment.
- `POST /api/v1/appointments/:id/confirm` — Hospital confirms slot.
- `POST /api/v1/appointments/:id/video-invite` — Confirmed-appointment doctor creates a patient-bound demo video link expiring after 30 minutes; plaintext token is returned once.
- `POST /api/v1/appointments/:id/video-invite/verify` — Patient verifies their appointment invite before entering its demo room.
- Appointment room signaling (`/api/v1/teleconsultation/rooms/:id/*`) checks appointment confirmation, patient identity, invite token, facility, and invite expiry for appointment-linked rooms.
- `POST /api/v1/appointments/:id/cancel` — Cancel appointment with reason.
- `GET /api/v1/appointments/slots/available` — Query available slots by facility and specialty.
- `POST /api/v1/appointments/:id/attend` — Mark appointment attended.

### Module 18: Biopsy Specimen & Lab Findings Tracking
- `POST /api/v1/biopsy` — Register biopsy specimen requisition.
- `GET /api/v1/biopsy` — List biopsy records.
- `GET /api/v1/biopsy/:id` — Biopsy tracking details.
- `POST /api/v1/biopsy/:id/specimen-sent` — Mark specimen transit to pathology lab.
- `POST /api/v1/biopsy/:id/result` — Attach histopathology report with SHA-256 hash.
- `POST /api/v1/biopsy/:id/amend` — Amend lab finding (original report preserved unchanged).

### Module 19: Tertiary Referrals & Navigation Reminders
- `POST /api/v1/referrals` — Create referral from PHC/CHC to tertiary center (KGH).
- `GET /api/v1/referrals` — List referrals (scoped to source or destination hospital).
- `GET /api/v1/referrals/:id` — Referral record details.
- `POST /api/v1/referrals/:id/accept` — Destination hospital accepts referral.
- `POST /api/v1/referrals/:id/schedule` — Schedule tertiary appointment.
- `POST /api/v1/referrals/:id/attended` — Mark tertiary visit attended.
- `POST /api/v1/referrals/:id/cancel` — Cancel referral.
- `POST /api/v1/referrals/:id/escalate` — Escalate missed follow-up back to MO queue.

### Module 20: Teleconsultation Session Management
- `POST /api/v1/teleconsultation` — Request teleconsultation.
- `GET /api/v1/teleconsultation` — List teleconsultations.
- `GET /api/v1/teleconsultation/:id` — Session details.
- `POST /api/v1/teleconsultation/:id/schedule` — Clinician confirms appointment time.
- `POST /api/v1/teleconsultation/:id/start` — Mark session in progress.
- `GET /api/v1/teleconsultation/:id/video-status` — Returns adapter status `BLOCKED` (no fake call screen).
- `GET /api/v1/teleconsultation/:id/voice-status` — Returns adapter status `BLOCKED`.
- `POST /api/v1/teleconsultation/:id/notes` — Record clinical notes with SHA-256 hash.
- `GET /api/v1/teleconsultation/:id/notes` — Retrieve versioned clinical notes.
- `POST /api/v1/teleconsultation/:id/release` — Formally release consultation summary.
- `POST /api/v1/teleconsultation/:id/messages` — Text-based case discussion between staff.

### Module 21: Spatial Habitation GIS Map (13 Endpoints — Reconciled)
- `GET /api/v1/map/villages` — Paginated list of tribal villages with GPS coordinates.
- `GET /api/v1/map/villages/:id` — Single village geospatial boundary and metadata.
- `GET /api/v1/map/villages/:id/workers` — Frontline workers assigned to habitation.
- `GET /api/v1/map/villages/:id/facilities` — Assigned PHC, CHC, and tertiary hospital nodes.
- `GET /api/v1/map/villages/:id/screenings-summary` — Aggregate screening counts with suppression (<5).
- `GET /api/v1/map/villages/:id/risk-metrics` — Risk triage aggregate counts with suppression (<5).
- `GET /api/v1/map/villages/:id/camps` — Historical and planned screening camps.
- `GET /api/v1/map/clusters` — Habitation settlement clusters.
- `GET /api/v1/map/boundaries/mandals` — Mandal administrative boundary polygons.
- `GET /api/v1/map/corridors/transport` — Ghat road transport connectivity corridors.
- `GET /api/v1/map/connectivity-zones` — Cellular and network connectivity shade classifications.
- `GET /api/v1/map/heatmap/screening-coverage` — Habitation screening density overlay.
- `GET /api/v1/map/geo-export` — Administrative GeoJSON dataset export with cell suppression (<5).

### Module 22: Reports & Aggregation Dashboards
- `GET /api/v1/reports/dashboards/mo-queue` — Medical Officer review velocity and queue backlog.
- `GET /api/v1/reports/dashboards/referral-pipeline` — Referral navigation and attendance rates.
- `GET /api/v1/reports/dashboards/camp-outcomes` — Camp target vs actual screening yield.
- `GET /api/v1/reports/dashboards/follow-up-completion` — Follow-up adherence rates.
- `GET /api/v1/reports/dashboards/sync-health` — Offline queue synchronization status.
- `GET /api/v1/reports/export/csv` — CSV export with small-cell suppression (<5) and audit logging.
- `GET /api/v1/reports/export/pdf` — PDF export with non-dismissible simulation header.
- `GET /api/v1/reports/suppression-rules` — Returns platform aggregation and suppression threshold definitions.

### Module 23: Aadhaar Verification Mock Service
- `GET /api/v1/mock/aadhaar/status` — Returns service status: `mock: true`, `realIntegration: "BLOCKED"`.
- `POST /api/v1/mock/aadhaar/otp/generate` — Generates simulated OTP for fake Aadhaar number.
- `POST /api/v1/mock/aadhaar/otp/verify` — Validates simulated OTP; returns masked Aadhaar fragment.
- `POST /api/v1/mock/aadhaar/demographic/verify` — Performs mock name/DOB matching.

### Module 24: Private Storage Security & Access Control
- `POST /api/v1/storage/upload` — Upload private binary file (enforces 10MB limit and magic byte checks).
- `GET /api/v1/storage/files/:id` — Download file (requires token; checks patient/hospital scope).
- `DELETE /api/v1/storage/files/:id` — Deactivate file entry.


### Module 25: Intelligent 3D AI Nurse Assistant ("Drishti AI") & Multimodal Gemini Vision
- `POST /api/v1/assistant/query` — Intelligent Conversational 3D Nurse Assistant & Oral Photo Screening endpoint.
  - **Auth:** Optional (`optionalAuth` allows unauthenticated guests to receive registration guidance, voice help, and oral screening navigation).
  - **Request Body:**
    ```json
    {
      "message": "What are the warning signs of oral ulcers?",
      "language": "en | te | hi",
      "imageBase64": "data:image/jpeg;base64,... (optional oral mucosal photo for Gemini Vision screening)",
      "mimeType": "image/jpeg | image/png | image/webp",
      "context": {
        "activeTab": "dashboard | camps | screening | asr-map"
      },
      "conversationHistory": [
        { "role": "user", "text": "..." },
        { "role": "assistant", "text": "..." }
      ]
    }
    ```
  - **Response Payload (`data`):**
    ```json
    {
      "answerText": "...",
      "speechText": "...",
      "language": "en | te | hi",
      "intent": "greeting | oral_photo_screening | medical_safety_warning | guided_registration | ...",
      "animation": "greeting | idle | listening | thinking | explaining | pointing | happy | warning | demonstrating | empathetic | success | error",
      "expression": "friendly | thoughtful | professional | concerned | smiling | winking | attentive | calm",
      "gesture": "wave | open_hand | point_left | point_right | thumbs_up | hand_to_chin | hands_on_chest | gentle_warning",
      "topic": "oral_lesion_analysis | medical_safety | registration | tour | camps",
      "suggestedActions": ["Consult Dental Surgeon", "Book CHC Appointment"],
      "doctorRecommendation": {
        "specialty": "Dental Surgeon / Oral & Maxillofacial Specialist",
        "facility": "Community Health Centre (CHC) Paderu",
        "urgency": "routine | priority | urgent",
        "timelineDays": 14,
        "consultationReason": "Clinical examination and mucosal inspection"
      },
      "photoAnalysis": { "observedCondition": "...", "riskTier": "..." }
    }
    ```

- `POST /api/v1/assistant/analyze-photo` — Direct Oral Cavity Photo Screening Endpoint.
  - **Auth:** Optional.
  - **Upload Format:** Multipart file (`photo`) OR JSON `{ imageBase64, patientNote, language }`.
  - **Function:** Evaluates mucosal lesion photos via Google Gemini 1.5 Flash Vision API (with automatic offline fallback). Identifies observed condition (leukoplakia, erythroplakia, aphthous sore, caries) and directs the patient to the specific doctor specialty and nearest hospital facility.
  - **Guardrails:** Adheres to AGENTS.md Invariant 1 (Strict non-diagnosis wording scanner). Automated output is labeled `DEMO AI` preliminary screening; requires in-person clinician review.

---

## 25. AI Engine: Multi-Disease Oral Health Screening (Modules A, B, C & Combined Report)

The AI Engine provides comprehensive community-level screening combining mucosal lesions, dental findings, and patient-reported risk factors.

### 25.1 Module A: Mucosal Lesion Analysis
- `POST /api/ai/analyze` (or `/api/v1/ai/analyze`)
  - **Auth:** Required (ASHA, ANM, MO, Specialist, Admin).
  - **Upload:** Multipart image (`image`, max 8 MB, JPEG/PNG).
  - **Body Params:** `patientId`, `hospitalId`, `clientId` (UUID v4), `consentGiven` (mandatory true).
  - **Model:** EfficientNet-B0 backbone with configurable classes loaded from `config/lesion_classes.json` (defaults: `normal`, `benign_inflammatory`, `opmd`, `suspected_malignant`).
  - **Response:** `{ label, confidence, probabilities, refer_to_specialist, model_version, source: "server" | "on-device", image_quality }`.
  - **Fallback:** Returns 502 with `{ fallbackToOffline: true }` if Python FastAPI microservice is offline, prompting frontend to execute WASM on-device inference.

### 25.2 Module B: Dental Multi-Label Examination
- `POST /api/ai/analyze-dental` (or `/api/v1/ai/analyze-dental`)
  - **Auth:** Required (ASHA, ANM, MO, Specialist, Admin).
  - **Upload:** Multipart image (`image`, max 8 MB, JPEG/PNG).
  - **Model:** EfficientNet-B0 multi-label with Sigmoid outputs.
  - **Labels:** `caries`, `gingivitis`, `calculus`, `plaque_soft_deposit`, `discoloration`.
  - **Thresholds:** Configurable via `config/dental_thresholds.json`.
  - **Response:** `{ findings: [{ label, probability, threshold, flagged }], see_dentist_recommended, model_version, source }`.

### 25.3 Module C: Risk-Factor Questionnaire
- `POST /api/ai/risk-assessment`
  - **Auth:** Required.
  - **Body:** `{ patientId, answers: { smoked_tobacco, chewed_tobacco_gutka, areca_nut_betel_quid, alcohol, years_of_use, ulcer_longer_than_2_weeks, white_red_patch, difficulty_opening_mouth, burning_sensation, neck_lump } }`.
  - **Scoring:** Shared `riskScore.js` calculation based on `config/risk_weights.json`.
  - **Response:** `{ score, level: "LOW" | "MODERATE" | "HIGH", flaggedSymptoms, flaggedHabits, reportedByPatient: true, clinicalValidationRequired: true }`.
  - **Persistence:** Appended to patient record clinical history.

### 25.4 Consolidated Oral Health Screening Report
- `POST /api/ai/screenings/combined`
  - **Auth:** Required.
  - **Body:** `{ patientId, hospitalId, clientId, moduleA, moduleB, moduleC }`.
  - **Triaging Matrix:**
    - `referToSpecialist = (Module A is opmd/suspected_malignant) OR (Module C level is HIGH) OR (Module A confidence < 0.60)`.
    - `seeDentist = (any dental finding flagged)`.
    - `badgeColor`:
      - **RED (Urgent Specialist Referral):** Cancer / OPMD referral protocol.
      - **AMBER (Dentist Visit / Clinical Monitor):** Active dental caries/gingivitis or moderate risk.
      - **GREEN (Routine Care):** Normal mucosa, clean dentition, low risk.
  - **Attribution:** `triggerModules` array enumerates exact modules triggering recommendations.
  - **Safety:** Tobacco history labeled strictly as `"Reported by patient"`.

### 25.5 Screening History, Sync & Review
- `GET /api/ai/screenings?patientId=` — Retrieves screening history. Patients receive safe summary without raw probabilities.
- `POST /api/ai/screenings/sync` — Idempotent bulk sync of offline IndexedDB queue (`clientId` deduplication).
- `PATCH /api/ai/screenings/:id/review` — Attending Medical Officer / Specialist confirmation or override (`CONFIRMED` / `OVERRIDDEN`) with mandatory clinical impression. Human assessment is authoritative.



---

## 26. Additional Integrated Core Endpoints (12 Requirements Handover)

### 26.1 Patient Mobile OTP & Aarogya Setu QR Code Integration
- **`GET /api/v1/auth/patient/qr-code`**
  - **Auth:** Public
  - **Query:** `hospitalId` (optional, default `HOSP-PAD-01`)
  - **Response (200):** `{ status: "success", data: { qrCodeDataUrl: "data:image/png;base64,...", authSessionId: string, expiresAt: string, deepLink: "aarogyasetu://abha/connect?...", simulation: true } }`
  - **Description:** Generates an interoperable Aarogya Setu / ABHA deep-link QR code for clinic kiosk and mobile scan.

- **`POST /api/v1/auth/patient/qr-scan`**
  - **Auth:** Public
  - **Body:** `{ qrPayload: string | object, deviceId?: string, deviceName?: string }`
  - **Response (200):** `{ status: "success", data: { status: "OTP_SENT_TO_LINKED_MOBILE", patientId: string, fullName: string, maskedPhone: string, abhaNumber: string, otpDetails: { expiresInSeconds: 300, cooldownSeconds: 60, demoOtpHint: "123456" }, simulation: true } }`
  - **Description:** Parses scanned Aarogya Setu demographic payload, auto-provisions patient, and dispatches verification OTP challenge.

- **`POST /api/v1/auth/change-initial-password`**
  - **Auth:** Required (`auth:me`)
  - **Body:** `{ currentPassword: string, newPassword: string }`
  - **Response (200):** `{ status: "success", data: { success: true, message: "Initial password successfully changed. Account is fully activated.", simulation: true } }`
  - **Description:** Mandatory password rotation required for newly created doctor, manager, or staff accounts before clinical mutations are unlocked.

### 26.2 Hospital and Doctor Verification
- **`POST /api/v1/hospitals/:hospitalId/doctors`**
  - **Auth:** Required (`hospital:manage`, Hospital Manager or System Admin)
  - **Params:** `hospitalId: string`
  - **Body:** `{ fullName, username, phone, email, password?, specialization, qualifications, councilRegistrationNumber, experienceYears, qualificationDocuments: [{ documentId, documentType, fileUrl, sha256Hash }] }`
  - **Response (201):** `{ status: "success", data: { doctor: { userId, username, fullName, role: "medical_officer", verificationStatus: "pending_verification", mustChangePassword: true }, temporaryPassword: string, simulation: true } }`
  - **Description:** Creates doctor account scoped to hospital with pending verification status and initial password change enforcement.

- **`GET /api/v1/hospitals/:hospitalId/doctors`**
  - **Auth:** Required (`hospital:read`)
  - **Params:** `hospitalId: string`
  - **Response (200):** `{ status: "success", data: { doctors: Array<DoctorUserSummary>, total: number, simulation: true } }`
  - **Description:** Lists all doctor accounts registered at the specified healthcare facility.

- **`POST /api/v1/hospitals/:hospitalId/doctors/:doctorId/verify`**
  - **Auth:** Required (`hospital:manage`)
  - **Params:** `hospitalId: string`, `doctorId: string`
  - **Response (200):** `{ status: "success", data: { doctorId: string, verificationStatus: "verified", verifiedBy: string, verifiedAt: Date, message: "Doctor qualifications verified and account fully authorized.", simulation: true } }`
  - **Description:** Hospital Manager approves and verifies doctor credentials following certificate inspection.

### 26.3 Configurable Questionnaire & Guided Image Quality
- **`GET /api/v1/screening/questionnaire-config`**
  - **Auth:** Public
  - **Response (200):** `{ status: "success", data: { questionnaire: { version: "2.0.0", supportedLanguages: ["en", "te", "hi"], sections: [...] }, simulation: true } }`
  - **Description:** Returns complete multi-language questionnaire covering age, gender, oral history, tobacco (including regional reverse smoking `chutta`), areca nut, alcohol, symptoms, duration, and informed consent.

- **`POST /api/v1/screening/quality-check`**
  - **Auth:** Public
  - **Body:** `{ blurScore?: number, brightness?: number, width?: number, height?: number, oralRegion?: string }`
  - **Response (200):** `{ status: "success", data: { ok: boolean, oralRegion: string, blurScore: number, brightness: number, resolution: string, issues: string[], guidance: string, simulation: true } }`
  - **Description:** Pre-upload image quality validator checking sharpness, illumination, and resolution for standard anatomical oral regions.

### 26.4 Screening Report PDF Management
- **`GET /api/v1/screening/cases/:id/report/pdf`**
  - **Auth:** Required (`screening:read`)
  - **Params:** `id: string` (caseId)
  - **Headers Sent:** `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="aarogya-screening-report-<caseId>.pdf"`
  - **Description:** Streams tamper-evident PDF-1.4 report including masked demographics, questionnaire summary, image quality, preliminary risk category, clinician assessment notes, and simulation disclaimer. Gated for patients until formal clinician release.

### 26.5 Urgent Consultation Pipeline
- **`POST /api/v1/teleconsultation/urgent`**
  - **Auth:** Required (`telemedicine:request`)
  - **Body:** `{ patientId: string, patientName?: string, hospitalId: string, urgencyReason: string, symptomDurationDays?: number, assignedClinicianId?: string, screeningCaseId?: string, appointmentId?: string }`
  - **Response (201):** `{ status: "success", data: { consultation: ITeleconsultation, urgentAlertDispatched: true, emergencyContact: "108 / CHC Paderu: +91 8935-254108", emergencyInstructions: [...], simulation: true } }`
  - **Description:** Requests high-priority emergency teleconsultation with instant on-call clinician dispatch and emergency care instructions.

- **`POST /api/v1/teleconsultation/:id/urgent-acknowledge`**
  - **Auth:** Required (`telemedicine:manage`)
  - **Params:** `id: string` (consultationId)
  - **Response (200):** `{ status: "success", data: { consultationId: string, urgentStatus: "ACKNOWLEDGED", acknowledgedBy: string, acknowledgedAt: Date, simulation: true } }`
  - **Description:** On-duty medical officer acknowledges urgent consultation triage request.
## Appointment Video Consultation (Daily.co)

All endpoints are under `/api/v1/consultations`; JWT and capability authorization are required.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/provider-status` | Authenticated user, `appointment:read` | Test Daily connectivity and report status without returning credential values |
| GET | `/admin/video-provider` | System admin, `users:manage` | Read Daily connection state, source, and encryption readiness (never the key) |
| PUT | `/admin/video-provider` | System admin, `users:manage` | Test and encrypt Daily credentials at rest before saving settings |
| GET | `/direct-calls/patients` | Doctor, `appointment:read` | List verified patient accounts associated with the doctor's hospital |
| GET | `/direct-calls/incoming` | Patient, `appointment:read` | List active direct-call invitations for the signed-in patient |
| GET | `/direct-calls/outgoing` | Doctor, `appointment:read` | List active direct calls initiated by the signed-in doctor |
| POST | `/direct-calls` | Doctor, `appointment:confirm` | Create a private Daily room and notify the selected facility patient |
| POST | `/direct-calls/:callId/join` | Calling doctor or invited patient, `appointment:read` | Issue a room-scoped Daily participant token after identity checks |
| POST | `/direct-calls/:callId/reject` | Invited patient, `appointment:read` | Decline an incoming call and close its room |
| GET | `/direct-calls/:callId/status` | Calling doctor or invited patient, `appointment:read` | Read direct-call status and timer |
| POST | `/direct-calls/:callId/start` | Calling doctor, `appointment:confirm` | Start the 30-minute timer after the patient answers |
| POST | `/direct-calls/:callId/end` | Calling doctor, `appointment:confirm` | End the call and optionally save versioned clinical notes |
| POST | `/direct-calls/:callId/leave` | Calling doctor or invited patient, `appointment:read` | Leave and close a direct call |
| PUT | `/direct-calls/:callId/notes` | Calling doctor, `telemedicine:notes` | Save SHA-256 hashed, versioned clinical notes |
| GET | `/appointments/my` | Patient, `appointment:read` | List own appointments and consultation state |
| GET | `/availability?date=YYYY-MM-DD` | Patient, `appointment:read` | List verified doctors with free slot counts; hospital selection is not required |
| GET | `/doctor/appointments?date=YYYY-MM-DD` | Assigned doctor, `appointment:read` | List own hospital-scoped appointments and patient waiting state |
| POST | `/:appointmentId/waiting` | Patient, `appointment:read` | Enter waiting room at/after the confirmed appointment time |
| POST | `/:appointmentId/send-link` | Assigned doctor, `appointment:confirm` | After appointment confirmation, create a private Daily room and deliver a patient inbox link; patient waiting room is optional |
| POST | `/join/:token` | Patient or assigned doctor, `appointment:read` | Validate the random link and issue a Daily participant token |
| POST | `/:appointmentId/doctor-join` | Assigned doctor, `appointment:read` | Issue a scoped Daily token after the patient opens the link; supports doctor rejoin after dashboard reload |
| POST | `/:appointmentId/doctor-join` | Assigned doctor, `appointment:read` | Issue a room-scoped Daily token after the invited patient opens the link; supports doctor rejoin after dashboard reload |
| GET | `/:appointmentId/status` | Assigned patient or doctor, `appointment:read` | Poll consultation state and remaining time |
| POST | `/:appointmentId/start` | Assigned doctor, `appointment:confirm` | Start the one-time 30-minute server timer and shorten Daily room expiry |
| POST | `/:appointmentId/end` | Assigned doctor, `appointment:confirm` | End provider room and complete appointment |
| PUT | `/:appointmentId/notes` | Assigned doctor, `telemedicine:notes` | Save SHA-256 hashed, versioned clinician notes |

Daily credentials may be supplied by server environment variables (`DAILY_API_KEY`, `DAILY_DOMAIN`) or configured by a `system_admin` in Admin > Video Provider Settings. Admin-entered keys are verified against Daily before saving and encrypted with AES-256-GCM; only the domain and connection state are returned to clients. Admin storage requires a persistent 32-byte hex `VIDEO_CONFIG_ENCRYPTION_KEY`. Set `CLIENT_ORIGIN` to the public frontend origin in deployed environments so patient notifications contain the correct URL; local development can use the requesting localhost origin. With no valid provider configuration, issuing/joining video returns `VIDEO_PROVIDER_BLOCKED`; the dashboard reports the provider error and disables live-call controls. Direct-call mutation bodies include a UUID `clientMutationId` for sync-ledger replay protection. Direct calls are restricted to the signed-in doctor and a verified patient account associated with that doctor's hospital. The patient can accept or reject an incoming call; the doctor can start only after acceptance. For appointment calls, assigned future requests remain in the doctor queue; the doctor accepts the request, sends the private link, and joins after the patient opens it. The patient waiting-room endpoint remains available. Existing appointment-linked consultation and text teleconsultation flows remain available. SMS and email dispatch remain blocked by the simulation notification adapters and are not represented as delivered.

## Patient Dashboard Portal (Additive)

All new routes use `requireAuth`, patient role and patient ownership checks. Mutations use UUID mutation IDs and `SyncLedger` where applicable. The full route and ownership map is in `PATIENT_DASHBOARD_PORTAL.md`.

| Method | Path | Capability | Purpose |
|---|---|---|---|
| GET | `/api/patient/profile` | `patient:read_own` | Read safe fields for the signed-in patient |
| PUT | `/api/patient/profile` | `patient:profile_own` | Update only allowlisted profile fields with `consentGiven: true` and UUID `mutationId` |
| GET / POST | `/api/patient/screenings/:screeningId/chat` | `patient:read_own` / `patient:chat_own` | Read or append a screening-scoped, patient-owned AI chat |
| GET / POST | `/api/patient/support-tickets` | `patient:read_own` / `patient:support_own` | Read or idempotently create patient-owned support tickets |
| GET | `/api/v1/notifications/preferences` | `notification:read_own` | Read the signed-in user’s reminder channels, topics, and language |
| PUT | `/api/v1/notifications/preferences` | `notification:manage_own` | Update reminder preferences; UUID `mutationId` writes are replay-safe through `SyncLedger` |
| GET | `/api/patient/treatment-plans` | `patient:read_own` | List the signed-in patient’s treatment plans |
| POST | `/api/patient/treatment-plans/from-prescription` | `patient:treatment_own` | Create an additive tracking plan from an owned prescription |
| GET | `/api/patient/treatment-plans/:treatmentPlanId` | `patient:read_own` | Read an owned plan |
| GET | `/api/patient/treatment-plans/:treatmentPlanId/logs` | `patient:read_own` | Read up to 90 logs for an owned plan |
| POST | `/api/patient/treatment-logs` | `patient:treatment_own` | Idempotently save a daily medicine check-in and optional patient note |
| POST | `/api/patient/treatment-plans/:treatmentPlanId/photos` | `patient:treatment_own` | Upload a consented progress photo to private storage with SHA-256 and UUID replay protection |
| GET | `/api/v1/storage/files/:fileId` | Patient owner or `storage:read_clinical` | Stream a private file after ownership/scope checks; no public file URLs |

Patient auth remains on the existing `/api/v1/auth/patient/*` and `/api/v1/patient/auth/*` routes. Existing screening, prescription, appointment, notification, and referral endpoints are reused without route renames. The appointment creation endpoint now requires explicit consent when report/profile sharing fields are requested and records consent scope/time in the existing `visitDetails` field.

### Appointment requests and live room transport (additive)

| Method | Path / event | Access | Request / behavior |
|---|---|---|---|
| POST | `/api/v1/appointments/:id/doctor-response` | Assigned `medical_officer` or `specialist_doctor`, `appointment:confirm` | `{ mutationId: UUID, decision: "accept" | "decline", declineReason?: string }`; records the response, and a decline sends an in-app patient update. Replays use `sync_ledgers`. |
| POST | `/api/v1/appointments/:id/cancel` | Appointment owner or in-scope staff, `appointment:cancel` | `{ reason: string, mutationId?: UUID }`; UUID mutations are replay-safe and ownership / facility scope is checked. |
| PATCH | `/api/v1/appointments/:id/respond-new-time` | Patient owner or in-scope staff, `appointment:reschedule` | `{ accept: boolean, mutationId?: UUID }`; accepts or declines the pending proposed time. |
| Socket.IO connect | `/socket.io` | Signed access token in handshake auth | `{ auth: { token } }`; simulation tokens are denied. |
| Socket.IO `consultation:join` | Client → server | Patient on their own appointment, or its assigned doctor | `{ appointmentId }`; online mode, confirmation, ownership, facility assignment, and appointment time window are checked. |
| Socket.IO `consultation:joined` | Server → client | Authorized room participant | `{ appointmentId, role, peerPresent, iceServers }`; ICE config is returned only after authorization. |
| Socket.IO `consultation:participant-ready` | Server → room peer | Authorized room participant | Indicates the opposite-role participant entered the room. |
| Socket.IO `webrtc:signal` | Both directions | Room member only | Relays only SDP offer/answer and ICE candidates. Application servers do not relay or store media bytes. |
| Socket.IO `consultation:leave` | Client → server | Current room participant | Leaves the room and notifies its peer. |

ICE configuration is server-only: `STUN_URLS` (comma-separated), `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL`. The sample STUN service is a development default; production deployments should configure a managed STUN/TURN service or Coturn. Existing Daily.co consultation routes remain available.


### Doctor workflow extension (2026-11-12)

Doctor sidebar destinations now remain under `/doctor/:section` (queue, appointments, high-risk, referrals, biopsy, patients, availability). Admin doctor provisioning uses the existing hospital doctor API and private storage; approval requires qualification documents and council registration.

- `GET/POST /api/v1/consultations/doctor/availability`: authenticated approved doctor publishes future 20-minute slots in India time; POST accepts `{startTime: ISO, mutationId: UUID}` and returns `{slot}`. GET returns own `{slots}`.
- `GET /api/v1/consultations/availability/:doctorId?date=YYYY-MM-DD`: authenticated appointment reader receives published slots and availability. Existing patient availability listing now counts doctor-published slots. Booking validates the doctor, facility and exact published slot. Existing facility conflict protection remains in place.
- `GET /api/v1/consultations/doctor/patients/:patientId/records`: approved doctor with patient-read capability; facility-scoped, audited patient, screenings, clinical cases, prescriptions, appointments, consultations and versioned notes. No cross-facility search.
- Additive `doctorslots` collection: doctorId, hospitalId, startTime, endTime, mutationId; unique doctor/start and mutation indexes.
- Additive `consultationchats` collection: messageId (unique), appointmentId, senderId, role, text (immutable), SHA-256 (immutable), timestamps. Socket chat uses authenticated appointment rooms, bounded messages and idempotent message IDs. History is returned only after room authorization. Doctor starts the room before patient joins.
- Prescriptions add optional immutable SHA-256 and sparse unique mutationId fields. Existing documents remain valid. New prescriptions resolve doctor/patient/facility names server-side and require approved treating doctor access. UI starts with empty clinician-authored medicine fields.
- Verification: consultationSocket tests cover doctor-first room access, signaling and saved chat replay; appointmentsManagement tests cover slot publication, publication authorization and replay; module smoke, backup/restore and secret-scanner checks. Real camera/audio testing across two devices and network TURN relay remains an operational acceptance check.
