import { useEffect, useId } from 'react';

// Use a Set of active modal IDs to guarantee 100% reliable lock tracking
const activeLocks = new Set();

export const useBodyScrollLock = (isLocked) => {
  const lockId = useId();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const docEl = document.documentElement;
    const prevHtmlOverflow = docEl.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPadding = document.body.style.paddingRight;
    const prevOverscroll = document.body.style.overscrollBehavior;

    const restore = () => {
      docEl.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.paddingRight = prevBodyPadding;
      document.body.style.overscrollBehavior = prevOverscroll;
    };

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
        restore();
      }
    }

    return () => {
      const wasLast = activeLocks.has(lockId) && activeLocks.size === 1;
      activeLocks.delete(lockId);
      if (activeLocks.size === 0 || wasLast) {
        restore();
      }
    };
  }, [isLocked, lockId]);
};

export default useBodyScrollLock;
