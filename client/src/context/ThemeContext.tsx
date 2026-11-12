import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  choice: ThemeChoice;
  resolvedTheme: ThemeMode;
  theme: ThemeMode; // Alias for resolvedTheme for backwards compatibility
  setChoice: (choice: ThemeChoice) => void;
  cycleTheme: () => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => {
    try {
      const saved = localStorage.getItem('aarogya_theme_choice') || localStorage.getItem('aarogya_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {}
    return 'light'; // Warm ivory is the first-visit default; saved choices remain respected.
  });

  const [systemTheme, setSystemTheme] = useState<ThemeMode>(getSystemTheme);

  // Listen to OS system color-scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'light' : 'dark');
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: ThemeMode = choice === 'system' ? systemTheme : choice;

  const setChoice = (newChoice: ThemeChoice) => {
    setChoiceState(newChoice);
    try {
      localStorage.setItem('aarogya_theme_choice', newChoice);
      localStorage.setItem('aarogya_theme', newChoice);
    } catch {}
  };

  const cycleTheme = () => {
    const cycleMap: Record<ThemeChoice, ThemeChoice> = {
      system: 'light',
      light: 'dark',
      dark: 'system',
    };
    setChoice(cycleMap[choice]);
  };

  const toggleTheme = () => {
    const next: ThemeChoice = resolvedTheme === 'dark' ? 'light' : 'dark';
    setChoice(next);
  };

  // Sync data-theme and data-theme-choice attributes on root and body elements
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-theme-choice', choice);
    document.body.setAttribute('data-theme', resolvedTheme);
    document.body.setAttribute('data-theme-choice', choice);

    if (resolvedTheme === 'light') {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    } else {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    }
  }, [resolvedTheme, choice]);

  return (
    <ThemeContext.Provider
      value={{
        choice,
        resolvedTheme,
        theme: resolvedTheme,
        setChoice,
        cycleTheme,
        toggleTheme,
        isDark: resolvedTheme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      choice: 'system',
      resolvedTheme: isLight ? 'light' : 'dark',
      theme: isLight ? 'light' : 'dark',
      setChoice: () => {},
      cycleTheme: () => {},
      toggleTheme: () => {},
      isDark: !isLight,
    };
  }
  return context;
};

export default ThemeContext;
