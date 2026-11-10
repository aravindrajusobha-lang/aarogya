# Aarogya Drishti - Phase 4: Patients & Sync Report

**Platform:** Aarogya Drishti  
**Context:** AAROHAN Inter-Centre Hackathon 2026 (ITDA Paderu Tribal Agency)  
**Status:** [COMPLETED & VERIFIED]  
**Phase:** Phase 4 (Patients & Sync)  
**Date:** 2026-10-31  

---

## 1. Executive Summary & Verification Evidence

All clinical intake, duplicate review, and encrypted synchronization requirements for **Phase 4: Patients and Sync** have been engineered, integrated into both backend services and client interfaces, and validated with automated tests.

The automated test suite executed **339 tests across 20 test suites with a 100% pass rate**:

```
 Test Files  20 passed (20)
      Tests  339 passed (339)
   Duration  47.02s
```

### Verified Test Suites Breakdown:
1. `tests/patientRegistrationAndDuplicates.test.ts` (7 tests) - OTP-free intake, tribal patient IDs, verbatim address preservation, `patient.registered` domain event emission & audit logging, duplicate scoring $\ge 75$, duplicate candidates flagged with review tickets, **duplicates never auto-merged**, idempotency replay deduplication (no second record created), manual review resolution, and health worker jurisdictional partitioning.
2. `tests/offlineSyncAndReplay.test.ts` (3 tests) - WebCrypto AES-GCM-256 real cryptographic strength validation, 100,000 PBKDF2-HMAC-SHA256 iterations, 96-bit unique IVs, 128-bit AEAD tamper detection, batch sync ingestion, and batch replay deduplication.
3. `tests/authorizationMatrix.test.ts` (249 tests) - Complete capability matrix testing for all 6 roles against all 43 registered Express endpoints, including `/api/v1/patients`, `/api/v1/patients/duplicates/review`, `/api/v1/patients/duplicates/:reviewId/resolve`, and `/api/v1/patients/sync`.
4. Prior Phase 1, 2, and 3 suites (80 tests) - Hospitals isolation, 72-hour copyable invitations, self-approval prevention, replica set transactions, append-only audit immutability, private file storage, TOTP MFA, WebAuthn biometrics, and wording safety.

---

## 2. Core Architectural Components Built

```
    ┌────────────────────────────────────────────────────────────────────────┐
    │                       Client-Side PWA (Offline)                        │
    │  - OTP-Free Intake Form                                                │
    │  - Verbatim Address Preservation (originalAddressText)                 │
    │  - Client Mutation ID (UUIDv4)                                         │
    │  - WebCrypto AES-GCM-256 Encrypted Offline Queue (Dexie IndexedDB)     │
    └───────────────────────────────────┬────────────────────────────────────┘
                                        │ (When online / Network restored)
                                        ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │                 POST /api/v1/patients/sync & /patients                 │
    ├────────────────────────────────────────────────────────────────────────┤
    │  1. Idempotency Check: SyncLedger.findOne({ clientMutationId })        │
    │     ├── [Found]  --> Return HTTP 200 (idempotentReplay: true)          │
    │     │                NO SECOND RECORD CREATED                          │
    │     └── [New]    --> Continue to Registration & Duplicate Scoring      │
    │                                                                        │
    │  2. Composite Duplicate Scoring Algorithm (Threshold: >= 75)          │
    │     ├── Phonetic Name Similarity (Jaro-Winkler)    [up to 35 pts]      │
    │     ├── Geographic Proximity (Census Village)      [up to 25 pts]      │
    │     ├── Demographic Fit (Gender + Age Band)        [up to 20 pts]      │
    │     └── Contact / Family Match (Phone / Relative)  [up to 20 pts]      │
    │                                                                        │
    │  3. Invariant: DUPLICATES ARE NEVER AUTO-MERGED!                       │
    │     └── Flagged with duplicateReviewStatus: 'pending_review'           │
    │     └── Creates DuplicateReview audit ticket                           │
    │     └── Both records remain independent documents                      │
    │                                                                        │
    │  4. Emit patient.registered domain event & append to immutable AuditLog│
    └────────────────────────────────────────────────────────────────────────┘
```

