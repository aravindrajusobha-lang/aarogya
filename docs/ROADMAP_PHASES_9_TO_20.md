# Aarogya-Drishti — Master Roadmap: Phases 9 to 20

**Platform Version:** 0.2.0  
**Status:** Verified Foundations (Phases 1–8 Passed: 596 Tests)  
**Target Environment:** ITDA Paderu Tribal Agency (Simulated Hackathon Environment)  
**Clinical Safety:** Strict Non-Diagnostic Vocabulary Guardrail Active  
**Note:** AI Report Extraction (P4) remains **DEFERRED**.

---

## High-Level Execution Matrix (Phases 9 – 20)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASES 9 TO 20 PHASING PLAN                     │
├─────────┬───────────────────────────────┬──────────────────────────────┤
│ Phase   │ Module                        │ Key Invariant / Constraint   │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│ P9      │ Camps Management              │ Must be PUBLISHED to start   │
│ P10     │ Appointments Scheduling       │ Confirmed by Mgr or Dest MO  │
│ P11     │ Biopsy Workflow               │ RECOLLECTION_REQ + CANCELLED │
│ P12     │ Referrals & Follow-Up         │ Tiered escalation tracking   │
│ P13     │ Teleconsultation              │ BLOCKED video adapter stub   │
│ P14     │ Village Data Map              │ Exactly 13 API endpoints     │
│ P15     │ Reports & Dashboards          │ Small-count suppression (<5) │
│ P16     │ Aadhaar Mock Service          │ 4 endpoints, MOCK labelled   │
│ P17     │ Offline & PWA Hardening       │ WebCrypto + Dexie sync test  │
│ P18     │ Security & Performance Review │ Zero leak / timing-safe audit│
│ P19     │ Integration & E2E Demo Script │ End-to-end Paderu narrative  │
│ P20     │ Deployment & Final Docs       │ Production/demo bundle & ops │
└─────────┴───────────────────────────────┴──────────────────────────────┘
```

---

## Detailed Phase Breakdown

### Phase 9: Screening Camps Management
- **Objective:** Enable Hospital Admins and Medical Officers to plan, staff, publish, and execute community oral health screening camps across tribal villages.
- **Core Invariant:**
  - A camp record **MUST be in `PUBLISHED` status before it can transition to `IN_PROGRESS` / `STARTED`**.
  - Attempting to start a camp in `DRAFT` or `CANCELLED` status is strictly rejected with a `400 Bad Request` state-machine violation.
- **Lifecycle States:** `DRAFT` ➔ `PUBLISHED` ➔ `IN_PROGRESS` ➔ `COMPLETED` (or `CANCELLED`).
- **Core Capabilities:** `camps:create`, `camps:publish`, `camps:start`, `camps:complete`, `camps:read`.
- **Validation Tests:**
  - Reject starting an un-published camp.
  - Cross-hospital camp tampering denied.
  - ASHA assignment validation within camp village catchment.

---

### Phase 10: Patient Appointments Scheduling
- **Objective:** Schedule clinic visits, clinical reviews, and hospital consultations.
- **Core Invariant:**
  - Appointment confirmations are permitted **ONLY by the Hospital Manager (`admin`) or the designated destination Medical Officer (`medical_officer`)**.
  - Frontline workers or unassigned personnel attempting to confirm return `403 Forbidden`.
- **Lifecycle States:** `REQUESTED` ➔ `CONFIRMED` ➔ `CHECKED_IN` ➔ `COMPLETED` / `NO_SHOW` / `CANCELLED`.
- **Validation Tests:**
  - Self-confirmation or unauthorized role confirmation blocked.
  - Target hospital mismatch blocked across facilities.

---

### Phase 11: Biopsy & Specimen Workflow
- **Objective:** Track oral mucosal tissue biopsies from initial order to laboratory histopathology processing and report issuance.
- **Core Invariant:**
  - Add explicit `RECOLLECTION_REQUIRED` and `CANCELLED` states with an **unambiguous, strictly enforced state transition table**.
  - Clinical wording scanner remains active: no diagnostic claims in finding descriptions.
- **Explicit Transition Table:**
  | Current State | Allowed Next States | Trigger Action | Authorized Roles |
  |---|---|---|---|
  | `ORDERED` | `SCHEDULED`, `CANCELLED` | Schedule procedure or cancel | MO, Admin |
  | `SCHEDULED` | `COLLECTED`, `CANCELLED` | Specimen harvested | MO, Specialist |
  | `COLLECTED` | `IN_TRANSIT`, `RECOLLECTION_REQUIRED` | Handed to courier / specimen compromised | MO, Nurse, Tech |
  | `IN_TRANSIT` | `RECEIVED_AT_LAB`, `RECOLLECTION_REQUIRED` | Lab receipt / transit damage | Lab Tech, Courier |
  | `RECEIVED_AT_LAB` | `PROCESSING`, `RECOLLECTION_REQUIRED` | Inadequate sample / start histology | Lab Tech, Pathologist |
  | `PROCESSING` | `EVALUATED`, `RECOLLECTION_REQUIRED` | Staining complete / processing artifact | Pathologist |
  | `RECOLLECTION_REQUIRED` | `COLLECTED`, `CANCELLED` | Re-biopsy collected or patient decline | MO, Specialist |
  | `EVALUATED` | `REPORTED` | Sign-off findings record | Pathologist, Specialist |
  | `REPORTED` | *(Terminal)* | Released via separate release entity | — |
  | `CANCELLED` | *(Terminal)* | Case closed | — |
- **Validation Tests:**
  - Illegal state jumps (e.g., `ORDERED` ➔ `REPORTED` directly) rejected.
  - Specimen invalidation triggers `RECOLLECTION_REQUIRED`.
  - Wording scanner ensures 0 diagnostic terminology violations.

---

### Phase 12: Referrals & Navigation Tracking
- **Objective:** Structured referral pipeline between Primary Health Centres (PHC), Community Health Centres (CHC), District Hospital Paderu, and King George Hospital (KGH) Visakhapatnam.
- **Core Invariant:** Patient navigation milestones with breach alerts if high-priority cases do not report within the stipulated follow-up window.

---

### Phase 13: Teleconsultation Core
- **Objective:** Remote clinician-to-specialist teleconsultation scheduling and clinical note coordination.
- **Core Invariant:**
  - **BLOCKED Video Adapter:** The platform operates in simulation mode. The video connection adapter must explicitly return an explanatory `501 Not Implemented` or simulated `BLOCKED_ADAPTER` status envelope declaring that real WebRTC/SIP delivery is stubbed.
- **Validation Tests:** Verifies client receives clear simulation notices; no live media credentials claimed.

---

### Phase 14: Village Data Map (13 Endpoints)
- **Objective:** Comprehensive spatial and administrative data matrix for ITDA Paderu.
- **Specification:** Exactly **13 endpoints** serving village reference, health worker jurisdiction, risk distributions, and infrastructure status:
  1. `GET /api/v1/map/villages` (list with coordinates)
  2. `GET /api/v1/map/villages/:id` (detail & demographics)
  3. `GET /api/v1/map/villages/:id/workers` (assigned ASHAs/ANMs)
  4. `GET /api/v1/map/villages/:id/facilities` (nearest PHC/CHC)
  5. `GET /api/v1/map/villages/:id/screenings-summary` (small-count suppressed)
  6. `GET /api/v1/map/villages/:id/risk-metrics` (anonymized risk density)
  7. `GET /api/v1/map/villages/:id/camps` (active & historical camps)
  8. `GET /api/v1/map/clusters` (habitation clusters)
  9. `GET /api/v1/map/boundaries/mandals` (Mandal boundary polygons)
  10. `GET /api/v1/map/corridors/transport` (tribal transit routes to DH)
  11. `GET /api/v1/map/connectivity-zones` (offline-prone shadow zones)
  12. `GET /api/v1/map/heatmap/screening-coverage` (population coverage %)
  13. `GET /api/v1/map/geo-export` (GeoJSON export for local GIS)
- **Invariant:** Small-count suppression (<5) strictly enforced across all 13 aggregation endpoints.

---

### Phase 15: Reports & Administrative Dashboards
- **Objective:** Program-level reporting for ITDA Project Officer and District Medical & Health Officer (DMHO).
- **Core Invariant:** Small-count suppression (<5 cells blanked/masked) to safeguard tribal patient privacy.

---

### Phase 16: Aadhaar Verification Mock Service
- **Objective:** Simulated UIDAI demographic and OTP authentication adapter.
- **Specification:** Exactly **4 endpoints**, all explicitly branded with `MOCK` responses:
  1. `POST /api/v1/mock/aadhaar/generate-otp`
  2. `POST /api/v1/mock/aadhaar/verify-otp`
  3. `POST /api/v1/mock/aadhaar/demographic-auth`
  4. `GET /api/v1/mock/aadhaar/status`
- **Invariant:** 100% simulated, non-custodial; no real UIDAI traffic or demographic retention.

---

### Phase 17: Offline & PWA Hardening
- **Objective:** Field durability under zero-connectivity conditions in Paderu agency areas.
- **Scope:** Service worker precaching, Dexie WebCrypto AES-GCM local storage, idempotent background replay, and conflict reconciliation.

---

### Phase 18: Security & Performance Audit
- **Objective:** Rigorous automated penetration testing, timing attack defense, rate limiting, and MongoDB replica set index benchmarking.

---

### Phase 19: Integration & End-to-End Demo Script
- **Objective:** Unified multi-role demonstration script showcasing:
  ASHA Screening ➔ DEMO AI ➔ MO Queue ➔ Camp ➔ Biopsy ➔ Specialist Referral ➔ Safe Release.

---

### Phase 20: Deployment Dossier & Documentation
- **Objective:** Final release packaging, containerization, OpenAPI/Swagger contracts, architecture manuals, and submission collateral.
