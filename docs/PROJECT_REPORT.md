# Aarogya-Drishti — Project Report

**Formal project report · Version 1.0 · November 2026**  
**Project context:** ITDA Paderu Tribal Health Initiative, Alluri Sitharama Raju District, Andhra Pradesh  
**Repository version:** 0.2.0  
**Document purpose:** problem statement, proposed solution, design, features, models, technologies, safeguards, limitations, and future work.

> **Simulation notice:** Aarogya-Drishti is a software demonstration using demo data. It is not intended for clinical use. Automated outputs are screening support only and do not replace assessment by a qualified professional.

> **Pagination:** This report is laid out as 30 page-sized sections. When exporting to Word/PDF, insert a page break at each `<!-- PAGE BREAK -->` marker. The separate operational document is [PROJECT_GUIDE.md](PROJECT_GUIDE.md).

## Page 1 — Cover and project identity

# Aarogya-Drishti

### A multilingual, offline-capable health navigation and oral screening support platform

This report describes the project context, the problem it addresses, its objectives and scope, proposed solution, implementation architecture, application and machine-learning models, technology stack, security and privacy boundaries, validation strategy, current limitations, and recommended next steps.

**Prepared for:** ITDA Paderu Tribal Health Initiative  
**Region:** Alluri Sitharama Raju District, Andhra Pradesh  
**Project context:** AAROHAN 2026  
**Project version:** 0.2.0  
**Document type:** Academic and technical project report  
**Audience:** Evaluators, project stakeholders, developers, health-program reviewers, and future maintainers

The report is based on the current repository, including its client application, server modules, schema definitions, AI service, training assets, and project charter. Feature availability can depend on environment configuration and external providers. The companion Project Guide contains setup and operational instructions.

<!-- PAGE BREAK -->

## Page 2 — Abstract

Aarogya-Drishti is a web-based health navigation and community screening support platform designed around workflows that can be difficult to coordinate across remote communities: patient registration, oral health screening, clinician review, appointment and referral tracking, and follow-up. Its primary engineering goal is to connect those activities through one role-aware application while preserving a usable field workflow when network access is intermittent.

The platform combines a React and TypeScript progressive web application, a Node.js and Express API, MongoDB persistence, an optional Python inference service, and browser-based offline storage. It includes patient, clinician, frontline worker, facility, and system administration experiences. Its records represent identity and consent, screenings and attachments, appointments, consultations, care transitions, prescriptions, facility inventory, notifications, and audit events.

The design treats automated image and questionnaire outputs as non-diagnostic support. Human clinical review is represented separately from automated screening records. Privacy-oriented controls include role and capability checks, facility scope, protected file delivery, explicit consent records, minimized identity processing, record history patterns, and suppression of small aggregate groups.

This report distinguishes implemented behavior from operating assumptions and limitations. All deployment and clinical-use decisions require validation beyond this demonstration project.

**Keywords:** offline-first PWA, health navigation, community screening, MongoDB, role-based access, multilingual interface, demo AI, privacy.

<!-- PAGE BREAK -->

## Page 3 — Executive summary

Health programs often rely on separate tools and paper records. This can make it difficult to preserve continuity from first contact through screening review, referral, appointment, and follow-up—especially where connectivity is inconsistent and settlements use landmark-based directions rather than standard street addresses.

Aarogya-Drishti provides a shared digital workflow. Frontline workers can use the PWA to record screening activity and queue supported mutations locally. Clinicians can review patient records within permitted scopes, manage appointment and care workflows, and issue prescriptions. Patients have a portal for appointments, reports, prescriptions, and care information. Administrators manage facility and staff configuration. Facility workflows include inventory, beds, equipment, and staff summaries.

The system is modular. Express routers mount separately for identity, patients, screening, appointments, consultation, referrals, prescriptions, facility operations, maps, reports, consent, storage, and synchronization. MongoDB schemas represent durable records, while Dexie stores browser-side offline work. A separate FastAPI service exposes image-screening endpoints using EfficientNet-B0 implementations and a rule-based questionnaire module.

Important boundaries are explicit: synthetic demo data, no clinical validation, mocked identity verification, simulated cellular messaging, and provider-dependent live video. The platform demonstrates software workflow and data handling; it must not be treated as a medical device or production clinical service.

<!-- PAGE BREAK -->

## Page 4 — Background and context

