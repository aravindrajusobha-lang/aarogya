import { PatientPortal } from './portal/patient/PatientPortal';
import { DoctorPortal } from './portal/doctor/DoctorPortal';
import { AdminPortal } from './portal/admin/AdminPortal';
import { HomePage, StaffLoginPage, PatientLoginPage as EasyPatientLoginPage } from './portal/public/PublicPages';
import { PatientRegisterPage } from './portal/public/PatientRegisterPage';
import React, { useState, useEffect } from 'react';
import { OfflineStatusIndicator } from './components/OfflineStatusIndicator';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { Sidebar } from './components/Sidebar';
import { NAV_ITEMS } from './components/navItems';
import { DashboardOverview } from './components/DashboardOverview';
import { AsrDistrictMap } from './components/AsrDistrictMap';
import { ScreeningManager } from './components/ScreeningManager';
import { TeleconsultationManager } from './components/TeleconsultationManager';
import { PatientManager } from './components/PatientManager';
import { AppointmentManager } from './components/AppointmentManager';
import { CampManager } from './components/CampManager';
import { CampPlanningManager } from './components/CampPlanningManager';
import { AssignmentManager } from './components/AssignmentManager';
import { VillageGroupManager } from './components/VillageGroupManager';
import { SpecialistDirectory } from './components/SpecialistDirectory';
import { HospitalManager } from './components/HospitalManager';
import { LocationAdminManager } from './components/LocationAdminManager';
import { InvitationManager } from './components/InvitationManager';
import { StaffFieldWorkerManagement } from './components/StaffFieldWorkerManagement';
import { NotificationCenter } from './components/NotificationCenter';
import { AccountRecoveryManager } from './components/AccountRecoveryManager';
import { ConsentManager } from './components/ConsentManager';
import { CapabilityMatrixViewer } from './components/CapabilityMatrixViewer';
import { AadhaarMockManager } from './components/AadhaarMockManager';
import { AuthPanel, AuthUser, AuthTokens } from './components/AuthPanel';
import { clearStoredAuth, readStoredAuth, storeAuth, validateAccessToken } from './utils/session';
import { AIRobotAssistant } from './components/AIRobotAssistant';
import AarogyaDrishtiIntro from './components/AarogyaDrishtiIntro';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PatientDashboard } from './pages/dashboards/PatientDashboard';
import { LiveVideoConsultationModal } from './components/LiveVideoConsultationModal';
import { AiOralHealthEngine } from './components/AiEngine/AiOralHealthEngine';
import { LanguagePreferenceModal } from './components/LanguagePreferenceModal';
import { ThemeToggle } from './components/ThemeToggle';
import { DailyConsultationPage } from './components/VideoConsultation';
import { LiveAppointmentRoom } from './components/LiveAppointmentRoom';
import { PATIENT_FORBIDDEN_TABS } from './config/roleNavigation';
import { LanguageCode, translations, getClientTranslation } from './i18n';

const jwtExpiryTime = (token?: string): number | null => {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return typeof data.exp === 'number' ? data.exp * 1000 : null;
  } catch {
    return null;
  }
};

