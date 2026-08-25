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
  faShieldAlt,
  faSignInAlt
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
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen sticky top-0 transition-colors duration-300">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-500 flex items-center gap-2">
          <FontAwesomeIcon icon={faWallet} />
          ExTrack
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            <FontAwesomeIcon icon={item.icon} className="w-5 h-5" />
            <span className="font-medium text-sm">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Account Info & Theme Switcher Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
        {/* User Account Card */}
        {currentUser ? (
          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-700/60 flex items-center gap-2.5">
            {currentUser.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt={displayName} 
                className="w-8 h-8 rounded-lg object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-inner">
                {initial}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                {displayName}
              </p>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Synced</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <FontAwesomeIcon icon={faShieldAlt} />
            <span>Sign In to Sync</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs font-medium cursor-pointer"
        >
          <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
