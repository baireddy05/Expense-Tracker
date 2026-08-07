import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../context/UIContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faTimes, 
  faArrowTrendDown, 
  faArrowTrendUp, 
  faHandHoldingDollar, 
  faHandHolding, 
  faSearch
} from '@fortawesome/free-solid-svg-icons';

const QuickActionSpeedDial = ({ onAddTransaction, onAddLent, onAddBorrowed }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { openCommandPalette } = useUI();
  const navigate = useNavigate();

  const actions = [
    {
      id: 'search',
      label: 'Search (Cmd+K)',
      icon: faSearch,
      color: 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900',
      onClick: () => {
        setIsOpen(false);
        openCommandPalette();
      }
    },
    {
      id: 'borrow',
      label: 'Borrow Money',
      icon: faHandHolding,
      color: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white',
      onClick: () => {
        setIsOpen(false);
        if (onAddBorrowed) onAddBorrowed();
        else navigate('/borrowed');
      }
    },
    {
      id: 'lend',
      label: 'Lend Money',
      icon: faHandHoldingDollar,
      color: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white',
      onClick: () => {
        setIsOpen(false);
        if (onAddLent) onAddLent();
        else navigate('/lent');
      }
    },
    {
      id: 'income',
      label: 'Add Income',
      icon: faArrowTrendUp,
      color: 'bg-emerald-600 text-white',
      onClick: () => {
        setIsOpen(false);
        if (onAddTransaction) onAddTransaction('income');
        else navigate('/transactions');
      }
    },
    {
      id: 'expense',
      label: 'Add Expense',
      icon: faArrowTrendDown,
      color: 'bg-rose-600 text-white',
      onClick: () => {
        setIsOpen(false);
        if (onAddTransaction) onAddTransaction('expense');
        else navigate('/transactions');
      }
    }
  ];

  return (
    <div className="fixed bottom-20 md:bottom-8 right-6 z-40 flex flex-col items-end">
      {/* Expanded Speed-Dial items */}
      {isOpen && (
        <div className="mb-3 space-y-2.5 flex flex-col items-end animate-fade-in">
          {actions.map((act) => (
            <div
              key={act.id}
              onClick={act.onClick}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs font-semibold shadow-lg border border-gray-100 dark:border-gray-800 opacity-95 group-hover:opacity-100 transition-opacity">
                {act.label}
              </span>
              <button
                type="button"
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 group-hover:scale-105 cursor-pointer ${act.color}`}
              >
                <FontAwesomeIcon icon={act.icon} className="text-sm" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl shadow-primary-500/30 text-white transition-all duration-300 active:scale-95 cursor-pointer ${
          isOpen 
            ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rotate-90' 
            : 'bg-gradient-to-tr from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-600'
        }`}
        title={isOpen ? 'Close Quick Actions' : 'Quick Actions (Ctrl+N)'}
      >
        <FontAwesomeIcon icon={isOpen ? faTimes : faPlus} className="text-xl transition-transform" />
      </button>
    </div>
  );
};

export default QuickActionSpeedDial;
