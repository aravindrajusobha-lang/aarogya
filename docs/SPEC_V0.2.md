# Aarogya Drishti - Technical Specification v0.2 (Draft)

**Project:** Aarogya Drishti  
**Event:** AAROHAN Inter-Centre Hackathon 2026 (ITDA Paderu)  
**Status:** [PROPOSED]  
**Revision:** 0.2 (Foundation Phase)

---

## 1. Context & Operational Objectives

Integrated Tribal Development Agency (ITDA) Paderu represents one of the most geographically challenging tribal regions in Andhra Pradesh, with remote habitations, intermittent cellular connectivity, and high incidence of oral mucosal lesions due to tobacco/gutkha chewing habits.

Aarogya Drishti provides:
1. **Offline-first screening capability** for ASHAs and ANMs.
2. **Telemedicine referral triage** for Primary Health Centre Medical Officers.
3. **Structured navigation tracking** ensuring patients flagged with high-suspicion lesions reach tertiary oncology centers for biopsy and histopathological evaluation.

---

## 2. System Standards & Constraints

### 2.1 Simulation Boundary [NON-NEGOTIABLE]
- Platform is an engineering simulation for competition and evaluation.
- No real patient personally identifiable information (PII) or protected health information (PHI) is ever collected.
- Mock adapters simulate Aadhaar, tele-consultation WebRTC, SMS/WhatsApp gateways, and AI inference engines. Every mock adapter response explicitly identifies itself as `MOCK` or `DEMO AI`.

### 2.2 Clinical Safety Non-Diagnostic Mandate [NON-NEGOTIABLE]
- System provides screening assistance only.
- Prohibited vocabulary (diagnosis, cancer-free, stage 1-4, curative treatment) is strictly forbidden in code and outputs.
- Build fails if wording scanner encounters prohibited terms.

### 2.3 Authentication & Session Security [PROPOSED]
- Argon2id password hashing.
- Short-lived Access Tokens: 15 minutes.
- Rotating Refresh Tokens: 7 days for staff / 30 days for patients, stored hashed at rest, with reuse detection and device record association.
- 5 failed consecutive login attempts trigger a 5-minute lockout with audit event.
- Single-use invite tokens valid for 72 hours, stored hashed, never logged.

### 2.4 Multi-Language Matrix
- Languages: English (`en`), Telugu (`te`), Hindi (`hi`).
- Strict 1:1 key parity enforced by automated test suite across all locale dictionaries.
