import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useTransactions } from '../../context/TransactionContext';
import { useTheme } from '../../context/ThemeContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWallet, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';

const AppShell = () => {
  const { loading, error } = useTransactions();
  const { theme, setTheme } = useTheme();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="font-bold">Error loading data</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 selection:bg-primary-500/30">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 relative scroll-smooth flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-primary-600 dark:text-primary-500 flex items-center gap-2">
            <FontAwesomeIcon icon={faWallet} />
            ExTrack
          </h1>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} className="text-xl" />
          </button>
        </header>

        <div className="max-w-7xl mx-auto w-full p-4 md:p-8 animate-fade-in flex-1">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default AppShell;
