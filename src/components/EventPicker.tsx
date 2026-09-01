/**
 * @file src/components/EventPicker.tsx
 * @description Multi-Event Mode: the dropdown that lets a visitor pick which
 * event's Q&A they're joining, shown at a bare `/` visit (nothing selected)
 * and persistently alongside the current event elsewhere (Header) so
 * switching is always one click away. Arriving via a direct `/e/:joinCode`
 * link auto-selects that event here rather than hiding the picker -- see
 * `currentJoinCode`.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OpenEventSummary } from '../types';
import { getLocalizedText } from '../i18n/localizedContent';

interface EventPickerProps {
  openEvents: OpenEventSummary[];
  /** The joinCode of the event currently shown, if any -- pre-selects that option. */
  currentJoinCode?: string;
  onSelect: (joinCode: string) => void;
  /** `compact` fits inline in the Header's branding area; `full` is the larger standalone picker screen. */
  variant?: 'compact' | 'full';
  className?: string;
}

export const EventPicker: React.FC<EventPickerProps> = ({
  openEvents,
  currentJoinCode,
  onSelect,
  variant = 'compact',
  className = ''
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || 'en';

  const optionLabel = (evt: OpenEventSummary) => {
    const title = getLocalizedText(evt.title, evt.titleHi, evt.titleOr, language);
    const subtitle = getLocalizedText(evt.subtitle, evt.subtitleHi, evt.subtitleOr, language);
    return subtitle ? `${title} — ${subtitle} - ${evt.joinCode}` : `${title} - ${evt.joinCode}`;
  };

  const compactClass = 'text-xs font-bold bg-transparent border-none outline-none cursor-pointer truncate';
  const fullClass = 'input-base w-full';

  return (
    <select
      value={currentJoinCode && openEvents.some(e => e.joinCode === currentJoinCode) ? currentJoinCode : ''}
      onChange={(e) => { if (e.target.value) onSelect(e.target.value); }}
      className={`${variant === 'compact' ? compactClass : fullClass} ${className}`}
      style={variant === 'compact' ? { color: `rgb(var(--text-primary))` } : undefined}
      aria-label={t('eventPicker.choosePlaceholder')}
    >
      <option value="" disabled>{t('eventPicker.choosePlaceholder')}</option>
      {openEvents.map(evt => (
        <option key={evt.id} value={evt.joinCode}>{optionLabel(evt)}</option>
      ))}
    </select>
  );
};
