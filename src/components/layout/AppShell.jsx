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
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Loading ExTrack...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-red-500 p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 max-w-md text-center">
          <p className="font-bold text-lg mb-1">Error Loading Data</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 selection:bg-primary-500/30">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-8 relative scroll-smooth flex flex-col">
        {/* Top Navbar Header */}
        <header className="sticky top-0 z-30 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800/80 px-4 md:px-8 py-3 flex justify-between items-center transition-colors">
          {/* Logo on mobile / Search trigger on desktop */}
          <div className="flex items-center gap-3">
            <h1 className="md:hidden text-xl font-bold text-primary-600 dark:text-primary-500 flex items-center gap-2">
              <FontAwesomeIcon icon={faWallet} />
              ExTrack
            </h1>

            {/* Desktop Command Palette Search bar */}
            <button
              type="button"
              onClick={openCommandPalette}
              className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200/80 dark:hover:bg-gray-700/80 text-gray-500 dark:text-gray-400 text-xs font-medium border border-gray-200/60 dark:border-gray-700/60 transition-all cursor-pointer shadow-xs"
            >
              <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
              <span>Search or jump to...</span>
              <kbd className="ml-4 px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 text-[10px] font-bold text-gray-600 dark:text-gray-300 shadow-xs border border-gray-200 dark:border-gray-700">
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
              className="md:hidden p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
              title="Search (Cmd+K)"
            >
              <FontAwesomeIcon icon={faSearch} />
            </button>

            {/* Privacy Mode Toggle */}
            <button
              type="button"
              onClick={togglePrivacyMode}
              className={`p-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                isPrivacyMode 
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={isPrivacyMode ? 'Privacy Mode ON (Balances Masked)' : 'Privacy Mode OFF (Click to Mask Balances)'}
            >
              <FontAwesomeIcon icon={isPrivacyMode ? faEyeSlash : faEye} />
              <span className="hidden sm:inline text-[11px]">{isPrivacyMode ? 'Privacy ON' : 'Privacy'}</span>
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
            </button>

            {/* Firebase Auth User Profile */}
            <div className="pl-1 border-l border-gray-200 dark:border-gray-800">
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
