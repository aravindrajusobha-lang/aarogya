# Aarogya Drishti - Phase 3: Administration Report

**Platform:** Aarogya Drishti  
**Context:** AAROHAN Inter-Centre Hackathon 2026 (ITDA Paderu Tribal Agency)  
**Status:** [COMPLETED & VERIFIED]  
**Phase:** Phase 3 (Administration)  
**Date:** 2026-10-31  

---

## 1. Executive Summary & Verification Evidence

All functional, organizational, and security guardrails specified for **Phase 3: Administration** have been engineered, integrated, and verified across both backend services and client interfaces.

The automated verification suite executed **293 tests across 18 test suites with a 100% pass rate**:

```
 Test Files  18 passed (18)
      Tests  293 passed (293)
   Start at  19:36:59
   Duration  41.19s
```

### Verified Test Suites Breakdown:
1. `tests/authorizationMatrix.test.ts` (213 tests) - Every role tested against every Express route; automated CI introspection confirms all endpoints mapped to capability table.
2. `tests/hospitalAdministration.test.ts` (5 tests) - Cross-hospital inspection and modification strictly denied with `403 CROSS_HOSPITAL_FORBIDDEN`.
3. `tests/invitationsAndSelfApproval.test.ts` (8 tests) - 72-hour token generation, copyable link, self-approval prevention (403), expired token rejection (410), reused token rejection (409).
4. `tests/healthWorkerAssignments.test.ts` (6 tests) - Clinical scope comes strictly from explicit active assignments; assigned worker sees only assigned villages; unassigned worker sees 0 villages.
5. `tests/specialistsDirectory.test.ts` (4 tests) - Referral directory queries, specialty filtering, and live teleconsultation availability toggling.
6. `tests/delegatedAuthorization.test.ts` (8 tests) - Live database checks for capability delegation and self-delegation prevention.
7. `tests/auditImmutability.test.ts` (10 tests) - Immutability of append-only audit records across all administrative actions.
8. Prior Phase 1 and Phase 2 test suites (39 tests) - Replica set multi-document transactions, private encrypted file storage, TOTP MFA, WebAuthn biometrics, lockout, and wording safety.

---

## 2. Architecture & Core Administrative Modules

```
                         ┌───────────────────────────────────────────────┐
                         │           ITDA Paderu Super Admin             │
                         │    (Full Tribal Agency Oversight Scope)       │
                         └───────────────────────┬───────────────────────┘
                                                 │
                  ┌──────────────────────────────┴──────────────────────────────┐
                  ▼                                                             ▼
     ┌────────────────────────┐                                   ┌────────────────────────┐
     │  District Hospital     │                                   │ Community Health Ctr   │
     │  (hosp_paderu_dh)      │                                   │ (hosp_chintapalli_chc) │
     └────────────┬───────────┘                                   └───────────┬────────────┘
                  │                                                           │
        CROSS-HOSPITAL BOUNDARY                                     CROSS-HOSPITAL BOUNDARY
        (Zero-Trust 403 Barrier)                                    (Zero-Trust 403 Barrier)
                  │                                                           │
                  ▼                                                           ▼
     ┌────────────────────────┐                                   ┌────────────────────────┐
     │ 72h Staff Invitations  │                                   │ Health Worker Scope    │
     │ - Link shown to admin  │                                   │ - Explicit assignments │
     │ - Delivery NOT claimed │                                   │ - Zero village leakage │
     │ - Self-approval block  │                                   │ - Village reference    │
     └────────────────────────┘                                   └────────────────────────┘
```

### 2.1 Hospitals & Cross-Hospital Isolation
- **Domain Schema:** `Hospital` model (`hospitalId`, `name`, `type`, `district`, `mandal`, `jurisdictionVillages`, `adminUserIds`, `status`).
- **Catchment Hierarchy:** Supports `district_hospital`, `area_hospital`, `community_health_centre`, `primary_health_centre`, and `sub_centre` within Alluri Sitharama Raju (ASR) district.
- **Cross-Hospital Access Control Guard:**
  - Non-super admins are strictly locked to their affiliated `hospitalId`.
  - When hospital staff or administrators attempt to read or mutate another facility's catchment data, the route layer immediately aborts with `403 CROSS_HOSPITAL_FORBIDDEN`.
  - Super admins retain agency-wide oversight across all mandals.

