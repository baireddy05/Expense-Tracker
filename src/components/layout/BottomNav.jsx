import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome, 
  faList, 
  faChartPie, 
  faCog, 
  faHandHoldingDollar, 
  faHandHolding 
} from '@fortawesome/free-solid-svg-icons';

const BottomNav = () => {
  const navItems = [
    { name: 'Home', path: '/dashboard', icon: faHome },
    { name: 'Txns', path: '/transactions', icon: faList },
    { name: 'Lent', path: '/lent', icon: faHandHoldingDollar },
    { name: 'Debts', path: '/borrowed', icon: faHandHolding },
    { name: 'Stats', path: '/analytics', icon: faChartPie },
    { name: 'Settings', path: '/settings', icon: faCog },
  ];

  return (
    <nav className="md:hidden fixed bottom-3 left-3 right-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl pb-safe z-50 transition-colors duration-200 shadow-lg shadow-zinc-950/5 dark:shadow-black/40">
      <div className="flex justify-around items-center h-14 px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-150 touch-feedback ${
                isActive 
                  ? 'text-zinc-900 dark:text-white font-semibold scale-105' 
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <FontAwesomeIcon icon={item.icon} className="text-base mb-0.5" />
                <span className="text-[10px] tracking-tight">{item.name}</span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-zinc-900 dark:bg-white mt-0.5" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
