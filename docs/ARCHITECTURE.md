# Aarogya Drishti - System Architecture

**Document Version:** 0.2 (draft)  
**Status:** [PROPOSED]  
**Target:** AAROHAN Inter-Centre Hackathon 2026 (ITDA Paderu)

---

## 1. Architecture Overview

Aarogya Drishti is structured as an offline-first Progressive Web Application (PWA) backed by a hardened Express/Node.js API and MongoDB Replica Set.

```
+-------------------------------------------------------------+
|                     Client PWA (React)                     |
|  - Simulation Banner (Non-dismissible)                      |
|  - Dexie.js (IndexedDB for offline queue & local cache)     |
|  - i18n Matrix (English, Telugu, Hindi)                     |
|  - Vanilla CSS Design System (Accessible, Mobile-First)     |
+-------------------------------------------------------------+
                              |
                     HTTPS / JSON Envelope
                              |
+-------------------------------------------------------------+
|                  Express API Gateway Server                  |
|  - Standard Envelope Middleware: { success, data, error }    |
|  - Pino Logger (Strict PHI & Secret Redaction)               |
|  - Zod Validation Middleware                                |
|  - Central Authorization & Scope Check Guard                |
|  - Private File Storage Engine (Authorized streaming only)  |
+-------------------------------------------------------------+
          |                                       |
+----------------------+              +------------------------+
|  MongoDB Replica Set  |              |    Agenda Scheduler    |
|  - Mongoose ORM      |              |  - Job Locking         |
|  - Multi-doc Txns    |              |  - Exponential Backoff |
|  - Audit Log Ledger  |              |  - Exactly-once Runs   |
+----------------------+              +------------------------+
```

---

## 2. Key Architectural Tenets

### 2.1 Standard API Response Envelope
Every response adheres to the immutable envelope:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "timestamp": "2026-10-31T09:40:00.000Z",
    "requestId": "req_uuidv4",
    "simulation": true,
    "environment": "simulation-demo"
  }
}
```
Errors return `success: false`, `data: null`, and standard error descriptors (`code`, `message`, `details`).

### 2.2 Pino Log Redaction & Privacy
All logs pass through strict redactors. The following paths are automatically masked to `[REDACTED]`:
- `req.headers.authorization`, `req.headers.cookie`
- `password`, `token`, `refreshToken`, `otp`, `invitationToken`
- `aadhaar`, `phone`, `mobile`, `patientName`, `dob`, `address`, `abhaId`, `email`

### 2.3 MongoDB Replica Set Requirement
Multi-document ACID transactions (`session.startTransaction()`) are essential for atomicity in clinical referral workflows, audit logging, and queue state transitions. A replica set (`rs0`) is required in all environments.

### 2.4 Agenda Job Scheduling & Locking
Agenda manages background processes (referral follow-up reminders, camp synchronization, token expiration cleanups):
- Backed directly by MongoDB (`agenda_jobs` collection).
- Configured with `lockLifetime: 10000` (10 seconds).
- Jobs persist state across restarts; execution semantics guarantee that locked or processing jobs are recovered gracefully without duplicate executions.

### 2.5 Private File Storage (Zero Public URLs)
- Oral cavity photos and clinical screening uploads are saved to private isolated storage.
- No public directory is exposed via `express.static`.
- Access is provided solely through `GET /api/v1/storage/files/:fileId`, which verifies actor authentication and scope before streaming bytes.
