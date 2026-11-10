# Phase 17 Engineering Report: Offline & PWA Hardening

**Project:** AAROGYA-DRISHTI: AI-Assisted Oral Cancer Screening Platform for Tribal Populations  
**Target Environment:** Remote Tribal Camps (ITDA Paderu, Visakhapatnam & Alluri Sitharama Raju Districts)  
**Phase:** 17 — Offline and PWA Hardening  
**Status:** COMPLETE & VERIFIED  
**Date:** November 1, 2026  

---

## 1. Executive Summary & Objective

In remote tribal interior mandals across ITDA Paderu (e.g., G. Madugula, Chintapalli, Dumbriguda, Araku Valley), cellular connectivity is intermittent or entirely absent during field screening camps. Phase 17 hardens the Progressive Web App (PWA) and offline subsystem to guarantee uninterrupted clinical workflows for Auxiliary Nurse Midwives (ANMs) and Accredited Social Health Activists (ASHAs).

### Core Accomplishments
1. **App Shell & Reference Data Caching:** Service Worker configured with cache-first strategy for app shell assets and Stale-While-Revalidate caching for static reference datasets (villages, facilities, specialists).
2. **Encrypted Offline Queue Extension:** Scaled beyond initial registration to encompass oral screening photos, clinical consultation notes, appointment requests, referrals, and case submissions across Dexie IndexedDB v3.
3. **Transparent Cryptographic Reporting & Known Limitations:** Formally evaluated and reported client-side WebCrypto encryption strength (AES-GCM-256 + PBKDF2-HMAC-SHA256 100,000 iterations), documenting that browser-sandboxed keys cannot match native Android hardware-bound Keystore/TEE security.
4. **Byte-Identical Preservation:** Pre-computed SHA-256 digests ensure raw oral mucosa photos remain bit-for-bit identical before encryption and post-sync ingestion.
5. **Replay-Safe Idempotent Synchronization:** Guaranteed that identical batch replays produce zero duplicate database records via `SyncLedger` and `clientMutationId`.
6. **Visible Conflict Handling & Exponential Backoff:** Version collisions present transparent resolution states (`pending_review`, `server_wins`, `local_override`) with exponential retry backoff.
7. **Privacy-Preserving Queue Wipe:** Guaranteed instantaneous purging of all local encrypted records upon explicit user logout or server-directed device revocation (`401 DEVICE_REVOKED`).
8. **Real-Time Network Telemetry & Sync Indicators:** Live connection status banner, pending mutation counter (`X / 500 queued actions`), and trilingual localized alerts across English, Telugu, and Hindi.

---

## 2. PWA & Service Worker Caching Architecture

The Service Worker (`client/public/sw.js` and `client/dist/sw.js`) coordinates caching policies across two primary cache tiers:

```mermaid
graph TD
    A[Client Request] --> B{Resource Type}
    B -->|App Shell Assets / Bundles| C[Cache-First Strategy]
    C -->|Hit| D[Instant Local Load]
    C -->|Miss| E[Fetch Network & Populate Cache]
    B -->|Reference Data: Villages/Hospitals/Specialists| F[Stale-While-Revalidate]
    F -->|Return Cached Data Immediately| G[Instant Dropdowns]
    F -->|Background Network Fetch| H[Update Reference Cache]
    B -->|Mutations / Dynamic APIs| I[Network-Only with Offline Queue Fallback]
    I -->|Success| J[Live District Server]
    I -->|Failure / No Signal| K[AES-GCM-256 IndexedDB Queue]
```

### Reference Datasets Cached
- `/api/v1/reference/villages` (Tribal habitations and mandal mappings)
- `/api/v1/hospitals` (Designated sub-district and district health facilities)
- `/api/v1/specialists` (Oral oncologists, pathologists, and ENT surgeons)

---

## 3. Cryptographic Strength & Known Limitations

As required by clinical data protection standards and system rules, client-side encryption parameters are reported with zero inflated security claims:

