import React, { useState, useEffect } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const TransactionForm = ({ isOpen, onClose, initialData = null }) => {
  const { categories, addTransaction, updateTransaction } = useTransactions();
  
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
      setType(initialData.type);
      setAmount(initialData.amount);
      setCategoryId(initialData.categoryId);
      setDate(initialData.date.split('T')[0]);
      setNote(initialData.note || '');
    } else {
      setType('expense');
      setAmount('');
      setCategoryId('');
      setDate(getLocalToday());
      setNote('');
      setIsCreatingCategory(false);
      setNewCategoryName('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !categoryId || !date) return;
    
    setLoading(true);
    try {
      const txData = { type, amount: parseFloat(amount), categoryId, date, note };
      if (initialData) {
        await updateTransaction(initialData.id, txData);
        toast.success('Transaction updated!');
      } else {
        await addTransaction(txData);
        toast.success('Transaction added!');
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const { addCategory } = useTransactions();
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
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
      toast.success('Category created!');
    } catch (error) {
      console.error("Failed to create category", error);
      toast.error('Failed to create category');
    }
  };

  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-in border border-gray-200 dark:border-gray-800 flex flex-col max-h-[85dvh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {initialData ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 pb-8 sm:pb-6">
          <div className="flex rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 p-1 shrink-0">
            <button 
              type="button" 
              onClick={() => setType('expense')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${type === 'expense' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'}`}
            >
              Expense
            </button>
            <button 
              type="button" 
              onClick={() => setType('income')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${type === 'income' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'}`}
            >
              Income
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input 
                type="number" 
                step="0.01" 
                min="0"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              {!isCreatingCategory && (
                <button type="button" onClick={() => setIsCreatingCategory(true)} className="text-xs text-primary-600 hover:text-primary-500 font-medium">
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
                  className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
                  autoFocus
                />
                <button type="button" onClick={handleCreateCategory} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-500 transition-colors">
                  Save
                </button>
                <button type="button" onClick={() => setIsCreatingCategory(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <select 
                required
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white appearance-none"
              >
                <option value="" disabled>Select a category</option>
                {filteredCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input 
              type="date" 
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note (Optional)</label>
            <input 
              type="text" 
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
              placeholder="e.g. Groceries"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (initialData ? 'Save Changes' : 'Add Transaction')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
