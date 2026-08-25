import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome, 
  faList, 
  faChartPie, 
  faCog, 
  faMoon, 
  faSun, 
  faWallet, 
  faHandHoldingDollar, 
  faHandHolding,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { theme, setTheme } = useTheme();
  const { currentUser, openAuthModal } = useAuth();
  
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: faHome },
    { name: 'Transactions', path: '/transactions', icon: faList },
    { name: 'Lent to Friends', path: '/lent', icon: faHandHoldingDollar },
    { name: 'Borrowed Money', path: '/borrowed', icon: faHandHolding },
    { name: 'Analytics', path: '/analytics', icon: faChartPie },
    { name: 'Settings', path: '/settings', icon: faCog },
  ];

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="hidden md:flex flex-col w-64 liquid-glass-dock border-r border-white/60 dark:border-white/10 h-screen sticky top-0 transition-colors duration-300 z-40 select-none">
      {/* Brand Logo Header */}
      <div className="p-6 pb-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-sm shadow-xs">
          <FontAwesomeIcon icon={faWallet} />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
            ExTrack
          </h1>
          <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Liquid Ledger</p>
        </div>
      </div>
      
      {/* Navigation Links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 touch-feedback ${
                isActive 
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold shadow-xs' 
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-white/40 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white font-medium'
              }`
            }
          >
            <FontAwesomeIcon icon={item.icon} className="w-4 h-4" />
            <span className="text-xs">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Account Info & Theme Switcher Footer */}
      <div className="p-4 border-t border-white/60 dark:border-white/10 space-y-2.5">
        {/* User Account Card */}
        {currentUser ? (
          <div className="p-2.5 rounded-xl liquid-glass-subtle flex items-center gap-2.5">
            {currentUser.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt={displayName} 
                className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/60 dark:ring-white/10"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold flex items-center justify-center text-xs shadow-inner">
                {initial}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                {displayName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Cloud Synced</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold shadow-xs transition-all touch-feedback cursor-pointer"
          >
            <FontAwesomeIcon icon={faShieldAlt} className="text-xs" />
            <span>Sign In with Google</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl liquid-glass-subtle text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-xs font-medium cursor-pointer touch-feedback"
        >
          <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} className="text-xs" />
          <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
