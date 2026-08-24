/**
 * @file src/i18n/localizedContent.ts
 * @description Resolves moderator-authored content (category names, event
 * title/subtitle) to the current UI language. This is distinct from the
 * i18next-driven UI-chrome translation (button labels, headings, etc.) --
 * it picks between hand-entered `nameHi`/`nameOr`-style fields on real data,
 * falling back to the canonical (English) value whenever a translation
 * wasn't entered.
 */

/**
 * Resolves the display text for a piece of translatable content given the
 * current language. Falls back to `canonical` whenever the language is
 * English, or the requested translation is missing/empty.
 */
export function getLocalizedText(canonical: string, hi: string | undefined, or: string | undefined, language: string): string {
  if (language === 'hi' && hi) return hi;
  if (language === 'or' && or) return or;
  return canonical;
}
