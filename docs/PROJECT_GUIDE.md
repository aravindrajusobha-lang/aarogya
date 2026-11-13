# Aarogya-Drishti — Project Guide

**Companion to:** [Project Report](PROJECT_REPORT.md)  
**Last reviewed against source:** November 2026  
**Project version:** 0.2.0

> **Simulation notice:** This application uses demo data and is not intended for clinical use. Automated outputs are screening support only and require review by qualified professionals. Do not use the current software or model outputs for real patient-care decisions.

This guide is for developers, demo operators, and maintainers. It describes the repository, local manual setup without Docker, role-based workflows, environment configuration, model locations, deployment considerations, and common troubleshooting steps. The current source code, lockfiles, and schema definitions take precedence over older documentation.

The formal report is available as Markdown and as [an editable Word document](PROJECT_REPORT.docx). To regenerate the Word file after editing the report source, run `python scripts/build_project_report_docx.py` from the repository root.

## 1. At a glance

| Item | Value |
|---|---|
| Client | React 18 + TypeScript + Vite; development port 5173 |
| API | Node.js 20 + Express + TypeScript; default port 5000 |
| Database | MongoDB via Mongoose; replica-set topology required by transaction-based workflows |
| Optional AI service | FastAPI/PyTorch; default local port 8000 |
| Local client/API routing | Vite proxies `/api` and `/socket.io` to `http://localhost:5000` |
| Main code folders | `client/`, `server/src/`, `ai_service/`, `ml_training/`, `docs/` |
| Client output | `client/dist/` |
| API output | `server/dist/` |

## 2. Repository map

```text
client/
  src/App.tsx                 Hash route dispatch and portal composition
  src/portal/                 Patient, doctor, admin, public portal pages
  src/components/              Shared UI, screening, maps, assistant, forms
  src/services/                Client AI, identity parsing, scoring services
  src/db/aarogyaDb.ts          Dexie IndexedDB schema and offline stores
  src/offline/                 Encrypted queue and synchronization helpers
  public/models/               ONNX model artifacts and labels
  public/wasm/                 ONNX Runtime Web assets
server/src/
  app.ts                       Express middleware and route registration
  server.ts                    Database bootstrap and HTTP/Socket.IO server
  config/                      Database, scheduler, logger, scoring configuration
  middleware/                  Auth, validation, rate limiting, response envelope
  modules/                     Domain routes, services, schemas, and models
  tests/                       Vitest unit, integration, regression test files
ai_service/                    Optional Python FastAPI inference service
ml_training/                   Model training, preparation, export, metadata
docs/                          Architecture, API, schema, safety, operations, this guide
```

## 3. Main capabilities by role

### Patient

- Register and sign in using the patient-facing pages.
- Use the patient help assistant on the home, login, registration, and patient portal screens. It is hidden from administrative screens.
- View available patient records and released health information, including prescriptions where issued and released for that account.
- Review appointment and care-navigation information, messages, notifications, and reports exposed by the patient portal.
- Use supported local browser features; the availability of a server-dependent action requires a working API connection.

### Frontline worker

- Work with assigned facilities, villages, camps, and screening workflows.
- Capture screening information and supported attachments.
- Queue supported operations in local IndexedDB while offline, then synchronize when connectivity returns.
- See sync status and resolve supported conflict/retry states.

### Doctor / medical officer / specialist

- Review permitted patient records and patients associated with appointments or assigned care relationships.
- Manage availability, appointments, consultation records, follow-up, screening review, and prescriptions according to capabilities.
- Request a care transfer; the current treating clinician has to approve access according to the care-transfer workflow.
- Video consultation requires a real configured provider; an installed client SDK alone does not enable the service.

### System and facility administration

- Manage staff onboarding, facility records, permissions/configuration, and operational information.
- Facility operations include ward/bed capacity, medicines and stock movement, equipment, and staffing summary information.
- The patient-facing chatbot is deliberately not shown in admin/facility-admin pages.

These are feature areas, not a guarantee that every route is enabled for every role. The backend is authoritative for permissions.

## 4. Local setup — manual, no Docker

### Prerequisites

