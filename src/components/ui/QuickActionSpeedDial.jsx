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
import { haptics } from '../../utils/haptics';

const QuickActionSpeedDial = ({ onAddTransaction, onAddLent, onAddBorrowed }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { openCommandPalette } = useUI();
  const navigate = useNavigate();

  const toggleDial = () => {
    setIsOpen(prev => {
      const next = !prev;
      if (next) haptics.medium();
      else haptics.light();
      return next;
    });
  };

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
      label: 'Record Debt',
      icon: faHandHolding,
      color: 'bg-indigo-600 text-white shadow-indigo-500/20',
      onClick: () => {
        setIsOpen(false);
        if (onAddBorrowed) onAddBorrowed();
        else navigate('/borrowed');
      }
    },
    {
      id: 'lend',
      label: 'Record Lent',
      icon: faHandHoldingDollar,
      color: 'bg-amber-600 text-white shadow-amber-500/20',
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
      color: 'bg-emerald-600 text-white shadow-emerald-500/20',
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
      color: 'bg-rose-500 text-white shadow-rose-500/20',
      onClick: () => {
        setIsOpen(false);
        if (onAddTransaction) onAddTransaction('expense');
        else navigate('/transactions');
      }
    }
  ];

  return (
    <>
      {/* Backdrop overlay to click outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-30 animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="fixed bottom-28 md:bottom-8 right-5 md:right-8 z-40 flex flex-col items-end">
        {/* Expanded Speed-Dial items */}
        {isOpen && (
          <div className="mb-3 space-y-2.5 flex flex-col items-end">
            {actions.map((act, index) => (
              <div
                key={act.id}
                onClick={act.onClick}
                className="flex items-center gap-3 cursor-pointer group touch-feedback animate-pop-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <span className="px-3 py-1.5 rounded-xl liquid-glass-dock text-zinc-800 dark:text-zinc-200 text-xs font-semibold shadow-lg transition-all group-hover:scale-105 border border-white/60 dark:border-white/10">
                  {act.label}
                </span>
                <button
                  type="button"
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-150 active:scale-95 group-hover:scale-110 cursor-pointer ${act.color}`}
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
          onClick={toggleDial}
          className={`w-13 h-13 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 touch-feedback cursor-pointer ${
            isOpen 
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rotate-90 scale-95' 
              : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 shadow-zinc-950/25 hover:scale-105'
          }`}
          title={isOpen ? 'Close Quick Actions' : 'Quick Actions'}
        >
          <FontAwesomeIcon icon={isOpen ? faTimes : faPlus} className="text-lg transition-transform" />
        </button>
      </div>
    </>
  );
};

export default QuickActionSpeedDial;
