import React, { useState, useEffect } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const TransactionForm = ({ isOpen, onClose, initialData = null, defaultType = 'expense' }) => {
  const { categories, addTransaction, updateTransaction, addCategory } = useTransactions();
  
  const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(getLocalToday());
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || 'expense');
      setAmount(initialData.amount || '');
      setCategoryId(initialData.categoryId || '');
      setDate(initialData.date ? initialData.date.split('T')[0] : getLocalToday());
      setNote(initialData.note || '');
    } else {
      setType(defaultType || 'expense');
      setAmount('');
      setCategoryId('');
      setDate(getLocalToday());
      setNote('');
      setIsCreatingCategory(false);
      setNewCategoryName('');
    }
  }, [initialData, isOpen, defaultType]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !categoryId || !date) return;
    
    setLoading(true);
    try {
      const txData = { type, amount: parseFloat(amount), categoryId, date, note };
      if (initialData) {
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[88dvh] animate-slide-up sm:animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80 shrink-0">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            {initialData ? 'Edit Transaction' : 'Record Transaction'}
          </h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-feedback"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xs" />
          </button>
        </div>
        
        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 pb-8 sm:pb-5">
          {/* Expense / Income Toggle */}
          <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-1 shrink-0">
            <button 
              type="button" 
              onClick={() => setType('expense')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all touch-feedback ${
                type === 'expense' 
                  ? 'bg-white dark:bg-zinc-900 shadow-2xs text-zinc-900 dark:text-white' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Expense
            </button>
            <button 
              type="button" 
              onClick={() => setType('income')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all touch-feedback ${
                type === 'income' 
                  ? 'bg-white dark:bg-zinc-900 shadow-2xs text-zinc-900 dark:text-white' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Income
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
              Amount (INR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-sm">₹</span>
              <input 
                type="number" 
                step="0.01" 
                min="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-base font-semibold dark:text-white"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Category
              </label>
              {!isCreatingCategory && (
                <button 
                  type="button" 
                  onClick={() => setIsCreatingCategory(true)} 
                  className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-medium"
                >
                  + New Category
                </button>
              )}
            </div>
            
            {isCreatingCategory ? (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="Category Name"
                  className="flex-1 px-3 py-2 bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white"
                  autoFocus
                />
                <button 
                  type="button" 
                  onClick={handleCreateCategory} 
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold transition-colors touch-feedback"
                >
                  Save
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsCreatingCategory(false)} 
                  className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors touch-feedback"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select 
                required
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white appearance-none cursor-pointer font-medium"
              >
                <option value="" disabled>Select category</option>
                {filteredCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
              Date
            </label>
            <input 
              type="date" 
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white font-medium"
            />
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
              Note (Optional)
            </label>
            <input 
              type="text" 
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white"
              placeholder="e.g. Dinner, Coffee, Groceries"
            />
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer touch-feedback"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
            ) : (
              initialData ? 'Save Changes' : 'Record Transaction'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
