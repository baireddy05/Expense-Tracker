import React, { useState, useEffect } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faHandHolding, 
  faCalendarAlt, 
  faFileAlt, 
  faPlus, 
  faArrowTrendUp
} from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const BorrowMoreModal = ({ isOpen, onClose, record }) => {
  const { borrowMoreMoney } = useTransactions();

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

  const currentTotalBorrowed = record ? parseFloat(record.amount) || 0 : 0;
  const currentReturned = record ? parseFloat(record.returnedAmount) || 0 : 0;
  const currentRemaining = Math.max(0, currentTotalBorrowed - currentReturned);

  const parsedNewAmount = parseFloat(amount) || 0;
  const newTotalBorrowed = currentTotalBorrowed + parsedNewAmount;
  const newRemainingDebt = Math.max(0, newTotalBorrowed - currentReturned);

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
    if (!parsedNewAmount || parsedNewAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      await borrowMoreMoney(record.id, {
        amount: parsedNewAmount,
        date,
        dueDate: dueDate || record.dueDate || null,
        note: note.trim() || 'Additional borrowed money'
      });
      toast.success(`Recorded ₹${parsedNewAmount.toLocaleString('en-IN')} borrowed from ${record.lenderName}!`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to record additional borrow amount');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-400/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <FontAwesomeIcon icon={faHandHolding} className="text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Borrow More Money</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                  New Borrow Log
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                From <span className="font-semibold text-gray-800 dark:text-gray-200">{record.lenderName}</span> (Tracked in history)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Debt State Summary */}
        <div className="px-6 pt-4 pb-1">
          <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">Previously Borrowed</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm mt-0.5">
                  ₹{currentTotalBorrowed.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">Already Repaid</p>
                <p className="font-bold text-green-600 dark:text-green-400 text-sm mt-0.5">
                  ₹{currentReturned.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">Current Debt</p>
                <p className="font-bold text-rose-600 dark:text-rose-400 text-sm mt-0.5">
                  ₹{currentRemaining.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {parsedNewAmount > 0 && (
              <div className="mt-3 pt-2.5 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-between text-xs animate-fade-in">
                <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
                  <FontAwesomeIcon icon={faArrowTrendUp} />
                  <span>After this ₹{parsedNewAmount.toLocaleString('en-IN')} borrow:</span>
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  New Debt Owed: <strong className="text-rose-600 dark:text-rose-400">₹{newRemainingDebt.toLocaleString('en-IN')}</strong> (Total Borrowed: ₹{newTotalBorrowed.toLocaleString('en-IN')})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Additional Amount to Borrow (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-lg">₹</span>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white text-lg font-bold"
                autoFocus
              />
            </div>

            {/* Quick Add Chips */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-gray-400 font-medium">Quick Add:</span>
              <div className="flex flex-wrap gap-1.5">
                {quickAmounts.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAdd(val)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                  >
                    +₹{val.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                Date Borrowed <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                Promise to Return By (Optional)
              </label>
              <div className="relative">
                <input
                  type="date"
                  min={date}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Note / Reason */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Reason / Purpose for this top-up (Logged in history)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-gray-400">
                <FontAwesomeIcon icon={faFileAlt} />
              </span>
              <textarea
                rows="2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Month-end expenses, Grocery bill help, Travel expenses"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white text-sm resize-none"
              />
            </div>
          </div>

          {/* Submission button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !parsedNewAmount || parsedNewAmount <= 0}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} />
                  <span>
                    Confirm & Borrow ₹{parsedNewAmount > 0 ? parsedNewAmount.toLocaleString('en-IN') : '0'} More
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BorrowMoreModal;
