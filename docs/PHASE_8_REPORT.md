# Aarogya-Drishti — Phase 8 Engineering Report
## Screening, Demo AI, and Medical Officer (MO) Case Queue

**Version:** 0.2.0  
**Status:** Completed & Validated  
**Simulation Mode:** Active (`SIMULATION=true`)  
**Test Suite:** 24 Test Files, 596 Tests Passing (100% Pass Rate)

---

## 1. Executive Summary

Phase 8 implements the frontline clinical screening pipeline, the simulated DEMO AI risk-support evaluation service, and the Medical Officer (MO) Case Queue. This subsystem bridges frontline health worker (ASHA/ANM) visual inspection intakes with institutional Medical Officer clinical assessment, triage, escalation, specialist referral, and patient-facing result disclosure under strict Indian Digital Personal Data Protection (DPDP) Act compliance.

All architectural invariants mandated in the technical specification have been strictly satisfied:
1. **Prominent Simulation Banners:** Guaranteed on every screening screen and embedded in every AI output.
2. **Byte-Identical Original Images:** Original clinical image files and their SHA-256 cryptographic hashes remain permanently immutable; photo amendments produce version-tracked amendment chains without mutating the original.
3. **Clinical Evaluation & Result Release Entity Separation:** Clinician findings (`ClinicalAssessment`) and official patient communication disclosures (`ResultRelease`) are managed as distinct, uncoupled MongoDB entities; patients are prevented from seeing clinical findings until a dedicated release transaction is executed.
4. **Mandatory Wording Safety Scanner:** 100% compliance with clinical safety guardrails prohibiting diagnostic claims (`diagnosis`, `diagnose`, `cancer stage`, `curative`, etc.) across all source files.
5. **Cross-Hospital Isolation:** Case queue viewing and assignment are strictly confined to the clinician's assigned hospital; cross-hospital assignments are rejected with `403 Forbidden`.

---

## 2. Architecture & Data Model

### 2.1 Entity Separation Architecture

```
Frontline Intake ──> [ ScreeningPhoto ] ──(Immutable original SHA-256)
                           │
                           ▼
                     [ ScreeningCase ] ──(Hospital Scope & Priority)
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
  [ ClinicalAssessment ]          [ ResultRelease ]
  (Clinician findings,            (Patient-facing summary,
   impression & risk support)      official release timestamp)
            │                             │
    [ Internal Only ]             [ Patient Accessible ]
```

### 2.2 Core Models

#### A. Screening Photo (`screeningPhotoModel.ts`)
- **`photoId`**: Unique identifier (`pho_<12-hex>`).
- **`originalSha256`**: Immutable SHA-256 hash computed upon initial intake upload.
- **`originalFileId`**: Storage file reference to the unaltered byte stream.
- **`currentSha256`**: Active hash reflecting the current working version.
- **`version`**: Monotonically incrementing integer (starts at `1`).
- **`isDemo`**: Boolean flag indicating simulation/demo data.
- **`consentId`**: Reference to verified DPDP consent record (required if `isDemo: false`).
- **`amendmentHistory`**: Append-only array tracking version, amended file ID, SHA-256, reason, and timestamp.

#### B. Screening Case (`screeningCaseModel.ts`)
- **`caseId`**: Unique identifier (`sc_<12-hex>`).
- **`patientId` / `patientName` / `villageId`**: Frontline demographics.
- **`hospitalId`**: Institutional tenancy boundary (e.g., `hosp_paderu_dh`, `hosp_aruku_chc`).
- **`status`**: State machine (`pending_assignment` ➔ `assigned` ➔ `under_review` ➔ `completed` / `escalated` / `referral_requested`).
- **`priority`**: `'routine'` | `'urgent'` | `'high_priority'`.
- **`demoAiResult`**: Embedded non-diagnostic risk-support metadata.
- **`assignedMoId` / `assignedMoName`**: Clinician ownership.
- **`clinicalAssessmentId`**: Reference to `ClinicalAssessment`.
- **`resultReleaseId`**: Reference to `ResultRelease`.
- **`resultReleased`**: Boolean gate preventing patient visibility.

#### C. Clinical Assessment (`clinicalAssessmentModel.ts`)
- **`assessmentId`**: Unique identifier (`ass_<12-hex>`).
- **`clinicalImpression`**: Frontline clinician observation text.
- **`riskCategorization`**: `'low_risk_support'` | `'moderate_risk_support'` | `'high_risk_support'`.
- **`anatomicalSite`**: Oral cavity site (buccal mucosa, tongue, palate, lip, etc.).
- **`recommendedFollowUpDays`**: Number of days for health worker follow-up.

#### D. Result Release (`resultReleaseModel.ts`)
- **`releaseId`**: Unique identifier (`rel_<12-hex>`).
- **`releasedBy`**: Clinician user ID authorizing disclosure.
- **`patientSummaryMessage`**: Plain-language guidance accessible to the patient.
- **`recommendedAction`**: Clear, non-diagnostic next steps (e.g., local PHC follow-up).
- **`status`**: `'released'`.