- Node.js 20 LTS and npm.
- MongoDB running locally as a replica set named `rs0` for transactions.
- Python 3.10+ only if the optional AI service is being run.
- Git and a modern Chromium/Firefox browser.

### Step 1: Install Node dependencies

From the repository root:

```powershell
npm ci
```

If workspace lockfiles have intentionally diverged, use the package manager workflow selected by the repository maintainers rather than mixing lockfiles.

### Step 2: Start MongoDB as a replica set

Create a local data directory, then start MongoDB with replica-set mode. Example command (adjust the path for your computer):

```powershell
mongod --replSet rs0 --dbpath C:\mongo-data\aarogya
```

In another terminal, initialize the set once:

```powershell
mongosh
rs.initiate()
rs.status()
```

Wait for a primary before starting the API. A standalone MongoDB instance may connect but transaction-dependent operations can fail with a “transaction numbers are only allowed on a replica set member” error.

### Step 3: Configure the backend

Copy `server/.env.example` to `server/.env`. Keep this file private and do not commit it. Set at least:

```dotenv
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/aarogya_drishti?replicaSet=rs0
JWT_SECRET=<unique-random-secret-at-least-32-characters>
SIMULATION_MODE=true
```

The database connector reads `MONGO_URI` or `MONGODB_URI`. Use one authoritative value. Replace any example/default secret with a unique generated value; never copy a production secret into source control. Additional optional variables include `GEMINI_API_KEY`, `AI_SERVICE_URL`, `DAILY_API_KEY`, `DAILY_DOMAIN`, `VIDEO_CONFIG_ENCRYPTION_KEY`, and storage provider configuration. Do not place server secrets in `client/.env` or variables prefixed `VITE_`.

### Step 4: Start the API

From the repository root:

```powershell
npm run dev:server
```

The server boot process connects to MongoDB, seeds configured demo/reference data, applies appointment/index maintenance, initializes background jobs, and listens on `PORT`. Check the terminal for database and listening status. The health endpoints include `/api/v1/health` and `/api/health`.

### Step 5: Start the web client

Open another terminal at the repository root:

```powershell
npm run dev:client
```

Open `http://localhost:5173`. Vite proxies `/api` and `/socket.io` requests to the local server at port 5000. This local proxy is for development only; it does not automatically configure a hosted site.

### Optional: Start the Python inference service

In a separate terminal:

```powershell
py -m venv .venv-ai
.\.venv-ai\Scripts\Activate.ps1
pip install -r ai_service/requirements.txt
py -m uvicorn ai_service.main:app --host 0.0.0.0 --port 8000
```

Set `AI_SERVICE_URL=http://127.0.0.1:8000` on the API process if needed. Check `http://localhost:8000/health`. Inference weights, environment variables, memory, and CPU can affect service startup and response time. The service is optional and its output remains demonstration-only.

## 5. Authentication and demo data

Staff and patient authentication use different routes and flows. Patient pages are under `#/patient/...`; staff sign-in is under `#/login`. The backend has seed/bootstrap logic in `server/src/modules/seed/` and `server/src/modules/auth/seedUsers.ts`. Use the current setup documentation or seed code to obtain demo-account credentials; do not assume credentials from an old screenshot or prior deployment remain valid.

For a demo, use synthetic records only. Check the role displayed after login and verify the expected portal. To clear a session, use the portal’s sign-out control. Patient data access must be checked using the patient account and authorized clinician account—not an administrator shortcut.

## 6. Where to find the models

### MongoDB/Mongoose application models

