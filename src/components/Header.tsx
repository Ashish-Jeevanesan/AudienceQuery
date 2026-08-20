import React, { useState } from 'react';
import { ViewRole } from '../types';
import { Users, ShieldCheck, Mic, Monitor, RefreshCw, Sun, Moon } from 'lucide-react';

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
  isAdmin: boolean;
  onModeratorLogin: () => void;
  isModeratorAuthenticated: boolean;
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
  isAdmin,
  onModeratorLogin,
  isModeratorAuthenticated
}) => {
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

            {/* Moderator Tab */}
            {!isModeratorAuthenticated ? (
              <button
                onClick={onModeratorLogin}
                className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors flex items-center gap-2 whitespace-nowrap"
                style={{ backgroundColor: `rgb(var(--primary))` }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--primary-hover))`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `rgb(var(--primary))`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Login</span>
              </button>
            ) : (
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
            )}

            {/* Panel Tab */}
            <button
              onClick={() => isAdmin && setActiveRole('panel')}
              disabled={!isAdmin}
              className={`${getTabClass('panel')} ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={activeRole === 'panel' && isAdmin ? {
                backgroundColor: `rgb(var(--nav-active-background))`,
                color: `rgb(var(--nav-active-text))`
              } : {}}
            >
              <Mic className="w-4 h-4" style={activeRole === 'panel' ? { color: `rgb(var(--nav-active-icon))` } : {}} />
              <span>Panel</span>
              {pushedCount > 0 && isAdmin && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full font-bold text-slate-900" style={{ backgroundColor: `rgb(var(--accent))` }}>
                  {pushedCount}
                </span>
              )}
            </button>

            {/* Stage Tab */}
            <button
              onClick={() => isAdmin && setActiveRole('stage')}
              disabled={!isAdmin}
              className={`${getTabClass('stage')} ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={activeRole === 'stage' && isAdmin ? {
                backgroundColor: `rgb(var(--nav-active-background))`,
                color: `rgb(var(--nav-active-text))`
              } : {}}
            >
              <Monitor className="w-4 h-4" style={activeRole === 'stage' ? { color: `rgb(var(--nav-active-icon))` } : {}} />
              <span>Stage</span>
              {answeringCount > 0 && isAdmin && (
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full font-bold text-white" style={{ backgroundColor: `rgb(var(--primary))` }}>
                  {answeringCount}
                </span>
              )}
            </button>
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
          </div>
        </div>
      </div>
    </header>
  );
};
