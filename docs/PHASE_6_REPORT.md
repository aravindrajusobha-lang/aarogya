# Aarogya Drishti — Phase 6: Account Recovery Implementation Report

**Author**: Senior Full-Stack Health-Tech Engineer  
**Status**: Completed & Verified  
**Date**: 2026-10-31  
**Specification Reference**: Technical Specification v0.2 ("Account Recovery" Section)  
**Security Standard**: Three-Party Role Separation, Enumeration Resistance & No Reset Shortcut Invariant

---

## 1. Executive Summary

Phase 6 implements the **Verified Account Recovery Flow** for the **Aarogya Drishti** tele-screening platform as defined in Technical Specification v0.2. Generic self-service password reset mechanisms (such as unauthenticated emailed links or SMS OTP shortcuts) represent critical identity vulnerability vectors in rural healthcare settings. 

Instead, Aarogya Drishti mandates a **Three-Party Verified Recovery Protocol** requiring three distinct individuals holding non-overlapping roles, combined with demographic matching against existing patient records and **timing-attack / enumeration-resistant** identical responses.

### Core Security & Architectural Invariants Enforced:
1. **Three-Party Role Separation**: The **Requester** (Person 1), **Verifier** (Person 2), and **Approver** (Person 3) must be three different people.
   - `requesterId !== verifierId`
   - `requesterId !== approverId`
   - `verifierId !== approverId`
   - Any attempt by one individual to hold two or more roles is blocked (`403 Forbidden`).
2. **Patient Record Matching**: Recovery claims are evaluated against the active `Patient` registry using composite demographic comparison and identifier lookup.
3. **Enumeration-Resistant Identical Responses**: Submitting a recovery intake returns byte-identical HTTP status (`201 Created`), structure, and user-facing messages regardless of whether the claimant's record exists or is unknown.
4. **No Password Reset Shortcut**: Generic `/api/v1/auth/forgot-password` and `/api/v1/auth/reset-password` endpoints do not exist (`404 Not Found`). Approval cannot bypass frontline verification (`400 Bad Request`).
5. **Single-Use Cryptographic Claim Token**: Once approved by the three distinct parties, a high-entropy single-use token (`REC-CLAIM-...`) is generated, stored hashed at rest (`SHA-256`), and invalidated upon redemption.

---

## 2. Three-Party Verified Protocol Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Requester as Person 1 (Requester)
    actor Verifier as Person 2 (Verifier - ANM / MO)
    actor Approver as Person 3 (Approver - Admin / MO)
    participant API as Recovery Engine
    participant DB as MongoDB Registry

    Requester->>API: POST /api/v1/recovery/initiate (Claimed Demographics)
    API->>DB: Match against Patient Registry
    Note over API,DB: Unknown & Known records return IDENTICAL 201 Created
    API-->>Requester: 201 Created (REC-YYYYMMDD-XXXX, status: pending_verification)

    Note over Verifier: Verifier != Requester Check
    Verifier->>API: POST /api/v1/recovery/tickets/:id/verify
    alt Verifier == Requester
        API-->>Verifier: 403 Forbidden (SELF_VERIFICATION_BLOCKED)
    else Verifier != Requester
        API->>DB: Update status to 'verified' + Audit Log
        API-->>Verifier: 200 OK (Claimant identity verified)
    end

    Note over Approver: Approver != Requester && Approver != Verifier Check
    Approver->>API: POST /api/v1/recovery/tickets/:id/approve
    alt Approver == Requester
        API-->>Approver: 403 Forbidden (SELF_APPROVAL_BLOCKED)
    else Approver == Verifier
        API-->>Approver: 403 Forbidden (DUAL_ROLE_APPROVAL_BLOCKED)
    else Ticket Not Verified
        API-->>Approver: 400 Bad Request (UNVERIFIED_APPROVAL_ATTEMPT)
    else Unknown Record (No DB Match)
        API->>DB: Transition to 'rejected' (Audit Confirmed)
        API-->>Approver: 200 OK (Rejected during multi-party audit)
    else 3 Distinct Parties Validated
        API->>DB: Generate Single-Use Token (SHA-256 Hashed) + Audit Log
        API-->>Approver: 200 OK (Issued REC-CLAIM-...)
    end

    Requester->>API: POST /api/v1/recovery/complete (Ticket ID + Recovery Token)
    API->>DB: Invalidate Token + Set status 'completed'
    API-->>Requester: 200 OK (Access Restored)
