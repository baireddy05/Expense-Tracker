import { useEffect, useId } from 'react';

// Use a Set of active modal IDs to guarantee 100% reliable lock tracking
const activeLocks = new Set();

export const useBodyScrollLock = (isLocked) => {
  const lockId = useId();

  useEffect(() => {
    const docEl = document.documentElement;
    const prevHtmlOverflow = docEl.style.overflow;

    if (isLocked) {
      activeLocks.add(lockId);
      const sb = window.innerWidth - docEl.clientWidth;
      docEl.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      if (sb > 0) document.body.style.paddingRight = `${sb}px`;
      document.body.style.overscrollBehavior = 'contain';
    } else {
      activeLocks.delete(lockId);
      if (activeLocks.size === 0) {
        docEl.style.overflow = prevHtmlOverflow || '';
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.style.overscrollBehavior = '';
      }
    }

    return () => {
      const wasLast = activeLocks.has(lockId) && activeLocks.size === 1;
      activeLocks.delete(lockId);
      if (activeLocks.size === 0 || wasLast) {
        docEl.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.style.overscrollBehavior = '';
      }
    };
  }, [isLocked, lockId]);
};

export default useBodyScrollLock;
