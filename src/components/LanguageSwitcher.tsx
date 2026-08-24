import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { STORAGE_KEY, SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';

// Each language is always shown in its own script, regardless of which
// language is currently active -- a Hindi speaker shouldn't need to read
// English to find "हिन्दी" in the list.
const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  hi: 'हिन्दी',
  or: 'ଓଡ଼ିଆ'
};

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as SupportedLanguage;
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable (private browsing, etc.) -- the
      // choice just won't persist across reloads, which is fine.
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Languages className="w-4 h-4" style={{ color: `rgb(var(--text-secondary))` }} />
      <select
        value={i18n.resolvedLanguage || 'en'}
        onChange={handleChange}
        aria-label={t('header.language')}
        title={t('header.language')}
        className="text-xs font-semibold rounded-lg px-2 py-1.5 outline-none border bg-surface text-secondary border-divider"
      >
        {SUPPORTED_LANGUAGES.map(code => (
          <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>
        ))}
      </select>
    </div>
  );
};
