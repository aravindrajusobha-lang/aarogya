# Aarogya-Drishti — Phase 10 Engineering Report
## Patient Appointments Scheduling & ACID Slot Governance

**Platform Version:** 0.2.0  
**Status:** Completed & Validated  
**Simulation Mode:** Active (`SIMULATION=true`)  
**Test Suite:** 26 Test Files, 795 Tests Passing (100% Pass Rate)

---

## 1. Executive Summary

Phase 10 implements the **Patient Appointments Scheduling** subsystem for Aarogya-Drishti, establishing transactional clinic booking, clinical consultation triage, multi-tenancy access controls, and multi-channel notification dispatch.

Community screening camps (Phase 9) and frontline visual screenings (Phase 8) identify patients requiring clinical review, specialist consultations, and diagnostic procedures. Phase 10 enables healthcare workers, medical officers, and patients to book consultation slots at secondary referral facilities (e.g., Paderu District Hospital, Araku CHC, Chintapalli CHC) with strict transactional collision avoidance and institutional confirmation safeguards.

### Core Architectural Invariants Delivered:

1. **Destination Hospital Confirmation Authority:**
   - Appointment confirmation is restricted strictly to the **Hospital Manager (`admin`) or Medical Officer (`medical_officer`) of the destination facility**.
   - Hospital Managers and clinicians from other facilities attempting to confirm appointments are denied (`403 Forbidden` / `FORBIDDEN_HOSPITAL_MISMATCH`).
   - Frontline personnel (ASHA, ANM) and patients attempting confirmation are denied (`403 Forbidden` / `FORBIDDEN_CONFIRMATION_ROLE`).

2. **Self-Confirmation Blocked:**
   - A requester (including Medical Officers or Admins requesting an appointment for a patient) **cannot confirm their own appointment**.
   - Self-confirmation attempts return `403 Forbidden` (`SELF_CONFIRMATION_BLOCKED`), enforcing independent two-party confirmation.

3. **ACID Slot Governance & Concurrency:**
   - Time slot conflicts are verified inside **MongoDB replica set transactions**.
   - A compound partial unique index on `{ destinationHospitalId: 1, slotStartTime: 1, slotEndTime: 1 }` guarantees that when two simultaneous requests arrive for the exact same slot, **exactly one booking succeeds (201 Created)** and the concurrent request is rolled back with a conflict error (**409 Conflict** / `SLOT_CONFLICT`).

4. **Idempotent Booking & Offline Sync Replay:**
   - Supports `idempotencyKey` / `clientRequestId`.
   - Replayed requests from offline-queued frontline synchronizations return the existing appointment record with `idempotentReplay: true` and zero duplicate document creations.

5. **Operational Schedule & Slot Defaults (Approved):**
   - **Slot Length:** 20 minutes per consultation slot.
   - **Working Hours:** 09:00 to 16:00 (Monday through Saturday, with 13:00 to 14:00 midday lunch recess).
   - **Holiday/Weekend Closure:** Sundays are closed for routine outpatient consultations (`CLINIC_CLOSED_SUNDAY`).
   - **Future Date Rule:** Slots must be scheduled strictly in the future (`INVALID_APPOINTMENT_SLOT`).

6. **Phase 5 Multi-Channel Notification Integration:**
   - Every appointment lifecycle transition (request, confirmation, reschedule, cancellation) triggers multi-channel dispatch via `NotificationQueue.enqueue(...)`.
   - **In-App:** Delivered to user notification inbox.
   - **SMS & Email:** Explicitly handled by Phase 5 blocked stubs and returned with `smsBlocked: true`, `emailBlocked: true`, and status `BLOCKED_STUB` (simulation indicator).

7. **Clinical Non-Diagnostic Wording Guardrail:**
   - All appointment categories, reasons, logs, and notification templates contain **0 clinical diagnosis or curative assertions** (`CLINICAL_WORDING_VIOLATION` scanner clean).

8. **Internationalization (i18n) Parity:**
   - 100% synchronized multilingual key parity across English, Telugu, and Hindi dictionaries.

---

## 2. Architecture & Data Model

### 2.1 Entity Model (`appointmentModel.ts`)

