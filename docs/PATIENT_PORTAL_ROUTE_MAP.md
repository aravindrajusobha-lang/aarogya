# Patient Portal Route Map

The portal uses the existing React hash router and renders its protected pages inside the patient dashboard shell. Sidebar selections use the existing `#/patient?tab=...` convention; deep links with path IDs are also resolved by the global router.

## Public account routes

| Route | Component | Access | Behavior |
|---|---|---|---|
| `#/patient/login` | `PatientLoginPage` | Public | Phone with OTP or password; success redirects to the dashboard |
| `#/patient/register` | `PatientAccountPage` | Public | Consent-based synthetic demo account registration; does not require OTP |
| `#/patient/forgot-password` | `PatientAccountPage` | Public | OTP password reset |

Signed-in users visiting an account route are redirected to `#/patient/dashboard`.

## Protected routes

| Route | Portal module | Shared resource ID |
|---|---|---|
| `#/patient/dashboard` or `#/patient` | Dashboard | — |
| `#/patient/profile` | Health Profile | `patientId` from the session |
| `#/patient/screening` | Oral Screening | — |
| `#/patient/screening/:screeningId/report` | Report and screening chat | `screeningId` |
| `#/patient/assessment/:screeningId` | Assessment and referrals | `screeningId` |
| `#/patient/consult/:doctorId` | Consultation booking | `doctorId`, optional `screeningId` |
| `#/patient/appointments` | Appointments | `appointmentId` on each record |
| `#/patient/reports` | Reports and History | `prescriptionId` on each record |
| `#/patient/reports/:prescriptionId` | Prescription detail and voice-over | `prescriptionId` |
| `#/patient/history` | Reports and History | `screeningId`, `appointmentId`, `prescriptionId` |
| `#/patient/treatment` | Treatment tracking | `treatmentPlanId` |
| `#/patient/reminders` | Reminders | `appointmentId` or `treatmentPlanId` |
| `#/patient/help` | Help and Support | `supportTicketId` on each ticket |

The 10 sidebar items are numbered Dashboard, Health Profile, Oral Screening, AI Assessment, Consultation, Reports & History, Treatment, Appointments, Reminders, and Help & Support. The current item remains highlighted for its deep links. On phones, navigation collapses to the responsive bottom bar.

## Navigation tree

```text
Patient Portal
├── 1 Dashboard
├── 2 Health Profile
├── 3 Oral Screening
│   └── Screening Report and saved AI chat
├── 4 AI Assessment and Referrals
├── 5 Consultation
│   └── Online or offline appointment request
├── 6 Reports & History
│   └── Prescription detail and voice-over
├── 7 Treatment
├── 8 Appointments
├── 9 Reminders
└── 10 Help & Support
```

## Route behavior

- Unauthenticated visits to protected portal pages redirect to `#/patient/login`.
- The existing role guard protects patient pages. Existing community-volunteer access is retained for compatibility with the current application.
- Unknown `#/patient/*` paths show the in-portal 404 state with a dashboard return action.
- Consultation requests create appointments. Online video or voice stays blocked unless a real provider is configured; the portal does not present a simulated call room or take payment.
- Report chat is scoped to the patient and screening. Profile context is only sent to the server when the patient consents.
- A persistent simulation banner and the non-diagnosis disclaimer remain visible throughout protected pages.

## Data flow

```text
Profile → Screening → DEMO AI screening support + saved report chat
       → Assessment/referrals → Appointment request
       → Clinician-issued prescription → Treatment plan/logs → Reminders
       → Dashboard summaries and report history
```

All patient records are fetched through existing patient-scoped services or new owner-scoped patient APIs. `screeningId`, `doctorId`, `appointmentId`, `prescriptionId`, `treatmentPlanId`, and `supportTicketId` are passed through links where applicable.

## Verification checklist

1. Register with explicit consent, then verify redirect to the dashboard.
2. Sign in with OTP and password; verify password reset.
3. Open a screening report and verify patient-scoped chat persists after reload.
4. Open assessment, request an online or offline appointment, and verify sharing is opt-in.
5. Open a clinician-issued prescription and exercise read-aloud controls without changing its content.
6. Start tracking from a prescription, record adherence and symptoms, and verify owner-scoped photo access.
7. Review reminders and submit a support ticket.
8. Check mobile navigation, banner/disclaimer, and unknown-route behavior.
