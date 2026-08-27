import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const ReminderModal = ({ isOpen, onClose, record }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  if (!isOpen || !record) return null;

  const totalAmount = parseFloat(record.amount) || 0;
  const returnedAmount = parseFloat(record.returnedAmount) || 0;
  const remaining = Math.max(0, totalAmount - returnedAmount);

  const formattedDate = new Date(record.dateLent).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const dueDateText = record.dueDate 
    ? ` (due by ${new Date(record.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})` 
    : '';

  const message = `Hi ${record.borrowerName}, hope you are doing well! Just a gentle reminder regarding the ₹${remaining.toLocaleString('en-IN')} pending balance from the ₹${totalAmount.toLocaleString('en-IN')} lent on ${formattedDate}${record.note ? ` for "${record.note}"` : ''}${dueDateText}. Please send it over whenever convenient. Thanks!`;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success('Reminder message copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    let cleanPhone = (record.phone || '').replace(/\D/g, '');
    if (cleanPhone && !cleanPhone.startsWith('91') && cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
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
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/50 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm shadow-2xs">
              <FontAwesomeIcon icon={faPaperPlane} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Friendly Reminder
              </h2>
              <p className="text-xs text-zinc-400">
                Polite message for {record.borrowerName}
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

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Message Preview
            </label>
            <div className="p-3.5 liquid-glass-subtle rounded-2xl text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 select-all border border-white/50 dark:border-white/10 bg-gray-50 dark:bg-gray-800">
              {message}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 py-2.5 px-3.5 liquid-glass-subtle hover:bg-white/60 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs cursor-pointer touch-feedback"
            >
              <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-emerald-500' : ''} />
              <span>{copied ? 'Copied!' : 'Copy Message'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex-1 py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer touch-feedback"
            >
              <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
              <span>Send WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReminderModal;