```

---

## 3. Implementation Details

### 3.1 Data Model ([recoveryModel.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/recovery/recoveryModel.ts))
Schema tracks the complete three-party lifecycle:
- `ticketId`: String (unique index, e.g. `REC-1793458865567-E835FAFF`)
- `targetPatientId`: String (optional claimed patient ID)
- `claimedDemographics`: Sub-document containing `fullName`, `gender`, `ageEstimated`, `villageId`, `villageName`, `guardianName`, `phone`, `originalAddressText`
- `matchedPatientId`: String | null (internally resolved patient ID, never leaked on initiation)
- `matchScore`: Number (0–100)
- `status`: `'pending_verification' | 'verified' | 'rejected' | 'approved' | 'completed'`
- **Role 1 (Requester)**: `requesterId`, `requesterRole`, `requestedAt`
- **Role 2 (Verifier)**: `verifierId`, `verifierRole`, `verifiedAt`, `verificationNotes`, `verificationEvidence`
- **Role 3 (Approver)**: `approverId`, `approverRole`, `approvedAt`, `approvalNotes`, `rejectionReason`
- **Credential Token**: `recoveryTokenHash` (SHA-256), `recoveryTokenExpiresAt`, `completedAt`

---

### 3.2 Service Layer ([recoveryService.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/recovery/recoveryService.ts))

#### 1. Enumeration-Resistant Initiation
```typescript
static async initiateRecovery(input: InitiateRecoveryInput): Promise<InitiateRecoveryResponse> {
  // 1. Matches against existing patient record internally
  // ...
  // 2. Returns identical response whether match was found or null:
  return {
    ticketId,
    status: 'pending_verification',
    message: 'Account recovery ticket initiated. Three-party identity verification required before credentials can be reissued.',
    notice: 'Verification must be completed by an independent healthcare worker, followed by designated administrative approval.',
    simulation: true,
  };
}
```

#### 2. Self-Verification Block
```typescript
if (verifier.id === ticket.requesterId) {
  const err = new Error('Self-verification blocked. Verifier must be a different person than the requester.');
  (err as any).statusCode = 403;
  (err as any).code = 'SELF_VERIFICATION_BLOCKED';
  throw err;
}
```

#### 3. Self-Approval & Dual-Role Approval Block
```typescript
if (approver.id === ticket.requesterId) {
  const err = new Error('Self-approval blocked. Approver must be a different person than the requester.');
  (err as any).statusCode = 403;
  (err as any).code = 'SELF_APPROVAL_BLOCKED';
  throw err;
}
if (approver.id === ticket.verifierId) {
  const err = new Error('Dual-role approval blocked. Approver must be a different person than the verifier.');
  (err as any).statusCode = 403;
  (err as any).code = 'DUAL_ROLE_APPROVAL_BLOCKED';
  throw err;
}
```

---

### 3.3 Express Routes & Capabilities Registry ([recoveryRoutes.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/recovery/recoveryRoutes.ts))

Mounted at `/api/v1/recovery`:

| Method | Endpoint | Capability | Security Guard |
| :--- | :--- | :--- | :--- |
| `POST` | `/initiate` | `recovery:initiate` | Enumeration-resistant; identical response for known/unknown records |
| `GET` | `/tickets` | `recovery:read` | Paginated ticket listing |
| `GET` | `/tickets/:id` | `recovery:read` | Detailed ticket lookup (token hashes redacted) |
| `POST` | `/tickets/:id/verify` | `recovery:verify` | Enforces `verifierId !== requesterId` (blocks self-verification) |
| `POST` | `/tickets/:id/approve` | `recovery:approve` | Enforces `approverId !== requesterId && approverId !== verifierId` |
| `POST` | `/complete` | `recovery:complete` | Single-use token redemption; hash verified and invalidated |

---

### 3.4 Client UI Component ([AccountRecoveryManager.tsx](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/client/src/components/AccountRecoveryManager.tsx))

Integrated into `client/src/App.tsx`, providing:
1. **Claimant Demographic Intake Form**: Submit recovery request with demographic profile fields.
2. **Three-Party Role Ledger**: Visual representation of the three distinct actors per ticket (Requester, Verifier, Approver) with live status badges.
3. **Frontline Verification & Administrative Approval Modals**: Contextual action forms that dynamically disable self-actions based on active user session.
4. **Token Redemption Form**: Allows claimant or staff to finalize account recovery and restore account access.

---

## 4. Verification & Test Suite Results

The comprehensive test suite [accountRecovery.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/accountRecovery.test.ts) validates every constraint specified in the user request:

### 1. Role Pairings & Solo-Role Holding
- **All Three Distinct**: Person A initiates, Person B verifies, Person C approves -> **Passes (`200 OK`, token issued)**.
- **Pairing 1 (Requester == Verifier)**: Person A attempts to verify own ticket -> **Rejected with `403 Forbidden` (`SELF_VERIFICATION_BLOCKED`)**.
- **Pairing 2 (Requester == Approver)**: Person A attempts to approve own ticket -> **Rejected with `403 Forbidden` (`SELF_APPROVAL_BLOCKED`)**.
- **Pairing 3 (Verifier == Approver)**: Person B verifies and attempts to approve -> **Rejected with `403 Forbidden` (`DUAL_ROLE_APPROVAL_BLOCKED`)**.
- **One Person Holding All 3 Roles**: Person A initiates, is blocked from verifying (`403`), blocked from bypassing verification (`400`), and even if verified by third party, blocked from approving (`403`).

### 2. Identical Responses for Known and Unknown Records
- Submitting for registered patient `PAD-2026-77701` vs unregistered fictional claimant:
  - Both return **`201 Created`**.
  - Response keys match identically: `['message', 'notice', 'simulation', 'status', 'ticketId']`.
  - Message text and structure are identical.
  - Multi-party audit on unknown ticket safely transitions to `'rejected'` without leaking existence.

### 3. No Password Reset Shortcut
- `POST /api/v1/auth/forgot-password` returns **`404 Not Found`**.
- `POST /api/v1/auth/reset-password` returns **`404 Not Found`**.
- Attempting to approve an unverified ticket returns **`400 Bad Request`** (`UNVERIFIED_APPROVAL_ATTEMPT`).

### Full Test Suite Execution Summary
- **Test Files**: 22 passed (22)
- **Tests**: **452 passed (452)**
- **Wording Safety**: 0 clinical or diagnostic claims across entire server codebase.
- **i18n Parity**: 100% dictionary match across English, Telugu, and Hindi.
- **Client Build**: `tsc && vite build` bundled in 780ms with 0 errors.
