# 🤖 AGENTS.md: Developer & AI Agent Charter

> **Platform:** Aarogya-Drishti (ఆరోగ్య దృష్టి / आरोग्य दृष्टि)  
> **Deployment Context:** ITDA Paderu Tribal Health Initiative — Alluri Sitharama Raju District  
> **Version:** 1.0.0 (Phase 20 Final Handover)  
> **Target:** Future Software Engineers and Autonomous AI Coding Agents

---

## 1. Prime Directive & Platform Identity

Aarogya-Drishti is a community-based oral mucosal screening and healthcare navigation platform engineered for remote tribal settlements across the Eastern Ghats. Frontline health workers (ASHA and ANM staff) operate in mountainous, disconnected terrain with poor cellular coverage. 

**ALL CODE WRITTEN FOR THIS PLATFORM MUST PRESERVE ITS CORE INVARIANTS WITHOUT EXCEPTION.**

---

## 2. The Seven Non-Negotiable Architectural Invariants

### Invariant 1: Clinical Non-Diagnosis & Safety Wording
- **The system NEVER diagnoses, stages diseases, or recommends curative therapies.**
- Any automated triaging score is labelled strictly as `DEMO AI` screening support.
- All outbound messages, notifications, templates, and UI components are subject to the **Prohibited Terms Scanner**.
- **Forbidden Terms:** `cancer`, `malignant`, `carcinoma`, `curative`, `stage [0-9IV]`, `diagnostic confirmation`.
- AI analysis results and clinician assessments are stored in **separate documents**. An automated system must NEVER overwrite a human clinician's assessment.

### Invariant 2: Mandatory Simulation & Mock Demarcations
- The non-dismissible top banner must display: `⚠️ SIMULATION SYSTEM — DEMO DATA ONLY — NOT FOR CLINICAL USE`.
- **Aadhaar Verification:** Must be marked `mock: true` in the API and labeled `MOCK` on every screen. Live UIDAI integration is `BLOCKED`.
- **Teleconsultation Adapters:** Video and voice streaming return status `BLOCKED` until real hardware adapters exist. Fake or mock video call screens are strictly prohibited. Text case discussion between verified clinical staff is functional.
- **SMS / Telephony:** Native cellular SMS is `BLOCKED`; simulated in-memory dispatcher records messages for testing.

### Invariant 3: Small-Count Cell Suppression ($< 5$)
- In all aggregated reports, dashboards, GIS map layers, and export files (CSV, PDF, GeoJSON), any cell or habitation aggregate where $1 \le \text{count} < 5$ MUST be suppressed to `< 5` or `[SUPPRESSED]`.
- Empty habitations must return clean empty states (`count: 0`), never error codes.
- Multi-dimensional filter combinations that could isolate a single individual are strictly suppressed.

### Invariant 4: Frontline Offline Reliability & Idempotent Sync
- Frontline registration and screening workflows MUST function offline in IndexedDB.
- Every client mutation must include a unique `mutationId` (UUID v4).
- The backend checks `sync_ledgers` before executing business logic. Replays of identical mutations return the cached status code and payload without creating duplicates.

### Invariant 5: Aadhaar-Minimized Patient Data
- All seed data consists of synthetic demo personas. Real Aadhaar card processing is limited to the consented patient self-registration flow.
- Aadhaar QR decoding and OCR MUST run in the browser. Card images, QR payloads, and full 12-digit Aadhaar numbers MUST NEVER be transmitted, persisted, or logged. Full Aadhaar digits may exist only transiently in browser memory for local Verhoeff validation, then MUST be cleared after registration or tab exit.
- With explicit consent, only the registration profile fields `name`, `yearOfBirth`, `gender`, `address`, `village`, `mandal`, `pincode`, and optional contact `mobile` may be transmitted and stored for the patient account. Aadhaar suffixes and Aadhaar-derived hashes are not sent or stored. Returning patients may use the existing Mobile OTP login; registration itself never requires OTP.
- Offline registration payloads, when queued, MUST use the existing encrypted IndexedDB queue and MUST exclude Aadhaar digits and card images.
- Verbatim address landmarks (e.g. "Near Old Mango Tree, Dumbriguda") must be preserved unmutated to respect tribal geography.

### Invariant 6: Cryptographic Immutability of Clinical Artefacts
- Clinical notes, screening photos, and lab attachments are cryptographically hashed using SHA-256 upon creation.
- An original record is **never overwritten**. Amendments produce a version increment ($v_1 \to v_2$) while preserving the previous byte-identical record in history.

### Invariant 7: Zero Public Storage & Cross-Hospital Scoping
- No patient upload directory may be exposed statically. File downloads (`/api/v1/storage/files/:id`) must require JWT authentication and scope checks.
- Non-system-admin staff cannot view, edit, or search patient records outside their assigned hospital facility or catchment mandals (Cross-Hospital Denial).

---

## 3. Engineering Conventions & Patterns

### 3.1 Backend (Node.js 20 ESM & Express)
- **Module Imports:** Use native ES Modules (`import/export`) and always specify the `.js` extension (e.g. `import { User } from './userModel.js';`).
- **Standard Envelope:** Always wrap API responses using `res.envelope(data, message)` or `res.envelopeError(code, message, details, statusCode)`.
- **Central RBAC:** Guard every mutation with `requireAuth` and `authorizeCapability('capability:name')`.
- **Validation:** Validate all input params, query parameters, and request bodies using Zod schemas via `validate({ body: Schema, query: Schema, params: Schema })`.
- **Logging:** Use the central Pino logger (`logger.info`, `logger.error`). Never use `console.log`. The Pino pipeline automatically redacts PII and secrets.
- **Transactions:** Use MongoDB multi-document transactions (`await session.withTransaction(...)`) for multi-entity mutations.

### 3.2 Frontend (React 18 & Vite PWA)
- **Design System:** Vanilla CSS design tokens with responsive, mobile-first layouts. No TailwindCSS.
- **Multilingual Support:** All UI text must reference i18n keys across English (`en`), Telugu (`te`), and Hindi (`hi`).
- **Offline Storage:** Use Dexie.js for IndexedDB offline persistence.
- **Simulations Labels:** Never omit or style out the top simulation banner.

---

## 4. Testing & Verification Commandments

1. **Test Before Claiming Pass:** Every bug fix, feature addition, or refactor must be backed by unit, regression, or integration tests in `server/tests/`.
2. **Run Smoke Tests:** Always execute `npx vitest run tests/smokeTestAllModules.test.ts` to ensure zero regressions across the 24 modules.
3. **Verify Disaster Recovery:** Always execute `npx vitest run tests/backupAndRestore.test.ts` when altering database models or persistence logic.
4. **Run Secret Scanner:** Always verify `npx vitest run tests/secretScanner.test.ts` passes before committing code.
5. **Preserve Documentation Integrity:** When endpoints or schemas change, update `docs/API_DOCUMENTATION.md`, `docs/DATABASE_SCHEMA.md`, and `docs/TRACEABILITY_MATRIX.md`.