| Domain | Model names / source location |
|---|---|
| Authentication | `User`, `Otp`, `DeviceSession`, `Delegation` — `server/src/modules/auth/` |
| Doctor administration | `Counter` — `server/src/modules/doctorAdmin/doctorCodeService.ts` (allocates sequential doctor codes). |
| Patients | `Patient`, `DuplicateReview`, `SyncLedger`, patient `SupportTicket` — `server/src/modules/patient/` |
| Consent and audit | `Consent`, `AuditLog` — `consent/`, `audit/` |
| Geography and organization | `Hospital`, `Subcenter`, `Village`, `VillageGroup`, `HealthWorkerAssignment`, `Specialist`, `Invitation` — corresponding folders under `modules/` |
| Field activity | `Camp` — `server/src/modules/camp/` |
| Screening and review | `ScreeningCase`, `ScreeningPhoto`, `ClinicalAssessment`, `ResultRelease`, `AiScreening`, `Assessment` — `screening/`, `ai/`, `assessment/` |
| Attachments | `StoredFile` — `server/src/modules/storage/` |
| Appointments and consultations | `Appointment`, `DoctorSlot`, `VideoConsultation`, `Teleconsultation`, `DailyProviderConfig`, `ConsultationCapture`, `ConsultationChat`, `ConsultationNote`, `ConsultationMessage`, `PatientCare`, `CareTransfer` — `appointment/`, `consultation/`, `teleconsultation/` |
| Prescriptions and onward care | `Prescription`, `Referral`, `Biopsy`, `BiopsyFindings`, `BiopsyResultRelease`, `TreatmentPlan`, `TreatmentLog` — associated module folders |
| Facility operations | `FacilityWard`, `FacilityMedicine`, `FacilityStockMovement`, `FacilityEquipment` — `server/src/modules/facility/facilityOpsModels.ts` |
| Messaging and support | `Notification`, `NotificationPreferences`, shared `SupportTicket`, `AiChatMessage` — `notification/`, `support/`, `assistant/` |
| Recovery and map | `RecoveryTicket` — `recovery/`; `mapModel.ts` contains map-related structures/configuration and should be inspected for current schema exports. |

The table groups models for navigation. The TypeScript schema files define exact fields, indexes, enums, and collection behavior. Some names are embedded subdocuments or aliases rather than independent collections. Confirm the source before migrations. `SupportTicket` appears in separate patient/shared modules; inspect its registration and collection names before changing either implementation.

### Client-side/offline models

`client/src/db/aarogyaDb.ts` defines Dexie types and stores: `OfflineScreening`, `OfflineAiScreening`, `SyncQueueItem`, `CachedCamp`, and `EncryptedQueueItem`. These records live in browser IndexedDB and are not central MongoDB records until synchronization succeeds.

### AI models

- Module A: PyTorch/timm EfficientNet-B0 in `ai_service/model.py`; inference route `POST /predict`.
- Module B: EfficientNet-B0 multilabel pathway in `ai_service/dental_model.py`; route `POST /predict/dental`.
- Module C: rule-based questionnaire/scoring code, including `server/src/modules/ai/riskScore.ts` and related routes.
- Browser inference: ONNX Runtime Web client at `client/src/services/aiEngineService.ts`; model artifacts in `client/public/models/`.
- Training/export: `ml_training/`.

All AI outputs are demo screening support and require human review; they are not a clinical decision.

## 7. Important workflows to demonstrate

### Patient registration and login

1. Open the public home page.
2. Use the patient registration or patient login links (do not use staff sign-in for a patient account).
3. Confirm that the assistant is available on home, patient login, registration, and the patient portal.
4. Confirm that administrative portals do not show the patient assistant.

### Frontline screening and offline sync

1. Sign in as an authorized frontline demo user.
2. Select the assigned camp/geography and an appropriate synthetic patient.
3. Enter a screening record and attach demo media only where required.
4. Disconnect network access and create a supported offline mutation.
5. Restore connectivity and confirm sync status changes; replaying the same mutation must not create duplicates.

### Doctor review and prescription

1. Sign in with a clinician demo account.
2. Open a patient through an authorized relationship, facility scope, or booked appointment.
3. Review machine-generated information separately from human clinical notes.
4. Issue and save a prescription; verify it appears in the clinician’s record and in the correct patient account after release.
5. Confirm the patient download action uses a protected file/record endpoint.

### Care transfer

1. A requesting clinician selects a patient and submits a transfer request.
2. The currently treating clinician reviews the request.
3. Only after approval should the requester receive the agreed access scope.
4. Verify both approved and denied cases. A front-end success message alone is not proof that server scope changed correctly.

### Facility inventory