The project is situated in a rural and tribal health service context in the Eastern Ghats of Andhra Pradesh. Communities may be separated from health facilities by distance, terrain, seasonal road conditions, and limited network coverage. Frontline workers may need to coordinate screening visits, preserve locally meaningful directions, and help a person navigate the next appropriate service.

Many digital health products assume continuous connectivity, reliable patient identifiers, and central-city infrastructure. Those assumptions can fail in field settings. A useful information system should tolerate temporary disconnection, preserve a record of work, synchronize safely when a connection returns, and communicate clearly across languages and roles.

This project focuses on the information workflow rather than replacing a clinical service. It offers connected screens and APIs that demonstrate registration, consent, screening support, clinician review, referrals, appointments, and continuity records. It also includes administrative operations to represent facilities and staff.

**Design premise:** the system should help people and health teams coordinate a process, keep traceable records, and find the next step. It should not make independent clinical decisions. A trained professional remains responsible for interpreting information and deciding care.

<!-- PAGE BREAK -->

## Page 5 — Problem statement

Community health workflows can become fragmented when registration, screening notes, images, clinician review, referrals, appointments, prescriptions, and follow-up are recorded in different places or depend on paper handoffs. Fragmentation can lead to repeated data entry, difficulty locating the latest record, delayed visibility of the next action, and weak accountability for transitions between providers.

These workflow challenges are amplified by field constraints: intermittent internet, multilingual communication needs, limited time for data entry, non-standard addresses, and a service network containing multiple facility levels. A conventional always-online application may interrupt data capture precisely where information is first collected.

**Problem statement:** How can a single, role-aware digital platform demonstrate a traceable, privacy-conscious, and network-resilient path from community intake to screening review and healthcare navigation, while avoiding unsupported clinical conclusions and preserving human oversight?

The problem has six dimensions:

1. **Continuity:** information must remain associated with the correct patient and event.
2. **Connectivity:** temporary network loss should not erase field work.
3. **Coordination:** referrals and appointments need status and ownership.
4. **Access:** people need role-appropriate screens and language support.
5. **Trust:** sensitive information needs access controls and record history.
6. **Safety:** automated outputs must be framed as limited support.

<!-- PAGE BREAK -->

## Page 6 — Existing-process gaps and rationale

In a fragmented process, a frontline worker may capture information on paper or a local device, a clinician may receive only a partial summary, and an appointment or referral may be managed separately. If a person moves between facilities or treating clinicians, relevant history may not be immediately available. Manual aggregation also makes it difficult to understand operational capacity such as appointments, beds, and medicine stock.

These are design motivations, not claims that every facility currently follows the same process. The software models common coordination points and offers a demonstrable shared record. It supports facility and catchment scope so access can be limited to assigned work. It keeps an audit trail and uses stable identifiers so authorized users can retrieve information consistently.

Offline support is included because connectivity is an environmental constraint rather than an exceptional error. Encrypted local queue records and mutation identifiers are intended to support delayed synchronization and replay handling. A service worker and cached application shell can make the interface more resilient to short outages.

Integrating these concepts around shared records reduces the need to bridge isolated tools. It also creates a consistent interaction pattern: collect information, preserve provenance, route it to an authorized reviewer, and show the status of the next step.

<!-- PAGE BREAK -->

## Page 7 — Aim, objectives, and success criteria

### Overall aim

Design and implement a demonstration platform that supports community screening workflows and healthcare navigation across patient, frontline, clinician, facility, and administrative roles.

### Specific objectives

1. Provide multilingual patient and staff experiences for registration, authentication, and navigation.
2. Represent patient profiles, consent, screenings, attachments, appointments, referrals, prescriptions, and follow-up as connected records.
3. Support field data capture with an offline queue and idempotent synchronization patterns.
4. Offer demo image and questionnaire analysis with clear labels and human review.
5. Support access control by role, capability, facility, and assigned catchment.
6. Provide operational facility views for doctors, beds, medicine stock, and equipment.
7. Keep sensitive attachments behind authenticated, scoped download endpoints.
8. Document deployment, configuration, limitations, and maintenance steps.

Success means coherent end-to-end navigation, API/data model integration, readable workflow state, appropriate authorization boundaries, and transparent disclosure of simulated functionality. It does not mean clinical effectiveness or real-world health outcomes have been proven.

<!-- PAGE BREAK -->

## Page 8 — Scope, assumptions, and exclusions

