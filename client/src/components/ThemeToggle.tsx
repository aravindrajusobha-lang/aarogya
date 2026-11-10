import React from 'react';
import { useTheme, ThemeChoice } from '../context/ThemeContext';
import { LanguageCode } from '../i18n';

export interface ThemeToggleProps {
  currentLang?: LanguageCode;
  compact?: boolean;
  className?: string;
  variant?: 'cycle' | 'segmented';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  currentLang = 'te',
  compact = false,
  className = '',
  variant = 'cycle',
}) => {
  const { choice, resolvedTheme, setChoice, cycleTheme } = useTheme();

  const labels = {
    light: {
      te: 'వెలుతురు',
      en: 'Light',
      hi: 'लाइट',
    }[currentLang as 'te' | 'en' | 'hi'] || 'Light',
    dark: {
      te: 'చీకటి',
      en: 'Dark',
      hi: 'डार्क',
    }[currentLang as 'te' | 'en' | 'hi'] || 'Dark',
    system: {
      te: 'సిస్టమ్',
      en: 'System',
      hi: 'सिस्टम',
    }[currentLang as 'te' | 'en' | 'hi'] || 'System',
  };

  const getIcon = (t: ThemeChoice) => {
    if (t === 'light') return '☀️';
    if (t === 'dark') return '🌙';
    return '💻';
  };

  if (variant === 'segmented') {
    return (
      <div
        className={`theme-segmented-group ${className}`}
        role="radiogroup"
        aria-label="Theme mode selector"
        style={{
          display: 'inline-flex',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '2px',
          gap: '2px',
        }}
      >
        {(['system', 'light', 'dark'] as ThemeChoice[]).map((mode) => {
          const isSelected = choice === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setChoice(mode)}
              title={`${labels[mode]} Mode`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: compact ? '4px 8px' : '5px 11px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                border: 'none',
                background: isSelected ? 'var(--surface)' : 'transparent',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: isSelected ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{getIcon(mode)}</span>
              {!compact && <span>{labels[mode]}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  // Single Cycle Button (Cycles System -> Light -> Dark -> System)
  const nextChoice: Record<ThemeChoice, ThemeChoice> = {
    system: 'light',
    light: 'dark',
    dark: 'system',
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={`theme-toggle-btn ${className}`}
      title={`Current: ${labels[choice]} (${resolvedTheme}). Click to switch to ${labels[nextChoice[choice]]}`}
      aria-label="Toggle theme mode"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: compact ? '6px 10px' : '7px 14px',
        borderRadius: '20px',
        fontSize: '0.8rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        background: 'var(--surface-2)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
      }}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>{getIcon(choice)}</span>
      {!compact && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span>{labels[choice]}</span>
          {choice === 'system' && (
            <span
              style={{
                fontSize: '0.68rem',
                opacity: 0.8,
                padding: '1px 5px',
                borderRadius: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              {resolvedTheme === 'light' ? '☀️' : '🌙'}
            </span>
          )}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;
