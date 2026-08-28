import { useEffect } from 'react';

// Global counter to support multiple/stacked modals without prematurely unlocking scroll
let activeLockCount = 0;
let originalOverflow = '';
let originalTouchAction = '';

export const useBodyScrollLock = (isLocked) => {
  useEffect(() => {
    if (!isLocked) return;

    if (activeLockCount === 0) {
      originalOverflow = document.body.style.overflow;
      originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
    activeLockCount++;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);
      if (activeLockCount === 0) {
        document.body.style.overflow = originalOverflow || '';
        document.body.style.touchAction = originalTouchAction || '';
      }
    };
  }, [isLocked]);
};

export default useBodyScrollLock;
