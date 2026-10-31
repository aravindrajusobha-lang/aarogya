import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type SupportedLocale = 'en' | 'te' | 'hi';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'te', 'hi'];

function loadJson(locale: SupportedLocale): Record<string, unknown> {
  const filePath = path.join(__dirname, 'locales', `${locale}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export const dictionaries: Record<SupportedLocale, Record<string, unknown>> = {
  en: loadJson('en'),
  te: loadJson('te'),
  hi: loadJson('hi'),
};

export function getTranslation(keyPath: string, locale: SupportedLocale = 'en'): string {
  const dict = dictionaries[locale] || dictionaries.en;
  const parts = keyPath.split('.');
  let current: unknown = dict;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      // Fallback to English
      let fallback: unknown = dictionaries.en;
      for (const p of parts) {
        if (fallback && typeof fallback === 'object' && p in (fallback as Record<string, unknown>)) {
          fallback = (fallback as Record<string, unknown>)[p];
        } else {
          return keyPath;
        }
      }
      return typeof fallback === 'string' ? fallback : keyPath;
    }
  }

  return typeof current === 'string' ? current : keyPath;
}
