import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useTransactions } from '../../context/TransactionContext';
import { useTheme } from '../../context/ThemeContext';
import { useUI } from '../../context/UIContext';
import CommandPalette from '../ui/CommandPalette';
import QuickActionSpeedDial from '../ui/QuickActionSpeedDial';
import TransactionForm from '../transactions/TransactionForm';
import LentFormModal from '../lent/LentFormModal';
import BorrowFormModal from '../borrow/BorrowFormModal';
import UserProfileMenu from '../auth/UserProfileMenu';
import AuthModal from '../auth/AuthModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faWallet, 
  faMoon, 
  faSun, 
  faEye, 
  faEyeSlash, 
  faSearch
} from '@fortawesome/free-solid-svg-icons';

const AppShell = () => {
  const { loading, error } = useTransactions();
  const { theme, setTheme } = useTheme();
  const { isPrivacyMode, togglePrivacyMode, openCommandPalette } = useUI();

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [initialTxType, setInitialTxType] = useState('expense');
  const [isLentModalOpen, setIsLentModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);

  const handleOpenTx = (type = 'expense') => {
    setInitialTxType(type);
    setIsTxModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3.5">
          <div className="w-9 h-9 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-white rounded-full animate-spin"></div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">ExTrack</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto text-xl">
            !
          </div>
          <div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-white">Unable to sync data</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{error}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold transition-all touch-feedback cursor-pointer shadow-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-8 relative scroll-smooth flex flex-col">
        {/* Top Navbar Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 md:px-8 py-3.5 flex justify-between items-center transition-colors">
          {/* Logo on mobile / Search trigger on desktop */}
          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs shadow-xs">
                <FontAwesomeIcon icon={faWallet} />
              </div>
              <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
                ExTrack
              </span>
            </div>

            {/* Desktop Command Palette Search bar */}
            <button
              type="button"
              onClick={openCommandPalette}
              className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-medium border border-zinc-200/70 dark:border-zinc-700/60 transition-all cursor-pointer touch-feedback"
            >
              <FontAwesomeIcon icon={faSearch} className="text-zinc-400 text-xs" />
              <span>Search transactions or jump to...</span>
              <kbd className="ml-4 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-900 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shadow-xs">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Quick Controls & User Profile */}
          <div className="flex items-center gap-2">
            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={openCommandPalette}
              className="md:hidden p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer touch-feedback"
              title="Search (Cmd+K)"
            >
              <FontAwesomeIcon icon={faSearch} />
            </button>

            {/* Privacy Mode Toggle */}
            <button
              type="button"
              onClick={togglePrivacyMode}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer touch-feedback ${
                isPrivacyMode 
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-300/40 dark:border-amber-900/50' 
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-transparent'
              }`}
              title={isPrivacyMode ? 'Privacy Mode ON (Balances Masked)' : 'Privacy Mode OFF (Click to Mask Balances)'}
            >
              <FontAwesomeIcon icon={isPrivacyMode ? faEyeSlash : faEye} className="text-xs" />
              <span className="hidden sm:inline text-[11px] font-semibold">{isPrivacyMode ? 'Masked' : 'Privacy'}</span>
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer touch-feedback"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} className="text-xs" />
            </button>

            {/* Firebase Auth User Profile */}
            <div className="pl-1 border-l border-zinc-200 dark:border-zinc-800">
              <UserProfileMenu />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="max-w-7xl mx-auto w-full p-4 md:p-8 animate-fade-in flex-1">
          <Outlet />
        </div>
      </main>

      {/* Floating Speed Dial */}
      <QuickActionSpeedDial 
        onAddTransaction={handleOpenTx}
        onAddLent={() => setIsLentModalOpen(true)}
        onAddBorrowed={() => setIsBorrowModalOpen(true)}
      />

      {/* Global Command Palette Spotlight */}
      <CommandPalette />

      {/* Global Auth Modal */}
      <AuthModal />

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Quick Modals from Speed Dial */}
      <TransactionForm 
        isOpen={isTxModalOpen} 
        onClose={() => setIsTxModalOpen(false)} 
        defaultType={initialTxType}
      />

      <LentFormModal 
        isOpen={isLentModalOpen}
        onClose={() => setIsLentModalOpen(false)}
      />

      <BorrowFormModal 
        isOpen={isBorrowModalOpen}
        onClose={() => setIsBorrowModalOpen(false)}
      />
    </div>
  );
};

export default AppShell;
