import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome, 
  faList, 
  faBuildingColumns,
  faBullseye,
  faEllipsisH,
  faSyncAlt,
  faHandHoldingDollar, 
  faHandHolding, 
  faChartPie, 
  faCog,
  faTimes,
  faShieldAlt,
  faWallet,
  faSuitcase
} from '@fortawesome/free-solid-svg-icons';
import { useTransactions } from '../../context/TransactionContext';
import { useAuth } from '../../context/AuthContext';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const BottomNav = () => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { subscriptions = [], lentRecords = [], borrowedRecords = [], accounts = [], savingsGoals = [], events = [] } = useTransactions();
  const { currentUser } = useAuth();

  useBodyScrollLock(isMoreOpen);

  const mainNavItems = [
    { name: 'Home', path: '/dashboard', icon: faHome },
    { name: 'Accounts', path: '/accounts', icon: faBuildingColumns, badge: accounts.length || null },
    { name: 'Txns', path: '/transactions', icon: faList },
    { name: 'Goals', path: '/goals', icon: faBullseye, badge: savingsGoals.length || null },
  ];

  const moreNavItems = [
    { 
      name: 'Trips & Events', 
      path: '/events', 
      icon: faSuitcase, 
      color: 'bg-amber-500/10 text-amber-500',
      subtitle: `${events.length} active events & trips` 
    },
    { 
      name: 'Subscriptions', 
      path: '/subscriptions', 
      icon: faSyncAlt, 
      color: 'bg-blue-500/10 text-blue-500',
      subtitle: `${subscriptions.filter(s => s.active).length} active auto-posts` 
    },
    { 
      name: 'Lent to Friends', 
      path: '/lent', 
      icon: faHandHoldingDollar, 
      color: 'bg-emerald-500/10 text-emerald-500',
      subtitle: `${lentRecords.length} records` 
    },
    { 
      name: 'Borrowed Money', 
      path: '/borrowed', 
      icon: faHandHolding, 
      color: 'bg-indigo-500/10 text-indigo-500',
      subtitle: `${borrowedRecords.length} debts` 
    },
    { 
      name: 'Analytics', 
      path: '/analytics', 
      icon: faChartPie, 
      color: 'bg-purple-500/10 text-purple-500',
      subtitle: 'Insights & breakdown' 
    },
    { 
      name: 'Settings', 
      path: '/settings', 
      icon: faCog, 
      color: 'bg-zinc-500/10 text-zinc-500',
      subtitle: 'Preferences & backup' 
    },
  ];

  const isMoreActive = moreNavItems.some(item => location.pathname === item.path);

  const closeMoreSheet = () => {
    setDragOffsetY(0);
    setIsMoreOpen(false);
  };

  const handleTouchStart = (e) => {
    touchStartYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (dragOffsetY > 60) {
      closeMoreSheet();
    } else {
      setDragOffsetY(0);
    }
  };

  return (
    <>
      {/* Mobile "More" Hub Bottom Sheet */}
      {isMoreOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-fade-in"
          onClick={closeMoreSheet}
        >
          <div 
            style={{
              transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
              transition: isDraggingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            className="bg-white dark:bg-zinc-900 rounded-t-3xl border-t border-zinc-200/80 dark:border-zinc-800 p-5 pb-8 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 origin-bottom-right animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet Pull & Drag Handle Area */}
            <div 
              className="w-full py-2 cursor-grab active:cursor-grabbing flex justify-center items-center touch-pan-y"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            </div>

            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs shadow-xs">
                  <FontAwesomeIcon icon={faWallet} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">All Features</h3>
                  <p className="text-[10px] text-zinc-400">Quick access to all modules</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={closeMoreSheet}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faTimes} className="text-xs" />
              </button>
            </div>

            {/* Grid of Feature Modules */}
            <div className="grid grid-cols-1 gap-2">
              {moreNavItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeMoreSheet}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all text-left cursor-pointer touch-feedback ${
                      isActive 
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm' 
                        : 'bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                        isActive ? 'bg-white/20 dark:bg-black/20 text-white dark:text-zinc-900' : item.color
                      }`}>
                        <FontAwesomeIcon icon={item.icon} />
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-tight">{item.name}</p>
                        <p className={`text-[10px] mt-0.5 ${isActive ? 'text-white/70 dark:text-zinc-600' : 'text-zinc-400'}`}>
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                      isActive ? 'bg-white/20 dark:bg-black/20 text-white dark:text-zinc-900' : 'bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300'
                    }`}>
                      {isActive ? 'Current' : 'Open →'}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Nav Dock */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 liquid-glass-dock rounded-3xl pb-safe z-40 transition-all duration-300 shadow-2xl border border-white/60 dark:border-white/10">
        <div className="flex justify-around items-center h-15 px-1">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-2xl transition-all duration-200 touch-feedback relative ${
                  isActive 
                    ? 'text-zinc-900 dark:text-white font-bold bg-white/60 dark:bg-white/15 shadow-2xs' 
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <FontAwesomeIcon icon={item.icon} className={`text-xs transition-transform ${isActive ? 'scale-110' : ''}`} />
                  <span className="text-[10px] tracking-tight mt-0.5 truncate">{item.name}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* "More" Trigger Tab */}
          <button
            onClick={() => setIsMoreOpen(prev => !prev)}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-2xl transition-all duration-200 touch-feedback relative cursor-pointer ${
              isMoreActive || isMoreOpen
                ? 'text-zinc-900 dark:text-white font-bold bg-white/60 dark:bg-white/15 shadow-2xs' 
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium'
            }`}
          >
            <FontAwesomeIcon icon={faEllipsisH} className={`text-xs transition-transform ${isMoreActive || isMoreOpen ? 'scale-110' : ''}`} />
            <span className="text-[10px] tracking-tight mt-0.5 truncate">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
