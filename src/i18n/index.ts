/**
 * @file src/i18n/index.ts
 * @description Initializes i18next for the audience-facing surface of the app
 * (AudienceView, Header, Footer, the login modal, GlobalLoader). Moderator,
 * Panel, and Stage stay English-only and never call useTranslation().
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import or from './locales/or.json';

export const STORAGE_KEY = 'qna_language';
export const SUPPORTED_LANGUAGES = ['en', 'hi', 'or'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

const resources = { en: { translation: en }, hi: { translation: hi }, or: { translation: or } };

// Dev-time guard: en/hi/or must expose the exact same set of translation
// keys. A missing key silently falls back to English at runtime, which is
// easy to miss -- fail loudly in development instead.
if (import.meta.env.DEV) {
  const flattenKeys = (obj: any, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === 'object' && value !== null ? flattenKeys(value, path) : [path];
    });

  const enKeys = new Set(flattenKeys(en));
  for (const [lang, resource] of [['hi', hi], ['or', or]] as const) {
    const keys = new Set(flattenKeys(resource));
    const missing = [...enKeys].filter(k => !keys.has(k));
    const extra = [...keys].filter(k => !enKeys.has(k));
    if (missing.length || extra.length) {
      console.error(
        `[i18n] "${lang}.json" is out of sync with "en.json".` +
        (missing.length ? ` Missing: ${missing.join(', ')}.` : '') +
        (extra.length ? ` Unexpected: ${extra.join(', ')}.` : '')
      );
    }
  }
}

const storedLanguage = (() => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(value || '') ? value! : null;
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false
});

document.documentElement.lang = storedLanguage || 'en';

export default i18n;
