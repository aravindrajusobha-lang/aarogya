import { getClientTranslation, translations, LanguageCode } from '../i18n';
export function doctorWorkflowText(key: string): string {
  const language = (localStorage.getItem('aarogya_language') || 'en') as LanguageCode;
  const path = `doctorWorkflow.${key}`;
  const text = getClientTranslation(translations[language] || translations.en, path);
  return text === path ? getClientTranslation(translations.en, path) : text;
}
