import React, { useState, useEffect } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheckCircle, faCalendarAlt, faFileAlt, faArrowRotateLeft } from '@fortawesome/free-solid-svg-icons';
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

  useEffect(() => {
    if (record) {
      setAmount(remainingAmount > 0 ? String(remainingAmount) : '');
      setDate(getLocalToday());
      setNote('UPI / GPay');
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Please enter a valid repayment amount');
      return;
    }

    if (parsedAmount > remainingAmount) {
      toast.error(`Repayment cannot exceed remaining balance (₹${remainingAmount.toLocaleString('en-IN')})`);
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 dark:bg-green-400/10 flex items-center justify-center text-green-600 dark:text-green-400">
              <FontAwesomeIcon icon={faArrowRotateLeft} className="text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Record Repayment
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                From <span className="font-semibold text-gray-800 dark:text-gray-200">{record.borrowerName}</span>
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

        {/* Repayment Summary Box */}
        <div className="px-6 pt-4 pb-2">
          <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Total Lent</p>
              <p className="font-bold text-gray-900 dark:text-white text-sm">
                ₹{totalAmount.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400">Already Returned</p>
              <p className="font-bold text-green-600 dark:text-green-400 text-sm">
                ₹{returnedAmount.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 dark:text-gray-400">Remaining Balance</p>
              <p className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                ₹{remainingAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Amount Received (₹) <span className="text-red-500">*</span>
              </label>
              {remainingAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(remainingAmount))}
                  className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline"
                >
                  Pay Full (₹{remainingAmount.toLocaleString('en-IN')})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₹</span>
              <input
                type="number"
                step="0.01"
                min="1"
                max={remainingAmount}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all dark:text-white text-lg font-medium"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Repayment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Payment Method / Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. GPay, Cash, Bank Transfer"
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all dark:text-white text-sm"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || remainingAmount <= 0}
              className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg shadow-green-600/25 transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>Confirm Repayment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RepaymentModal;
