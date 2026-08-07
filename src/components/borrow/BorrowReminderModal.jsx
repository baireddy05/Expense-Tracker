import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faCopy, faCheck, faPhone, faComments } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const BorrowReminderModal = ({ isOpen, onClose, record }) => {
  if (!isOpen || !record) return null;

  const total = parseFloat(record.amount) || 0;
  const returned = parseFloat(record.returnedAmount) || 0;
  const remaining = Math.max(0, total - returned);

  const defaultMsg = `Hey ${record.lenderName}, just updating you regarding the ₹${remaining.toLocaleString('en-IN')} I borrowed from you${record.dueDate ? ` (due: ${new Date(record.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})` : ''}. I will be returning it soon. Thanks a lot for the help!`;

  const [message, setMessage] = useState(defaultMsg);
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-400/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <FontAwesomeIcon icon={faComments} className="text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Message {record.lenderName}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pending debt: <span className="font-semibold text-rose-600 dark:text-rose-400">₹{remaining.toLocaleString('en-IN')}</span>
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

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
              Message Preview
            </label>
            <textarea
              rows="4"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-green-500' : ''} />
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="py-2.5 px-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl shadow-lg shadow-green-600/25 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
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

export default BorrowReminderModal;
