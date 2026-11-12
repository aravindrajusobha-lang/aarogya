import React from 'react';
import { LanguageCode } from '../i18n';
import '../styles/LanguagePreferenceModal.css';

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
      className="language-preference-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-preference-title"
      style={{
        position: 'fixed',
        inset: '44px 0 0',
        zIndex: 999,
        backgroundColor: 'rgba(22, 54, 47, 0.18)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <div
        className="language-preference-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: 'calc(100vh - 60px)',
          overflowY: 'auto',
          background: 'linear-gradient(160deg, #ffffff 0%, #f4faf7 100%)',
          border: '1px solid #d6e5df',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 18px 48px rgba(24, 59, 53, 0.16)',
          color: '#193b35',
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
              background: '#e4f2ec',
              border: '1px solid #c5e1d5',
              fontSize: '26px',
              marginBottom: '10px',
            }}
          >
            🗣️
          </div>
          <h2
            id="language-preference-title"
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              margin: '0 0 6px 0',
              color: '#176b5b',
              letterSpacing: '-0.01em',
            }}
          >
            దయచేసి మీ భాషను ఎంచుకోండి
          </h2>
          <div style={{ fontSize: '1rem', color: '#536b63', fontWeight: 600 }}>
            कृपया अपनी भाषा चुनें • Select Your Language
          </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.84rem', color: '#657a73' }}>
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
                    ? '#e8f4ef'
                    : '#ffffff',
                  border: isSelected
                    ? '2px solid #176b5b'
                    : '1px solid #dce8e3',
                  borderRadius: '14px',
                  padding: '14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  boxShadow: isSelected ? '0 3px 12px rgba(23, 107, 91, 0.12)' : 'none',
                }}
              >
                {item.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      fontSize: '0.62rem',
                      background: '#f3e7c5',
                      color: '#654c1b',
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
                      color: isSelected ? '#145b4d' : '#253b32',
                    }}
                  >
                    {item.nativeName}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#465e56', fontWeight: 600 }}>
                  {item.englishName}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#667a73', lineHeight: 1.3, marginTop: '2px' }}>
                  {item.subtext}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderTop: '1px solid #e1e9e5', paddingTop: '16px' }}>
          <span style={{ fontSize: '0.78rem', color: '#60716b' }}>
            ℹ️ You can change your language anytime from the top bar.
          </span>
          <button
            type="button"
            onClick={() => handleLanguagePick(currentLang || 'te')}
            style={{
              background: '#176b5b',
              color: '#ffffff',
              border: 'none',
              padding: '10px 22px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(23, 107, 91, 0.18)',
            }}
          >
            కొనసాగించండి • Continue →
          </button>
        </div>
      </div>
    </div>
  );
};

