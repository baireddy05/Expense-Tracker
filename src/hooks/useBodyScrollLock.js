import { useEffect, useId } from 'react';

// Use a Set of active modal IDs to guarantee 100% reliable lock tracking
const activeLocks = new Set();
let originalStyles = null;

export const useBodyScrollLock = (isLocked) => {
  const lockId = useId();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const docEl = document.documentElement;

    const restore = () => {
      if (originalStyles) {
        docEl.style.overflow = originalStyles.htmlOverflow;
        document.body.style.overflow = originalStyles.bodyOverflow;
        document.body.style.paddingRight = originalStyles.bodyPaddingRight;
        document.body.style.overscrollBehavior = originalStyles.overscroll;
        originalStyles = null;
      }
    };

    if (isLocked) {
      if (activeLocks.size === 0) {
        originalStyles = {
          htmlOverflow: docEl.style.overflow,
          bodyOverflow: document.body.style.overflow,
          bodyPaddingRight: document.body.style.paddingRight,
          overscroll: document.body.style.overscrollBehavior,
        };
        const sb = window.innerWidth - docEl.clientWidth;
        docEl.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        if (sb > 0) document.body.style.paddingRight = `${sb}px`;
        document.body.style.overscrollBehavior = 'contain';
      }
      activeLocks.add(lockId);
    } else {
      activeLocks.delete(lockId);
      if (activeLocks.size === 0) {
        restore();
      }
    }

    return () => {
      activeLocks.delete(lockId);
      if (activeLocks.size === 0) {
        restore();
      }
    };
  }, [isLocked, lockId]);
};

export default useBodyScrollLock;