### 2.1 OTP-Free Patient Registration
- **Zero-Connectivity Grounding:** In deep forest agency zones across ITDA Paderu (e.g., Dumbriguda, Hukumpeta, Araku Valley), cellular reception is virtually non-existent, rendering SMS/WhatsApp OTP workflows dysfunctional. Patient intake is intentionally **OTP-free**.
- **Human-Readable Tribal Patient ID:** Automatically assigned format: `PAD-<YEAR>-<6-CHAR-HEX>` (e.g. `PAD-2026-87B0F9`).
- **Verbatim Address Preservation:** The schema strictly mandates and preserves `originalAddressText` without trimming dialectal references, local landmarks, or hamlet directions (e.g., *"Near Old Borewell, Vankachinta Upper Habitation, Paderu Mandal"*).

### 2.2 Approved Composite Duplicate-Detection Algorithm
- **Scoring Engine:** [duplicateDetector.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/patient/duplicateDetector.ts).
- **Mathematical Weights:**
  $$\text{Score} = S_{\text{name}} (35) + S_{\text{geo}} (25) + S_{\text{demo}} (20) + S_{\text{family}} (20)$$
  1. **Name Similarity ($S_{\text{name}} \le 35$):** Normalized Jaro-Winkler similarity. Score $\ge 0.95 \implies 35\text{ pts}$; $\ge 0.85 \implies 25\text{ pts}$; $\ge 0.75 \implies 15\text{ pts}$.
  2. **Geographic Proximity ($S_{\text{geo}} \le 25$):** Exact census `villageId` match $= 25\text{ pts}$; same `mandal` $= 15\text{ pts}$.
  3. **Demographics ($S_{\text{demo}} \le 20$):** Exact gender match is required. Age difference $\le 2\text{ years} = 20\text{ pts}$; $\le 5\text{ years} = 10\text{ pts}$.
  4. **Contact / Family Match ($S_{\text{family}} \le 20$):** Matching shared phone number $= 20\text{ pts}$; guardian/spouse name similarity $\ge 0.85 = 15\text{ pts}$.
- **Decision Invariant:**
  - Candidates scoring $\ge 75$ are flagged with `isDuplicateCandidate: true` and `duplicateReviewStatus: 'pending_review'`.
  - A `DuplicateReview` ticket is created with match reasons and score.
  - **CRITICAL INVARIANT:** **Duplicates are NEVER auto-merged**. Both documents exist as distinct records in the database. Merging requires explicit manual administrative authorization.

### 2.3 Idempotent Sync Foundation & Replay Deduplication
- **Sync Ledger:** [syncLedgerModel.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/patient/syncLedgerModel.ts) stores `clientMutationId`, `entityId`, `responsePayload`, and `processedAt`.
- **Replay Protection:** When a client retries or an offline queue re-transmits a payload with an existing `clientMutationId`, the server:
  1. Identifies the existing ledger entry.
  2. Returns HTTP 200 with `idempotentReplay: true` and the existing patient document.
  3. **Creates NO second record** (verified by collection document count assertions in tests).

### 2.4 Cryptographic Strength of the Offline Queue
The client-side offline queue ([cryptoQueue.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/client/src/offline/cryptoQueue.ts)) provides authenticated encryption for all data-at-rest stored in browser IndexedDB (Dexie):

