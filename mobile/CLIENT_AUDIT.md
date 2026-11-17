# Client audit for mobile implementation

Source reviewed: `client/src`, `client/public`, `client/package.json`, route/configuration files, canonical portal pages, their API helpers, and server route registrations they call.

## Source structure

- `client/src/App.tsx`: auth boot, session validation, route hash dispatch, role boundary and legacy operations console.
- `client/src/portal/public`: landing, patient login, staff login, consent registration, public demo navigation.
- `client/src/portal/patient`: dashboard, appointment booking/respond/cancel, screening list/detail/reanalysis, consultation history, prescriptions, private captures, notifications, profile.
- `client/src/portal/doctor`: appointment dashboard/actions, consultation history, exact patient-ID lookup/care assignment transfer, records, screening review, availability management, notifications.
- `client/src/portal/admin`: dashboard, doctor review/provisioning, facility registry/detail, operational inventory/wards/staff, notifications.
- `client/src/components`: legacy field operations and system management: dashboard, map, screening, patients/offline sync, appointments, camps/planning, assignments, village groups, specialists, hospitals, locations, invitations, staff, notifications, account recovery, consent, capabilities, mock identity service, diagnostics, auth/devices.
- `client/src/db` and `client/src/offline`: Dexie offline persistence and encrypted mutation queue.
- `client/src/i18n/locales`: English, Telugu, Hindi plus additional Indian languages.
- `client/public/brand` and `client/public/assets`: production brand marks and healthcare/nurse illustrations.

## Design tokens

Canonical portal tokens are defined in `client/src/portal/portal.css`: light primary `#1F8A4C`, strong `#176D3B`, soft `#E3F3E8`, bg `#F4F8F5`, surface `#FFFFFF`, border `#E2EBE5`, text `#13261B`, secondary `#4B5D52`, muted `#74857A`; dark bg `#0D1611`, surface `#142019`, primary `#3FBF74`. Portal radius 10/12/16 px and soft green shadow; body type is 15 px Plus Jakarta Sans with a system fallback. `client/src/styles/theme.css` additionally defines the shared light/dark semantic roles and Georgia headings. Mobile uses native system sans fonts and keeps the same color, spacing, radius, and hierarchy.

## Existing API families

The web client calls the existing envelope API: auth and easy patient auth; patients and sync; AI screening; screening case review; consultation availability, appointments and sessions; patient care and records; prescriptions/referrals/biopsy; notifications; hospitals, facility operations, admin doctors, invitations, assignments, village groups, specialists, camps, map and reports; consent, recovery, assistant, private storage, and mock Aadhaar. Mobile must use exact patient IDs and role scope, the same UUID mutation fields, and authenticated private-file access. The video adapter is unavailable until a real adapter exists.

## Mobile implementation stages

1. Shared theme, secure session, API envelope, simulation notice, and public/auth flows.
2. Role-aware native navigation and patient/doctor operational screens.
3. Administration and field-operation screens, with server-side scope and small-count suppression retained.
4. Typecheck, API payload review, and Android/iOS setup documentation.

The mobile interface does not transmit card images or full identity numbers. Any local-only identity reading requires a platform-specific implementation that keeps all identity content in memory and clears it after use.
