# Aarogya-Drishti mobile

Expo Router / React Native TypeScript client for the existing API. The web/backend implementation is reused through its API; this app does not duplicate backend business logic.

## Configure and run

1. Install Node.js 22.13 or newer. For local native builds, install Android Studio or Xcode.
2. From `mobile/`, run `npm install`.
3. Version 1.2 APKs connect to the API at `https://aarogya-drishti-l6fr.onrender.com` and open patient registration at `https://aarogya-frontend-8jkx.onrender.com`, as configured in `eas.json`. For a different deployment, configure the API and web app URLs:
   - Set `EXPO_PUBLIC_API_URL` in `.env` before building, or
   - On first launch, choose **Service settings** on the public home screen and enter the API base URL. The app stores this value in SecureStore. Set `EXPO_PUBLIC_WEB_APP_URL` in `.env` to change the Aadhaar registration website.
4. Start the existing API from `../server` and sign in with an existing demo account.
5. Run `npx expo start` for development. Use `npm run android` or `npm run ios` with a local native toolchain.

Use an HTTPS API endpoint for signed-in use. `localhost` on a physical phone refers to the phone, not the development computer. The API must be reachable from the phone. Avoid sending real patient information to an untrusted development tunnel.

## Android APK

`eas.json` contains a `preview` profile that produces an installable APK. The app is linked to EAS project `@bharathsimhareddyv19/aarogya-drishti`.

After dependencies are installed and Expo project access is available, run:

```powershell
npx eas-cli build --platform android --profile preview
```

When the build completes, download the APK from the build page or the EAS CLI link. The Android SDK and Android Studio bundled JDK are installed but are not on PATH. The distribution APK uses the existing EAS signing key so it can update earlier releases. The project owner explicitly approved the mobile source upload to Expo EAS for APK generation. The repository-level .easignore limits the build archive to mobile source and excludes environment files.

If `EXPO_PUBLIC_API_URL` is not supplied at build time, configure the API URL in the installed app before signing in.

## Implemented mobile workflows

- Required persistent simulation banner, copied brand marks, palette and spacing tokens.
- First-launch language selection (English, Telugu or Hindi), a public entry page, and separate patient, doctor, field-staff and admin sign-in entry points. The language preference is stored in SecureStore.
- Aadhaar self-registration opens the existing web registration route in the secure in-app browser. The browser flow captures card images and performs reading/autofill locally; the native app and backend do not receive Aadhaar digits or card images. Profile-only patient registration remains available in the app.
- Patient OTP login, patient registration, password reset, staff login and TOTP MFA; SecureStore session storage and rotated-token refresh.
- Patient appointment discovery, booking, cancellation, response to proposed times, consent-based screening photo submission, screening history, prescriptions, referrals, treatment plan, nearby-facility list, notifications, profile/preferences and support tickets.
- Doctor appointment responses and consultation start/end, follow-up completion, exact-ID record/screening access, patient-care assignment and transfer approval, clinician-authored prescriptions, availability management, referrals and lab-status lists.
- Health-worker patient registration, consented DEMO AI photo submission for an exact patient ID, assignments, camp and village directories.
- Admin doctor directory, private qualification-document upload and account provisioning, facility and hospital lists, aggregated report and map data.
- A SecureStore offline outbox for consented patient registrations and appointment requests, using the existing `/api/v1/sync/batch` idempotency service. Outbox data is separated by signed-in account.
- English, Telugu and Hindi language selection, large touch targets, loading, empty, retry and error states.

## Existing backend constraints

Streaming video and voice remain unavailable until real adapters are configured; the app does not simulate calls. Aadhaar digits and card images are not collected or uploaded by the native app; identity-card capture and processing stay inside the secure browser registration flow. Medical screening stays labeled DEMO AI and is kept separate from clinician-authored notes and prescriptions. Doctor patient records are opened by exact patient ID only. Aggregated reports and map data are rendered from the backend’s suppressed outputs.

The web client has additional legacy/system administration capabilities that do not yet have dedicated mobile workflows, including interactive GIS visualization, aggregate CSV/PDF report export, camp recommendations/worker allocation, village-group/location management, invitations, device administration, consent administration, recovery approvals, and assistant chat. Native facility inventory editing, camp planning/lifecycle controls, doctor verification, private clinical photos, prescription PDFs, and consultation follow-up forms are implemented in version 1.1. Some existing admin mutations also lack backend idempotency support; they are not silently reimplemented here.

## Verification

```powershell
npm run check
```

The mobile SDK compatibility check and TypeScript check pass. The repository smoke suite passed (24 tests), as did the secret scanner (5 tests). The signed Android APK build completed successfully on Expo EAS. The release bundle also passed local Hermes compilation. A live API session on a physical phone has not yet been verified.

## Latest Android build

- Version: 1.2.0 (Android `versionCode` 3)
- Build: https://expo.dev/accounts/bharathsimhareddyv19/projects/aarogya-drishti/builds/22ea813e-9aee-4571-b357-48f266ec2793
- Signed APK: https://expo.dev/artifacts/eas/nI1Akl7opJjbi8tMOSbmj4PFdedGs2_B6dwkvy2FvSc.apk
- Local copy: `releases/Aarogya-Drishti-1.2.0.apk`
- SHA-256: `EA48648E1AEFD31B7AF0B1130640C1E72DCA12ADD32F1F1DF4C813BB7D808FCB`
- Aadhaar registration opens `https://aarogya-frontend-8jkx.onrender.com/#/patient/register` in the in-app secure browser; the configured API remains `https://aarogya-drishti-l6fr.onrender.com`.

Install the APK on an Android phone. The reachable HTTPS API origin is already embedded, so service-address setup is only needed when using a different backend. The required simulation notice remains visible. The implementation and remaining parity gaps are documented above.

## Version 1.1 integration

- Live API: https://aarogya-drishti-l6fr.onrender.com
- Health probe verified successfully, including a connected database. The deployed backend explicitly returns `simulation: true`.
- Native records have dedicated screening, clinical-note, consultation, prescription, photo and audit-history views.
- Password sign-in is available for patient accounts with a password; registration can set an optional password. Field staff have a dedicated sign-in role choice. The current backend uses simulated SMS, so real cellular OTP delivery is a backend constraint.
- Native doctor verification/rejection, password reset, ward, medicine stock and equipment editors use existing scoped service endpoints.
- Build 1.1 uses versionCode 2 and the same signing key as 1.0.
