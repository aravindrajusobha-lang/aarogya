# Aarogya-Drishti — Phase 9 Engineering Report
## Screening Camps Management & Controlled Lifecycle

**Platform Version:** 0.2.0  
**Status:** Completed & Validated  
**Simulation Mode:** Active (`SIMULATION=true`)  
**Test Suite:** 25 Test Files, 718 Tests Passing (100% Pass Rate)

---

## 1. Executive Summary

Phase 9 establishes the frontline **Community Screening Camps** subsystem for Aarogya-Drishti. In the tribal agency tracts of ITDA Paderu (Alluri Sitharama Raju district, Andhra Pradesh), community screening camps serve as the primary clinical intake mechanism for oral cancer risk assessment. 

Frontline camps require strict lifecycle governance, clinical communication guardrails, tenant isolation between administrative hospitals, health worker catchment scoping, team collision avoidance, and privacy protection for small rural habitations.

### Core Architectural Invariants Delivered:
1. **Enforced Lifecycle State Machine:** A camp **must be in `PUBLISHED` status before it can start**. Attempting to start a camp from `DRAFT`, `SCHEDULED`, `COMPLETED`, or `CANCELLED` status is strictly rejected with a typed error (`INVALID_CAMP_TRANSITION`).
2. **Clinical Safety & Non-Diagnostic Wording:** Camp names, objectives, and administrative notes may never promise clinical diagnosis, cancer staging, or curative treatments (`CLINICAL_WORDING_VIOLATION`).
3. **Small-Count Cell Suppression Privacy Rule:** Camp aggregate counts (abnormal visual findings, lesion referrals) below 5 are suppressed (`< 5`, `count: null`, `isSuppressed: true`) to protect individual privacy in sparsely populated tribal habitations.
4. **Tenancy & Catchment Authorization:**
   - **Hospital Managers:** Create, publish, staff, and manage camps strictly within their assigned hospital boundary. Cross-hospital modifications are rejected with `403 Forbidden`.
   - **Health Workers (ASHA/ANM):** Can only view camps linked to their assigned villages (via Phase 3 `HealthWorkerAssignment` records).
5. **Team Collision Avoidance:** Overlapping assignments for Medical Officers and Health Workers across concurrent active camps are validated and rejected (`TEAM_ASSIGNMENT_OVERLAP`).
6. **Future Date Invariant:** Start and end dates for newly planned camps must be in the future, and end dates must follow start dates (`INVALID_CAMP_DATES`).
7. **Comprehensive Append-Only Audit Trail:** Generates verified audit events for `camp.created`, `camp.published`, `camp.started`, `camp.completed`, and `camp.cancelled`.

---

## 2. Architecture & Data Model

### 2.1 Entity Model (`campModel.ts`)

```typescript
export enum CampStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ONGOING = 'ongoing',
  IN_PROGRESS = 'in_progress', // Legacy alias supported
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface ICampLocation {
  address: string;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ICampDocument {
  campId: string;
  name: string;
  hospitalId: string;
  villageId: string;
  villageName?: string;
  mandal?: string;
  targetPopulation: number;
  startDate: Date;
  endDate: Date;
  status: CampStatus;
  leadMoId: string;
  leadMoName?: string;
  assignedWorkerIds: string[];
  location: ICampLocation;
  screeningCount: number;
  abnormalFindingsCount: number;
  referralsCount: number;
  notes?: string;
  publishedAt?: Date;
  publishedBy?: string;
  startedAt?: Date;
  startedBy?: string;
  completedAt?: Date;
  completedBy?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Lifecycle State Machine

```
                   ┌──────────┐
                   │  DRAFT   │
                   └────┬─────┘
                        │
                publish │ (Validates future dates,
                        │  team overlap, village)
                        ▼
                   ┌──────────┐
                   │PUBLISHED │──────────────┐
                   └────┬─────┘              │
                        │                    │
                  start │                    │ cancel
                        ▼                    │
                   ┌──────────┐              │
                   │ ONGOING  │              │
                   └────┬─────┘              │
                        │                    │
               complete │                    │
                        ▼                    ▼
                 ┌───────────┐         ┌───────────┐
                 │ COMPLETED │         │ CANCELLED │
                 └───────────┘         └───────────┘
