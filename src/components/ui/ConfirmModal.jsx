import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTimes, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  isDanger = true 
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const colorClasses = isDanger 
    ? 'bg-red-500 text-red-500 shadow-red-500/20 hover:bg-red-600'
    : 'bg-primary-500 text-primary-500 shadow-primary-500/20 hover:bg-primary-600';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      {/* Modal Content */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden z-10 animate-fade-in border border-gray-100 dark:border-gray-800 relative scale-in">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <div className="p-6 pt-8 text-center">
          <div className={`mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-opacity-10 dark:bg-opacity-20 mb-6 ${isDanger ? 'bg-red-500 text-red-500' : 'bg-primary-500 text-primary-500'}`}>
             <FontAwesomeIcon icon={isDanger ? faExclamationTriangle : faQuestionCircle} className="text-4xl" />
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
          <p className="text-gray-500 dark:text-gray-400 text-[15px] mb-8 leading-relaxed">
            {message}
          </p>

          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 px-5 py-3 rounded-2xl font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-5 py-3 rounded-2xl font-semibold text-white transition-all shadow-lg active:scale-95 ${isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25' : 'bg-primary-600 hover:bg-primary-500 shadow-primary-500/25'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
