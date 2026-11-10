import React, { useState, useEffect } from 'react';
import { SimulationBanner } from './components/SimulationBanner';
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
import { NotificationCenter } from './components/NotificationCenter';
import { AccountRecoveryManager } from './components/AccountRecoveryManager';
import { ConsentManager } from './components/ConsentManager';
import { CapabilityMatrixViewer } from './components/CapabilityMatrixViewer';
import { AadhaarMockManager } from './components/AadhaarMockManager';
import { AuthPanel, AuthUser, AuthTokens } from './components/AuthPanel';
import { AIRobotAssistant } from './components/AIRobotAssistant';
import AarogyaDrishtiIntro from './components/AarogyaDrishtiIntro';
import { DashboardLayout } from './components/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { LandingPage } from './pages/LandingPage';
import { PatientDashboard } from './pages/dashboards/PatientDashboard';
import { DoctorDashboard } from './pages/dashboards/DoctorDashboard';
import { AdminDashboard } from './pages/dashboards/AdminDashboard';
import { AiOralHealthEngine } from './components/AiEngine/AiOralHealthEngine';
import { PageTransition } from './components/PageTransition';
import { LanguagePreferenceModal } from './components/LanguagePreferenceModal';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageCode, translations, getClientTranslation } from './i18n';

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
      if (saved && ['en', 'te', 'hi', 'ta', 'kn', 'ml'].includes(saved)) {
        return saved as LanguageCode;
      }
    } catch {}
    return 'te'; // Default to Telugu for ITDA Paderu Tribal Agency
  });

  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('aarogya_lang_prompted');
    } catch {
      return false;
    }
  });

  const dict = translations[lang] || translations.en;
  const t = (path: string) => getClientTranslation(dict, path);

  // Active Main Navigation Tab (Defaulting to Command Dashboard)
  const [mainTab, setMainTab] = useState<MainTabType>('dashboard');

  // Cinematic Intro Animation State (Plays on initial opening of website; hidden for all roles after register/login)
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem('aarogya_intro_seen');
    } catch {
      return false;
    }
  });

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

  // Authentication & Session State (with resilient fallback for corrupted storage)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('aarogya_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('aarogya_user');
      return null;
    }
  });
  const [tokens, setTokens] = useState<AuthTokens | null>(() => {
    try {
      const saved = localStorage.getItem('aarogya_tokens');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('aarogya_tokens');
      return null;
    }
  });

    const handleLoginSuccess = (user: AuthUser, userTokens: AuthTokens) => {
      setCurrentUser(user);
      setTokens(userTokens);
      localStorage.setItem('aarogya_user', JSON.stringify(user));
      localStorage.setItem('aarogya_tokens', JSON.stringify(userTokens));
    };

    const handleLogout = async () => {
      if (tokens?.accessToken) {
        try {
          await fetch('/api/v1/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          });
        } catch {
          // Continue clearing client credentials
        }
      }
      setCurrentUser(null);
      setTokens(null);
      localStorage.removeItem('aarogya_user');
      localStorage.removeItem('aarogya_tokens');
    };

    const handleQuickDemoLogin = async (role?: 'asha' | 'doctor') => {
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
          setMainTab('auth');
        }
      } catch {
        setMainTab('auth');
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
    const renderAssistant = () => (
      <AIRobotAssistant
        currentLang={lang}
        onSelectLang={setLang}
        onNavigateTab={(tab) => {
          if (tab === 'home' || tab === 'landing') {
            window.location.hash = '#/';
          } else if (tab === 'patient') {
            window.location.hash = '#/patient';
          } else if (tab === 'doctor') {
            window.location.hash = '#/doctor';
          } else if (tab === 'admin') {
            window.location.hash = '#/admin';
          } else if (tab === 'login') {
            window.location.hash = '#/login';
          } else {
            setMainTab(tab as MainTabType);
          }
        }}
        isOpen={isNurseAssistantOpen}
        onClose={toggleNurseAssistant}
        authToken={tokens?.accessToken}
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
        activeTab={mainTab}
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

    // 1A. ROUTE: /login -> Dedicated Login Screen (Patient, Doctor, Admin)
    if (currentRoute.startsWith('#/login')) {
      return (
        <>
          <PageTransition routeKey="#/login">
            <SimulationBanner />
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
            <Login
              currentLang={lang}
              onSelectLang={(chosen) => {
                setLang(chosen);
                try {
                  localStorage.setItem('aarogya_language', chosen);
                } catch {}
              }}
              onLoginSuccess={(user, userTokens) => {
                handleLoginSuccess(user, userTokens);
                const role = (user.role || '').toUpperCase();
                if (role.includes('ADMIN')) window.location.hash = '#/admin';
                else if (role.includes('DOCTOR') || role.includes('MEDICAL')) window.location.hash = '#/doctor';
                else window.location.hash = '#/patient';
              }}
              onNavigateHome={() => (window.location.hash = '#/')}
              onPlayIntro={() => setShowIntro(true)}
            />
          </PageTransition>
          {renderAssistant()}
        </>
      );
    }

    // 1B. ROUTE: Public Landing Page (Home, Services, Camp Schedule, Why Us, Specialists)
    if (
      currentRoute === '#/' ||
      currentRoute === '' ||
      currentRoute === '#/home' ||
      (!currentUser &&
        !currentRoute.startsWith('#/admin') &&
        !currentRoute.startsWith('#/doctor') &&
        !currentRoute.startsWith('#/patient'))
    ) {
      return (
        <>
          <PageTransition routeKey="#/home">
            <SimulationBanner />
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
            <LandingPage
              currentLang={lang}
              onSelectLang={(chosen) => {
                setLang(chosen);
                try {
                  localStorage.setItem('aarogya_language', chosen);
                } catch {}
              }}
              currentUser={currentUser}
              onNavigateLogin={() => (window.location.hash = '#/login')}
              onNavigatePatient={() => (window.location.hash = '#/patient')}
              onNavigateDoctor={() => (window.location.hash = '#/doctor')}
              onNavigateAdmin={() => (window.location.hash = '#/admin')}
              onOpenScreening={() => {
                if (currentUser) {
                  window.location.hash = '#/patient';
                } else {
                  window.location.hash = '#/login';
                }
              }}
            />
          </PageTransition>
          {renderAssistant()}
        </>
      );
    }

    // 2. ROUTE: /admin
    if (currentRoute.startsWith('#/admin')) {
      return (
        <>
          <PageTransition routeKey="#/admin">
            <ProtectedRoute
              allowedRoles={['ADMIN', 'SYSTEM_ADMIN', 'DISTRICT_OFFICER']}
              currentUser={currentUser}
              onRedirectToLogin={() => (window.location.hash = '#/login')}
            >
              <DashboardLayout
                currentUser={currentUser}
                activeNav="overview"
                onNavSelect={(nav) => {
                  if (nav === 'reports') {
                    window.location.hash = '#/';
                    setMainTab('asr-map');
                  } else if (nav === 'audit') {
                    window.location.hash = '#/';
                    setMainTab('diagnostics');
                  }
                }}
                onLogout={handleLogout}
                onToggleAIAssistant={toggleNurseAssistant}
                title="Super Admin Command Portal"
              >
                <AdminDashboard
                  currentUser={currentUser}
                  onNavigateTab={(tab) => {
                    window.location.hash = '#/';
                    setMainTab(tab as any);
                  }}
                />
              </DashboardLayout>
            </ProtectedRoute>
          </PageTransition>
          {renderAssistant()}
        </>
      );
    }

    // 3. ROUTE: /doctor
    if (currentRoute.startsWith('#/doctor')) {
      return (
        <>
          <PageTransition routeKey="#/doctor">
            <ProtectedRoute
              allowedRoles={['DOCTOR', 'SPECIALIST_DOCTOR', 'MEDICAL_OFFICER', 'CHIEF_MEDICAL_OFFICER', 'HOSPITAL_MANAGER']}
              currentUser={currentUser}
              onRedirectToLogin={() => (window.location.hash = '#/login')}
            >
              <DashboardLayout
                currentUser={currentUser}
                activeNav="queue"
                onNavSelect={(nav) => {
                  if (nav === 'teleconsult') {
                    window.location.hash = '#/';
                    setMainTab('teleconsultation');
                  } else if (nav === 'referrals') {
                    window.location.hash = '#/';
                    setMainTab('screening');
                  }
                }}
                onLogout={handleLogout}
                onToggleAIAssistant={toggleNurseAssistant}
                title="Doctor Clinical Review Portal"
              >
                <DoctorDashboard
                  currentUser={currentUser}
                  currentLang={lang}
                  onNavigateTab={(tab) => {
                    window.location.hash = '#/';
                    setMainTab(tab as any);
                  }}
                />
              </DashboardLayout>
            </ProtectedRoute>
          </PageTransition>
          {renderAssistant()}
        </>
      );
    }

    // 4. ROUTE: /patient
    if (currentRoute.startsWith('#/patient')) {
      return (
        <>
          <PageTransition routeKey="#/patient">
            <ProtectedRoute
              allowedRoles={['PATIENT', 'COMMUNITY_VOLUNTEER']}
              currentUser={currentUser}
              onRedirectToLogin={() => (window.location.hash = '#/login')}
            >
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
              <DashboardLayout
                currentUser={currentUser}
                activeNav="patient-home"
                onNavSelect={(nav) => {
                  if (nav === 'screening') {
                    window.location.hash = '#/';
                    setMainTab('screening');
                  } else if (nav === 'appointments') {
                    window.location.hash = '#/';
                    setMainTab('appointments');
                  } else if (nav === 'records') {
                    window.location.hash = '#/';
                    setMainTab('patients');
                  }
                }}
                onLogout={handleLogout}
                onToggleAIAssistant={toggleNurseAssistant}
                title="Patient Healthcare Navigation Portal"
              >
                <PatientDashboard
                  currentUser={currentUser}
                  currentLang={lang}
                  onOpenLanguageModal={() => setShowLanguageModal(true)}
                  onToggleAIAssistant={toggleNurseAssistant}
                  onNavigateTab={(tab) => {
                    window.location.hash = '#/';
                    setMainTab(tab as any);
                  }}
                />
              </DashboardLayout>
            </ProtectedRoute>
          </PageTransition>
          {renderAssistant()}
        </>
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

        {/* 1. Mandatory Non-dismissible Simulation Header (AGENTS.md Invariant 2) */}
        <SimulationBanner />

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
                    <span
                      style={{
                        fontSize: '0.78rem',
                        color: '#6ee7b7',
                        background: 'rgba(16, 185, 129, 0.16)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>🌿</span>
                      <span>{lang === 'te' ? 'రోగి పోర్టల్' : 'Citizen Patient Portal'}</span>
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
                ) : (currentUser?.role?.toLowerCase().includes('doctor') || currentUser?.role?.toLowerCase().includes('medical')) ? (
                  /* DOCTOR PORTAL: Absolutely no Admin role on navbar */
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
                      className="button"
                      style={{
                        fontSize: '0.76rem',
                        padding: '5px 11px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
                      }}
                      onClick={() => {
                        window.location.hash = '#/';
                        setMainTab('ai-screening');
                      }}
                      title="Launch Multi-Disease AI Screening Engine"
                    >
                      🔬 AI Engine
                    </button>
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
                  /* ADMIN PORTAL: Super Admin elements strictly for Admin role */
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        color: '#fbbf24',
                        background: 'rgba(245, 158, 11, 0.16)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>🛡️</span>
                      <span>Super Admin</span>
                    </span>
                    <button
                      type="button"
                      className="button"
                      style={{
                        fontSize: '0.76rem',
                        padding: '5px 11px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
                      }}
                      onClick={() => {
                        window.location.hash = '#/';
                        setMainTab('ai-screening');
                      }}
                      title="Launch Multi-Disease AI Screening Engine"
                    >
                      🔬 AI Engine
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      style={{ fontSize: '0.76rem', padding: '5px 9px', borderRadius: '8px' }}
                      onClick={() => (window.location.hash = '#/admin')}
                      title="Open Super Admin Command Portal"
                    >
                      🛡️ Admin Dashboard
                    </button>
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
                <OfflineStatusIndicator
                  onlineLabel={t('app.onlineNotice') || 'Online (Synced)'}
                  offlineLabel={t('app.offlineNotice') || 'Offline (Local Dexie)'}
                  accessToken={tokens?.accessToken || null}
                />

                {/* Theme Mode Toggle (Light / Dark) */}
                <ThemeToggle currentLang={lang} />

                {/* Language Switcher */}
                <LanguageSwitcher currentLang={lang} onSelect={setLang} />
              </div>
            </header>

            {/* Active Workspace View */}
            <div className="workspace-container">
              {/* VIEW: OPERATIONS DASHBOARD (Role conditional: PatientDashboard for Patients, DashboardOverview for Clinical/Admin) */}
              {mainTab === 'dashboard' && (
                currentUser?.role?.toLowerCase() === 'patient' ? (
                  <PatientDashboard
                    currentUser={currentUser}
                    onNavigateTab={(tab) => setMainTab(tab as MainTabType)}
                    currentLang={lang}
                    onOpenLanguageModal={() => setShowLanguageModal(true)}
                  />
                ) : (
                  <DashboardOverview
                    currentUser={currentUser}
                    onNavigate={(tab) => setMainTab(tab as MainTabType)}
                    onOpenVoiceAssistant={toggleNurseAssistant}
                    currentLang={lang}
                  />
                )
              )}

              {/* VIEW: ASR DISTRICT GIS MAP */}
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
                  onRequireLogin={handleQuickDemoLogin}
                  onGoToAuth={() => setMainTab('auth')}
                />
              )}

              {/* VIEW: AI ORAL HEALTH SCREENING ENGINE (MODULE A + B + C) */}
              {mainTab === 'ai-screening' && (
                <AiOralHealthEngine
                  patientId="DEMO-PAD-8492"
                  patientName="Balaraju Somulu"
                  hospitalId={currentUser?.hospitalId || 'HOSP-PADERU-01'}
                  userRole={currentUser?.role?.toLowerCase() || 'asha'}
                  token={tokens?.accessToken || ''}
                  currentLang={lang}
                  onClose={() => setMainTab('dashboard')}
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

              {/* VIEW: WORKER JURISDICTION ASSIGNMENTS */}
              {mainTab === 'assignments' && (
                <AssignmentManager
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

              {/* VIEW: INVITATIONS */}
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
                  patientId="DEMO-PAD-8492"
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
        {renderAssistant()}
      </div>
    );
  };

  export default App;
