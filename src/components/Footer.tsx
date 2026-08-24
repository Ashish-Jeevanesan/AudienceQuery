import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Heart, ScrollText } from 'lucide-react';

interface FooterProps {
  /** Shows a small "Logs" link, admin-only -- everyone else never sees it. */
  isAdmin?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ isAdmin }) => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-surface-secondary border-t border-divider mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[10px] tracking-tighter"
                style={{ backgroundColor: 'rgb(var(--primary))' }}
              >
                AQ
              </div>
              <span className="font-semibold text-primary">AudienceQuery</span>
            </div>
            <p className="text-sm text-secondary">
              {t('footer.tagline')}
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary text-sm">{t('footer.features')}</h3>
            <ul className="space-y-2 text-sm text-secondary">
              <li className="hover:text-[rgb(var(--primary))] transition-colors">{t('footer.featureLiveQna')}</li>
              <li className="hover:text-[rgb(var(--primary))] transition-colors">{t('footer.featureRealtime')}</li>
              <li className="hover:text-[rgb(var(--primary))] transition-colors">{t('footer.featureModeratorDashboard')}</li>
              <li className="hover:text-[rgb(var(--primary))] transition-colors">{t('footer.featureStageDisplay')}</li>
            </ul>
          </div>

          {/* Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary text-sm">{t('footer.info')}</h3>
            <ul className="space-y-2 text-sm text-secondary">
              <li>{t('footer.infoBuiltWith')}</li>
              <li>{t('footer.infoSupabase')}</li>
              <li>{t('footer.infoSse')}</li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-divider my-8"></div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-secondary">
          <p>{t('footer.copyright', { year: currentYear })}</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span>{t('footer.builtWith')}</span>
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              <span>{t('footer.forLiveEvents')}</span>
            </div>
            {isAdmin && (
              <Link to="/logs" className="flex items-center gap-1 text-muted hover:text-secondary transition-colors text-xs">
                <ScrollText className="w-3.5 h-3.5" />
                <span>Logs</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
