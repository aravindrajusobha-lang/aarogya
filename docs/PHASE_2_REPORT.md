# Aarogya Drishti - Phase 2: Identity & Access Report

**Platform:** Aarogya Drishti  
**Context:** AAROHAN Inter-Centre Hackathon 2026 (ITDA Paderu Tribal Agency)  
**Status:** [COMPLETED & VERIFIED]  
**Phase:** Phase 2 (Identity & Access)  
**Date:** 2026-10-31  

---

## 1. Executive Summary & Verification Evidence

All functional and security guardrails for **Phase 2: Identity and Access** have been engineered, integrated, and verified.
The automated test suite executed **180 tests across 14 test suites with a 100% pass rate**.

```
 Test Files  14 passed (14)
      Tests  180 passed (180)
```

---

## 2. Core Components Built & Enforced

### 2.1 Staff & Patient Login Architecture
- **Password Security:** Multi-pass **Argon2id** hashing with memory hardness ($2^{16} = 64\text{ MB}$, time cost $3$, parallelism $1$).
- **Separate System Admin Role:** Explicit `system_admin` role possessing universal capability access (`*`) alongside `admin`, `medical_officer`, `anm`, `asha`, and `patient`.
- **Phase 6 Rule Compliance:** **NO** forgot-password or reset-password endpoints were implemented or exposed; recovery is strictly reserved for Phase 6. All attempts to invoke `/api/v1/auth/forgot-password` or `/api/v1/auth/reset-password` return `404 Not Found`.
- **Lockout & Exponential Backoff:**
  - Failed login attempts trigger progressive delays:
    $$\text{Delay}(n) = \min(1000 \times 2^{n - 2}, 30000)\text{ ms for } n \ge 2$$
  - Exceeding 5 consecutive failed attempts immediately triggers account lockout (`423 ACCOUNT_LOCKED`) with a 15-minute lock expiration.
  - Successful authentication clears failed attempt counts and resets lockout metadata.

### 2.2 TOTP Multi-Factor Authentication
- Powered by `otplib` with $\pm 1$ window tolerance (30-second clock-drift compensation).
- Setup (`POST /api/v1/auth/mfa/setup`) generates cryptographically secure base32 secrets and standard `otpauth://totp/` URIs.
- Enable (`POST /api/v1/auth/mfa/enable`) requires initial 6-digit verification code confirmation.
- 2-Step Login Challenge: If user has `mfaEnabled: true`, step 1 returns temporary, unprivileged `mfaSessionToken` with `mfaRequired: true`. Step 2 (`POST /api/v1/auth/mfa/verify`) validates the TOTP code before granting access.

### 2.3 WebAuthn Biometrics (FIDO2)
- Built using `@simplewebauthn/server` for hardware-backed credentials (fingerprint, Face ID, USB keys).
- Registration: Generates challenge and verifies attestation response, storing base64 public keys and sign counters.
- Authentication: Generates assertion challenge and verifies user signature, updating sign counters to reject credential clones.

### 2.4 Device Session Management, Rotation & Reuse Detection
- **Token Rotation:** Every token refresh consumes the active refresh token and returns a new rotating pair.
- **Refresh-Reuse Detection:** The system persists `previousRefreshTokenHash`. If an already-rotated refresh token is presented again (replay attack or stolen credential), the engine detects reuse, **immediately revokes the entire device session**, logs a high-severity security audit event, and returns `401 REFRESH_TOKEN_REUSE_DETECTED`.
- **Revoked Device Rejected:** Active device sessions can be inspected (`GET /api/v1/auth/devices`) and revoked individually or collectively (`/revoke-others`). Any subsequent request or refresh attempt using a revoked session is rejected with `401 DEVICE_REVOKED`.

