import * as SecureStore from 'expo-secure-store';
import type { Language } from './i18n';

const KEY = 'aarogya_language_v1';

function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'te' || value === 'hi';
}

export async function readLanguagePreference(): Promise<Language | null> {
  const value = await SecureStore.getItemAsync(KEY);
  return isLanguage(value) ? value : null;
}

export async function saveLanguagePreference(language: Language): Promise<void> {
  await SecureStore.setItemAsync(KEY, language);
}