| Parameter | Specification | Real Cryptographic Strength |
|---|---|---|
| **Cipher Algorithm** | `AES-GCM` (Galois/Counter Mode) | **256-bit symmetric security** ($2^{256}$ work factor) |
| **Key Derivation Function** | `PBKDF2-HMAC-SHA256` | **100,000 iterations** (OWASP WebCrypto standard) |
| **Derivation Salt** | `crypto.getRandomValues(16)` | **128-bit unique random salt** per device/session |
| **Initialization Vector (IV)** | `crypto.getRandomValues(12)` | **96-bit unique random nonce** per queued record (Zero IV reuse) |
| **Integrity & Authenticity** | Galois Hash Authentication Tag | **128-bit AEAD tag** (Tampering with ciphertext throws authentication verification error) |
| **Storage at Rest** | Dexie IndexedDB (`encryptedQueue`) | Zero plaintext demographics; only ciphertext, IV, and salt are stored. |

### 2.5 Domain Event Emission: `patient.registered`
- [patientEvents.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/patient/patientEvents.ts) emits `patient.registered` upon patient registration.
- Subscribed handler writes an immutable, append-only record to `AuditLog` (`action: 'PATIENT_REGISTERED'`, `resourceType: 'patient'`, `resourceId: patientId`, `statusCode: 201`).
- Village groups constraint: **No village groups were created** in compliance with prompt rules.

---

## 3. Client UI Module: PatientManager.tsx

[PatientManager.tsx](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/client/src/components/PatientManager.tsx) has been integrated into the main application navigation with four operational sub-tabs:

1. **Intake Tab (OTP-Free):** Intake form capturing patient demographics, guardian info, census village, and verbatim address text. Features "Submit Online" and "Save to Encrypted Offline Queue" buttons.
2. **Patient Registry Tab:** Searchable registry displaying patient IDs, demographics, verbatim addresses, and duplicate badges.
3. **Duplicate Review Queue Tab:** Interactive side-by-side comparison of candidate records with match score badges and match reason chips. Administrators can resolve reviews as *"Confirm Distinct Individuals"* or *"Authorized Manual Merge"*.
4. **Encrypted Offline Queue Monitor:** Real-time visibility into the local Dexie `encryptedQueue` showing AES-GCM-256 ciphertext snippets, IVs, salts, retry counts, and the *"Sync Queue to Cloud"* action.

---

## 4. Test Verification Summary

| Test Case | Test File | Result |
|---|---|---|
| OTP-free patient intake assigns unique `PAD-YYYY-XXXXX` format | `patientRegistrationAndDuplicates.test.ts` | **PASS** |
| `originalAddressText` is preserved verbatim | `patientRegistrationAndDuplicates.test.ts` | **PASS** |
| Emits `patient.registered` event & writes immutable audit record | `patientRegistrationAndDuplicates.test.ts` | **PASS** |
| Candidates with composite score $\ge 75$ flagged as duplicates | `patientRegistrationAndDuplicates.test.ts` | **PASS** |
| **Duplicates are NEVER auto-merged**; both documents exist independently | `patientRegistrationAndDuplicates.test.ts` | **PASS** |
| Replayed request with identical `clientMutationId` creates **no second record** | `patientRegistrationAndDuplicates.test.ts` | **PASS** |
| Admin resolves duplicate ticket (`resolved_distinct` / `resolved_merged`) | `patientRegistrationAndDuplicates.test.ts` | **PASS** |
| Health worker sees ONLY assigned villages; unassigned worker sees 0 | `patientRegistrationAndDuplicates.test.ts` | **PASS** |
| Queue encryption strength (AES-GCM-256, 100k PBKDF2, 96-bit IV, 128-bit AEAD) | `offlineSyncAndReplay.test.ts` | **PASS** |
| Ciphertext tampering detected and rejected by AEAD tag | `offlineSyncAndReplay.test.ts` | **PASS** |
| Batch offline sync ingests records and syncs once | `offlineSyncAndReplay.test.ts` | **PASS** |
| Replayed batch sync creates **no second record** | `offlineSyncAndReplay.test.ts` | **PASS** |
| All 6 roles tested against all routes (CI Gate) | `authorizationMatrix.test.ts` | **PASS** (249/249) |
| **Total Test Suite** | **20 Test Files** | **PASS (339/339)** |
