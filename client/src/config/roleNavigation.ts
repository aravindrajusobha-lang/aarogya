/**
 * Central Role-to-Menu Navigation Configuration
 * Single source of truth controlling visible navigation items, allowed routes,
 * and portal boundaries for each user role in Aarogya-Drishti.
 */

export interface RoleMenuItem {
  id: string;
  label: string;
  labelTe: string;
  labelHi: string;
  icon: string;
  badge?: string;
  targetTab?: string;
}

export type NormalizedRole = 'patient' | 'doctor' | 'admin' | 'health_worker';

export function normalizeUserRole(role?: string | null): NormalizedRole {
  const r = (role || '').toLowerCase();
  if (r.includes('admin') || r.includes('officer') && r.includes('district')) return 'admin';
  if (r.includes('doctor') || r.includes('medical') || r.includes('specialist') || r.includes('manager')) return 'doctor';
  if (r.includes('asha') || r.includes('anm') || r.includes('worker')) return 'health_worker';
  return 'patient';
}

/**
 * Patient-Only Allowed Menu Items (Part B specification)
 * Strictly contains only patient-relevant personal health items.
 */
export const PATIENT_PORTAL_MENU: RoleMenuItem[] = [
  {
    id: 'screening',
    label: 'New Screening / Upload Photo',
    labelTe: 'కొత్త స్క్రీనింగ్ / ఫోటో అప్‌లోడ్',
    labelHi: 'नई स्क्रीनिंग / फोटो अपलोड',
    icon: '📸',
    targetTab: 'screening',
  },
  {
    id: 'history',
    label: 'My Screening Results & History',
    labelTe: 'నా స్క్రీనింగ్ ఫలితాలు & చరిత్ర',
    labelHi: 'मेरे स्क्रीनिंग परिणाम और इतिहास',
    icon: '🩺',
    targetTab: 'history',
  },
  {
    id: 'appointments',
    label: 'My Appointments',
    labelTe: 'నా అపాయింట్‌మెంట్లు',
    labelHi: 'मेरे अपॉइंटमेंट',
    icon: '📅',
    targetTab: 'appointments',
  },
  {
    id: 'referrals',
    label: 'Referral & Follow-up Status',
    labelTe: 'రిఫరల్ & ఫాలో-అప్ స్థితి',
    labelHi: 'रेफरल एवं फॉलो-अप स्थिति',
    icon: '📋',
    targetTab: 'referrals',
  },
  {
    id: 'prescriptions',
    label: 'My Prescriptions',
    labelTe: 'నా ప్రిస్క్రిప్షన్లు',
    labelHi: 'मेरे डिजिटल पर्चे',
    icon: '💊',
    targetTab: 'prescriptions',
  },
  {
    id: 'hospitals',
    label: 'Nearby Hospitals & Emergency',
    labelTe: 'సమీప ఆసుపత్రులు & అత్యవసర సహాయం',
    labelHi: 'निकटतम अस्पताल एवं आपातकालीन सहायता',
    icon: '🏥',
    targetTab: 'hospitals',
  },
  {
    id: 'notifications',
    label: 'My Notifications',
    labelTe: 'నా నోటిఫికేషన్లు',
    labelHi: 'मेरी सूचनाएं',
    icon: '🔔',
    targetTab: 'notifications',
  },
  {
    id: 'auth',
    label: 'My Profile & Consent',
    labelTe: 'నా ప్రొఫైల్ & సమ్మతి',
    labelHi: 'मेरी प्रोफाइल एवं सहमति',
    icon: '👤',
    targetTab: 'profile',
  },
  {
    id: 'help',
    label: 'Help & Emergency (108/104)',
    labelTe: 'సహాయం & అత్యవసర హెల్ప్‌లైన్',
    labelHi: 'सहायता एवं हेल्पलाइन',
    icon: '❓',
    targetTab: 'help',
  },
];

/**
 * Doctor / Medical Officer Menu Items
 */
export const DOCTOR_PORTAL_MENU: RoleMenuItem[] = [
  { id: 'availability', label: 'My available slots', labelTe: '?? ???????? ??????', labelHi: '???? ?????? ???', icon: '?' },
  { id: 'patients', label: 'Patient ID lookup', labelTe: '???? ??? ????', labelHi: '???? ???? ???', icon: '?' },
  { id: 'queue', label: 'Clinical Review Queue', labelTe: 'క్లినికల్ సమీక్ష క్యూ', labelHi: 'क्लीनिकल समीक्षा कतार', icon: '🩺', badge: 'Active Queue' },
  { id: 'appointments', label: 'Doctor Appointments', labelTe: 'డాక్టర్ అపాయింట్‌మెంట్లు', labelHi: 'डॉक्टर अपॉइंटमेंट', icon: '📅' },
  { id: 'referrals', label: 'Patient Referrals', labelTe: 'రోగి రిఫరల్స్', labelHi: 'रोगी रेफरल', icon: '📋' },
  { id: 'biopsy', label: 'Biopsy Lab Status', labelTe: 'బయాప్సీ ల్యాబ్ స్థితి', labelHi: 'बायोप्सी लैब स्थिति', icon: '🔬' },
];

/**
 * Super Admin Menu Items
 */
export const ADMIN_PORTAL_MENU: RoleMenuItem[] = [
  { id: 'hospitals', label: 'Hospital Registry', labelTe: 'ఆసుపత్రుల రిజిస్ట్రీ', labelHi: 'अस्पताल रजिस्ट्री', icon: '🏥' },
  { id: 'doctors', label: 'Doctor Provisioning', labelTe: 'వైద్యుల కేటాయింపు', labelHi: 'डॉक्टर प्रावधान', icon: '👨‍⚕️' },
];

/**
 * Get navigation menu items strictly matching the user role.
 */
export function getMenuItemsForRole(role?: string | null): RoleMenuItem[] {
  const norm = normalizeUserRole(role);
  if (norm === 'admin') return ADMIN_PORTAL_MENU;
  if (norm === 'doctor') return DOCTOR_PORTAL_MENU;
  if (norm === 'health_worker') return DOCTOR_PORTAL_MENU;
  return PATIENT_PORTAL_MENU;
}

/**
 * Tabs and views forbidden to Citizen Patients (Part B specification).
 * Patients navigating to any of these will see an Access Denied guard.
 */
export const PATIENT_FORBIDDEN_TABS = new Set<string>([
  'patients',           // Staff Patient Directory / Table of all patients
  'camps',              // Camp Management
  'camp-planning',      // Camp Planning
  'staff-field-management', // Staff onboarding & worker jurisdiction (admin unified)
  'assignments',        // Worker Jurisdiction Assignments (legacy/direct routes)
  'village-groups',     // Village Groups
  'location-admin',     // Location Management
  'invitations',        // Staff Onboarding Invitations (legacy/direct routes)
  'recovery',           // Account Recovery Approvals
  'matrix',             // System Capability Matrix
  'aadhaar',            // Aadhaar Mock Manager
  'diagnostics',        // Architecture Diagnostics
]);

/**
 * Check if a tab is authorized for the given role.
 */
export function isTabAllowedForRole(role: string | null | undefined, tabId: string): boolean {
  const norm = normalizeUserRole(role);
  if (norm === 'admin' || norm === 'doctor' || norm === 'health_worker') {
    return true;
  }
  return !PATIENT_FORBIDDEN_TABS.has(tabId);
}