const DemoRoomExpiry: React.FC<{ expiresAt: number; onExpire: () => void }> = ({ expiresAt, onExpire }) => {
  useEffect(() => {
    const timer = window.setTimeout(onExpire, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt, onExpire]);
  return null;
};

const PortalRedirect: React.FC<{ route: string }> = ({ route }) => {
  useEffect(() => {
    if (window.location.hash !== route) window.location.hash = route;
  }, [route]);
  return <div className="login-page-root" aria-live="polite">Opening portal…</div>;
};

const AppointmentConsultationRoute: React.FC<{
  appointmentId: string;
  inviteToken: string;
  accessToken: string;
  currentUser: AuthUser | null;
  currentLang: LanguageCode;
}> = ({ appointmentId, inviteToken, accessToken, currentUser, currentLang }) => {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; patientName?: string; expiresAt?: number; message?: string }>({ status: 'loading' });

  useEffect(() => {
    if (!currentUser) {
      sessionStorage.setItem('aarogya_post_login_route', window.location.hash);
      return;
    }
    const verify = async () => {
      try {
        const response = await fetch(`/api/v1/appointments/${encodeURIComponent(appointmentId)}/video-invite/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ token: inviteToken }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error?.message || 'This consultation link is unavailable.');
        setState({ status: 'ready', patientName: payload.data.patientName, expiresAt: new Date(payload.data.expiresAt).getTime() });
      } catch (error) {
        setState({ status: 'error', message: error instanceof Error ? error.message : 'This consultation link is unavailable.' });
      }
    };
    void verify();
  }, [appointmentId, inviteToken, accessToken, currentUser]);

  if (!currentUser) return <div className="login-page-root"><div className="login-card"><h2>Sign in to join your consultation</h2><p>The doctor’s appointment response and link are required before joining.</p><button className="login-submit-btn" onClick={() => (window.location.hash = '#/login')}>Go to sign in</button></div></div>;
  if (state.status === 'loading') return <div className="login-page-root" aria-live="polite">Checking appointment and consultation access…</div>;
  if (state.status === 'error' || !state.expiresAt) return <div className="login-page-root"><div className="login-card"><h2>Consultation link unavailable</h2><p>{state.message || 'This invitation has expired.'}</p><button className="login-submit-btn" onClick={() => (window.location.hash = currentUser.role === 'patient' ? '#/patient' : '#/doctor')}>Return to portal</button></div></div>;

  const role = currentUser.role === 'patient' ? 'patient' : 'medical_officer';
  const close = () => (window.location.hash = role === 'patient' ? '#/patient' : '#/doctor');
  return <>
    <LiveVideoConsultationModal
      consultationId={appointmentId}
      inviteToken={inviteToken}
      patientName={state.patientName || 'Patient'}
      doctorName={role === 'patient' ? 'Assigned Doctor' : currentUser.fullName}
      userRole={role}
      currentLang={currentLang}
      onClose={close}
    />
    <div style={{ position: 'fixed', top: 58, left: '50%', transform: 'translateX(-50%)', zIndex: 10001, background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74', borderRadius: 8, padding: '7px 12px', fontWeight: 700 }}>DEMO VIDEO CONSULTATION — appointment verified; link expires {new Date(state.expiresAt).toLocaleTimeString()}</div>
    <DemoRoomExpiry expiresAt={state.expiresAt} onExpire={close} />
  </>;
};

export type MainTabType =
  | 'dashboard'
  | 'asr-map'
  | 'screening'
  | 'ai-screening'
  | 'teleconsultation'
  | 'patients'
  | 'appointments'
  | 'camps'
  | 'camp-planning'
  | 'assignments'
  | 'staff-field-management'
  | 'village-groups'
  | 'specialists'
  | 'hospitals'
  | 'location-admin'
  | 'invitations'
  | 'notifications'
  | 'recovery'
  | 'consent'
  | 'matrix'
  | 'aadhaar'
  | 'diagnostics'
  | 'auth'
  | 'reports'
  | 'help';

export const App: React.FC = () => {
  const [lang, setLang] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem('aarogya_language');
      if (saved && ['en', 'te', 'hi'].includes(saved)) {
        return saved as LanguageCode;
      }
    } catch {}
    return 'te'; // Default to Telugu for ITDA Paderu Tribal Agency
  });

  // Language choice remains available in the header switcher. Avoid blocking
  // first render with a full-screen first-run dialog.
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);

  const dict = translations[lang] || translations.en;
  const t = (path: string) => getClientTranslation(dict, path);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('aarogya:language-change', { detail: lang }));
  }, [lang]);

  // Active Main Navigation Tab (ASR mapping UI removed)
  const [mainTab, setMainTab] = useState<MainTabType>('dashboard');

  // Cinematic Intro Animation State (Plays on initial opening of website; hidden for all roles after register/login)
  // Keep the intro available from its explicit launcher, but never block the
  // first page render with a dark full-screen animation. This also lets auth
  // deep links render immediately on a fresh browser session.
  const [showIntro, setShowIntro] = useState<boolean>(false);

  // Sidebar Layout State (Preserved Side Dashboard)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Supported 2D Animated Nurse Assistant ("Drishti AI") State (hidden by default)
  const [isNurseAssistantOpen, setIsNurseAssistantOpen] = useState<boolean>(() => {
    return localStorage.getItem('aarogya_va_open') === 'true';
  });

  const toggleNurseAssistant = () => {
    setIsNurseAssistantOpen((prev) => {
      const next = !prev;
      localStorage.setItem('aarogya_va_open', String(next));
      return next;
    });
  };

  // Authentication & Session State: validate stored session with backend on boot
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const stored = readStoredAuth();
      if (!stored.user || !stored.tokens?.accessToken) {
        if (!cancelled) { clearStoredAuth(); setAuthChecked(true); }
        return;
      }
      const validated = await validateAccessToken(stored.tokens.accessToken);
      if (cancelled) return;
      if (validated) {
        setCurrentUser(validated as AuthUser);
        setTokens(stored.tokens as AuthTokens);
        storeAuth(validated as any, stored.tokens as any);
      } else {
        clearStoredAuth();
        setCurrentUser(null);
        setTokens(null);
      }
      setAuthChecked(true);
    };
    void boot();
    return () => { cancelled = true; };
  }, []);

    const handleLoginSuccess = (user: AuthUser, userTokens: AuthTokens) => {
      setCurrentUser(user);
      setTokens(userTokens);
      storeAuth(user as any, userTokens as any);
    };

    const performLogout = async (destination = '#/login', replaceRoute = false) => {
      window.dispatchEvent(new Event('aarogya:stop-camera'));
      const logoutRequest = tokens?.accessToken
        ? fetch('/api/v1/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }).catch(() => undefined)
        : Promise.resolve();
      clearStoredAuth();
      setCurrentUser(null);
      setTokens(null);
      setIsNurseAssistantOpen(false);
      try { localStorage.removeItem('aarogya_va_open'); } catch { /* ignore */ }
      try { sessionStorage.removeItem('patient_booking_screening_id'); } catch { /* ignore */ }
      await Promise.race([logoutRequest, new Promise<void>((resolve) => window.setTimeout(resolve, 1500))]);
      if (replaceRoute) window.location.replace(`${window.location.pathname}${window.location.search}${destination}`);
      else window.location.hash = destination;
    };

    const handleLogout = () => performLogout();
    const handlePatientLogout = () => performLogout('#/patient/login', true);

    useEffect(() => {
      const expiresAt = jwtExpiryTime(tokens?.accessToken);
      if (!expiresAt) return;
      const destination = currentUser?.role?.toLowerCase().includes('patient') || currentUser?.role?.toLowerCase() === 'community_volunteer'
        ? '#/patient/login'
        : '#/login';
      let expired = false;
      const checkExpiry = () => {
        if (expired || Date.now() < expiresAt) return;
        expired = true;
        void performLogout(destination, destination === '#/patient/login');
      };
      const timer = window.setTimeout(checkExpiry, Math.max(0, expiresAt - Date.now()));
      document.addEventListener('visibilitychange', checkExpiry);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener('visibilitychange', checkExpiry);
      };
    }, [tokens?.accessToken, currentUser?.role]);

    const handleQuickDemoLogin = async (role?: 'asha' | 'doctor') => {
      // Explicit demo-account login only when user triggers it; never automatic.
      try {
        const targetRole = role || 'asha';
        const credentials =
          targetRole === 'doctor'
            ? { username: 'doctor.paderu', password: 'Doctor@2026' }
            : { username: 'asha.pad01', password: 'Asha@2026' };
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });
        const json = await res.json();
        if (json.success && json.data) {
          const authTokens: AuthTokens = {
            accessToken: json.data.accessToken || json.data.tokens?.accessToken,
            refreshToken: json.data.refreshToken || json.data.tokens?.refreshToken,
            deviceSessionId: json.data.deviceSessionId || json.data.tokens?.deviceSessionId || '',
          };
          handleLoginSuccess(json.data.user, authTokens);
        } else {
          window.location.hash = '#/login';
        }
      } catch {
        window.location.hash = '#/login';
      }
    };

  // Hash Route Listener for Role-Based Dashboards & Login
  const [currentRoute, setCurrentRoute] = useState<string>(() => window.location.hash || '#/');

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash || '#/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const resetMainDashboard = () => setMainTab('dashboard');
    window.addEventListener('aarogya:navigate-home', resetMainDashboard);
    return () => window.removeEventListener('aarogya:navigate-home', resetMainDashboard);
  }, []);

  const getPageTitle = (tab: MainTabType): Record<LanguageCode, string> => {
    const found = NAV_ITEMS.find((item) => item.id === tab);
    if (found) {
      return {
        en: found.label,
        te: found.labelTe || found.label,
        hi: found.labelHi || found.label,
        ta: found.labelTa || found.label,
        kn: found.labelKn || found.label,
        ml: found.labelMl || found.label,
      };
    }
    return {
      en: 'Aarogya-Drishti',
      te: 'ఆరోగ్య దృష్టి',
      hi: 'आरोग्य दृष्टि',
      ta: 'ஆரோக்கிய திருஷ்டி',
      kn: 'ಆರೋಗ್ಯ ದೃಷ್ಟಿ',
      ml: 'ആരോഗ്യ ദൃഷ്ടಿ',
    };
  };

    const activeTitle = getPageTitle(mainTab);

    // Omnipresent Multilingual AI Assistant Chatbot ("Drishti AI")
    const renderAssistant = (patientContext = false) => (
      <AIRobotAssistant
        currentLang={lang}
        onSelectLang={setLang}
        onNavigateTab={(tab) => {
          if (tab === 'home' || tab === 'landing') {
            window.location.hash = currentUser?.role?.toLowerCase() === 'patient' ? '#/patient' : '#/';
          } else if (tab === 'patient') {
            window.location.hash = '#/patient';
          } else if (tab === 'doctor') {
            window.location.hash = '#/doctor';
          } else if (tab === 'admin') {
            window.location.hash = '#/admin';
          } else if (tab === 'login') {
            window.location.hash = patientContext ? '#/patient/login' : '#/login';
          } else if (tab === 'register' || tab === 'patient-register') {
            window.location.hash = '#/patient/register';
          } else {
            setMainTab(tab as MainTabType);
          }
        }}
        isOpen={isNurseAssistantOpen}
        onClose={toggleNurseAssistant}
        authToken={tokens?.accessToken}
        currentUser={currentUser}
        isPatientContext={patientContext}
        onLoginSuccess={handleLoginSuccess}
        activeTab={patientContext ? (currentRoute.split('?')[0] === '#/patient/register' ? 'patient-register' : currentRoute.startsWith('#/patient') ? 'patient' : 'patient-home') : mainTab}
      />
    );

    // 0. OPENING CINEMATIC INTRO: Shown when first opening the website
    if (showIntro) {
      return (
        <AarogyaDrishtiIntro
          onComplete={() => {
            try {
              sessionStorage.setItem('aarogya_intro_seen', 'true');
            } catch {
              // ignore
            }
            setShowIntro(false);
          }}
        />
      );
    }

    const changePublicLang = (chosen: LanguageCode) => {
      setLang(chosen);
      try { localStorage.setItem('aarogya_language', chosen); localStorage.setItem('aarogya_lang_prompted', 'true'); } catch { /* ignore */ }
    };
    const homeForRole = (roleName?: string) => {
      const role = (roleName || '').toUpperCase();
      if (role.includes('ADMIN') || role === 'DISTRICT_OFFICER') return '#/admin';
      if (role === 'PATIENT' || role === 'COMMUNITY_VOLUNTEER') return '#/patient';
      if (role.includes('DOCTOR') || role.includes('MEDICAL') || role === 'HOSPITAL_MANAGER') return '#/doctor';
      return '#/';
    };
    const completeLogin = (user: AuthUser, userTokens: AuthTokens) => {
      handleLoginSuccess(user, userTokens);
      const returnRoute = sessionStorage.getItem('aarogya_post_login_route');
      if (returnRoute) { sessionStorage.removeItem('aarogya_post_login_route'); window.location.hash = returnRoute; return; }
      window.location.hash = homeForRole(user.role);
    };

    // 1A. ROUTE: /login — simple staff login (doctor / admin); patients use #/patient/login
    if (currentRoute.startsWith('#/login')) {
      if (currentUser) return <PortalRedirect route={homeForRole(currentUser.role)} />;
      return <StaffLoginPage lang={lang} onChangeLang={changePublicLang} onLoggedIn={({ user, tokens: userTokens }) => completeLogin(user, userTokens as AuthTokens)} />;
    }

    const patientAuthRoute = currentRoute.split('?')[0];
    if (['#/patient/login', '#/patient/register', '#/patient/forgot-password'].includes(patientAuthRoute)) {
      if (currentUser) return <PortalRedirect route="#/patient/dashboard" />;
      if (patientAuthRoute === '#/patient/register') {
        return <><PatientRegisterPage lang={lang} onChangeLang={changePublicLang} onRegistered={({ user, tokens: userTokens }) => completeLogin(user, userTokens as AuthTokens)} />{renderAssistant(true)}</>;
      }
      // Patients sign in with an OTP, so "forgot password" goes to the same simple login.
      return <><EasyPatientLoginPage lang={lang} onChangeLang={changePublicLang} onLoggedIn={({ user, tokens: userTokens }) => completeLogin(user, userTokens as AuthTokens)} />{renderAssistant(true)}</>;
    }

    if (currentRoute.startsWith('#/appointment-consultation/')) {
      const [routePath, routeQuery = ''] = currentRoute.slice(2).split('?');
      return <AppointmentConsultationRoute
        appointmentId={decodeURIComponent(routePath.split('/')[1] || '')}
        inviteToken={new URLSearchParams(routeQuery).get('invite') || ''}
        accessToken={tokens?.accessToken || ''}
        currentUser={currentUser}
        currentLang={lang}
      />;
    }

    if (currentRoute.startsWith('#/consultation/webrtc/')) {
      const appointmentId = decodeURIComponent(currentRoute.slice('#/consultation/webrtc/'.length).split('?')[0] || '');
      if (!currentUser) {
        sessionStorage.setItem('aarogya_post_login_route', currentRoute);
        return <div className="login-page-root"><div className="login-card"><h2>Sign in to join this appointment</h2><p>Only the assigned patient and doctor can enter the private room.</p><button className="login-submit-btn" onClick={() => (window.location.hash = '#/login')}>Go to sign in</button></div></div>;
      }
      const role = currentUser.role.toLowerCase();
      if (!['patient', 'medical_officer', 'specialist_doctor'].includes(role)) return <div className="login-page-root"><div className="login-card"><h2>This account cannot join this consultation.</h2></div></div>;
      if (!appointmentId) return <div className="login-page-root"><div className="login-card"><h2>This consultation is unavailable.</h2></div></div>;
      return <LiveAppointmentRoom appointmentId={appointmentId} role={role === 'patient' ? 'patient' : 'doctor'} onClose={() => (window.location.hash = role === 'patient' ? '#/patient/appointments' : '#/doctor')} />;
    }

  if (currentRoute.startsWith('#/consultation/direct/')) {
    const callId = decodeURIComponent(currentRoute.slice('#/consultation/direct/'.length).split('?')[0] || '');
    if (!currentUser) {
      sessionStorage.setItem('aarogya_post_login_route', currentRoute);
      return <div className="login-page-root"><div className="login-card"><h2>Sign in to join this video call</h2><p>Only the invited patient and calling doctor can enter this private room.</p><button className="login-submit-btn" onClick={() => (window.location.hash = '#/login')}>Go to sign in</button></div></div>;
    }
    const role = currentUser.role.toLowerCase();
    if (!['patient', 'medical_officer', 'specialist_doctor', 'doctor'].includes(role)) return <div className="login-page-root"><div className="login-card"><h2>This account cannot join this consultation.</h2></div></div>;
    if (!callId) return <div className="login-page-root"><div className="login-card"><h2>This video call is unavailable.</h2></div></div>;
    return <DailyConsultationPage directCallId={callId} role={role === 'patient' ? 'patient' : 'doctor'} currentLang={lang} onClose={() => (window.location.hash = role === 'patient' ? '#/patient' : '#/doctor')} />;
  }

  if (currentRoute.startsWith('#/consultation/appointment/')) {
    const appointmentId = decodeURIComponent(currentRoute.slice('#/consultation/appointment/'.length).split('?')[0] || '');
    if (!currentUser) {
      sessionStorage.setItem('aarogya_post_login_route', currentRoute);
      return <div className="login-page-root"><div className="login-card"><h2>Sign in to join this consultation</h2><p>Only the doctor assigned to this appointment can join from the doctor portal.</p><button className="login-submit-btn" onClick={() => (window.location.hash = '#/login')}>Go to sign in</button></div></div>;
    }
    const role = currentUser.role.toLowerCase();
    if (!['medical_officer', 'specialist_doctor', 'doctor'].includes(role)) return <div className="login-page-root"><div className="login-card"><h2>This account cannot join as the assigned doctor.</h2></div></div>;
    if (!appointmentId) return <div className="login-page-root"><div className="login-card"><h2>This consultation is unavailable.</h2></div></div>;
    return <DailyConsultationPage appointmentId={appointmentId} role="doctor" currentLang={lang} onClose={() => (window.location.hash = '#/doctor')} />;
  }

  if (currentRoute.startsWith('#/consultation/join/')) {
    const raw = decodeURIComponent(currentRoute.slice('#/consultation/join/'.length).split('?')[0] || '');
    if (!currentUser) {
      sessionStorage.setItem('aarogya_post_login_route', currentRoute);
      return <div className="login-page-root"><div className="login-card"><h2>Sign in to join your consultation</h2><p>Only the appointment patient and assigned doctor can enter this private room.</p><button className="login-submit-btn" onClick={() => (window.location.hash = '#/login')}>Go to sign in</button></div></div>;
    }
    const role = currentUser.role.toLowerCase();
    if (!['patient', 'medical_officer', 'specialist_doctor', 'doctor'].includes(role)) return <div className="login-page-root"><div className="login-card"><h2>This account cannot join this consultation.</h2></div></div>;
    return <DailyConsultationPage token={raw} role={role === 'patient' ? 'patient' : 'doctor'} currentLang={lang} onClose={() => (window.location.hash = role === 'patient' ? '#/patient' : '#/doctor')} />;
  }

    if (currentRoute.startsWith('#/consultation-demo/')) {
      return <div className="login-page-root"><div className="login-card" role="status"><h2>Demo video rooms are unavailable</h2><p>Open an online appointment confirmed by your assigned doctor to join a private live room.</p><button className="login-submit-btn" onClick={() => (window.location.hash = currentUser?.role?.toLowerCase() === 'patient' ? '#/patient/consult' : '#/doctor')}>Return to your portal</button></div></div>;
    }
    if (!authChecked) {
      return <div className="login-page-root" aria-live="polite">Checking session…</div>;
    }

    // Signed-out users must authenticate before accessing any dashboard/app route.
    // Logged-in users on "/" are sent to their role's home/portal.
    const isPatient = currentUser?.role?.toLowerCase() === 'patient';
    const isLandingRoute = currentRoute === '#/' || currentRoute === '' || currentRoute === '#/home';
    const getRoleHome = (role?: string) => {
      const r = (role || '').toUpperCase();
      if (r.includes('PATIENT') || r === 'COMMUNITY_VOLUNTEER') return '#/patient';
      if (r === 'DOCTOR' || r === 'SPECIALIST_DOCTOR' || r === 'MEDICAL_OFFICER' || r === 'CHIEF_MEDICAL_OFFICER' || r === 'HOSPITAL_MANAGER') return '#/doctor';
      if (r === 'SYSTEM_ADMIN' || r === 'ADMIN' || r === 'DISTRICT_OFFICER') return '#/admin';
      // Staff/frontline roles without a dedicated portal use the authenticated main workspace.
      return '#/';
    };

    if (!currentUser) {
      if (!currentRoute.startsWith('#/login') && !isLandingRoute) {
        return <PortalRedirect route="#/login" />;
      }
    } else if (isLandingRoute) {
      const home = getRoleHome(currentUser.role);
      if (home && (home as string) !== '#/' && home !== currentRoute) {
        return <PortalRedirect route={home} />;
      }
      // home '#/' falls through to main authenticated workspace below
    }

    if (isLandingRoute) {
      return (
        <>
          <HomePage lang={lang} onChangeLang={changePublicLang} />
          {renderAssistant(true)}
        </>
      );
    }

    // 2. ROUTE: /admin — rebuilt admin portal (doctor onboarding, credentials, verification)
    if (currentRoute.startsWith('#/admin')) {
      return (
        <>
          <ProtectedRoute
            allowedRoles={['ADMIN', 'SYSTEM_ADMIN', 'DISTRICT_OFFICER']}
            currentUser={currentUser}
            onRedirectToLogin={() => (window.location.hash = '#/login')}
          >
            <AdminPortal
              currentUser={currentUser}
              lang={lang}
              onChangeLang={(chosen) => { setLang(chosen); try { localStorage.setItem('aarogya_language', chosen); } catch { /* ignore */ } }}
              route={currentRoute}
              onLogout={handleLogout}
            />
          </ProtectedRoute>
        </>
      );
    }

    const changePortalLang = (chosen: LanguageCode) => {
      setLang(chosen);
      try { localStorage.setItem('aarogya_language', chosen); } catch { /* ignore */ }
    };

    // 3. ROUTE: /doctor — rebuilt doctor portal (schedule, start/end consultations, follow-ups)
    if (currentRoute.startsWith('#/doctor')) {
      return (
        <>
          <ProtectedRoute
            allowedRoles={['DOCTOR', 'SPECIALIST_DOCTOR', 'MEDICAL_OFFICER', 'CHIEF_MEDICAL_OFFICER', 'HOSPITAL_MANAGER']}
            currentUser={currentUser}
            onRedirectToLogin={() => (window.location.hash = '#/login')}
          >
            <DoctorPortal currentUser={currentUser} lang={lang} onChangeLang={changePortalLang} route={currentRoute} onLogout={handleLogout} />
          </ProtectedRoute>
        </>
      );
    }

    // 4. ROUTE: /patient — rebuilt patient portal
    if (currentRoute.startsWith('#/patient') || (isPatient && isLandingRoute)) {
      return (
        <>
          <ProtectedRoute
            allowedRoles={['PATIENT', 'COMMUNITY_VOLUNTEER']}
            currentUser={currentUser}
            onRedirectToLogin={() => (window.location.hash = '#/patient/login')}
          >
            <LanguagePreferenceModal
              isOpen={showLanguageModal}
              currentLang={lang}
              onSelectLanguage={(chosen) => {
                changePortalLang(chosen);
                try { localStorage.setItem('aarogya_lang_prompted', 'true'); } catch { /* ignore */ }
              }}
              onClose={() => setShowLanguageModal(false)}
            />
            <PatientPortal currentUser={currentUser} lang={lang} onChangeLang={changePortalLang} route={currentRoute.startsWith('#/patient') ? currentRoute : '#/patient'} onLogout={handlePatientLogout} />
          </ProtectedRoute>
          {renderAssistant(true)}
        </>
      );
    }

    // Role-based Access Guard: Block Citizen Patients from Administrative & Staff Workspace Tabs
    if (isPatient && (currentRoute.startsWith('#/admin') || currentRoute.startsWith('#/doctor') || PATIENT_FORBIDDEN_TABS.has(mainTab))) {
      return (
        <div className="login-page-root">
          <div className="login-card" style={{ textAlign: 'center' }}>
            <div className="login-logo" style={{ background: 'linear-gradient(135deg, #f43f5e, #be123c)' }}>
              ⚠️
            </div>
            <h2 className="login-title">Access Restricted</h2>
            <p className="login-sub">
              As a citizen patient, staff management and administrative workspaces are restricted. Please return to your Patient Portal.
            </p>
              <button
                type="button"
                className="login-submit-btn"
                onClick={() => {
                  window.location.hash = '#/patient';
                }}
                style={{ marginTop: '20px' }}
              >
                Return to Patient Dashboard
              </button>
          </div>
        </div>
      );
    }

    return (
      <div className="app-root-wrapper theme-study">
        <LanguagePreferenceModal
          isOpen={showLanguageModal}
          currentLang={lang}
          onSelectLanguage={(chosen) => {
            setLang(chosen);
            try {
              localStorage.setItem('aarogya_language', chosen);
              localStorage.setItem('aarogya_lang_prompted', 'true');
            } catch {}
          }}
          onClose={() => setShowLanguageModal(false)}
        />
        {/* Intro Animation Overlay */}
        {showIntro && <AarogyaDrishtiIntro onComplete={() => setShowIntro(false)} />}

        <div className="app-master-layout">
          {/* 2. Preserved Side Dashboard Navigation */}
          <Sidebar
            activeTab={mainTab}
            onSelectTab={(tabId) => setMainTab(tabId as MainTabType)}
            currentUser={currentUser}
            onLogout={handleLogout}
            currentLang={lang}
            onSelectLang={setLang}
            onOpenVoiceAssistant={toggleNurseAssistant}
            isVoiceAssistantActive={isNurseAssistantOpen}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          {/* 3. Main Content Workspace */}
          <main className={`main-content-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Top Header Bar */}
            <header className="app-topbar">
              <div className="topbar-left">
                <button
                  type="button"
                  className="mobile-menu-btn"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  title="Open Navigation Menu"
                  aria-label="Toggle navigation"
                >
                  ☰
                </button>
                <div className="topbar-title-wrap">
                  <h1>
                    <span>{activeTitle[lang]}</span>
                    {mainTab === 'aadhaar' && <span className="badge badge-mock">MOCK</span>}
                  </h1>
                  <span className="topbar-subtitle">
                    {lang === 'te'
                      ? 'ఐటీడీఏ పాడేరు గిరిజన ప్రాంత నోటి ఆరోగ్య ప్రాజెక్ట్ • తూర్పు కనుమలు'
                      : lang === 'hi'
                        ? 'आईटीडीए पाडेरु आदिवासी स्वास्थ्य परियोजना • पूर्वी घाट'
                        : 'ITDA Paderu Tribal Agency • Eastern Ghats Community Oral Health Screening'}
                  </span>
                </div>
              </div>

              <div className="topbar-right">
                {/* Role-Specific Clean Navbar (Hides unauthorized roles from Patient and Doctor Portals) */}
                {currentUser?.role?.toLowerCase() === 'patient' ? (
                  /* PATIENT PORTAL: Absolutely no Admin or Doctor elements */
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="button button-coral"
                      style={{ fontSize: '0.76rem', padding: '6px 12px', borderRadius: '8px' }}
                      onClick={handleLogout}
                      title="Sign Out Session"
                    >
                      🚪 {lang === 'te' ? 'లాగౌట్' : 'Sign Out'}
                    </button>
                  </div>
                ) : (currentUser?.role?.toLowerCase().includes('doctor') || currentUser?.role?.toLowerCase().includes('medical')) ? (
                  /* DOCTOR PORTAL: simplified topbar controls */
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        color: '#7dd3fc',
                        background: 'rgba(56, 189, 248, 0.16)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>👨‍⚕️</span>
                      <span>{lang === 'te' ? 'వైద్యాధికారుల పోర్టల్' : 'Medical Officer Portal'}</span>
                    </span>
                    <button
                      type="button"
                      className="button button-coral"
                      style={{ fontSize: '0.76rem', padding: '6px 12px', borderRadius: '8px' }}
                      onClick={handleLogout}
                      title="Sign Out Session"
                    >
                      🚪 {lang === 'te' ? 'లాగౌట్' : 'Sign Out'}
                    </button>
                  </div>
                ) : (
                  /* ADMIN PORTAL: simplified topbar controls */
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="button button-coral"
                      style={{ fontSize: '0.76rem', padding: '6px 12px', borderRadius: '8px' }}
                      onClick={handleLogout}
                      title="Sign Out Session"
                    >
                      🚪 Sign Out
                    </button>
                  </div>
                )}


                {/* Nurse Assistant Toggle Button: Hidden from dashboards */}
                <button
                  type="button"
                  className="btn-forest-voice button button-outline"
                  style={{ display: 'none' }}
                  onClick={toggleNurseAssistant}
                  title="Talk with 2D Animated Multilingual AI Robotic Assistant (Drishti AI)"
                >
                  <span>🤖</span>
                  <span>{isNurseAssistantOpen ? 'Hide AI Robot' : 'Drishti AI Robot'}</span>
                </button>

                {/* Online / Offline Sync Indicator */}
                {currentUser?.role?.toLowerCase() !== 'patient' && (
                  <OfflineStatusIndicator
                    onlineLabel={t('app.onlineNotice') || 'Online (Synced)'}
                    offlineLabel={t('app.offlineNotice') || 'Offline (Local Dexie)'}
                    accessToken={tokens?.accessToken || null}
                  />
                )}

                {/* Theme Mode Toggle (Light / Dark) */}
                <ThemeToggle currentLang={lang} />

                {/* Language Switcher */}
                <LanguageSwitcher currentLang={lang} onSelect={setLang} />
              </div>
            </header>

            {/* Active Workspace View */}
            <div className="workspace-container">
              {/* Keep the existing operations overview available to clinical and administrative staff. */}
              {mainTab === 'dashboard' && (
                <DashboardOverview
                  currentUser={currentUser}
                  onNavigate={(tab) => setMainTab(tab as MainTabType)}
                  onOpenVoiceAssistant={toggleNurseAssistant}
                  currentLang={lang}
                />
              )}

              {/* Keep the existing ASR district GIS map and camp-planning actions. */}
              {mainTab === 'asr-map' && (
                <AsrDistrictMap
                  currentLang={lang}
                  authToken={tokens?.accessToken}
                  onPlanCampForVillage={() => setMainTab('camps')}
                  onNavigateTab={(tab) => setMainTab(tab as MainTabType)}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

{/* VIEW: CLINICAL SCREENING & MO QUEUE */}
              {mainTab === 'screening' && (
                <ScreeningManager
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                  onRequireLogin={() => { window.location.hash = '#/login'; }}
                  onGoToAuth={() => { window.location.hash = '#/login'; }}
                />
              )}

              {/* VIEW: AI ORAL HEALTH SCREENING ENGINE (MODULE A + B + C) */}
              {mainTab === 'ai-screening' && (
                <AiOralHealthEngine
                  patientId={currentUser?.patientId || ''}
                  patientName={currentUser?.fullName || ''}
                  hospitalId={currentUser?.hospitalId}
                  userRole={currentUser?.role?.toLowerCase() || ''}
                  token={tokens?.accessToken || ''}
                  currentLang={lang}
                  onClose={() => setMainTab('hospitals')}
                />
              )}

              {/* VIEW: TELECONSULTATION */}
              {mainTab === 'teleconsultation' && (
                <TeleconsultationManager
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* VIEW: PATIENTS & OFFLINE SYNC */}
              {mainTab === 'patients' && (
                <PatientManager
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                  currentLang={lang}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* VIEW: OPD APPOINTMENTS */}
              {mainTab === 'appointments' && (
                <AppointmentManager
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* VIEW: OUTREACH CAMPS */}
              {mainTab === 'camps' && (
                <CampManager
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* VIEW: CAMP PLANNING */}
              {mainTab === 'camp-planning' && (
                <CampPlanningManager
                  currentLang={lang}
                  currentUser={currentUser}
                  authToken={tokens?.accessToken}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* Preserve jurisdiction management as its own existing workflow. */}
              {mainTab === 'assignments' && (
                <AssignmentManager
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* Additional combined staff management remains available alongside the existing workflows. */}
              {/* VIEW: STAFF & FIELD WORKER MANAGEMENT */}
              {mainTab === 'staff-field-management' && (
                <StaffFieldWorkerManagement
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* VIEW: VILLAGE GROUPS */}
              {mainTab === 'village-groups' && (
                <VillageGroupManager
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                />
              )}

              {/* VIEW: SPECIALISTS DIRECTORY */}
              {mainTab === 'specialists' && (
                <SpecialistDirectory
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* VIEW: HOSPITALS NETWORK */}
              {mainTab === 'hospitals' && (
                <HospitalManager
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* VIEW: LOCATION ADMIN */}
              {mainTab === 'location-admin' && (
                <LocationAdminManager
                  currentLang={lang}
                  currentUser={currentUser}
                  authToken={tokens?.accessToken}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* Preserve the existing staff invitation and onboarding workflow. */}
              {mainTab === 'invitations' && (
                <InvitationManager
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                />
              )}

              {/* VIEW: NOTIFICATION CENTER */}
              {mainTab === 'notifications' && (
                <NotificationCenter
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                />
              )}

              {/* VIEW: ACCOUNT RECOVERY */}
              {mainTab === 'recovery' && (
                <AccountRecoveryManager
                  accessToken={tokens?.accessToken || null}
                  currentUser={currentUser}
                />
              )}

              {/* VIEW: DPDP CONSENT */}
              {mainTab === 'consent' && (
                <ConsentManager
                  patientId={currentUser?.patientId || ''}
                  accessToken={tokens?.accessToken || ''}
                />
              )}

              {/* VIEW: RBAC CAPABILITY MATRIX */}
              {mainTab === 'matrix' && (
                <CapabilityMatrixViewer
                  currentRole={currentUser?.role || null}
                  userCapabilities={currentUser?.capabilities || []}
                  accessToken={tokens?.accessToken || null}
                />
              )}

              {/* VIEW: AADHAAR MOCK SERVICE */}
              {mainTab === 'aadhaar' && (
                <AadhaarMockManager
                  currentUser={currentUser}
                  accessToken={tokens?.accessToken || null}
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* VIEW: ARCHITECTURE DIAGNOSTICS */}
              {mainTab === 'diagnostics' && (
                <div className="card forest-card-panel" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                      Architecture Diagnostics &amp; Operational Probes
                    </h2>
                    <span className="badge badge-mock">SIMULATION HEALTH</span>
                  </div>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
                    Live infrastructure probes monitoring MongoDB replica set, ACID multi-document transactions, Pino PHI sanitization, and background Agenda scheduler.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '6px' }}>Database Replica Set</div>
                      <div style={{ color: '#059669', fontSize: '0.9rem', fontWeight: 600 }}>Active (Port 27017)</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        Supports ACID transactions and write concern majority.
                      </div>
                    </div>
                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '6px' }}>Background Scheduler</div>
                      <div style={{ color: '#059669', fontSize: '0.9rem', fontWeight: 600 }}>Agenda Engine Running</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        Automated screening expiry and sync reconciliation tasks.
                      </div>
                    </div>
                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '6px' }}>Privacy &amp; Security</div>
                      <div style={{ color: '#059669', fontSize: '0.9rem', fontWeight: 600 }}>Zero Public Storage</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        JWT-scoped file streaming &amp; Pino SHA-256 redaction.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: AUTH, SESSIONS & PROFILE */}
              {mainTab === 'auth' && (
                <AuthPanel
                  currentUser={currentUser}
                  tokens={tokens}
                  onLoginSuccess={handleLoginSuccess}
                  onLogout={handleLogout}
                  onNavigateToRecovery={() => setMainTab('recovery')}
                />
              )}

              {/* VIEW: MEDICAL REPORTS */}
              {mainTab === 'reports' && (
                currentUser?.role?.toLowerCase() === 'patient' ? (
                  <PatientDashboard
                    currentUser={currentUser}
                    onNavigateTab={(tab) => setMainTab(tab as MainTabType)}
                    currentLang={lang}
                    onOpenLanguageModal={() => setShowLanguageModal(true)}
                    initialTab="reports"
                  />
                ) : (
                  <div className="card forest-card-panel" style={{ padding: '24px' }}>
                    <div className="card-header" style={{ marginBottom: '16px' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                        {lang === 'te' ? 'క్లినికల్ మరియు మాండల్ GIS రిపోర్టులు' : 'Clinical & Mandal GIS Reports'}
                      </h2>
                      <span className="dash-status-pill status-completed">ANALYTICS</span>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem' }}>
                      Comprehensive screening aggregates across 22 mandals of Alluri Sitharama Raju District with small-count suppression (&lt; 5).
                    </p>
                  </div>
                )
              )}

              {/* VIEW: HELP AND SUPPORT */}
              {mainTab === 'help' && (
                <div className="card forest-card-panel" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                      {lang === 'te' ? 'సహాయం & మద్దతు డెస్క్' : lang === 'hi' ? 'सहायता एवं समर्थन केंद्र' : 'Help & Citizen Support Desk'}
                    </h2>
                    <span className="dash-status-pill status-completed">24/7 HELPLINE</span>
                  </div>

                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
                    Emergency assistance, frontline health worker coordination, and patient helpline for remote tribal agency settlements.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    <div className="card" style={{ padding: '18px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>🚑</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f87171' }}>Emergency Tribal Ambulance</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', margin: '4px 0' }}>108 / 104</div>
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Free 24/7 emergency transportation to CHC Paderu &amp; Area Hospital Araku.</div>
                    </div>

                    <div className="card" style={{ padding: '18px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>👩‍⚕️</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#34d399' }}>Assigned ASHA Worker</div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', margin: '4px 0' }}>Lakshmi Devi</div>
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Contact: +91 8912345674 • Dumbriguda Settlement Sub-Centre.</div>
                    </div>

                    <div className="card" style={{ padding: '18px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>🤖</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#38bdf8' }}>Dr. Drishti AI Assistant</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff', margin: '4px 0' }}>Voice &amp; Symptom Guide</div>
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Speak or chat in Telugu, Hindi, or English for instant clinic guidance.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* 4. Supported Multilingual 2D Animated AI Robotic Assistant ("Drishti AI") */}
      </div>
    );
  };

  export default App;
