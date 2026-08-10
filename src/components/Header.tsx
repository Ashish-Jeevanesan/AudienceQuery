/**
 * @file src/components/Header.tsx
 * @description The main header component for the application. It displays the event title,
 * connection status, and the primary navigation tabs for switching between different
 * user roles/views (Audience, Moderator, Panel, Stage).
 */

import React from 'react';
import { ViewRole } from '../types';
import { Users, ShieldCheck, Mic, Monitor, RefreshCw, Radio, BookOpenCheck } from 'lucide-react';

/**
 * Props for the Header component.
 */
interface HeaderProps {
  /** The currently active user role/view. */
  activeRole: ViewRole;
  /** Function to set the active user role. */
  setActiveRole: (role: ViewRole) => void;
  /** The main title of the conference event. */
  title: string;
  /** The subtitle of the conference event. */
  subtitle: string;
  /** Boolean indicating if the client is connected to the SSE stream. */
  isConnected: boolean;
  /** Function to trigger a reset of the demo data on the server. */
  onResetDemo: () => void;
  /** Count of questions with 'pending' status for the moderator badge. */
  pendingCount: number;
  /** Count of questions with 'pushed' status for the panel badge. */
  pushedCount: number;
  /** Count of questions with 'answering' status for the stage badge. */
  answeringCount: number;
}

/**
 * The sticky header component displayed at the top of the application.
 * It contains the event title, live status indicator, and view-switching tabs.
 * @param {HeaderProps} props The props for the component.
 * @returns {React.ReactElement} The rendered header.
 */
export const Header: React.FC<HeaderProps> = ({
  activeRole,
  setActiveRole,
  title,
  subtitle,
  isConnected,
  onResetDemo,
  pendingCount,
  pushedCount,
  answeringCount
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
          
          {/* Left: Title & Live Indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <BookOpenCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="font-bold text-lg leading-tight tracking-tight text-white">{title}</h1>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    <Radio className="w-3 h-3 mr-1 animate-pulse" />
                    {isConnected ? 'LIVE SYNC' : 'Connecting...'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">{subtitle}</p>
              </div>
            </div>

            {/* Mobile Reset Demo Button */}
            <button
              onClick={onResetDemo}
              title="Reset Sample Data"
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Navigation View Tabs & Reset Button */}
          <div className="flex items-center justify-between md:justify-end gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <nav className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800/80">
              <button
                onClick={() => setActiveRole('audience')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeRole === 'audience'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Audience</span>
              </button>

              <button
                onClick={() => setActiveRole('moderator')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                  activeRole === 'moderator'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Moderator</span>
                {pendingCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveRole('panel')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                  activeRole === 'panel'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Panel</span>
                {pushedCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-400 text-slate-950">
                    {pushedCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveRole('stage')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeRole === 'stage'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Stage Screen</span>
                {answeringCount > 0 && (
                  <span className="w-2 h-2 ml-2 rounded-full bg-rose-500 animate-ping"></span>
                )}
              </button>
            </nav>

            <button
              onClick={onResetDemo}
              className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              title="Reset sample data to its original state"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Demo</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
