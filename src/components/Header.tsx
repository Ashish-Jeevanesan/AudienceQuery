import React, { useState } from 'react';
import { ViewRole, AppUser } from '../types';
import { Users, ShieldCheck, Mic, Monitor, RefreshCw, Sun, Moon, LogOut } from 'lucide-react';

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

const ROLE_LABELS: Record<string, string> = {
  panelist: 'Panel View',
  stage: 'Stage View'
};

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
  // Admin/moderator freely switch among all 4 views, exactly as before.
  // Panelist/Stage are dedicated restricted logins -- they never see a tab
  // switcher at all, only their own locked-in view.
  const canSwitchViews = currentUser?.role === 'admin' || currentUser?.role === 'moderator';
  const isLockedRole = currentUser?.role === 'panelist' || currentUser?.role === 'stage';
  const [isDark, setIsDark] = useState(false);

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

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-divider">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main header row */}
        <div className="flex items-center justify-between h-20 gap-4">
          {/* LEFT: Logo & Branding */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Logo icon */}
            <div style={{ 
              backgroundColor: `rgb(var(--primary))`,
              color: `rgb(var(--primary-text))`
            }} className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base tracking-tighter shadow-md flex-shrink-0">
              AQ
            </div>
            {/* Text branding */}
            <div className="min-w-0 hidden sm:block">
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
              // Panelist/Stage: a dedicated restricted login locked to one
              // view -- no tab switcher, not even a disabled one, since
              // these accounts shouldn't see that other views exist.
              <span
                className={getTabClass(activeRole)}
                style={{
                  backgroundColor: `rgb(var(--nav-active-background))`,
                  color: `rgb(var(--nav-active-text))`
                }}
              >
                {activeRole === 'panel'
                  ? <Mic className="w-4 h-4" style={{ color: `rgb(var(--nav-active-icon))` }} />
                  : <Monitor className="w-4 h-4" style={{ color: `rgb(var(--nav-active-icon))` }} />}
                <span>{ROLE_LABELS[currentUser!.role]}</span>
              </span>
            ) : (
              <>
                {/* Audience Tab */}
                <button
                  onClick={() => setActiveRole('audience')}
                  className={getTabClass('audience')}
                  style={activeRole === 'audience' ? {
                    backgroundColor: `rgb(var(--nav-active-background))`,
                    color: `rgb(var(--nav-active-text))`
                  } : {}}
                >
                  <Users className="w-4 h-4" style={activeRole === 'audience' ? { color: `rgb(var(--nav-active-icon))` } : {}} />
                  <span>Audience</span>
                </button>

                {/* Moderator/Panel/Stage tabs only exist for admin/moderator
                    accounts; everyone else just gets a Login button. */}
                {!canSwitchViews ? (
                  <button
                    onClick={onLogin}
                    className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors flex items-center gap-2 whitespace-nowrap"
                    style={{ backgroundColor: `rgb(var(--primary))` }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--primary-hover))`}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--primary))`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Login</span>
                  </button>
                ) : (
                  <>
                    {/* Moderator Tab */}
                    <button
                      onClick={() => setActiveRole('moderator')}
                      className={getTabClass('moderator')}
                      style={activeRole === 'moderator' ? {
                        backgroundColor: `rgb(var(--nav-active-background))`,
                        color: `rgb(var(--nav-active-text))`
                      } : {}}
                    >
                      <ShieldCheck className="w-4 h-4" style={activeRole === 'moderator' ? { color: `rgb(var(--nav-active-icon))` } : {}} />
                      <span>Moderator</span>
                      {pendingCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 text-xs rounded-full font-bold text-white" style={{ backgroundColor: `rgb(var(--danger))` }}>
                          {pendingCount}
                        </span>
                      )}
                    </button>

                    {/* Panel Tab */}
                    <button
                      onClick={() => setActiveRole('panel')}
                      className={getTabClass('panel')}
                      style={activeRole === 'panel' ? {
                        backgroundColor: `rgb(var(--nav-active-background))`,
                        color: `rgb(var(--nav-active-text))`
                      } : {}}
                    >
                      <Mic className="w-4 h-4" style={activeRole === 'panel' ? { color: `rgb(var(--nav-active-icon))` } : {}} />
                      <span>Panel</span>
                      {pushedCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 text-xs rounded-full font-bold text-slate-900" style={{ backgroundColor: `rgb(var(--accent))` }}>
                          {pushedCount}
                        </span>
                      )}
                    </button>

                    {/* Stage Tab */}
                    <button
                      onClick={() => setActiveRole('stage')}
                      className={getTabClass('stage')}
                      style={activeRole === 'stage' ? {
                        backgroundColor: `rgb(var(--nav-active-background))`,
                        color: `rgb(var(--nav-active-text))`
                      } : {}}
                    >
                      <Monitor className="w-4 h-4" style={activeRole === 'stage' ? { color: `rgb(var(--nav-active-icon))` } : {}} />
                      <span>Stage</span>
                      {answeringCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 text-xs rounded-full font-bold text-white" style={{ backgroundColor: `rgb(var(--primary))` }}>
                          {answeringCount}
                        </span>
                      )}
                    </button>
                  </>
                )}
              </>
            )}
          </nav>

          {/* RIGHT: Status & Controls */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            {/* Live Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: `rgb(var(--surface-hover))` }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `rgb(var(--status-live))` }}></div>
              <span className="text-xs font-semibold text-secondary" style={{ color: `rgb(var(--text-secondary))` }}>
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors"
              style={{ 
                color: `rgb(var(--text-secondary))`,
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--surface-hover))`}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Refresh Button */}
            <button
              onClick={onResetDemo}
              className="p-2 rounded-lg transition-colors"
              style={{
                color: `rgb(var(--text-secondary))`,
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--surface-hover))`}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Reset demo"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Logout Button -- only shown once signed in */}
            {currentUser && (
              <button
                onClick={onLogout}
                className="p-2 rounded-lg transition-colors"
                style={{
                  color: `rgb(var(--text-secondary))`,
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--surface-hover))`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
