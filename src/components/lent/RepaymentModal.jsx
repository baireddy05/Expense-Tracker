import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTransactions } from '../../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheckCircle, faCalendarAlt, faFileAlt, faArrowRotateLeft } from '@fortawesome/free-solid-svg-icons';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import toast from 'react-hot-toast';

const RepaymentModal = ({ isOpen, onClose, record }) => {
  const { recordRepayment } = useTransactions();

  const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalToday());
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const totalAmount = record ? parseFloat(record.amount) || 0 : 0;
  const returnedAmount = record ? parseFloat(record.returnedAmount) || 0 : 0;
  const remainingAmount = Math.max(0, totalAmount - returnedAmount);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (record) {
      setAmount(remainingAmount > 0 ? String(remainingAmount) : '');
      setDate(getLocalToday());
      setNote('');
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (parsedAmount > remainingAmount) {
      toast.error(`Amount cannot exceed remaining balance (₹${remainingAmount.toLocaleString('en-IN')})`);
      return;
    }

    setLoading(true);
    try {
      await recordRepayment(record.id, {
        amount: parsedAmount,
        date,
        note: note.trim() || 'Repayment'
      });
      toast.success(`Recorded ₹${parsedAmount.toLocaleString('en-IN')} returned by ${record.borrowerName}!`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to record repayment');
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
        className="liquid-glass-dock w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-white/60 dark:border-white/10 overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-none animate-slide-up sm:animate-fade-in my-auto bg-white dark:bg-gray-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/50 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm shadow-2xs">
              <FontAwesomeIcon icon={faArrowRotateLeft} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Record Repayment
              </h2>
              <p className="text-xs text-zinc-400">
                From <span className="font-semibold text-zinc-800 dark:text-zinc-200">{record.borrowerName}</span>
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

        {/* Debt State Summary */}
        <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border-b border-white/50 dark:border-white/10 shrink-0">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl liquid-glass-subtle">
              <p className="text-zinc-400 text-[10px] font-semibold uppercase">Total Lent</p>
              <p className="font-bold text-zinc-800 dark:text-zinc-200 text-xs mt-0.5">
                ₹{totalAmount.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-2 rounded-xl liquid-glass-subtle">
              <p className="text-zinc-400 text-[10px] font-semibold uppercase">Returned</p>
              <p className="font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                ₹{returnedAmount.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
              <p className="text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase">Pending</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-300 text-xs mt-0.5">
                ₹{remainingAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto sm:overflow-visible p-5 space-y-4 pb-8 sm:pb-5">
          {/* Amount input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Amount Received (₹) <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setAmount(String(remainingAmount))}
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Pay Full (₹{remainingAmount.toLocaleString('en-IN')})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={remainingAmount}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-sm font-semibold dark:text-white bg-gray-50 dark:bg-gray-800"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
              Date Received <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white font-medium bg-gray-50 dark:bg-gray-800"
            />
          </div>

          {/* Note / Payment method */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
              Payment Method / Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. GPay, Cash, Bank Transfer"
              className="w-full px-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white bg-gray-50 dark:bg-gray-800"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || remainingAmount <= 0}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer touch-feedback"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheckCircle} className="text-xs" />
                  <span>Confirm Repayment</span>
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

export default RepaymentModal;