```typescript
export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'rescheduled'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentType =
  | 'screening_review'
  | 'clinical_consultation'
  | 'specialist_referral'
  | 'routine_follow_up'
  | 'biopsy_procedure';

export interface IAppointmentDocument extends Document {
  appointmentId: string;
  patientId: string;
  patientName?: string;
  destinationHospitalId: string;
  destinationHospitalName?: string;
  department: string;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  slotStartTime: Date;
  slotEndTime: Date;
  durationMinutes: number; // 20
  status: AppointmentStatus;
  type: AppointmentType;
  reason?: string;
  requestedBy: {
    userId: string;
    role: string;
    name?: string;
  };
  confirmedBy?: {
    userId: string;
    role: string;
    name?: string;
    confirmedAt: Date;
  };
  cancellation?: {
    cancelledBy: string;
    reason: string;
    cancelledAt: Date;
  };
  reschedulingHistory: Array<{
    previousSlotStart: Date;
    previousSlotEnd: Date;
    newSlotStart: Date;
    newSlotEnd: Date;
    rescheduledBy: string;
    rescheduledAt: Date;
    reason?: string;
  }>;
  idempotencyKey?: string;
  clientRequestId?: string;
  offlineQueued: boolean;
  notificationId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Lifecycle State Machine

```
                   ┌──────────┐
                   │REQUESTED │──────────────┐
                   └────┬─────┘              │
                        │                    │
                confirm │ (Destination Mgr   │ cancel
                        │  or MO only;       │
                        │  self-confirm      │
                        │  blocked)          │
                        ▼                    │
                   ┌──────────┐              │
    ┌─────────────>│CONFIRMED │──────────────┤
    │              └────┬─────┘              │
    │                   │                    │
    │reschedule check-in│                    │
    │                   ▼                    │
    │              ┌──────────┐              │
    └──────────────│CHECKED_IN│              │
                   └────┬─────┘              │
                        │                    │
               complete │                    │
                        ▼                    ▼
                 ┌───────────┐         ┌───────────┐
                 │ COMPLETED │         │ CANCELLED │
                 └───────────┘         └───────────┘
