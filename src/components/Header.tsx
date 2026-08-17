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
      return `${baseClass} bg-brand-primary text-white`;
    }
    return `${baseClass} text-secondary hover:text-primary`;
  };

  return (
    <header className="sticky top-0 z-40 bg-primary border-b border-divider">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main header row */}
        <div className="flex items-center justify-between h-20">
          {/* Left: Logo & Title */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-brand-primary-dark rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md flex-shrink-0">
              Q
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-primary truncate">{title}</h1>
              <p className="text-xs text-secondary truncate">{subtitle}</p>
            </div>
          </div>

          {/* Right: Status & Actions */}
          <div className="flex items-center gap-4 flex-shrink-0 ml-4">
            {/* Live Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
              <span className="text-xs font-medium text-secondary">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-secondary text-secondary transition-colors rounded-lg"
              title="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Reset Button */}
            <button
              onClick={onResetDemo}
              className="p-2 hover:bg-secondary text-secondary transition-colors rounded-lg"
              title="Reset demo"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation tabs - Full width row */}
        <div className="flex items-center gap-2 py-3 border-t border-divider overflow-x-auto">
          {/* Audience */}
          <button
            onClick={() => setActiveRole('audience')}
            className={getTabClass('audience')}
          >
            <Users className="w-4 h-4" />
            <span>Audience</span>
          </button>

          {/* Moderator */}
          {!isModeratorAuthenticated ? (
            <button
              onClick={onModeratorLogin}
              className="px-4 py-2 rounded-lg font-semibold text-sm bg-brand-primary hover:bg-brand-primary-dark text-white transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Login</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveRole('moderator')}
              className={getTabClass('moderator')}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Moderator</span>
              {pendingCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          {/* Panel */}
          <button
            onClick={() => isAdmin && setActiveRole('panel')}
            disabled={!isAdmin}
            className={`${getTabClass('panel')} ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Mic className="w-4 h-4" />
            <span>Panel</span>
            {pushedCount > 0 && isAdmin && (
              <span className="ml-1 px-2 py-0.5 bg-brand-accent text-slate-900 text-xs rounded-full font-bold">
                {pushedCount}
              </span>
            )}
          </button>

          {/* Stage */}
          <button
            onClick={() => isAdmin && setActiveRole('stage')}
            disabled={!isAdmin}
            className={`${getTabClass('stage')} ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Monitor className="w-4 h-4" />
            <span>Stage</span>
            {answeringCount > 0 && isAdmin && (
              <span className="ml-1 px-2 py-0.5 bg-brand-primary text-white text-xs rounded-full font-bold">
                {answeringCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