### 2.2 72-Hour Staff Invitations
- **Link Shown to Admin to Copy; Delivery Is Not Claimed:**
  - In alignment with remote tribal connectivity constraints and offline agency protocols, the onboarding workflow explicitly does **not** claim automated email or SMS delivery.
  - The API returns `deliveryNote: "Link shown to the admin to copy; delivery is not claimed."` along with the full onboarding link (`/invite/accept?token=<hex>`).
  - The frontend UI displays a copyable link container with a one-click clipboard button and 72-hour countdown badge.
- **Strict 72-Hour TTL:**
  - Generated using 256-bit cryptographic entropy (`crypto.randomBytes(32)`).
  - Explicitly expires after $72 \text{ hours}$ (`expiresAt = Date.now() + 72 * 3600 * 1000`).
  - Attempting to inspect or redeem an expired token returns `410 INVITATION_EXPIRED`.
- **Reused Token Rejection:**
  - Tokens are strictly single-use.
  - Upon redemption, `status` transitions to `'accepted'` and `acceptedAt` is recorded.
  - Replay attempts immediately return `409 INVITATION_ALREADY_USED`.

### 2.3 Self-Approval Blocked
Self-approval and conflict-of-interest escalations are systematically blocked across four operational vectors:
1. **Self-Invitation:** An administrator cannot issue an invitation to their own email, username, or userId (`403 SELF_APPROVAL_BLOCKED`).
2. **Self-Acceptance:** The creator of an invitation cannot accept or redeem their own invitation token (`403 SELF_APPROVAL_BLOCKED`).
3. **Self-Delegation:** Users cannot delegate permissions or assign roles to their own account (`403 SELF_APPROVAL_BLOCKED`).
4. **Self-Assignment:** Administrators cannot assign field village jurisdictions to themselves (`403 SELF_APPROVAL_BLOCKED`).

### 2.4 Specialists Directory & Clinical Referrals
- **Specialist Schema:** `Specialist` model (`specialistId`, `name`, `specialty`, `hospitalId`, `qualifications`, `teleconsultAvailable`, `contactPhone`, `email`, `languages`).
- **Clinical Subspecialties:** Supports `oral_oncology`, `maxillofacial_surgery`, `ent_head_neck`, `pathology`, `radiation_oncology`, and `general_dental`.
- **Teleconsultation Readiness:** Searchable and filterable by teleconsult status, enabling field medical officers to instantly identify available teleconsultants and dispatch digital referral cases.

### 2.5 Health Worker Assignments (Explicit Scope Only)
- **Assignment Schema:** `HealthWorkerAssignment` model (`workerId`, `workerName`, `workerRole`, `assignedMandal`, `assignedVillages`, `assignedBy`, `status`, `assignedAt`).
- **Strict Clinical Scoping Rule:**
  - Under ITDA tribal privacy principles, field workers (ASHAs and ANMs) derive their clinical data authority **strictly and exclusively** from active explicit assignments.
  - When querying `/api/v1/reference/villages`, the backend inspects active assignments:
    - If the worker is assigned to villages `[A, B]`, the query pipeline applies `villageId: { $in: ['A', 'B'] }` and returns only those villages (`assignedScopeOnly: true`).
    - If the worker has **no active assignment**, the system returns `villages: []` (`total: 0`).
    - Non-assigned staff cannot view or query unassigned tribal village records.

### 2.6 Village Reference Data
- **Village Schema:** `Village` model (`villageId`, `villageName`, `mandal`, `panchayat`, `tribalHabitation`, `hospitalId`, `censusCode`, `populationEstimated`).
- **Census Grounding:** Grounded in Alluri Sitharama Raju agency mandals (Paderu, Araku Valley, Chintapalli, Hukumpeta, Dumbriguda) to ensure accurate territorial scoping for screening camps.

---

## 3. Automated Route Coverage Matrix (CI Gate)

The capability verification engine (`tests/authorizationMatrix.test.ts`) inspects the live Express application router at test execution time. CI enforces that **100% of routes must exist in `ENDPOINT_CAPABILITY_TABLE`**:

