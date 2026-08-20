import React from 'react';
import { Heart } from 'lucide-react';

export const Footer: React.FC = () => {
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
              Real-time Q&A platform for live events and conferences.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary text-sm">Features</h3>
            <ul className="space-y-2 text-sm text-secondary">
              <li className="hover:text-[rgb(var(--primary))] transition-colors">Live Q&A</li>
              <li className="hover:text-[rgb(var(--primary))] transition-colors">Real-time Updates</li>
              <li className="hover:text-[rgb(var(--primary))] transition-colors">Moderator Dashboard</li>
              <li className="hover:text-[rgb(var(--primary))] transition-colors">Stage Display</li>
            </ul>
          </div>

          {/* Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-primary text-sm">Info</h3>
            <ul className="space-y-2 text-sm text-secondary">
              <li>Built with React & TypeScript</li>
              <li>Powered by Supabase</li>
              <li>Real-time via Server-Sent Events</li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-divider my-8"></div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-secondary">
          <p>© {currentYear} AudienceQuery. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span>Built with</span>
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            <span>for live events</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
