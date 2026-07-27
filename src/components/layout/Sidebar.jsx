import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faList, faChartPie, faCog, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../../context/ThemeContext';

const Sidebar = () => {
  const { theme, setTheme } = useTheme();
  
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: faHome },
    { name: 'Transactions', path: '/transactions', icon: faList },
    { name: 'Analytics', path: '/analytics', icon: faChartPie },
    { name: 'Settings', path: '/settings', icon: faCog },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen sticky top-0 transition-colors duration-300">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-500 flex items-center gap-2">
          <FontAwesomeIcon icon={faChartPie} />
          ExTrack
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            <FontAwesomeIcon icon={item.icon} className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
