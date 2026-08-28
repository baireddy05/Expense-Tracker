import React, { useState, useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useUI } from '../context/UIContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPiggyBank, 
  faPlus, 
  faBullseye, 
  faCoins, 
  faCheckCircle, 
  faCalendarAlt, 
  faTrash, 
  faEdit, 
  faHandHoldingDollar,
  faTrophy,
  faCar,
  faHouse,
  faPlane,
  faLaptop,
  faGraduationCap,
  faHeartPulse
} from '@fortawesome/free-solid-svg-icons';
import { getLocalDateString, formatDisplayDate } from '../utils/dateUtils';
import ConfirmModal from '../components/ui/ConfirmModal';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import toast from 'react-hot-toast';

const GOAL_ICONS = {
  'fa-bullseye': faBullseye,
  'fa-piggy-bank': faPiggyBank,
  'fa-plane': faPlane,
  'fa-car': faCar,
  'fa-house': faHouse,
  'fa-laptop': faLaptop,
  'fa-graduation-cap': faGraduationCap,
  'fa-heart-pulse': faHeartPulse
};

const COLOR_PRESETS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#6366f1'  // Indigo
];

const SavingsGoals = () => {
  const { 
    savingsGoals = [], 
    addSavingsGoal, 
    updateSavingsGoal, 
    deleteSavingsGoal, 
    contributeToGoal 
  } = useTransactions();
  
  const { isPrivacyMode } = useUI();

  // Modals state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBodyScrollLock(isGoalModalOpen || isDepositModalOpen);

  // Form states
  const [goalForm, setGoalForm] = useState({
    name: '',
    targetAmount: '',
    savedAmount: '',
    targetDate: '',
    icon: 'fa-bullseye',
    color: '#10b981'
  });

  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');

  const formatCurrency = (amount) => {
    if (isPrivacyMode) return '₹••••••';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  // Metrics Summary
  const summary = useMemo(() => {
    let totalTarget = 0;
    let totalSaved = 0;
    let completedCount = 0;

    savingsGoals.forEach(g => {
      const target = parseFloat(g.targetAmount) || 0;
      const saved = parseFloat(g.savedAmount) || 0;
      totalTarget += target;
      totalSaved += saved;
      if (saved >= target && target > 0) {
        completedCount++;
      }
    });

    const overallPercentage = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;
    return { totalTarget, totalSaved, overallPercentage, completedCount, activeCount: savingsGoals.length - completedCount };
  }, [savingsGoals]);

  // Open Create/Edit Modal
  const handleOpenGoalModal = (goal = null) => {
    if (goal) {
      setGoalForm({
        name: goal.name,
        targetAmount: goal.targetAmount,
        savedAmount: goal.savedAmount || 0,
        targetDate: goal.targetDate || '',
        icon: goal.icon || 'fa-bullseye',
        color: goal.color || '#10b981'
      });
      setEditingId(goal.id);
    } else {
      setGoalForm({
        name: '',
        targetAmount: '',
        savedAmount: '0',
        targetDate: '',
        icon: 'fa-bullseye',
        color: '#10b981'
      });
      setEditingId(null);
    }
    setIsGoalModalOpen(true);
  };

  // Save Goal
  const handleSaveGoal = async (e) => {
    e.preventDefault();
    if (!goalForm.name || !goalForm.targetAmount) {
      toast.error('Please enter a goal name and target amount');
      return;
    }

    const targetVal = parseFloat(goalForm.targetAmount);
    const savedVal = parseFloat(goalForm.savedAmount) || 0;

    if (targetVal <= 0) {
      toast.error('Target amount must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...goalForm,
        targetAmount: targetVal,
        savedAmount: savedVal,
        status: savedVal >= targetVal ? 'completed' : 'active'
      };

      if (editingId) {
        await updateSavingsGoal(editingId, payload);
        toast.success('Savings goal updated');
      } else {
        await addSavingsGoal(payload);
        toast.success('New savings goal created!');
      }
      setIsGoalModalOpen(false);
    } catch (err) {
      toast.error('Failed to save savings goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Goal
  const handleDeleteGoal = (id, name) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteSavingsGoal(deleteConfirm.id);
      toast.success('Goal deleted');
    } catch (err) {
      toast.error('Failed to delete goal');
    }
  };

  // Open Deposit Modal
  const handleOpenDepositModal = (goal) => {
    setSelectedGoal(goal);
    setDepositAmount('');
    setDepositNote('');
    setIsDepositModalOpen(true);
  };

  // Submit Deposit
  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid deposit amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await contributeToGoal(selectedGoal.id, depositAmount, depositNote);
      setIsDepositModalOpen(false);
    } catch (err) {
      // Toast handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for days remaining
  const getDaysRemaining = (targetDate) => {
    if (!targetDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Savings Goals & Targets
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Turn your financial dreams into reality with milestone target tracking
          </p>
        </div>

        <button
          onClick={() => handleOpenGoalModal()}
          className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer touch-feedback self-start sm:self-auto"
        >
          <FontAwesomeIcon icon={faPlus} />
          <span>New Savings Goal</span>
        </button>
      </header>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Saved
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.totalSaved)}
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faPiggyBank} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Across {savingsGoals.length} goal{savingsGoals.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Target Goal
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                {formatCurrency(summary.totalTarget)}
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faBullseye} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Remaining: {formatCurrency(Math.max(0, summary.totalTarget - summary.totalSaved))}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Overall Progress
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                {summary.overallPercentage.toFixed(1)}%
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faTrophy} />
            </div>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-700" 
              style={{ width: `${summary.overallPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Goals Cards List */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 px-1">
          Your Active & Completed Goals ({savingsGoals.length})
        </h2>

        {savingsGoals.length === 0 ? (
          <div className="glass-card p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto text-lg">
              <FontAwesomeIcon icon={faPiggyBank} />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">No Savings Goals Yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Start building your emergency fund, vacation budget, or dream purchase fund with easy target tracking.
            </p>
            <button
              onClick={() => handleOpenGoalModal()}
              className="mt-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Create Your First Goal</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savingsGoals.map(goal => {
              const target = parseFloat(goal.targetAmount) || 0;
              const saved = parseFloat(goal.savedAmount) || 0;
              const percent = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
              const isCompleted = saved >= target && target > 0;
              const iconObj = GOAL_ICONS[goal.icon] || faBullseye;
              const daysLeft = getDaysRemaining(goal.targetDate);

              return (
                <div 
                  key={goal.id} 
                  className={`glass-card p-5 relative overflow-hidden transition-all flex flex-col justify-between ${
                    isCompleted ? 'border-emerald-300/80 dark:border-emerald-800/60 bg-emerald-50/10 dark:bg-emerald-950/10' : ''
                  }`}
                >
                  {/* Top Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base shadow-2xs shrink-0"
                          style={{ backgroundColor: goal.color || '#10b981' }}
                        >
                          <FontAwesomeIcon icon={iconObj} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-tight">
                              {goal.name}
                            </h3>
                            {isCompleted && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <FontAwesomeIcon icon={faCheckCircle} />
                                <span>FUNDED</span>
                              </span>
                            )}
                          </div>
                          {goal.targetDate && (
                            <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                              <FontAwesomeIcon icon={faCalendarAlt} className="text-[9px]" />
                              <span>Target: {formatDisplayDate(goal.targetDate)}</span>
                              {daysLeft !== null && (
                                <span className={`font-semibold ${daysLeft < 0 ? 'text-rose-500' : daysLeft <= 30 ? 'text-amber-500' : 'text-zinc-500'}`}>
                                  ({daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`})
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenGoalModal(goal)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                          title="Edit Goal"
                        >
                          <FontAwesomeIcon icon={faEdit} className="text-[11px]" />
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(goal.id, goal.name)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Delete Goal"
                        >
                          <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar & Amount Row */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white">
                          {formatCurrency(saved)}
                        </span>
                        <span className="text-xs font-semibold text-zinc-400">
                          of {formatCurrency(target)}
                        </span>
                      </div>

                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-700 ease-out" 
                          style={{ 
                            width: `${percent}%`,
                            backgroundColor: goal.color || '#10b981'
                          }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-zinc-400">
                        <span>{percent.toFixed(1)}% completed</span>
                        <span>{isCompleted ? 'Target achieved! 🎉' : `${formatCurrency(target - saved)} to go`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">
                      {goal.contributions ? `${goal.contributions.length} deposit(s)` : 'No deposits logged'}
                    </span>

                    <button
                      onClick={() => handleOpenDepositModal(goal)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 transition-colors flex items-center gap-1.5 cursor-pointer touch-feedback"
                    >
                      <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                      <span>Add Funds</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Goal Add/Edit Modal */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden max-h-[90vh] flex flex-col my-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <FontAwesomeIcon icon={editingId ? faEdit : faPlus} className="text-zinc-400" />
                {editingId ? 'Edit Savings Goal' : 'New Savings Goal'}
              </h3>
              <button 
                onClick={() => setIsGoalModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Goal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={goalForm.name}
                  onChange={e => setGoalForm({ ...goalForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white"
                  placeholder="e.g. Vacation Fund, MacBook Pro, Emergency Reserve"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Target Amount <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xs">₹</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={goalForm.targetAmount}
                      onChange={e => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white font-medium"
                      placeholder="50000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Already Saved
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={goalForm.savedAmount}
                      onChange={e => setGoalForm({ ...goalForm, savedAmount: e.target.value })}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Target Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={goalForm.targetDate}
                  onChange={e => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Goal Color Theme
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setGoalForm({ ...goalForm, color })}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${goalForm.color === color ? 'scale-125 ring-2 ring-zinc-900 dark:ring-white ring-offset-2 dark:ring-offset-zinc-900' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Icon
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {Object.entries(GOAL_ICONS).map(([key, iconObj]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setGoalForm({ ...goalForm, icon: key })}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-center transition-all cursor-pointer ${goalForm.icon === key ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                    >
                      <FontAwesomeIcon icon={iconObj} />
                    </button>
                  ))}
                </div>
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
                    editingId ? 'Update Goal' : 'Create Goal'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit / Add Funds Modal */}
      {isDepositModalOpen && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden max-h-[90vh] flex flex-col my-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faHandHoldingDollar} className="text-emerald-500" />
                <span>Add Funds to "{selectedGoal.name}"</span>
              </h3>
              <button 
                onClick={() => setIsDepositModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDepositSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Deposit Amount <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xs">₹</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-sm font-bold text-zinc-900 dark:text-white"
                    placeholder="5000"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Note / Tag
                </label>
                <input
                  type="text"
                  value={depositNote}
                  onChange={e => setDepositNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white"
                  placeholder="e.g. Monthly salary savings, Bonus"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Confirm Contribution'
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
        title="Delete Savings Goal"
        message={`Are you sure you want to delete goal "${deleteConfirm.name}"? This action cannot be undone.`}
        confirmText="Delete Goal"
        isDanger={true}
      />
    </div>
  );
};

export default SavingsGoals;
