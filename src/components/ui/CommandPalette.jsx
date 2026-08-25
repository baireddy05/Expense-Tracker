import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransactions } from '../../context/TransactionContext';
import { useUI } from '../../context/UIContext';
import { useTheme } from '../../context/ThemeContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, 
  faHome, 
  faList, 
  faHandHoldingDollar, 
  faHandHolding, 
  faChartPie, 
  faCog, 
  faMoon, 
  faSun, 
  faEye, 
  faEyeSlash,
  faTimes,
  faMoneyBillWave,
  faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import { resolveCategory } from '../../utils/categoryIcons';

const CommandPalette = () => {
  const { isCommandPaletteOpen, closeCommandPalette, togglePrivacyMode, isPrivacyMode } = useUI();
  const { theme, setTheme } = useTheme();
  const { transactions = [], lentRecords = [], borrowedRecords = [], categories = [] } = useTransactions();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  const items = useMemo(() => {
    const list = [];
    const q = query.toLowerCase().trim();

    // Navigation Pages
    const pages = [
      { id: 'page_dash', category: 'Navigation', title: 'Dashboard', subtitle: 'Overview & Cash Flow', icon: faHome, action: () => navigate('/dashboard') },
      { id: 'page_tx', category: 'Navigation', title: 'Transactions', subtitle: 'Income & Expenses Ledger', icon: faList, action: () => navigate('/transactions') },
      { id: 'page_lent', category: 'Navigation', title: 'Lent to Friends', subtitle: 'Money you lent out', icon: faHandHoldingDollar, action: () => navigate('/lent') },
      { id: 'page_borrow', category: 'Navigation', title: 'Borrowed Money', subtitle: 'Debts owed to friends', icon: faHandHolding, action: () => navigate('/borrowed') },
      { id: 'page_analytics', category: 'Navigation', title: 'Analytics', subtitle: 'Visual charts & insights', icon: faChartPie, action: () => navigate('/analytics') },
      { id: 'page_settings', category: 'Navigation', title: 'Settings', subtitle: 'Preferences & backup', icon: faCog, action: () => navigate('/settings') },
    ];
    pages.forEach(p => {
      if (!q || p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)) {
        list.push(p);
      }
    });

    // Quick Actions
    const actions = [
      { id: 'act_theme', category: 'Quick Actions', title: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme', subtitle: 'Appearance setting', icon: theme === 'dark' ? faSun : faMoon, action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
      { id: 'act_privacy', category: 'Quick Actions', title: isPrivacyMode ? 'Disable Privacy Mode (Show Balances)' : 'Enable Privacy Mode (Mask Balances)', subtitle: 'Hide sensitive currency numbers', icon: isPrivacyMode ? faEye : faEyeSlash, action: togglePrivacyMode },
    ];
    actions.forEach(a => {
      if (!q || a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)) {
        list.push(a);
      }
    });

    // Friends from Lent Records
    lentRecords.forEach(r => {
      if (!q || r.borrowerName.toLowerCase().includes(q) || (r.note && r.note.toLowerCase().includes(q))) {
        list.push({
          id: `lent_${r.id}`,
          category: 'Lent to Friends',
          title: r.borrowerName,
          subtitle: `Total Lent: ₹${(parseFloat(r.amount) || 0).toLocaleString('en-IN')} (Pending: ₹${Math.max(0, (parseFloat(r.amount) || 0) - (parseFloat(r.returnedAmount) || 0)).toLocaleString('en-IN')})`,
          icon: faHandHoldingDollar,
          action: () => navigate('/lent')
        });
      }
    });

    // Friends from Borrowed Records
    borrowedRecords.forEach(r => {
      if (!q || r.lenderName.toLowerCase().includes(q) || (r.note && r.note.toLowerCase().includes(q))) {
        list.push({
          id: `borrow_${r.id}`,
          category: 'Borrowed Money',
          title: r.lenderName,
          subtitle: `Total Debt: ₹${(parseFloat(r.amount) || 0).toLocaleString('en-IN')} (Remaining: ₹${Math.max(0, (parseFloat(r.amount) || 0) - (parseFloat(r.returnedAmount) || 0)).toLocaleString('en-IN')})`,
          icon: faHandHolding,
          action: () => navigate('/borrowed')
        });
      }
    });

    // Recent matching transactions
    if (q) {
      transactions.slice(0, 8).forEach(t => {
        const cat = resolveCategory(t.categoryId, categories, t.note);
        if (t.note?.toLowerCase().includes(q) || cat?.name?.toLowerCase().includes(q)) {
          list.push({
            id: `tx_${t.id}`,
            category: 'Transactions',
            title: t.note || cat?.name || 'Transaction',
            subtitle: `${t.type === 'income' ? '+₹' : '-₹'}${parseFloat(t.amount).toLocaleString('en-IN')} on ${new Date(t.date).toLocaleDateString('en-IN')}`,
            icon: faMoneyBillWave,
            action: () => navigate('/transactions')
          });
        }
      });
    }

    return list;
  }, [query, theme, isPrivacyMode, lentRecords, borrowedRecords, transactions, categories, navigate, setTheme, togglePrivacyMode]);

  const handleSelect = (item) => {
    closeCommandPalette();
    item.action();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (items.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % (items.length || 1));
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault();
      handleSelect(items[selectedIndex]);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={closeCommandPalette}
    >
      <div 
        className="liquid-glass-dock w-full max-w-xl rounded-3xl shadow-2xl border border-white/60 dark:border-white/10 overflow-hidden flex flex-col max-h-[80vh] animate-slide-up sm:animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input header */}
        <div className="relative border-b border-white/50 dark:border-white/10 flex items-center px-4.5">
          <FontAwesomeIcon icon={faSearch} className="text-zinc-400 text-sm mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a page, friend, command, or transaction... (ESC to exit)"
            className="w-full py-4 bg-transparent outline-none text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400"
          />
          <button
            onClick={closeCommandPalette}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl cursor-pointer"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xs" />
          </button>
        </div>

        {/* Results list */}
        <div className="overflow-y-auto p-2 flex-1 space-y-1">
          {items.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              No matching records found for "{query}"
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                      : 'hover:bg-white/40 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                      isSelected
                        ? 'bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900'
                        : 'liquid-glass-subtle text-zinc-500 dark:text-zinc-400'
                    }`}>
                      <FontAwesomeIcon icon={item.icon} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-xs truncate ${isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-white'}`}>
                          {item.title}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${
                          isSelected 
                            ? 'bg-white/20 dark:bg-black/20 text-white dark:text-zinc-900'
                            : 'liquid-glass-subtle text-zinc-500 dark:text-zinc-400'
                        }`}>
                          {item.category}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-white/80 dark:text-zinc-900/80' : 'text-zinc-400'}`}>
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <FontAwesomeIcon 
                    icon={faArrowRight} 
                    className={`text-[10px] transition-opacity ${isSelected ? 'opacity-100 text-white dark:text-zinc-900' : 'opacity-0'}`} 
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4.5 py-2.5 liquid-glass-subtle border-t border-white/50 dark:border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Enter</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Esc</kbd> Close</span>
          </div>
          <span className="font-semibold text-zinc-600 dark:text-zinc-400">ExTrack Spotlight</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
