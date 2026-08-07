import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const ReminderModal = ({ isOpen, onClose, record }) => {
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FontAwesomeIcon icon={faPaperPlane} className="text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Friendly Reminder
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Polite message for {record.borrowerName}
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

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">
              Message Preview
            </label>
            <div className="p-4 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm leading-relaxed text-gray-800 dark:text-gray-200 select-all">
              {message}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-green-500' : ''} />
              <span>{copied ? 'Copied!' : 'Copy Message'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <FontAwesomeIcon icon={faPaperPlane} />
              <span>Send WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderModal;
