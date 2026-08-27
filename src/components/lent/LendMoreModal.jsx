import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTransactions } from '../../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faHandHoldingDollar, 
  faFileAlt, 
  faPlus, 
  faArrowTrendUp
} from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const LendMoreModal = ({ isOpen, onClose, record }) => {
  const { lendMoreMoney } = useTransactions();

  const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalToday());
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const currentTotalLent = record ? parseFloat(record.amount) || 0 : 0;
  const currentReturned = record ? parseFloat(record.returnedAmount) || 0 : 0;
  const currentRemaining = Math.max(0, currentTotalLent - currentReturned);

  const parsedNewAmount = parseFloat(amount) || 0;
  const newTotalLent = currentTotalLent + parsedNewAmount;
  const newRemaining = Math.max(0, newTotalLent - currentReturned);

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
    if (record) {
      setAmount('');
      setDate(getLocalToday());
      setDueDate(record.dueDate || '');
      setNote('');
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const quickAmounts = [500, 1000, 2000, 5000];

  const handleQuickAdd = (val) => {
    const currentVal = parseFloat(amount) || 0;
    setAmount(String(currentVal + val));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid loan amount');
      return;
    }

    setLoading(true);
    try {
      await lendMoreMoney(record.id, {
        amount: parseFloat(amount),
        date,
        dueDate: dueDate || null,
        note: note.trim() || 'Additional loan'
      });
      toast.success(`Logged ₹${parseFloat(amount).toLocaleString('en-IN')} additional loan for ${record.borrowerName}`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to record additional loan');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="liquid-glass-dock w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-white/60 dark:border-white/10 overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-none animate-slide-up sm:animate-fade-in my-auto bg-white dark:bg-gray-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/50 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm shadow-2xs">
              <FontAwesomeIcon icon={faHandHoldingDollar} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Lend More Money</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  New Disbursement Log
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                To <span className="font-semibold text-zinc-800 dark:text-zinc-200">{record.borrowerName}</span> (Keeps timeline logs)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10 transition-colors touch-feedback cursor-pointer"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xs" />
          </button>
        </div>

        {/* Dynamic Balance Impact Preview */}
        <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border-b border-white/50 dark:border-white/10 shrink-0">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-2.5 rounded-xl liquid-glass-subtle">
              <p className="text-[10px] uppercase font-semibold text-zinc-400">Current Pending</p>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                ₹{currentRemaining.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
              <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
                <span>New Total Pending</span>
                <FontAwesomeIcon icon={faArrowTrendUp} className="text-[9px]" />
              </p>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                ₹{newRemaining.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto sm:overflow-visible p-5 space-y-4 pb-8 sm:pb-5">
          {/* Additional Amount */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
              Additional Amount to Lend (₹) <span className="text-rose-500">*</span>
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
                placeholder="0.00"
                className="w-full pl-8 pr-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-sm font-semibold dark:text-white bg-gray-50 dark:bg-gray-800"
              />
            </div>

            {/* Quick increment chips */}
            <div className="flex gap-2 mt-2">
              {quickAmounts.map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAdd(val)}
                  className="flex-1 py-1 text-xs font-semibold rounded-lg liquid-glass-subtle hover:bg-white/60 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 transition-colors touch-feedback cursor-pointer"
                >
                  +{val}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Updated Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                Disbursement Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white font-medium bg-gray-50 dark:bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                Updated Due Date (Optional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white font-medium bg-gray-50 dark:bg-gray-800"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
              Reason / Note for this Loan
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-zinc-400 text-xs">
                <FontAwesomeIcon icon={faFileAlt} />
              </span>
              <textarea
                rows="2"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Additional college tuition fee, emergency split"
                className="w-full pl-9 pr-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white resize-none bg-gray-50 dark:bg-gray-800"
              />
            </div>
          </div>

          {/* Submission button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !parsedNewAmount || parsedNewAmount <= 0}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer touch-feedback"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  <span>
                    Confirm & Lend ₹{parsedNewAmount > 0 ? parsedNewAmount.toLocaleString('en-IN') : '0'} More
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default LendMoreModal;
