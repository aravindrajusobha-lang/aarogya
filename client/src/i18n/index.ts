import en from './locales/en.json';
import te from './locales/te.json';
import hi from './locales/hi.json';

export type LanguageCode = 'en' | 'te' | 'hi';

export const translations: Record<LanguageCode, typeof en> = {
  en,
  te,
  hi,
};

export function getClientTranslation(dict: typeof en, path: string): string {
  const keys = path.split('.');
  let current: any = dict;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}
