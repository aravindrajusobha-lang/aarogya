# Phase 11: Biopsy Workflow & Specimen Tracking Report

## 1. Executive Summary
Phase 11 implements the clinical biopsy tracking workflow for Aarogya-Drishti. The system strictly separates three distinct data entities to satisfy Indian DPDP (Digital Personal Data Protection) norms and prevents unauthorized disclosure of clinical information before formal medical review. The platform provides specimen accessioning, barcode tracking, laboratory dispatch, microscopic findings entry, and result release authorization while enforcing byte-level provenance immutability and non-diagnostic clinical safety guardrails.

---

## 2. Architecture & Data Model Separation
To preserve patient confidentiality and medical governance, biopsy information is partitioned across three decoupled entities:

1. **Biopsy Procedure Record (`BiopsyRecord` / `Biopsy`)**:
   - Location: [biopsyModel.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/biopsy/biopsyModel.ts#L30-L186)
   - Status Lifecycle: `REQUESTED` ➔ `SCHEDULED` ➔ `COLLECTED` ➔ `SENT_TO_LAB` ➔ `RESULT_RECEIVED` ➔ `RECOLLECTION_REQUIRED` / `CANCELLED`
   - Tracks specimen accessioning, collection barcode, fixative, and transit courier details.

2. **Histopathology Findings (`BiopsyFindings`)**:
   - Location: [biopsyModel.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/biopsy/biopsyModel.ts#L187-L266)
   - Entered strictly by qualified pathologists (`pathologist`, `specialist`, `medical_officer`).
   - Stores specimen adequacy, gross description, microscopic observations, and pathologist impression.

3. **Result Release (`BiopsyResultRelease`)**:
   - Location: [biopsyModel.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/biopsy/biopsyModel.ts#L267-L354)
   - Gated release authorization step reviewed by qualified medical officer or specialist reviewer.
   - **Gating Rule:** Patients attempting to fetch findings before release receive `403 RESULT_NOT_RELEASED`. Only once the release document is signed off can the patient view their summary message and recommended action.

---

## 3. Transition Table & Loop-Back Semantics
State transitions are validated via `ALLOWED_BIOPSY_TRANSITIONS` in [biopsyService.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/biopsy/biopsyService.ts#L14-L24):

| Source Status | Allowed Target Statuses | Notes / Rejection Rules |
| :--- | :--- | :--- |
| `REQUESTED` | `SCHEDULED`, `CANCELLED` | Direct jump to `COLLECTED` or `RESULT_RECEIVED` rejected with `400 INVALID_BIOPSY_TRANSITION` |
| `SCHEDULED` | `COLLECTED`, `SCHEDULED`, `CANCELLED` | Cannot skip collection directly to `SENT_TO_LAB` |
| `COLLECTED` | `SENT_TO_LAB`, `RECOLLECTION_REQUIRED`, `CANCELLED` | Cannot transition backward to `SCHEDULED` |
| `SENT_TO_LAB` | `RESULT_RECEIVED`, `RECOLLECTION_REQUIRED`, `CANCELLED` | Cannot transition backward to `COLLECTED` |
| `RESULT_RECEIVED` | `CANCELLED` | Terminal analysis state; findings documented |
| `RECOLLECTION_REQUIRED` | `SCHEDULED`, `COLLECTED`, `CANCELLED` | **Loops back correctly** to either `SCHEDULED` or direct `COLLECTED` |
| `CANCELLED` | *(None)* | Terminal state; all forward transitions rejected |

---

## 4. Attachment Immutability & Provenance (SHA-256)
- Initial attachments record `originalFileId` and `originalSha256`.
- Laboratory report amendments (`POST /api/v1/biopsy/:id/amend-attachment`) create an incremented version in `amendmentHistory`.
- The original SHA-256 hash remains byte-identical and unmutated throughout the procedure history.

---

## 5. Verification & Test Evidence
- Test Suite: [biopsyWorkflow.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/biopsyWorkflow.test.ts)
- Test Count: **19 / 19 tests passing**
- Coverage includes:
  1. Full legal lifecycle (`REQUESTED` ➔ `SCHEDULED` ➔ `COLLECTED` ➔ `SENT_TO_LAB` ➔ `RESULT_RECEIVED` ➔ `RELEASED`).
  2. Transition table enforcement (every illegal transition rejected with 400).
  3. `RECOLLECTION_REQUIRED` loop-back to both `SCHEDULED` and `COLLECTED`.
  4. Release gating: patient denied (403) before release, allowed (200) after release.
  5. SHA-256 attachment immutability verification.
  6. Frontline worker authorization restrictions and cancellation reason governance.
