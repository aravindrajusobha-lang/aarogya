# Phase 13: Teleconsultation & Provider Case Discussion Report

## 1. Executive Summary
Phase 13 implements scheduled teleconsultation between patients or frontline Health Workers (ASHA/ANM) and Medical Officers or specialists in Aarogya-Drishti. The module manages the end-to-end lifecycle of consultation requests, scheduling, status progression, immutable clinical notes, and real provider-to-provider case discussion.

Per clinical safety specifications:
- **No live video or audio calling occurs in this release.** A formal `SimulationBlockedVideoAdapter` interface returns explicit `BLOCKED` stubs in both API responses and user interfaces. No simulated fake call screens or fake camera overlays exist.
- **Voice, photo, and video consultation channels remain BLOCKED** until approved, certified WebRTC/telemedicine hardware adapters are integrated.
- **Provider-to-provider case discussions are real and active**, enabling authenticated clinical communication between Medical Officers, specialists, and frontline workers.
- **Clinical notes are restricted to the assigned clinician**, versioned cryptographically with SHA-256 provenance hashes, and hidden from patient viewing until formally authorized and released (`RESULT_NOT_RELEASED` gate).

---

## 2. Architecture & Data Model
- **Adapter Interface & Stub:** [teleconsultationAdapter.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/teleconsultation/teleconsultationAdapter.ts)
- **Data Models:** [teleconsultationModel.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/teleconsultation/teleconsultationModel.ts)
  - `Teleconsultation`: Core session tracking, status, and channel configuration.
  - `ConsultationNote`: Immutable, versioned clinical notes with original SHA-256 hash integrity.
  - `ConsultationMessage`: Real text-based case discussion among verified healthcare personnel.
- **Service Layer:** [teleconsultationService.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/teleconsultation/teleconsultationService.ts)
- **API Endpoints:** [teleconsultationRoutes.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/teleconsultation/teleconsultationRoutes.ts) mounted at `/api/v1/teleconsultation`
- **Frontend Component:** [TeleconsultationManager.tsx](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/client/src/components/TeleconsultationManager.tsx)

### Status Lifecycle:
`REQUESTED` ➔ `SCHEDULED` ➔ `IN_PROGRESS` ➔ `COMPLETED` or `CANCELLED`

| Status | Allowed Next Statuses | Actor / Action | Description |
| :--- | :--- | :--- | :--- |
| `REQUESTED` | `SCHEDULED`, `CANCELLED` | Health Worker / Hospital Staff | Session requested with designated clinician and facility |
| `SCHEDULED` | `IN_PROGRESS`, `CANCELLED` | Hospital Manager / MO | Appointment window reserved |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` | Assigned Clinician | Consultation active; clinical notes recorded |
| `COMPLETED` | *(Terminal)* | Assigned Clinician | Session finalized after notes release |
| `CANCELLED` | *(Terminal)* | Clinician / Admin | Session cancelled with mandatory audit reason |

---

## 3. Governance & Safety Mechanisms

### A. Explicit `BLOCKED` Adapter Stub (No Fake Call Screen)
- Video session queries (`GET /api/v1/teleconsultation/:id/video-session`) return:
  ```json
  {
    "status": "BLOCKED",
    "provider": "aarogya_simulation_blocked_adapter",
    "reason": "Real-time video teleconsultation is a BLOCKED stub in simulation mode. No live video adapter configured.",
    "showCallControls": false
  }
  ```
- Voice session queries (`GET /api/v1/teleconsultation/:id/voice-session`) similarly return `status: "BLOCKED"`.
- Both the backend API and frontend UI render unambiguous `BLOCKED` warnings. No animated fake ringing screens, fake camera feeds, or dummy mute buttons are displayed.

### B. Real Staff-Only Case Discussion
- Clinical case discussion is functional for authorized healthcare roles: `medical_officer`, `specialist`, `anm`, `asha`, `admin`, and `hospital_manager`.
- Messages are saved to `ConsultationMessage` with author provenance, role stamp, and timestamp.
- **Patients are strictly barred** from viewing or posting into the staff discussion thread with `403 FORBIDDEN_STAFF_DISCUSSION`.

### C. Assigned Clinician Authorization for Clinical Notes
- Only the clinician assigned to the teleconsultation (`consultation.assignedClinicianId === actor.userId`) is authorized to record or amend clinical notes.
- Unassigned Medical Officers or other staff receive `403 FORBIDDEN_NOT_ASSIGNED_CLINICIAN`.

### D. Note Immutability & Provenance Hashing
- Initial consultation notes are hashed using `crypto.createHash('sha256')`.
- Amendments do not overwrite the initial record. They append to an `amendments` array with:
  - An incremented version number (`v2`, `v3`, ...).
  - The amendment timestamp and author.
  - A mandatory clinical reason for amendment.
  - A content hash of the amended payload.
- The `originalHash` remains strictly unchanged across all version updates.

### E. Patient Release Gating (`RESULT_NOT_RELEASED`)
- Patients attempting to view clinical consultation notes before formal clinician release are blocked with `403 RESULT_NOT_RELEASED`.
- Clinicians or authorized reviewers release notes via `POST /api/v1/teleconsultation/:id/release`. Once released, patient access succeeds with HTTP `200`.

### F. Cross-Hospital Access Denial
- All teleconsultation sessions are scoped to their owning hospital (`hospitalId`).
- Staff from other healthcare facilities attempting to read, update, or cancel sessions are blocked with `403 CROSS_HOSPITAL_FORBIDDEN`.

### G. Clinical Safety Wording Scanner
- The entire teleconsultation codebase adheres strictly to non-diagnostic terminology rules.
- Scanned by `tests/wordingSafety.test.ts` against prohibited patterns (`/\bdiagnosis\b/i`, `/\bcancer[- ]free\b/i`, `/\bstage\s+[1-4ivx]+\b/i`, etc.). Zero violations found.

---

## 4. Verification & Test Evidence

### Vitest Test Results:
1. **[teleconsultationWorkflow.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/teleconsultationWorkflow.test.ts)**:
   - `15 / 15 passed`
   - Covers:
     1. Teleconsultation request, scheduling, start, and status transitions.
     2. Video & voice adapters returning explicit `BLOCKED` stub with `showCallControls: false`.
     3. Clinical notes authorization: unassigned clinician denied (403), assigned clinician allowed (201).
     4. Note amendment preserving `originalHash` byte-identical across versions.
     5. Patient release gating: `403 RESULT_NOT_RELEASED` prior to release, `200` after release.
     6. Staff discussion thread: staff permitted, patient blocked (403).
     7. Cross-hospital denial: staff from different hospital blocked with `403 CROSS_HOSPITAL_FORBIDDEN`.
     8. Cancellation with mandatory clinical reason.

2. **Combined Multi-Phase Regression Suite**:
   - `tests/appointmentsManagement.test.ts`: **23 / 23 passed**
   - `tests/teleconsultationWorkflow.test.ts`: **15 / 15 passed**
   - `tests/biopsyWorkflow.test.ts`: **19 / 19 passed**
   - `tests/referralsAndFollowUp.test.ts`: **13 / 13 passed**
   - `tests/authorizationMatrix.test.ts`: **801 / 801 passed**
   - `tests/wordingSafety.test.ts`: **2 / 2 passed**
   - `tests/i18nParity.test.ts`: **4 / 4 passed**
   - **Total Tests Passed: 877 / 877 (100% pass rate)**

3. **Frontend Client Build**:
   - `npm run build` executed cleanly with Vite and TypeScript producing zero errors.