| Included in the demonstration | Outside the validated scope |
|---|---|
| Patient and staff accounts; facility directory; screening and human review; appointments; referrals; prescriptions; care transfer requests; facility inventory; reports; notifications; offline queueing. | Clinical diagnosis, autonomous treatment decisions, regulated medical-device use, live identity verification, production emergency dispatch, and proof of health outcomes. |
| AI inference interfaces, image quality checks, configurable labels/thresholds, and clinician review state. | Evidence that model outputs are accurate or safe for a population, or that demo training data is representative. |
| Optional provider-backed appointment video workflow and text-based consultation records. | Guaranteed real-time audio/video operation in every environment; a UI simulation must not be represented as a real connection. |
| Demo notifications and adapter boundaries. | Guaranteed delivery by real SMS, email, or cellular service. |

Assumptions include access to a supported browser, a configured backend, MongoDB, and—where required—an enabled external provider. Local development and hosted deployment need correctly configured origins and secrets. Demo seed data must remain clearly separated from real records.

The project scope describes features in the repository; it does not certify operational readiness.

<!-- PAGE BREAK -->

## Page 9 — Stakeholders and user roles

| Role family | Typical responsibilities in the application |
|---|---|
| Patient | Register/sign in, view permitted records, request or manage appointments, see released prescriptions and care information, and use language/help features. |
| ASHA / ANM / frontline worker | Support registration, conduct field workflows, capture screenings, manage camp activity, and synchronize queued work within assigned geography. |
| Medical officer / doctor | Review records and screening information, manage appointments and consultations, document clinician assessment, create prescriptions, and respond to transfer requests. |
| Specialist | Participate in assigned referral or consultation workflows subject to role capabilities and facility scope. |
| Facility administrator / manager | Maintain permitted facility operations such as beds, stock, equipment, and staffing information. |
| System or district administrator | Manage system-level configuration, staff onboarding, facility directories, and operational oversight. |

Authorization should be capability-based as well as role-based. Patient-record and attachment access are sensitive and should be constrained to a legitimate assigned relationship, facility, or other explicit authorization enforced by the server.

<!-- PAGE BREAK -->

## Page 10 — Functional requirements

1. **Identity:** support patient and staff sign-in, session validation, recovery controls, and device/session lifecycle patterns.
2. **Patient registry:** maintain patient identifiers and profile details with consent and data-minimization rules.
3. **Screening:** record a case, findings, image references, AI outputs, and separate clinician assessments.
4. **Field work:** support camps, worker assignments, village references, and synchronization queues.
5. **Care navigation:** create referrals, appointments, follow-ups, consultation notes, and patient-doctor transfer requests.
6. **Prescriptions:** let an authorized clinician issue an artefact and show it to the correct patient, with a patient download path where enabled.
7. **Facility operations:** maintain wards, beds, medicine quantities and movements, equipment, and facility summaries.
8. **Communication:** present in-app notifications and consultation messages; external delivery depends on configured adapters.
9. **Reports:** expose operational summaries with suppression for small aggregate counts.
10. **Patient help:** provide a multilingual assistant on public and patient-facing screens with navigation support.

These requirements express the intended workflow. The operational guide and route map should be used to confirm specific runtime behavior.

<!-- PAGE BREAK -->

## Page 11 — Non-functional requirements

- **Availability under intermittent connectivity:** preserve supported client work locally and expose retry/sync state.
- **Security:** authenticate requests, authorize mutations, validate inputs, and avoid public exposure of patient uploads.
- **Privacy:** minimize identity data, prevent sensitive data from being logged, scope records, and suppress small groups.
- **Integrity:** use record identifiers, hashes, audit records, version history, and transaction boundaries where appropriate.
- **Usability:** keep patient and field workflows navigable on small screens and provide language selection.
- **Maintainability:** separate business features into modules and maintain API/schema documentation.
- **Interoperability:** expose JSON HTTP APIs and provider adapters; standards-based interoperability needs additional implementation.
- **Performance:** limit image sizes, use bounded requests, and avoid loading large model artifacts unless needed.
- **Observability:** log operational events through structured logging with sensitive values redacted.

Some are architectural targets rather than independently verified service-level guarantees. Hosting, database configuration, client hardware, and external providers affect runtime behavior.

<!-- PAGE BREAK -->

## Page 12 — Proposed solution and user journey

The platform organizes a patient journey as a linked sequence of events. An authorized worker or patient enters a profile; the application associates consent; a screening event is captured; image or questionnaire assistance may produce a separately stored demo result; a clinician reviews relevant information; and an appointment, referral, or follow-up is recorded where needed.