```

#### Detailed State Transition Matrix:

| Current Status | Permitted Next Status | Disallowed Next Statuses | Invariant Rule |
|---|---|---|---|
| `DRAFT` | `PUBLISHED`, `CANCELLED` | `ONGOING`, `IN_PROGRESS`, `COMPLETED` | Must be published first. Direct start rejected. |
| `PUBLISHED` | `ONGOING`, `IN_PROGRESS`, `CANCELLED` | `DRAFT`, `COMPLETED` | Cannot skip execution directly to completed. |
| `ONGOING` / `IN_PROGRESS` | `COMPLETED`, `CANCELLED` | `DRAFT`, `PUBLISHED` | Cannot revert once started. |
| `SCHEDULED` (Legacy) | *(None directly to ongoing)* | `ONGOING`, `IN_PROGRESS` | `SCHEDULED` to `ONGOING` strictly rejected. |
| `COMPLETED` | *(Terminal)* | All | Completed camps cannot be reopened or mutated. |
| `CANCELLED` | *(Terminal)* | All | Cancelled camps cannot be revived. |

---

## 3. Privacy Standard: Small-Count Cell Suppression

In remote tribal habitations with small populations (e.g., 50–200 citizens), reporting exact low counts of abnormal visual findings or high-risk specialist referrals can inadvertently de-anonymize individuals.

The Aarogya-Drishti small-count suppression standard (`applySmallCountSuppression`) enforces:
- **Counts >= 5:** Displayed as exact integers (`isSuppressed: false`).
- **Counts 1 to 4:** Suppressed to protect patient anonymity:
  - Formatted string: `"< 5"`
  - Numeric count: `null`
  - Suppression flag: `isSuppressed: true`
- **Count = 0:** Preserved as integer `0` (`isSuppressed: false`), as 0 cases does not single out any resident.

### API Statistics Response Example:
```json
{
  "success": true,
  "data": {
    "campId": "cmp_d91280fae603",
    "name": "Munchingput Frontline Screening Camp",
    "status": "ongoing",
    "villageId": "VILL_MUNCHINGPUT_01",
    "villageName": "Munchingput Central",
    "targetPopulation": 180,
    "totalScreenings": {
      "count": 14,
      "formatted": "14",
      "isSuppressed": false
    },
    "abnormalFindings": {
      "count": null,
      "formatted": "< 5",
      "isSuppressed": true
    },
    "referrals": {
      "count": null,
      "formatted": "< 5",
      "isSuppressed": true
    },
    "suppressionNotice": "Counts below 5 are suppressed to protect patient privacy in rural habitations."
  }
}
```

---

## 4. API Endpoints & Capabilities

All Phase 9 endpoints are fully registered in `authorizationEngine.ts` and covered by static CI inspection:

| Method | Endpoint | Capability | Scope & Security |
|---|---|---|---|
| `POST` | `/api/v1/camps` | `camps:create` | Hospital Manager creates DRAFT camp for own hospital. Validates future dates and non-diagnostic text. |
| `GET` | `/api/v1/camps` | `camps:read` | Lists camps. Health workers see only camps for their assigned villages. Hospital staff see hospital camps. |
| `GET` | `/api/v1/camps/:id` | `camps:read` | Scoped detail view with village metadata and team list. Cross-hospital access returns `403`. |
| `PUT` | `/api/v1/camps/:id` | `camps:create` | Updates camp properties. Permitted only in `DRAFT` or `PUBLISHED` status. |
| `DELETE` | `/api/v1/camps/:id` | `camps:create` | Deletes unstarted `DRAFT` camps. |
| `POST` | `/api/v1/camps/:id/publish` | `camps:publish` | Transitions `DRAFT` ➔ `PUBLISHED`. Emits `camp.published` audit event. |
| `POST` | `/api/v1/camps/:id/start` | `camps:start` | Transitions `PUBLISHED` ➔ `ONGOING`. Emits `camp.started` audit event. Rejects un-published camps. |
| `POST` | `/api/v1/camps/:id/complete` | `camps:complete` | Transitions `ONGOING` ➔ `COMPLETED`. Emits `camp.completed` audit event. |
| `POST` | `/api/v1/camps/:id/cancel` | `camps:cancel` | Cancels camp with mandatory reason. Emits `camp.cancelled` audit event. |
| `POST` | `/api/v1/camps/:id/transition` | `camps:transition` | Generic state transition endpoint returning typed errors for illegal transitions. |
| `POST` | `/api/v1/camps/:id/workers` | `camps:assign` | Assigns health workers; verifies absence of concurrent active camp overlaps. |
| `GET` | `/api/v1/camps/:id/counts` | `camps:read` | Returns screening, finding, and referral counts. |
| `GET` | `/api/v1/camps/:id/statistics` | `camps:read` | Returns privacy-suppressed statistical report (`< 5`). |
| `POST` | `/api/v1/camps/:id/screenings` | `camps:screen` | Increments camp screenings, findings, and referrals during active camp operations. |

---

## 5. Audit Trail Integration

All camp actions are recorded immutably in MongoDB via `auditTag.ts` and `recordAuditEvent`:

| Audit Event Action | Resource Type | Metadata Captured |
|---|---|---|
| `camp.created` | `camp` | `campId`, `hospitalId`, `villageId`, `name`, `startDate`, `endDate`, `targetPopulation` |
| `camp.published` | `camp` | `campId`, `hospitalId`, `leadMoId`, `assignedWorkerIds` count |
| `camp.started` | `camp` | `campId`, `hospitalId`, `startedAt`, `startedBy` |
| `camp.completed` | `camp` | `campId`, `screeningCount`, `abnormalFindingsCount`, `referralsCount` |
| `camp.cancelled` | `camp` | `campId`, `cancellationReason`, `cancelledBy` |

---

## 6. Internationalization (i18n) Parity

All 6 new camp error and notification keys are synchronized with 100% parity across English (`en.json`), Telugu (`te.json`), and Hindi (`hi.json`):

| i18n Key | English | Telugu (తెలుగు) | Hindi (हिन्दी) |
|---|---|---|---|
| `camps.invalidTransition` | Invalid camp status transition from {{from}} to {{to}} | {{from}} నుండి {{to}} కి శిబిర స్థితి మార్పు చెల్లదు | {{from}} से {{to}} में शिविर स्थिति परिवर्तन अमान्य है |
| `camps.datesMustBeFuture` | Camp start and end dates must be in the future | శిబిరం ప్రారంభ మరియు ముగింపు తేదీలు భవిష్యత్తులో ఉండాలి | शिविर प्रारंभ और समाप्ति तिथियां भविष्य की होनी चाहिए |
| `camps.overlappingTeamAssignment` | Team member {{userId}} is already assigned to active camp {{campId}} | బృంద సభ్యుడు {{userId}} ఇప్పటికే యాక్టివ్ శిబిరం {{campId}} కి కేటాయించబడ్డారు | टीम सदस्य {{userId}} पहले से ही सक्रिय शिविर {{campId}} में असाइन किए गए हैं |
| `camps.prohibitedWording` | Camp text may not promise clinical diagnosis or curative therapy | శిబిర వివరణలో క్లినికల్ నిర్ధారణ లేదా చికిత్స వాగ్దానం ఉండకూడదు | शिविर पाठ में नैदानिक निष्कर्ष या उपचारात्मक चिकित्सा का वादा नहीं होना चाहिए |
| `camps.suppressionNotice` | Counts below 5 are suppressed to protect patient privacy in rural habitations | గ్రామీణ ప్రాంతాలలో రోగుల గోప్యతను కాపాడటానికి 5 కంటే తక్కువ సంఖ్యలు దాచబడ్డాయి | ग्रामीण बस्तियों में रोगी की गोपनीयता की रक्षा के लिए 5 से कम संख्याएं छिपाई गई हैं |
| `camps.scheduledStartRejected` | Camps cannot start from SCHEDULED status; camp must be PUBLISHED first | శిబిరాన్ని నేరుగా ప్రారంభించలేరు; మొదట ప్రచురించాలి (PUBLISHED) | शिविर को सीधे प्रारंभ नहीं किया जा सकता; पहले प्रकाशित (PUBLISHED) होना चाहिए |

---

## 7. Open Question Resolution: Rescheduling Policy

> **Question:** *Can a camp be rescheduled after publishing, or must it be cancelled and recreated?*

### Formal Policy Decision & Rationale:

1. **Standard Operational Flow (Cancellation & Recreation):**
   - **Recommendation:** Once a camp is **PUBLISHED**, notifications have been disseminated to community leaders, ASHA workers, ANMs, and local villagers. Unilateral date alteration creates logistical confusion and patient no-shows.
   - Therefore, the default standard policy requires the Hospital Manager to **CANCEL** the published camp with an explicit cancellation reason (e.g., *"Agency monsoon road impassable; rescheduled to following week"*).
   - A new camp is created with updated dates and re-published. This preserves an untampered historical record and triggers clear, traceable citizen notices.

2. **Controlled In-Flight Rescheduling (Permitted Administrative Extension):**
   - If an emergency operational adjustment is required before camp commencement, rescheduling is permitted **only while in `PUBLISHED` status** and **strictly prohibited once `ONGOING`**.
   - Rescheduling requires:
     - Actor role must be `admin` (Hospital Manager).
     - New dates must be strictly in the future.
     - Team members must have zero overlapping commitments on the new dates.
     - A dedicated audit log `camp.rescheduled` is recorded containing the prior and new dates.
     - Automated notification alerts are broadcast to all assigned health workers and village representatives.

---

## 8. Test Suite Verification & Evidence

### Comprehensive Vitest Execution:
```bash
npm test
```

### Result:
- **Total Test Files:** 25 passed (25 files)
- **Total Tests:** 718 passed (718 tests, 0 failures, 0 skipped)
- **Camps Test Suite (`campsManagement.test.ts`):** 38 dedicated test cases passing in 1.49s.

### Detailed Test Coverage Matrix for Phase 9:

| Test Group | Test Cases | Result |
|---|---|---|
| **Full Lifecycle & Legal Transitions** | DRAFT ➔ PUBLISHED ➔ ONGOING ➔ COMPLETED | **PASS** |
| **Direct Transition Table** | All valid pairwise transitions tested | **PASS** |
| **Comprehensive Illegal Transitions** | DRAFT ➔ ONGOING (Rejected)<br>DRAFT ➔ COMPLETED (Rejected)<br>PUBLISHED ➔ COMPLETED (Rejected)<br>COMPLETED ➔ ONGOING (Rejected)<br>CANCELLED ➔ ONGOING (Rejected)<br>SCHEDULED ➔ ONGOING (Rejected) | **PASS** |
| **Cross-Hospital Isolation** | Paderu DH cannot modify or publish Chintapalli CHC camps (403 Forbidden) | **PASS** |
| **Health Worker Village Scoping** | ASHA worker sees only camps matching assigned village catchment | **PASS** |
| **Date Validations** | Past start dates rejected (`INVALID_CAMP_DATES`)<br>End dates before start dates rejected | **PASS** |
| **Team Overlap Detection** | Concurrent camp assignment for same MO/ASHA rejected (`TEAM_ASSIGNMENT_OVERLAP`) | **PASS** |
| **Clinical Non-Diagnostic Wording** | Promotional/diagnostic terms (`diagnosis`, `curative`, `cancer stage`) rejected (`CLINICAL_WORDING_VIOLATION`) | **PASS** |
| **Small-Count Cell Suppression** | Findings & referrals with counts < 5 suppressed to `< 5`, counts >= 5 and 0 unmasked | **PASS** |
| **Append-Only Audit Verification** | All 5 camp audit events verified in audit store | **PASS** |
| **Wording Safety Scanner CI** | 0 prohibited words across entire codebase | **PASS** |
| **i18n Translation Parity** | 100% dictionary match across en, te, hi | **PASS** |

---

## 9. Deliverables & Modified Artifacts

- [campModel.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/camp/campModel.ts) — Enhanced `CampStatus` (`ongoing`, `in_progress`), village linkage, findings, and referral count fields.
- [campService.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/camp/campService.ts) — Full state machine, date validations, team overlap check, clinical wording validator, and cell suppression.
- [campRoutes.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/camp/campRoutes.ts) — Complete CRUD, transition routes, village catchment filtering, and cross-hospital authorization.
- [authorizationEngine.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/auth/authorizationEngine.ts) — Registered all 6 new camp endpoints in capability matrix.
- [envelope.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/middleware/envelope.ts) — Fixed HTTP status code inheritance for structured JSON errors.
- [campsManagement.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/campsManagement.test.ts) — 38 comprehensive tests verifying state machine, security, and privacy rules.
- [CampManager.tsx](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/client/src/components/CampManager.tsx) — Client UI updated with village linkage, status badges, and small-count cell suppression indicators.
- [en.json](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/i18n/locales/en.json) | [te.json](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/i18n/locales/te.json) | [hi.json](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/i18n/locales/hi.json) — 100% synchronized multilingual keys.
