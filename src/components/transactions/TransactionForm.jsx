import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTransactions } from '../../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCommentDots } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const TransactionForm = ({ 
  isOpen, 
  onClose, 
  initialData = null, 
  defaultType = 'expense',
  defaultDate = null 
}) => {
  const { transactions = [], categories, addTransaction, updateTransaction, addCategory } = useTransactions();

  // Extract unique non-empty notes from previous transactions sorted by frequency/recency
  const previousNoteSuggestions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    const counts = new Map();
    const order = [];
    
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const trimmedNote = t.note ? t.note.trim() : '';
      if (trimmedNote.length > 0) {
        if (!counts.has(trimmedNote)) {
          counts.set(trimmedNote, 1);
          order.push(trimmedNote);
        } else {
          counts.set(trimmedNote, counts.get(trimmedNote) + 1);
        }
      }
    }

    return order.sort((a, b) => {
      const freqDiff = counts.get(b) - counts.get(a);
      if (freqDiff !== 0) return freqDiff;
      return 0;
    }).slice(0, 20);
  }, [transactions]);

  // Filter suggestions based on current note input
  const filteredNoteSuggestions = useMemo(() => {
    if (!previousNoteSuggestions.length) return [];
    const q = (note || '').trim().toLowerCase();
    if (!q) return previousNoteSuggestions.slice(0, 8);
    return previousNoteSuggestions
      .filter(s => s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [previousNoteSuggestions, note]);
  
  const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getOffsetDateStr = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      if (isNaN(dateObj.getTime())) return dateStr;
      return dateObj.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateChipLabel = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      if (isNaN(dateObj.getTime())) return dateStr;
      return dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short'
      });
    } catch {
      return dateStr;
    }
  };

  const todayStr = getLocalToday();
  const yesterdayStr = getOffsetDateStr(1);
  const twoDaysAgoStr = getOffsetDateStr(2);
  const threeDaysAgoStr = getOffsetDateStr(3);

  const quickDatePresets = [
    { label: 'Today', value: todayStr },
    { label: 'Yesterday', value: yesterdayStr },
    { label: '2d ago', value: twoDaysAgoStr },
    { label: '3d ago', value: threeDaysAgoStr },
  ];

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(getLocalToday());
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData && initialData.id) {
      setType(initialData.type || 'expense');
      setAmount(initialData.amount || '');
      setCategoryId(initialData.categoryId || '');
      setDate(initialData.date ? initialData.date.split('T')[0] : getLocalToday());
      setNote(initialData.note || '');
      setIsCreatingCategory(false);
      setNewCategoryName('');
    } else {
      setType(initialData?.type || defaultType || 'expense');
      setAmount(initialData?.amount || '');
      setCategoryId(initialData?.categoryId || '');
      setDate(initialData?.date ? initialData.date.split('T')[0] : (defaultDate || getLocalToday()));
      setNote(initialData?.note || '');
      setIsCreatingCategory(false);
      setNewCategoryName('');
    }
  }, [initialData, isOpen, defaultType, defaultDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !categoryId || !date) return;
    
    setLoading(true);
    try {
      const txData = { type, amount: parseFloat(amount), categoryId, date, note };
      if (initialData && initialData.id) {
        await updateTransaction(initialData.id, txData);
        toast.success('Transaction updated');
      } else {
        await addTransaction(txData);
        toast.success('Transaction logged');
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const colors = ['#f43f5e', '#f97316', '#d97706', '#10b981', '#0ea5e9', '#6366f1', '#8b5cf6', '#71717a'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const cat = await addCategory({
        name: newCategoryName.trim(),
        type: type,
        color: randomColor,
        icon: 'fa-tag'
      });
      setCategoryId(cat.id);
      setIsCreatingCategory(false);
      setNewCategoryName('');
      toast.success('Category created');
    } catch (error) {
      console.error("Failed to create category", error);
      toast.error('Failed to create category');
    }
  };

  const filteredCategories = categories.filter(c => c.type === type);

  return createPortal(
    <div 
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex flex-col max-h-[90dvh] sm:max-h-none animate-slide-up sm:animate-fade-in my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
              type === 'income' 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20' 
                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20'
            }`}>
              {type === 'income' ? '↓' : '↑'}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white leading-tight">
                {initialData && initialData.id ? 'Edit Transaction' : `Record ${type === 'income' ? 'Income' : 'Expense'}`}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                {formatDateDisplay(date)}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-feedback cursor-pointer"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xs" />
          </button>
        </div>
        
        {/* Form Body - Compact and Non-Scrollable on Desktop */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto sm:overflow-visible p-4 sm:p-5 space-y-3 sm:space-y-3.5 pb-8 sm:pb-5">
          {/* Expense / Income Toggle */}
          <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-1 shrink-0 border border-zinc-200/60 dark:border-zinc-700/60">
            <button 
              type="button" 
              onClick={() => setType('expense')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all touch-feedback cursor-pointer ${
                type === 'expense' 
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs' 
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Expense
            </button>
            <button 
              type="button" 
              onClick={() => setType('income')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all touch-feedback cursor-pointer ${
                type === 'income' 
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs' 
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Income
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
              Amount (INR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 font-bold text-base">₹</span>
              <input 
                type="number" 
                step="0.01" 
                min="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-900 dark:focus:border-white outline-none text-base font-bold text-zinc-900 dark:text-white transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* 2-Column Responsive Grid on Desktop for Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category Selector */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Category <span className="text-rose-500">*</span>
                </label>
                {!isCreatingCategory && (
                  <button 
                    type="button" 
                    onClick={() => setIsCreatingCategory(true)} 
                    className="text-[11px] text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white font-semibold cursor-pointer"
                  >
                    + New
                  </button>
                )}
              </div>
              
              {isCreatingCategory ? (
                <div className="flex gap-1.5">
                  <input 
                    type="text" 
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="Name"
                    className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:border-zinc-900 dark:focus:border-white outline-none text-xs text-zinc-900 dark:text-white font-medium"
                    autoFocus
                  />
                  <button 
                    type="button" 
                    onClick={handleCreateCategory} 
                    className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold transition-colors touch-feedback cursor-pointer"
                  >
                    Save
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsCreatingCategory(false)} 
                    className="px-2.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors touch-feedback cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select 
                  required
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:border-zinc-900 dark:focus:border-white outline-none text-xs text-zinc-900 dark:text-white font-medium cursor-pointer"
                >
                  <option value="" disabled>Select category</option>
                  {filteredCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Date Picker with Quick Preset Chips */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Date <span className="text-rose-500">*</span>
                </label>
              </div>

              {/* Quick Chips Row */}
              <div className="flex items-center gap-1 mb-1.5 overflow-x-auto no-scrollbar">
                {quickDatePresets.map(preset => {
                  const isSelected = date === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setDate(preset.value)}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all touch-feedback cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                          : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                {!quickDatePresets.some(p => p.value === date) && date && (
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs shrink-0 flex items-center gap-1">
                    <span>📅</span>
                    <span>{formatDateChipLabel(date)}</span>
                  </span>
                )}
              </div>

              <input 
                type="date" 
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:border-zinc-900 dark:focus:border-white outline-none text-xs text-zinc-900 dark:text-white font-medium"
              />
            </div>
          </div>

          {/* Note Input with Quick Suggestions */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Note / Comment (Optional)
              </label>
              {previousNoteSuggestions.length > 0 && (
                <span className="text-[10px] text-zinc-400 font-medium">
                  {filteredNoteSuggestions.length > 0 ? 'Recent Comments' : ''}
                </span>
              )}
            </div>

            {/* Interactive Note Chips Row */}
            {filteredNoteSuggestions.length > 0 && (
              <div className="flex items-center gap-1 mb-1.5 overflow-x-auto no-scrollbar py-0.5">
                {filteredNoteSuggestions.map((suggestion) => {
                  const isSelected = note.trim().toLowerCase() === suggestion.toLowerCase();
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setNote(suggestion)}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all touch-feedback cursor-pointer shrink-0 flex items-center gap-1 ${
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                          : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700'
                      }`}
                    >
                      <FontAwesomeIcon icon={faCommentDots} className="text-[9px] opacity-70" />
                      <span>{suggestion}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <input 
              type="text" 
              list="tx-note-suggestions-list"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:border-zinc-900 dark:focus:border-white outline-none text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400"
              placeholder="e.g. Dinner, Coffee, Groceries"
            />
            <datalist id="tx-note-suggestions-list">
              {previousNoteSuggestions.map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2.5 mt-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer touch-feedback"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
            ) : (
              initialData && initialData.id ? 'Save Changes' : `Record ${type === 'income' ? 'Income' : 'Expense'}`
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default TransactionForm;