```text
Patient/frontline entry
       ↓
Profile + consent + stable patient identifier
       ↓
Screening case + attachments + provenance
       ↓
DEMO AI output (separate) → clinician review (separate)
       ↓
Referral / appointment / consultation / prescription
       ↓
Patient-visible released records + follow-up history
```

Each transition has a status, actor, and timestamp where the domain model supports it. Patients see their own permitted information. Clinicians see information only through authorized routes and assigned relationships. Administrative pages manage operational structures but should not bypass patient privacy rules.

When connectivity is unavailable, supported frontline mutations are stored locally and synchronized later. A client mutation identifier lets the backend recognize replay. Conflicts require explicit handling instead of silently overwriting newer records.

<!-- PAGE BREAK -->

## Page 13 — High-level system architecture

```text
┌────────────────────────────────────────────┐
│ React 18 + TypeScript + Vite PWA            │
│ Patient / Staff / Doctor / Admin portals    │
│ Dexie IndexedDB + service worker + ONNX web │
└──────────────────────┬─────────────────────┘
                       │ HTTPS / JSON / WebSocket
┌──────────────────────▼─────────────────────┐
│ Node.js 20 + Express API (TypeScript / ESM) │
│ Auth · RBAC · domain modules · audit        │
└──────────────────────┬─────────────────────┘
                       │ Mongoose
┌──────────────────────▼─────────────────────┐
│ MongoDB (replica set recommended for txns)  │
│ Domain records · audit · metadata           │
└────────────────────────────────────────────┘
       │ optional HTTP image inference
       ▼
┌────────────────────────────────────────────┐
│ FastAPI + PyTorch/timm + EfficientNet-B0    │
│ Demo image analysis + rule-based module     │
└────────────────────────────────────────────┘
```

The front end uses Vite development proxying for API and Socket.IO requests. The backend mounts REST routes beneath versioned and selected legacy paths. MongoDB is accessed through Mongoose schemas. An optional AI service runs separately and can be unavailable without making its output authoritative. External services such as Daily video rooms or cloud storage require environment-specific credentials. Secrets belong on the server side and should not be embedded in the browser bundle.

<!-- PAGE BREAK -->

## Page 14 — Frontend design and modules

The application is built with React 18, TypeScript, Vite, and vanilla CSS. The main router is hash-based and dispatches to public pages and role-specific portals. Shared components provide simulation disclosure, language switching, protected routes, navigation, forms, notifications, screening widgets, consultation interfaces, and the patient-facing assistant.

Main experiences include:

- **Public:** home, patient sign-in, patient registration, and staff sign-in.
- **Patient:** dashboard, profile, screening history, appointments, prescriptions, reports, and care navigation.
- **Doctor:** schedule/availability, appointment patients, record lookup, clinical review, consultation and prescription workflows.
- **Administration:** staff and facility administration, verification, hospital details, and operational configuration.
- **Field and operations:** camps, assignments, villages, maps, screening, reporting, and synchronization.

Locale files include English, Telugu, Hindi, Tamil, Kannada, and Malayalam. Some screens may still contain hard-coded strings; locale coverage should be checked whenever a screen is introduced. CSS uses project tokens and responsive layouts, not a utility CSS framework. The patient help assistant appears on public home, patient authentication, and patient portal pages; administrative portals omit it.

<!-- PAGE BREAK -->

## Page 15 — Backend design and API modules

The backend is Node.js 20, TypeScript, native ES modules, Express, and Mongoose. `server/src/app.ts` configures security headers, CORS, JSON parsing, response envelopes, request logging, cache restrictions, and rate limiting before mounting domain routers. Route handlers delegate to module services and persistence models.

Versioned routes cover health, storage, authentication, patients, consent, hospitals, facility operations, invitations, specialists, assignments, references, notifications, recovery, village groups, screening, camps, appointments, biopsy, referrals, prescriptions, teleconsultation, consultation sessions, patient records, care transfer, maps, reports, mock identity verification, sync, assistant, and AI. Patient-focused profile, treatment, support, and report-chat routes use a patient API prefix.

Middleware and services include token authentication, capability authorization, Zod validation, rate limiting, request identifiers, Pino logging, and normalized response envelopes. Multi-record operations should use transactions when database topology supports them.

The API is the security boundary. A hidden front-end button does not constitute access control. Every record query and mutation must enforce identity, capability, facility/catchment, and patient relationship rules on the server.

