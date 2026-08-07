import React, { useState, useEffect } from 'react';
import { useTransactions } from '../../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUser, faCalendarAlt, faPhone, faFileAlt, faHandHolding, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const BorrowFormModal = ({ isOpen, onClose, initialData = null }) => {
  const { addBorrowedRecord, updateBorrowedRecord } = useTransactions();

  const getLocalToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [lenderName, setLenderName] = useState('');
  const [amount, setAmount] = useState('');
  const [dateBorrowed, setDateBorrowed] = useState(getLocalToday());
  const [dueDate, setDueDate] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setLenderName(initialData.lenderName || '');
      setAmount(initialData.amount ? String(initialData.amount) : '');
      setDateBorrowed(initialData.dateBorrowed || getLocalToday());
      setDueDate(initialData.dueDate || '');
      setPhone(initialData.phone || '');
      setNote(initialData.note || '');
    } else {
      setLenderName('');
      setAmount('');
      setDateBorrowed(getLocalToday());
      setDueDate('');
      setPhone('');
      setNote('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lenderName.trim() || !amount || parseFloat(amount) <= 0) {
      toast.error('Please provide lender name and a valid amount');
      return;
    }

    setLoading(true);
    try {
      const recordPayload = {
        lenderName: lenderName.trim(),
        amount: parseFloat(amount),
        dateBorrowed,
        dueDate: dueDate || null,
        phone: phone.trim() || null,
        note: note.trim() || ''
      };

      if (initialData) {
        await updateBorrowedRecord(initialData.id, recordPayload);
        toast.success('Borrowed record updated!');
      } else {
        const initialAmount = parseFloat(amount);
        await addBorrowedRecord({
          ...recordPayload,
          returnedAmount: 0,
          status: 'pending',
          repayments: [],
          borrows: [
            {
              id: 'borrow_' + Date.now(),
              amount: initialAmount,
              date: dateBorrowed,
              note: note.trim() || 'Initial borrowed money'
            }
          ]
        });
        toast.success(`Recorded ₹${initialAmount.toLocaleString('en-IN')} borrowed from ${lenderName.trim()}!`);
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save borrowed record');
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
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {initialData ? 'Edit Borrowed Money' : 'Borrow Money from Friend'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Track debts you owe & repayments you make
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Friend / Lender's Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <FontAwesomeIcon icon={faUser} />
              </span>
              <input
                type="text"
                required
                value={lenderName}
                onChange={(e) => setLenderName(e.target.value)}
                placeholder="e.g. Karan, Ananya, David, Dad"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Amount Borrowed (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₹</span>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white text-lg font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                Date Borrowed <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={dateBorrowed}
                  onChange={(e) => setDateBorrowed(e.target.value)}
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
                  min={dateBorrowed}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Lender's Phone / WhatsApp (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <FontAwesomeIcon icon={faPhone} />
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Reason / Purpose (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-gray-400">
                <FontAwesomeIcon icon={faFileAlt} />
              </span>
              <textarea
                rows="2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Emergency medical bills, Laptop repair, College semester fee"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white text-sm resize-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FontAwesomeIcon icon={faHandHolding} />
                  <span>{initialData ? 'Save Changes' : 'Record Borrowed Money'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BorrowFormModal;
