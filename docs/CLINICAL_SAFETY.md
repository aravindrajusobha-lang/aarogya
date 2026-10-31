# Aarogya Drishti - Clinical Safety Guidelines

**Document Version:** 0.2 (draft)  
**Status:** [PROPOSED]  
**Intended Use:** Screening Support & Telemedicine Simulation Only (NOT FOR CLINICAL USE)

---

## 1. Primary Clinical Safety Directive

Aarogya Drishti is an **assistive screening and patient navigation simulation platform** designed for community health workers (ASHAs, ANMs) and primary care teams in rural/tribal jurisdictions (ITDA Paderu).

> **CRITICAL RULE:** Aarogya Drishti NEVER provides a diagnosis, never predicts a cancer stage, never declares a patient "cancer-free", and never prescribes or recommends treatment choices.

All clinical classifications, risk flags, and referral suggestions are preliminary, rule-guided, and demo AI-assisted screening recommendations. **Only licensed Medical Officers (MOs) at Primary Health Centres (PHCs) or District Hospitals are authorized to evaluate cases, provide clinical diagnosis, and direct patient care.**

---

## 2. Prohibited Terminology vs Approved Terminology

The automated test suite enforces the following terminology rules via `wordingSafety.test.ts`. Any pull request or build containing prohibited terminology will automatically fail.

| Prohibited Concepts / Terms | Approved Clinical Screening Alternatives |
|---|---|
| "Diagnosis" / "Diagnostic" / "Diagnose" | "Screening assessment", "Preliminary evaluation", "Risk observation" |
| "Cancer-free" / "Clear of cancer" / "Healthy oral cavity" | "No visible mucosal abnormality flagged on current screening", "Normal visual findings" |
| "Cancer stage", "Stage I/II/III/IV", "TNM stage" | "Preliminary risk category", "Visual severity tier", "Referral urgency category" |
| "Curative treatment", "Chemotherapy", "Radiation plan" | "Medical Officer referral recommended", "Specialist evaluation needed" |
| "Confirmed malignant" | "High-suspicion mucosal lesion requiring biopsy and MO review" |
| "Complete recovery guaranteed" | "Patient navigation follow-up schedule" |

---

## 3. Simulation & Demonstration Demarcation

- Every UI screen containing screening results, patient profiles, tele-consultation reviews, or AI inferences MUST display the persistent non-dismissible banner:  
  `⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE`
- Every API endpoint response body includes the standard envelope `meta`:
  ```json
  "meta": {
    "simulation": true,
    "environment": "simulation-demo"
  }
  ```
- All external service integrations (Aadhaar verification, tele-consultation WebRTC, SMS dispatch, automated AI inferences) are backed by mock simulation adapters and are explicitly tagged with `is_mock: true` or `adapter_status: "MOCK"`.

---

## 4. Audit Trail & Escalation Workflow

1. **ASHA/ANM Screening:** Enters demo patient screening survey, captures simulated oral photographs, uploads via private authorized storage.
2. **Demo AI Inference:** Runs preliminary screening heuristics. Tags findings as `DEMO AI` risk classification (e.g., "Screening Flag: Visual Lesion Observed - Requires MO Review").
3. **Medical Officer Review:** Only a logged-in Medical Officer can review images, validate or overturn screening flags, and initiate tele-referral.
4. **Audit Logging:** Every view, screening edit, flag change, and referral creation is recorded with an immutable audit entry containing actor ID, role, action, and timestamp. No patient identifiers or secrets are recorded in audit logs.