<!-- PAGE BREAK -->

## Page 16 — Data architecture and relationships

MongoDB stores durable entities as Mongoose documents. Stable identifiers such as patient, appointment, screening, referral, and hospital IDs connect workflows without requiring the client to depend on database object identifiers. References and embedded subdocuments are used where a domain record needs actor snapshots, status history, or structured items.

```text
User ── assigned scope ── Hospital / Subcenter / Village
  │                                  │
  ├── performs ── ScreeningCase ── ScreeningPhoto / AiScreening
  │                         └──── ClinicalAssessment / ResultRelease
  ├── requests ── Appointment ── Consultation / ConsultationNote
  │                         └──── Prescription
  └── records ── Referral ── Biopsy / TreatmentPlan / TreatmentLog

Patient ── Consent · Notification · RecoveryTicket · CareTransfer
Facility ── Ward · Medicine · StockMovement · Equipment
```

Private file metadata is stored separately from file bytes. API access to a file is authenticated and scope-checked. Offline records in Dexie are not equivalent to central MongoDB records until sync completes. Detailed fields and indexes live in source schemas under `server/src/modules`; this report summarizes domains rather than reproducing every schema field.

<!-- PAGE BREAK -->

## Page 17 — Application model catalog: identity and patients

| Model | Purpose |
|---|---|
| `User` | Account identity, role, credential/security metadata, facility scope, and profile linkage. |
| `Otp` | One-time verification state and expiry. |
| `DeviceSession` | Device/session lifecycle and revocation state. |
| `Delegation` | Delegated access tracking. |
| `Patient` | Patient profile and history metadata associated with a stable patient identifier. |
| `Consent` | Consent status, scope, and provenance. |
| `RecoveryTicket` | Controlled account recovery requests and review state. |
| `DuplicateReview` | Potential duplicate identity resolution workflow. |
| `SyncLedger` | Idempotency ledger for replay-safe client mutations. |
| `SupportTicket` | Patient or shared support request workflow. |

Patient identity rules in the project charter limit stored profile information and prohibit persistence of raw identity-card digits or source card images. Patient and account records are not interchangeable: access and authentication claims should be checked against server-side linkage. Recovery should reveal only the minimum necessary account state.

Source of truth: `server/src/modules/auth/`, `patient/`, `consent/`, and `recovery/` model files.

<!-- PAGE BREAK -->

## Page 18 — Application model catalog: facility and geography

| Model | Purpose |
|---|---|
| `Hospital` | Facility identity, type, geography, and directory metadata. |
| `Subcenter` | Subcenter reference and facility hierarchy. |
| `Village` | Geographic reference data used for catchment workflows. |
| `VillageGroup` | Grouping of village/habitation reference data. |
| `HealthWorkerAssignment` | Worker assignment to facility and catchment geography. |
| `Specialist` | Specialist directory and availability metadata. |
| `Invitation` | Controlled staff onboarding invitation. |
| `Camp` | Community screening event schedule and operational metadata. |
| `FacilityWard` | Facility ward and total/occupied bed counts. |
| `FacilityMedicine` | Facility medicine inventory catalogue and stock count. |
| `FacilityStockMovement` | Auditable medicine quantity movement. |
| `FacilityEquipment` | Equipment inventory and condition. |

Facility inventory is operational information and does not establish real-time availability unless the facility keeps it current. Geography may include verbatim local landmarks; those descriptions should be preserved rather than silently normalized into inaccurate street addresses. Aggregate reporting should suppress groups with positive counts below five and avoid filters that isolate a person.

Source of truth: `hospital/`, `subcenter/`, `reference/`, `villageGroup/`, `assignment/`, `specialist/`, `invitation/`, `camp/`, and `facility/`.

<!-- PAGE BREAK -->

## Page 19 — Application model catalog: screening and review

| Model | Purpose |
|---|---|
| `ScreeningCase` | Screening event, patient association, performer, location/camp, status, and structured findings. |
| `ScreeningPhoto` | Image metadata/reference, capture context, integrity information, and access linkage. |
| `AiScreening` | Machine-generated output, model version/source, image-quality fields, questionnaire and module results. |
| `ClinicalAssessment` | Separate human assessment and review notes; should not be overwritten by automated output. |
| `ResultRelease` | Controlled release state for selected patient-facing results. |
| `Assessment` | Additional structured assessment/evaluation workflow. |
| `StoredFile` | Private attachment metadata, ownership/scope, content type, size, checksum, and storage locator. |

