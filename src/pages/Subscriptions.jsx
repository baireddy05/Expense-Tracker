import React, { useState, useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useUI } from '../context/UIContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt, 
  faPlus, 
  faSyncAlt, 
  faToggleOn, 
  faToggleOff,
  faEdit,
  faTrash,
  faWallet
} from '@fortawesome/free-solid-svg-icons';
import { getCategoryIcon } from '../utils/categoryIcons';
import { getLocalDateString, formatDisplayDate } from '../utils/dateUtils';
import ConfirmModal from '../components/ui/ConfirmModal';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import toast from 'react-hot-toast';

const Subscriptions = () => {
  const { 
    subscriptions, 
    categories, 
    addSubscription, 
    updateSubscription, 
    deleteSubscription 
  } = useTransactions();
  
  const { isPrivacyMode } = useUI();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBodyScrollLock(isModalOpen);

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    categoryId: '',
    frequency: 'monthly',
    nextDueDate: getLocalDateString(),
    active: true,
    type: 'expense'
  });

  const formatCurrency = (amount) => {
    if (isPrivacyMode) return '₹••••••';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  const handleOpenModal = (sub = null) => {
    if (sub) {
      setFormData({
        name: sub.name,
        amount: sub.amount,
        categoryId: sub.categoryId,
        frequency: sub.frequency,
        nextDueDate: sub.nextDueDate,
        active: sub.active,
        type: sub.type || 'expense'
      });
      setEditingId(sub.id);
    } else {
      setFormData({
        name: '',
        amount: '',
        categoryId: categories.find(c => c.type === 'expense')?.id || '',
        frequency: 'monthly',
        nextDueDate: getLocalDateString(),
        active: true,
        type: 'expense'
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.amount || !formData.categoryId || !formData.nextDueDate) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount)
      };

      if (editingId) {
        await updateSubscription(editingId, payload);
        toast.success('Subscription updated successfully!');
      } else {
        await addSubscription(payload);
        toast.success('Subscription added successfully!');
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error('Failed to save subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id, name) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteSubscription(deleteConfirm.id);
      toast.success('Subscription deleted');
    } catch (err) {
      toast.error('Failed to delete subscription');
    }
  };

  const handleToggleActive = async (sub) => {
    try {
      await updateSubscription(sub.id, { active: !sub.active });
      toast.success(sub.active ? 'Subscription paused' : 'Subscription activated');
    } catch (err) {
      toast.error('Failed to toggle subscription');
    }
  };

  const stats = useMemo(() => {
    let activeMonthlyTotal = 0;
    
    subscriptions.forEach(s => {
      if (s.active && s.type === 'expense') {
        const amt = parseFloat(s.amount) || 0;
        if (s.frequency === 'daily') activeMonthlyTotal += amt * 30;
        else if (s.frequency === 'weekly') activeMonthlyTotal += amt * 4.33;
        else if (s.frequency === 'monthly') activeMonthlyTotal += amt;
        else if (s.frequency === 'yearly') activeMonthlyTotal += amt / 12;
      }
    });

    const activeCount = subscriptions.filter(s => s.active).length;

    return { activeMonthlyTotal, activeCount, totalCount: subscriptions.length };
  }, [subscriptions]);

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Subscriptions
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage your recurring fixed costs & auto-payments
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer touch-feedback"
        >
          <FontAwesomeIcon icon={faPlus} />
          <span>Add Subscription</span>
        </button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Monthly Fixed Costs
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-rose-500">
                {formatCurrency(stats.activeMonthlyTotal)}
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faSyncAlt} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Based on {stats.activeCount} active subscriptions
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Tracked
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                {stats.totalCount}
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faWallet} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Including paused subscriptions
          </p>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
          <h2 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faCalendarAlt} className="text-zinc-400" />
            <span>All Recurring Items</span>
          </h2>
        </div>
        
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {subscriptions.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-xs">
              No subscriptions found. Click "Add Subscription" to track your recurring expenses like Netflix, Spotify, or Rent.
            </div>
          ) : (
            subscriptions.map(sub => {
              const cat = categories.find(c => c.id === sub.categoryId);
              const catName = cat?.name || 'Unknown';
              const catIcon = cat?.icon || '🏷️';
              const catColor = cat?.color || '#71717a';

              return (
                <div key={sub.id} className={`p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 ${!sub.active ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                  
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm shadow-2xs shrink-0"
                      style={{ backgroundColor: catColor }}
                    >
                      <FontAwesomeIcon icon={getCategoryIcon(catIcon)} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-tight">
                        {sub.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {catName}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 capitalize">
                          {sub.frequency}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 border-zinc-100 dark:border-zinc-800/80 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className={`font-bold text-sm ${sub.type === 'income' ? 'text-emerald-500' : 'text-zinc-900 dark:text-white'}`}>
                        {sub.type === 'income' ? '+' : '-'}{formatCurrency(sub.amount)}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                        Next Due: {formatDisplayDate(sub.nextDueDate)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleToggleActive(sub)}
                        className={`text-lg p-1 transition-colors cursor-pointer touch-feedback ${sub.active ? 'text-emerald-500 hover:text-emerald-600' : 'text-zinc-400 hover:text-zinc-500'}`}
                        title={sub.active ? "Pause Auto-Post" : "Activate Auto-Post"}
                      >
                        <FontAwesomeIcon icon={sub.active ? faToggleOn : faToggleOff} />
                      </button>
                      
                      <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
                      
                      <button 
                        onClick={() => handleOpenModal(sub)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer touch-feedback"
                      >
                        <FontAwesomeIcon icon={faEdit} className="text-[11px]" />
                      </button>
                      <button 
                        onClick={() => handleDelete(sub.id, sub.name)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer touch-feedback"
                      >
                        <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden max-h-[90vh] flex flex-col my-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faSyncAlt} className="text-zinc-400" />
                {editingId ? 'Edit Subscription' : 'New Subscription'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Name (e.g. Netflix, Gym) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white"
                  placeholder="Subscription name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Amount <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xs">₹</span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select category</option>
                  {categories.filter(c => formData.type === 'expense' ? c.type !== 'income' : c.type === 'income').map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Frequency
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Next Due Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.nextDueDate}
                    onChange={e => setFormData({ ...formData, nextDueDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50">
                <input 
                  type="checkbox" 
                  id="activeSub" 
                  checked={formData.active} 
                  onChange={(e) => setFormData({...formData, active: e.target.checked})}
                  className="w-4 h-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer accent-zinc-900 dark:accent-white"
                />
                <label htmlFor="activeSub" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer flex-1">
                  Active (Auto-posts on due date)
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-all disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin" />
                  ) : (
                    'Save Subscription'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deletion */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete Subscription"
        message={`Are you sure you want to delete "${deleteConfirm.name}"? It will no longer auto-post transactions.`}
        confirmText="Delete Subscription"
        isDanger={true}
      />
    </div>
  );
};

export default Subscriptions;
