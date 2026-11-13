import React from 'react';
import { AuthUser } from './AuthPanel';
import { LanguageCode } from '../i18n';
import { NavItem, NAV_ITEMS, PATIENT_NAV_IDS, PATIENT_ITEM_LABELS } from './navItems';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: any) => void;
  currentUser: AuthUser | null;
  onLogout: () => void;
  currentLang: LanguageCode;
  onSelectLang: (lang: LanguageCode) => void;
  onOpenVoiceAssistant: () => void;
  isVoiceAssistantActive?: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onLogout,
  currentLang,
  onSelectLang,
  onOpenVoiceAssistant,
  isVoiceAssistantActive,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const isPatient = currentUser?.role?.toLowerCase() === 'patient';
  const userRole = (currentUser?.role || '').toUpperCase();
  const isAdmin = userRole.includes('ADMIN') || userRole.includes('SYSTEM');

  const getItemLabel = (item: NavItem): string => {
    if (isPatient && PATIENT_ITEM_LABELS[item.id]) {
      const pl = PATIENT_ITEM_LABELS[item.id];
      if (currentLang === 'te') return pl.labelTe;
      if (currentLang === 'hi') return pl.labelHi;
      return pl.label;
    }
    if (currentLang === 'te' && item.labelTe) return item.labelTe;
    if (currentLang === 'hi' && item.labelHi) return item.labelHi;
    if (currentLang === 'ta' && item.labelTa) return item.labelTa;
    if (currentLang === 'kn' && item.labelKn) return item.labelKn;
    if (currentLang === 'ml' && item.labelMl) return item.labelMl;
    return item.label;
  };

  const handleTabClick = (tabId: string) => {
    onSelectTab(tabId);
    if (window.innerWidth <= 1024) {
      onCloseMobile();
    }
  };

  const categories: { key: NavItem['category']; title: string; titleTe: string; titleHi: string; titleTa: string; titleKn: string; titleMl: string }[] = [
    { key: 'overview', title: 'Overview', titleTe: 'సమీక్ష', titleHi: 'अवलोकन', titleTa: 'மேலோட்டம்', titleKn: 'ಅವಲೋಕನ', titleMl: 'അവലോകനം' },
    { key: 'clinical', title: 'Clinical Care', titleTe: 'క్లినికల్ సంరక్షణ', titleHi: 'क्लिनिकल देखभाल', titleTa: 'மருத்துவப் பராமரிப்பு', titleKn: 'ಕ್ಲಿನಿಕಲ್ ಆರೈಕೆ', titleMl: 'ക്ലിനിക്കൽ പരിചരണം' },
    { key: 'field', title: 'Tribal Outreach', titleTe: 'గిరిజన క్షేత్ర విధులు', titleHi: 'आदिवासी आउटरीच', titleTa: 'பழங்குடியினர் தொடர்பு', titleKn: 'ಬುಡಕಟ್ಟು ಕ್ಷೇತ್ರ ಕಾರ್ಯ', titleMl: 'ഗോത്രവർഗ്ഗ മേഖല' },
    { key: 'governance', title: 'Governance & Security', titleTe: 'పాలన & భద్రత', titleHi: 'शासन एवं सुरक्षा', titleTa: 'ஆளுமை & பாதுகாப்பு', titleKn: 'ಆಡಳಿತ ಮತ್ತು ಭದ್ರತೆ', titleMl: 'ഭരണവും സുരക്ഷയും' },
    { key: 'account', title: 'Account Settings', titleTe: 'ఖాతా సెట్టింగులు', titleHi: 'खाता सेटिंग्स', titleTa: 'கணக்கு அமைப்புகள்', titleKn: 'ಖಾತೆ ಸೆಟ್ಟಿಂಗ್‌ಗಳು', titleMl: 'അക്കൗണ്ട് ക്രമീകരണങ്ങൾ' },
  ];

  // Governance & Admin settings are hidden from Doctors and only shown to Super Admins
  const visibleCategories = categories.filter((cat) => {
    if (cat.key === 'governance') {
      return isAdmin;
    }
    return true;
  });

  const patientGroups = [
    {
      key: 'overview',
      title: 'Overview',
      titleTe: 'సమీక్ష',
      titleHi: 'अवलोकन',
      itemIds: ['dashboard'],
    },
    {
      key: 'care',
      title: 'My Care & Consultations',
      titleTe: 'సంరక్షణ & సంప్రదింపులు',
      titleHi: 'देखभाल एवं परामर्श',
      itemIds: ['screening', 'appointments', 'specialists', 'hospitals'],
    },
    {
      key: 'records',
      title: 'My Health Records',
      titleTe: 'వైద్య రికార్డులు',
      titleHi: 'मेडिकल रिकॉर्ड',
      itemIds: ['patients', 'reports', 'consent'],
    },
    {
      key: 'support',
      title: 'Support & Profile',
      titleTe: 'మద్దతు & ప్రొఫైల్',
      titleHi: 'समर्थन एवं प्रोफाइल',
      itemIds: ['notifications', 'auth', 'help'],
    },
  ];

  const getCategoryTitle = (cat: { title: string; titleTe: string; titleHi: string; titleTa?: string; titleKn?: string; titleMl?: string }) => {
    if (currentLang === 'te') return cat.titleTe;
    if (currentLang === 'hi') return cat.titleHi;
    if (currentLang === 'ta' && cat.titleTa) return cat.titleTa;
    if (currentLang === 'kn' && cat.titleKn) return cat.titleKn;
    if (currentLang === 'ml' && cat.titleMl) return cat.titleMl;
    return cat.title;
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={`forest-sidebar ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-logo-wrap">
            <div
              className="brand-leaf-icon"
              title="Aarogya-Drishti Nature Canopy"
              style={{
                width: 36,
                height: 36,
                minWidth: 36,
                minHeight: 36,
                maxWidth: 36,
                maxHeight: 36,
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img src="/brand/aarogya-mark.png" alt="Aarogya-Drishti logo" width={36} height={36} style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </div>

            {!isCollapsed && (
              <div className="brand-text">
                <span className="brand-name">Aarogya-Drishti<span className="brand-period">.</span></span>
                <span className="brand-vernacular">
                  {currentLang === 'te' ? 'ఆరోగ్య దృష్టి' : currentLang === 'hi' ? 'आरोग्य दृष्टि' : 'ITDA Paderu'}
                </span>
                <span className="brand-tagline">Tribal Health Network</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label="Toggle sidebar collapse"
          >
            {isCollapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Voice Assistant Shortcut Card in Sidebar */}
        <div className="sidebar-voice-card">
          <button
            type="button"
            className={`voice-assistant-trigger ${isVoiceAssistantActive ? 'active-pulse' : ''}`}
            onClick={onOpenVoiceAssistant}
            title="Launch Drishti AI Assistant"
          >
            <div className="voice-avatar-thumb">
              <span className="voice-pulse-ring"></span>
              <span className="voice-icon">🤖</span>
            </div>
            {!isCollapsed && (
              <div className="voice-trigger-text">
                <div className="voice-trigger-title">
                  <span>Drishti AI</span>
                  <span className="voice-ai-pill">2D Assistant</span>
                </div>
                <div className="voice-trigger-sub">
                  {currentLang === 'te' ? 'AI అసిస్టెంట్‌తో మాట్లాడండి' : currentLang === 'hi' ? 'AI सहायक से बात करें' : 'Multilingual AI Guide'}
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Scrollable Navigation Groups */}
        <nav className="sidebar-nav">
          {isPatient ? (
            patientGroups.map((group) => {
              const items = NAV_ITEMS.filter(
                (item) => group.itemIds.includes(item.id) && PATIENT_NAV_IDS.has(item.id)
              );
              if (items.length === 0) return null;

              return (
                <div key={group.key} className="sidebar-group">
                  {!isCollapsed && (
                    <div className={`sidebar-group-header header-cat-${group.key}`}>
                      <span>{getCategoryTitle(group)}</span>
                    </div>
                  )}

                  <ul className="sidebar-group-list">
                    {items.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <li key={item.id} className="sidebar-item">
                          <button
                            type="button"
                            className={`sidebar-nav-btn nav-cat-${item.category} nav-item-${item.id} ${isActive ? 'active' : ''}`}
                            onClick={() => handleTabClick(item.id)}
                            title={getItemLabel(item)}
                            id={`nav-btn-${item.id}`}
                          >
                            <span className="sidebar-item-icon">
                              {PATIENT_ITEM_LABELS[item.id]?.icon || item.icon}
                            </span>

                            {!isCollapsed && (
                              <span className="sidebar-item-label">{getItemLabel(item)}</span>
                            )}

                            {isActive && <span className="active-leaf-indicator"></span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          ) : (
            visibleCategories.map((cat) => {
              const items = NAV_ITEMS.filter((item) => item.category === cat.key);
              if (items.length === 0) return null;

              return (
                <div key={cat.key} className="sidebar-group">
                  {!isCollapsed && (
                    <div className={`sidebar-group-header header-cat-${cat.key}`}>
                      <span>{getCategoryTitle(cat)}</span>
                    </div>
                  )}

                  <ul className="sidebar-group-list">
                    {items.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <li key={item.id} className="sidebar-item">
                          <button
                            type="button"
                            className={`sidebar-nav-btn nav-cat-${item.category} nav-item-${item.id} ${isActive ? 'active' : ''}`}
                            onClick={() => handleTabClick(item.id)}
                            title={getItemLabel(item)}
                            id={`nav-btn-${item.id}`}
                          >
                            <span className="sidebar-item-icon">{item.icon}</span>

                            {!isCollapsed && (
                              <span className="sidebar-item-label">{getItemLabel(item)}</span>
                            )}

                            {!isCollapsed && item.badge && (
                              <span
                                className={`sidebar-item-badge ${
                                  item.badgeType === 'mock' ? 'badge-mock-accent' : 'badge-emerald-accent'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}

                            {isActive && <span className="active-leaf-indicator"></span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </nav>

        {/* Bottom User Profile & Controls */}
        <div className="sidebar-footer">
          {/* Quick Language Switcher Pills */}
          <div className="sidebar-lang-pills">
            <button
              type="button"
              className={`lang-pill ${currentLang === 'en' ? 'active' : ''}`}
              onClick={() => onSelectLang('en')}
              title="English"
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-pill ${currentLang === 'te' ? 'active' : ''}`}
              onClick={() => onSelectLang('te')}
              title="Telugu (తెలుగు)"
            >
              తెలుగు
            </button>
            <button
              type="button"
              className={`lang-pill ${currentLang === 'hi' ? 'active' : ''}`}
              onClick={() => onSelectLang('hi')}
              title="Hindi (हिन्दी)"
            >
              हिन्दी
            </button>
            <button
              type="button"
              className={`lang-pill ${currentLang === 'ta' ? 'active' : ''}`}
              onClick={() => onSelectLang('ta')}
              title="Tamil (தமிழ்)"
            >
              தமிழ்
            </button>
            <button
              type="button"
              className={`lang-pill ${currentLang === 'kn' ? 'active' : ''}`}
              onClick={() => onSelectLang('kn')}
              title="Kannada (ಕನ್ನಡ)"
            >
              ಕನ್ನಡ
            </button>
            <button
              type="button"
              className={`lang-pill ${currentLang === 'ml' ? 'active' : ''}`}
              onClick={() => onSelectLang('ml')}
              title="Malayalam (മലയാളം)"
            >
              മലയാളം
            </button>
          </div>

          {/* User Account Strip */}
          {currentUser ? (
            <div className="sidebar-user-card">
              <div className="user-avatar-circle" title={currentUser.fullName || currentUser.username}>
                {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
              </div>

              {!isCollapsed && (
                <div className="user-details-wrap">
                  <span className="user-full-name">{currentUser.fullName || currentUser.username}</span>
                  <div className="user-role-line">
                    <span className="role-tag-forest">{currentUser.role.replace('_', ' ')}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="logout-icon-btn"
                onClick={onLogout}
                title="Log Out Session"
                aria-label="Logout"
              >
                ⎋
              </button>
            </div>
          ) : (
            <div className="sidebar-guest-card">
              <button
                type="button"
                className="guest-login-btn"
                onClick={() => handleTabClick('auth')}
              >
                🔐 {!isCollapsed ? 'Log In / Register' : 'Login'}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