1. Open a facility within the manager’s authorized scope.
2. Review wards/beds, medicine stock and movements, equipment, and staff summaries.
3. Make a demo adjustment and verify the event/history and updated totals.

## 8. Manual Render deployment notes (no Docker)

Render settings change over time; consult Render’s current documentation while deploying. Render treats each monorepo service root as a filesystem boundary: files outside a configured root directory are not available to that service at build/runtime. Build and publish paths are relative to that root ([Render monorepo support](https://render.com/docs/monorepo-support), [first deploy guide](https://render.com/docs/your-first-deploy)).

### Backend Web Service

Create a Node Web Service linked to the repository and branch.

| Render field | Value for this repository |
|---|---|
| Root Directory | `server` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Runtime | Node |

The server start script runs `node dist/server.js`; the TypeScript build generates that file. Render supplies a port environment variable, and the server listens on `process.env.PORT`. Do not set the root directory to `server/src`. Configure environment variables in Render’s Environment page; do not check secrets into Git.

Set at minimum `NODE_ENV=production`, `MONGO_URI` (or `MONGODB_URI`) to the Atlas connection string, `JWT_SECRET` to a unique secret, and `CLIENT_ORIGIN` to the exact browser origin allowed to call the API. Keep simulation mode enabled for demo use. Optional AI, Gemini, Daily, and private-storage providers need their respective server-side settings. Atlas network access must permit the Render service’s outbound connection, and the database user should have only the required database privileges.

**Secret handling:** some authentication paths in the current source still contain fallback signing-secret values. An unset environment variable may therefore not fail closed. Always set a unique random `JWT_SECRET`. Before any non-demo deployment, remove development fallbacks and make the server fail startup if the secret is missing. Do not reuse an example secret or include real secret values in this guide.

After the deploy, check Render logs for database connection and server-listening messages, then visit `https://<backend-host>/api/v1/health`. A “no open ports” or process-exit symptom usually follows a failed startup or DB connection; review the first fatal error in logs before adjusting port settings.

### Frontend Static Site

For a Vite Static Site, the repo values are:

| Render field | Value |
|---|---|
| Root Directory | `client` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |

Vite writes to `dist` relative to the client root. A static site is served as built files and has no running Node process ([Render static site guide](https://render.com/tutorials/web-service-vs-static-site/static-sites)).

**Important current integration limitation:** the client calls relative paths such as `/api/v1/...`. The local Vite proxy sends those paths to port 5000 during development, but it does not exist in the published static build. A separate Render static-site hostname and API hostname will therefore require an implemented API base-URL setting across client requests, or a same-origin reverse proxy/web service that forwards `/api` and `/socket.io` to the backend. Do not assume that setting `CLIENT_ORIGIN` alone connects the static client to the API. Render static rewrites are for static-site paths; the static site itself does not run a proxy process ([Render static-site redirects/rewrites](https://render.com/docs/redirects-rewrites)).

Before demoing, verify the browser Network tab shows API requests going to the intended backend and that OPTIONS/CORS, cookies/tokens, Socket.IO, and HTTPS are correct. This integration should be addressed before treating separate frontend/backend services as a working deployment.

## 9. Environment variable reference

| Variable | Used for | Notes |
|---|---|---|
| `PORT` | API listener | Hosted platforms normally inject this. |
| `NODE_ENV` | Runtime mode | Use `production` on hosted service. |
| `CLIENT_ORIGIN` | CORS and consultation-link origin | Use the precise frontend origin; server parses comma-separated origins in parts of the code. |
| `MONGO_URI` / `MONGODB_URI` | MongoDB connection | Must point to a replica-set deployment for transaction workflows. |
| `JWT_SECRET` | Token signing/verification | Set a long, random, private value; rotate deliberately. |
| `SIMULATION_MODE` | Demo-mode behavior | Keep enabled for demo data. |
| `AI_SERVICE_URL` | Optional Python inference service | Defaults to local loopback. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Assistant/vision provider | Optional server-side secret; never expose in the client. |
| `DAILY_API_KEY`, `DAILY_DOMAIN` | Video provider | Optional; video remains unavailable without valid server configuration. |
| `VIDEO_CONFIG_ENCRYPTION_KEY` | Encrypt saved provider configuration | Keep persistent and private if admin-configured provider credentials are used. |
| Storage provider variables | Cloud/local private file storage | Select and configure one private storage approach; never publish patient uploads. |

There are multiple environment templates in the repository and some historical variable names differ. Confirm each variable’s consumer with `rg` before relying on it. Never paste secrets into issue reports, screenshots, or logs.

## 10. Troubleshooting

### MongoDB says transactions are only allowed on replica set

Start MongoDB using `--replSet rs0`, initialize with `rs.initiate()`, and wait for a primary. For Atlas, use a replica-set cluster connection string. A local standalone server cannot support transaction-dependent flows.

### Atlas reports no available servers / IP is not allowed

Check the URI, database username/password encoding, cluster status, DNS/network connectivity, and Atlas Network Access rules. Allow the hosting service’s current outbound addresses according to the host’s deployment guidance. Do not solve this by exposing database access broadly in a real environment.

### Render says `dist` is missing

For the static client, root should be `client`, build should run `npm ci && npm run build`, and publish directory should be `dist`. Do not use `server/src` or point a static client at the API TypeScript output.

### Frontend loads but APIs return 404 or CORS errors

The production client uses relative `/api/...` requests. Ensure same-origin proxying or implement and use a production API base URL across all API calls. Also set backend `CLIENT_ORIGIN` to the exact frontend origin and redeploy.

### Client TypeScript build fails due a missing package/type

Check the import, the correct workspace package manifest, and committed lockfile. Add runtime dependencies to `dependencies` and type-only packages to `devDependencies`, update the lockfile, then rebuild from the same package root Render uses.

### Video is unavailable

Check the provider configuration and server logs. Keep the API key server-side, confirm the domain format, and validate that the appointment and participants satisfy server-side authorization. Browser camera access requires HTTPS (except localhost) and user permission.

### Patient prescription is missing

Check patient ID linkage, issuer authorization, persistence success, patient read scope, release/visibility state, and response shape. Verify both doctor and patient API requests in the Network tab. Never work around a missing permission with unrestricted patient lookup.

## 11. Development and maintenance checklist

- Keep the simulation banner visible and ensure demo records remain synthetic.
- Validate input and authorization on the server, not only in React.
- Preserve facility/catchment checks for all patient-record lookup and file download paths.
- Keep automated outputs separate from clinician records and use versioned amendments.
- Assign a unique mutation ID to queued client mutations and test duplicate replay.
- Suppress aggregates with positive counts below five.
- Keep patient file bytes private and reachable only through scoped API routes.
- Update API/schema/traceability docs when endpoint or schema changes.
- Review role and denied-access cases for every new feature.
- Review translations in English, Telugu, Hindi, Tamil, Kannada, and Malayalam.
- Build and verify only the changed workflows plus required release checks for the project context.

## 12. Documentation index

- [Formal Project Report](PROJECT_REPORT.md) — problem statement, goals, architecture, features, models, technology, safeguards, limitations, and future work.
- [Architecture](ARCHITECTURE.md) — component topology and boundaries.
- [API documentation](API_DOCUMENTATION.md) — endpoint reference; verify against current route source.
- [Database schema](DATABASE_SCHEMA.md) — schema reference; verify against current model files.
- [Clinical safety](CLINICAL_SAFETY.md) — non-diagnostic and simulation boundaries.
- [Known limitations](KNOWN_LIMITATIONS.md) — blocked, mocked, and deferred behaviors.
- [Operations guide](OPERATIONS_GUIDE.md) — maintenance operations.
- [Patient portal route map](PATIENT_PORTAL_ROUTE_MAP.md) — patient-side route relationships.

## 13. Source of truth

For runtime behavior, inspect `client/src/App.tsx`, the relevant portal/component, `server/src/app.ts`, the matching route/service/model under `server/src/modules/`, and the package manifests. Older phase reports, screenshots, README deployment instructions, and external dashboards can describe previous configurations. Reconfirm actual repository settings before a deployment or data migration.