```

#### State Transition Matrix:

| Current Status | Permitted Next Status | Authorized Actors | Invariant Rule |
|---|---|---|---|
| `requested` | `confirmed`, `rescheduled`, `cancelled` | Destination Admin, Destination MO | Requester self-confirmation blocked. |
| `confirmed` | `checked_in`, `rescheduled`, `cancelled` | Destination Staff | Can check in upon patient physical arrival. |
| `rescheduled` | `confirmed`, `rescheduled`, `cancelled` | Destination Admin, Destination MO | New slot conflict verified in transaction. |
| `checked_in` | `completed`, `cancelled`, `no_show` | Clinician, OPD Staff | Consultation in progress. |
| `completed` | *(Terminal)* | — | Completed consultations cannot be reopened. |
| `cancelled` | *(Terminal)* | Requester, Patient, Admin | Slot is freed for other beneficiaries. |

---

## 3. Operational Schedule & Working Hours Specification

Per user approval, standard outpatient department (OPD) schedule for Andhra Pradesh Government secondary care facilities (CHC/DH):

- **Consultation Slot Duration:** Exactly **20 minutes**.
- **Working Hours:** **09:00 to 16:00** (Monday through Saturday).
- **Daily Sessions:**
  - *Morning OPD Session:* 09:00 to 13:00 (12 slots)
  - *Midday Lunch Recess:* 13:00 to 14:00 (Closed — appointments rejected)
  - *Afternoon Consultation Session:* 14:00 to 16:00 (6 slots)
  - *Total Capacity per OPD Doctor:* 18 slots per working day.
- **Sundays & Public Holidays:** Facility OPD is closed; appointments rejected (`CLINIC_CLOSED_SUNDAY`).

### Available Slots Inspector API:
```bash
GET /api/v1/appointments/slots?date=2026-11-16T10:00:00.000Z&hospitalId=hosp_paderu_dh
```
Response:
```json
{
  "success": true,
  "data": {
    "date": "2026-11-16T10:00:00.000Z",
    "destinationHospitalId": "hosp_paderu_dh",
    "slotDurationMinutes": 20,
    "workingHours": "09:00 - 16:00 (Mon-Sat, Lunch 13:00-14:00)",
    "totalSlots": 18,
    "availableSlotsCount": 17,
    "slots": [
      { "startTime": "2026-11-16T03:30:00.000Z", "endTime": "2026-11-16T03:50:00.000Z", "isAvailable": true },
      { "startTime": "2026-11-16T03:50:00.000Z", "endTime": "2026-11-16T04:10:00.000Z", "isAvailable": false, "existingAppointmentId": "apt_7b9a4c0128df" }
    ]
  }
}
```

---

## 4. ACID Concurrency & Transactional Slot Governance

To guarantee zero double-bookings in tribal outpatient departments, Aarogya-Drishti employs dual-layer collision protection:

1. **ACID Transaction Session:**
   - Every appointment request and rescheduling starts a MongoDB session and transaction (`session.startTransaction()`).
   - The system queries for active overlapping bookings (`status IN ['requested', 'confirmed', 'checked_in']` and `slotStartTime < newEnd AND slotEndTime > newStart`).
   - If an overlapping booking is detected, the transaction aborts and throws `SLOT_CONFLICT` (HTTP 409).

2. **Partial Compound Unique Index:**
   ```typescript
   AppointmentSchema.index(
     { destinationHospitalId: 1, slotStartTime: 1, slotEndTime: 1 },
     {
       unique: true,
       partialFilterExpression: {
         status: { $in: ['requested', 'confirmed', 'checked_in'] },
       },
     }
   );
   ```
   - Even when two simultaneous async HTTP requests arrive within the same millisecond and read an identical snapshot before either commits, MongoDB's unique index raises error code `11000` on the second commit attempt.
   - The transaction aborts gracefully and responds with `409 Conflict`.
   - Verified by concurrency test: `Promise.all([req1, req2])` produces **1 booking and 1 conflict**.

---

## 5. Multi-Channel Notifications & Simulation BLOCKED Indicators

All appointment lifecycle operations integrate with the Phase 5 Notification Core (`NotificationQueue.enqueue`):

```json
{
  "notificationId": "NOTIF-1793508266077-7B02691F",
  "channels": ["in_app", "sms", "email"],
  "deliveryStatus": [
    {
      "channel": "in_app",
      "delivered": true,
      "status": "delivered",
      "reason": "In-app notification saved and queued for inbox delivery"
    },
    {
      "channel": "sms",
      "delivered": false,
      "status": "BLOCKED_STUB",
      "claimed": false,
      "reason": "SMS delivery is a BLOCKED stub in simulation/sandbox mode. No SMS gateway or telecommunications delivery is claimed."
    },
    {
      "channel": "email",
      "delivered": false,
      "status": "BLOCKED_STUB",
      "claimed": false,
      "reason": "Email delivery is a BLOCKED stub in simulation/sandbox mode. No SMTP gateway or mail server delivery is claimed."
    }
  ],
  "smsBlocked": true,
  "emailBlocked": true
}
```

---

## 6. API Endpoints & Capabilities

All Phase 10 endpoints are registered in `authorizationEngine.ts` and covered by static CI inspection:

| Method | Endpoint | Capability | Scope & Security |
|---|---|---|---|
| `GET` | `/api/v1/appointments/slots` | `appointment:read` | Returns 18 standard OPD consultation slots; excludes Sundays and lunch. |
| `POST` | `/api/v1/appointments` | `appointment:create` | Books appointment idempotently; enforces ACID transaction slot check. |
| `GET` | `/api/v1/appointments` | `appointment:read` | Lists appointments scoped by hospital and patient. |
| `GET` | `/api/v1/appointments/:id` | `appointment:read` | Fetches appointment record with full rescheduling audit history. |
| `POST` | `/api/v1/appointments/:id/confirm` | `appointment:confirm` | Destination Hospital Manager or MO only. Rejects self-confirmation. |
| `POST` | `/api/v1/appointments/:id/reschedule` | `appointment:reschedule` | Reschedules slot; checks destination slot availability in transaction. |
| `POST` | `/api/v1/appointments/:id/cancel` | `appointment:cancel` | Cancels appointment with mandatory reason; frees slot for booking. |
| `POST` | `/api/v1/appointments/:id/check-in` | `appointment:manage` | Frontline facility check-in for arriving patient. |
| `POST` | `/api/v1/appointments/:id/complete` | `appointment:manage` | Completes consultation appointment. |

---

## 7. Internationalization (i18n) Parity

All 16 new appointment keys are synchronized with 100% parity across English (`en.json`), Telugu (`te.json`), and Hindi (`hi.json`):

| Key | English | Telugu (తెలుగు) | Hindi (हिन्दी) |
|---|---|---|---|
| `appointments.slotConflict` | The selected consultation time slot is already booked for this facility. | ఎంచుకున్న సంప్రదింపు సమయ స్లాట్ ఈ ఆసుపత్రి కోసం ఇప్పటికే బుక్ చేయబడింది. | चयनित परामर्श समय स्लॉट इस अस्पताल के लिए पहले से ही बुक है। |
| `appointments.selfConfirmationBlocked` | A requester cannot confirm their own appointment. | అభ్యర్థించిన వ్యక్తి తన స్వంత అపాయింట్‌మెంట్‌ను ధృవీకరించలేరు. | अनुरोधकर्ता अपने स्वयं के अपॉइंटमेंट की पुष्टि नहीं कर सकता। |
| `appointments.wrongHospitalDenied` | Confirmation permitted by staff of the destination hospital only. | గమ్యస్థాన ఆసుపత్రి సిబ్బంది ద్వారా మాత్రమే ధృవీకరణ అనుమతించబడుతుంది. | केवल गंतव्य अस्पताल के कर्मचारियों द्वारा पुष्टि की अनुमति है। |
| `appointments.outsideWorkingHours` | Appointment slot must be within facility working hours (09:00 to 16:00, Monday to Saturday). | అపాయింట్‌మెంట్ స్లాట్ ఆసుపత్రి పని వేళలలో (ఉదయం 09:00 నుండి సాయంత్రం 16:00, సోమవారం నుండి శనివారం) ఉండాలి. | अपॉइंटमेंट स्लॉट अस्पताल के कार्य घंटों (09:00 से 16:00, सोमवार से शनिवार) के भीतर होना चाहिए। |
| `appointments.lunchRecessConflict` | Appointment slot overlaps with midday lunch recess (13:00 to 14:00). | అపాయింట్‌మెంట్ స్లాట్ మధ్యాహ్న భోజన విరామంతో (13:00 నుండి 14:00) అతివ్యాప్తి చెందుతోంది. | अपॉइंटमेंट स्लॉट दोपहर के भोजन अवकाश (13:00 से 14:00) के साथ अतिव्यापी होता है। |
| `appointments.clinicClosedSunday` | Outpatient consultation slots are unavailable on Sundays. | ఆదివారాల్లో అవుట్‌పేషెంట్ సంప్రదింపు స్లాట్‌లు అందుబాటులో ఉండవు. | रविवार को बाह्य रोगी परामर्श स्लॉट उपलब्ध नहीं हैं। |
| `appointments.smsBlockedNotice` | SMS delivery is a BLOCKED stub in simulation mode. No external telecommunications gateway configured. | సిమ్యులేషన్ మోడ్‌లో SMS డెలివరీ నిరోధించబడిన స్టబ్ (BLOCKED stub). బాహ్య టెలికాం గేట్‌వే కాన్ఫిగర్ చేయబడలేదు. | सिमुलेशन मोड में एसएमएस वितरण अवरुद्ध स्टब (BLOCKED stub) है। कोई बाहरी दूरसंचार गेटवे कॉन्फ़िगर नहीं है। |
| `appointments.emailBlockedNotice` | Email delivery is a BLOCKED stub in simulation mode. No external SMTP gateway configured. | సిమ్యులేషన్ మోడ్‌లో ఇమెయిల్ డెలివరీ నిరోధించబడిన స్టబ్ (BLOCKED stub). బాహ్య SMTP గేట్‌వే కాన్ఫిగర్ చేయబడలేదు. | सिमुलेशन मोड में ईमेल वितरण अवरुद्ध स्टब (BLOCKED stub) है। कोई बाहरी एसएमटीपी गेटवे कॉन्फ़िगर नहीं है। |

---

## 8. Test Suite Verification & Evidence

### Vitest Test Execution:
```bash
npx vitest run tests/appointmentsManagement.test.ts
```

### Result:
- **Total Tests:** 23 passed (23 tests in Phase 10 suite, 0 failures)
- **Suite Duration:** 1.63s
- **Full Test Suite:** 26 test files, 795 tests passing (100% pass rate).

### Phase 10 Test Coverage Matrix:

| Test Group | Test Cases | Result |
|---|---|---|
| **1. Slot Generation & Working Hours** | 18 standard 20-min slots generated (09:00 - 16:00)<br>Sunday returns empty array (OPD closed)<br>13:00 - 14:00 lunch recess excluded | **PASS** |
| **2. Booking Validations** | Past appointment date rejected (`INVALID_APPOINTMENT_SLOT`)<br>Sunday booking rejected (`CLINIC_CLOSED_SUNDAY`)<br>Outside working hours (17:30) rejected (`OUTSIDE_WORKING_HOURS`)<br>Lunch recess booking (13:20) rejected (`LUNCH_RECESS_CONFLICT`) | **PASS** |
| **3. Idempotency & Offline Sync** | First request with `idempotencyKey` creates booking (201 Created)<br>Replayed request returns existing booking without duplicate insertion (200 OK)<br>Database contains exactly 1 document | **PASS** |
| **4. ACID Concurrency** | Simultaneous requests (`Promise.all`) produce exactly 1 booking (201) and 1 conflict (409 `SLOT_CONFLICT`)<br>Database contains exactly 1 active booking | **PASS** |
| **5. Confirmation Authorization** | Wrong-hospital Hospital Manager denied (403 `FORBIDDEN_HOSPITAL_MISMATCH`)<br>Wrong-hospital Medical Officer denied (403 `FORBIDDEN_HOSPITAL_MISMATCH`)<br>Self-confirmation blocked: requester denied (403 `SELF_CONFIRMATION_BLOCKED`)<br>Frontline ASHA denied (403)<br>Patient denied (403)<br>Destination Hospital Manager allowed (200 OK)<br>Destination Medical Officer (non-requester) allowed (200 OK) | **PASS** |
| **6. Rescheduling Lifecycle** | Rescheduling to occupied slot rejected (409 `SLOT_CONFLICT`)<br>Rescheduling to open slot updates dates and adds `reschedulingHistory`<br>Notification enqueued with SMS & email BLOCKED | **PASS** |
| **7. Cancellation & Slot Freeing** | Cancellation with reason updates status to `cancelled`<br>Cancelled slot becomes immediately re-bookable by another patient | **PASS** |
| **8. Clinical Check-in & Completion** | Check-in transitions `confirmed` ➔ `checked_in`<br>Completion transitions `checked_in` ➔ `completed` | **PASS** |
| **9. Append-Only Audit Trail** | Verified `appointment.requested`, `appointment.confirmed`, `appointment.rescheduled`, `appointment.cancelled` in audit collection | **PASS** |
| **10. Wording Safety Scanner** | 0 prohibited clinical claims (`diagnosis`, `curative`, `cancer-free`) | **PASS** |
| **11. i18n Dictionary Parity** | 100% key match across en, te, hi | **PASS** |

---

## 9. Deliverables & Modified Artifacts

- [appointmentModel.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/appointment/appointmentModel.ts) — Appointment MongoDB schema with partial compound unique index for slot concurrency.
- [appointmentService.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/appointment/appointmentService.ts) — Business logic for slot generation, ACID transactions, self-confirmation guard, and Phase 5 notifications.
- [appointmentRoutes.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/appointment/appointmentRoutes.ts) — Express routes for booking, confirm, reschedule, cancel, check-in, complete, and slot inspection.
- [authorizationEngine.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/auth/authorizationEngine.ts) — Capability matrix updates and static endpoint registration for all 9 appointment routes.
- [app.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/app.ts) — Mounted `appointmentRouter` at `/api/v1/appointments`.
- [appointmentsManagement.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/appointmentsManagement.test.ts) — 23 comprehensive tests covering concurrency, offline replay, self-confirmation, and tenancy guards.
- [AppointmentManager.tsx](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/client/src/components/AppointmentManager.tsx) — Frontend component for appointment booking, 20-min slot inspector, and simulation BLOCKED indicators.
- [App.tsx](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/client/src/App.tsx) — Added Appointments tab to primary navigation.
- [en.json](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/i18n/locales/en.json) | [te.json](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/i18n/locales/te.json) | [hi.json](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/i18n/locales/hi.json) — Multilingual translations with 100% parity.