| Express Endpoint | Method | Required Capability | Protected Roles |
|---|---|---|---|
| `/api/v1/hospitals` | `POST` | `hospital:manage` | `system_admin` |
| `/api/v1/hospitals` | `GET` | `hospital:read` | `system_admin`, `admin`, `medical_officer` |
| `/api/v1/hospitals/:hospitalId` | `GET` | `hospital:read` | `system_admin`, `admin`, `medical_officer` |
| `/api/v1/hospitals/:hospitalId` | `PUT` | `hospital:manage` | `system_admin`, `admin` (Own facility only) |
| `/api/v1/invitations` | `POST` | `invitation:create` | `system_admin`, `admin` |
| `/api/v1/invitations` | `GET` | `invitation:read` | `system_admin`, `admin` |
| `/api/v1/invitations/verify/:token` | `GET` | Public (Token-guarded) | All |
| `/api/v1/invitations/accept` | `POST` | Public (Single-use token) | All |
| `/api/v1/invitations/:id/revoke` | `POST` | `invitation:manage` | `system_admin`, `admin` |
| `/api/v1/specialists` | `GET` | `specialist:read` | `system_admin`, `admin`, `medical_officer` |
| `/api/v1/specialists` | `POST` | `specialist:manage` | `system_admin`, `admin`, `medical_officer` |
| `/api/v1/assignments` | `POST` | `assignment:create` | `system_admin`, `admin` |
| `/api/v1/assignments` | `GET` | `assignment:read` | `system_admin`, `admin`, `medical_officer`, `asha`, `anm` (Own) |
| `/api/v1/assignments/worker/:workerId` | `GET` | `assignment:read` | `system_admin`, `admin`, `medical_officer`, `asha`, `anm` (Own) |
| `/api/v1/assignments/:id/revoke` | `POST` | `assignment:create` | `system_admin`, `admin` |
| `/api/v1/reference/villages` | `GET` | `reference:villages` | All roles (Enforces assignment filter for ASHA/ANM) |
| `/api/v1/reference/villages` | `POST` | `reference:manage` | `system_admin`, `admin` |

---

## 4. Client Components Engineered

Four dedicated user interface modules were designed and integrated into `client/src/components/`:

1. **`HospitalManager.tsx`:**
   - Visual facility cards displaying catchment mandal, district, jurisdiction villages, and administrator list.
   - Interactive **Cross-Hospital Isolation Security Probe** allowing reviewers to simulate cross-hospital access attempts and observe live `403 CROSS_HOSPITAL_FORBIDDEN` enforcement.
2. **`InvitationManager.tsx`:**
   - 72-hour onboarding link generator with prominent notice: *"Delivery is not claimed via automated email/SMS. Send or copy this secure 72-hour onboarding link directly to the staff member."*
   - Copyable link container with one-click clipboard copy feedback and expiration countdown.
   - Onboarding simulator validating token acceptance, token reuse rejection (409), expired token rejection (410), and self-approval block (403).
3. **`SpecialistDirectory.tsx`:**
   - Directory browser filterable by oral oncology, maxillofacial surgery, ENT, oral pathology, radiation oncology, or dental surgery.
   - Live teleconsultation availability filter and patient referral modal.
4. **`AssignmentManager.tsx`:**
   - Field worker assignment creator with multi-village selection.
   - Interactive **Scope Verifier Probe** demonstrating that unassigned workers see 0 villages, while assigned workers see only their explicit habitations.
   - ITDA Census Village reference explorer and registry form.

---

## 5. Summary of Compliance

| Requirement | Implementation | Status |
|---|---|---|
| **Hospitals Directory** | `Hospital` model, catchment routes, cross-hospital boundary checks | **PASS** |
| **72-Hour Invitations** | Cryptographic 256-bit token, strict 72h TTL (`expiresAt`), token redemption | **PASS** |
| **Delivery Not Claimed** | Link shown directly to admin to copy; delivery disclaimer displayed | **PASS** |
| **Staff & Specialists Directory** | Specialists registry, qualifications, teleconsultation filter | **PASS** |
| **Delegated Permissions** | Live DB delegation checks, active validity window | **PASS** |
| **Health Worker Assignments** | Explicit jurisdiction assignment; scope derives solely from active assignment | **PASS** |
| **Village Reference Data** | Tribal census reference schema, mandal & panchayat tracking | **PASS** |
| **Cross-Hospital Access Denied** | Staff from Hospital A blocked from Hospital B (`403 CROSS_HOSPITAL_FORBIDDEN`) | **PASS** |
| **Self-Approval Blocked** | Self-invitation, self-acceptance, self-delegation, self-assignment blocked (403) | **PASS** |
| **Expired & Reused Tokens** | Reused tokens return 409; expired tokens (>72h) return 410 | **PASS** |
| **Worker Sees Only Assigned Villages** | ASHA/ANM query injected with assignment filter; 0 returned if unassigned | **PASS** |
| **Audit Immutability** | Administrative events append-only; update/delete operations blocked | **PASS** |
| **No Password Reset Endpoints** | Retained Phase 6 rule; forgot-password routes return 404 | **PASS** |
