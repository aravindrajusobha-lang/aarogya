# 🛠️ Aarogya-Drishti: Day-2 Operations & Maintenance Runbook

> **Platform Version:** 0.2.0 (Phase 20 Technical Handover)  
> **Target Audience:** DevOps Engineers, Site Reliability Engineers (SRE), Platform Administrators  
> **Environment:** ITDA Paderu Tribal Health Infrastructure  
> **Notice:** Simulation demonstration system. No live clinical systems or real patient data.

---

## 1. Service Management & Process Control

### 1.1 Managing Docker Containers
The production environment runs via `docker-compose.prod.yml`:

```bash
# Start all services in the background
docker compose -f docker-compose.prod.yml up -d

# Stop all services gracefully
docker compose -f docker-compose.prod.yml down

# View real-time aggregated container logs
docker compose -f docker-compose.prod.yml logs -f --tail=100

# View specific container logs
docker compose -f docker-compose.prod.yml logs -f aarogya-server
docker compose -f docker-compose.prod.yml logs -f aarogya-mongodb
docker compose -f docker-compose.prod.yml logs -f aarogya-nginx

# Restart a specific service
docker compose -f docker-compose.prod.yml restart aarogya-server
```

### 1.2 Container Resource Boundaries
As defined in `docker-compose.prod.yml`, resource limits are enforced:
- **`aarogya-mongodb`:** 1.5 CPUs, 2048MB RAM
- **`aarogya-server`:** 1.0 CPUs, 1024MB RAM
- **`aarogya-nginx`:** 0.5 CPUs, 256MB RAM

---

## 2. MongoDB Replica Set (`rs0`) Administration

The platform requires a MongoDB replica set for multi-document ACID transactions.

### 2.1 Checking Replica Set Health
Connect to the MongoDB container:
```bash
docker exec -it aarogya-mongodb mongosh --eval "rs.status()"
```
Key status indicators:
- `set`: `"rs0"`
- `myState`: `1` (PRIMARY)
- `health`: `1`
- `members[0].stateStr`: `"PRIMARY"`

### 2.2 Re-initiating a Broken Replica Set
If the replica set loses configuration after a volume unmount:
```bash
docker exec -it aarogya-mongodb mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongodb:27017" }] })'
```

---

### 2.3 Daily Video Provider Setup
Live calls use a private Daily room. Configure one of these server-side options:

1. **Admin settings:** set a persistent 64-character hex `VIDEO_CONFIG_ENCRYPTION_KEY` in the server environment and restart the API. Generate a key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep this key in the deployment secret store and preserve it across restarts; losing it makes the encrypted Daily credential unreadable.
2. Sign in as `system_admin`, open **Video Provider Settings**, enter the Daily API key and account domain, then choose **Test connection and save**. The API verifies the key with Daily before storing it encrypted with AES-256-GCM. The API key is never returned to the browser or written to audit records.
3. Alternatively, set `DAILY_API_KEY` and `DAILY_DOMAIN` in the server environment. Environment credentials are used when no admin-stored configuration exists.
4. Set `CLIENT_ORIGIN` to the deployed frontend origin so in-app patient links open the correct application URL. Confirm the provider state is **CONNECTED** before placing calls. Daily credentials must remain server-side, and production traffic must use HTTPS. Patient/doctor room access still requires a valid application login and facility-scoped assignment.

The provider test can fail if the API key is invalid, the domain is not a hostname, or the API server cannot reach `api.daily.co`. The admin screen shows the provider response without exposing the key.

## 3. Database Backup & Disaster Recovery Procedures

### 3.1 On-Demand Backup Execution
Backups stream all 18 collections to newline-delimited JSON with an immutable SHA-256 manifest:

```bash
# Inside the server directory (or inside aarogya-server container):
npm run backup
```
*Output: `server/backups/backup_aarogya_<timestamp>/` containing:*
- Individual collection `.json` files
- `backup_manifest.json` with SHA-256 hashes, timestamps, and document counts

