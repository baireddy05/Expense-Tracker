import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faList, faChartPie, faCog, faHandHoldingDollar, faHandHolding } from '@fortawesome/free-solid-svg-icons';

const BottomNav = () => {
  const navItems = [
    { name: 'Home', path: '/dashboard', icon: faHome },
    { name: 'Txns', path: '/transactions', icon: faList },
    { name: 'Lent', path: '/lent', icon: faHandHoldingDollar },
    { name: 'Borrowed', path: '/borrowed', icon: faHandHolding },
    { name: 'Stats', path: '/analytics', icon: faChartPie },
    { name: 'Settings', path: '/settings', icon: faCog },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 pb-safe z-50 transition-colors duration-300 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-16 h-full transition-colors duration-200 ${
                isActive 
                  ? 'text-primary-500' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`
            }
          >
            <FontAwesomeIcon icon={item.icon} className="text-xl mb-1" />
            <span className="text-[10px] font-medium">{item.name}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