Separate AI and clinician records preserve provenance: what the model produced, what a human reviewed, and what information was released to a patient. Screening media and notes are sensitive. Original artefacts should remain immutable; corrections should be represented through a new version or linked amendment where supported.

The interface may show demo image findings and let a clinician review a report. These mechanics demonstrate a workflow, not scientific reliability. Quality flags, labels, and confidence values must not be interpreted as definitive clinical findings.

<!-- PAGE BREAK -->

## Page 20 — Application model catalog: appointments and consultations

| Model | Purpose |
|---|---|
| `Appointment` | Patient, destination facility, clinician, time slot, mode, status, and change history. |
| `DoctorSlot` | Clinician availability for booking and schedule views. |
| `VideoConsultation` | Appointment/direct call session metadata and lifecycle. |
| `Teleconsultation` | Consultation workflow and participant/session details. |
| `DailyProviderConfig` | Server-side configuration for provider-backed rooms. |
| `ConsultationCapture` | Capture metadata associated with a consultation. |
| `ConsultationChat` | Text exchange associated with a consultation. |
| `ConsultationNote` | Versioned consultation notes and clinical documentation. |
| `ConsultationMessage` | Secure consultation messages. |
| `PatientCare` / `CareTransfer` | Treating relationship and requested clinician handoff/approval. |

Live video availability depends on the configured provider adapter and server credentials. Installing a browser SDK does not guarantee a connected call. Appointment authorization must bind a participant to the assigned patient/clinician and a valid invitation. Current adapter state and deployment configuration determine whether video can run or remains unavailable.

<!-- PAGE BREAK -->

## Page 21 — Application model catalog: prescriptions and care navigation

| Model | Purpose |
|---|---|
| `Prescription` | Issuer, patient, medicine items, instructions, lifecycle, and patient-accessible artefact. |
| `Referral` | Origin/destination, referral category, status, and follow-up state. |
| `Biopsy` | Specimen workflow and facility/actor linkage. |
| `BiopsyFindings` | Clinician-entered structured findings. |
| `BiopsyResultRelease` | Controlled patient-facing release state. |
| `TreatmentPlan` | Clinician-authored care plan and instructions. |
| `TreatmentLog` | Subsequent care event/history tracking. |
| `Notification` | In-app event and delivery state. |
| `NotificationPreferences` | User communication preferences. |

The system uses multiple records rather than one mutable case object. This allows an appointment, prescription, referral, and consultation note to have distinct owners, statuses, and history. Patient visibility should follow explicit release and authorization checks, and clinical records should be amended by versioning rather than destructive overwrite.

Source of truth: `prescription/`, `referral/`, `biopsy/`, `treatment/`, and `notification/`.

<!-- PAGE BREAK -->

## Page 22 — Application model catalog: audit and supporting entities

Other persisted entities include `AuditLog` for auditable actions, `AiChatMessage` for assistant conversation records where enabled, `Map`-domain structures for mapped/geographic data, `SupportTicket` for support requests, and private file metadata in `StoredFile`. Model filenames and explicit mongoose registrations are found in `server/src/modules`.

The doctor administration module also registers a `Counter` model used to allocate sequential doctor codes.

The two support ticket files are distinct module implementations; maintainers should inspect their collection names and route usage before changing them. MongoDB model registration may use aliases or embedded subdocuments, so schema-file names and collection names are not always identical. The project’s `docs/DATABASE_SCHEMA.md` is a helpful cross-reference but may include historical descriptions; the current TypeScript schema is authoritative.

Important supporting non-MongoDB data structures include Dexie records: `OfflineScreening`, `OfflineAiScreening`, `SyncQueueItem`, `CachedCamp`, and `EncryptedQueueItem`. These are browser-side types and stores, not MongoDB models. Distinguishing client cache records from server persistence models is important when debugging sync or explaining data retention.

<!-- PAGE BREAK -->

## Page 23 — Machine-learning and inference models

The repository contains two EfficientNet-B0 image model pathways and a questionnaire pathway. A Python FastAPI service exposes health metadata and image prediction routes. The client also contains ONNX Runtime Web assets and ONNX model files for local inference workflows.

