import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faCopy, faCheck, faPhone, faComments } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const BorrowReminderModal = ({ isOpen, onClose, record }) => {
  const total = record ? parseFloat(record.amount) || 0 : 0;
  const returned = record ? parseFloat(record.returnedAmount) || 0 : 0;
  const remaining = Math.max(0, total - returned);

  const defaultMsg = record 
    ? `Hey ${record.lenderName}, just updating you regarding the ₹${remaining.toLocaleString('en-IN')} I borrowed from you${record.dueDate ? ` (due: ${new Date(record.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})` : ''}. I will be returning it soon. Thanks a lot for the help!`
    : '';

  const [message, setMessage] = useState(defaultMsg);
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

  useEffect(() => {
    if (record) {
      setMessage(defaultMsg);
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success('Message copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    const cleanPhone = (record.phone || '').replace(/[^0-9]/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
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
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm shadow-2xs">
              <FontAwesomeIcon icon={faComments} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Message {record.lenderName}
              </h2>
              <p className="text-xs text-zinc-400">
                Pending debt: <span className="font-semibold text-purple-600 dark:text-purple-400">₹{remaining.toLocaleString('en-IN')}</span>
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

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
              Message Preview
            </label>
            <textarea
              rows="4"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3.5 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-xs dark:text-white resize-none bg-gray-50 dark:bg-gray-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="py-2.5 px-3.5 liquid-glass-subtle hover:bg-white/60 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs cursor-pointer touch-feedback"
            >
              <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-emerald-500' : ''} />
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer touch-feedback"
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

export default BorrowReminderModal;