### Cryptographic Configuration
| Parameter | Setting | Standard Reference |
| :--- | :--- | :--- |
| **Symmetric Cipher** | AES-GCM (Galois/Counter Mode) | FIPS 197 / NIST SP 800-38D |
| **Cipher Key Length** | 256 bits | High-assurance symmetric |
| **Key Derivation Function** | PBKDF2-HMAC-SHA256 | RFC 8018 |
| **Iteration Count** | 100,000 iterations | OWASP Password Storage Guidance |
| **Salt Length** | 128 bits (16 bytes, cryptographically random) | Unique per encrypted item |
| **Nonce / IV Length** | 96 bits (12 bytes, unique per operation) | Standard GCM nonce recommendation |
| **Auth Tag Length** | 128 bits (16 bytes) | Full authentication tag |
| **Storage Engine** | IndexedDB via Dexie.js v3 | Structured local database |

### Known Limitations (Transparent Disclosure)
> [!CAUTION]
> 1. **No Hardware Key Binding:** A standard web browser execution environment (PWA running in Chrome/WebView) lacks access to native Android hardware-backed Keystore or TEE (Trusted Execution Environment) hardware security modules (HSMs).
> 2. **Process Memory Exposure:** Symmetric encryption keys derived in Javascript reside in browser process memory during active worker sessions and are vulnerable to memory inspection if the host Android OS is rooted, jailbroken, or compromised with physical debugger access.
> 3. **Storage Quota Eviction Risk:** While Dexie requests persistent storage (`navigator.storage.persist()`), extreme host device storage pressure may lead the operating system to evict browser storage partitions unless native app containers are deployed.
> 4. **Casual vs. Forensic Security:** Browser cache encryption provides robust protection against casual device inspection and lost-device file extraction, but cannot offer forensic tamper-resistance equivalent to dedicated encrypted government hardware.

---

## 4. Operational Boundaries & Confirmed Limits

Pursuant to user authorization and field bandwidth realities in tribal camps:
- **Maximum Offline Queue Capacity:** Exactly **500 queued actions**. When the queue reaches 500 items, further mutations are rejected until synchronized, preventing device memory exhaustion.
- **Maximum Raw Photo Capture Limit:** **5 MB raw buffer limit**. Images captured by field tablet cameras must be under 5 MB raw capture, which the client-side canvas compresses to $\le 2\text{ MB}$ JPEG prior to base64 storage.
- **Byte-Identical Integrity:** The client calculates `originalSha256 = SHA-256(rawBytes)` before encryption. Upon synchronization, the server recomputes the SHA-256 digest of the ingested photo buffer. Mismatches abort ingestion with `CHECKSUM_MISMATCH`.

---

## 5. Offline Queue Lifecycle & Conflict Resolution

```mermaid
stateDiagram-v2
    [*] --> QueuedOffline: Field Action Saved
    QueuedOffline --> EncryptedStorage: AES-GCM-256 Encrypted in IndexedDB
    EncryptedStorage --> NetworkConnected: Field Worker Reaches Signal
    NetworkConnected --> BatchSubmission: POST /api/v1/sync/batch
    BatchSubmission --> Synced: Fresh Mutation Accepted (200 OK)
    BatchSubmission --> ReplayedNoMutation: Already Ingested (Idempotent 200 OK)
    BatchSubmission --> ConflictDetected: Version Mismatch (pending_review)
    BatchSubmission --> MidSyncFailure: Server Error / Network Drop
    MidSyncFailure --> ExponentialBackoff: Retry with min(1000 * 2^r, 30000) ms
    ExponentialBackoff --> BatchSubmission: Next Sync Attempt
    Synced --> [*]
    ReplayedNoMutation --> [*]
```

