# Patient Dashboard Portal

## Assumptions

- Keep the existing React 18/Vite client, Express/Mongoose server, hash router, auth token storage, design tokens, screening flow, AI services, appointment APIs, notifications, prescription records, and speech synthesis.
- Reuse phone-based identity: sign-in accepts OTP or password, registration uses consent without OTP, and email is available as a reminder channel.
- The application has no SQL migration runner. Existing and new Mongoose model files are additive collection/schema changes; do not create a SQL migration or rename a collection.
- Gemini credentials stay on the server in `GEMINI_API_KEY`. Patient report chat reuses the existing Gemini service when configured and has a safe demo fallback.
- Online appointments use the authenticated browser WebRTC room for confirmed appointment calls. Existing Daily.co routes remain available for their configured workflows; no call is simulated.
- No payment provider is configured; appointment actions schedule a visit and do not collect payment.
- Profile sharing and report sharing require the patient’s explicit consent at booking. Consent metadata is recorded with the appointment.

## 1. Audit and Reuse vs New

| Module | Reuse | New or extended work |
|---|---|---|
| Dashboard | Existing `PatientDashboard`, `DashboardLayout`, session/auth, theme tokens, navigation | 10 item patient sidebar, responsive portal layout, profile completion, appointment stats/table/calendar, clinician availability, recent reports, treatment progress, care journey |
| Health profile | Existing User profile fields and auth token | Patient-owned profile GET/PUT, consent capture, completeness, editable profile page |
| Screening and report | Existing camera/upload flow, AI screening service, patient scoped screening history | Direct report route, report summary, DEMO AI wording, saved chat backed by the new additive `AiChatMessage` model |
| AI assessment and referrals | Existing specialist, hospital, doctor availability, referral APIs | Availability cards and doctor prefill from the assessment route |
| Consultation | Existing appointment booking, availability and consultation services | Online/offline selection, explicit share consent, screening ID forwarding |
| Reports and prescriptions | Existing prescription model/API, history, Web Speech API | Route-specific prescription view and read-aloud controls |
| Treatment tracking | Existing prescription records, private photo storage and appointment services | New additive `TreatmentPlan` and `TreatmentLog` models, patient scoped plan creation, symptom/pain logs, consented SHA-256 progress photos, daily adherence chart and idempotent writes |
| Appointments and reminders | Existing appointments, consultation status, `Notification` and `NotificationPreferences` services | Dashboard summary, patient reminder states, preference editor and UUID replay protection for preference updates |
| Help and support | Existing Drishti assistant and simulation notice | Patient owned, idempotent support tickets and ticket status list |
| Login and registration | Existing patient OTP service, password auth, User/Patient models | Patient login/register/reset route pages; registration consent and mutation ID validation |

## 2. Route Map and Navigation Tree

The global router keeps hash routes and maps them onto the existing patient dashboard component.

```text
#/patient/login
#/patient/register
#/patient/forgot-password
└── #/patient/dashboard
    ├── #/patient/profile
    ├── #/patient/screening
    ├── #/patient/screening/:screeningId/report
    │   └── #/patient/assessment/:screeningId
    │       └── #/patient/consult/:doctorId
    ├── #/patient/appointments
    ├── #/patient/prescriptions
    ├── #/patient/reports/:prescriptionId
    ├── #/patient/treatment
    ├── #/patient/reminders
    ├── #/patient/history
    └── #/patient/help
```

The fixed sidebar contains exactly these numbered items: 1 Dashboard, 2 Health Profile, 3 Oral Screening, 4 AI Assessment, 5 Consultation, 6 Reports & History, 7 Treatment, 8 Appointments, 9 Reminders, and 10 Help & Support. Unknown `/patient/*` routes show an in-portal 404. Protected pages redirect to patient login when unauthenticated and display the role restriction for an unauthorized account.

The dashboard overview receives typed appointment, doctor availability, report, treatment, reminder, and profile props from `PatientDashboard`; it does not fabricate patient records. Those props are currently populated by the existing patient appointment, consultation availability, notification, prescription, screening-history, profile, and treatment APIs listed below. To connect a different API client, replace the corresponding loaders in `PatientDashboard` and keep the overview component contract unchanged.

## 3. Additive Data and API Map

There is no relational migration framework in this repository. Data additions use additive Mongoose schema/model changes.

| Data | Storage | Patient ownership / mutation behavior |
|---|---|---|
| Profile | Existing `User` fields plus `profileConsentAt` | Read/update only the authenticated patient; PUT requires `consentGiven: true` and UUID mutation ID; response excludes credentials |
| Screening chat | New additive `AiChatMessage` model/collection | Keyed by patient and screening; history is scoped to the authenticated patient; chat mutation IDs are UUIDs |
| Treatment plan/log | New additive `TreatmentPlan` and `TreatmentLog` models | Built only from the patient’s own prescription; plan and log reads are patient scoped; writes use `SyncLedger` idempotency; photo references point to private hashed files |
| Support ticket | New additive `SupportTicket` model/collection | Ticket reads are patient scoped; creation uses a patient-scoped UUID mutation ID |
| Appointment sharing consent | Existing Appointment `visitDetails` field | Stores report/profile sharing flags and a server timestamp; no profile fields are copied into the appointment |
| Reminder preferences | Existing `NotificationPreferences` collection | Patient-owned channel/topic/language settings; updates accept UUID `mutationId` and store the replay response in `SyncLedger` |

