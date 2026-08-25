import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTransactions } from '../../context/TransactionContext';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser, 
  faSignOutAlt, 
  faCog, 
  faCloud, 
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
        className={`flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-primary-500/20 cursor-pointer ${
          isCompact ? 'p-2.5' : 'px-3.5 py-2'
        }`}
        title="Sign In with Firebase"
      >
        <FontAwesomeIcon icon={faSignInAlt} />
        {!isCompact && <span>Sign In</span>}
      </button>
    );
  }

  const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
        title="Account & Cloud Sync"
      >
        {currentUser.photoURL ? (
          <img 
            src={currentUser.photoURL} 
            alt={displayName} 
            className="w-8 h-8 rounded-xl object-cover ring-2 ring-primary-500/40"
          />
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-inner ring-2 ring-primary-500/40">
            {initial}
          </div>
        )}

        {!isCompact && (
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight truncate max-w-[120px]">
              {displayName}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-gray-400 font-medium">Cloud Synced</span>
            </div>
          </div>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 p-2 animate-scale-up">
          {/* User Info Header */}
          <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/50 rounded-xl mb-1">
            <div className="flex items-center gap-2.5">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={displayName} 
                  className="w-9 h-9 rounded-xl object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-inner">
                  {initial}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {displayName}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-gray-200/60 dark:border-gray-800 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <FontAwesomeIcon icon={faShieldAlt} className="text-[10px]" />
                Cloud Protected
              </span>
              <button
                type="button"
                onClick={syncLocalData}
                disabled={isSyncing}
                className="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer flex items-center gap-1"
                title="Sync records to cloud"
              >
                <FontAwesomeIcon icon={faSync} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </button>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => { setIsOpen(false); navigate('/settings'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer text-left"
            >
              <FontAwesomeIcon icon={faCog} className="text-gray-400" />
              <span>Account & Security</span>
            </button>

            <button
              type="button"
              onClick={() => { setIsOpen(false); logout(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer text-left"
            >
              <FontAwesomeIcon icon={faSignOutAlt} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileMenu;
