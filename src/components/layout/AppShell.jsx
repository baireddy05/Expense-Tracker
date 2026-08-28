import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useTransactions } from '../../context/TransactionContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUI } from '../../context/UIContext';
import CommandPalette from '../ui/CommandPalette';
import QuickActionSpeedDial from '../ui/QuickActionSpeedDial';
import TransactionForm from '../transactions/TransactionForm';
import LentFormModal from '../lent/LentFormModal';
import BorrowFormModal from '../borrow/BorrowFormModal';
import UserProfileMenu from '../auth/UserProfileMenu';
import AuthModal from '../auth/AuthModal';
import SplashScreen from '../ui/SplashScreen';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faWallet, 
  faMoon, 
  faSun, 
  faEye, 
  faEyeSlash, 
  faSearch,
  faBars,
  faTimes,
  faHome,
  faList,
  faBuildingColumns,
  faBullseye,
  faSyncAlt,
  faHandHoldingDollar,
  faHandHolding,
  faChartPie,
  faCog
} from '@fortawesome/free-solid-svg-icons';
import { NavLink } from 'react-router-dom';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const AppShell = () => {
  const { loading, error } = useTransactions();
  const { loading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isPrivacyMode, togglePrivacyMode, openCommandPalette } = useUI();
  const location = useLocation();

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [initialTxType, setInitialTxType] = useState('expense');
  const [isLentModalOpen, setIsLentModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useBodyScrollLock(isMobileDrawerOpen);

  const handleOpenTx = (type = 'expense') => {
    setInitialTxType(type);
    setIsTxModalOpen(true);
  };

  if (loading || authLoading) {
    return <SplashScreen />;
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f6f8fc] dark:bg-[#070709] p-4 relative overflow-hidden">
        <div className="liquid-glass-card p-6 max-w-md text-center space-y-4 z-10 animate-scale-in">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
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
    <div className="flex h-screen overflow-hidden bg-[#f6f8fc] dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 antialiased relative">
      {/* Ambient Floating Liquid Light Orbs */}
      <div className="fixed -top-32 -left-32 w-[550px] h-[550px] rounded-full bg-indigo-400/12 dark:bg-indigo-600/12 blur-[130px] pointer-events-none liquid-orb-1 z-0" />
      <div className="fixed top-[25%] -right-32 w-[600px] h-[600px] rounded-full bg-emerald-400/10 dark:bg-emerald-600/10 blur-[140px] pointer-events-none liquid-orb-2 z-0" />
      <div className="fixed -bottom-32 left-[30%] w-[500px] h-[500px] rounded-full bg-rose-400/8 dark:bg-rose-600/10 blur-[130px] pointer-events-none liquid-orb-1 z-0" />

      {/* Desktop Liquid Glass Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-32 md:pb-8 relative scroll-smooth flex flex-col z-10">
        {/* Top Floating Liquid Glass Navbar Header */}
        <header className="sticky top-0 z-30 liquid-glass-dock border-b border-white/60 dark:border-white/10 px-4 md:px-8 py-3.5 flex justify-between items-center transition-all">
          {/* Logo on mobile / Search trigger on desktop */}
          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs shadow-xs cursor-pointer touch-feedback"
                title="Open Navigation Menu"
              >
                <FontAwesomeIcon icon={faBars} />
              </button>
              <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
                ExTrack
              </span>
            </div>

            {/* Desktop Command Palette Search bar */}
            <button
              type="button"
              onClick={openCommandPalette}
              className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl liquid-glass-input text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white text-xs font-medium transition-all cursor-pointer touch-feedback"
            >
              <FontAwesomeIcon icon={faSearch} className="text-zinc-400 text-xs" />
              <span>Search transactions or jump to...</span>
              <kbd className="ml-4 px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-zinc-800/80 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 border border-white/80 dark:border-white/10 shadow-2xs">
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
              className="md:hidden p-2 text-zinc-600 dark:text-zinc-400 hover:bg-white/40 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer touch-feedback"
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
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300/40 dark:border-amber-900/50 shadow-2xs' 
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-white/40 dark:hover:bg-white/5 border border-transparent'
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
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-white/40 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer touch-feedback"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} className="text-xs" />
            </button>

            {/* Firebase Auth User Profile */}
            <div className="pl-1 border-l border-zinc-200/80 dark:border-zinc-800/80">
              <UserProfileMenu />
            </div>
          </div>
        </header>

        {/* Page Content with 120Hz Fluid Route Crossfade */}
        <div key={location.pathname} className="max-w-7xl mx-auto w-full p-4 md:p-8 animate-page-enter flex-1 gpu-accelerated">
          <Outlet />
        </div>
      </main>

      {/* Mobile Slide-Out Drawer Menu */}
      {isMobileDrawerOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in flex"
          onClick={() => setIsMobileDrawerOpen(false)}
        >
          <div 
            className="w-72 max-w-[80vw] h-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-200/80 dark:border-zinc-800 p-5 flex flex-col justify-between shadow-2xl animate-slide-right overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs shadow-xs">
                    <FontAwesomeIcon icon={faWallet} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white">ExTrack</h2>
                    <p className="text-[10px] text-zinc-400">Personal Financial OS</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-xs" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1">
                {[
                  { name: 'Dashboard', path: '/dashboard', icon: faHome },
                  { name: 'Transactions', path: '/transactions', icon: faList },
                  { name: 'Accounts & Wallets', path: '/accounts', icon: faBuildingColumns },
                  { name: 'Savings Goals', path: '/goals', icon: faBullseye },
                  { name: 'Subscriptions', path: '/subscriptions', icon: faSyncAlt },
                  { name: 'Lent to Friends', path: '/lent', icon: faHandHoldingDollar },
                  { name: 'Borrowed Money', path: '/borrowed', icon: faHandHolding },
                  { name: 'Analytics & Insights', path: '/analytics', icon: faChartPie },
                  { name: 'Settings & Cloud', path: '/settings', icon: faCog }
                ].map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all touch-feedback ${
                        isActive
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
                      }`
                    }
                  >
                    <FontAwesomeIcon icon={item.icon} className="text-xs w-4 text-center" />
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-[10px] text-zinc-400">100% Synced & Encrypted</span>
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} className="text-[10px]" />
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Mobile Bottom Navigation Dock */}
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