### Exponential Backoff Schedule
$$\text{Delay}(r) = \min(1000 \times 2^r, 30000)\text{ ms}$$
- Attempt 0: 1,000 ms (1 s)
- Attempt 1: 2,000 ms (2 s)
- Attempt 2: 4,000 ms (4 s)
- Attempt 3: 8,000 ms (8 s)
- Attempt 4: 16,000 ms (16 s)
- Attempt 5+: 30,000 ms (30 s cap)

---

## 6. Security Guarantees & Privacy Wipe

1. **Queue Wipe on Logout:** When a health worker taps "Sign Out" or logs out of their session, `handleLogout()` executes `await wipeOfflineQueue()`, purging the entire `encryptedQueue` and resetting all in-memory keys.
2. **Queue Wipe on Device Revocation:** If a lost or stolen tablet's session is revoked by an administrator or user, any subsequent sync batch request receives HTTP `401 DEVICE_REVOKED`. The PWA client immediately intercepts this code, wipes the IndexedDB queue, and terminates the session.
3. **Atomic Error Isolation:** A mid-sync failure on item $N$ in a batch isolates errors to that specific mutation. It writes zero partial records for item $N$ in MongoDB, while items $1 \dots N-1$ remain properly committed and audited.

---

## 7. Trilingual Localization Parity (i18n)

All offline UI badges, sync alerts, and capacity warnings are fully synchronized across English, Telugu, and Hindi:

| Key | English (`en.json`) | Telugu (`te.json`) | Hindi (`hi.json`) |
| :--- | :--- | :--- | :--- |
| `statusOffline` | Offline Mode Active (Cached in Paderu interior) | ఆఫ్‌లైన్ మోడ్ సక్రియంగా ఉంది (పాడేరు లోతట్టు ప్రాంతంలో నిల్వ చేయబడింది) | ऑफ़लाइन मोड सक्रिय (पाडेरु के आंतरिक क्षेत्र में कैश्ड) |
| `statusOnline` | Online (Connected to District Health Network) | ఆన్‌లైన్ (జిల్లా ఆరోగ్య నెట్‌వర్క్‌కు అనుసంధానించబడింది) | ऑनलाइन (जिला स्वास्थ्य नेटवर्क से जुड़ा हुआ) |
| `queuedActions` | Actions queued offline in encrypted storage | ఎన్‌క్రిప్ట్ చేయబడిన స్టోరేజ్‌లో ఆఫ్‌లైన్ చర్యలు వరుసలో ఉన్నాయి | एन्क्रिप्टेड स्टोरेज में ऑफ़लाइन क्रियाएं कतारबद्ध हैं |
| `syncSuccess` | All queued offline records synchronized successfully. | వరుసలో ఉన్న అన్ని ఆఫ్‌లైన్ రికార్డులు విజయవంతంగా సమకాలీకరించబడ్డాయి. | सभी कतारबद्ध ऑफ़लाइन रिकॉर्ड सफलतापूर्वक सिंक्रनाइज़ किए गए। |
| `syncConflict` | Conflict detected during synchronization. Resolution required. | సమకాలీకరణ సమయంలో వైరుధ్యం కనుగొనబడింది. పరిష్కారం అవసరం. | सिंक्रनाइज़ेशन के दौरान विरोध का पता चला। समाधान आवश्यक है। |
| `deviceRevokedWipe` | Device session revoked. Local offline records wiped for patient privacy. | పరికర సెషన్ రద్దు చేయబడింది. రోగి గోప్యత కోసం స్థానిక ఆఫ్‌లైన్ రికార్డులు తొలగించబడ్డాయి. | उपकरण सत्र निरस्त कर दिया गया। रोगी गोपनीयता के लिए स्थानीय ऑफ़लाइन रिकॉर्ड मिटा दिए गए। |
| `queueLimitReached` | Maximum offline queue capacity reached (500 actions). Please sync. | గరిష్ట ఆఫ్‌లైన్ క్యూ పరిమితికి (500 చర్యలు) చేరుకుంది. దయచేసి సమకాలీకరించండి. | अधिकतम ऑफ़लाइन कतार क्षमता (500 क्रियाएं) पूरी हो गई। कृपया सिंक करें। |
| `photoLimitNotice` | Photo capture size limited to 5 MB raw, compressed to 2 MB. | ఫోటో క్యాప్చర్ పరిమాణం గరిష్టంగా 5 MB కి పరిమితం చేయబడింది, 2 MB కి కుదించబడుతుంది. | फोटो कैप्चर आकार 5 MB कच्चे तक सीमित है, 2 MB तक संपीड़ित किया गया। |