### Implemented endpoints

| Method | Path | Request / response | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/patient/send-otp` | `{ phone, purpose }` → challenge status and demo hint in simulation | Public, rate limited |
| POST | `/api/v1/patient/auth/login` | `{ phone, otp or password }` → user and tokens | Public, rate limited |
| POST | `/api/v1/patient/auth/register` | consented profile fields and UUID `clientMutationId` (no OTP) → user and tokens | Public, rate limited |
| POST | `/api/v1/patient/auth/forgot-password` | `{ phone }` → generic reset status | Public, rate limited |
| POST | `/api/v1/patient/auth/reset-password` | `{ phone, otp, newPassword }` → reset status | Public, rate limited |
| GET | `/api/patient/profile` | Own allowed profile fields | Patient, `patient:read_own` |
| PUT | `/api/patient/profile` | Allowed profile fields, `consentGiven: true`, UUID `mutationId` | Patient, `patient:profile_own` |
| GET | `/api/ai/screenings?patientId=:id` | Own safe screening summary list | Patient scoped by existing route |
| GET | `/api/v1/prescriptions/patient/:patientId` | Own prescription records | Patient scoped by existing route |
| GET | `/api/v1/consultations/appointments/my` | Own appointment list and consultation status | Patient, `appointment:read` |
| GET | `/api/v1/consultations/availability?date=YYYY-MM-DD` | Verified doctors with free slot counts | Patient, `appointment:read` |
| POST | `/api/v1/appointments` | Selected slot, mode, optional screening ID, consent, UUID idempotency key | Patient, `appointment:create` |
| GET | `/api/v1/notifications?limit=30` | Own notification/reminder list | Patient scoped by existing route |
| GET | `/api/v1/referrals/patient/:patientId` | Own referral list | Patient scoped by existing route |
| GET / POST | `/api/patient/screenings/:screeningId/chat` | Read/send screening chat messages; POST includes UUID mutation ID, language and consent flag | Patient; read own / `patient:chat_own` |
| GET / POST | `/api/patient/support-tickets` | List/create tickets; create includes UUID mutation ID | Patient; read own / `patient:support_own` |
| GET | `/api/v1/notifications/preferences` | Own in-app, simulated SMS/email, category, and language preferences | Patient, `notification:read_own` |
| PUT | `/api/v1/notifications/preferences` | Preference patch plus UUID `mutationId`; replay response is cached in `SyncLedger` | Patient, `notification:manage_own` |
| GET | `/api/patient/treatment-plans` | Own plans | Patient, `patient:read_own` |
| POST | `/api/patient/treatment-plans/from-prescription` | `{ mutationId, prescriptionId }` → plan copied from own clinician-issued prescription | Patient, `patient:treatment_own` |
| GET | `/api/patient/treatment-plans/:treatmentPlanId` | Own plan details | Patient, `patient:read_own` |
| GET | `/api/patient/treatment-plans/:treatmentPlanId/logs` | Up to 90 own daily logs | Patient, `patient:read_own` |
| POST | `/api/patient/treatment-logs` | UUID mutation ID, plan ID, date, medication check-ins and optional notes | Patient, `patient:treatment_own` |
| POST | `/api/patient/treatment-plans/:treatmentPlanId/photos` | Multipart photo, consent and UUID mutation ID; stores a private SHA-256 photo owned by the patient | Patient, `patient:treatment_own` |
| GET | `/api/v1/storage/files/:fileId` | Authenticated stream for a file; patients can read only files attached to their own patient ID | Patient owner or clinical storage scope |

The server checks patient ownership before returning profiles, prescriptions, plans, logs, tickets, referrals, appointments, and chat history. API changes are also listed in `API_DOCUMENTATION.md`; storage changes are listed in `DATABASE_SCHEMA.md` and `TRACEABILITY_MATRIX.md`.

## 4. Implementation Status

- **A Dashboard:** responsive sidebar and bottom navigation, greeting/profile completion, appointment/screening/treatment/reminder summaries, quick navigation, recent reports with Open/Listen, care journey.
- **B Report and AI chat:** patient scoped saved chat, consent-gated profile context, report context, suggested questions, urgent-care banner and DEMO AI disclaimer.
- **C Prescription and voice-over:** existing prescription records, Web Speech controls, transcript, language/rate controls, no medication or dose changes.
- **Remaining modules:** patient OTP login, registration and reset pages; editable consented profile; screening/report/history integration; assessment doctor list; online/offline booking with consent; persisted treatment tracking; reminders; support tickets and assistant link.

## 5. Test Checklist

1. Register a synthetic patient without OTP and with explicit consent; confirm redirect to dashboard.
2. Sign in by OTP and password; exercise password reset.
3. Load screening history and open a report by its shared screening ID.
4. Send an AI report question, reload, confirm history remains, and verify another patient cannot read it.
5. Open assessment, select a verified doctor and slot, test offline and online mode, and confirm sharing remains off unless explicitly selected.
6. Open a clinician-issued prescription, play/pause/stop read-aloud, and verify wording preserves the prescription.
7. Start treatment tracking, save a daily medicine check-in, reload, and confirm idempotent replay and cross-patient denial.
8. Load reminders and support tickets, submit a ticket, and verify its status survives reload.
9. Check mobile bottom navigation, visible focus, loading/empty/error states, and the persistent simulation banner/disclaimer.
10. Run the smoke, backup/restore, secret scanner, route coverage and patient portal tests.
