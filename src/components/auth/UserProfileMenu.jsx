import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTransactions } from '../../context/TransactionContext';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSignOutAlt, 
  faCog, 
  faSync, 
  faShieldAlt, 
  faSignInAlt 
} from '@fortawesome/free-solid-svg-icons';

const UserProfileMenu = ({ isCompact = false }) => {
  const { currentUser, logout, openAuthModal } = useAuth();
  const { isSyncing, syncLocalData } = useTransactions();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentUser) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal('login')}
        className={`flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold rounded-xl text-xs transition-all shadow-xs cursor-pointer touch-feedback ${
          isCompact ? 'p-2' : 'px-3 py-1.5'
        }`}
        title="Sign In with Google"
      >
        <FontAwesomeIcon icon={faSignInAlt} className="text-xs" />
        {!isCompact && <span>Sign In</span>}
      </button>
    );
  }

  const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative select-none" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-xl hover:bg-white/40 dark:hover:bg-white/5 transition-colors cursor-pointer touch-feedback"
        title="Account & Cloud Sync"
      >
        {currentUser.photoURL ? (
          <img 
            src={currentUser.photoURL} 
            alt={displayName} 
            className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/60 dark:ring-white/10"
          />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold flex items-center justify-center text-xs shadow-inner">
            {initial}
          </div>
        )}

        {!isCompact && (
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-zinc-900 dark:text-white leading-tight truncate max-w-[110px]">
              {displayName}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-zinc-400 font-medium">Synced</span>
            </div>
          </div>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 liquid-glass-dock border border-white/60 dark:border-white/10 rounded-2xl shadow-xl z-50 p-2 animate-fade-in">
          {/* User Info Header */}
          <div className="p-3 border-b border-white/50 dark:border-white/10 liquid-glass-subtle rounded-xl mb-1">
            <div className="flex items-center gap-2.5">
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
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                  {displayName}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-white/40 dark:border-white/10 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                <FontAwesomeIcon icon={faShieldAlt} className="text-[9px]" />
                Cloud Protected
              </span>
              <button
                type="button"
                onClick={syncLocalData}
                disabled={isSyncing}
                className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white cursor-pointer flex items-center gap-1 text-[10px] font-semibold touch-feedback"
                title="Sync records to cloud"
              >
                <FontAwesomeIcon icon={faSync} className={isSyncing ? 'animate-spin text-[9px]' : 'text-[9px]'} />
                <span>{isSyncing ? 'Syncing' : 'Sync'}</span>
              </button>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => { setIsOpen(false); navigate('/settings'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-white/40 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-left touch-feedback"
            >
              <FontAwesomeIcon icon={faCog} className="text-zinc-400 text-xs" />
              <span>Settings & Account</span>
            </button>

            <button
              type="button"
              onClick={() => { setIsOpen(false); logout(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer text-left touch-feedback"
            >
              <FontAwesomeIcon icon={faSignOutAlt} className="text-xs" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileMenu;