### 2.5 Central Authorization Engine (Live Database Delegations)
- **Capability Matrix:** Maps all 6 roles to granular capabilities (`screening:create`, `screening:review`, `telemedicine:consult`, `storage:upload`, `storage:read_clinical`, `consent:grant`, `delegation:create`, `audit:read`, etc.).
- **Live Database Delegated Permissions:** If a user's static role does not contain a requested capability, the engine queries the `Delegation` collection in MongoDB live:
  ```ts
  const activeDelegation = await Delegation.findOne({
    toUserId: user.id,
    capabilities: requiredCapability,
    status: 'active',
    validFrom: { $lte: now },
    validUntil: { $gte: now },
  });
  ```
  If an active delegation exists, access is granted live without redeploying code or modifying user role records. Once revoked or expired, access is instantly denied (`403 FORBIDDEN`).
- **CI Route Completeness Test:** Express router layers are inspected dynamically. CI asserts that 100% of registered routes are present in the capability matrix and tests all 6 roles against every endpoint.

### 2.6 Append-Only Immutable Audit Log
- **Immutability Enforcement:** The `AuditLog` Mongoose schema intercepts all query and document modification hooks:
  - `updateOne`, `updateMany`, `findOneAndUpdate`, `replaceOne`, `deleteOne`, `deleteMany`, `findOneAndDelete`, `findOneAndRemove`, `save`, and `deleteOne`.
  - All mutation or deletion attempts throw:
    `"AuditLog is append-only: updates and deletions are strictly prohibited"`.
  - Verified across 10 specialized immutability unit tests.

### 2.7 Patient Consent Service (DPDP Act 2023)
- Purpose-based informed consent tracking:
  - `screening_ai_analysis` (Intra-oral photo capture & AI risk triage)
  - `telemedicine_share` (Transmission to PHC Medical Officer)
  - `data_storage` (Longitudinal record retention)
- Captures notice language (Telugu, Hindi, English), witness verification, terms version, and revocation timestamps.
- Patient boundary enforcement: Patients can only inspect and revoke their own consent records.

---

## 3. Test Suites & Verification Matrix

| Test Suite File | Tests | Focus Area | Status |
| :--- | :---: | :--- | :---: |
| [authorizationMatrix.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/authorizationMatrix.test.ts) | 123 | Full matrix: 6 roles against all registered endpoints; CI route coverage | **PASSED** |
| [authSecurity.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/authSecurity.test.ts) | 8 | Argon2, lockout (5 attempts), backoff, token rotation, reuse detection, device revocation | **PASSED** |
| [auditImmutability.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/auditImmutability.test.ts) | 10 | Rejection of updates, deletes, and tampering; append-only creation | **PASSED** |
| [totpAndWebAuthn.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/totpAndWebAuthn.test.ts) | 6 | TOTP secret setup, 2-step verification, MFA disable, WebAuthn challenge flow | **PASSED** |
| [delegatedAuthorization.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/delegatedAuthorization.test.ts) | 5 | Live database checking of temporary capability delegations | **PASSED** |
| [consentService.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/consentService.test.ts) | 5 | DPDP consent granting, verification, patient boundaries, revocation | **PASSED** |
| [privateStorage.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/privateStorage.test.ts) | 5 | Private file access, scope validation, zero public URLs | **PASSED** |
| [replicaSet.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/replicaSet.test.ts) | 3 | MongoDB replica set status & multi-document ACID transactions | **PASSED** |
| [agendaLock.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/agendaLock.test.ts) | 2 | Atomic `lockedAt` locking & zero repeat execution on restarts | **PASSED** |
| [agendaInit.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/agendaInit.test.ts) | 2 | Agenda lifecycle & i18n translation helpers | **PASSED** |
| [envelope.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/envelope.test.ts) | 4 | Response envelope structure & request ID tracing | **PASSED** |
| [wordingSafety.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/wordingSafety.test.ts) | 2 | Simulation disclaimers & non-diagnostic wording | **PASSED** |
| [i18nParity.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/i18nParity.test.ts) | 4 | Locale key parity across EN, TE, HI | **PASSED** |
| [logRedaction.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/logRedaction.test.ts) | 1 | Strict PII, token, and secret redaction in logs | **PASSED** |
| **Total** | **180** | **Complete Phase 1 + Phase 2 Test Suite** | **100% PASS** |
