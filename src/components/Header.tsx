import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewRole, AppUser } from '../types';
import { Users, ShieldCheck, Mic, Monitor, RefreshCw, Sun, Moon, LogOut, MoreVertical } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  activeRole: ViewRole;
  setActiveRole: (role: ViewRole) => void;
  title: string;
  subtitle: string;
  isConnected: boolean;
  onResetDemo: () => void;
  pendingCount: number;
  pushedCount: number;
  answeringCount: number;
  currentUser: AppUser | null;
  onLogin: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeRole,
  setActiveRole,
  title,
  subtitle,
  isConnected,
  onResetDemo,
  pendingCount,
  pushedCount,
  answeringCount,
  currentUser,
  onLogin,
  onLogout
}) => {
  const { t } = useTranslation();

  const roleLabels: Record<string, string> = {
    panelist: t('header.panelView'),
    stage: t('header.stageView')
  };

  // Admin/moderator freely switch among all 4 views, exactly as before.
  // Panelist/Stage are dedicated restricted logins -- they never see a tab
  // switcher at all, only their own locked-in view.
  const canSwitchViews = currentUser?.role === 'admin' || currentUser?.role === 'moderator';
  const isLockedRole = currentUser?.role === 'panelist' || currentUser?.role === 'stage';
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  };

  const getTabClass = (role: ViewRole) => {
    const isActive = activeRole === role;
    const baseClass = 'px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 whitespace-nowrap';

    if (isActive) {
      return `${baseClass}`;
    }
    return `${baseClass} text-secondary hover:text-primary`;
  };

  const activeStyle = { backgroundColor: `rgb(var(--nav-active-background))`, color: `rgb(var(--nav-active-text))` };
  const activeIconStyle = { color: `rgb(var(--nav-active-icon))` };

  const BOTTOM_NAV_ITEMS: Array<{ role: ViewRole; label: string; icon: React.ReactNode; count: number }> = [
    { role: 'audience', label: t('header.audience'), icon: <Users className="w-5 h-5" />, count: 0 },
    { role: 'moderator', label: t('header.moderator'), icon: <ShieldCheck className="w-5 h-5" />, count: pendingCount },
    { role: 'panel', label: t('header.panel'), icon: <Mic className="w-5 h-5" />, count: pushedCount },
    { role: 'stage', label: t('header.stage'), icon: <Monitor className="w-5 h-5" />, count: answeringCount }
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-surface border-b border-divider">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ============== DESKTOP / TABLET (md and up): unchanged single-row header ============== */}
          <div className="hidden md:flex items-center justify-between h-20 gap-4">
            {/* LEFT: Logo & Branding */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div style={{
                backgroundColor: `rgb(var(--primary))`,
                color: `rgb(var(--primary-text))`
              }} className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base tracking-tighter shadow-md flex-shrink-0">
                AQ
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-primary truncate" style={{ color: `rgb(var(--text-primary))` }}>
                  {title}
                </h1>
                <p className="text-xs text-secondary truncate" style={{ color: `rgb(var(--text-tertiary))` }}>
                  {subtitle}
                </p>
              </div>
            </div>

            {/* CENTER: Navigation Tabs */}
            <nav className="flex items-center gap-2 flex-shrink-0">
              {isLockedRole ? (
                <span className={getTabClass(activeRole)} style={activeStyle}>
                  {activeRole === 'panel' ? <Mic className="w-4 h-4" style={activeIconStyle} /> : <Monitor className="w-4 h-4" style={activeIconStyle} />}
                  <span>{roleLabels[currentUser!.role]}</span>
                </span>
              ) : (
                <>
                  <button onClick={() => setActiveRole('audience')} className={getTabClass('audience')} style={activeRole === 'audience' ? activeStyle : {}}>
                    <Users className="w-4 h-4" style={activeRole === 'audience' ? activeIconStyle : {}} />
                    <span>{t('header.audience')}</span>
                  </button>

                  {!canSwitchViews ? (
                    <button
                      onClick={onLogin}
                      className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors flex items-center gap-2 whitespace-nowrap"
                      style={{ backgroundColor: `rgb(var(--primary))` }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--primary-hover))`}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--primary))`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t('header.login')}</span>
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setActiveRole('moderator')} className={getTabClass('moderator')} style={activeRole === 'moderator' ? activeStyle : {}}>
                        <ShieldCheck className="w-4 h-4" style={activeRole === 'moderator' ? activeIconStyle : {}} />
                        <span>{t('header.moderator')}</span>
                        {pendingCount > 0 && (
                          <span className="ml-1 px-2 py-0.5 text-xs rounded-full font-bold text-white" style={{ backgroundColor: `rgb(var(--danger))` }}>{pendingCount}</span>
                        )}
                      </button>
                      <button onClick={() => setActiveRole('panel')} className={getTabClass('panel')} style={activeRole === 'panel' ? activeStyle : {}}>
                        <Mic className="w-4 h-4" style={activeRole === 'panel' ? activeIconStyle : {}} />
                        <span>{t('header.panel')}</span>
                        {pushedCount > 0 && (
                          <span className="ml-1 px-2 py-0.5 text-xs rounded-full font-bold text-slate-900" style={{ backgroundColor: `rgb(var(--accent))` }}>{pushedCount}</span>
                        )}
                      </button>
                      <button onClick={() => setActiveRole('stage')} className={getTabClass('stage')} style={activeRole === 'stage' ? activeStyle : {}}>
                        <Monitor className="w-4 h-4" style={activeRole === 'stage' ? activeIconStyle : {}} />
                        <span>{t('header.stage')}</span>
                        {answeringCount > 0 && (
                          <span className="ml-1 px-2 py-0.5 text-xs rounded-full font-bold text-white" style={{ backgroundColor: `rgb(var(--primary))` }}>{answeringCount}</span>
                        )}
                      </button>
                    </>
                  )}
                </>
              )}
            </nav>

            {/* RIGHT: Status & Controls */}
            <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: `rgb(var(--surface-hover))` }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `rgb(var(--status-live))` }}></div>
                <span className="text-xs font-semibold text-secondary" style={{ color: `rgb(var(--text-secondary))` }}>
                  {isConnected ? t('header.live') : t('header.offline')}
                </span>
              </div>

              <LanguageSwitcher />

              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg transition-colors"
                style={{ color: `rgb(var(--text-secondary))`, backgroundColor: 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--surface-hover))`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title={t('header.toggleTheme')}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button
                onClick={onResetDemo}
                className="p-2 rounded-lg transition-colors"
                style={{ color: `rgb(var(--text-secondary))`, backgroundColor: 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--surface-hover))`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title={t('header.resetDemo')}
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              {currentUser && (
                <button
                  onClick={onLogout}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: `rgb(var(--text-secondary))`, backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--surface-hover))`}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title={t('header.signOut')}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* ============== MOBILE (below md): condensed bar + overflow menu ============== */}
          <div className="flex md:hidden items-center justify-between h-16 gap-3 relative">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div style={{
                backgroundColor: `rgb(var(--primary))`,
                color: `rgb(var(--primary-text))`
              }} className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs tracking-tighter shadow-md flex-shrink-0">
                AQ
              </div>
              <div className="min-w-0">
                <h1 className="text-xs font-bold text-primary truncate" style={{ color: `rgb(var(--text-primary))` }}>{title}</h1>
                {isLockedRole && (
                  <p className="text-[11px] font-semibold truncate" style={{ color: `rgb(var(--primary))` }}>{roleLabels[currentUser!.role]}</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-2.5 rounded-lg flex-shrink-0"
              style={{ color: `rgb(var(--text-secondary))`, backgroundColor: menuOpen ? `rgb(var(--surface-hover))` : 'transparent' }}
              aria-label="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
              <>
                {/* Full-screen invisible backdrop, closes the menu on outside tap */}
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-2xl border shadow-xl z-50 overflow-hidden bg-surface border-divider"
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="px-4 py-3 flex items-center justify-between border-b border-divider">
                    <span className="flex items-center gap-2 text-xs font-semibold text-secondary">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `rgb(var(--status-live))` }}></span>
                      {isConnected ? t('header.live') : t('header.offline')}
                    </span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <LanguageSwitcher />
                    </div>
                  </div>

                  <div className="py-1.5">
                    {!currentUser && (
                      <button
                        onClick={onLogin}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-left"
                        style={{ color: `rgb(var(--primary))` }}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{t('header.login')}</span>
                      </button>
                    )}

                    <button
                      onClick={toggleTheme}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-secondary text-left"
                    >
                      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      <span>{t('header.toggleTheme')}</span>
                    </button>

                    {canSwitchViews && (
                      <button
                        onClick={onResetDemo}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-secondary text-left"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>{t('header.resetDemo')}</span>
                      </button>
                    )}

                    {currentUser && (
                      <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-rose-500"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t('header.signOut')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation bar -- only for accounts with more than one
          screen to switch between. Logged-out visitors and locked panelist/
          stage accounts never see this, matching the desktop tab logic.
          NOTE: the matching spacer that keeps this from covering page
          content lives in App.tsx, at the very end of the page (after
          Footer) -- not here. A spacer placed immediately after Header
          only reserves space at the top of the page, not at the actual
          bottom of the scrollable content, so it would still let this
          fixed bar cover the last ~64px of the Footer on a long page. */}
      {canSwitchViews && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-divider flex"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {BOTTOM_NAV_ITEMS.map(item => {
            const isActive = activeRole === item.role;
            return (
              <button
                key={item.role}
                onClick={() => setActiveRole(item.role)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
                style={{ color: isActive ? `rgb(var(--nav-active-text))` : `rgb(var(--text-muted))` }}
              >
                {item.icon}
                <span className="text-[10.5px] font-semibold">{item.label}</span>
                {item.count > 0 && (
                  <span
                    className="absolute top-1 right-[22%] text-[9px] font-bold text-white rounded-full px-1.5 leading-tight"
                    style={{ backgroundColor: `rgb(var(--danger))` }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
};