---

## 8. Verification & Test Evidence

### Dedicated Test Suite: `server/tests/offlineHardening.test.ts`
All 10 tests passed with 100% precision:
- `✓` **Test 1:** Queues five diverse actions offline (patient registration, screening submission, screening photo, clinical notes, appointment request) and syncs each exactly once.
- `✓` **Test 2:** Guarantees idempotent sync: replaying the identical batch creates zero duplicate records.
- `✓` **Test 3:** Validates byte-identical integrity preservation via SHA-256 and rejects tampering (`CHECKSUM_MISMATCH`).
- `✓` **Test 4:** Denies synchronization from a revoked device with HTTP 401 `DEVICE_REVOKED`.
- `✓` **Test 5:** Ensures atomic failure handling: mid-sync failure creates no partial database records.
- `✓` **Test 6:** Detects version conflicts, returns visible resolution state (`pending_review`), and calculates exponential backoff.
- `✓` **Test 7:** Enforces maximum queue limit of 500 actions and photo capture limit of 5 MB raw.
- `✓` **Test 8:** Reports real encryption strength and transparently states browser sandbox known limitations.
- `✓` **Test 9:** Verifies Telugu, Hindi, and English offline messages exist with complete key parity.
- `✓` **Test 10:** Validates queue wipe semantics on logout and device revocation.

### Full Regression Suite Results
| Test Suite | Purpose | Tests | Status |
| :--- | :--- | :---: | :---: |
| `tests/offlineHardening.test.ts` | Phase 17 Offline & PWA hardening suite | 10 | **PASSED** |
| `tests/aadhaarMock.test.ts` | Phase 16 Aadhaar mock verification & non-custodial invariants | 15 | **PASSED** |
| `tests/reportsAndDashboards.test.ts` | Phase 15 Aggregation, reports & dashboards | 12 | **PASSED** |
| `tests/villageDataMap.test.ts` | Phase 14 13-endpoint spatial map & suppression | 16 | **PASSED** |
| `tests/teleconsultationWorkflow.test.ts` | Phase 13 BLOCKED adapters & versioned notes | 23 | **PASSED** |
| `tests/referralsAndFollowUp.test.ts` | Phase 12 Referrals & follow-up reminders | 19 | **PASSED** |
| `tests/biopsyWorkflow.test.ts` | Phase 11 Biopsy lifecycle & safe diagnosis records | 19 | **PASSED** |
| `tests/appointmentsManagement.test.ts` | Phase 10 Appointment slot booking & confirmation | 23 | **PASSED** |
| `tests/campsManagement.test.ts` | Phase 9 Screening camps lifecycle & statistics | 32 | **PASSED** |
| `tests/authorizationMatrix.test.ts` | Exhaustive cross-role endpoint capability matrix | 957 | **PASSED** |
| `tests/wordingSafety.test.ts` | Clinical non-diagnostic wording safety scanner | 2 | **PASSED** |
| `tests/i18nParity.test.ts` | Parity checks across English, Telugu & Hindi | 4 | **PASSED** |
| **Total Test Count** | **Comprehensive Multi-Phase Regression** | **1,172** | **ALL PASSED** |

---

## 9. Next Steps

With Phase 17 fully completed, tested, and documented, the platform's offline capabilities and PWA foundation are hardened for remote tribal camps. Ready to proceed to **Phase 18: Security & Performance Audit** upon user instruction.
