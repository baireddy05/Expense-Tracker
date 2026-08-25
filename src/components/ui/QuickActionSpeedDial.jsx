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
      label: 'Spotlight Search',
      icon: faSearch,
      color: 'bg-zinc-800 text-white dark:bg-zinc-700',
      onClick: () => {
        setIsOpen(false);
        openCommandPalette();
      }
    },
    {
      id: 'borrow',
      label: 'Record Borrowed Money',
      icon: faHandHolding,
      color: 'bg-indigo-600 text-white',
      onClick: () => {
        setIsOpen(false);
        if (onAddBorrowed) onAddBorrowed();
        else navigate('/borrowed');
      }
    },
    {
      id: 'lend',
      label: 'Record Lent Money',
      icon: faHandHoldingDollar,
      color: 'bg-amber-600 text-white',
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
      color: 'bg-rose-500 text-white',
      onClick: () => {
        setIsOpen(false);
        if (onAddTransaction) onAddTransaction('expense');
        else navigate('/transactions');
      }
    }
  ];

  return (
    <div className="fixed bottom-20 md:bottom-8 right-5 md:right-8 z-40 flex flex-col items-end">
      {/* Expanded Speed-Dial items */}
      {isOpen && (
        <div className="mb-3 space-y-2.5 flex flex-col items-end animate-fade-in">
          {actions.map((act) => (
            <div
              key={act.id}
              onClick={act.onClick}
              className="flex items-center gap-3 cursor-pointer group touch-feedback"
            >
              <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-semibold shadow-md border border-zinc-200/80 dark:border-zinc-800/80 transition-all group-hover:border-zinc-300 dark:group-hover:border-zinc-700">
                {act.label}
              </span>
              <button
                type="button"
                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-transform duration-150 active:scale-95 group-hover:scale-105 cursor-pointer ${act.color}`}
              >
                <FontAwesomeIcon icon={act.icon} className="text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-13 h-13 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 touch-feedback cursor-pointer ${
          isOpen 
            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rotate-90 scale-95' 
            : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 shadow-zinc-950/20'
        }`}
        title={isOpen ? 'Close Quick Actions' : 'Quick Actions'}
      >
        <FontAwesomeIcon icon={isOpen ? faTimes : faPlus} className="text-lg transition-transform" />
      </button>
    </div>
  );
};

export default QuickActionSpeedDial;
