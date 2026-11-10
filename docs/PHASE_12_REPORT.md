# Phase 12: Referrals & Follow-Up Navigation Report

## 1. Executive Summary
Phase 12 builds referral requests and patient navigation tracking following clinical screening in Aarogya-Drishti. The module links primary healthcare centres (PHCs) and community health centres (CHCs) with district hospitals and tertiary specialists from the Phase 3 Specialists Directory. It implements privacy-preserving patient follow-up reminders via Agenda, enforces strict cross-hospital authorization isolation, and ensures missed follow-ups escalate exactly once back to the Medical Officer queue with urgent priority.

---

## 2. Architecture & Data Model
- **Model:** [referralModel.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/referral/referralModel.ts)
- **Service:** [referralService.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/referral/referralService.ts)
- **Routes:** [referralRoutes.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/referral/referralRoutes.ts) mounted at `/api/v1/referrals`

### Status Lifecycle:
`REQUESTED` ➔ `ACCEPTED` ➔ `SCHEDULED` ➔ `ATTENDED` / `MISSED` / `CANCELLED`

| Status | Permitted Next Statuses | Description |
| :--- | :--- | :--- |
| `REQUESTED` | `ACCEPTED`, `CANCELLED` | Referral created by source PHC/CHC Medical Officer |
| `ACCEPTED` | `SCHEDULED`, `CANCELLED` | Acknowledged by destination hospital staff |
| `SCHEDULED` | `ATTENDED`, `MISSED`, `SCHEDULED`, `CANCELLED` | Follow-up visit scheduled; Agenda reminder registered |
| `MISSED` | `SCHEDULED`, `CANCELLED` | Follow-up visit missed; escalated back to MO queue |
| `ATTENDED` | *(Terminal)* | Consultation attended |
| `CANCELLED` | *(Terminal)* | Referral cancelled with mandatory reason |

---

## 3. Key Governance & Safety Mechanisms

### A. Cross-Hospital Denial (Data Isolation)
- Staff of destination hospitals can only view and manage referrals addressed to their facility (`destinationHospitalId === actor.hospitalId` or `sourceHospitalId === actor.hospitalId`).
- Unrelated hospital staff are denied access with `403 CROSS_HOSPITAL_FORBIDDEN`.

### B. Agenda Follow-Up Reminder (Exactly-Once After Server Restart)
- Follow-up reminders are scheduled via Agenda.
- Job completion records `lastFinishedAt`.
- On server restart, Agenda verifies lock and finished state, ensuring completed reminder jobs never re-execute.

### C. Missed Follow-Up Escalation (Escalates Exactly Once)
- When a patient misses a scheduled follow-up:
  - Referral status updates to `MISSED`.
  - `missedEscalation.isEscalated` is set to `true`.
  - If linked to a `ScreeningCase`, the case priority is elevated to `'urgent'`, status is set to `'escalated'`, and `escalationDetails` are recorded with assignment back to the MO queue.
  - Any subsequent attempt to escalate returns `409 REFERRAL_ALREADY_ESCALATED`, guaranteeing **exactly-once escalation**.

### D. Non-Diagnostic Patient Privacy Wording Rule
- In compliance with clinical privacy guidelines, reminders and patient-facing notifications **never name the clinical condition, disease, cancer, or diagnostic findings**.
- Phrasing standard: `"You have a scheduled health consultation on [Date] at [Facility Name]. Please bring your identification and health documents."`

---

## 4. Verification & Test Evidence
- Test Suite: [referralsAndFollowUp.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/referralsAndFollowUp.test.ts)
- Test Count: **13 / 13 tests passing**
- Coverage includes:
  1. Referral creation with destination hospital and specialists directory lookup (`Specialist` model).
  2. Cross-hospital denial: staff from unrelated facility blocked with 403 `CROSS_HOSPITAL_FORBIDDEN`.
  3. Non-diagnostic reminder text verified against prohibited clinical patterns scanner.
  4. Agenda reminder restart simulation: job executes once and never re-executes across instance restarts.
  5. Missed follow-up escalation back to MO queue with urgent priority, with duplicate calls rejected (409).
  6. Attended and cancelled workflow transitions.