### 3.2 Scheduled Automated Backups
Configure a Linux crontab on the host machine to execute nightly backups at 02:00 IST:
```cron
0 20 * * * cd /path/to/aarogya-drishti/server && /usr/bin/npm run backup >> /var/log/aarogya_backup.log 2>&1
```

### 3.3 Verifying Backup Manifest Integrity
Before initiating a restore, verify file checksums:
```bash
node -e '
const fs = require("fs");
const crypto = require("crypto");
const manifest = JSON.parse(fs.readFileSync("./backups/backup_aarogya_<timestamp>/backup_manifest.json"));
for (const col of manifest.collections) {
  const content = fs.readFileSync("./backups/backup_aarogya_<timestamp>/" + col.file);
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  if (hash !== col.sha256) throw new Error("Checksum mismatch on " + col.collection);
}
console.log("Manifest SHA-256 Integrity: 100% VERIFIED");
'
```

### 3.4 Performing a Disaster Recovery Restore
To restore the platform to a clean state from a backup:
```bash
# Command structure: npm run restore -- <path_to_backup_directory>
npm run restore -- ./backups/backup_aarogya_<timestamp>
```
The restore engine:
1. Validates all SHA-256 checksums in `backup_manifest.json`.
2. Rejects the restore if any byte has been tampered with or corrupted.
3. Clears target collections and populates records transactionally.
4. Emits a structured audit log entry upon completion.

---

## 4. Secret & Certificate Rotation Runbook

### 4.1 Rotating JWT & Session Secrets
1. Generate new 32-byte cryptographically random secrets:
   ```bash
   node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
   ```
2. Update `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, and `SESSION_SECRET` in `.env`.
3. Restart `aarogya-server`:
   ```bash
   docker compose -f docker-compose.prod.yml restart aarogya-server
   ```
*Note: Rotating `JWT_SECRET` invalidates all existing active user sessions, requiring staff to re-authenticate.*

### 4.2 Rotating TLS Certificates
1. Place renewed certificates in `deployment/tls/`:
   - `deployment/tls/server.crt`
   - `deployment/tls/server.key`
2. Reload Nginx without downtime:
   ```bash
   docker exec -it aarogya-nginx nginx -s reload
   ```

---

## 5. Observability, Logging & Health Monitoring

### 5.1 Health Check Endpoints
Monitor these endpoints using your uptime monitoring agent (e.g. Prometheus, Datadog, UptimeKuma):
- **API Probe:** `GET https://<domain>/api/v1/health`
- **Expected Status:** `200 OK`
- **Payload:** `{"status": "HEALTHY", "database": {"status": "CONNECTED"}}`

### 5.2 Pino JSON Structured Logging
All logs are emitted as single-line JSON objects to standard output:
- Redacted fields: `password`, `token`, `aadhaar`, `phone`, `patientName`.
- Log levels: `30` (INFO), `40` (WARN), `50` (ERROR).
- Log aggregation: Forward container stdout to Elasticsearch, Loki, or CloudWatch.

### 5.3 High-Priority Alert Indicators
- Consecutive `CROSS_HOSPITAL_FORBIDDEN` events (indicates unauthorized lateral exploration).
- Multiple `ACCOUNT_LOCKED` events within 10 minutes (indicates brute-force attacks).
- Repeated `SYNC_CONFLICT` bursts (indicates clock drift or concurrent conflicting offline edits).

---

## 6. Incident Response Runbooks

### Runbook 1: Account Lockout Reset
When a health worker exceeds 5 failed attempts:
1. The account automatically unlocks after 5 minutes.
2. For immediate administrative unlock, the hospital admin or system admin uses the Account Recovery Workflow:
   - Issue single-use recovery ticket via `POST /api/v1/recovery/tickets`.
   - Provide worker with recovery secret.
   - Worker sets a new password via `POST /api/v1/recovery/tickets/complete`.

### Runbook 2: Offline Sync Queue Bottleneck
If a frontline device encounters high latency during batch sync:
1. Check `GET /api/v1/sync/status` to determine uncommitted transactions.
2. Ensure batch payloads do not exceed the 10MB upload ceiling.
3. If payload contains large high-resolution photos, verify client-side compression is enabled in the PWA.
