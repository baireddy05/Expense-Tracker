import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWallet } from '@fortawesome/free-solid-svg-icons';

const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#f6f8fc] dark:bg-[#070709] select-none overflow-hidden transition-colors duration-500">
      {/* Ambient Floating Light Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/15 dark:bg-indigo-600/20 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/15 dark:bg-emerald-600/20 blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-amber-500/5 dark:bg-amber-500/10 blur-[140px] pointer-events-none" />

      {/* Main Glass Centerpiece */}
      <div className="relative z-10 flex flex-col items-center max-w-xs px-6 py-8 animate-scale-in text-center">
        {/* Glowing Logo Icon Container */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 via-emerald-500 to-amber-500 rounded-3xl blur-md opacity-40 dark:opacity-50 animate-pulse" />
          <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xl flex items-center justify-center text-zinc-900 dark:text-white">
            <FontAwesomeIcon icon={faWallet} className="text-2xl sm:text-3xl text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
          ExTrack
        </h1>
        <p className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1.5 tracking-wide">
          Smart Expense & Lending Ledger
        </p>

        {/* Sleek Minimalist Loading Bar */}
        <div className="w-36 sm:w-44 h-1.5 bg-zinc-200/70 dark:bg-zinc-800/80 rounded-full overflow-hidden mt-7 relative shadow-inner">
          <div className="h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-amber-500 rounded-full w-2/3 animate-indeterminate" />
        </div>

        {/* Status text */}
        <div className="flex items-center gap-2 mt-3.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[10px] uppercase font-semibold tracking-widest text-zinc-400 dark:text-zinc-500">
            Securing Workspace
          </span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
