import React from 'react';
import { LanguageCode } from '../i18n';

interface LanguagePreferenceModalProps {
  isOpen: boolean;
  currentLang: LanguageCode;
  onSelectLanguage: (lang: LanguageCode) => void;
  onClose: () => void;
}

interface LanguageOption {
  code: LanguageCode;
  nativeName: string;
  englishName: string;
  subtext: string;
  badge?: string;
  icon: string;
}

const LANGUAGES: LanguageOption[] = [
  {
    code: 'te',
    nativeName: 'తెలుగు',
    englishName: 'Telugu',
    subtext: 'ఆంధ్రప్రదేశ్ మరియు ఐటిడిఎ పాడేరు గిరిజన ప్రాంతాల కోసం',
    badge: 'ప్రాధాన్యత భాష (Primary)',
    icon: '🌾',
  },
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    subtext: 'Standard healthcare navigation and reporting',
    icon: '🌐',
  },
  {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    subtext: 'सरल और सहज स्वास्थ्य पोर्टल इंटरफ़ेस',
    icon: '🇮🇳',
  },
  {
    code: 'ta',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
    subtext: 'எளிய தமிழ் இடைமுகம்',
    icon: '🏛️',
  },
  {
    code: 'kn',
    nativeName: 'ಕನ್ನಡ',
    englishName: 'Kannada',
    subtext: 'ಸರಳ ಕನ್ನಡ ಆರೋಗ್ಯ ಪೋರ್ಟಲ್',
    icon: '🌺',
  },
  {
    code: 'ml',
    nativeName: 'മലയാളം',
    englishName: 'Malayalam',
    subtext: 'ലളിതമായ ആരോഗ്യ പോർട്ടൽ',
    icon: '🌴',
  },
];

export const LanguagePreferenceModal: React.FC<LanguagePreferenceModalProps> = ({
  isOpen,
  currentLang,
  onSelectLanguage,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleLanguagePick = (code: LanguageCode) => {
    onSelectLanguage(code);
    try {
      localStorage.setItem('aarogya_language', code);
      localStorage.setItem('aarogya_lang_prompted', 'true');
    } catch {}
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(5, 15, 25, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'linear-gradient(160deg, #0b1f1a 0%, #0d1b2a 100%)',
          border: '1.5px solid rgba(16, 185, 129, 0.45)',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(16, 185, 129, 0.2)',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Header with Title in native languages */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.5)',
              fontSize: '26px',
              marginBottom: '10px',
            }}
          >
            🗣️
          </div>
          <h2
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              margin: '0 0 6px 0',
              color: '#34d399',
              letterSpacing: '-0.01em',
            }}
          >
            దయచేసి మీ భాషను ఎంచుకోండి
          </h2>
          <div style={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: 600 }}>
            कृपया अपनी भाषा चुनें • Select Your Language
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
            Aarogya-Drishti (ఆరోగ్య దృష్టి) — ITDA Paderu Tribal Health Initiative
          </p>
        </div>

        {/* 6 Language Tiles Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          {LANGUAGES.map((item) => {
            const isSelected = currentLang === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleLanguagePick(item.code)}
                style={{
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.25) 100%)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isSelected
                    ? '2px solid #10b981'
                    : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '14px',
                  padding: '14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  boxShadow: isSelected ? '0 4px 18px rgba(16, 185, 129, 0.3)' : 'none',
                }}
              >
                {item.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      fontSize: '0.62rem',
                      background: '#059669',
                      color: '#ffffff',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      fontWeight: 700,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                  <span
                    style={{
                      fontSize: '1.18rem',
                      fontWeight: 700,
                      color: isSelected ? '#34d399' : '#ffffff',
                    }}
                  >
                    {item.nativeName}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
                  {item.englishName}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.3, marginTop: '2px' }}>
                  {item.subtext}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            ℹ️ You can change your language anytime from the top bar.
          </span>
          <button
            type="button"
            onClick={() => handleLanguagePick(currentLang || 'te')}
            style={{
              background: '#10b981',
              color: '#022c22',
              border: 'none',
              padding: '10px 22px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
            }}
          >
            కొనసాగించండి • Continue →
          </button>
        </div>
      </div>
    </div>
  );
};

