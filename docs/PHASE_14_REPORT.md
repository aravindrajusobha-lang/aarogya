# Phase 14: Village Data Map & Spatial Aggregation Report

## 1. Executive Summary
Phase 14 implements an aggregate, privacy-safe spatial data matrix for ITDA Paderu across the Alluri Sitharama Raju district in Aarogya-Drishti. The module provides village centroids, mandal boundaries, transport corridors, connectivity shadow zones, and screening activity metrics.

### Mandatory Reconciliation Note (12 vs. 13 Endpoints)
- **Initial Documentation:** Early architectural drafts and roadmap summaries listed 12 endpoints for the village map.
- **Reconciliation:** To decouple general spatial inquiries from offline GIS exports for DMHO and district reporting, `GET /api/v1/map/geo-export` was formalized as an independent, small-count-suppressed GeoJSON endpoint. This brought the verified total to exactly **13 audited, capability-checked endpoints**. Prior to coding, all 13 endpoints were listed and explicitly approved by the user.

---

## 2. All 13 Endpoints Specification

Mounted under `/api/v1/map`:

| # | HTTP Method | Endpoint Route | Description & Data Policy |
| :--- | :--- | :--- | :--- |
| **1** | `GET` | `/api/v1/map/villages` | Scoped list of villages with coordinates & mandal. |
| **2** | `GET` | `/api/v1/map/villages/:id` | Village detail and census demographic estimates. |
| **3** | `GET` | `/api/v1/map/villages/:id/workers` | Assigned frontline health workers (ASHA/ANM). Zero patient PII. |
| **4** | `GET` | `/api/v1/map/villages/:id/facilities` | Catchment facilities (primary PHC/CHC and District Hospital Paderu). |
| **5** | `GET` | `/api/v1/map/villages/:id/screenings-summary` | Village-level aggregate screening volumes with small-count suppression (`< 5`). |
| **6** | `GET` | `/api/v1/map/villages/:id/risk-metrics` | Mucosal risk density metrics with `< 5` cell suppression. Non-diagnostic. |
| **7** | `GET` | `/api/v1/map/villages/:id/camps` | Active, scheduled, and completed camps linked to this village. |
| **8** | `GET` | `/api/v1/map/clusters` | Habitation clusters and village health groups (Phase 7 linkage). |
| **9** | `GET` | `/api/v1/map/boundaries/mandals` | GeoJSON polygon boundaries for ITDA Paderu mandals. |
| **10** | `GET` | `/api/v1/map/corridors/transport` | Transit corridors connecting habitations to District Hospital Paderu. |
| **11** | `GET` | `/api/v1/map/connectivity-zones` | Cellular coverage and offline shadow zones. |
| **12** | `GET` | `/api/v1/map/heatmap/screening-coverage` | Screening coverage rates (% screened vs target population, suppressed). |
| **13** | `GET` | `/api/v1/map/geo-export` | Anonymized GeoJSON export for offline GIS with cell suppression. |

---

## 3. Privacy, Scoping & Governance Invariants

### A. Strict Village-Level Aggregates (Zero Patient Points)
- No patient coordinates, household pins, patient names, or phone numbers exist in any response or log.
- All spatial layers operate on village centroids or mandal polygons.

### B. Small-Count Cell Suppression (`< 5`) & Filter-Combination Attack Defense
- Created [aggregationUtils.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/src/modules/shared/aggregationUtils.ts) establishing the shared standard for Phases 9, 14, and 15:
  - Count == 0: `{ count: 0, displayValue: "0", isSuppressed: false }`
  - $0 < \text{Count} < 5$: `{ count: null, displayValue: "< 5", isSuppressed: true, suppressionReason: "..." }`
  - Count $\ge 5$: `{ count: N, displayValue: "N", isSuppressed: false }`
- **Defense against filter-combination attacks:** When query parameters (date ranges, priority, risk level) narrow down an aggregate cohort to $1 \le \text{count} \le 4$, cell suppression automatically engages, masking the result to prevent individual re-identification.

### C. Empty State Response Standard
- Villages with no recorded screenings return `200 OK` with `{ emptyState: true, total: 0 }`, **never an HTTP 400 or 404 error**.

### D. Role Scoping & Scope Denial
- **Health Workers (ASHA/ANM):** Scoped strictly to their assigned villages (via `WorkerAssignment`). Access to unassigned villages returns `403 FORBIDDEN_VILLAGE_SCOPE`.
- **Hospital Managers & Medical Officers:** Scoped strictly to their hospital's catchment villages (`hospitalId`). Out-of-catchment access returns `403 FORBIDDEN_CATCHMENT_SCOPE`.
- **Patients:** Denied all map endpoints (`403 FORBIDDEN`).

### E. Register Item Q-6 (Map People List) Status
- In compliance with explicit instructions, **no map people list endpoint, patient directory, or UI component was built**. Register item Q-6 remains pending user resolution.

---

## 4. Test Verification Evidence

1. **[villageDataMap.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/villageDataMap.test.ts)**:
   - **24 / 24 tests passed (100%)**
   - Validates all 13 endpoints, cell suppression, filter-combination attack defense, scope denial, and automated log scans confirming zero patient PII leakage.
2. **[authorizationMatrix.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/authorizationMatrix.test.ts)**:
   - **879 / 879 tests passed**
   - Verified that all 13 map endpoints are registered and enforced across all 6 user roles.
3. **[wordingSafety.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/wordingSafety.test.ts)**:
   - **2 / 2 passed (0 prohibited terms)**
4. **[i18nParity.test.ts](file:///c:/Users/YTC%20CHINTAPALLI/Desktop/AAROGYA-DRISHTI/server/tests/i18nParity.test.ts)**:
   - **4 / 4 passed (100% dictionary parity across en, te, and hi)**
