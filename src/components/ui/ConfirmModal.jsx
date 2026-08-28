import React from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTimes, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  isDanger = true 
}) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden z-10 animate-scale-in border border-zinc-200/80 dark:border-zinc-800 relative my-auto"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 touch-feedback cursor-pointer"
        >
          <FontAwesomeIcon icon={faTimes} className="text-xs" />
        </button>

        <div className="p-6 pt-7 text-center">
          <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-2xl mb-4 ${
            isDanger ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20' : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
          }`}>
             <FontAwesomeIcon icon={isDanger ? faExclamationTriangle : faQuestionCircle} className="text-xl" />
          </div>
          
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1.5">{title}</h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs mb-6 leading-relaxed">
            {message}
          </p>

          <div className="flex gap-2.5 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-semibold text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors touch-feedback cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-xs text-white transition-all shadow-xs touch-feedback cursor-pointer ${
                isDanger 
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' 
                  : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
