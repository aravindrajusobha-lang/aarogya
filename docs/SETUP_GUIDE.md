# 🚀 Aarogya-Drishti: Complete Deployment & Handover Guide

> **Document Version:** 1.0.0 (Phase 20 Technical Handover)  
> **Target Audience:** DevOps Engineers, Full-Stack Developers, System Administrators  
> **Compliance:** AAROHAN Hackathon 2026 — ITDA Paderu Tribal Health  
> **Notice:** All seeded datasets, biometric records, and AI models are synthetic **SIMULATION** fixtures.

---

## 1. System Requirements

### Hardware Requirements
- **CPU:** 2 cores minimum (4 cores recommended)
- **RAM:** 4 GB RAM minimum (8 GB recommended for Docker Compose with replica set)
- **Disk Space:** 10 GB free SSD storage

### Software Prerequisites
- **Operating System:** Linux (Ubuntu 22.04+ LTS / Debian 12), macOS Sonoma, or Windows 11 with WSL2 / PowerShell 7+
- **Docker:** Docker Engine 24.0+ & Docker Compose v2.20+
- **Node.js (for bare-metal development):** Node.js 20.x LTS & npm 10.x
- **OpenSSL:** Standard binary for generating TLS certificates

---

## 2. Deployment Option A: Docker Production Deployment (Recommended)

This procedure deploys the complete, isolated stack using multi-stage Docker builds, a single-node MongoDB replica set (`rs0`), an Express API container running under a non-privileged `node` user, and an Nginx reverse proxy terminating TLS 1.2/1.3.

### Step 1: Clone Repository
```bash
git clone https://github.com/organization/aarogya-drishti.git
cd aarogya-drishti
```

### Step 2: Generate TLS Certificates
Aarogya-Drishti enforces HTTPS across all endpoints. Generate self-signed certificates for your domain or localhost:

```bash
# On Linux / macOS:
chmod +x ./deployment/tls/generate-certs.sh
./deployment/tls/generate-certs.sh

# On Windows PowerShell:
.\deployment\tls\generate-certs.ps1
```
*Output files created in `deployment/tls/`: `server.crt` and `server.key`.*

### Step 3: Configure Environment Variables
Copy the production environment template:
```bash
cp .env.production.example .env
```

Review `.env` settings:
```ini
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://mongodb:27017/aarogya_db?replicaSet=rs0
JWT_SECRET=production_super_secret_jwt_key_32_bytes_min
REFRESH_TOKEN_SECRET=production_super_secret_refresh_key_32_bytes_min
SESSION_SECRET=production_secure_session_encryption_key_32_bytes
CORS_ORIGIN=https://localhost
UPLOAD_MAX_BYTES=10485760
STORAGE_LOCAL_PATH=/app/storage/private_uploads
```

### Step 4: Build & Launch Multi-Container Services
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 5: Verify Container Health
Check container statuses:
```bash
docker compose -f docker-compose.prod.yml ps
```
Expected output:
- `aarogya-mongodb`: `healthy` (Port 27017)
- `aarogya-replica-init`: `exited (0)` (Replica set successfully initialized)
- `aarogya-server`: `healthy` (Internal port 5000)
- `aarogya-nginx`: `running` (Ports 80 -> 443 redirect, 443 active)

### Step 6: Verify Health Probes
```bash
curl -k https://localhost/api/v1/health
```
Response:
```json
{
  "status": "HEALTHY",
  "timestamp": "2026-11-01T08:00:00.000Z",
  "version": "0.2.0",
  "simulation": true,
  "database": {
    "status": "CONNECTED",
    "replicaSet": "rs0"
  }
}
```

---

## 3. Deployment Option B: Bare-Metal Development Setup

If running locally without Docker:

### Step 1: Install MongoDB Replica Set
MongoDB **must** run as a replica set (`rs0`) to support ACID transactions:
```bash
# Start MongoDB locally with replica set flag
mongod --replSet rs0 --dbpath /path/to/data/db
```
In a mongo shell (`mongosh`):
```javascript
rs.initiate();
```

### Step 2: Install Backend Dependencies & Seed
```bash
cd server
npm install
cp ../.env.production.example .env
# Edit MONGODB_URI in .env to: mongodb://127.0.0.1:27017/aarogya_db?replicaSet=rs0

# Seed demo users and clinical fixtures
npm run seed
```

### Step 3: Run Server
```bash
npm run dev
# Server boots on http://localhost:5000
```

### Step 4: Install Frontend Dependencies & Run Client
In a separate terminal:
```bash
cd client
npm install
npm run dev
# Vite client boots on http://localhost:5173
```

---

## 4. Default Seed Personas & Demo Credentials

All seed accounts are initialized with the following credentials (all part of the ITDA Paderu pilot catchment):

| Role | Username | Password | Full Name / Title | Scope / Catchment |
|---|---|---|---|---|
| **System Admin** | `sysadmin.itda` | `SystemAdmin@2026` | ITDA IT Coordinator | Platform-wide administrative control |
| **Hospital Admin** | `admin.paderu` | `Admin@2026` | Ravi Kumar, Program Admin | District Hospital Paderu (`hosp_paderu_dh`) |
| **Medical Officer** | `doctor.paderu` | `AarogyaDemo@2026` | Dr. Suresh Varma, MD | Paderu DH Review Queue & Teleconsult |
| **Specialist** | `specialist.kgh` | `Specialist@2026` | Dr. Aruna Rao, MS (Oncology) | King George Hospital, Visakhapatnam |
| **Frontline ANM** | `anm.chintapalli` | `AnmStaff@2026` | K. Mary Rani, ANM | Chintapalli Mandal Catchment |
| **Frontline ASHA** | `asha.dumbriguda` | `AshaWorker@2026` | Lakshmi Devi, ASHA | Dumbriguda Tribal Settlement Hamlets |
| **Patient Demo** | `patient.balaram` | `Patient@2026` | Vantala Balaram | Dumbriguda Hamlet (`PAT-PAD-2026-001`) |

---

## 5. Verification & Handover Test Procedures

Run these commands inside the `server/` directory to certify system health:

### 1. Run All Module Smoke Tests (24 Modules)
```bash
npx vitest run tests/smokeTestAllModules.test.ts
```
*Expected: 24 passed (100% pass rate).*

### 2. Verify Backup & Disaster Recovery Engine
```bash
npx vitest run tests/backupAndRestore.test.ts
```
*Expected: 4 passed (Creates backup, verifies SHA-256 manifest, deletes database, restores collections, verifies data parity).*

### 3. Run Secret & Security Hygiene Scanner
```bash
npx vitest run tests/secretScanner.test.ts
```
*Expected: 5 passed (Verifies zero private keys, cloud credentials, or raw Aadhaar numbers exist in git repository).*

### 4. Run Complete Integration & Acceptance Matrix (Phase 19)
```bash
npx vitest run tests/integrationAndE2EDemo.test.ts
```
*Expected: All 77 acceptance criteria IDs and jury test scripts passing.*

---

## 6. CLI Backup & Restore Operations

### Create Database Backup Snapshot
```bash
cd server
npm run backup
```
*Saves all 18 collections to `server/backups/backup_aarogya_<timestamp>/` with an immutable `backup_manifest.json` containing SHA-256 hashes of every collection dump.*

### Restore Database from Snapshot
```bash
cd server
npm run restore -- ./backups/backup_aarogya_<timestamp>
```
*Restores all collections transactionally after verifying SHA-256 manifest integrity.*
