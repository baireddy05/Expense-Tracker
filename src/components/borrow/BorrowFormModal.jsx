import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTransactions } from '../../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUser, faPhone, faFileAlt, faHandHolding, faCommentDots } from '@fortawesome/free-solid-svg-icons';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import toast from 'react-hot-toast';

const BorrowFormModal = ({ isOpen, onClose, initialData = null }) => {
  const { borrowedRecords = [], addBorrowedRecord, updateBorrowedRecord } = useTransactions();

  // Extract previous lender names & notes for instant 1-tap suggestions
  const { previousLenderSuggestions, previousNoteSuggestions } = useMemo(() => {
    const nameMap = new Map();
    const noteMap = new Map();
    
    (borrowedRecords || []).forEach(r => {
      if (r.lenderName && r.lenderName.trim()) {
        const name = r.lenderName.trim();
        nameMap.set(name, (nameMap.get(name) || 0) + 1);
      }
      if (r.note && r.note.trim()) {
        const n = r.note.trim();
        noteMap.set(n, (noteMap.get(n) || 0) + 1);
      }
    });

    const names = Array.from(nameMap.keys()).sort((a, b) => nameMap.get(b) - nameMap.get(a)).slice(0, 15);
    const notes = Array.from(noteMap.keys()).sort((a, b) => noteMap.get(b) - noteMap.get(a)).slice(0, 15);
    
    return { previousLenderSuggestions: names, previousNoteSuggestions: notes };
  }, [borrowedRecords]);

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

  useBodyScrollLock(isOpen);

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
    if (!lenderName.trim() || !amount || !dateBorrowed) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const recordPayload = {
        lenderName: lenderName.trim(),
        amount: parseFloat(amount),
        dateBorrowed,
        dueDate: dueDate || null,
        phone: phone.trim(),
        note: note.trim()
      };

      if (initialData) {
        await updateBorrowedRecord(initialData.id, recordPayload);
        toast.success('Borrowed record updated');
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
        toast.success(`Recorded ₹${initialAmount.toLocaleString('en-IN')} borrowed from ${lenderName.trim()}`);
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save borrowed record');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-none animate-slide-up sm:animate-fade-in sm:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm shadow-2xs">
              <FontAwesomeIcon icon={faHandHolding} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                {initialData ? 'Edit Borrowed Record' : 'Record Borrowed Money'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tracked as a liability / debt to repay
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-feedback cursor-pointer"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xs" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto sm:overflow-visible p-5 space-y-4 pb-safe sm:pb-5">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Friend / Lender Name <span className="text-rose-500">*</span>
              </label>
              {previousLenderSuggestions.length > 0 && (
                <span className="text-[10px] text-zinc-400 font-medium">Recent Lenders</span>
              )}
            </div>

            {previousLenderSuggestions.length > 0 && (
              <div className="flex items-center gap-1 mb-1.5 overflow-x-auto no-scrollbar py-0.5">
                {previousLenderSuggestions.slice(0, 6).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setLenderName(name)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all touch-feedback cursor-pointer shrink-0 ${
                      lenderName.trim().toLowerCase() === name.toLowerCase()
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                        : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700'
                    }`}
                  >
                    👤 {name}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                <FontAwesomeIcon icon={faUser} />
              </span>
              <input
                type="text"
                required
                list="lender-name-suggestions"
                value={lenderName}
                onChange={(e) => setLenderName(e.target.value)}
                placeholder="e.g. Varshith, Surya"
                className="w-full pl-9 pr-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:border-zinc-900 dark:focus:border-white outline-none text-xs text-zinc-900 dark:text-white font-medium"
              />
              <datalist id="lender-name-suggestions">
                {previousLenderSuggestions.map(n => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Amount Borrowed (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 font-bold text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:border-zinc-900 dark:focus:border-white outline-none text-sm font-bold text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Date Borrowed <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dateBorrowed}
                onChange={(e) => setDateBorrowed(e.target.value)}
                className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:border-zinc-900 dark:focus:border-white outline-none text-xs text-zinc-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                Expected Repay Date (Optional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:border-zinc-900 dark:focus:border-white outline-none text-xs text-zinc-900 dark:text-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Lender's Phone (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                <FontAwesomeIcon icon={faPhone} />
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-9 pr-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:border-zinc-900 dark:focus:border-white outline-none text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Reason / Note (Optional)
              </label>
              {previousNoteSuggestions.length > 0 && (
                <span className="text-[10px] text-zinc-400 font-medium">Recent Reasons</span>
              )}
            </div>

            {previousNoteSuggestions.length > 0 && (
              <div className="flex items-center gap-1 mb-1.5 overflow-x-auto no-scrollbar py-0.5">
                {previousNoteSuggestions.slice(0, 6).map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setNote(reason)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all touch-feedback cursor-pointer shrink-0 flex items-center gap-1 ${
                      note.trim().toLowerCase() === reason.toLowerCase()
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                        : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700'
                    }`}
                  >
                    <FontAwesomeIcon icon={faCommentDots} className="text-[9px] opacity-70" />
                    <span>{reason}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <span className="absolute left-3.5 top-3 text-zinc-400 text-xs">
                <FontAwesomeIcon icon={faFileAlt} />
              </span>
              <textarea
                rows="2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Emergency expense, Laptop EMI support"
                className="w-full pl-9 pr-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:border-zinc-900 dark:focus:border-white outline-none text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 resize-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer touch-feedback disabled:opacity-60"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
              ) : (
                initialData ? 'Save Changes' : 'Record Borrowed Money'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default BorrowFormModal;
