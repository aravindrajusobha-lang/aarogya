import React, { useEffect, useRef, useState } from 'react';
import { readStoredAuth } from '../utils/session';
import { getClientTranslation, LanguageCode, translations } from '../i18n';
import './BackButton.css';

const currentHash = () => window.location.hash || '#/';
const routePath = (hash: string) => (hash.split('?')[0].replace(/\/+$/, '') || '#/').toLowerCase();
const hiddenPaths = new Set(['#/', '#/home', '#/login', '#/patient/login', '#/register', '#/forgot-password', '#/reset-password']);

function fallbackRoute(hash: string): string {
  if (routePath(hash).startsWith('#/patient')) return '#/patient/dashboard';
  const role = readStoredAuth().user?.role?.toLowerCase() || '';
  if (role.includes('patient') || role === 'community_volunteer') return '#/patient/dashboard';
  if (role.includes('doctor') || role.includes('medical') || role.includes('manager')) return '#/doctor';
  if (role.includes('admin') || role.includes('officer')) return '#/admin';
  return '#/';
}

function languageFromStorage(): LanguageCode {
  try {
    const language = localStorage.getItem('aarogya_language');
    if (language && ['en', 'te', 'hi', 'ta', 'kn', 'ml'].includes(language)) return language as LanguageCode;
  } catch { /* use English when storage is unavailable */ }
  return 'en';
}

export const BackButton: React.FC = () => {
  const [route, setRoute] = useState(currentHash);
  const [language, setLanguage] = useState(languageFromStorage);
  const historyStack = useRef<string[]>([currentHash()]);
  const traversingHistory = useRef(false);

  useEffect(() => {
    const onPopState = () => { traversingHistory.current = true; };
    const onHashChange = () => {
      const nextRoute = currentHash();
      if (traversingHistory.current) {
        traversingHistory.current = false;
        const previousIndex = historyStack.current.lastIndexOf(nextRoute);
        historyStack.current = previousIndex >= 0
          ? historyStack.current.slice(0, previousIndex + 1)
          : [...historyStack.current.slice(0, -1), nextRoute];
      } else if (historyStack.current[historyStack.current.length - 1] !== nextRoute) {
        historyStack.current.push(nextRoute);
      }
      setRoute(nextRoute);
    };
    const onLanguageChange = (event: Event) => {
      const next = (event as CustomEvent<LanguageCode>).detail;
      setLanguage(next || languageFromStorage());
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('aarogya:language-change', onLanguageChange);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('aarogya:language-change', onLanguageChange);
    };
  }, []);

  const path = routePath(route);
  if (hiddenPaths.has(path)) return null;

  const goBack = () => {
    if (historyStack.current.length > 1) {
      window.history.back();
      return;
    }
    const destination = fallbackRoute(route);
    if (destination === '#/') window.dispatchEvent(new CustomEvent('aarogya:navigate-home'));
    if (currentHash() !== destination) window.location.hash = destination;
  };

  const label = getClientTranslation(translations[language] || translations.en, 'patientActions.back');
  return (
    <button type="button" className="global-back-button" onClick={goBack} aria-label="Go back">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      <span>{label === 'patientActions.back' ? 'Back' : label}</span>
    </button>
  );
};

export const GlobalNavigationShell: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [route, setRoute] = useState(currentHash);
  useEffect(() => {
    const update = () => setRoute(currentHash());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const hidden = hiddenPaths.has(routePath(route));
  const patientRoute = routePath(route).startsWith('#/patient');
  return (
    <div className={`global-navigation-shell${hidden ? '' : ' has-back-button'}${patientRoute ? ' patient-route' : ''}`}>
      {children}
      {!hidden && <BackButton />}
    </div>
  );
};

export default BackButton;