| Module | Implementation | Output type |
|---|---|---|
| A — mucosal image support | PyTorch/timm EfficientNet-B0; configurable class list; softmax scores; image-quality gate. | Class scores, selected label, confidence, image-quality metadata, and a review-support flag. |
| B — dental image support | EfficientNet-B0 with sigmoid activation and per-label thresholds. | Per-label scores/flags and a dentist-review support flag. |
| C — questionnaire | Rule-based scoring, not a learned vision model. | Structured answers and a demo risk grouping/support recommendation. |
| Browser inference | ONNX Runtime Web and checked-in ONNX artifacts. | Local inference where workflow and browser assets support it. |

Training utilities are located in `ml_training/`. Checked-in metadata reports an EfficientNet-B0 experiment on 501 images and validation balanced accuracy of approximately 0.491. This is not evidence of clinical performance. Dataset provenance, class balance, validation design, subgroup analysis, external testing, and calibration require independent review.

<!-- PAGE BREAK -->

## Page 24 — Technology stack

| Layer | Technologies in the repository |
|---|---|
| Web client | React 18, TypeScript 5, Vite 6, vanilla CSS, React DOM. |
| Offline/client storage | Dexie 4 / IndexedDB, Web Crypto APIs, service worker, ONNX Runtime Web. |
| Maps and media | Leaflet, Three.js, Tesseract.js, jsQR, Daily browser SDK, Socket.IO client. |
| API server | Node.js 20, TypeScript, Express 4, native ESM, Zod. |
| Database | MongoDB with Mongoose 8; replica-set topology is needed for multi-document transactions. |
| Security/operations | Argon2, JWT, Helmet, CORS, Pino, rate limiting, upload validation, audit events. |
| AI microservice | Python, FastAPI, PyTorch, timm, Pillow, NumPy, ONNX and ONNX Runtime. |
| Validation tooling | Vitest, Supertest, mongodb-memory-server, TypeScript compiler. |
| Documents/media | jsPDF, html-to-image and private local/cloud storage adapters. |

The checked-in package manifests and lockfiles are authoritative for an installation. A listed dependency may be optional, used by only one screen, or disabled by deployment configuration. Pinning and reviewing dependency changes remains necessary.

<!-- PAGE BREAK -->

## Page 25 — Offline operation and synchronization

The PWA includes a custom service worker and a Dexie database named `AarogyaDrishtiSimulationDB`. Defined stores include local screening items, sync queue entries, cached camps, encrypted queue entries, and offline AI screening summaries. Queue records include status, retry metadata, and mutation identifiers. The encrypted queue schema includes AES-GCM-256 payload fields.

The intended sync pattern is: generate a unique mutation identifier; write an encrypted local payload; show its pending state; attempt synchronization when online; let the server consult its ledger before repeating business work; and update the client queue status based on the response. Retries need backoff behavior and duplicate replays must return the prior result rather than create a second domain record.

Not every workflow is offline-capable. A page rendering offline does not prove its API mutation can be queued. Supported actions and payload fields must be confirmed against client services and the server sync router. Raw identity-card digits and card images are excluded from persistent queues under the project privacy rules.

Encrypted browser storage improves protection but is not hardware-backed key storage. A lost or compromised device remains a risk.

<!-- PAGE BREAK -->

## Page 26 — Security and privacy controls

- **Authentication:** password hashing, signed tokens, device session tracking, and lockout modules are present.
- **Authorization:** server routes use authentication and capability/role checks; record access must apply facility and catchment scope.
- **Input validation:** designated routes use Zod schemas through validation middleware.
- **Transport/browser controls:** Helmet security headers, CORS origin restriction, permissions policy, and sensitive API cache prevention are configured.
- **Logging:** Pino is used with redaction requirements; secrets and sensitive personal data must not be logged.
- **Uploads:** storage adapters, magic-byte checks, and size limits help validate files; delivery uses protected API routes.
- **Data minimization:** raw identity-card digits, QR payloads, and card images must not be transmitted or stored.
- **Auditability:** audit records and record-hash/history patterns are included.
- **Aggregate privacy:** groups under five are suppressed in reporting and export outputs.

Security controls require configuration and operational review. Some authentication paths currently have fallback signing-secret values; the deployment must set an explicit random `JWT_SECRET`, and the code should fail startup if it is missing before any non-demo deployment. A source-level control can be defeated by unsafe settings, exposed secrets, broad database credentials, or untested scope logic. Server-side authorization is mandatory even where a UI hides a feature.

<!-- PAGE BREAK -->

## Page 27 — Clinical safety and responsible use

