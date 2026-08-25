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
    <nav className="md:hidden fixed bottom-3 left-3 right-3 liquid-glass-dock rounded-3xl pb-safe z-50 transition-all duration-300">
      <div className="flex justify-around items-center h-15 px-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-2xl transition-all duration-200 touch-feedback relative ${
                isActive 
                  ? 'text-zinc-900 dark:text-white font-bold bg-white/50 dark:bg-white/10 shadow-2xs' 
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <FontAwesomeIcon icon={item.icon} className={`text-xs transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className="text-[10px] tracking-tight mt-0.5">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
