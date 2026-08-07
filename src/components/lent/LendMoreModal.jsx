import React, { useState, useEffect } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faHandHoldingDollar, 
  faCalendarAlt, 
  faFileAlt, 
  faPlus, 
  faCoins,
  faArrowTrendUp,
  faUser
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
      toast.error('Please enter a valid amount to lend');
      return;
    }

    setLoading(true);
    try {
      await lendMoreMoney(record.id, {
        amount: parsedNewAmount,
        date,
        dueDate: dueDate || record.dueDate || null,
        note: note.trim() || 'Additional loan'
      });
      toast.success(`Successfully recorded ₹${parsedNewAmount.toLocaleString('en-IN')} lent to ${record.borrowerName}!`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to record additional loan');
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
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <FontAwesomeIcon icon={faHandHoldingDollar} className="text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Lend More Money</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  New Disbursement Log
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                To <span className="font-semibold text-gray-800 dark:text-gray-200">{record.borrowerName}</span> (Keeps timeline logs)
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

        {/* Current State vs Future State Balance Summary */}
        <div className="px-6 pt-4 pb-1">
          <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">Previously Lent</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm mt-0.5">
                  ₹{currentTotalLent.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">Already Returned</p>
                <p className="font-bold text-green-600 dark:text-green-400 text-sm mt-0.5">
                  ₹{currentReturned.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-[11px]">Current Pending</p>
                <p className="font-bold text-amber-600 dark:text-amber-400 text-sm mt-0.5">
                  ₹{currentRemaining.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {parsedNewAmount > 0 && (
              <div className="mt-3 pt-2.5 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-between text-xs animate-fade-in">
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                  <FontAwesomeIcon icon={faArrowTrendUp} />
                  <span>After this ₹{parsedNewAmount.toLocaleString('en-IN')} top-up:</span>
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  New Pending: <strong className="text-amber-600 dark:text-amber-400">₹{newRemaining.toLocaleString('en-IN')}</strong> (Total Lent: ₹{newTotalLent.toLocaleString('en-IN')})
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
              Additional Amount to Lend (₹) <span className="text-red-500">*</span>
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
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-white text-lg font-bold"
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
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
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
                Date Lent <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-white text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                Expected Return Date (Optional)
              </label>
              <div className="relative">
                <input
                  type="date"
                  min={date}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Note / Reason */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Reason / Note for this top-up (Logged in history)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-gray-400">
                <FontAwesomeIcon icon={faFileAlt} />
              </span>
              <textarea
                rows="2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Weekend dinner split, Shopping bill, Petrol expense, Urgent help"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-white text-sm resize-none"
              />
            </div>
          </div>

          {/* Submission button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !parsedNewAmount || parsedNewAmount <= 0}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} />
                  <span>
                    Confirm & Lend ₹{parsedNewAmount > 0 ? parsedNewAmount.toLocaleString('en-IN') : '0'} More
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

export default LendMoreModal;