All screens and outputs belong to a simulation system using demonstration data. The platform is not clinically validated. Automated image and questionnaire outputs are screening support only and must not be presented as a diagnosis or used as a substitute for an assessment by a qualified health professional.

AI output and clinician assessment are separate records. The clinician should review source information, edit or reject a draft where the workflow supports it, and explicitly save a human-authored assessment. An automated result must never silently replace a clinician’s decision. Patient release is a separate workflow from result creation.

The platform must clearly mark mocked identity verification and simulated notifications. Live video or audio should be shown as unavailable unless a real provider adapter and credentials are operational. A simulated room or nonfunctional call control must not be represented as a real consultation.

Language used in messages should be understandable and consistent with the non-diagnostic boundary. For a health concern, the application should direct a person to an appropriate professional rather than recommend self-treatment based on an automated output.

**Responsible-use condition:** do not use this repository or its current model outputs to make real patient-care decisions.

<!-- PAGE BREAK -->

## Page 28 — User experience and localization

The interface is organized into role-specific portals to reduce irrelevant actions. The public home and patient login/registration pages include the patient help assistant, and the patient portal keeps the assistant available. Administrative portals omit it. Forms and dashboards should label the next action, distinguish draft/pending/confirmed/released states, and provide clear empty, offline, and error states.

The locale layer supports English, Telugu, Hindi, Tamil, Kannada, and Malayalam. Language selection is stored locally and can influence voice assistant interaction. Translation completeness is an ongoing maintenance task: new UI content should use locale keys rather than embedded English text, and terminology should be reviewed by fluent speakers for clarity.

Mobile-first styling matters for field and patient use. Controls need adequate touch targets; focus order and labels should work with keyboards and assistive technology; color should not be the only status cue; upload/camera flows need permission and error recovery. Low-bandwidth experiences should defer large assets and communicate when an external service is unavailable.

These are evaluation criteria, not a claim of formal accessibility certification.

<!-- PAGE BREAK -->

## Page 29 — Testing, deployment, and project limitations

The server suite uses Vitest and Supertest and can use an in-memory MongoDB server for isolated persistence scenarios. Existing tests cover authentication, authorization, registration, appointment workflows, screening, AI routes, audit immutability, backup/restore, and sync. A release workflow should also compile both TypeScript applications, run focused regression tests, verify allowed and denied facility access, replay offline mutations, check protected file access, build client/server artefacts, and scan for secrets.

The npm workspace contains `client` and `server`. The client compiles to `client/dist`; the server compiles from `server/src` to `server/dist`. MongoDB must use a replica set for transaction-dependent flows. The optional Python AI service is deployed separately. Vite’s local API proxy does not automatically configure production routing; hosted API origin and CORS must be configured deliberately.

Limitations include demo-only data and models, no clinical validation, mocked identity verification, simulated SMS, optional/provider-dependent video, and cloud/database configuration requirements. Software tests verify software behavior under tested conditions; they do not prove health impact or clinical efficacy.

See the Project Guide for deployment settings and operational checks.

<!-- PAGE BREAK -->

## Page 30 — Conclusion, glossary, and references

Aarogya-Drishti demonstrates how patient, frontline, clinician, and facility workflows can be organized in one web application with offline-oriented data capture, modular APIs, and explicit privacy and safety boundaries. Its project value is the integration of workflow concepts: linked records, access checks, human review, synchronization, and transparent feature status.

The system remains a simulation. Its most important engineering requirement is to preserve that boundary while improving reliability, privacy, and usability. Any move toward operational deployment requires clinical governance, security review, operational ownership, model validation, and approved integrations.

**Glossary:** ASHA/ANM — frontline community health worker roles; API — application programming interface; DEMO AI — unvalidated screening-support behavior in this project; idempotency — replaying a request does not create a duplicate effect; PWA — progressive web application; RBAC — role-based access control; scope — facility/catchment and relationship constraints applied to a record request.

**Repository references:** `AGENTS.md`; `docs/ARCHITECTURE.md`; `docs/API_DOCUMENTATION.md`; `docs/DATABASE_SCHEMA.md`; `docs/CLINICAL_SAFETY.md`; `docs/KNOWN_LIMITATIONS.md`; `server/src/app.ts`; `server/src/modules/`; `client/src/App.tsx`; `client/src/db/aarogyaDb.ts`; `ai_service/`; `ml_training/`.

This report is a source-informed project description. The operational setup and usage document is [PROJECT_GUIDE.md](PROJECT_GUIDE.md).
