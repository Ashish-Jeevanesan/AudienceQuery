/**
 * @file src/components/GlobalLoader.tsx
 * @description A full-screen blocking overlay shown whenever a DB-backed
 * action (submitting a question, changing a status, saving settings, etc.)
 * is in flight, so the UI never sits idle with no feedback while waiting
 * on the network.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';

interface GlobalLoaderProps {
  isVisible: boolean;
}

export const GlobalLoader: React.FC<GlobalLoaderProps> = ({ isVisible }) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label={t('loader.savingPleaseWait')}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col items-center gap-4 rounded-2xl bg-white px-9 py-8 shadow-2xl"
          >
            <span className="relative flex h-11 w-11 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-[3px] border-indigo-100" />
              <span className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-600 motion-safe:animate-spin" />
              <span
                className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-amber-400 motion-safe:animate-spin"
                style={{ animationDuration: '1.4s', animationDirection: 'reverse' }}
              />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('loader.syncing')}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