---

## 3. DEMO AI & Quality Checks Specification

The DEMO AI service (`/api/v1/screening/ai/analyze`) provides assistive risk-support categorization without diagnostic claims:
- **Risk Support Labels:** Strictly returns `'low_risk_support'`, `'moderate_risk_support'`, or `'high_risk_support'`.
- **Quality Checks:** Per v0.2 specifications, positioning, obstruction, and missing-area checks return strictly `"unavailable"`.
- **Disclaimers:** Every AI response carries:
  ```json
  {
    "riskSupportLabel": "moderate_risk_support",
    "confidenceScore": 0.82,
    "qualityChecks": {
      "positioning": "unavailable",
      "obstruction": "unavailable",
      "missingArea": "unavailable"
    },
    "simulationBanner": "SIMULATION DEMO AI - NON-DIAGNOSTIC",
    "disclaimer": "Assistive risk-support estimation only. Does not provide clinical diagnosis or cancer staging."
  }
  ```

---

## 4. API Endpoints & Capabilities

All 13 screening endpoints are integrated into the central `authorizationEngine.ts` and Express router:

| Method | Endpoint | Capability | Scope & Security |
|---|---|---|---|
| `POST` | `/api/v1/screening/photos/upload` | `screening:create` | Consent guard: requires active consent unless `isDemo: true`. |
| `POST` | `/api/v1/screening/photos/:id/amend` | `screening:create` | Creates version `N+1`; verifies original hash unchanged. |
| `GET` | `/api/v1/screening/photos/:id` | `screening:read` | Returns photo metadata and amendment history. |
| `POST` | `/api/v1/screening/ai/analyze` | `screening:create` | Evaluates photo hash; returns quality checks as `"unavailable"`. |
| `POST` | `/api/v1/screening/cases` | `screening:create` | Enters screening intake into MO hospital queue. |
| `GET` | `/api/v1/screening/cases` | `screening:read` | Hospital-scoped case queue for MOs and Hospital Admins. |
| `GET` | `/api/v1/screening/cases/:id` | `screening:read` | Returns full case record within hospital scope. |
| `POST` | `/api/v1/screening/cases/:id/assign` | `screening:assign` | Rejects cross-hospital assigners and assignees with `403`. |
| `POST` | `/api/v1/screening/cases/:id/assess` | `screening:review` | Records `ClinicalAssessment` without releasing to patient. |
| `POST` | `/api/v1/screening/cases/:id/release-result` | `screening:release` | Creates `ResultRelease` and enables patient disclosure. |
| `POST` | `/api/v1/screening/cases/:id/escalate` | `screening:review` | MO escalation for secondary clinical review. |
| `POST` | `/api/v1/screening/cases/:id/referral` | `screening:review` | Creates specialist referral request. |
| `GET` | `/api/v1/screening/patient/:patientId/results` | `screening:read_own` | Withholds results (`evaluationsWithheld: true`) until released. |

---

## 5. Verification & Test Evidence

### 5.1 Test Execution Results

```
Test Files  24 passed (24)
Tests       596 passed (596)
Duration    66.68s
```

### 5.2 Key Test Suites

1. **`screeningAndMoQueue.test.ts` (15 tests passing):**
   - Consent enforcement: Unconsented non-demo uploads rejected (`400`).
   - Demo uploads bypass active consent requirement.
   - Original SHA-256 remains byte-identical after amendments (`version: 2`).
   - DEMO AI quality checks return `"unavailable"`.
   - Cross-hospital case assignment denied (`403 Forbidden`).
   - Separation of assessment and release: results withheld until released.
   - MO escalation and referral workflows verified.
   - Append-only audit events logged for all screening transactions.

2. **`wordingSafety.test.ts` (2 tests passing):**
   - Scans all files in `server/src/`.
   - Verifies 0 occurrences of prohibited clinical terminology (`diagnosis`, `diagnose`, `cancer stage`, `stage 1-4`, `curative`, `chemotherapy`, `radiation plan`).

3. **`authorizationMatrix.test.ts` (453 tests passing):**
   - 100% Express route coverage verified.
   - All roles tested across all 13 screening endpoints.

---

## 6. Frontend Implementation

The client application includes a dedicated `ScreeningManager.tsx` component mounted on the main dashboard (`Clinical Screening` tab):
- **Simulation Banner:** High-visibility amber banner reminding operators that this is a simulated triage interface.
- **Intake & Upload View:** Supports toggling demo status, consent linkage, and real-time SHA-256 calculation.
- **Amendment Studio:** Displays original hash immutability and version increments.
- **DEMO AI Card:** Shows risk-support level, confidence score, and quality checks (`unavailable`).
- **MO Case Queue View:** Filtered by hospital tenancy, showing status tags, assignment controls, and review action panel.
- **Separate Assessment & Release Actions:** Independent forms for MO internal notes and official patient-facing messages.
- **Escalation & Specialist Referral:** Integrated dialogs for district-level escalation.
- **Patient Results View:** Transparent demonstration that results are withheld until clinician release.
